/**
 * Creator Discovery — find similar creators by chaining Apify relatedProfiles.
 *
 * Pipeline:
 *   Stage 1: FREE filter (already in CRM? dismissed? wrong follower range?)
 *   Stage 2: Lean Apify scrape (~€0.15 each) — bio, engagement, posts
 *   Stage 3: Deal score — A/B → queue, C/D → auto-dismiss
 *   Stage 4: Full intelligence on approval (triggered from /api/discovery/[id])
 */

import { Redis } from '@upstash/redis';
import { nanoid } from 'nanoid';
import { scrapeInstagramBasic, scrapeInstagram } from './apify';
import { listCreators, getCreator } from './creators';
import { calculateDealScore } from './dealScore';

// In-memory fallback for local dev
const memQueue = [];
const memDismissed = new Set();
const memOutOfRange = new Set();
const memSeeds = new Set();
const memRuns = [];
let memAutopilotEnabled = false;

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

// ICP Filters — only minimum enforced; large creators are valid too
// (team is happy to DM/email them regardless of size).
const ICP = {
  minFollowers: 50000,
  maxFollowers: Infinity,
};

// Second Layer's 7 target niches (A-tier only).
// These keys must appear in NICHE_DB or NICHE_ALIASES for matchNiche() to catch them.
const TARGET_NICHE_KEYS = new Set([
  // Imobiliário & Investimento
  'imobiliario', 'investimento', 'real estate', 'property', 'investing', 'investment', 'crypto', 'trading', 'stocks',
  // Fitness & Coaching
  'fitness', 'gym', 'workout', 'training', 'crossfit', 'bodybuilding', 'coaching',
  // Empreendedorismo & Business
  'empreendedorismo', 'entrepreneur', 'entrepreneurship', 'startup', 'business', 'marketing', 'creator economy',
  // Nutrição & Dietética
  'nutricao', 'nutrition', 'dietetica', 'diet', 'dietetics', 'healthy eating',
  // Finanças Pessoais
  'financas', 'finance', 'personal finance', 'money',
  // Educação & Desenvolvimento
  'educacao', 'education', 'teaching', 'learning', 'desenvolvimento', 'personal development', 'self improvement', 'self-improvement', 'mindset', 'productivity',
  // Culinária & Gastronomia
  'culinaria', 'gastronomia', 'gastronomy', 'culinary', 'food', 'cooking', 'baking', 'recipe', 'plant based', 'vegan',
]);

// Lightweight language detection via bio keywords.
// Returns 'pt' | 'en' | 'other' | 'unknown'
const PT_MARKERS = /\b(de|da|do|das|dos|para|você|voce|não|nao|mais|que|com|por|seu|sua|meu|minha|uma|uns|umas|muito|muita|também|tambem|está|esta|são|sao|ser|ter|fazer|pode|aqui|como|mas|meu|olá|ola|obrigado|obrigada)\b/i;
const EN_MARKERS = /\b(the|and|you|your|with|for|this|that|have|from|here|are|is|my|our|we|they|will|all|more|love|life|just|like|who|what|when|how|about|help|new|best|get)\b/i;
const ES_MARKERS = /\b(el|la|los|las|de|para|con|por|pero|está|muy|más|cómo|soy|eres|somos|hola|gracias|amor|vida)\b/i;
const IT_MARKERS = /\b(il|la|di|che|per|con|sono|siamo|molto|più|come|cosa|ciao|grazie|amore|vita)\b/i;
const FR_MARKERS = /\b(le|la|les|de|des|pour|avec|mais|très|plus|comme|bonjour|merci|amour|vie)\b/i;

function detectLanguage(bio) {
  if (!bio || bio.trim().length < 10) return 'unknown';
  const text = bio.toLowerCase();

  const ptHits = (text.match(PT_MARKERS) || []).length + (text.match(/[áàâãéêíóôõúç]/g) || []).length;
  const enHits = (text.match(EN_MARKERS) || []).length;
  const esHits = (text.match(ES_MARKERS) || []).length + (text.match(/[ñ¿¡]/g) || []).length;
  const itHits = (text.match(IT_MARKERS) || []).length;
  const frHits = (text.match(FR_MARKERS) || []).length + (text.match(/[œçêèêîôûü]/g) || []).length;

  const scores = { pt: ptHits, en: enHits, es: esHits, it: itHits, fr: frHits };
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!winner || winner[1] === 0) return 'unknown';

  // If PT or EN wins, accept it
  if (winner[0] === 'pt' || winner[0] === 'en') return winner[0];

  // If a non-PT/EN language wins strongly, reject
  return 'other';
}

