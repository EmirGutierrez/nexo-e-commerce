import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'NEXOSESSION';
const TAB_SESSION_COOKIE_PREFIX = `${SESSION_COOKIE}_`;
const TAB_SESSION_HEADER = 'x-nexo-tab-session';
const TAB_SESSION_ID_PATTERN = /^[a-f0-9]{48}$/;
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const DOCKER_BACKEND_HOST = 'backend';

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
  const tabCookieName = sessionCookieName(request.headers.get(TAB_SESSION_HEADER));
  const session = tabCookieName ? request.cookies.get(tabCookieName)?.value : undefined;
  if (contentType) headers.set('Content-Type', contentType);
  if (csrfToken) headers.set('X-CSRF-TOKEN', csrfToken);
  if (session) headers.set('Cookie', `${SESSION_COOKIE}=${session}`);

  const target = `${origin}/api/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: 'no-store',
      redirect: 'manual',
    });
    const outgoing = new NextResponse(upstream.status === 204 || upstream.status === 304 ? null : upstream.body, {
      status: upstream.status,
      headers: {
        'Cache-Control': 'no-store',
        ...(upstream.headers.get('content-type') ? { 'Content-Type': upstream.headers.get('content-type')! } : {}),
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
