/**
 * Admin infrastructure helpers — the read/write plumbing behind /admin.
 *
 * Keys:
 *   admin:config:sales          → { monthlyGoal, ticket, dailyTarget, workDays, quarterlyQuota }
 *   admin:cron:{name}:lastRun   → { at, ok, summary }
 *
 * Everything here is team-gated at the route layer. Env checks return
 * BOOLEANS only — never the secret values themselves.
 */

import { Redis } from '@upstash/redis';

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

// ───── Sales config (the funnel/calculator targets, persisted) ─────

const SALES_KEY = 'admin:config:sales';
export const SALES_DEFAULTS = {
  monthlyGoal: 50000,
  ticket: 6000,
  dailyTarget: Number(process.env.DAILY_DM_TARGET) || 30,
  workDays: 21,
  quarterlyQuota: Number(process.env.SALES_QUARTERLY_QUOTA_EUR) || 50000,
};

export async function getSalesConfig() {
  const r = getRedis();
  if (!r) return { ...SALES_DEFAULTS };
  const raw = await r.get(SALES_KEY);
  const stored = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
  return { ...SALES_DEFAULTS, ...stored };
}

export async function setSalesConfig(partial) {
  const r = getRedis();
  const current = await getSalesConfig();
  const clean = {};
  for (const k of ['monthlyGoal', 'ticket', 'dailyTarget', 'workDays', 'quarterlyQuota']) {
    if (partial[k] != null) {
      const n = Number(partial[k]);
      if (Number.isFinite(n) && n >= 0) clean[k] = n;
    }
  }
  const next = { ...current, ...clean };
  if (r) await r.set(SALES_KEY, JSON.stringify(next));
  return next;
}

// ───── Cron last-run tracking ─────

export async function recordCronRun(name, { ok = true, summary = '' } = {}) {
  const r = getRedis();
  if (!r) return;
  const payload = JSON.stringify({ at: new Date().toISOString(), ok, summary: String(summary).slice(0, 300) });
  // 40-day TTL — long enough to answer "did last night's run fire?".
  await r.set(`admin:cron:${name}:lastRun`, payload, { ex: 40 * 86400 }).catch(() => {});
}

export async function getCronLastRun(name) {
  const r = getRedis();
  if (!r) return null;
  const raw = await r.get(`admin:cron:${name}:lastRun`);
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}

// Static schedule catalogue (mirrors vercel.json). Kept here so the admin
// page can show "when does this run" without parsing the cron config.
export const CRON_CATALOGUE = [
  { name: 'dm-reminders',    label: 'Lembretes de follow-up', schedule: '0 7 * * *',   scheduleLabel: 'Todos os dias · 07:00', path: '/api/cron/dm-reminders' },
  { name: 'daily-dm-report', label: 'Relatório diário (scoreboard)', schedule: '0 3 * * 2-6', scheduleLabel: 'Ter–Sáb · 03:00', path: '/api/cron/daily-dm-report' },
];

// ───── Env / secrets presence check (booleans only) ─────

export function checkEnv() {
  const has = (v) => !!(v && String(v).trim());
  const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const redisTok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const sessionOk = has(process.env.SESSION_SECRET) && String(process.env.SESSION_SECRET).length >= 32;
  return [
    { key: 'ANTHROPIC_API_KEY',          label: 'Anthropic (LLM)',        set: has(process.env.ANTHROPIC_API_KEY), required: true },
    { key: 'Redis',                      label: 'Redis (Upstash)',        set: has(redisUrl) && has(redisTok),     required: true },
    { key: 'SESSION_SECRET',             label: 'Sessões (32+ chars)',    set: sessionOk,                          required: true },
    { key: 'CRON_SECRET',                label: 'Crons',                  set: has(process.env.CRON_SECRET),       required: true },
    { key: 'RESEND_API_KEY',             label: 'Envio de emails (Resend)', set: has(process.env.RESEND_API_KEY),  required: true },
    { key: 'TEAM_EMAILS',                label: 'Allowlist (seed)',       set: has(process.env.TEAM_EMAILS),       required: false },
    { key: 'APIFY_TOKEN',                label: 'Scraping (Apify)',       set: has(process.env.APIFY_TOKEN),       required: true },
    { key: 'GOOGLE_SERVICE_ACCOUNT_JSON', label: 'Sync de emails (Google)', set: has(process.env.GOOGLE_SERVICE_ACCOUNT_JSON), required: false },
  ];
}

// ───── Data / Redis health snapshot ─────

export async function getRebuildingState() {
  const r = getRedis();
  if (!r) return false;
  const v = await r.get('creators:idx:rebuilding').catch(() => null);
  return !!v;
}