// Check if bio text indicates one of Second Layer's target niches.
// Uses a set of English + Portuguese keywords.
function matchesTargetNiche(bio, detectedNicheLabel) {
  const text = (bio || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const key of TARGET_NICHE_KEYS) {
    if (text.includes(key.toLowerCase())) return key;
  }
  // Also check the explicit niche label passed from deal score
  if (detectedNicheLabel) {
    const lower = detectedNicheLabel.toLowerCase();
    for (const key of TARGET_NICHE_KEYS) {
      if (lower.includes(key)) return key;
    }
  }
  return null;
}

// Does this creator show signs of active monetization?
// Required: external URL in bio OR business account OR bio mentions a product.
function hasBusinessSignals(scraped) {
  if (scraped.externalUrl && scraped.externalUrl.trim()) return true;
  if (scraped.isBusinessAccount) return true;
  const bio = (scraped.bio || '').toLowerCase();
  const productKeywords = /\b(link in bio|link na bio|shop|loja|course|curso|workshop|mentoria|coaching|ebook|membership|comunidade|programa|consultoria|marca|brand|store|skool|hotmart|gumroad|teachable|kajabi|stan|patreon)\b/i;
  if (productKeywords.test(bio)) return true;
  return false;
}

// ─────────────────────────────────────────────
// Queue operations
// ─────────────────────────────────────────────

export async function listQueue() {
  if (useMemory()) {
    return [...memQueue];
  }
  const redis = getRedis();
  const members = await redis.zrange('discovery:queue', 0, -1, { rev: true });
  return members.map(m => typeof m === 'string' ? JSON.parse(m) : m);
}

async function addToQueue(candidate) {
  const now = new Date().toISOString();
  const entry = { ...candidate, createdAt: now };

  if (useMemory()) {
    memQueue.unshift(entry);
  } else {
    const redis = getRedis();
    // Score = dealScore (higher = better, shown first)
    await redis.zadd('discovery:queue', { score: candidate.dealScore || 0, member: JSON.stringify(entry) });
  }
  return entry;
}

export async function getQueueItem(id) {
  const all = await listQueue();
  return all.find(c => c.id === id) || null;
}

export async function removeFromQueue(id) {
  if (useMemory()) {
    const idx = memQueue.findIndex(c => c.id === id);
    if (idx >= 0) memQueue.splice(idx, 1);
    return true;
  }
  const redis = getRedis();
  const members = await redis.zrange('discovery:queue', 0, -1);
  for (const m of members) {
    const parsed = typeof m === 'string' ? JSON.parse(m) : m;
    if (parsed.id === id) {
      await redis.zrem('discovery:queue', typeof m === 'string' ? m : JSON.stringify(m));
      return true;
    }
  }
  return false;
}

async function isInQueue(handle) {
  const all = await listQueue();
  return all.some(c => (c.handle || '').toLowerCase() === handle.toLowerCase());
}

// ─────────────────────────────────────────────
// Dismissed blacklist
// ─────────────────────────────────────────────

export async function addToDismissed(handle) {
  const lower = handle.toLowerCase();
  if (useMemory()) {
    memDismissed.add(lower);
    return;
  }
  const redis = getRedis();
  await redis.sadd('discovery:dismissed', lower);
}

export async function isDismissed(handle) {
  const lower = handle.toLowerCase();
  if (useMemory()) {
    return memDismissed.has(lower);
  }
  const redis = getRedis();
  const result = await redis.sismember('discovery:dismissed', lower);
  return result === 1 || result === true;
}

// Out-of-range list — separate from permanent dismissed. Can be cleared
// when user changes the ICP follower range.
export async function addToOutOfRange(handle) {
  const lower = handle.toLowerCase();
  if (useMemory()) {
    memOutOfRange.add(lower);
    return;
  }
  const redis = getRedis();
  await redis.sadd('discovery:out_of_range', lower);
}

export async function isOutOfRange(handle) {
  const lower = handle.toLowerCase();
  if (useMemory()) {
    return memOutOfRange.has(lower);
  }
  const redis = getRedis();
  const result = await redis.sismember('discovery:out_of_range', lower);
  return result === 1 || result === true;
}

