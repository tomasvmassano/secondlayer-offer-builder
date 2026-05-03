import { NextResponse } from 'next/server';
import { issueMagicLink } from '../../../lib/magicLink';
import { sendMagicLinkEmail } from '../../../lib/sendMagicLinkEmail';
import { isTeamEmail, findUserByEmail } from '../../../lib/users';
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit';

/**
 * POST /api/auth/request-link
 * Body: { email }
 *
 * Behaviour:
 *   - Always returns 200 OK regardless of whether the email exists.
 *     (Prevents email enumeration attacks.)
 *   - Only actually sends a magic link if the email is in the team allowlist
 *     OR is the contactEmail of an existing creator user.
 *   - Rate-limited per IP and per email.
 */
export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: true }); }

  const email = String(body?.email || '').trim().toLowerCase();
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return NextResponse.json({ ok: true });
  }

  const ip = getClientIp(request);

  // Per-IP: 10/hour. Per-email: 5/hour.
  const ipLimit    = await checkRateLimit({ key: `auth:req:ip:${ip}`,       limit: 10, windowSec: 3600 });
  const emailLimit = await checkRateLimit({ key: `auth:req:email:${email}`, limit: 5,  windowSec: 3600 });
  if (!ipLimit.ok || !emailLimit.ok) {
    return NextResponse.json({ ok: true }); // silent — don't tell attacker they're rate-limited
  }

  // Check if the email is allowed (team allowlist or existing creator user).
  const allowed = (await isTeamEmail(email)) || !!(await findUserByEmail(email));
  if (!allowed) {
    // Don't reveal — return 200 anyway.
    return NextResponse.json({ ok: true });
  }

  try {
    const { token, code } = await issueMagicLink(email);
    const origin = request.headers.get('origin')
      || `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`;
    const link = `${origin}/api/auth/verify?t=${encodeURIComponent(token)}`;
    await sendMagicLinkEmail({ email, link, code });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[request-link] failed:', err.message);
    return NextResponse.json({ ok: true }); // still don't reveal
  }
}
