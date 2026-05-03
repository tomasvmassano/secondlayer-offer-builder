import { NextResponse } from 'next/server';
import { consumeMagicLink } from '../../../lib/magicLink';
import { findUserByEmail, isTeamEmail, upsertUser, touchUser } from '../../../lib/users';
import { signSessionJWT, sessionCookieHeader } from '../../../lib/auth';
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit';

async function consumeAndSignIn({ token, code, request, redirectTo }) {
  const ip = getClientIp(request);
  // 20/hour per IP — tighter than request-link since this is the actual gate.
  const rl = await checkRateLimit({ key: `auth:verify:ip:${ip}`, limit: 20, windowSec: 3600 });
  if (!rl.ok) {
    return { error: 'Too many attempts. Try again later.', status: 429 };
  }

  const consumed = await consumeMagicLink({ token, code });
  if (!consumed) {
    return { error: 'Invalid or expired code.', status: 401 };
  }
  const email = consumed.email;

  // Resolve the user. If they're in the team allowlist and don't exist yet, auto-create.
  let user = await findUserByEmail(email);
  if (!user) {
    if (await isTeamEmail(email)) {
      user = await upsertUser({ email, role: 'team' });
    } else {
      // Magic link issued for an email that's no longer allowed.
      return { error: 'Account not found.', status: 401 };
    }
  }
  await touchUser(user.id);

  const jwt = await signSessionJWT({
    userId: user.id, email: user.email, role: user.role, creatorId: user.creatorId,
  });
  const cookie = sessionCookieHeader(jwt);

  // Decide where to send them.
  let nextUrl = redirectTo || '/';
  if (user.role === 'creator' && user.creatorId) {
    // Creators land on their portal. We'll need to look up their token.
    // For now redirect to a router that resolves token, or pass creator-id.
    nextUrl = `/c/by-id/${user.creatorId}`;
  }
  return { ok: true, cookie, nextUrl, user };
}

/**
 * GET /api/auth/verify?t=<token>
 * Click-from-email path. Sets cookie + redirects.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  const result = await consumeAndSignIn({ token, request, redirectTo: url.searchParams.get('next') });

  if (result.error) {
    const errUrl = new URL('/signin', request.url);
    errUrl.searchParams.set('error', result.error);
    return NextResponse.redirect(errUrl);
  }
  const res = NextResponse.redirect(new URL(result.nextUrl, request.url));
  res.headers.set('Set-Cookie', result.cookie);
  return res;
}

/**
 * POST /api/auth/verify
 * Body: { code } — 6-digit-code path (cross-device).
 * Returns { ok, redirectTo } JSON; the client navigates after.
 */
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const code = String(body?.code || '').trim();
  const result = await consumeAndSignIn({ code, request });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const res = NextResponse.json({ ok: true, redirectTo: result.nextUrl });
  res.headers.set('Set-Cookie', result.cookie);
  return res;
}