export async function clearOutOfRange() {
  if (useMemory()) {
    const count = memOutOfRange.size;
    memOutOfRange.clear();
    return count;
  }
  const redis = getRedis();
  const members = await redis.smembers('discovery:out_of_range');
  if (members.length > 0) {
    await redis.del('discovery:out_of_range');
  }
  return members.length;
}

// One-shot: also clear the OLD dismissed list so previously-blacklisted
// out-of-range creators can be re-evaluated under the new ICP. This is
// a migration helper — use sparingly.
// List blacklist contents — returns { dismissed: [...], outOfRange: [...] }
export async function listBlacklist() {
  if (useMemory()) {
    return {
      dismissed: [...memDismissed].sort(),
      outOfRange: [...memOutOfRange].sort(),
    };
  }
  const redis = getRedis();
  const [d, o] = await Promise.all([
    redis.smembers('discovery:dismissed'),
    redis.smembers('discovery:out_of_range'),
  ]);
  return {
    dismissed: (d || []).sort(),
    outOfRange: (o || []).sort(),
  };
}

// Remove a single handle from blacklist (both lists)
export async function unblockHandle(handle) {
  const lower = handle.toLowerCase();
  if (useMemory()) {
    const had = memDismissed.delete(lower) || memOutOfRange.delete(lower);
    return had;
  }
  const redis = getRedis();
  const [d, o] = await Promise.all([
    redis.srem('discovery:dismissed', lower),
    redis.srem('discovery:out_of_range', lower),
  ]);
  return (d + o) > 0;
}

// ─────────────────────────────────────────────
// Seed list (persistent, used by autopilot)
// Each seed has: { url, niche, country, addedAt }
// Stored as Redis Hash where key = url, value = JSON metadata
// ─────────────────────────────────────────────

// In-memory: Map<url, metadata>
const memSeedsMap = new Map();

function normalizeUrl(url) {
  return (url || '').trim().replace(/\/+$/, '').toLowerCase();
}

export async function listSeeds() {
  if (useMemory()) {
    // Merge legacy set with new map
    const all = new Map();
    for (const url of memSeeds) {
      if (!all.has(url)) all.set(url, { url, niche: null, country: null });
    }
    for (const [url, meta] of memSeedsMap) {
      all.set(url, { url, ...meta });
    }
    return [...all.values()].sort((a, b) => (a.niche || '').localeCompare(b.niche || ''));
  }
  const redis = getRedis();
  // New format: hash discovery:seeds_v2 (url -> metadata JSON)
  const hashData = await redis.hgetall('discovery:seeds_v2');
  const seeds = [];
  if (hashData && typeof hashData === 'object') {
    for (const [url, metaRaw] of Object.entries(hashData)) {
      try {
        const meta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;
        seeds.push({ url, ...meta });
      } catch {
        seeds.push({ url, niche: null, country: null });
      }
    }
  }
  // Merge legacy set (old URLs without metadata) for backward compat
  const legacyUrls = await redis.smembers('discovery:seeds');
  const knownUrls = new Set(seeds.map(s => s.url));
  for (const url of legacyUrls || []) {
    if (!knownUrls.has(url)) {
      seeds.push({ url, niche: null, country: null });
    }
  }
  return seeds.sort((a, b) => {
    const nicheCmp = (a.niche || 'zzz').localeCompare(b.niche || 'zzz');
    if (nicheCmp !== 0) return nicheCmp;
    return (a.country || '').localeCompare(b.country || '');
  });
}

export async function addSeed(url, niche = null, country = null) {
  const normalized = normalizeUrl(url);
  if (!normalized) return false;

  const metadata = {
    niche: niche || null,
    country: country || null,
    addedAt: new Date().toISOString(),
  };

  if (useMemory()) {
    memSeedsMap.set(normalized, metadata);
    memSeeds.add(normalized); // keep legacy set in sync for autopilot
    return true;
  }
  const redis = getRedis();
  await redis.hset('discovery:seeds_v2', { [normalized]: JSON.stringify(metadata) });
  await redis.sadd('discovery:seeds', normalized); // keep legacy set in sync
  return true;
}

export async function removeSeed(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return false;
  if (useMemory()) {
    memSeedsMap.delete(normalized);
    return memSeeds.delete(normalized);
  }
  const redis = getRedis();
  await redis.hdel('discovery:seeds_v2', normalized);
  const removed = await redis.srem('discovery:seeds', normalized);
  return removed > 0;
}

