import { Redis } from '@upstash/redis';
import { nanoid } from 'nanoid';

const memStore = new Map();
const memIndex = [];

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || null;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || null;
  if (url && token) return { url, token };
  return null;
}

function useMemory() { return !getRedisConfig(); }

let _redis = null;
function getRedis() {
  if (!_redis) {
    const config = getRedisConfig();
    if (!config) throw new Error('Redis not configured');
    _redis = new Redis({ url: config.url, token: config.token });
  }
  return _redis;
}

export async function createTicket(data) {
  const id = nanoid(9);
  const now = new Date().toISOString();
  const ticket = {
    id,
    type: data.type || 'suggestion', // 'bug' | 'suggestion'
    area: data.area || 'Geral',
    title: data.title || '',
    why: data.why || '',
    suggestion: data.suggestion || '',
    example: data.example || '',
    attachments: data.attachments || '',
    submitter: data.submitter || 'Anónimo',
    priority: data.priority || 'medium',
    status: 'new', // new | reviewing | building | done | wont_do
    creatorId: data.creatorId || null,
    createdAt: now,
    updatedAt: now,
  };

  const summary = {
    id, type: ticket.type, area: ticket.area, title: ticket.title,
    submitter: ticket.submitter, priority: ticket.priority,
    status: ticket.status, createdAt: now,
  };

  if (useMemory()) {
    memStore.set(`ticket:${id}`, JSON.stringify(ticket));
    memIndex.unshift(summary);
  } else {
    const redis = getRedis();
    await redis.set(`ticket:${id}`, JSON.stringify(ticket));
    await redis.zadd('tickets:index', { score: Date.now(), member: JSON.stringify(summary) });
  }

  return { id };
}

export async function getTicket(id) {
  if (useMemory()) {
    const raw = memStore.get(`ticket:${id}`);
    return raw ? JSON.parse(raw) : null;
  }
  const redis = getRedis();
  const raw = await redis.get(`ticket:${id}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function listTickets() {
  if (useMemory()) return [...memIndex];
  const redis = getRedis();
  const members = await redis.zrange('tickets:index', 0, -1, { rev: true });
  return members.map(m => typeof m === 'string' ? JSON.parse(m) : m);
}

export async function updateTicket(id, updates) {
  const existing = await getTicket(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };

  const summary = {
    id, type: updated.type, area: updated.area, title: updated.title,
    submitter: updated.submitter, priority: updated.priority,
    status: updated.status, createdAt: updated.createdAt,
  };

  if (useMemory()) {
    memStore.set(`ticket:${id}`, JSON.stringify(updated));
    const idx = memIndex.findIndex(s => s.id === id);
    if (idx >= 0) memIndex[idx] = summary;
  } else {
    const redis = getRedis();
    await redis.set(`ticket:${id}`, JSON.stringify(updated));
    const allMembers = await redis.zrange('tickets:index', 0, -1, { rev: true });
    for (const m of allMembers) {
      const parsed = typeof m === 'string' ? JSON.parse(m) : m;
      if (parsed.id === id) {
        await redis.zrem('tickets:index', typeof m === 'string' ? m : JSON.stringify(m));
        break;
      }
    }
    await redis.zadd('tickets:index', { score: Date.now(), member: JSON.stringify(summary) });
  }

  return updated;
}

export async function deleteTicket(id) {
  const existing = await getTicket(id);
  if (!existing) return false;

  if (useMemory()) {
    memStore.delete(`ticket:${id}`);
    const idx = memIndex.findIndex(s => s.id === id);
    if (idx >= 0) memIndex.splice(idx, 1);
  } else {
    const redis = getRedis();
    await redis.del(`ticket:${id}`);
    const allMembers = await redis.zrange('tickets:index', 0, -1);
    for (const m of allMembers) {
      const parsed = typeof m === 'string' ? JSON.parse(m) : m;
      if (parsed.id === id) {
        await redis.zrem('tickets:index', typeof m === 'string' ? m : JSON.stringify(m));
        break;
      }
    }
  }

  return true;
}
