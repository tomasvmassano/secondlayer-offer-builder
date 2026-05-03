import { NextResponse } from 'next/server';
import { sessionCookieHeader } from '../../../lib/auth';

export async function POST(request) {
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', sessionCookieHeader('', { clear: true }));
  return res;
}

export async function GET(request) {
  // Convenience: GET /api/auth/signout redirects to /signin with cookie cleared.
  const res = NextResponse.redirect(new URL('/signin', request.url));
  res.headers.set('Set-Cookie', sessionCookieHeader('', { clear: true }));
  return res;
}