// For autopilot: just get URLs as a simple array
export async function listSeedUrls() {
  const seeds = await listSeeds();
  return seeds.map(s => s.url);
}

// ─────────────────────────────────────────────
// Autopilot toggle
// ─────────────────────────────────────────────

export async function getAutopilotEnabled() {
  if (useMemory()) return memAutopilotEnabled;
  const redis = getRedis();
  const val = await redis.get('discovery:autopilot_enabled');
  return val === 'true' || val === true;
}

export async function setAutopilotEnabled(enabled) {
  if (useMemory()) {
    memAutopilotEnabled = !!enabled;
    return memAutopilotEnabled;
  }
  const redis = getRedis();
  await redis.set('discovery:autopilot_enabled', enabled ? 'true' : 'false');
  return !!enabled;
}

// ─────────────────────────────────────────────
// Run history log
// ─────────────────────────────────────────────

export async function logRun(stats) {
  const entry = { ...stats, timestamp: new Date().toISOString() };
  if (useMemory()) {
    memRuns.unshift(entry);
    if (memRuns.length > 50) memRuns.length = 50;
    return entry;
  }
  const redis = getRedis();
  // Store as zset keyed by timestamp for easy sorted retrieval
  await redis.zadd('discovery:runs', { score: Date.now(), member: JSON.stringify(entry) });
  // Cap history at 50 entries
  const total = await redis.zcard('discovery:runs');
  if (total > 50) {
    await redis.zremrangebyrank('discovery:runs', 0, total - 51);
  }
  return entry;
}

export async function listRecentRuns(limit = 10) {
  if (useMemory()) {
    return memRuns.slice(0, limit);
  }
  const redis = getRedis();
  const members = await redis.zrange('discovery:runs', 0, limit - 1, { rev: true });
  return (members || []).map(m => typeof m === 'string' ? JSON.parse(m) : m);
}

export async function clearAllDismissed() {
  if (useMemory()) {
    const total = memDismissed.size + memOutOfRange.size;
    memDismissed.clear();
    memOutOfRange.clear();
    return total;
  }
  const redis = getRedis();
  const d = await redis.smembers('discovery:dismissed');
  const o = await redis.smembers('discovery:out_of_range');
  if (d.length > 0) await redis.del('discovery:dismissed');
  if (o.length > 0) await redis.del('discovery:out_of_range');
  return d.length + o.length;
}

// ─────────────────────────────────────────────
// Discovery runner
// ─────────────────────────────────────────────

/**
 * Extract Instagram handle from a URL or raw string.
 */
function extractHandle(input) {
  if (!input) return '';
  const match = String(input).match(/instagram\.com\/([^/?]+)/i);
  if (match) return match[1].replace(/^@/, '').toLowerCase();
  return String(input).replace(/^@/, '').toLowerCase();
}

/**
 * Check if a handle already exists in the CRM (by handle in platforms.instagram.url).
 */
async function isInCRM(handle, crmCreators) {
  const lower = handle.toLowerCase();
  for (const c of crmCreators) {
    const igUrl = c.platforms?.instagram?.url || c.instagramUrl || '';
    const crmHandle = extractHandle(igUrl);
    if (crmHandle === lower) return true;
  }
  return false;
}

/**
 * Stage 1: FREE filter — returns related profiles that pass ICP + dedup checks.
 * Also returns drop counters for diagnostics.
 */
async function stage1Filter(sourceCreator, maxCandidates, crmFull = null, drops = null) {
  const related = sourceCreator.competitors || sourceCreator.platforms?.instagram?.relatedProfiles || [];
  if (drops) drops.totalRelated += Array.isArray(related) ? related.length : 0;
  if (!Array.isArray(related) || related.length === 0) return [];

  // Get CRM list if not passed in (for per-creator calls)
  if (!crmFull) {
    const crmSummaries = await listCreators();
    crmFull = (await Promise.all(crmSummaries.slice(0, 200).map(s => getCreator(s.id)))).filter(Boolean);
  }

  const filtered = [];
  for (const r of related) {
    const handle = (r.username || '').toLowerCase();
    if (!handle) {
      if (drops) drops.noHandle++;
      continue;
    }

    // Dedup checks
    if (await isInCRM(handle, crmFull)) {
      if (drops) drops.inCRM++;
      continue;
    }
    if (await isDismissed(handle)) {
      if (drops) drops.dismissed++;
      continue;
    }
    if (await isOutOfRange(handle)) {
      if (drops) drops.outOfRange++;
      continue;
    }
    if (await isInQueue(handle)) {
      if (drops) drops.inQueue++;
      continue;
    }

    // Follower range check — but ONLY if we have follower data. If 0/unknown, let it through to Stage 2.
    const followers = r.followers || 0;
    if (followers > 0 && (followers < ICP.minFollowers || followers > ICP.maxFollowers)) {
      if (drops) drops.outOfRange++;
      continue;
    }

    filtered.push({
      handle,
      seedData: r,
      sourceCreatorId: sourceCreator.id,
      sourceCreatorName: sourceCreator.name,
      sourceCreatorHandle: extractHandle(sourceCreator.platforms?.instagram?.url || ''),
    });

    if (filtered.length >= maxCandidates) break;
  }

  return filtered;
}

