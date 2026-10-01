/** Cliente del BFF de Next.js. El navegador solo solicita rutas del mismo origen. */
export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
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

const isWriteMethod = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method);

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
  const response = await fetch('/api/auth/csrf', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const result = await readResponse<{ token: string }>(response);
  if (!result.token) throw new Error('El servidor no devolvió el token CSRF.');
  csrfToken = result.token;
  return csrfToken;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
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
  delete: <T,>(path: string) => request<T>('DELETE', path),
};

export function clearCsrfToken() {
  csrfToken = null;
}
