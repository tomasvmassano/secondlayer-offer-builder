import { Redis } from '@upstash/redis';
import { nanoid } from 'nanoid';
import { calculateDealScore } from './dealScore';
import { normalizeOperatorName } from './auth';
import { sanitizeUnpairedSurrogates } from './safeJson';

// Recursively scrub unpaired UTF-16 surrogates from every string in a
// creator record. Apify occasionally truncates scraped Instagram strings
// (bio, captions, comments) mid-emoji, leaving an orphan high or low
// surrogate behind. That orphan survives storage in Redis and breaks
// downstream JSON.parse on any route that POSTs the creator profile
// (dm-writer first hit it). We heal at read time: walk the tree, replace
// orphans with U+FFFD (◇), and report whether anything changed so the
// caller can persist the cleaned record back. Mutates `node` in place
// for efficiency. Returns `true` if any string was modified.
function scrubSurrogatesInPlace(node, ctx = { changed: false }) {
  if (node == null) return ctx.changed;
  if (typeof node === 'string') return ctx.changed;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const v = node[i];
      if (typeof v === 'string') {
        const cleaned = sanitizeUnpairedSurrogates(v);
        if (cleaned !== v) { node[i] = cleaned; ctx.changed = true; }
      } else if (v && typeof v === 'object') {
        scrubSurrogatesInPlace(v, ctx);
      }
    }
    return ctx.changed;
  }
  if (typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (typeof v === 'string') {
        const cleaned = sanitizeUnpairedSurrogates(v);
        if (cleaned !== v) { node[k] = cleaned; ctx.changed = true; }
      } else if (v && typeof v === 'object') {
        scrubSurrogatesInPlace(v, ctx);
      }
    }
  }
  return ctx.changed;
}

// Build the denormalised summary that goes into the creators:index sorted
// set. This is what listCreators returns — keep it cheap to deserialise but
// rich enough to drive the CRM filters/tabs without a full record fetch.
// Mirrors saveCreator + updateCreator + the lazy backfill in listCreators.
function buildSummary(creator, createdAt) {
  let dealScoreGrade = null;
  try { dealScoreGrade = calculateDealScore(creator)?.grade || null; } catch { /* lean records can lack platform shape */ }
  return {
    id: creator.id,
    name: creator.name,
    niche: creator.niche,
    primaryPlatform: creator.primaryPlatform,
    followers: _getPrimaryFollowers(creator),
    pipelineStatus: creator.pipelineStatus || 'prospect',
    hasOffer: !!(creator.offer || creator.offerId),
    hasDm: !!creator.dmSequence,
    // Outreach state — drives the CRM tabs:
    //   Por contactar  = !dmSentAt && !emailSentAt
    //   Em outreach    = (dmSentAt || emailSentAt) && !repliedAt
    //   Em contacto    = repliedAt
    dmSentAt: creator.outreach?.dmSentAt || null,
    emailSentAt: creator.outreach?.emailSentAt || null,
    repliedAt: creator.outreach?.repliedAt || null,
    repliedChannel: creator.outreach?.repliedChannel || null,
    // Kanban-stage signals — surface here so the CRM Kanban can place each
    // card in the right column without fetching the full creator record.
    loomRequestedAt: creator.outreach?.loomRequestedAt || null,
    proposalReadyAt: creator.outreach?.proposalReadyAt || null,
    loomSentAt:      creator.outreach?.loomSentAt      || null,
    callBookedAt:    creator.outreach?.callBookedAt    || creator.outreach?.callAgreedAt || null,
    callHeldAt:      creator.outreach?.callHeldAt      || null,
    notInterestedAt: creator.outreach?.notInterestedAt || null,
    pitchSentAt:     creator.pitch?.sentAt             || null,
    profilePicUrl:   creator.profilePicUrl             || null,
    // Follow-up state — needed by the Kanban so cards land in the right
    // dia-3/7/14 column without fetching the full record, and by the
    // floating tray so it can filter to "what's due for me".
    followUpsDone:   Number(creator.outreach?.followUpsDone) || (Array.isArray(creator.outreach?.followUps) ? creator.outreach.followUps.length : 0),
    lastFollowUpAt:  creator.outreach?.lastFollowUpAt || null,
    // Filters — addedByFirstName goes through normalizeOperatorName so
    // legacy "Tomas"/"Raul" upgrade to "Tomás"/"Raúl". Idempotent on
    // already-accented data. addedByUserId is the immutable JWT subject
    // so the tray can scope "my creators" without name-collision risk.
    addedByFirstName: normalizeOperatorName(creator.addedBy?.firstName) || null,
    addedByUserId:    creator.addedBy?.userId || null,
    dealScoreGrade,
    hasAudit: !!creator.offer?.internal_metadata?.ecosystem_audit,
    createdAt: createdAt || creator.createdAt || new Date().toISOString(),
  };
}

