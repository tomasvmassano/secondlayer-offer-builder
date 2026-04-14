import { Redis } from '@upstash/redis';
import { nanoid } from 'nanoid';

// In-memory fallback for local dev (no Redis configured)
const memStore = new Map();
const memIndex = [];

function getRedisConfig() {
  // Try all possible env var names that Vercel/Upstash might set
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || null;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || null;
  if (url && token) return { url, token };
  return null;
}

function useMemory() {
  return !getRedisConfig();
}

let _redis = null;
function getRedis() {
  if (!_redis) {
    const config = getRedisConfig();
    if (!config) throw new Error('Redis not configured');
    _redis = new Redis({ url: config.url, token: config.token });
  }
  return _redis;
}

export async function saveOffer(data) {
  const id = nanoid(9);
  const summary = {
    id,
    creatorName: data.formData?.creator_name || 'Unknown',
    niche: data.formData?.niche || '',
    primaryPlatform: data.formData?.primary_platform || 'Instagram',
    createdAt: new Date().toISOString(),
  };
  const offer = {
    ...summary,
    language: data.formData?.language || 'English',
    formData: data.formData,
    rawOutput: data.rawOutput,
    parsed: data.parsed,
    scraped: data.scraped,
  };

  if (useMemory()) {
    memStore.set(`offer:${id}`, JSON.stringify(offer));
    memIndex.unshift(summary);
  } else {
    const redis = getRedis();
    await redis.set(`offer:${id}`, JSON.stringify(offer));
    await redis.zadd('offers:index', { score: Date.now(), member: JSON.stringify(summary) });
  }
  return { id };
}

export async function getOffer(id) {
  if (useMemory()) {
    const raw = memStore.get(`offer:${id}`);
    return raw ? JSON.parse(raw) : null;
  }
  const redis = getRedis();
  const raw = await redis.get(`offer:${id}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function listOffers() {
  if (useMemory()) {
    return memIndex;
  }
  const redis = getRedis();
  const members = await redis.zrange('offers:index', 0, -1, { rev: true });
  return members.map(m => typeof m === 'string' ? JSON.parse(m) : m);
}

export async function clearAllOffers() {
  if (useMemory()) {
    const keys = [...memStore.keys()].filter(k => k.startsWith('offer:'));
    keys.forEach(k => memStore.delete(k));
    memIndex.length = 0;
    return keys.length;
  }
  const redis = getRedis();
  const members = await redis.zrange('offers:index', 0, -1);
  let count = 0;
  for (const m of members) {
    const parsed = typeof m === 'string' ? JSON.parse(m) : m;
    if (parsed.id) {
      await redis.del(`offer:${parsed.id}`);
      count++;
    }
  }
  await redis.del('offers:index');
  return count;
}
