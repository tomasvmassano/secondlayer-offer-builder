/**
 * Magic-link tokens — short-lived, single-use, Redis-backed with TTL.
 *
 * A magic link has TWO consumable forms:
 *   - the long token in the URL (?t=…)
 *   - a 6-digit code (for cross-device — type the code on the original device)
 *
 * Both point at the same record. Either consumes it.
 *
 * Key shape:
 *   ml:token:{token}    → JSON {email, code, exp, used: false}
 *   ml:code:{code}      → token (lookup index, same TTL)
 *
 * TTL: 15 minutes. Single-use enforced by deleting on consume.
 */

import { Redis } from '@upstash/redis';
import { nanoid } from 'nanoid';

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
}

const memStore = new Map();
function useMemory() {
  return !process.env.UPSTASH_REDIS_REST_URL;
}

const TTL_SECONDS = 15 * 60;

function makeCode() {
  // 6 digits, zero-padded.
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

export async function issueMagicLink(email) {
  const token = nanoid(32);
  const code = makeCode();
  const record = { email, code, exp: Date.now() + TTL_SECONDS * 1000, used: false };

  if (useMemory()) {
    memStore.set(`ml:token:${token}`, JSON.stringify(record));
    memStore.set(`ml:code:${code}`, token);
    setTimeout(() => {
      memStore.delete(`ml:token:${token}`);
      memStore.delete(`ml:code:${code}`);
    }, TTL_SECONDS * 1000);
  } else {
    const r = getRedis();
    await r.set(`ml:token:${token}`, JSON.stringify(record), { ex: TTL_SECONDS });
    await r.set(`ml:code:${code}`, token, { ex: TTL_SECONDS });
  }

  return { token, code };
}

/** Consume a magic-link by token OR by code. Returns {email} on success, null on fail. */
export async function consumeMagicLink({ token, code }) {
  let resolvedToken = token;
  if (!resolvedToken && code) {
    const r = useMemory() ? memStore.get(`ml:code:${code}`) : await getRedis().get(`ml:code:${code}`);
    if (!r) return null;
    resolvedToken = r;
  }
  if (!resolvedToken) return null;

  let raw;
  if (useMemory()) {
    raw = memStore.get(`ml:token:${resolvedToken}`);
  } else {
    raw = await getRedis().get(`ml:token:${resolvedToken}`);
  }
  if (!raw) return null;
  const rec = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (rec.used) return null;
  if (Date.now() > rec.exp) return null;

  // Single-use: delete both lookup keys.
  if (useMemory()) {
    memStore.delete(`ml:token:${resolvedToken}`);
    memStore.delete(`ml:code:${rec.code}`);
  } else {
    await getRedis().del(`ml:token:${resolvedToken}`);
    await getRedis().del(`ml:code:${rec.code}`);
  }

  return { email: rec.email };
}