/**
 * Stage 2 + 3: scrape candidate, compute deal score, add to queue or dismiss.
 * Returns one of: { status: 'queued' | 'dismissed' | 'failed', candidate? }
 */
async function processCandidate(candidate) {
  try {
    const scraped = await scrapeInstagramBasic(candidate.handle);
    if (!scraped) {
      return { status: 'failed', handle: candidate.handle, reason: 'scrape_failed' };
    }

    // Filter 1: Follower range (ICP)
    if (scraped.followers > 0 && (scraped.followers < ICP.minFollowers || scraped.followers > ICP.maxFollowers)) {
      await addToOutOfRange(candidate.handle);
      return {
        status: 'out_of_range',
        handle: candidate.handle,
        followers: scraped.followers,
        tooSmall: scraped.followers < ICP.minFollowers,
        tooBig: scraped.followers > ICP.maxFollowers,
      };
    }

    // Filter 2: Language (PT or EN only)
    const lang = detectLanguage(scraped.bio);
    if (lang === 'other') {
      await addToDismissed(candidate.handle);
      return { status: 'dismissed_language', handle: candidate.handle };
    }

    // Filter 3: Niche match (must be in Second Layer's 7 target niches)
    const nicheMatch = matchesTargetNiche(scraped.bio);
    if (!nicheMatch) {
      await addToDismissed(candidate.handle);
      return { status: 'dismissed_niche', handle: candidate.handle };
    }

    // Filter 4: Business signals (must be monetizing)
    if (!hasBusinessSignals(scraped)) {
      await addToDismissed(candidate.handle);
      return { status: 'dismissed_no_business', handle: candidate.handle };
    }

    // Build creator-shaped object for dealScore
    const creatorShape = {
      name: scraped.name,
      niche: '', // niche will be extracted below via matchNiche in bio
      platforms: {
        instagram: {
          followers: scraped.followers,
          following: scraped.following,
          postCount: scraped.postCount,
          avgLikes: scraped.avgLikes,
          avgComments: scraped.avgComments,
          engagementRate: scraped.engagementRate,
          followerFollowingRatio: scraped.followerFollowingRatio,
          recentPosts: scraped.recentPosts,
        },
      },
      externalUrl: scraped.externalUrl,
      isBusinessAccount: scraped.isBusinessAccount,
      bio: scraped.bio,
    };

    // Try to detect niche from bio (feeds into deal score)
    // Uses matchNiche which handles PT + EN aliases
    creatorShape.niche = scraped.bio || '';

    const score = calculateDealScore(creatorShape);

    // Override niche with the detected one (if matched) for display
    const detectedNiche = score.nicheData ? (scraped.bio.split('\n')[0].slice(0, 60)) : '';

    const queueEntry = {
      id: nanoid(9),
      handle: candidate.handle,
      name: scraped.name,
      profilePicUrl: scraped.profilePicUrl,
      url: `https://instagram.com/${candidate.handle}`,
      followers: scraped.followers,
      engagement: scraped.engagementRate,
      bio: scraped.bio,
      externalUrl: scraped.externalUrl,
      isVerified: scraped.isVerified,
      isBusinessAccount: scraped.isBusinessAccount,
      avgLikes: scraped.avgLikes,
      avgComments: scraped.avgComments,
      followerFollowingRatio: scraped.followerFollowingRatio,
      recentPosts: scraped.recentPosts,
      niche: detectedNiche,
      dealScoreGrade: score.grade,
      dealScore: score.score,
      sourceCreatorId: candidate.sourceCreatorId,
      sourceCreatorName: candidate.sourceCreatorName,
      sourceCreatorHandle: candidate.sourceCreatorHandle,
    };

    // A/B → queue. C/D → permanent dismiss.
    if (score.grade === 'A' || score.grade === 'B') {
      const entry = await addToQueue(queueEntry);
      return { status: 'queued', candidate: entry };
    } else {
      await addToDismissed(candidate.handle);
      return { status: 'dismissed', handle: candidate.handle, grade: score.grade };
    }
  } catch (err) {
    return { status: 'failed', handle: candidate.handle, reason: err.message };
  }
}

