import { Redis } from '@upstash/redis';
import { nanoid } from 'nanoid';

// In-memory fallback for local dev (no Redis configured)
const memStore = new Map();
const memIndex = [];

function getRedisConfig() {
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

export async function saveCreator(data) {
  const id = nanoid(9);
  const now = new Date().toISOString();
  const creator = {
    id,
    name: data.name || 'Unknown',
    niche: data.niche || '',
    primaryPlatform: data.primaryPlatform || 'Instagram',
    platforms: data.platforms || {},
    engagement: data.engagement || '',
    bio: data.bio || '',
    externalUrl: data.externalUrl || '',
    profilePicUrl: data.profilePicUrl || '',
    isVerified: data.isVerified || false,
    isBusinessAccount: data.isBusinessAccount || false,
    products: data.products || [],
    bioLinks: data.bioLinks || [],
    competitors: data.competitors || [],
    audienceEstimate: data.audienceEstimate || null,
    reputation: data.reputation || '',
    research: data.research || '',
    tiktokUrl: data.tiktokUrl || '',
    youtubeUrl: data.youtubeUrl || '',
    meeting: {
      brandDealPct: '',
      previousSales: '',
      followerQuestions: '',
      topContent: '',
      dmTopics: '',
      audienceProblem: '',
      emailList: '',
      storyViewRate: '',
      exclusivity: '',
    },
    notes: '',
    offerId: null,
    dmSequence: data.dmSequence || null,
    offer: data.offer || null,
    pitch: data.pitch || null,
    launch: data.launch || {},
    brand: data.brand || { colors: { primary: '#7A0E18', secondary: '#1a1a1a', accent: '#f5f5f5' }, fonts: { heading: '', body: '' }, logoUrl: '', voice: '' },
    metrics: data.metrics || { revenue: {}, acquisition: {}, email: {}, community: {} },
    pipelineStatus: data.pipelineStatus || 'prospect',
    signedAt: data.signedAt || null,
    createdAt: now,
    updatedAt: now,
  };

  const summary = {
    id,
    name: creator.name,
    niche: creator.niche,
    primaryPlatform: creator.primaryPlatform,
    followers: _getPrimaryFollowers(creator),
    pipelineStatus: creator.pipelineStatus,
    createdAt: now,
  };

  if (useMemory()) {
    memStore.set(`creator:${id}`, JSON.stringify(creator));
    memIndex.unshift(summary);
  } else {
    const redis = getRedis();
    await redis.set(`creator:${id}`, JSON.stringify(creator));
    await redis.zadd('creators:index', { score: Date.now(), member: JSON.stringify(summary) });
  }

  return { id };
}

export async function getCreator(id) {
  if (useMemory()) {
    const raw = memStore.get(`creator:${id}`);
    return raw ? JSON.parse(raw) : null;
  }
  const redis = getRedis();
  const raw = await redis.get(`creator:${id}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function listCreators() {
  if (useMemory()) {
    return [...memIndex];
  }
  const redis = getRedis();
  const members = await redis.zrange('creators:index', 0, -1, { rev: true });
  return members.map(m => typeof m === 'string' ? JSON.parse(m) : m);
}

export async function updateCreator(id, updates) {
  const existing = await getCreator(id);
  if (!existing) return null;

  // Deep merge nested objects if provided
  if (updates.meeting) {
    updates.meeting = { ...existing.meeting, ...updates.meeting };
  }
  if (updates.launch) {
    updates.launch = { ...existing.launch, ...updates.launch };
  }
  if (updates.brand) {
    updates.brand = {
      ...existing.brand,
      ...updates.brand,
      colors: { ...(existing.brand?.colors || {}), ...(updates.brand?.colors || {}) },
      fonts: { ...(existing.brand?.fonts || {}), ...(updates.brand?.fonts || {}) },
    };
  }
  if (updates.metrics) {
    updates.metrics = {
      revenue: { ...(existing.metrics?.revenue || {}), ...(updates.metrics?.revenue || {}) },
      acquisition: { ...(existing.metrics?.acquisition || {}), ...(updates.metrics?.acquisition || {}) },
      email: { ...(existing.metrics?.email || {}), ...(updates.metrics?.email || {}) },
      community: { ...(existing.metrics?.community || {}), ...(updates.metrics?.community || {}) },
    };
  }

  const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };

  const summary = {
    id,
    name: updated.name,
    niche: updated.niche,
    primaryPlatform: updated.primaryPlatform,
    followers: _getPrimaryFollowers(updated),
    pipelineStatus: updated.pipelineStatus || 'prospect',
    createdAt: updated.createdAt,
  };

  if (useMemory()) {
    memStore.set(`creator:${id}`, JSON.stringify(updated));
    const idx = memIndex.findIndex(s => s.id === id);
    if (idx >= 0) memIndex[idx] = summary;
  } else {
    const redis = getRedis();
    await redis.set(`creator:${id}`, JSON.stringify(updated));
    // Remove old index entry and add updated one
    const allMembers = await redis.zrange('creators:index', 0, -1, { rev: true });
    for (const m of allMembers) {
      const parsed = typeof m === 'string' ? JSON.parse(m) : m;
      if (parsed.id === id) {
        await redis.zrem('creators:index', typeof m === 'string' ? m : JSON.stringify(m));
        break;
      }
    }
    await redis.zadd('creators:index', { score: Date.now(), member: JSON.stringify(summary) });
  }

  return updated;
}

export async function deleteCreator(id) {
  const existing = await getCreator(id);
  if (!existing) return false;

  if (useMemory()) {
    memStore.delete(`creator:${id}`);
    const idx = memIndex.findIndex(s => s.id === id);
    if (idx >= 0) memIndex.splice(idx, 1);
  } else {
    const redis = getRedis();
    await redis.del(`creator:${id}`);
    // Remove from sorted set index
    const allMembers = await redis.zrange('creators:index', 0, -1);
    for (const m of allMembers) {
      const parsed = typeof m === 'string' ? JSON.parse(m) : m;
      if (parsed.id === id) {
        await redis.zrem('creators:index', typeof m === 'string' ? m : JSON.stringify(m));
        break;
      }
    }
  }

  return true;
}

export async function searchCreators(query) {
  const all = await listCreators();
  const q = query.toLowerCase();
  return all.filter(c =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.niche || '').toLowerCase().includes(q)
  );
}

function _getPrimaryFollowers(creator) {
  if (!creator.platforms) return 0;
  const plat = (creator.primaryPlatform || 'instagram').toLowerCase();
  const p = creator.platforms[plat];
  if (!p) {
    // Return first available follower count
    for (const key of Object.keys(creator.platforms)) {
      const val = creator.platforms[key];
      if (val && (val.followers || val.subscribers)) return val.followers || val.subscribers || 0;
    }
    return 0;
  }
  return p.followers || p.subscribers || 0;
}
