/**
 * Team stats — per-user activity counts across configurable time windows.
 *
 * Drives the /equipa dashboard and the daily DM scoreboard cron.
 *
 * Data sources (everything on the creator record):
 *   - creator.addedBy.{userId, firstName, at}                 → creators added
 *   - creator.outreach.dmSentAt + dmSentBy.{userId,firstName} → DMs sent
 *   - creator.outreach.emailSentAt + emailSentBy              → emails sent
 *   - creator.outreach.lastFollowUpAt + lastFollowUpBy        → follow-ups (most recent only)
 *   - creator.outreach.repliedAt + repliedMarkedBy            → replies recorded
 *
 * Time windows (Europe/Lisbon-anchored):
 *   - today  → from local 00:00 today
 *   - week   → from local 00:00 Monday this week
 *   - month  → from local 00:00 day 1 this month
 *   - all    → no lower bound
 *
 * Returns:
 *   [{ userId, firstName, creatorsAdded, dmsSent, emailsSent,
 *      followUpsDone, repliesReceived, signed, replyRate, signedRate }]
 */

import { listCreators, getCreator } from './creators';

const TIMEZONE = 'Europe/Lisbon';

// Get the start-of-window timestamp (UTC ms) for the given window key, anchored
// to Europe/Lisbon calendar boundaries.
function windowStart(windowKey, now = new Date()) {
  if (windowKey === 'all') return 0;
  // Pull the Lisbon-local date components out of `now` using Intl.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
  const y = Number(parts.year);
  const m = Number(parts.month);
  const d = Number(parts.day);

  if (windowKey === 'today') {
    return Date.UTC(y, m - 1, d) - lisbonOffsetMs(now);
  }
  if (windowKey === 'week') {
    // Monday-start week. Compute the day-of-week of the Lisbon-local date.
    const tmp = new Date(Date.UTC(y, m - 1, d));
    const dow = tmp.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysSinceMon = (dow + 6) % 7; // Mon=0, Sun=6
    return Date.UTC(y, m - 1, d - daysSinceMon) - lisbonOffsetMs(now);
  }
  if (windowKey === 'month') {
    return Date.UTC(y, m - 1, 1) - lisbonOffsetMs(now);
  }
  return 0;
}

// Compute the Lisbon UTC offset in milliseconds for the given moment.
// (Europe/Lisbon is +00:00 in winter, +01:00 in summer due to DST.)
function lisbonOffsetMs(now) {
  const localStr = now.toLocaleString('en-US', { timeZone: TIMEZONE });
  const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
  return new Date(localStr).getTime() - new Date(utcStr).getTime();
}

function inWindow(iso, startMs) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= startMs;
}

// Canonical key for grouping actors. Lowercased + diacritics stripped, so
// "Tomas" and "Tomás" collapse to the same key, AND a legacy backfill
// userId ("tomas-backfill") aggregates into the same row as the real
// session userId. Without this, the dashboard splits one person into two
// rows whenever a name has accents or the userId changed between writes.
function canonicalKey(firstName) {
  if (!firstName) return 'unknown';
  return String(firstName).toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim() || 'unknown';
}

// Initialise the per-user stat row. `userId` here is the canonical key,
// not the original userId — we use it only as a Map key for aggregation.
function emptyRow(key, firstName) {
  return {
    userId: key,
    firstName: firstName || '—',
    creatorsAdded: 0,
    dmsSent: 0,
    emailsSent: 0,
    followUpsDone: 0,
    repliesReceived: 0,
    signed: 0,
  };
}

function bumpRow(rows, actor, metricKey, increment = 1) {
  if (!actor?.userId && !actor?.firstName) return;
  const key = canonicalKey(actor.firstName);
  if (!rows.has(key)) rows.set(key, emptyRow(key, actor.firstName));
  // Prefer the accented display name when we see one — "Tomás" beats "Tomas"
  // for display while both still aggregate under canonical key "tomas".
  if (actor.firstName) {
    const current = rows.get(key).firstName;
    const incoming = actor.firstName;
    if (current === '—' || (incoming.normalize('NFD').length > current.normalize('NFD').length)) {
      rows.get(key).firstName = incoming;
    }
  }
  rows.get(key)[metricKey] = (rows.get(key)[metricKey] || 0) + increment;
}

