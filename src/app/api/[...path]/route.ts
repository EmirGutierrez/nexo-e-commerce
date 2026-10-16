import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'NEXOSESSION';
const TAB_SESSION_COOKIE_PREFIX = `${SESSION_COOKIE}_`;
const TAB_SESSION_HEADER = 'x-nexo-tab-session';
const TAB_SESSION_ID_PATTERN = /^[a-f0-9]{48}$/;
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const DOCKER_BACKEND_HOST = 'backend';
const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024;
const MAX_CONCURRENT_BODY_READS = 32;
let activeBodyReads = 0;

function isLocalHttp(request: NextRequest): boolean {
  return request.nextUrl.protocol === 'http:' && LOOPBACK_HOSTS.includes(request.nextUrl.hostname);
}

function secureCookie(request: NextRequest): boolean {
  const configured = process.env.SESSION_COOKIE_SECURE;
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  return !isLocalHttp(request) && (process.env.NODE_ENV === 'production' || request.nextUrl.protocol === 'https:');
}

function backendOrigin(request: NextRequest): string {
  const configured = process.env.SPRING_BACKEND_URL;
  if (!configured) throw new Error('SPRING_BACKEND_URL is required');

  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SPRING_BACKEND_URL must be an origin');
  }
  const localDockerBackend = process.env.SPRING_BACKEND_ALLOW_DOCKER_HTTP === 'true' &&
    url.hostname === DOCKER_BACKEND_HOST;
  if (url.protocol !== 'https:' && !(isLocalHttp(request) && LOOPBACK_HOSTS.includes(url.hostname) || localDockerBackend)) {
    throw new Error('SPRING_BACKEND_URL must use HTTPS outside localhost');
  }
  return url.origin;
}

function sessionCookieName(tabSessionId: string | null): string | null {
  return tabSessionId && TAB_SESSION_ID_PATTERN.test(tabSessionId)
    ? `${TAB_SESSION_COOKIE_PREFIX}${tabSessionId}`
    : null;
}

function setSessionCookie(outgoing: NextResponse, request: NextRequest, name: string, value: string, expired: boolean) {
  outgoing.cookies.set(name, expired ? '' : value, {
    httpOnly: true,
    secure: secureCookie(request),
    sameSite: 'lax',
    path: '/',
    ...(expired ? { maxAge: 0 } : {}),
  });
}

function clearLegacySessionCookie(outgoing: NextResponse, request: NextRequest) {
  // La cookie compartida anterior no identifica una pestaña; ya no debe autorizar solicitudes.
  setSessionCookie(outgoing, request, SESSION_COOKIE, '', true);
}

function relaySessionCookie(upstream: Response, outgoing: NextResponse, request: NextRequest, tabCookieName: string | null) {
  if (!tabCookieName) return;

  for (const header of upstream.headers.getSetCookie()) {
    const [pair, ...attributes] = header.split(';');
    const separator = pair.indexOf('=');
    if (separator < 0 || pair.slice(0, separator).trim() !== SESSION_COOKIE) continue;

    const value = pair.slice(separator + 1).trim();
    const maxAge = attributes.find((part) => part.trim().toLowerCase().startsWith('max-age='));
    const expires = attributes.find((part) => part.trim().toLowerCase().startsWith('expires='));
    const expired = !value || (maxAge && Number(maxAge.split('=')[1]) <= 0) ||
      (expires && Date.parse(expires.split('=').slice(1).join('=')) <= Date.now());

    setSessionCookie(outgoing, request, tabCookieName, value, Boolean(expired));
  }
}

async function forward(request: NextRequest, context: RouteContext<'/api/[...path]'>) {
  const { path } = await context.params;
  let origin: string;
  try {
    origin = backendOrigin(request);
  } catch {
    return NextResponse.json({ code: 'BACKEND_NOT_CONFIGURED', message: 'La API no está configurada.' }, { status: 503 });
  }

  const headers = new Headers({ Accept: request.headers.get('accept') || 'application/json' });
  const contentType = request.headers.get('content-type');
  const csrfToken = request.headers.get('x-csrf-token');
  const idempotencyKey = request.headers.get('idempotency-key');
  const forwardedFor = request.headers.get('x-forwarded-for');
  const tabCookieName = sessionCookieName(request.headers.get(TAB_SESSION_HEADER));
  const session = tabCookieName ? request.cookies.get(tabCookieName)?.value : undefined;
  if (contentType) headers.set('Content-Type', contentType);
  if (csrfToken) headers.set('X-CSRF-TOKEN', csrfToken);
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
  // Caddy replaces client-supplied forwarding headers at the public edge.
  if (forwardedFor) headers.set('X-Forwarded-For', forwardedFor);
  if (session) headers.set('Cookie', `${SESSION_COOKIE}=${session}`);

  const target = `${origin}/api/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  let body: ArrayBuffer | undefined;
  if (!['GET', 'HEAD'].includes(request.method)) {
    const declaredLength = request.headers.get('content-length');
    if (declaredLength !== null && !/^\d+$/.test(declaredLength)) {
      return NextResponse.json({ code: 'INVALID_CONTENT_LENGTH', message: 'El tamaño de la solicitud no es válido.' }, { status: 400 });
    }
    if (declaredLength !== null && Number(declaredLength) > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json({ code: 'REQUEST_TOO_LARGE', message: 'La solicitud supera el tamaño permitido.' }, { status: 413 });
    }
    if (activeBodyReads >= MAX_CONCURRENT_BODY_READS) {
      return NextResponse.json(
        { code: 'REQUEST_CAPACITY', message: 'La API está ocupada. Intenta nuevamente en unos segundos.' },
        { status: 429, headers: { 'Retry-After': '1' } },
      );
    }
    activeBodyReads++;
    try {
      const boundedBody = await readBoundedBody(request);
      if (boundedBody === null) {
        return NextResponse.json({ code: 'REQUEST_TOO_LARGE', message: 'La solicitud supera el tamaño permitido.' }, { status: 413 });
      }
      body = boundedBody;
    } catch {
      return NextResponse.json({ code: 'INVALID_REQUEST_BODY', message: 'No se pudo leer la solicitud.' }, { status: 400 });
    } finally {
      activeBodyReads--;
    }
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
    });
    const outgoing = new NextResponse(upstream.status === 204 || upstream.status === 304 ? null : upstream.body, {
      status: upstream.status,
      headers: {
        'Cache-Control': 'no-store',
        ...(upstream.headers.get('content-type') ? { 'Content-Type': upstream.headers.get('content-type')! } : {}),
        ...(upstream.headers.get('retry-after') ? { 'Retry-After': upstream.headers.get('retry-after')! } : {}),
      },
    });
    relaySessionCookie(upstream, outgoing, request, tabCookieName);
    clearLegacySessionCookie(outgoing, request);
    if (request.method === 'POST' && path.join('/') === 'auth/logout' && upstream.ok) {
      if (tabCookieName) setSessionCookie(outgoing, request, tabCookieName, '', true);
    }
    return outgoing;
  } catch {
    return NextResponse.json({ code: 'BACKEND_UNAVAILABLE', message: 'No se pudo contactar la API.' }, { status: 502 });
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;

async function readBoundedBody(request: NextRequest): Promise<ArrayBuffer | null> {
  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new ArrayBuffer(totalBytes);
  const bodyBytes = new Uint8Array(body);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