/**
 * Run discovery for a single source creator.
 * Returns stats: { scanned, queued, dismissed, failed, skipped }
 */
export async function runDiscoveryForCreator(creatorId, maxCandidates = 10) {
  const sourceCreator = await getCreator(creatorId);
  if (!sourceCreator) return { error: 'Source creator not found' };

  const drops = { totalRelated: 0, noHandle: 0, inCRM: 0, dismissed: 0, inQueue: 0, outOfRange: 0 };
  const filtered = await stage1Filter(sourceCreator, maxCandidates, null, drops);

  let queued = 0, dismissedLowTier = 0, dismissedOutOfRange = 0, failed = 0;
  let dismissedLanguage = 0, dismissedNiche = 0, dismissedNoBusiness = 0;
  let tooSmall = 0, tooBig = 0;
  const results = [];

  for (const cand of filtered) {
    const result = await processCandidate(cand);
    results.push(result);
    if (result.status === 'queued') queued++;
    else if (result.status === 'out_of_range') {
      dismissedOutOfRange++;
      if (result.tooSmall) tooSmall++;
      if (result.tooBig) tooBig++;
    }
    else if (result.status === 'dismissed_language') dismissedLanguage++;
    else if (result.status === 'dismissed_niche') dismissedNiche++;
    else if (result.status === 'dismissed_no_business') dismissedNoBusiness++;
    else if (result.status === 'dismissed') dismissedLowTier++;
    else failed++;
  }

  return {
    scanned: filtered.length,
    queued,
    dismissedLowTier,
    dismissedOutOfRange,
    dismissedLanguage,
    dismissedNiche,
    dismissedNoBusiness,
    tooSmall,
    tooBig,
    failed,
    drops,
    results,
  };
}

// Run async tasks in parallel batches to avoid overwhelming Apify.
async function runInBatches(items, worker, batchSize = 5) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(worker));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Run discovery from user-provided seed Instagram URLs.
 * Parallelizes seed scraping (batches of 5) and candidate processing (batches of 5)
 * to stay under Vercel's function timeout.
 */