/**
 * Compute per-user stats across all creators in the given time window.
 * @param {Object}  opts
 * @param {string}  opts.window - 'today' | 'week' | 'month' | 'all'
 * @param {Date}    [opts.now]  - clock override (used by the cron + tests)
 */
export async function getTeamStats({ window = 'today', now = new Date() } = {}) {
  const startMs = windowStart(window, now);
  const summaries = await listCreators();
  // We need the FULL creator to access outreach + addedBy. Summaries don't
  // carry those fields, so fetch each one. This is O(N) reads but for a
  // small team CRM (hundreds of creators) it's fine. If the index grows
  // past ~2K creators, denormalise into the summary index.
  const fulls = await Promise.all(summaries.map(s => getCreator(s.id)));
  const rows = new Map();

  for (const c of fulls) {
    if (!c) continue;
    const o = c.outreach || {};
    // Creators added
    if (c.addedBy?.userId && inWindow(c.addedBy.at, startMs)) {
      bumpRow(rows, c.addedBy, 'creatorsAdded');
    }
    // DMs sent
    if (o.dmSentAt && inWindow(o.dmSentAt, startMs)) {
      bumpRow(rows, o.dmSentBy || c.addedBy, 'dmsSent');
    }
    // Emails sent
    if (o.emailSentAt && inWindow(o.emailSentAt, startMs)) {
      bumpRow(rows, o.emailSentBy || c.addedBy, 'emailsSent');
    }
    // Follow-ups done — we only have the most-recent timestamp, so this
    // under-counts when a single operator hits multiple follow-ups in one
    // window. Acceptable tradeoff for v1 (operators rarely do >1 follow-up
    // per creator per day).
    if (o.lastFollowUpAt && inWindow(o.lastFollowUpAt, startMs)) {
      bumpRow(rows, o.lastFollowUpBy || c.addedBy, 'followUpsDone');
    }
    // Replies received (operator-marked)
    if (o.repliedAt && inWindow(o.repliedAt, startMs)) {
      bumpRow(rows, o.repliedMarkedBy || c.addedBy, 'repliesReceived');
    }
    // Signed — attributed to whoever added the creator (handoffs aren't tracked).
    if (c.pipelineStatus === 'signed' && c.signedAt && inWindow(c.signedAt, startMs)) {
      bumpRow(rows, c.addedBy, 'signed');
    }
  }

  // Compute derived rates after all aggregation.
  const out = Array.from(rows.values()).map(r => ({
    ...r,
    replyRate: r.dmsSent > 0 ? Math.round((r.repliesReceived / r.dmsSent) * 100) : 0,
    signedRate: r.repliesReceived > 0 ? Math.round((r.signed / r.repliesReceived) * 100) : 0,
  }));
  out.sort((a, b) => (b.dmsSent || 0) - (a.dmsSent || 0));
  return out;
}

/**
 * Daily DM scoreboard for the accountability email. Returns the same shape
 * as getTeamStats but adds `missedGoal` (true if dmsSent < target) and
 * `owesEach` (the €50 split: missed people owe to those who hit the goal,
 * split evenly).
 *
 * @param {number} target  - DM goal per person (default 30)
 * @param {Date}   now     - clock override
 */
export async function getDailyScoreboard({ target = 30, now = new Date() } = {}) {
  const rows = await getTeamStats({ window: 'today', now });
  const winners = rows.filter(r => r.dmsSent >= target);
  const losers = rows.filter(r => r.dmsSent < target);
  return rows.map(r => ({
    ...r,
    target,
    missedGoal: r.dmsSent < target,
    // Each loser owes €50 to each winner. If 0 winners (all missed), no debts.
    owesEachWinnerEur: r.dmsSent < target && winners.length > 0 ? 50 : 0,
    earnsFromEachLoserEur: r.dmsSent >= target && losers.length > 0 ? 50 : 0,
    totalOwedEur: r.dmsSent < target ? winners.length * 50 : 0,
    totalEarnedEur: r.dmsSent >= target ? losers.length * 50 : 0,
  }));
}

