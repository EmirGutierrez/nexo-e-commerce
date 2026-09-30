import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'NEXOSESSION';
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

function isLocalHttp(request: NextRequest): boolean {
  return request.nextUrl.protocol === 'http:' && LOOPBACK_HOSTS.includes(request.nextUrl.hostname);
}

function secureCookie(request: NextRequest): boolean {
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
  if (url.protocol !== 'https:' && !(isLocalHttp(request) && LOOPBACK_HOSTS.includes(url.hostname))) {
    throw new Error('SPRING_BACKEND_URL must use HTTPS outside localhost');
  }
  return url.origin;
}

function relaySessionCookie(upstream: Response, outgoing: NextResponse, request: NextRequest) {
  for (const header of upstream.headers.getSetCookie()) {
    const [pair, ...attributes] = header.split(';');
    const separator = pair.indexOf('=');
    if (separator < 0 || pair.slice(0, separator).trim() !== SESSION_COOKIE) continue;

    const value = pair.slice(separator + 1).trim();
    const maxAge = attributes.find((part) => part.trim().toLowerCase().startsWith('max-age='));
    const expires = attributes.find((part) => part.trim().toLowerCase().startsWith('expires='));
    const expired = !value || (maxAge && Number(maxAge.split('=')[1]) <= 0) ||
      (expires && Date.parse(expires.split('=').slice(1).join('=')) <= Date.now());

    outgoing.cookies.set(SESSION_COOKIE, expired ? '' : value, {
      httpOnly: true,
      secure: secureCookie(request),
      sameSite: 'lax',
      path: '/',
      ...(expired ? { maxAge: 0 } : {}),
    });
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
  const session = request.cookies.get(SESSION_COOKIE)?.value;
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
    relaySessionCookie(upstream, outgoing, request);
    if (request.method === 'POST' && path.join('/') === 'auth/logout' && upstream.ok) {
      outgoing.cookies.set(SESSION_COOKIE, '', {
        httpOnly: true,
        secure: secureCookie(request),
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
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
