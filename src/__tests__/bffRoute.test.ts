import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/[...path]/route';

const TAB_ID = 'a'.repeat(48);
const TAB_COOKIE = `NEXOSESSION_${TAB_ID}`;
const originalBackendUrl = process.env.SPRING_BACKEND_URL;
const originalDockerFlag = process.env.SPRING_BACKEND_ALLOW_DOCKER_HTTP;
type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const context = (path: string[]) => ({ params: Promise.resolve({ path }) }) as never;
const request = (url: string, init?: NextRequestInit) => new NextRequest(new URL(url, 'http://localhost:3000'), init);

beforeEach(() => {
  process.env.SPRING_BACKEND_URL = 'https://api.example.test';
  delete process.env.SPRING_BACKEND_ALLOW_DOCKER_HTTP;
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  if (originalBackendUrl === undefined) delete process.env.SPRING_BACKEND_URL;
  else process.env.SPRING_BACKEND_URL = originalBackendUrl;
  if (originalDockerFlag === undefined) delete process.env.SPRING_BACKEND_ALLOW_DOCKER_HTTP;
  else process.env.SPRING_BACKEND_ALLOW_DOCKER_HTTP = originalDockerFlag;
  vi.unstubAllGlobals();
});

describe('Next.js API BFF route', () => {
  it('rejects missing or unsafe backend origins without forwarding the request', async () => {
    delete process.env.SPRING_BACKEND_URL;
    const missing = await GET(request('/api/catalog/products'), context(['catalog', 'products']));
    expect(missing.status).toBe(503);
    expect(await missing.json()).toMatchObject({ code: 'BACKEND_NOT_CONFIGURED' });

    process.env.SPRING_BACKEND_URL = 'http://api.example.test';
    const insecure = await GET(request('/api/catalog/products'), context(['catalog', 'products']));
    expect(insecure.status).toBe(503);

    process.env.SPRING_BACKEND_URL = 'https://user:secret@api.example.test';
    const credentialed = await GET(request('/api/catalog/products'), context(['catalog', 'products']));
    expect(credentialed.status).toBe(503);

    process.env.SPRING_BACKEND_URL = 'https://api.example.test/backend';
    const pathConfigured = await GET(request('/api/catalog/products'), context(['catalog', 'products']));
    expect(pathConfigured.status).toBe(503);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('forwards requests and safe headers, relays only the tab session, and clears the legacy cookie', async () => {
    const headers = new Headers({ 'content-type': 'application/json', 'retry-after': '3' });
    headers.append('set-cookie', 'NEXOSESSION=rotated; Path=/; HttpOnly; SameSite=Lax');
    vi.mocked(fetch).mockResolvedValue(new Response('{"ok":true}', { status: 201, headers }));
    const outgoingRequest = request('/api/auth/login?return=%2Fstore', {
      method: 'POST',
      headers: {
        'accept': 'application/json', 'content-type': 'application/json', 'x-csrf-token': 'csrf-value',
        'idempotency-key': 'operation-1', 'x-forwarded-for': '198.51.100.7',
        'x-nexo-tab-session': TAB_ID, cookie: `${TAB_COOKIE}=old-session; NEXOSESSION=legacy-session`,
      },
      body: '{"email":"user@example.test"}',
    });

    const response = await POST(outgoingRequest, context(['auth', 'login']));

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('3');
    const [target, options] = vi.mocked(fetch).mock.calls[0];
    expect(target).toBe('https://api.example.test/api/auth/login?return=%2Fstore');
    expect(options?.headers).toMatchObject({});
    const forwardedHeaders = options?.headers as Headers;
    expect(forwardedHeaders.get('X-CSRF-TOKEN')).toBe('csrf-value');
    expect(forwardedHeaders.get('Idempotency-Key')).toBe('operation-1');
    expect(forwardedHeaders.get('Cookie')).toBe('NEXOSESSION=old-session');
    expect(new TextDecoder().decode(options?.body as ArrayBuffer)).toBe('{"email":"user@example.test"}');
    expect(response.cookies.get(TAB_COOKIE)?.value).toBe('rotated');
    expect(response.cookies.get('NEXOSESSION')?.maxAge).toBe(0);
  });

  it('rejects malformed and oversized declared request lengths before calling the backend', async () => {
    const malformed = await POST(request('/api/items', {
      method: 'POST', headers: { 'content-length': 'unknown' }, body: 'x',
    }), context(['items']));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ code: 'INVALID_CONTENT_LENGTH' });

    const oversized = await POST(request('/api/items', {
      method: 'POST', headers: { 'content-length': String(2 * 1024 * 1024 + 1) }, body: 'x',
    }), context(['items']));
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toMatchObject({ code: 'REQUEST_TOO_LARGE' });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('rejects a body that exceeds the limit while streaming and releases the reader', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
      },
      cancel() { cancelled = true; },
    });
    const oversized = await POST(request('/api/items', {
      method: 'POST', body: stream, duplex: 'half',
    } as NextRequestInit), context(['items']));

    expect(oversized.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('returns a client error when the request stream cannot be read', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull() { throw new Error('corrupt stream'); },
    });
    const invalid = await POST(request('/api/items', {
      method: 'POST', body: stream, duplex: 'half',
    } as NextRequestInit), context(['items']));

    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: 'INVALID_REQUEST_BODY' });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('limits simultaneous body reads and returns a retry hint when capacity is reached', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let started = 0;
    let allStarted!: () => void;
    const startedPromise = new Promise<void>((resolve) => { allStarted = resolve; });
    vi.mocked(fetch).mockImplementation(async () => new Response('ok'));
    const pending = Array.from({ length: 32 }, () => {
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          started++;
          if (started === 32) allStarted();
          await gate;
          controller.enqueue(new Uint8Array([1]));
          controller.close();
        },
      });
      return POST(request('/api/items', { method: 'POST', body: stream, duplex: 'half' } as NextRequestInit), context(['items']));
    });

    try {
      await startedPromise;
      const overloaded = await POST(request('/api/items', { method: 'POST', body: 'x' }), context(['items']));
      expect(overloaded.status).toBe(429);
      expect(overloaded.headers.get('retry-after')).toBe('1');
      expect(await overloaded.json()).toMatchObject({ code: 'REQUEST_CAPACITY' });
    } finally {
      release();
    }
    expect((await Promise.all(pending)).every((response) => response.status === 200)).toBe(true);
  });

  it('returns 502 when the backend is unavailable and expires a tab cookie after logout or password change', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    const unavailable = await GET(request('/api/catalog/products'), context(['catalog', 'products']));
    expect(unavailable.status).toBe(502);
    expect(await unavailable.json()).toMatchObject({ code: 'BACKEND_UNAVAILABLE' });

    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const logoutRequest = request('/api/auth/logout', {
      method: 'POST', headers: { 'x-nexo-tab-session': TAB_ID, cookie: `${TAB_COOKIE}=active` },
    });
    const logout = await POST(logoutRequest, context(['auth', 'logout']));
    expect(logout.status).toBe(204);
    expect(logout.cookies.get(TAB_COOKIE)?.maxAge).toBe(0);
    expect(logout.cookies.get('NEXOSESSION')?.maxAge).toBe(0);

    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const passwordChangeRequest = request('/api/auth/me/password', {
      method: 'POST', headers: { 'x-nexo-tab-session': TAB_ID, cookie: `${TAB_COOKIE}=active` },
    });
    const passwordChange = await POST(passwordChangeRequest, context(['auth', 'me', 'password']));
    expect(passwordChange.status).toBe(204);
    expect(passwordChange.cookies.get(TAB_COOKIE)?.maxAge).toBe(0);
    expect(passwordChange.cookies.get('NEXOSESSION')?.maxAge).toBe(0);
  });

  it('allows loopback and explicitly enabled Docker HTTP backends only in their intended contexts', async () => {
    process.env.SPRING_BACKEND_URL = 'http://127.0.0.1:8080';
    vi.mocked(fetch).mockResolvedValueOnce(new Response('ok'));
    const local = await GET(request('/api/health'), context(['health']));
    expect(local.status).toBe(200);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('http://127.0.0.1:8080/api/health');

    process.env.SPRING_BACKEND_URL = 'http://backend:8080';
    process.env.SPRING_BACKEND_ALLOW_DOCKER_HTTP = 'true';
    vi.mocked(fetch).mockResolvedValueOnce(new Response('ok'));
    const docker = await GET(request('/api/health'), context(['health']));
    expect(docker.status).toBe(200);
  });
});