// ──────────────────────────────────────────────────────────────────
// Extended dashboard helpers — funnel, streak, velocity, pipeline,
// quality breakdowns, monthly €50 tally, week-over-week deltas,
// revenue forecast, needs-attention items.
// ──────────────────────────────────────────────────────────────────

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Convenience accessor: pull every full creator record. Used by the
// dashboard endpoint which needs the entire dataset to compute multiple
// views in one pass. ~hundreds of records for a small CRM = single sweep.
async function loadAllCreators() {
  const summaries = await listCreators();
  const fulls = await Promise.all(summaries.map(s => getCreator(s.id)));
  return fulls.filter(Boolean);
}

// Returns { startMs, endMs } for a single Europe/Lisbon calendar day.
function lisbonDayBounds(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  const y = Number(parts.year);
  const m = Number(parts.month);
  const d = Number(parts.day);
  const offset = lisbonOffsetMs(date);
  const startMs = Date.UTC(y, m - 1, d) - offset;
  return { startMs, endMs: startMs + DAY_MS };
}

// FUNNEL — added → DMs → replies → signed (all-time, attributable to
// the original adder). Conversion percentages between each step.
export async function getFunnels(creators) {
  const all = creators || await loadAllCreators();
  const byUser = new Map();
  for (const c of all) {
    if (!c.addedBy) continue;
    const key = canonicalKey(c.addedBy.firstName);
    if (!byUser.has(key)) byUser.set(key, { firstName: c.addedBy.firstName, added: 0, dmd: 0, replied: 0, signed: 0 });
    const row = byUser.get(key);
    row.added += 1;
    if (c.outreach?.dmSentAt) row.dmd += 1;
    if (c.outreach?.repliedAt) row.replied += 1;
    if (c.pipelineStatus === 'signed') row.signed += 1;
  }
  return Array.from(byUser.entries()).map(([key, r]) => ({
    userId: key,
    firstName: r.firstName,
    added: r.added,
    dmd: r.dmd,
    replied: r.replied,
    signed: r.signed,
    addedToDmRate: r.added > 0 ? Math.round((r.dmd / r.added) * 100) : 0,
    dmToReplyRate: r.dmd > 0 ? Math.round((r.replied / r.dmd) * 100) : 0,
    replyToSignedRate: r.replied > 0 ? Math.round((r.signed / r.replied) * 100) : 0,
    overallRate: r.added > 0 ? Math.round((r.signed / r.added) * 100) : 0,
  }));
}

// STREAK — count of consecutive recent weekdays (Mon-Fri) where each
// person sent ≥ target DMs. Walks backwards from yesterday (or today
// if hour ≥ 23 Lisbon, meaning the day is effectively done). Skips
// weekends — they don't count toward or break the streak.
export async function getStreaks({ target = 30, now = new Date() } = {}) {
  const all = await loadAllCreators();
  // Build daily totals per user, keyed by Lisbon date (YYYY-MM-DD).
  const dailyByUser = new Map();
  for (const c of all) {
    const at = c.outreach?.dmSentAt;
    if (!at) continue;
    const actor = c.outreach?.dmSentBy || c.addedBy;
    if (!actor) continue;
    const key = canonicalKey(actor.firstName);
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date(at));
    if (!dailyByUser.has(key)) dailyByUser.set(key, { firstName: actor.firstName, daily: new Map() });
    const u = dailyByUser.get(key);
    u.daily.set(dateStr, (u.daily.get(dateStr) || 0) + 1);
  }
  const out = [];
  for (const [key, u] of dailyByUser.entries()) {
    let streak = 0;
    let cursor = new Date(now);
    // If it's before 23:00 Lisbon, today isn't done yet — start from yesterday.
    const lisbonHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }).format(now));
    if (lisbonHour < 23) cursor = new Date(cursor.getTime() - DAY_MS);
    // Walk backwards up to 60 weekdays.
    for (let i = 0; i < 60; i++) {
      const dow = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, weekday: 'short' }).format(cursor) === 'Sun' ? 0 : 1); // placeholder
      // Need the actual day-of-week from Lisbon-local date.
      const localDate = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(cursor));
      const day = localDate.getUTCDay(); // 0=Sun, 6=Sat
      if (day === 0 || day === 6) { cursor = new Date(cursor.getTime() - DAY_MS); continue; }
      const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(cursor);
      const count = u.daily.get(dateStr) || 0;
      if (count >= target) {
        streak += 1;
        cursor = new Date(cursor.getTime() - DAY_MS);
      } else break;
    }
    out.push({ userId: key, firstName: u.firstName, streak });
  }
  return out;
}