export async function runDiscoveryFromSeeds(seedUrls, maxCandidates = 15) {
  const drops = { totalRelated: 0, noHandle: 0, inCRM: 0, dismissed: 0, inQueue: 0, outOfRange: 0 };

  // Get CRM for dedup (needed by Stage 1)
  const crmSummaries = await listCreators();
  const crmFull = (await Promise.all(crmSummaries.map(s => getCreator(s.id)))).filter(Boolean);

  // Phase 1: Parallel seed scraping (batches of 5)
  const seedResults = await runInBatches(seedUrls, async (url) => {
    const handle = extractHandle(url);
    if (!handle) return { url, status: 'invalid_url' };

    try {
      const scraped = await scrapeInstagram(handle);
      if (!scraped || !scraped.relatedProfiles) {
        return { url, handle, status: 'no_related', followers: scraped?.followers };
      }
      return {
        url,
        handle,
        status: 'ok',
        seedName: scraped.name,
        seedFollowers: scraped.followers,
        relatedCount: scraped.relatedProfiles.length,
        relatedProfiles: scraped.relatedProfiles,
      };
    } catch (err) {
      return { url, handle, status: 'scrape_failed', error: err.message };
    }
  }, 5);

  // Phase 2: Collect all candidates from successful seeds
  const allCandidates = [];
  for (const seedResult of seedResults) {
    if (seedResult.status !== 'ok' || !seedResult.relatedProfiles) continue;

    const fakeSource = {
      id: `seed:${seedResult.handle}`,
      name: seedResult.seedName || seedResult.handle,
      competitors: seedResult.relatedProfiles,
      platforms: { instagram: { url: `https://instagram.com/${seedResult.handle}` } },
    };

    const filtered = await stage1Filter(fakeSource, Infinity, crmFull, drops);
    allCandidates.push(...filtered);

    if (allCandidates.length >= maxCandidates * 3) break;

    // Strip relatedProfiles from the response (too large to return)
    delete seedResult.relatedProfiles;
  }

  // Dedup candidates across all seeds
  const seen = new Set();
  const uniqueCandidates = [];
  for (const c of allCandidates) {
    if (seen.has(c.handle)) continue;
    seen.add(c.handle);
    uniqueCandidates.push(c);
    if (uniqueCandidates.length >= maxCandidates) break;
  }

  // Phase 3: Parallel candidate processing (batches of 5)
  const results = await runInBatches(uniqueCandidates, processCandidate, 5);

  // Aggregate stats
  let queued = 0, dismissedLowTier = 0, dismissedOutOfRange = 0, failed = 0;
  let dismissedLanguage = 0, dismissedNiche = 0, dismissedNoBusiness = 0;
  let tooSmall = 0, tooBig = 0;

  for (const result of results) {
    if (result.status === 'queued') queued++;
    else if (result.status === 'out_of_range') {
      dismissedOutOfRange++;
      if (result.tooSmall) tooSmall++;
      if (result.tooBig) tooBig++;
    }
    else if (result.status === 'dismissed_language') dismissedLanguage++;
    else if (result.status === 'dismissed_niche') dismissedNiche++;
    else if (result.status === 'dismissed_no_business') dismissedNoBusiness++;
    else if (result.status === 'dismissed') dismissedLowTier++;
    else failed++;
  }

  return {
    seedsProcessed: seedResults.length,
    seedResults,
    scanned: uniqueCandidates.length,
    queued,
    dismissedLowTier,
    dismissedOutOfRange,
    dismissedLanguage,
    dismissedNiche,
    dismissedNoBusiness,
    tooSmall,
    tooBig,
    failed,
    drops,
    results,
  };
}

/**
 * Run discovery across ALL CRM creators.
 * Caps at maxCandidates total (not per creator).
 */
export async function runBulkDiscovery(maxCandidates = 10) {
  const crmSummaries = await listCreators();
  const crmCreators = (await Promise.all(crmSummaries.map(s => getCreator(s.id)))).filter(Boolean);

  const drops = { totalRelated: 0, noHandle: 0, inCRM: 0, dismissed: 0, inQueue: 0, outOfRange: 0 };
  const creatorsWithRelated = crmCreators.filter(c => (c.competitors?.length || 0) > 0).length;

  // Collect ALL stage-1-passing candidates across all creators
  const allCandidates = [];
  for (const sc of crmCreators) {
    const filtered = await stage1Filter(sc, Infinity, crmCreators, drops);
    allCandidates.push(...filtered);
    if (allCandidates.length >= maxCandidates * 3) break;
  }

  // Dedup by handle (same creator might be related-to by multiple sources)
  const seen = new Set();
  const uniqueCandidates = [];
  for (const c of allCandidates) {
    if (seen.has(c.handle)) continue;
    seen.add(c.handle);
    uniqueCandidates.push(c);
    if (uniqueCandidates.length >= maxCandidates) break;
  }

  let queued = 0, dismissedLowTier = 0, dismissedOutOfRange = 0, failed = 0;
  let dismissedLanguage = 0, dismissedNiche = 0, dismissedNoBusiness = 0;
  let tooSmall = 0, tooBig = 0;
  const results = [];

  for (const cand of uniqueCandidates) {
    const result = await processCandidate(cand);
    results.push(result);
    if (result.status === 'queued') queued++;
    else if (result.status === 'out_of_range') {
      dismissedOutOfRange++;
      if (result.tooSmall) tooSmall++;
      if (result.tooBig) tooBig++;
    }
    else if (result.status === 'dismissed_language') dismissedLanguage++;
    else if (result.status === 'dismissed_niche') dismissedNiche++;
    else if (result.status === 'dismissed_no_business') dismissedNoBusiness++;
    else if (result.status === 'dismissed') dismissedLowTier++;
    else failed++;
  }

  return {
    crmCreatorsScanned: crmCreators.length,
    creatorsWithRelated,
    scanned: uniqueCandidates.length,
    queued,
    dismissedLowTier,
    dismissedOutOfRange,
    dismissedLanguage,
    dismissedNiche,
    dismissedNoBusiness,
    tooSmall,
    tooBig,
    failed,
    drops,
    results,
  };
}
