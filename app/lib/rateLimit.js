/**
 * Rate-limit helpers backed by Upstash Redis.
 *
 * Usage in an API route:
 *   const rl = await checkRateLimit({ key: `auth:${ip}`, limit: 5, windowSec: 900 });
 *   if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 *
 * Falls back to in-memory if no Redis env (dev mode).
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
}

const cache = new Map();
function getLimiter(limit, windowSec) {
  const cacheKey = `${limit}:${windowSec}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const r = getRedis();
  if (!r) {
    cache.set(cacheKey, null);
    return null;
  }
  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    analytics: false,
    prefix: 'rl',
  });
  cache.set(cacheKey, limiter);
  return limiter;
}

export async function checkRateLimit({ key, limit, windowSec }) {
  const limiter = getLimiter(limit, windowSec);
  if (!limiter) return { ok: true, remaining: limit }; // dev-mode no-op
  const res = await limiter.limit(key);
  return { ok: res.success, remaining: res.remaining, reset: res.reset, limit: res.limit };
}

export function getClientIp(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