// PIPELINE HEALTH — per-user breakdown of in-flight conversations.
//   active:   DM sent, no reply yet, not cold/signed
//   awaiting: DM sent within last 7 days, no reply
//   stale:    DM sent > 14 days ago, no reply, no recent follow-up
//   inProgressOffer: creator.offer exists but not signed
export async function getPipelineHealth({ now = new Date() } = {}) {
  const all = await loadAllCreators();
  const nowMs = now.getTime();
  const byUser = new Map();
  for (const c of all) {
    if (!c.addedBy) continue;
    const key = canonicalKey(c.addedBy.firstName);
    if (!byUser.has(key)) byUser.set(key, { firstName: c.addedBy.firstName, active: 0, awaiting: 0, stale: 0, inProgressOffer: 0 });
    const u = byUser.get(key);
    const o = c.outreach || {};
    const isCold = c.pipelineStatus === 'cold';
    const isSigned = c.pipelineStatus === 'signed';
    if (!o.dmSentAt || isCold || isSigned) continue;
    if (!o.repliedAt) {
      u.active += 1;
      const dmSentMs = new Date(o.dmSentAt).getTime();
      const lastTouchMs = Math.max(dmSentMs, o.lastFollowUpAt ? new Date(o.lastFollowUpAt).getTime() : 0);
      const daysSinceTouch = (nowMs - lastTouchMs) / DAY_MS;
      if (daysSinceTouch <= 7) u.awaiting += 1;
      if (daysSinceTouch > 14) u.stale += 1;
    }
    if (c.offer && !isSigned) u.inProgressOffer += 1;
  }
  return Array.from(byUser.entries()).map(([key, u]) => ({ userId: key, ...u }));
}

// VELOCITY — average time-to-action per user. Three metrics:
//   added → dm (hours): how fast they DM after adding
//   replied → followUp (hours): how fast they follow up after a reply
//   firstDm → signed (days): full cycle time
export async function getVelocity() {
  const all = await loadAllCreators();
  const byUser = new Map();
  for (const c of all) {
    if (!c.addedBy) continue;
    const key = canonicalKey(c.addedBy.firstName);
    if (!byUser.has(key)) byUser.set(key, { firstName: c.addedBy.firstName, addedToDm: [], repliedToFollow: [], firstDmToSigned: [] });
    const u = byUser.get(key);
    const o = c.outreach || {};
    if (c.addedBy.at && o.dmSentAt) {
      u.addedToDm.push((new Date(o.dmSentAt).getTime() - new Date(c.addedBy.at).getTime()) / HOUR_MS);
    }
    if (o.repliedAt && o.lastFollowUpAt && new Date(o.lastFollowUpAt) > new Date(o.repliedAt)) {
      u.repliedToFollow.push((new Date(o.lastFollowUpAt).getTime() - new Date(o.repliedAt).getTime()) / HOUR_MS);
    }
    if (o.dmSentAt && c.pipelineStatus === 'signed' && c.signedAt) {
      u.firstDmToSigned.push((new Date(c.signedAt).getTime() - new Date(o.dmSentAt).getTime()) / DAY_MS);
    }
  }
  const avg = (arr) => arr.length === 0 ? null : Math.round(arr.reduce((s, x) => s + x, 0) / arr.length * 10) / 10;
  return Array.from(byUser.entries()).map(([key, u]) => ({
    userId: key,
    firstName: u.firstName,
    avgAddedToDmHours: avg(u.addedToDm),
    avgRepliedToFollowHours: avg(u.repliedToFollow),
    avgFirstDmToSignedDays: avg(u.firstDmToSigned),
  }));
}

