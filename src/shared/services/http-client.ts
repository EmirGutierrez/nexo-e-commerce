/** Cliente del BFF de Next.js. El navegador solo solicita rutas del mismo origen. */
export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let csrfToken: string | null = null;

const TAB_SESSION_STORAGE_KEY = 'nexo.auth.tab-session.v1';
const TAB_SESSION_CHANNEL_NAME = 'nexo.auth.tab-session.v1';
const TAB_SESSION_OWNER_STORAGE_PREFIX = 'nexo.auth.tab-owner.v1.';
const TAB_SESSION_HEADER = 'X-Nexo-Tab-Session';
const TAB_SESSION_ID_PATTERN = /^[a-f0-9]{48}$/;
const TAB_SESSION_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const TAB_SESSION_INSTANCE_ID = createRandomToken();

let activeTabSessionFingerprint: string | null = null;
let registeredTabSessionFingerprint: string | null = null;
let tabSessionIdPromise: Promise<string> | null = null;
let tabSessionChannel: BroadcastChannel | null = null;
let pendingTabSessionProbe: { fingerprint: string; peers: Set<string> } | null = null;

const isWriteMethod = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method);

function createRandomToken(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fingerprintTabSessionId(id: string): Promise<string | null> {
  if (typeof window === 'undefined' || !window.crypto.subtle) return null;
  try {
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

function claimTabSessionFingerprint(fingerprint: string): boolean {
  try {
    const key = `${TAB_SESSION_OWNER_STORAGE_PREFIX}${fingerprint}`;
    const owner = window.localStorage.getItem(key);
    if (owner && owner !== TAB_SESSION_INSTANCE_ID) return false;
    window.localStorage.setItem(key, TAB_SESSION_INSTANCE_ID);
    return window.localStorage.getItem(key) === TAB_SESSION_INSTANCE_ID;
  } catch {
    // BroadcastChannel se mantiene como alternativa cuando el navegador bloquea localStorage.
    return true;
  }
}

function releaseTabSessionFingerprint(fingerprint: string | null) {
  if (!fingerprint) return;
  try {
    const key = `${TAB_SESSION_OWNER_STORAGE_PREFIX}${fingerprint}`;
    if (window.localStorage.getItem(key) === TAB_SESSION_INSTANCE_ID) window.localStorage.removeItem(key);
  } catch { /* La cookie sigue aislada aunque el navegador bloquee localStorage. */ }
}

function registerTabSessionCleanup() {
  if (typeof window === 'undefined') return;
  window.addEventListener('pagehide', (event) => {
    // Una página en bfcache sigue siendo una pestaña activa y conserva su cookie.
    if (!event.persisted) releaseTabSessionFingerprint(registeredTabSessionFingerprint);
  });
}

function ensureTabSessionChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (tabSessionChannel) return tabSessionChannel;

  tabSessionChannel = new BroadcastChannel(TAB_SESSION_CHANNEL_NAME);
  tabSessionChannel.addEventListener('message', (event: MessageEvent<{
    type?: unknown;
    fingerprint?: unknown;
    instanceId?: unknown;
  }>) => {
    const message = event.data;
    if (!message || typeof message.fingerprint !== 'string' || !TAB_SESSION_FINGERPRINT_PATTERN.test(message.fingerprint) ||
        typeof message.instanceId !== 'string' || message.instanceId === TAB_SESSION_INSTANCE_ID) return;

    if (message.type === 'probe' && message.fingerprint === activeTabSessionFingerprint) {
      tabSessionChannel?.postMessage({ type: 'active', fingerprint: message.fingerprint, instanceId: TAB_SESSION_INSTANCE_ID });
      return;
    }

    if (message.type === 'active' && message.fingerprint === pendingTabSessionProbe?.fingerprint) {
      pendingTabSessionProbe.peers.add(message.instanceId);
    }
  });
  return tabSessionChannel;
}

async function initializeTabSessionId(): Promise<string> {
  let id: string;
  try {
    const stored = window.sessionStorage.getItem(TAB_SESSION_STORAGE_KEY);
    id = stored && TAB_SESSION_ID_PATTERN.test(stored) ? stored : createRandomToken();
  } catch {
    // Si el navegador bloquea sessionStorage, la identidad dura solo esta carga de la pestaña.
    id = createRandomToken();
  }

  let fingerprint = await fingerprintTabSessionId(id);
  if (fingerprint && !claimTabSessionFingerprint(fingerprint)) {
    // sessionStorage puede copiarse al duplicar una pestaña; el propietario original
    // conserva su sesión y la nueva pestaña recibe una identidad distinta antes del login.
    id = createRandomToken();
    fingerprint = await fingerprintTabSessionId(id);
    while (fingerprint && !claimTabSessionFingerprint(fingerprint)) {
      id = createRandomToken();
      fingerprint = await fingerprintTabSessionId(id);
    }
  }
  try { window.sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, id); } catch { /* Se usa la identidad en memoria. */ }

  activeTabSessionFingerprint = fingerprint;
  registeredTabSessionFingerprint = fingerprint;
  registerTabSessionCleanup();
  const channel = ensureTabSessionChannel();
  if (!channel || !fingerprint) return id;

  const peers = new Set<string>();
  pendingTabSessionProbe = { fingerprint, peers };
  channel.postMessage({ type: 'probe', fingerprint, instanceId: TAB_SESSION_INSTANCE_ID });
  // Al duplicar una pestaña, algunos navegadores copian sessionStorage. El sondeo detecta
  // otra pestaña activa con el mismo identificador y da a la nueva una cookie independiente.
  await new Promise((resolve) => window.setTimeout(resolve, 120));

  if (peers.size) {
    releaseTabSessionFingerprint(registeredTabSessionFingerprint);
    id = createRandomToken();
    fingerprint = await fingerprintTabSessionId(id);
    while (fingerprint && !claimTabSessionFingerprint(fingerprint)) {
      id = createRandomToken();
      fingerprint = await fingerprintTabSessionId(id);
    }
    activeTabSessionFingerprint = fingerprint;
    registeredTabSessionFingerprint = fingerprint;
    try { window.sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, id); } catch { /* Se usa la identidad en memoria. */ }
  }

  pendingTabSessionProbe = null;
  return id;
}

function getTabSessionId(): Promise<string> {
  if (typeof window === 'undefined') return Promise.resolve('');
  tabSessionIdPromise ??= initializeTabSessionId();
  return tabSessionIdPromise;
}

async function readResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    const body = payload as { message?: unknown; code?: unknown } | null;
    const message = typeof body?.message === 'string' ? body.message : `La solicitud falló (${response.status}).`;
    const code = typeof body?.code === 'string' ? body.code : undefined;
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) return undefined as T;
  return payload as T;
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const tabSessionId = await getTabSessionId();
  const response = await fetch('/api/auth/csrf', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json', [TAB_SESSION_HEADER]: tabSessionId },
  });
  const result = await readResponse<{ token: string }>(response);
  if (!result.token) throw new Error('El servidor no devolvió el token CSRF.');
  csrfToken = result.token;
  return csrfToken;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const tabSessionId = await getTabSessionId();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (tabSessionId) headers[TAB_SESSION_HEADER] = tabSessionId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (isWriteMethod(method)) headers['X-CSRF-TOKEN'] = await getCsrfToken();

  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return readResponse<T>(response);
}

export const apiClient: ApiClient = {
  get: <T,>(path: string) => request<T>('GET', path),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T,>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T,>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T,>(path: string) => request<T>('DELETE', path),
};

export function clearCsrfToken() {
  csrfToken = null;
}
