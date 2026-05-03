/**
 * Users + team allowlist — Redis-backed.
 *
 * Keys:
 *   - user:{userId}       → { id, email, role, creatorId?, name, createdAt, lastSeenAt }
 *   - user:byEmail:{email} → userId   (lookup index)
 *   - users:all           → Set<userId>
 *   - team:emails         → Set<email>   (the team allowlist)
 *
 * Bootstrap: on first read of team:emails, if empty, seed from TEAM_EMAILS env var
 * (comma-separated). This way a fresh deploy with the env var set just works.
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

function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// ───── Team allowlist ─────

export async function listTeamEmails() {
  let emails;
  if (useMemory()) {
    const raw = memStore.get('team:emails');
    emails = raw ? JSON.parse(raw) : [];
  } else {
    emails = await getRedis().smembers('team:emails') || [];
  }
  // Bootstrap on first read if empty.
  if (emails.length === 0 && process.env.TEAM_EMAILS) {
    const seed = process.env.TEAM_EMAILS.split(',').map(normEmail).filter(Boolean);
    for (const e of seed) await addTeamEmail(e);
    emails = seed;
  }
  return emails;
}

export async function addTeamEmail(email) {
  const e = normEmail(email);
  if (!e) return;
  if (useMemory()) {
    const raw = memStore.get('team:emails');
    const cur = raw ? JSON.parse(raw) : [];
    if (!cur.includes(e)) cur.push(e);
    memStore.set('team:emails', JSON.stringify(cur));
  } else {
    await getRedis().sadd('team:emails', e);
  }
}

export async function removeTeamEmail(email) {
  const e = normEmail(email);
  if (!e) return;
  if (useMemory()) {
    const raw = memStore.get('team:emails');
    const cur = raw ? JSON.parse(raw) : [];
    memStore.set('team:emails', JSON.stringify(cur.filter(x => x !== e)));
  } else {
    await getRedis().srem('team:emails', e);
  }
}

export async function isTeamEmail(email) {
  const list = await listTeamEmails();
  return list.includes(normEmail(email));
}

// ───── Users ─────

export async function findUserByEmail(email) {
  const e = normEmail(email);
  if (!e) return null;
  let userId;
  if (useMemory()) {
    userId = memStore.get(`user:byEmail:${e}`);
  } else {
    userId = await getRedis().get(`user:byEmail:${e}`);
  }
  if (!userId) return null;
  return await getUser(userId);
}

export async function getUser(userId) {
  if (!userId) return null;
  if (useMemory()) {
    const raw = memStore.get(`user:${userId}`);
    return raw ? JSON.parse(raw) : null;
  }
  const raw = await getRedis().get(`user:${userId}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function listUsers() {
  let ids;
  if (useMemory()) {
    const raw = memStore.get('users:all');
    ids = raw ? JSON.parse(raw) : [];
  } else {
    ids = await getRedis().smembers('users:all') || [];
  }
  const users = await Promise.all(ids.map(id => getUser(id)));
  return users.filter(Boolean).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/**
 * Create or upsert a user. Idempotent on email — if a user with that email
 * already exists we update role/creatorId/name and return the existing record.
 */
export async function upsertUser({ email, role, creatorId, name }) {
  const e = normEmail(email);
  if (!e) throw new Error('email required');
  if (!['creator', 'team'].includes(role)) throw new Error('invalid role');

  const existing = await findUserByEmail(e);
  const now = new Date().toISOString();

  if (existing) {
    const updated = {
      ...existing,
      role: role || existing.role,
      creatorId: creatorId !== undefined ? creatorId : existing.creatorId,
      name: name || existing.name,
    };
    await _persistUser(updated);
    return updated;
  }

  const user = {
    id: nanoid(12),
    email: e,
    role,
    creatorId: creatorId || null,
    name: name || null,
    createdAt: now,
    lastSeenAt: now,
  };
  await _persistUser(user);
  if (useMemory()) {
    memStore.set(`user:byEmail:${e}`, user.id);
    const raw = memStore.get('users:all');
    const cur = raw ? JSON.parse(raw) : [];
    cur.push(user.id);
    memStore.set('users:all', JSON.stringify(cur));
  } else {
    await getRedis().set(`user:byEmail:${e}`, user.id);
    await getRedis().sadd('users:all', user.id);
  }
  return user;
}

export async function touchUser(userId) {
  const u = await getUser(userId);
  if (!u) return null;
  u.lastSeenAt = new Date().toISOString();
  await _persistUser(u);
  return u;
}

export async function deleteUser(userId) {
  const u = await getUser(userId);
  if (!u) return false;
  if (useMemory()) {
    memStore.delete(`user:${userId}`);
    memStore.delete(`user:byEmail:${u.email}`);
    const raw = memStore.get('users:all');
    const cur = raw ? JSON.parse(raw) : [];
    memStore.set('users:all', JSON.stringify(cur.filter(id => id !== userId)));
  } else {
    await getRedis().del(`user:${userId}`);
    await getRedis().del(`user:byEmail:${u.email}`);
    await getRedis().srem('users:all', userId);
  }
  return true;
}

async function _persistUser(user) {
  if (useMemory()) {
    memStore.set(`user:${user.id}`, JSON.stringify(user));
  } else {
    await getRedis().set(`user:${user.id}`, JSON.stringify(user));
  }
}