// REPLY-RATE BREAKDOWNS — by DM template (A vs B), by creator language,
// and by creator pricing tier. Helps each person see what's working.
export async function getQualityBreakdowns() {
  const all = await loadAllCreators();
  const byUser = new Map();
  function bucket(user, dim, value, isReply) {
    const key = canonicalKey(user.firstName);
    if (!byUser.has(key)) byUser.set(key, { firstName: user.firstName, byTemplate: {}, byLanguage: {}, byTier: {} });
    const u = byUser.get(key);
    if (!u[dim][value]) u[dim][value] = { sent: 0, replied: 0 };
    u[dim][value].sent += 1;
    if (isReply) u[dim][value].replied += 1;
  }
  for (const c of all) {
    const o = c.outreach || {};
    if (!o.dmSentAt) continue;
    const user = o.dmSentBy || c.addedBy;
    if (!user) continue;
    const replied = !!o.repliedAt;
    const template = c.dmSequence?.template || 'A';
    const lang = c.primaryLanguage || 'pt';
    const tier = c.offer?.client_facing_output?.pricing_tier || 'unknown';
    bucket(user, 'byTemplate', template, replied);
    bucket(user, 'byLanguage', lang, replied);
    bucket(user, 'byTier', tier, replied);
  }
  const pct = (s, r) => s > 0 ? Math.round((r / s) * 100) : 0;
  return Array.from(byUser.entries()).map(([key, u]) => {
    const flatten = (group) => Object.entries(group).map(([k, v]) => ({ key: k, sent: v.sent, replied: v.replied, rate: pct(v.sent, v.replied) }));
    return {
      userId: key,
      firstName: u.firstName,
      byTemplate: flatten(u.byTemplate),
      byLanguage: flatten(u.byLanguage),
      byTier: flatten(u.byTier),
    };
  });
}

// €50 MONTHLY TALLY — walks every weekday in the current month, computes
// each day's scoreboard, sums per-user wins/losses. Settlement = net.
export async function getMonthlyTally({ target = 30, now = new Date() } = {}) {
  const lisbonStart = windowStart('month', now);
  const totals = new Map(); // canonicalKey → { firstName, daysHit, daysMissed, earned, owed }
  const cursor = new Date(lisbonStart);
  while (cursor.getTime() <= now.getTime()) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      const dayEnd = new Date(cursor.getTime() + DAY_MS);
      // Stats for this single Lisbon day
      const board = await getDailyScoreboard({ target, now: dayEnd });
      for (const r of board) {
        const k = r.userId;
        if (!totals.has(k)) totals.set(k, { userId: k, firstName: r.firstName, daysHit: 0, daysMissed: 0, totalEarnedEur: 0, totalOwedEur: 0 });
        const t = totals.get(k);
        if (r.missedGoal) {
          t.daysMissed += 1;
          t.totalOwedEur += r.totalOwedEur || 0;
        } else if (r.dmsSent > 0) {
          t.daysHit += 1;
          t.totalEarnedEur += r.totalEarnedEur || 0;
        }
      }
    }
    cursor.setTime(cursor.getTime() + DAY_MS);
  }
  return Array.from(totals.values()).map(t => ({ ...t, netEur: t.totalEarnedEur - t.totalOwedEur }));
}

