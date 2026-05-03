/**
 * Auth — magic-link sessions backed by JWT in an httpOnly cookie.
 *
 * Why this design:
 *   - Edge-runtime safe (uses jose, works inside middleware.js without bundling node crypto).
 *   - No passwords stored anywhere → nothing to leak in a DB breach.
 *   - Sessions are stateless: signed JWT in cookie, verified per request, no Redis read on hot path.
 *   - The 30-day cookie is rotated on every "verify" — keeps usage active without forcing re-auth.
 *
 * Cookie shape: `sl_session = <jwt>` where the JWT payload is { userId, email, role, creatorId? }.
 * Single source of truth for the secret: env var SESSION_SECRET (32+ random chars).
 */

import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'sl_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const ISSUER = 'secondlayer-hub';

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET env var missing or too short (need 32+ chars)');
  }
  return new TextEncoder().encode(s);
}

/** Sign a session JWT for the given user. Returns the token string. */
export async function signSessionJWT({ userId, email, role, creatorId }) {
  return await new SignJWT({ userId, email, role, creatorId: creatorId || null })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE}s`)
    .sign(getSecret());
}

/** Verify a session JWT. Returns { userId, email, role, creatorId } or null. */
export async function verifySessionJWT(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: ISSUER });
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

/** Build the Set-Cookie header value for the session. */
export function sessionCookieHeader(token, { clear = false } = {}) {
  const parts = [
    `${COOKIE_NAME}=${clear ? '' : token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${clear ? 0 : COOKIE_MAX_AGE}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

/** Read session JWT from a Request (works in middleware + route handlers). */
export function getSessionTokenFromRequest(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)sl_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Get the current user from a Request — null if no session or invalid.
 * Use inside route handlers. In middleware, prefer verifySessionJWT directly
 * (you can't call this without crafting the cookie header).
 */
export async function getCurrentUser(request) {
  const token = getSessionTokenFromRequest(request);
  return await verifySessionJWT(token);
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME;
