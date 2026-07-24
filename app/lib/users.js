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

/**
 * Change a user's email WITHOUT changing their userId — the whole point of a
 * migration vs. just allow-listing a new address. Every historical record
 * (creator.addedBy.userId, the follow-up tray's "my creators" filter, the
 * adder guard) keys on the stable nanoid, so preserving it keeps all data +
 * capabilities intact. Also sets an explicit `name` so the scoreboard's
 * firstName stays stable regardless of the new local-part.
 *
 * Idempotent + conflict-safe:
 *   - old user found, new free   → migrate in place (same id), swap allowlist
 *   - new email already the user → no-op, just ensure allowlist + name
 *   - new email is a DIFFERENT user → 'conflict' (never silently merge)
 *   - neither exists             → allowlist the new email only
 */
export async function renameUserEmail({ oldEmail, newEmail, name }) {
  const oldE = normEmail(oldEmail);
  const newE = normEmail(newEmail);
  if (!newE) throw new Error('newEmail required');

  const oldUser = oldE ? await findUserByEmail(oldE) : null;
  const newUser = await findUserByEmail(newE);

  if (oldUser && newUser && newUser.id !== oldUser.id) {
    return { status: 'conflict', oldEmail: oldE, newEmail: newE, message: `${newE} já pertence a outro user (${newUser.id})` };
  }

  if (!oldUser && newUser) {
    if (name && newUser.name !== name) { newUser.name = name; await _persistUser(newUser); }
    await addTeamEmail(newE);
    return { status: 'already', userId: newUser.id, name: newUser.name, oldEmail: oldE, newEmail: newE };
  }

  if (!oldUser && !newUser) {
    await addTeamEmail(newE);
    return { status: 'allowlisted-only', oldEmail: oldE, newEmail: newE };
  }

  // The migration: keep the SAME id, swap email + set the display name.
  const updated = { ...oldUser, email: newE, name: name || oldUser.name || null };
  await _persistUser(updated);
  if (useMemory()) {
    memStore.set(`user:byEmail:${newE}`, updated.id);
    if (oldE && oldE !== newE) memStore.delete(`user:byEmail:${oldE}`);
  } else {
    await getRedis().set(`user:byEmail:${newE}`, updated.id);
    if (oldE && oldE !== newE) await getRedis().del(`user:byEmail:${oldE}`);
  }
  await addTeamEmail(newE);
  if (oldE && oldE !== newE) await removeTeamEmail(oldE);
  return { status: 'migrated', userId: updated.id, name: updated.name, oldEmail: oldE, newEmail: newE };
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