// In-memory fallback for local dev (no Redis configured)
const memStore = new Map();
const memIndex = [];

// ─────────────────────────────────────────────────────────────────
// READ CACHE — Upstash quota saver
//
// Module-scoped, lives on each warm Vercel function instance. Caches:
//   - the listCreators() result (single 'index' key)
//   - per-creator getCreator() results (one key per creator id)
//
// TTL is 30s — short enough that any visible staleness is bounded and
// matches our 60s real-time poll cadence. Writes invalidate immediately
// so an operator drag or PATCH never sees stale data.
//
// Why it matters: /api/team-stats fan-outs 24 parallel aggregations that
// each used to call listCreators + getCreator on their own. With this
// cache, the second through 24th calls all hit memory and never touch
// Redis. Likewise the floating tray, daily cron, and CRM kanban share
// the same cached pool when they fire within 30s of each other.
// ─────────────────────────────────────────────────────────────────
const READ_CACHE_TTL_MS = 30_000;
const _readCache = new Map(); // key → { val, expiresAt }
function _cacheGet(key) {
  const entry = _readCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) { _readCache.delete(key); return undefined; }
  return entry.val;
}
function _cacheSet(key, val) {
  _readCache.set(key, { val, expiresAt: Date.now() + READ_CACHE_TTL_MS });
}
function _cacheInvalidate(key) { _readCache.delete(key); }
function _cacheInvalidateAll() { _readCache.clear(); }

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
    // contactEmail surfaced from the first scrape — IG public/business email,
    // aggregator page email, or regex over the bio. Null if none found.
    contactEmail: data.contactEmail || null,
    // addedBy — team-member attribution. { userId, firstName, at }. Set by
    // the API route from the current session. Null when added pre-auth or
    // via cron / scripts. Backfilled to Tomás for legacy records on read.
    addedBy: data.addedBy || null,
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
    primaryLanguage: data.primaryLanguage || null, // "pt" | "en" | "es" | null (null = not yet detected)
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
    // Loss reason — set when the creator becomes cold. Drives the
    // "Razões de perda" breakdown on the team dashboard so we can see why
    // deals die and iterate the offer. One of: price | timing | fit |
    // ghost | competitor | other. Null while the deal is still live.
    lostReason: data.lostReason || null,
    lostAt: data.lostAt || null,
    // Outreach tracking — drives the daily reminders digest.
    //   dmSentAt, emailSentAt: when the initial outreach was sent (manually marked)
    //   followUpsDone: 0..3 — count of follow-up touches completed
    //   repliedAt: set when creator engages (stops all reminders)
    //   callAgreedAt: creator agreed to a sales call (after replying)
    //   callHeldAt: the call actually happened (show-up rate denominator)
    //   remindersSent: dedup record so the cron never re-pings the same milestone
    outreach: data.outreach || {
      dmSentAt: null,
      emailSentAt: null,
      // followUps is the authoritative log — each entry is
      // { channel: 'dm'|'email', at: ISO, by: { userId, firstName, at } }.
      // followUpsDone / lastFollowUpAt / lastFollowUpBy stay as DERIVED
      // fields (computed in getCreator) so existing reads keep working
      // without an immediate refactor.
      followUps: [],
      followUpsDone: 0,
      lastFollowUpAt: null,
      repliedAt: null,
      // repliedChannel — which channel the creator first replied on.
      // 'dm' | 'email' | null. Critical for measuring per-channel
      // conversion rate on the team dashboard.
      repliedChannel: null,
      callAgreedAt: null,
      callHeldAt: null,
      remindersSent: { followUp1: null, followUp2: null, followUp3: null, autoCold: null },
    },
    createdAt: now,
    updatedAt: now,
  };

  const summary = buildSummary(creator, now);

  if (useMemory()) {
    memStore.set(`creator:${id}`, JSON.stringify(creator));
    memIndex.unshift(summary);
  } else {
    const redis = getRedis();
    await redis.set(`creator:${id}`, JSON.stringify(creator));
    await redis.zadd('creators:index', { score: Date.now(), member: JSON.stringify(summary) });
  }

  // Bust the read cache so the next listCreators / getCreator returns
  // the fresh record instead of a 30s-stale view.
  _cacheInvalidateAll();
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
  // 30s read cache — multiple getCreator(id) calls from the same warm
  // function instance share a single Redis hit. The team-stats endpoint
  // alone benefits enormously: its 24 aggregators used to each pull the
  // same creator independently.
  const cacheKey = `c:${id}`;
  const cached = _cacheGet(cacheKey);
  if (cached !== undefined) {
    // Return a deep clone so downstream mutations (heal-in-place,
    // backfills) don't leak across callers sharing the cache entry.
    return cached ? JSON.parse(JSON.stringify(cached)) : null;
  }
  let creator;
  if (useMemory()) {
    const raw = memStore.get(`creator:${id}`);
    creator = raw ? JSON.parse(raw) : null;
  } else {
    const redis = getRedis();
    const raw = await redis.get(`creator:${id}`);
    if (!raw) { _cacheSet(cacheKey, null); return null; }
    creator = typeof raw === 'string' ? JSON.parse(raw) : raw;
  }
  if (!creator) { _cacheSet(cacheKey, null); return null; }

  // Heal orphan UTF-16 surrogates left in the record by emoji-truncated
  // scrape data (see scrubSurrogatesInPlace above). Mutates the cloned
  // object in place; if anything changed, persist back so the next read
  // pays nothing and downstream consumers (dm-writer, audit, oferta) see
  // clean data. Best-effort write — a failed persist still returns the
  // clean in-memory copy to the caller.
  const surrogateChanged = scrubSurrogatesInPlace(creator);
  if (surrogateChanged) {
    if (useMemory()) {
      memStore.set(`creator:${id}`, JSON.stringify(creator));
    } else {
      try { await getRedis().set(`creator:${id}`, JSON.stringify(creator)); } catch { /* best-effort */ }
    }
  }

  // Backfill onboarding for legacy creators signed before Phase 1.
  if (!creator.onboarding?.token) {
    const onboarding = {
      token: nanoid(16),
      status: 'not_started',
      formStartedAt: null,
      formCompletedAt: null,
      responses: {},
      kickoff: { decisions: {}, actionItems: [] },
      ...(creator.onboarding || {}),
    };
    if (!onboarding.token) onboarding.token = nanoid(16);
    creator = { ...creator, onboarding };
    // Persist so the same token is reused next time.
    if (useMemory()) {
      memStore.set(`creator:${id}`, JSON.stringify(creator));
    } else {
      await getRedis().set(`creator:${id}`, JSON.stringify(creator));
    }
  }

  // Backfill primaryLanguage for legacy creators where the resolver returned
  // null (pre-2026-05-18 behaviour for non-PT/non-EN audiences). Default to
  // 'en' so downstream branches produce content. As of 2026-05-20 the
  // resolver can also return 'es' for Spanish-dominant audiences, but we
  // don't auto-upgrade legacy records here — they keep whatever was
  // written, and the operator can flip the badge in the UI.
  if (creator.primaryLanguage == null) {
    creator = { ...creator, primaryLanguage: 'en' };
  }
  // Backfill addedBy for legacy creators added before team attribution
  // existed. Tomás was the only operator until 2026-05-18, so all historical
  // additions land on him. firstName must match the live session shape
  // (email-local-part Title-Cased = "Tomas" without accent) otherwise the
  // dashboard treats backfill rows as a separate person from real session
  // events.
  if (!creator.addedBy) {
    creator = {
      ...creator,
      // Legacy backfill: pre-2026-05-18 Tomás was the only operator. Use the
      // accented display form so this row aggregates with live session data
      // (which now also writes accented names) under the same dashboard
      // identity.
      addedBy: { userId: 'tomas-backfill', firstName: 'Tomás', at: creator.createdAt || creator.updatedAt || null },
    };
  }

  // Normalise operator names — old writes stored "Tomas"/"Raul" (unaccented
  // email slug); new writes use "Tomás"/"Raúl" via displayFirstName. Walk
  // the addedBy + outreach actor fields and upgrade any unaccented value
  // we recognise. Idempotent for already-accented data. Persist so the
  // next read pays nothing.
  const ACTOR_FIELDS = ['dmSentBy', 'emailSentBy', 'lastFollowUpBy', 'repliedMarkedBy', 'callAgreedBy', 'callHeldBy'];
  let nameMigrated = false;
  if (creator.addedBy?.firstName) {
    const normalised = normalizeOperatorName(creator.addedBy.firstName);
    if (normalised !== creator.addedBy.firstName) {
      creator = { ...creator, addedBy: { ...creator.addedBy, firstName: normalised } };
      nameMigrated = true;
    }
  }
  if (creator.outreach) {
    let outreach = creator.outreach;
    for (const key of ACTOR_FIELDS) {
      if (outreach[key]?.firstName) {
        const normalised = normalizeOperatorName(outreach[key].firstName);
        if (normalised !== outreach[key].firstName) {
          outreach = { ...outreach, [key]: { ...outreach[key], firstName: normalised } };
          nameMigrated = true;
        }
      }
    }
    if (outreach !== creator.outreach) creator = { ...creator, outreach };
  }
  if (nameMigrated) {
    if (useMemory()) {
      memStore.set(`creator:${id}`, JSON.stringify(creator));
    } else {
      try { await getRedis().set(`creator:${id}`, JSON.stringify(creator)); } catch { /* best-effort */ }
    }
  }

  // Channel-tracking backfills (2026-05-20).
  // 1) Infer outreach.repliedChannel for legacy records where we marked
  //    repliedAt before the channel field existed. Use "last-touch
  //    attribution": whichever channel was most recently sent before the
  //    reply timestamp. Falls back to DM if only one was sent, or null if
  //    neither (manual mark with no preceding outreach).
  // 2) Hydrate outreach.followUps array from the legacy followUpsDone
  //    counter so the new array-based code has something to read. Channel
  //    + actor for those reconstructed entries are 'unknown' / null since
  //    we never captured them — they don't pollute new analytics because
  //    we filter by channel='dm'|'email' explicitly downstream.
  let outreachMigrated = false;
  if (creator.outreach) {
    let outreach = creator.outreach;
    if (outreach.repliedAt && !outreach.repliedChannel) {
      const repliedMs = new Date(outreach.repliedAt).getTime();
      const dmMs = outreach.dmSentAt ? new Date(outreach.dmSentAt).getTime() : 0;
      const emailMs = outreach.emailSentAt ? new Date(outreach.emailSentAt).getTime() : 0;
      const dmBefore = dmMs > 0 && dmMs <= repliedMs;
      const emailBefore = emailMs > 0 && emailMs <= repliedMs;
      let inferred = null;
      if (dmBefore && !emailBefore) inferred = 'dm';
      else if (emailBefore && !dmBefore) inferred = 'email';
      else if (dmBefore && emailBefore) inferred = dmMs >= emailMs ? 'dm' : 'email';
      if (inferred) {
        outreach = { ...outreach, repliedChannel: inferred };
        outreachMigrated = true;
      }
    }
    if (!Array.isArray(outreach.followUps)) {
      const count = Number(outreach.followUpsDone) || 0;
      const reconstructed = [];
      if (count > 0 && outreach.lastFollowUpAt) {
        // We only know the timestamp of the LAST follow-up. Older follow-ups
        // get the same timestamp as a best-effort marker. Channel is unknown
        // for all of these — downstream counts gate on channel === 'dm'|'email'
        // so these don't double-count.
        for (let i = 0; i < count; i++) {
          reconstructed.push({
            channel: 'unknown',
            at: outreach.lastFollowUpAt,
            by: outreach.lastFollowUpBy || null,
          });
        }
      }
      outreach = { ...outreach, followUps: reconstructed };
      outreachMigrated = true;
    }
    if (outreachMigrated) creator = { ...creator, outreach };
  }
  if (outreachMigrated) {
    if (useMemory()) {
      memStore.set(`creator:${id}`, JSON.stringify(creator));
    } else {
      try { await getRedis().set(`creator:${id}`, JSON.stringify(creator)); } catch { /* best-effort */ }
    }
  }

  // One-time template-label migration (deployed 2026-05-19).
  // Before this date, the DM Writer template selector was a UI label only —
  // the system prompt didn't branch on it, so every "B" creator received
  // A-style content. New B (Second Layer · parceria) is the real partnership
  // template. Relabel pre-deploy B records to A so the Quality card on the
  // /equipa dashboard shows accurate reply rates per template instead of
  // mixing two different cohorts under the same letter.
  //
  // Cutoff is set well before real B usage could start (the prompt landed
  // shortly after the commit at ~15:30 UTC). Anything generated before this
  // is old and gets relabeled; anything after is real new B and untouched.
  // Records that have already been migrated are skipped via templateMigratedAt.
  const TEMPLATE_B_RELABEL_CUTOFF_MS = new Date('2026-05-19T15:30:00.000Z').getTime();
  if (
    creator.dmSequence?.template === 'B' &&
    !creator.dmSequence?.templateMigratedAt
  ) {
    const generatedAt = creator.dmSequence?.generatedAt
      || creator.updatedAt
      || creator.createdAt
      || null;
    const generatedMs = generatedAt ? new Date(generatedAt).getTime() : 0;
    if (generatedMs > 0 && generatedMs < TEMPLATE_B_RELABEL_CUTOFF_MS) {
      creator = {
        ...creator,
        dmSequence: {
          ...creator.dmSequence,
          template: 'A',
          templateMigratedAt: new Date().toISOString(),
          templateMigratedFrom: 'B-noop',
        },
      };
      // Persist so the next read doesn't re-evaluate the migration.
      if (useMemory()) {
        memStore.set(`creator:${id}`, JSON.stringify(creator));
      } else {
        await getRedis().set(`creator:${id}`, JSON.stringify(creator));
      }
    }
  }

  // Cache the fully-backfilled creator so subsequent reads within the
  // TTL window skip Redis entirely. Store the deep-cloned shape so
  // callers can mutate freely without poisoning the cache.
  _cacheSet(`c:${id}`, creator ? JSON.parse(JSON.stringify(creator)) : null);
  return creator;
}

