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

// Initialise the per-user stat row.
function emptyRow(userId, firstName) {
  return {
    userId,
    firstName: firstName || '—',
    creatorsAdded: 0,
    dmsSent: 0,
    emailsSent: 0,
    followUpsDone: 0,
    repliesReceived: 0,
    signed: 0,
  };
}

function bumpRow(rows, actor, key, increment = 1) {
  if (!actor?.userId) return;
  const id = actor.userId;
  if (!rows.has(id)) rows.set(id, emptyRow(id, actor.firstName));
  // Backfill firstName if we now have a real one and the row was created
  // from an event that didn't include it.
  if (actor.firstName && rows.get(id).firstName === '—') {
    rows.get(id).firstName = actor.firstName;
  }
  rows.get(id)[key] = (rows.get(id)[key] || 0) + increment;
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
