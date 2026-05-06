import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes publiques (accessibles sans authentification)
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];

// Routes qui nécessitent une authentification mais sont des pages spéciales
const AUTH_REQUIRED_SPECIAL = ['/select-company', '/dashboard'];

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ne pas intercepter les assets statiques, API, etc.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/offline') ||
    pathname.includes('.') // Fichiers statiques (images, fonts, etc.)
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('firebase-session');
  const isAuthenticated = !!sessionCookie && !isJwtExpired(sessionCookie.value);
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isRootPath = pathname === '/';

  // Page racine : laisser passer (redirection gérée côté client)
  if (isRootPath) {
    return NextResponse.next();
  }

  // Utilisateur connecté sur une page publique -> rediriger vers dashboard
  if (isAuthenticated && isPublicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Utilisateur non connecté sur une route protégée -> rediriger vers login
  if (!isAuthenticated && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons|sw.js|manifest.json).*)'],
};