// NEEDS ATTENTION — surface concrete to-dos for the team.
export async function getNeedsAttention({ now = new Date(), dailyTarget = 30 } = {}) {
  const all = await loadAllCreators();
  const items = [];
  const nowMs = now.getTime();
  // Stale active conversations (>14 days no follow-up, no reply yet)
  let stale = 0;
  const staleByUser = new Map();
  for (const c of all) {
    const o = c.outreach || {};
    if (!o.dmSentAt || o.repliedAt || c.pipelineStatus === 'cold' || c.pipelineStatus === 'signed') continue;
    const lastTouchMs = Math.max(
      new Date(o.dmSentAt).getTime(),
      o.lastFollowUpAt ? new Date(o.lastFollowUpAt).getTime() : 0
    );
    if ((nowMs - lastTouchMs) / DAY_MS > 14) {
      stale += 1;
      const k = canonicalKey(c.addedBy?.firstName);
      staleByUser.set(k, (staleByUser.get(k) || 0) + 1);
    }
  }
  if (stale > 0) {
    const breakdown = Array.from(staleByUser.entries()).map(([k, n]) => `${k}: ${n}`).join(', ');
    items.push({ severity: 'warn', text: `${stale} conversa${stale === 1 ? '' : 's'} parada${stale === 1 ? '' : 's'} (>14 dias). ${breakdown}.` });
  }
  // Replies sitting without a follow-up after 2+ days
  let waiting = 0;
  for (const c of all) {
    const o = c.outreach || {};
    if (!o.repliedAt) continue;
    const repliedMs = new Date(o.repliedAt).getTime();
    const followMs = o.lastFollowUpAt ? new Date(o.lastFollowUpAt).getTime() : 0;
    if (followMs > repliedMs) continue; // already followed up
    if (c.pipelineStatus === 'signed' || c.pipelineStatus === 'cold') continue;
    if ((nowMs - repliedMs) / DAY_MS > 2) waiting += 1;
  }
  if (waiting > 0) {
    items.push({ severity: 'info', text: `${waiting} resposta${waiting === 1 ? '' : 's'} sem follow-up há mais de 2 dias.` });
  }
  // Today's pace vs target (assumes Lisbon day)
  const today = await getDailyScoreboard({ target: dailyTarget, now });
  const behindAt = today.filter(r => r.dmsSent < dailyTarget);
  const lisbonHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }).format(now));
  if (behindAt.length > 0 && lisbonHour < 23) {
    const hoursLeft = 23 - lisbonHour;
    behindAt.forEach(r => {
      const remaining = dailyTarget - r.dmsSent;
      items.push({ severity: 'danger', text: `${r.firstName} precisa de ${remaining} DM${remaining === 1 ? '' : 's'} (${hoursLeft}h até ao fim do dia).` });
    });
  }
  return items;
}

// IMPROVEMENT DELTAS — compare current period vs prior equal period.
// e.g. this week's stats vs last week's. Useful for "am I getting better?".
export async function getDeltas({ window = 'week', now = new Date() } = {}) {
  const current = await getTeamStats({ window, now });
  const periodMs = window === 'week' ? 7 * DAY_MS : 30 * DAY_MS; // approximation
  const priorNow = new Date(now.getTime() - periodMs);
  const prior = await getTeamStats({ window, now: priorNow });
  const priorByKey = new Map(prior.map(r => [r.userId, r]));
  return current.map(r => {
    const p = priorByKey.get(r.userId);
    if (!p) return { ...r, deltaDmsSent: null, deltaReplyRate: null, deltaSigned: null };
    return {
      ...r,
      deltaDmsSent: r.dmsSent - (p.dmsSent || 0),
      deltaReplyRate: r.replyRate - (p.replyRate || 0),
      deltaSigned: r.signed - (p.signed || 0),
    };
  });
}

// REVENUE FORECAST — projected annual revenue per user, weighted by
// stage probability. Signed = 100%, replied = 30%, dm sent = 10%, added = 2%.
// Uses calculateOfferRevenue if the creator has an offer, else falls back
// to revenuePrice × scenario.
export async function getRevenueForecast() {
  const { calculateOfferRevenue } = await import('./revenue');
  const all = await loadAllCreators();
  const byUser = new Map();
  const probability = (c) => {
    if (c.pipelineStatus === 'signed') return 1.0;
    if (c.outreach?.repliedAt) return 0.30;
    if (c.outreach?.dmSentAt) return 0.10;
    return 0.02;
  };
  for (const c of all) {
    if (!c.addedBy) continue;
    if (c.pipelineStatus === 'cold') continue;
    const key = canonicalKey(c.addedBy.firstName);
    if (!byUser.has(key)) byUser.set(key, { firstName: c.addedBy.firstName, signedAnnual: 0, weightedAnnual: 0 });
    const u = byUser.get(key);
    const offer = c.offer?.client_facing_output;
    if (!offer?.target_price) continue;
    try {
      const r = calculateOfferRevenue({ offer, creator: c, scenarioKey: 'moderado' });
      const annual = r.annualRevenue || 0;
      const p = probability(c);
      u.weightedAnnual += annual * p;
      if (p === 1.0) u.signedAnnual += annual;
    } catch {
      // Skip creators where the offer schema doesn't parse cleanly.
    }
  }
  return Array.from(byUser.entries()).map(([key, u]) => ({
    userId: key,
    firstName: u.firstName,
    signedAnnualEur: Math.round(u.signedAnnual),
    pipelineWeightedAnnualEur: Math.round(u.weightedAnnual),
  }));
}
