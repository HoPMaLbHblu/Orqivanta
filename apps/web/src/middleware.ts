import { NextResponse, type NextRequest } from 'next/server';

/**
 * Lightweight edge step: exposes the request path to server components (for sign-in
 * redirects) and attaches a request id for logs. Authentication itself happens in the
 * server components and actions, against the database.
 */
export function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname + req.nextUrl.search);
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  requestHeaders.set('x-request-id', requestId);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('x-request-id', requestId);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)'],
};
