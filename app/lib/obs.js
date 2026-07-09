// ─────────────────────────────────────────────────────────────────
// Observability — LLM cost metering + error capture.
//
// The platform had ZERO visibility: every problem this week was found
// by an operator hitting a broken page. Costs existed only as code
// comments; failures only in Vercel function logs nobody watched. This
// is the minimum viable baseline:
//
//   - recordLlmUsage() — per-day + per-route spend, computed from the
//     Anthropic usage block, into Redis counters (INCRBYFLOAT). One
//     command per LLM call. Surfaces "what did we spend and where".
//   - logError() — recent errors into a capped Redis list (ring buffer).
//     Surfaces "what's breaking" without a Sentry dependency.
//   - getObsSnapshot() — reads today/yesterday cost + recent errors for
//     the /api/health endpoint and the daily cron email.
//
// Everything is BEST-EFFORT: an obs failure must never break the request
// it's observing. All writes swallow errors and no-op without Redis.
// ─────────────────────────────────────────────────────────────────

import { Redis } from '@upstash/redis';

let _redis;
function redis() {
  if (_redis) return _redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

// $ per million tokens (input / output). Keep in sync with the models
// actually used across app/api. Update when Anthropic pricing changes.
const MODEL_PRICING = {
  'claude-sonnet-4-5-20250929': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001':  { in: 1, out: 5 },
  'claude-opus-4-8':            { in: 15, out: 75 },
};

// Web search is billed separately at $10 / 1000 searches.
const WEB_SEARCH_COST = 0.01;

function ymd(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/**
 * Estimate the $ cost of one Anthropic call from its usage block.
 * Counts cache reads at 0.1× input and cache writes at 1.25× input
 * (Anthropic prompt-caching pricing). Returns a number (USD).
 */
export function estimateCost(model, usage = {}) {
  const p = MODEL_PRICING[model] || MODEL_PRICING['claude-sonnet-4-5-20250929'];
  const inTok   = Number(usage.input_tokens) || 0;
  const outTok  = Number(usage.output_tokens) || 0;
  const cacheRd = Number(usage.cache_read_input_tokens) || 0;
  const cacheWr = Number(usage.cache_creation_input_tokens) || 0;
  const searches = Number(usage.server_tool_use?.web_search_requests) || 0;
  return (
    (inTok   * p.in  / 1e6) +
    (outTok  * p.out / 1e6) +
    (cacheRd * p.in  * 0.1  / 1e6) +
    (cacheWr * p.in  * 1.25 / 1e6) +
    (searches * WEB_SEARCH_COST)
  );
}

/**
 * Record one LLM call's cost. Best-effort, single Redis pipeline.
 *   recordLlmUsage({ route: 'ecosystem-audit', model, usage: data.usage })
 */
export async function recordLlmUsage({ route, model, usage } = {}) {
  const r = redis();
  if (!r || !route) return;
  const cost = estimateCost(model, usage);
  const day = ymd();
  try {
    const p = r.pipeline();
    p.incrbyfloat(`obs:cost:${day}`, cost);
    p.incrbyfloat(`obs:cost:${day}:${route}`, cost);
    p.incr(`obs:calls:${day}:${route}`);
    p.expire(`obs:cost:${day}`, 40 * 86400);
    p.expire(`obs:cost:${day}:${route}`, 40 * 86400);
    p.expire(`obs:calls:${day}:${route}`, 40 * 86400);
    await p.exec();
  } catch { /* best-effort */ }
}

/**
 * Append an error to the capped ring buffer. Best-effort.
 *   logError('ecosystem-audit', err, { creatorId })
 */
export async function logError(route, err, meta = {}) {
  const r = redis();
  if (!r) return;
  const entry = {
    at: new Date().toISOString(),
    route,
    message: (err && (err.message || String(err))) || 'unknown',
    ...meta,
  };
  try {
    const p = r.pipeline();
    p.lpush('obs:errors', JSON.stringify(entry));
    p.ltrim('obs:errors', 0, 199);      // keep last 200
    p.incr(`obs:errcount:${ymd()}`);
    p.expire(`obs:errcount:${ymd()}`, 40 * 86400);
    await p.exec();
  } catch { /* best-effort */ }
}

/**
 * Snapshot for the health endpoint + cron email. Returns today's +
 * yesterday's total spend, per-route breakdown, error counts, and the
 * most recent errors.
 */
export async function getObsSnapshot({ recentErrors = 20 } = {}) {
  const r = redis();
  if (!r) return { available: false };
  const today = ymd();
  const yest = ymd(new Date(Date.now() - 86400000));
  const ROUTES = [
    'ecosystem-audit', 'archetype', 'uniqueness', 'strategic-frame',
    'offer-judgment', 'core-offer', 'modules', 'value-stack', 'sales-copy',
    'dm-writer', 'launch-generate', 'full-scrape', 'discovery', 'import-research',
  ];
  try {
    const p = r.pipeline();
    p.get(`obs:cost:${today}`);
    p.get(`obs:cost:${yest}`);
    p.get(`obs:errcount:${today}`);
    p.lrange('obs:errors', 0, recentErrors - 1);
    ROUTES.forEach(rt => { p.get(`obs:cost:${today}:${rt}`); p.get(`obs:calls:${today}:${rt}`); });
    const res = await p.exec();
    const [costToday, costYest, errToday, errList, ...rest] = res;
    const perRoute = {};
    ROUTES.forEach((rt, i) => {
      const cost = Number(rest[i * 2]) || 0;
      const calls = Number(rest[i * 2 + 1]) || 0;
      if (cost > 0 || calls > 0) perRoute[rt] = { cost: +cost.toFixed(4), calls };
    });
    const errors = (errList || []).map(e => { try { return typeof e === 'string' ? JSON.parse(e) : e; } catch { return { raw: e }; } });
    return {
      available: true,
      day: today,
      costToday: +(Number(costToday) || 0).toFixed(4),
      costYesterday: +(Number(costYest) || 0).toFixed(4),
      errorsToday: Number(errToday) || 0,
      perRoute,
      recentErrors: errors,
    };
  } catch (e) {
    return { available: false, error: e?.message };
  }
}
