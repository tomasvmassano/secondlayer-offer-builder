/**
 * Auth gate. Runs on every request before route handlers.
 *
 * Public paths (no auth needed):
 *   - /signin
 *   - /onboarding/[token]                — token IS the auth (creators may not have an account yet)
 *   - /api/onboarding/[token]            — same
 *   - /api/onboarding/[token]/complete   — same
 *   - /api/auth/*                        — sign-in flow
 *   - /api/proxy-image                   — used by /onboarding (creator's own profile pic)
 *   - /api/cron/*                        — Vercel cron (guarded by CRON_SECRET in route handlers)
 *   - /privacy                           — public privacy policy
 *   - /_next/*, /favicon.ico, /icon.png  — static
 *
 * Everything else requires a valid session cookie. If missing or invalid,
 * we redirect to /signin?next=<original-url>.
 *
 * Only role=team is implemented today — every signed-in user is treated as
 * team. (The creator-portal at /c/[token] is not built; references removed.)
 */

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_EXACT = new Set([
  '/signin',
  '/privacy',
  '/favicon.ico',
  '/icon.png',
]);

const PUBLIC_PREFIXES = [
  '/_next/',
  '/api/auth/',
  '/api/onboarding/',
  '/onboarding/',
  '/api/cron/',
  '/api/proxy-image',
];

function isPublic(pathname) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  for (const p of PUBLIC_PREFIXES) {
    if (pathname === p || pathname.startsWith(p)) return true;
  }
  return false;
}

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s) return null;
  return new TextEncoder().encode(s);
}

async function verifySession(request) {
  const cookie = request.cookies.get('sl_session')?.value;
  if (!cookie) return null;
  const secret = getSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(cookie, secret, { issuer: 'secondlayer-hub' });
    return {
      userId: payload.userId || payload.sub,
      email: payload.email,
      role: payload.role,
      creatorId: payload.creatorId || null,
    };
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Feature flag: until AUTH_ENABLED=true is set on Vercel, the gate is a no-op.
  // This lets us deploy auth without locking ourselves out before verifying sign-in.
  if (process.env.AUTH_ENABLED !== 'true') return NextResponse.next();

  if (isPublic(pathname)) return NextResponse.next();

  const user = await verifySession(request);

  if (!user) {
    // Redirect to signin with next= for nice UX after login.
    const signinUrl = new URL('/signin', request.url);
    if (pathname !== '/') signinUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(signinUrl);
  }

  // Only team role is implemented today — every signed-in user gets full access.
  // (Creator portal at /c/[token] is on the roadmap; reintroduce role gating
  // here once the portal pages exist.)
  return NextResponse.next();
}

export const config = {
  // Run on every path except Next.js internals and the obvious static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png).*)'],
};
