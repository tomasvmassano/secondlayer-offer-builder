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

// Extract Instagram handle from a URL (e.g. "https://instagram.com/user/" → "user")
function extractIgHandle(url) {
  if (!url) return null;
  const match = String(url).match(/instagram\.com\/([^/?#]+)/i);
  return match ? match[1].replace(/^@/, '').toLowerCase() : null;
}

// Find existing creator by Instagram handle (for duplicate prevention)
async function findCreatorByIgHandle(handle) {
  if (!handle) return null;
  const lower = handle.toLowerCase();
  const summaries = await listCreators();
  for (const s of summaries) {
    const full = await getCreator(s.id);
    if (!full) continue;
    const igHandle = extractIgHandle(full.platforms?.instagram?.url || full.instagramUrl);
    if (igHandle && igHandle === lower) return full;
  }
  return null;
}

export async function saveCreator(data) {
  // Idempotency: if a creator with this Instagram handle already exists, return
  // the existing one instead of creating a duplicate. Caller gets `duplicate: true`.
  const incomingHandle = extractIgHandle(data.platforms?.instagram?.url || data.instagramUrl);
  if (incomingHandle) {
    const existing = await findCreatorByIgHandle(incomingHandle);
    if (existing) {
      return { id: existing.id, duplicate: true };
    }
  }

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
    intelligence: data.intelligence || { bioLinks: [], topPosts: [], contentStyle: null, competitors: [], audience: null },
    primaryLanguage: data.primaryLanguage || null, // "pt" | "en" | null (null = not yet detected or not served)
    // Revenue baseline — single source of truth for both Pitch and Offer Projector.
    // null = use defaults (scraped audience, nicho-based price). When user edits in
    // either page, value is saved here so the other page reads the same number.
    revenueAudience: data.revenueAudience ?? null,
    revenuePrice: data.revenuePrice ?? null,
    revenueActiveShare: data.revenueActiveShare ?? null, // % of audience as long-term members (legacy / simple model)
    revenueChurn: data.revenueChurn ?? null, // monthly churn rate
    revenueEngagement: data.revenueEngagement ?? null, // engagement % used by Hormozi 5-step funnel
    revenueCommission: data.revenueCommission ?? null, // SL commission % (saved from creator page)
    // Phase 1 (Kickoff) — onboarding form + kickoff call decisions
    // Token auto-generated on first save; status flows: not_started → form_pending → form_complete → call_scheduled → brief_signed
    onboarding: data.onboarding || {
      token: nanoid(16),
      status: 'not_started',
      formStartedAt: null,
      formCompletedAt: null,
      responses: {},
      kickoff: {
        callScheduledAt: null,
        callCompletedAt: null,
        decisions: {},
        actionItems: [],
        briefSignedAt: null,
        briefGeneratedAt: null,
      },
    },
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
    hasOffer: !!(creator.offer || creator.offerId),
    hasDm: !!creator.dmSequence,
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

/**
 * Find a creator by their onboarding token (used by the public form).
 * Backfills the onboarding object for legacy creators that don't have one.
 */
export async function findByOnboardingToken(token) {
  if (!token) return null;
  const summaries = await listCreators();
  for (const s of summaries) {
    const full = await getCreator(s.id);
    if (full?.onboarding?.token === token) return full;
  }
  return null;
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
  let summaries;
  if (useMemory()) {
    summaries = [...memIndex];
  } else {
    const redis = getRedis();
    const members = await redis.zrange('creators:index', 0, -1, { rev: true });
    summaries = members.map(m => typeof m === 'string' ? JSON.parse(m) : m);
  }

  // Enrich summaries with hasOffer/hasDm if missing (backfill for old records)
  const needsEnrich = summaries.some(s => s.hasOffer === undefined);
  if (needsEnrich) {
    const enriched = await Promise.all(summaries.map(async (s) => {
      if (s.hasOffer !== undefined) return s;
      const full = await getCreator(s.id);
      if (!full) return s;
      return { ...s, hasOffer: !!(full.offer || full.offerId), hasDm: !!full.dmSequence };
    }));
    return enriched;
  }
  return summaries;
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
  if (updates.intelligence) {
    updates.intelligence = {
      bioLinks: updates.intelligence.bioLinks || existing.intelligence?.bioLinks || [],
      topPosts: updates.intelligence.topPosts || existing.intelligence?.topPosts || [],
      contentStyle: updates.intelligence.contentStyle || existing.intelligence?.contentStyle || null,
      competitors: updates.intelligence.competitors || existing.intelligence?.competitors || [],
      audience: { ...(existing.intelligence?.audience || {}), ...(updates.intelligence?.audience || {}) },
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
  if (updates.onboarding) {
    const existingOnb = existing.onboarding || {};
    updates.onboarding = {
      ...existingOnb,
      ...updates.onboarding,
      // Token never changes once set
      token: existingOnb.token || updates.onboarding.token,
      // Deep-merge nested objects
      responses: { ...(existingOnb.responses || {}), ...(updates.onboarding.responses || {}) },
      kickoff: {
        ...(existingOnb.kickoff || {}),
        ...(updates.onboarding.kickoff || {}),
        decisions: { ...(existingOnb.kickoff?.decisions || {}), ...(updates.onboarding.kickoff?.decisions || {}) },
      },
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
    hasOffer: !!(updated.offer || updated.offerId),
    hasDm: !!updated.dmSequence,
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
