import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  const locale = pathname.startsWith('/zh') ? 'zh' : 'en';

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/en', request.url));
  }

  requestHeaders.set('x-contextgo-locale', locale);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