export async function listCreators() {
  // 30s read cache — the index is hot and read by /equipa, /creators,
  // the tray, and every team-stats aggregator. Caching the result
  // collapses N independent zrange calls within the window into one.
  const cached = _cacheGet('idx');
  if (cached !== undefined) {
    // Deep clone so each caller can transform freely (the listCreators
    // contract returns plain objects, callers sometimes splice them).
    return JSON.parse(JSON.stringify(cached));
  }
  // Note for callers (e.g. the original raw zrange members) — we rewrite
  // the Redis index after enrichment, so the next listCreators call doesn't
  // re-enrich. To do that we need the ORIGINAL member string to call zrem
  // against. Use Redis when configured.
  let rawMembers = [];
  let summaries;
  if (useMemory()) {
    summaries = [...memIndex];
  } else {
    const redis = getRedis();
    rawMembers = await redis.zrange('creators:index', 0, -1, { rev: true });
    summaries = rawMembers.map(m => typeof m === 'string' ? JSON.parse(m) : m);
  }

  // Always normalise addedByFirstName so the CRM filter dropdown shows the
  // accented form ("Tomás"/"Raúl") even on summaries written before the
  // displayFirstName rollout — no need to fall through to the heavier
  // rebuild path just for a label fix.
  summaries = summaries.map(s => {
    if (!s?.addedByFirstName) return s;
    const normalised = normalizeOperatorName(s.addedByFirstName);
    return normalised === s.addedByFirstName ? s : { ...s, addedByFirstName: normalised };
  });

  // Enrich summaries with the fields that drive the CRM filters/tabs. The
  // sentinel field for "this summary was written by the current schema" is
  // dealScoreGrade — it's the last addition. If it's missing we fetch the
  // full record, rebuild the summary, and rewrite the index entry so the
  // next read pays nothing.
  const needsEnrich = summaries.some(s =>
    s.hasOffer === undefined
    || s.repliedAt === undefined
    || s.dmSentAt === undefined
    || s.emailSentAt === undefined
    || s.dealScoreGrade === undefined
    || s.hasAudit === undefined
    || s.addedByFirstName === undefined
  );
  if (!needsEnrich) {
    _cacheSet('idx', summaries);
    return summaries;
  }

  const redis = useMemory() ? null : getRedis();
  const enriched = await Promise.all(summaries.map(async (s, i) => {
    const stale = s.hasOffer === undefined
      || s.repliedAt === undefined
      || s.dmSentAt === undefined
      || s.emailSentAt === undefined
      || s.dealScoreGrade === undefined
      || s.hasAudit === undefined
      || s.addedByFirstName === undefined;
    if (!stale) return s;
    const full = await getCreator(s.id);
    if (!full) return s;
    const rebuilt = { ...s, ...buildSummary(full, full.createdAt) };
    // Persist the rebuilt summary back to the index so future reads don't
    // re-fetch the full record. memIndex update is in-place; Redis needs a
    // zrem of the original member + zadd of the new one. Score = original
    // createdAt so position in the sorted set is stable.
    if (useMemory()) {
      memIndex[i] = rebuilt;
    } else if (redis) {
      try {
        const original = rawMembers[i];
        const originalStr = typeof original === 'string' ? original : JSON.stringify(original);
        await redis.zrem('creators:index', originalStr);
        const scoreMs = rebuilt.createdAt ? new Date(rebuilt.createdAt).getTime() : Date.now();
        await redis.zadd('creators:index', { score: scoreMs, member: JSON.stringify(rebuilt) });
      } catch {
        // Best-effort — if rewrite fails, return the enriched view anyway.
      }
    }
    return rebuilt;
  }));
  _cacheSet('idx', enriched);
  return enriched;
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
  // Outreach tracking — deep-merge so a patch like `outreach: { repliedAt: X }`
  // doesn't wipe the other fields.
  if (updates.outreach) {
    const existingOut = existing.outreach || {};
    const merged = {
      ...existingOut,
      ...updates.outreach,
      remindersSent: {
        ...(existingOut.remindersSent || {}),
        ...(updates.outreach.remindersSent || {}),
      },
    };
    // Keep the legacy counter + last-touch fields in sync with the array.
    // Lets existing code that reads followUpsDone / lastFollowUpAt continue
    // to work without an immediate refactor.
    if (Array.isArray(merged.followUps)) {
      merged.followUpsDone = merged.followUps.length;
      const last = merged.followUps[merged.followUps.length - 1];
      if (last) {
        merged.lastFollowUpAt = last.at || merged.lastFollowUpAt;
        if (last.by) merged.lastFollowUpBy = last.by;
      }
    }
    updates.outreach = merged;
  }

  const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };

  const summary = buildSummary(updated, updated.createdAt);

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

  _cacheInvalidateAll();
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

  _cacheInvalidateAll();
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
