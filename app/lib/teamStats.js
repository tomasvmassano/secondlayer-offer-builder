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
import { stageEntries, STAGES, STAGE_KEYS } from './outreachStages';

const TIMEZONE = 'Europe/Lisbon';

// ─────────────────────────────────────────────────────────────────────
// STATS RESET POINT
// All aggregations ignore events with timestamps BEFORE this date. The
// historical data stays on each creator record — we just don't count
// it for dashboard purposes, so the competition starts with a clean
// slate. To re-reset later, set RESET_AT to a new ISO timestamp here
// or via the STATS_RESET_AT env var (overrides this constant).
// ─────────────────────────────────────────────────────────────────────
const RESET_AT_DEFAULT = '2026-05-19T00:00:00.000Z';
function statsResetMs() {
  const raw = process.env.STATS_RESET_AT || RESET_AT_DEFAULT;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

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
  if (windowKey === 'yesterday') {
    // Start of the Lisbon day BEFORE the one containing `now`. Used by the
    // 4am EOD cron — when the cron fires at Friday 04:00 Lisbon, "yesterday"
    // means Thursday 00:00 Lisbon. Combined with the (already-existing)
    // open-ended inWindow() check, this captures Thursday's full day PLUS
    // any post-midnight overflow from Friday 00:00–04:00, which is the
    // whole point of moving the EOD cron later: late-night DMs count
    // toward yesterday's scoreboard.
    return Date.UTC(y, m - 1, d - 1) - lisbonOffsetMs(now);
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
  if (windowKey === 'quarter') {
    // Start of the current calendar quarter (QTD). m is 1-12.
    const qStartMonth = m - ((m - 1) % 3); // 1,4,7,10
    return Date.UTC(y, qStartMonth - 1, 1) - lisbonOffsetMs(now);
  }
  if (windowKey === 'ytd') {
    return Date.UTC(y, 0, 1) - lisbonOffsetMs(now); // Jan 1, Lisbon
  }
  if (windowKey === '30d' || windowKey === '90d') {
    // Rolling window: N days back from now (not calendar-anchored).
    const days = windowKey === '30d' ? 30 : 90;
    return now.getTime() - days * 86_400_000;
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

// UTC ms at Lisbon-local 00:00 of the given calendar day (month is 1-12).
// Date.UTC handles day overflow (e.g. d+1 rolling into the next month).
function lisbonDayBoundaryMs(y, m, d) {
  const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return Date.UTC(y, m - 1, d) - lisbonOffsetMs(noon);
}

// Resolve a window into explicit [startMs, endMs) bounds. When `from`/`to`
// (YYYY-MM-DD Lisbon calendar days) are BOTH supplied, they override the named
// window with a custom range: start = 00:00 of `from`, end = 00:00 of the day
// AFTER `to` (exclusive, so the whole `to` day counts). Otherwise falls back to
// the named-window start, with the strict upper bound only 'yesterday' needs.
function windowBounds(windowKey, now = new Date(), from = null, to = null) {
  if (from && to) {
    const [fy, fm, fd] = String(from).split('-').map(Number);
    const [ty, tm, td] = String(to).split('-').map(Number);
    return {
      startMs: lisbonDayBoundaryMs(fy, fm, fd),
      endMs: lisbonDayBoundaryMs(ty, tm, td + 1),
    };
  }
  return {
    startMs: windowStart(windowKey, now),
    endMs: windowKey === 'yesterday' ? windowStart('today', now) : null,
  };
}

function inWindow(iso, startMs, endMs = null) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  // Hard floor: ignore anything before the global reset point. Keeps
  // the dashboard's competition view clean of legacy data even when
  // a window like 'all' would otherwise include everything.
  if (t < statsResetMs()) return false;
  if (t < startMs) return false;
  // Strict upper bound — only set for 'yesterday', so events that
  // crossed midnight don't double-count between today's and yesterday's
  // views on the dashboard. Open-ended (null) for today/week/month/all.
  if (endMs !== null && t >= endMs) return false;
  return true;
}

// Same as inWindow but without the upper window — for aggregations that
// look at all events post-reset (funnels, pipeline, velocity, quality, etc.)
function postReset(iso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= statsResetMs();
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
    // Outreach touches — unique creators where this operator sent at least
    // one channel (DM or email) within the window. Same creator + same day
    // touched on both channels still counts as 1. Drives the €50 daily rule.
    touchesSent: 0,
    followUpsDone: 0,
    // Follow-ups split by channel so the dashboard can show which channel
    // gets used more / converts better at the nurture stage.
    followUpsDm: 0,
    followUpsEmail: 0,
    repliesReceived: 0,
    // Replies split by channel — the headline insight for "where do replies
    // actually come from".
    repliesViaDm: 0,
    repliesViaEmail: 0,
    // Videos: requests (a reply where the creator asked for/accepted the video)
    // and sends (the generic video actually delivered). videosSent is the
    // volume-model touchpoint that precedes booking.
    videosRequested: 0,
    videosSent: 0,
    // Meetings booked (call agreed/booked) — the operator-table "Reuniões".
    reunioesMarcadas: 0,
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
export async function getTeamStats({ window = 'today', now = new Date(), from = null, to = null } = {}) {
  // Yesterday needs a strict upper bound (events after midnight belong to
  // today, not yesterday); a custom from/to range carries its own [start,end);
  // every other named window is open-ended (runs to "now").
  const { startMs, endMs } = windowBounds(window, now, from, to);
  // Shared, memoised load — one read of all records per request, reused by
  // every aggregation in the /equipa fan-out.
  const fulls = await loadAllCreators();
  const rows = new Map();

  for (const c of fulls) {
    if (!c) continue;
    const o = c.outreach || {};
    // Creators added
    if (c.addedBy?.userId && inWindow(c.addedBy.at, startMs, endMs)) {
      bumpRow(rows, c.addedBy, 'creatorsAdded');
    }
    // DMs sent
    const dmInWindow = o.dmSentAt && inWindow(o.dmSentAt, startMs, endMs);
    if (dmInWindow) {
      bumpRow(rows, o.dmSentBy || c.addedBy, 'dmsSent');
    }
    // Emails sent
    const emailInWindow = o.emailSentAt && inWindow(o.emailSentAt, startMs, endMs);
    if (emailInWindow) {
      bumpRow(rows, o.emailSentBy || c.addedBy, 'emailsSent');
    }
    // Outreach touches — unique-creator count. If both DM and email landed
    // in this window for the same creator, the creator counts as ONE touch.
    // Attribute to whichever operator did the earlier send (or just the DM
    // sender if both happened; falls back to email sender then addedBy).
    if (dmInWindow || emailInWindow) {
      const touchActor = (dmInWindow ? (o.dmSentBy || c.addedBy) : null)
        || (emailInWindow ? (o.emailSentBy || c.addedBy) : null)
        || c.addedBy;
      bumpRow(rows, touchActor, 'touchesSent');
    }
    // Follow-ups — prefer the new array (channel-tagged) when present.
    // Falls back to the legacy lastFollowUpAt + counter for old records
    // that haven't been backfilled yet.
    if (Array.isArray(o.followUps) && o.followUps.length > 0) {
      for (const f of o.followUps) {
        if (!f?.at || !inWindow(f.at, startMs, endMs)) continue;
        const actor = f.by || c.addedBy;
        bumpRow(rows, actor, 'followUpsDone');
        if (f.channel === 'dm') bumpRow(rows, actor, 'followUpsDm');
        else if (f.channel === 'email') bumpRow(rows, actor, 'followUpsEmail');
        // channel === 'unknown' (legacy backfill) only bumps followUpsDone
      }
    } else if (o.lastFollowUpAt && inWindow(o.lastFollowUpAt, startMs, endMs)) {
      bumpRow(rows, o.lastFollowUpBy || c.addedBy, 'followUpsDone');
    }
    // Replies received (operator-marked). Split by channel.
    if (o.repliedAt && inWindow(o.repliedAt, startMs, endMs)) {
      const actor = o.repliedMarkedBy || c.addedBy;
      bumpRow(rows, actor, 'repliesReceived');
      if (o.repliedChannel === 'dm') bumpRow(rows, actor, 'repliesViaDm');
      else if (o.repliedChannel === 'email') bumpRow(rows, actor, 'repliesViaEmail');
    }
    // Video requested — a reply where the creator asked for / accepted the
    // generic video. Attributed to whoever marked it (falls back to the reply
    // marker, then addedBy).
    if (o.videoRequestedAt && inWindow(o.videoRequestedAt, startMs, endMs)) {
      bumpRow(rows, o.videoRequestedBy || o.repliedMarkedBy || c.addedBy, 'videosRequested');
    }
    // Video sent — the generic video actually delivered after the reply.
    if (o.videoSentAt && inWindow(o.videoSentAt, startMs, endMs)) {
      bumpRow(rows, o.videoSentBy || c.addedBy, 'videosSent');
    }
    // Meetings booked — attributed to whoever added the creator.
    const marcadaAt = o.callBookedAt || o.callAgreedAt || null;
    if (marcadaAt && inWindow(marcadaAt, startMs, endMs)) {
      bumpRow(rows, c.addedBy, 'reunioesMarcadas');
    }
    // Signed — attributed to whoever added the creator (handoffs aren't tracked).
    if (c.pipelineStatus === 'signed' && c.signedAt && inWindow(c.signedAt, startMs, endMs)) {
      bumpRow(rows, c.addedBy, 'signed');
    }
  }

  // Compute derived rates after all aggregation.
  // replyRate is now the COMBINED rate (any channel reply / unique touches)
  // so the headline reflects the channel-mix reality. Per-channel rates
  // surface as dmReplyRate / emailReplyRate.
  const out = Array.from(rows.values()).map(r => ({
    ...r,
    replyRate: r.touchesSent > 0 ? Math.round((r.repliesReceived / r.touchesSent) * 100) : 0,
    dmReplyRate: r.dmsSent > 0 ? Math.round((r.repliesViaDm / r.dmsSent) * 100) : 0,
    emailReplyRate: r.emailsSent > 0 ? Math.round((r.repliesViaEmail / r.emailsSent) * 100) : 0,
    signedRate: r.repliesReceived > 0 ? Math.round((r.signed / r.repliesReceived) * 100) : 0,
  }));
  // Sort by touches (the new headline metric for activity) instead of dms.
  out.sort((a, b) => (b.touchesSent || 0) - (a.touchesSent || 0));
  return out;
}

/**
 * Daily DM scoreboard for the accountability email. Returns the same shape
 * as getTeamStats but adds `missedGoal` (true if dmsSent < target) and
 * `owesEach` (the €50 split: missed people owe to those who hit the goal,
 * split evenly).
 *
 * Weekend exemption (added 2026-05-23): when the reported day is a Saturday
 * or Sunday in Lisbon time, the 40/day rule doesn't apply. Every row has
 * missedGoal=false, €50 amounts zeroed, and a new `isWeekend` flag set.
 * Callers can read isWeekend to render a "weekend — no target" banner
 * instead of "0/40 falhou". The EOD cron schedule (Tue-Sat) already only
 * reports on Mon-Fri so this mostly matters for the team dashboard
 * showing "today" on Saturday/Sunday.
 *
 * @param {number} target     - DM goal per person (default 40)
 * @param {Date}   now        - clock override
 * @param {string} windowKey  - 'today' (legacy default) or 'yesterday'.
 */
export async function getDailyScoreboard({ target = 40, now = new Date(), windowKey = 'today' } = {}) {
  const rows = await getTeamStats({ window: windowKey, now });

  // Compute the calendar day this scoreboard refers to in Lisbon timezone,
  // then check if it's a weekend. For windowKey='yesterday' we look at the
  // day BEFORE now; otherwise we use now itself. Saturday=6, Sunday=0.
  const refDate = windowKey === 'yesterday'
    ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
    : now;
  const lisbonWeekday = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
  }).format(refDate);
  const isWeekend = lisbonWeekday === 'Sat' || lisbonWeekday === 'Sun';

  if (isWeekend) {
    // Weekend rest day — no 40/day rule, no €50, no "falhou" labels.
    // touchesSent / dmsSent / etc. still flow through honestly so the
    // operator can see whatever activity happened, just without
    // accountability framing.
    return rows.map(r => ({
      ...r,
      target,
      missedGoal: false,
      owesEachWinnerEur: 0,
      earnsFromEachLoserEur: 0,
      totalOwedEur: 0,
      totalEarnedEur: 0,
      isWeekend: true,
    }));
  }

  // Daily target gates on `touchesSent` (unique creators contacted via DM
  // and/or email) instead of `dmsSent`. Sending DM + email to the same
  // creator counts as ONE touch — the operator can't game the rule by
  // double-touching everyone. Same €50 split logic.
  const winners = rows.filter(r => r.touchesSent >= target);
  const losers = rows.filter(r => r.touchesSent < target);
  return rows.map(r => ({
    ...r,
    target,
    missedGoal: r.touchesSent < target,
    owesEachWinnerEur: r.touchesSent < target && winners.length > 0 ? 50 : 0,
    earnsFromEachLoserEur: r.touchesSent >= target && losers.length > 0 ? 50 : 0,
    totalOwedEur: r.touchesSent < target ? winners.length * 50 : 0,
    totalEarnedEur: r.touchesSent >= target ? losers.length * 50 : 0,
    isWeekend: false,
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
// Load every full creator record. Memoised for a short TTL so that ONE
// /equipa request — which fans out ~24 aggregations that each need the full
// set — reads the 1,376 records ONCE instead of ~24 times. The window a caller
// asks for doesn't change the underlying records (only how they're filtered),
// so the same load safely serves every window computed in the same burst.
// Bounded staleness (15s) is irrelevant next to the 5-min response cache.
let _loadMemo = null; // { at: ms, promise: Promise<creators[]> }
const LOAD_MEMO_TTL_MS = 15_000;
async function loadAllCreators() {
  if (_loadMemo && (Date.now() - _loadMemo.at) < LOAD_MEMO_TTL_MS) {
    return _loadMemo.promise;
  }
  const promise = (async () => {
    const summaries = await listCreators();
    const fulls = await Promise.all(summaries.map(s => getCreator(s.id)));
    return fulls.filter(Boolean);
  })();
  _loadMemo = { at: Date.now(), promise };
  // On failure, drop the memo so the next request retries instead of caching a rejection.
  promise.catch(() => { if (_loadMemo?.promise === promise) _loadMemo = null; });
  return promise;
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

// PER-PERSON FUNNEL — same architecture as the team funnel, split by the
// creator's owner (addedBy): Contactos → Respostas → Pediu vídeo → Reuniões
// marcadas → Reuniões realizadas → Propostas → Negócios. Each stage counts a
// creator when that stage's timestamp falls in the window; owners with zero
// activity in the window are dropped.
export async function getFunnels(creators, { window = 'all', now = new Date(), from = null, to = null } = {}) {
  const { startMs, endMs } = windowBounds(window, now, from, to);
  const inWin = (iso) => inWindow(iso, startMs, endMs);
  const all = creators || await loadAllCreators();
  const byUser = new Map();
  for (const c of all) {
    const owner = c.addedBy;
    if (!owner?.firstName) continue;
    const key = canonicalKey(owner.firstName);
    if (!byUser.has(key)) byUser.set(key, { firstName: owner.firstName, contactos: 0, respostas: 0, pediuVideo: 0, reunioesMarcadas: 0, reunioesRealizadas: 0, propostas: 0, negocios: 0 });
    const row = byUser.get(key);
    const o = c.outreach || {};
    const contactoAt = o.dmSentAt || o.emailSentAt || null;
    const marcadaAt  = o.callBookedAt || o.callAgreedAt || null;
    const propostaAt = c.pitch?.sentAt || null;
    if (inWin(contactoAt))        row.contactos += 1;
    if (inWin(o.repliedAt))       row.respostas += 1;
    if (inWin(o.videoRequestedAt)) row.pediuVideo += 1;
    if (inWin(marcadaAt))         row.reunioesMarcadas += 1;
    if (inWin(o.callHeldAt))      row.reunioesRealizadas += 1;
    if (inWin(propostaAt))        row.propostas += 1;
    if (c.pipelineStatus === 'signed' && inWin(c.signedAt)) row.negocios += 1;
  }
  const pct = (num, den) => den > 0 ? Math.round((num / den) * 100) : 0;
  return Array.from(byUser.entries())
    .map(([key, r]) => ({
      userId: key,
      firstName: r.firstName,
      contactos: r.contactos,
      respostas: r.respostas,
      pediuVideo: r.pediuVideo,
      reunioesMarcadas: r.reunioesMarcadas,
      reunioesRealizadas: r.reunioesRealizadas,
      propostas: r.propostas,
      negocios: r.negocios,
      rates: {
        contactoToResposta:  pct(r.respostas, r.contactos),
        respostaToVideo:     pct(r.pediuVideo, r.respostas),
        videoToMarcada:      pct(r.reunioesMarcadas, r.pediuVideo),
        marcadaToRealizada:  pct(r.reunioesRealizadas, r.reunioesMarcadas),
        realizadaToProposta: pct(r.propostas, r.reunioesRealizadas),
        propostaToNegocio:   pct(r.negocios, r.propostas),
      },
      overallRate: pct(r.negocios, r.contactos),
    }))
    .filter(r => (r.contactos + r.respostas + r.pediuVideo + r.reunioesMarcadas + r.reunioesRealizadas + r.propostas + r.negocios) > 0);
}

// TEAM FUNNEL — the full sales funnel, aggregated across the whole team
// (one funnel, not one per person). Every stage is DERIVED from timestamps
// the CRM already stamps as operators work the Kanban — nothing is entered
// by hand. A creator counts toward a stage if that stage's timestamp falls
// inside the window. Stages follow Tomás's playbook:
//   Contactos → Conversas reais → Reuniões marcadas → Reuniões realizadas
//   → Propostas apresentadas → Negócios
// Signals:  contacto = dm/email sent · conversa = replied · marcada =
//   call booked/agreed · realizada = call held · proposta = pitch.sentAt ·
//   negócio = signed. Powers the /equipa "Funil de vendas" block AND the
//   real-rate pre-fill for the target calculator.
export async function getTeamFunnel({ window = 'month', now = new Date(), from = null, to = null } = {}) {
  const { startMs, endMs } = windowBounds(window, now, from, to);
  const all = await loadAllCreators();
  const f = { contactos: 0, conversas: 0, pediuVideo: 0, reunioesMarcadas: 0, reunioesRealizadas: 0, propostas: 0, negocios: 0 };
  for (const c of all) {
    const o = c.outreach || {};
    const contactoAt = o.dmSentAt || o.emailSentAt || null;
    const marcadaAt  = o.callBookedAt || o.callAgreedAt || null;
    const propostaAt = c.pitch?.sentAt || null;
    if (inWindow(contactoAt, startMs, endMs))       f.contactos += 1;
    if (inWindow(o.repliedAt, startMs, endMs))      f.conversas += 1;
    if (inWindow(o.videoRequestedAt, startMs, endMs)) f.pediuVideo += 1;
    if (inWindow(marcadaAt, startMs, endMs))        f.reunioesMarcadas += 1;
    if (inWindow(o.callHeldAt, startMs, endMs))     f.reunioesRealizadas += 1;
    if (inWindow(propostaAt, startMs, endMs))       f.propostas += 1;
    if (c.pipelineStatus === 'signed' && inWindow(c.signedAt, startMs, endMs)) f.negocios += 1;
  }
  const pct = (num, den) => den > 0 ? Math.round((num / den) * 100) : 0;
  return {
    ...f,
    rates: {
      contactoToConversa:  pct(f.conversas, f.contactos),
      conversaToVideo:     pct(f.pediuVideo, f.conversas),
      videoToMarcada:      pct(f.reunioesMarcadas, f.pediuVideo),
      // Kept for the TargetCalculator reverse-funnel (reply→meeting), which
      // doesn't model the video step.
      conversaToMarcada:   pct(f.reunioesMarcadas, f.conversas),
      marcadaToRealizada:  pct(f.reunioesRealizadas, f.reunioesMarcadas),
      realizadaToProposta: pct(f.propostas, f.reunioesRealizadas),
      propostaToNegocio:   pct(f.negocios, f.propostas),
      overall:             pct(f.negocios, f.contactos),
    },
  };
}

// FUNNEL TIMING — average DAYS between consecutive funnel stages, plus the
// full cycle (first contact → signed). The "duração do ciclo de venda" the
// team wants. Averaged over creators that have BOTH endpoints of a transition
// (post-reset); a stage with no completed transitions returns null rather than
// a fake zero. All-time (not windowed) — timing needs completed journeys and
// a short window yields near-empty samples.
export async function getFunnelTiming({ window = 'all', now = new Date(), from = null, to = null } = {}) {
  // Window-aware: shadow the module postReset so every event filter in this
  // function honors the selected timeframe (window='all' == all-time).
  const { startMs: __startMs, endMs: __endMs } = windowBounds(window, now, from, to);
  const postReset = (iso) => inWindow(iso, __startMs, __endMs);
  const all = await loadAllCreators();
  const b = { contactoConversa: [], conversaMarcada: [], marcadaRealizada: [], realizadaProposta: [], propostaNegocio: [], cicloTotal: [] };
  const days = (a, z) => (new Date(z).getTime() - new Date(a).getTime()) / DAY_MS;
  const push = (arr, a, z) => { if (postReset(a) && postReset(z) && new Date(z) >= new Date(a)) arr.push(days(a, z)); };
  for (const c of all) {
    const o = c.outreach || {};
    const contactoAt = o.dmSentAt || o.emailSentAt || null;
    const marcadaAt  = o.callBookedAt || o.callAgreedAt || null;
    const propostaAt = c.pitch?.sentAt || null;
    const signedAt   = c.pipelineStatus === 'signed' ? c.signedAt : null;
    push(b.contactoConversa,  contactoAt,  o.repliedAt);
    push(b.conversaMarcada,   o.repliedAt, marcadaAt);
    push(b.marcadaRealizada,  marcadaAt,   o.callHeldAt);
    push(b.realizadaProposta, o.callHeldAt, propostaAt);
    push(b.propostaNegocio,   propostaAt,  signedAt);
    push(b.cicloTotal,        contactoAt,  signedAt);
  }
  const avg = (arr) => arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length * 10) / 10 : null;
  return {
    contactoConversa:  avg(b.contactoConversa),
    conversaMarcada:   avg(b.conversaMarcada),
    marcadaRealizada:  avg(b.marcadaRealizada),
    realizadaProposta: avg(b.realizadaProposta),
    propostaNegocio:   avg(b.propostaNegocio),
    cicloTotal:        avg(b.cicloTotal),
    sampleSize:        b.cicloTotal.length,
  };
}

// STAGE ANALYTICS — the full volume-model pipeline, team-wide, all-time
// (post-reset). Two views the team asked for, both derived from the same
// Kanban timestamps as the per-lead journey timeline (stageEntries), so the
// card and the dashboard can never disagree:
//
//   1. rateSteps  — step conversion between the eight funnel MILESTONES
//      (Contactado → Respondeu → Pediu vídeo → Vídeo enviado → Marcada →
//      Realizada → Proposta → Assinado). Follow-ups are re-engagement, not
//      funnel steps, so they're folded into "Contactado" here. Uses cumulative
//      "reached this stage OR any later one" so leads that skip a stage (e.g.
//      reply then book straight away, no video) still count as progressed —
//      the counts stay monotonic and the % is honest.
//
//   2. timeSteps  — MEDIAN days spent in each Kanban stage (incl. the three
//      follow-up windows). Counts ONLY leads that MOVED PAST the stage (a
//      completed transition to whatever stage they entered next), so it reads
//      as "how long this stage takes to clear". Median, not mean — a couple of
//      leads that sit for weeks would wreck an average. A stage nobody has
//      cleared yet returns null (shown as "—"), never a fake zero.
export async function getStageAnalytics({ window = 'all', now = new Date(), from = null, to = null } = {}) {
  // Window-aware: shadow the module postReset so every event filter in this
  // function honors the selected timeframe (window='all' == all-time).
  const { startMs: __startMs, endMs: __endMs } = windowBounds(window, now, from, to);
  const postReset = (iso) => inWindow(iso, __startMs, __endMs);
  const all = await loadAllCreators();

  // ── 1. Rate funnel (milestones) ──
  const CHAIN = ['contactado', 'respondeu', 'pediu_video', 'video', 'marcada', 'realizada', 'proposta', 'assinado'];
  const CHAIN_LABELS = {
    contactado: 'Contactado', respondeu: 'Respondeu', pediu_video: 'Pediu vídeo',
    video: 'Vídeo enviado', marcada: 'Reunião marcada', realizada: 'Reunião realizada',
    proposta: 'Proposta', assinado: 'Assinado',
  };
  const milestoneAt = (c) => {
    const o = c.outreach || {};
    const at = {
      contactado:  o.dmSentAt || o.emailSentAt || null,
      respondeu:   o.repliedAt || null,
      pediu_video: o.videoRequestedAt || null,
      video:       o.videoSentAt || null,
      marcada:     o.callBookedAt || o.callAgreedAt || null,
      realizada:   o.callHeldAt || null,
      proposta:    c.pitch?.sentAt || null,
      assinado:    c.pipelineStatus === 'signed' ? (c.signedAt || null) : null,
    };
    for (const k of CHAIN) if (!postReset(at[k])) at[k] = null; // competition-window gate
    return at;
  };
  const reached = Object.fromEntries(CHAIN.map(k => [k, 0]));
  for (const c of all) {
    const at = milestoneAt(c);
    let maxIdx = -1;
    for (let i = 0; i < CHAIN.length; i++) if (at[CHAIN[i]]) maxIdx = i;
    for (let i = 0; i <= maxIdx; i++) reached[CHAIN[i]] += 1;
  }
  const rateSteps = CHAIN.map((k, i) => {
    const next = CHAIN[i + 1];
    return {
      key: k,
      label: CHAIN_LABELS[k],
      reached: reached[k],
      toNextRate: next && reached[k] > 0 ? Math.round((reached[next] / reached[k]) * 100) : null,
    };
  });

  // ── 2. Median time-in-stage (all Kanban stages, completed transitions) ──
  const dwell = {}; // stageKey → [days]
  for (const c of all) {
    const { entries } = stageEntries(c);
    const present = entries.filter(e => e.at && postReset(e.at));
    for (let i = 0; i + 1 < present.length; i++) {
      const a = new Date(present[i].at).getTime();
      const z = new Date(present[i + 1].at).getTime();
      if (!(z >= a)) continue; // guard against out-of-order drag artifacts
      (dwell[present[i].key] ||= []).push((z - a) / DAY_MS);
    }
  }
  const median = (arr) => {
    if (!arr || arr.length === 0) return null;
    const s = [...arr].sort((x, y) => x - y);
    const mid = Math.floor(s.length / 2);
    const m = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    return Math.round(m * 10) / 10;
  };
  const timeSteps = STAGE_KEYS
    .filter(k => k !== 'frio') // terminal — no dwell to measure
    .map(k => {
      const meta = STAGES.find(s => s.key === k) || {};
      const arr = dwell[k] || [];
      return { key: k, label: meta.label || k, accent: meta.accent || '#666', medianDays: median(arr), sample: arr.length };
    });

  return { rateSteps, timeSteps, sampleSize: all.length };
}

// STREAK — count of consecutive recent weekdays (Mon-Fri) where each
// person sent ≥ target DMs. Walks backwards from yesterday (or today
// if hour ≥ 23 Lisbon, meaning the day is effectively done). Skips
// weekends — they don't count toward or break the streak.
export async function getStreaks({ target = 40, now = new Date() } = {}) {
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
    // Gate the pipeline view on the reset — pre-reset conversations don't
    // count toward the competition's pipeline.
    if (!o.dmSentAt || !postReset(o.dmSentAt) || isCold || isSigned) continue;
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
export async function getVelocity({ window = 'all', now = new Date(), from = null, to = null } = {}) {
  // Window-aware: shadow the module postReset so every event filter in this
  // function honors the selected timeframe (window='all' == all-time).
  const { startMs: __startMs, endMs: __endMs } = windowBounds(window, now, from, to);
  const postReset = (iso) => inWindow(iso, __startMs, __endMs);
  const all = await loadAllCreators();
  const byUser = new Map();
  for (const c of all) {
    if (!c.addedBy) continue;
    const key = canonicalKey(c.addedBy.firstName);
    if (!byUser.has(key)) byUser.set(key, { firstName: c.addedBy.firstName, addedToDm: [], repliedToFollow: [], firstDmToSigned: [] });
    const u = byUser.get(key);
    const o = c.outreach || {};
    if (postReset(c.addedBy.at) && postReset(o.dmSentAt)) {
      u.addedToDm.push((new Date(o.dmSentAt).getTime() - new Date(c.addedBy.at).getTime()) / HOUR_MS);
    }
    if (postReset(o.repliedAt) && postReset(o.lastFollowUpAt) && new Date(o.lastFollowUpAt) > new Date(o.repliedAt)) {
      u.repliedToFollow.push((new Date(o.lastFollowUpAt).getTime() - new Date(o.repliedAt).getTime()) / HOUR_MS);
    }
    if (postReset(o.dmSentAt) && c.pipelineStatus === 'signed' && postReset(c.signedAt)) {
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
export async function getQualityBreakdowns({ window = 'all', now = new Date(), from = null, to = null } = {}) {
  // Window-aware: shadow the module postReset so every event filter in this
  // function honors the selected timeframe (window='all' == all-time).
  const { startMs: __startMs, endMs: __endMs } = windowBounds(window, now, from, to);
  const postReset = (iso) => inWindow(iso, __startMs, __endMs);
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
    if (!o.dmSentAt || !postReset(o.dmSentAt)) continue;
    const user = o.dmSentBy || c.addedBy;
    if (!user) continue;
    // Only count the reply if it also landed after the reset.
    const replied = !!o.repliedAt && postReset(o.repliedAt);
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
export async function getMonthlyTally({ target = 40, now = new Date() } = {}) {
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
export async function getNeedsAttention({ now = new Date(), dailyTarget = 40 } = {}) {
  const all = await loadAllCreators();
  const items = [];
  const nowMs = now.getTime();
  // Stale active conversations (>14 days no follow-up, no reply yet)
  let stale = 0;
  const staleByUser = new Map();
  for (const c of all) {
    const o = c.outreach || {};
    if (!o.dmSentAt || !postReset(o.dmSentAt) || o.repliedAt || c.pipelineStatus === 'cold' || c.pipelineStatus === 'signed') continue;
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
    if (!o.repliedAt || !postReset(o.repliedAt)) continue;
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

// HEATMAP — 7 days × 4 time blocks (morning / midday / afternoon / evening)
// showing where team activity concentrates. Each cell counts DMs sent
// across the whole team in that time bucket over the last N weeks.
// Time buckets (Lisbon local):
//   morning   05:00–11:59  (early grind)
//   midday    12:00–14:59  (lunch window)
//   afternoon 15:00–18:59  (afternoon push)
//   evening   19:00–04:59  (after-hours / overnight)
export async function getHeatmap({ weeks = 4, now = new Date() } = {}) {
  const all = await loadAllCreators();
  // Cutoff is the later of "N weeks ago" and the global reset point.
  const cutoffMs = Math.max(now.getTime() - weeks * 7 * DAY_MS, statsResetMs());
  // grid[day0..6][bucket0..3] — day 0 = Monday (matches Lisbon week start).
  const grid = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  const bucketOf = (hour) => {
    if (hour >= 5 && hour < 12) return 0;
    if (hour >= 12 && hour < 15) return 1;
    if (hour >= 15 && hour < 19) return 2;
    return 3;
  };
  for (const c of all) {
    const ats = [c.outreach?.dmSentAt].filter(Boolean);
    for (const at of ats) {
      const t = new Date(at).getTime();
      if (t < cutoffMs) continue;
      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIMEZONE,
        weekday: 'short', hour: '2-digit', hour12: false,
      });
      const parts = Object.fromEntries(fmt.formatToParts(new Date(at)).map(p => [p.type, p.value]));
      const dowMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
      const dow = dowMap[parts.weekday];
      if (dow == null) continue;
      const hour = Number(parts.hour) || 0;
      grid[dow][bucketOf(hour)] += 1;
    }
  }
  return { weeks, grid };
}

// RECENT ACTIVITY — last N events across the team, newest first. Drives
// the activity feed on the dashboard.
export async function getRecentActivity({ limit = 8 } = {}) {
  const all = await loadAllCreators();
  const events = [];
  for (const c of all) {
    const o = c.outreach || {};
    if (postReset(c.addedBy?.at)) events.push({ at: c.addedBy.at, type: 'added', firstName: c.addedBy.firstName, creator: c.name, creatorId: c.id });
    if (postReset(o.dmSentAt)) events.push({ at: o.dmSentAt, type: 'dm_sent', firstName: (o.dmSentBy || c.addedBy)?.firstName, creator: c.name, creatorId: c.id });
    // Follow-ups — one event per follow-up from the channel-tagged array
    // (new shape), with the legacy single-timestamp fallback for records
    // that predate the array. Attributed to whoever did the follow-up.
    if (Array.isArray(o.followUps) && o.followUps.length > 0) {
      for (const f of o.followUps) {
        if (!postReset(f?.at)) continue;
        events.push({ at: f.at, type: 'follow_up', firstName: (f.by || c.addedBy)?.firstName, creator: c.name, creatorId: c.id, channel: f.channel || null });
      }
    } else if (postReset(o.lastFollowUpAt)) {
      events.push({ at: o.lastFollowUpAt, type: 'follow_up', firstName: (o.lastFollowUpBy || c.addedBy)?.firstName, creator: c.name, creatorId: c.id });
    }
    if (postReset(o.repliedAt)) events.push({ at: o.repliedAt, type: 'replied', firstName: (o.repliedMarkedBy || c.addedBy)?.firstName, creator: c.name, creatorId: c.id });
    if (postReset(o.videoRequestedAt)) events.push({ at: o.videoRequestedAt, type: 'video_requested', firstName: (o.videoRequestedBy || o.repliedMarkedBy || c.addedBy)?.firstName, creator: c.name, creatorId: c.id });
    if (postReset(o.videoSentAt)) events.push({ at: o.videoSentAt, type: 'video_sent', firstName: (o.videoSentBy || c.addedBy)?.firstName, creator: c.name, creatorId: c.id });
    if (postReset(c.signedAt)) events.push({ at: c.signedAt, type: 'signed', firstName: c.addedBy?.firstName, creator: c.name, creatorId: c.id });
  }
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events.slice(0, limit);
}

// PACING — projects current run rate forward to month-end. For the
// monthly DM goal (40/day × ~22 working days = 880/month per person).
// Returns: { firstName, monthSoFar, monthGoal, projectedTotal, pacePct }
export async function getPacing({ target = 40, now = new Date() } = {}) {
  const monthRows = await getTeamStats({ window: 'month', now });
  const startMs = windowStart('month', now);
  const elapsedMs = now.getTime() - startMs;
  const elapsedDays = Math.max(1, elapsedMs / DAY_MS);
  // Count working days (Mon-Fri) elapsed and remaining in the month.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit',
  });
  const monthStr = fmt.format(now);
  const [y, m] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  let workingDaysInMonth = 0;
  let workingDaysElapsed = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    workingDaysInMonth += 1;
    if (d <= now.getUTCDate()) workingDaysElapsed += 1;
  }
  const monthGoal = target * workingDaysInMonth;
  return monthRows.map(r => {
    // Pace now tracks `touchesSent` (unique-creator outreach touches) since
    // that's the new 40/day target unit. DMs still surface as a sub-stat
    // on the dashboard, just not as the gate.
    const rate = workingDaysElapsed > 0 ? r.touchesSent / workingDaysElapsed : 0;
    const projectedTotal = Math.round(rate * workingDaysInMonth);
    const pacePct = monthGoal > 0 ? Math.round((r.touchesSent / (target * workingDaysElapsed || 1)) * 100) : 0;
    return {
      userId: r.userId,
      firstName: r.firstName,
      monthSoFar: r.touchesSent,
      monthGoal,
      projectedTotal,
      pacePct,
      workingDaysElapsed,
      workingDaysInMonth,
    };
  });
}

// ACTIVITY SERIES — last N days of daily DM counts per user. Drives the
// bar chart + sparklines on the redesigned dashboard. Returns:
//   [{ userId, firstName, days: [{ date: 'YYYY-MM-DD', dms, replies }, ...] }]
// with `days` ordered oldest-first, length = N.
export async function getActivitySeries({ days = 7, now = new Date() } = {}) {
  const all = await loadAllCreators();
  // Build a lookup of date keys to walk (oldest-first).
  const dateKeys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(d);
    dateKeys.push(dateStr);
  }
  const byUser = new Map();
  const ensureUser = (k, firstName) => {
    if (!byUser.has(k)) byUser.set(k, {
      firstName,
      dms: new Map(),
      emails: new Map(),
      touchesByDay: new Map(),     // Map<dateKey, Set<creatorId>> for unique-creator counting
      replies: new Map(),
    });
    return byUser.get(k);
  };
  const fmtDate = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date(iso));

  for (const c of all) {
    const o = c.outreach || {};
    if (postReset(o.dmSentAt)) {
      const actor = o.dmSentBy || c.addedBy;
      if (actor) {
        const k = canonicalKey(actor.firstName);
        const dateStr = fmtDate(o.dmSentAt);
        const u = ensureUser(k, actor.firstName);
        u.dms.set(dateStr, (u.dms.get(dateStr) || 0) + 1);
        if (!u.touchesByDay.has(dateStr)) u.touchesByDay.set(dateStr, new Set());
        u.touchesByDay.get(dateStr).add(c.id);
      }
    }
    if (postReset(o.emailSentAt)) {
      const actor = o.emailSentBy || c.addedBy;
      if (actor) {
        const k = canonicalKey(actor.firstName);
        const dateStr = fmtDate(o.emailSentAt);
        const u = ensureUser(k, actor.firstName);
        u.emails.set(dateStr, (u.emails.get(dateStr) || 0) + 1);
        if (!u.touchesByDay.has(dateStr)) u.touchesByDay.set(dateStr, new Set());
        u.touchesByDay.get(dateStr).add(c.id);
      }
    }
    if (postReset(o.repliedAt)) {
      const actor = o.repliedMarkedBy || c.addedBy;
      if (actor) {
        const k = canonicalKey(actor.firstName);
        const dateStr = fmtDate(o.repliedAt);
        const u = ensureUser(k, actor.firstName);
        u.replies.set(dateStr, (u.replies.get(dateStr) || 0) + 1);
      }
    }
  }
  return Array.from(byUser.entries()).map(([key, u]) => ({
    userId: key,
    firstName: u.firstName,
    days: dateKeys.map(d => ({
      date: d,
      dms: u.dms.get(d) || 0,
      emails: u.emails.get(d) || 0,
      // `touches` is unique-creator-touches per day — drives the new
      // "Outreach hoje" headline + the 40/day target chart.
      touches: u.touchesByDay.get(d)?.size || 0,
      replies: u.replies.get(d) || 0,
    })),
  }));
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
    if (!c.addedBy || !postReset(c.addedBy.at)) continue;
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

// ──────────────────────────────────────────────────────────────────
// Tier 1–4 sales metrics (added 2026-05-19)
//
// Each helper is per-user where the question is "who's improving" and
// team-wide where the question is "what's working". They all respect
// the global stats-reset point so the competition view stays clean.
// ──────────────────────────────────────────────────────────────────

// Resolve a creator's likely annual revenue for forecasting/coverage math.
// Tries calculateOfferRevenue first (full offer with pricing tier), then
// falls back to revenuePrice × 12 (monthly subscription assumption).
async function _resolveAnnualRevenue(c) {
  const { calculateOfferRevenue } = await import('./revenue');
  const offer = c.offer?.client_facing_output;
  if (offer?.target_price) {
    try {
      const r = calculateOfferRevenue({ offer, creator: c, scenarioKey: 'moderado' });
      if (r?.annualRevenue) return r.annualRevenue;
    } catch { /* fall through */ }
  }
  if (Number.isFinite(c.revenuePrice)) return Number(c.revenuePrice) * 12;
  return 0;
}

// 1. PIPELINE COVERAGE — for each user: how many € of pipeline (weighted by
//    stage probability) sit against the quarterly quota. < 3× usually means
//    not enough deals in flight to safely hit the number.
//
//    coverage = pipelineWeighted ÷ (quotaEur × (1 - winRate))   [simplified]
//    We report it as a ratio of weightedPipeline ÷ quotaRemaining so 1.0
//    means "exactly enough on average", 3.0 means "comfortable".
export async function getPipelineCoverage({ quotaEurPerQuarter = 50000 } = {}) {
  const forecast = await getRevenueForecast();
  return forecast.map(f => {
    const quotaRemaining = Math.max(0, quotaEurPerQuarter - (f.signedAnnualEur / 4));
    const ratio = quotaRemaining > 0 ? f.pipelineWeightedAnnualEur / 4 / quotaRemaining : null;
    return {
      userId: f.userId,
      firstName: f.firstName,
      quotaEurPerQuarter,
      signedThisQuarterEur: Math.round(f.signedAnnualEur / 4),
      pipelineWeightedQuarterEur: Math.round(f.pipelineWeightedAnnualEur / 4),
      quotaRemainingEur: Math.round(quotaRemaining),
      coverageRatio: ratio == null ? null : Math.round(ratio * 100) / 100,
      // Verdict: < 1.5× = thin, 1.5–3× = adequate, > 3× = safe.
      status: ratio == null ? 'na' : ratio < 1.5 ? 'thin' : ratio < 3 ? 'adequate' : 'safe',
    };
  });
}

// 2. CAC PROXY — Customer Acquisition Cost approximation. We don't track ad
//    spend so we proxy effort with time-cost-per-touch:
//      cost = (dms × €0.50) + (emails × €1.00) + (followUps × €0.75) + (callsHeld × €15)
//    Calls are heavy because they consume actual sales hours. Numbers are
//    deliberately conservative — directional, not accounting.
const TOUCH_COST_EUR = { dm: 0.5, email: 1.0, followUp: 0.75, call: 15 };
export async function getCAC({ window = 'all', now = new Date(), from = null, to = null } = {}) {
  // Window-aware: shadow the module postReset so every event filter in this
  // function honors the selected timeframe (window='all' == all-time).
  const { startMs: __startMs, endMs: __endMs } = windowBounds(window, now, from, to);
  const postReset = (iso) => inWindow(iso, __startMs, __endMs);
  const all = await loadAllCreators();
  const byUser = new Map();
  for (const c of all) {
    if (!c.addedBy || !postReset(c.addedBy.at)) continue;
    const key = canonicalKey(c.addedBy.firstName);
    if (!byUser.has(key)) byUser.set(key, { firstName: c.addedBy.firstName, spendEur: 0, signed: 0, signedRevenueEur: 0 });
    const u = byUser.get(key);
    const o = c.outreach || {};
    if (postReset(o.dmSentAt)) u.spendEur += TOUCH_COST_EUR.dm;
    if (postReset(o.emailSentAt)) u.spendEur += TOUCH_COST_EUR.email;
    if (postReset(o.lastFollowUpAt)) u.spendEur += (o.followUpsDone || 1) * TOUCH_COST_EUR.followUp;
    if (postReset(o.callHeldAt)) u.spendEur += TOUCH_COST_EUR.call;
    if (c.pipelineStatus === 'signed' && postReset(c.signedAt)) {
      u.signed += 1;
      // eslint-disable-next-line no-await-in-loop
      u.signedRevenueEur += await _resolveAnnualRevenue(c);
    }
  }
  return Array.from(byUser.entries()).map(([key, u]) => ({
    userId: key,
    firstName: u.firstName,
    spendEur: Math.round(u.spendEur),
    signed: u.signed,
    cacEur: u.signed > 0 ? Math.round(u.spendEur / u.signed) : null,
    paybackRatio: u.signed > 0 && u.spendEur > 0 ? Math.round((u.signedRevenueEur / u.spendEur) * 10) / 10 : null,
  }));
}

// 3. TOUCH POINTS PER CLOSE — how much outreach effort lands a signed deal.
//    Counts DM + email + every follow-up + every call held. Lower = more
//    efficient. Team-wide average so we can benchmark each person against
//    the house number.
export async function getTouchpointsPerClose({ window = 'all', now = new Date(), from = null, to = null } = {}) {
  // Window-aware: shadow the module postReset so every event filter in this
  // function honors the selected timeframe (window='all' == all-time).
  const { startMs: __startMs, endMs: __endMs } = windowBounds(window, now, from, to);
  const postReset = (iso) => inWindow(iso, __startMs, __endMs);
  const all = await loadAllCreators();
  const byUser = new Map();
  let teamTouches = 0, teamSigned = 0;
  for (const c of all) {
    if (c.pipelineStatus !== 'signed' || !postReset(c.signedAt)) continue;
    const o = c.outreach || {};
    let touches = 0;
    if (o.dmSentAt) touches += 1;
    if (o.emailSentAt) touches += 1;
    touches += (o.followUpsDone || 0);
    if (o.callHeldAt) touches += 1;
    if (o.callAgreedAt && !o.callHeldAt) touches += 1; // no-show still cost a touch
    const key = canonicalKey(c.addedBy?.firstName);
    if (!byUser.has(key)) byUser.set(key, { firstName: c.addedBy?.firstName, touches: 0, signed: 0 });
    const u = byUser.get(key);
    u.touches += touches;
    u.signed += 1;
    teamTouches += touches;
    teamSigned += 1;
  }
  const teamAvg = teamSigned > 0 ? Math.round((teamTouches / teamSigned) * 10) / 10 : null;
  return {
    teamAvg,
    rows: Array.from(byUser.entries()).map(([key, u]) => ({
      userId: key,
      firstName: u.firstName,
      touches: u.touches,
      signed: u.signed,
      avgPerClose: u.signed > 0 ? Math.round((u.touches / u.signed) * 10) / 10 : null,
    })),
  };
}

// 4. SHOW-UP RATE — % of agreed calls that actually happen. Per-user +
//    team-wide. A drop below ~70% usually means scheduling friction or
//    weak booking confirmation flow.
export async function getShowUpRate({ window = 'all', now = new Date(), from = null, to = null } = {}) {
  // Window-aware: shadow the module postReset so every event filter in this
  // function honors the selected timeframe (window='all' == all-time).
  const { startMs: __startMs, endMs: __endMs } = windowBounds(window, now, from, to);
  const postReset = (iso) => inWindow(iso, __startMs, __endMs);
  const all = await loadAllCreators();
  const byUser = new Map();
  let teamAgreed = 0, teamHeld = 0;
  for (const c of all) {
    const o = c.outreach || {};
    if (!postReset(o.callAgreedAt)) continue;
    const key = canonicalKey(c.addedBy?.firstName);
    if (!byUser.has(key)) byUser.set(key, { firstName: c.addedBy?.firstName, agreed: 0, held: 0 });
    const u = byUser.get(key);
    u.agreed += 1;
    teamAgreed += 1;
    if (postReset(o.callHeldAt)) {
      u.held += 1;
      teamHeld += 1;
    }
  }
  return {
    teamAgreed,
    teamHeld,
    teamRate: teamAgreed > 0 ? Math.round((teamHeld / teamAgreed) * 100) : null,
    rows: Array.from(byUser.entries()).map(([key, u]) => ({
      userId: key,
      firstName: u.firstName,
      agreed: u.agreed,
      held: u.held,
      rate: u.agreed > 0 ? Math.round((u.held / u.agreed) * 100) : null,
    })),
  };
}

// 5. LOSS REASONS — breakdown of cold creators by lostReason. Pure team-wide
//    view (no per-user split — the goal is to inform offer iteration, not
//    competition). Returns sorted by count desc.
const LOSS_REASON_LABELS = {
  price:      'Preço',
  timing:     'Timing',
  fit:        'Não encaixa',
  ghost:      'Sem resposta',
  competitor: 'Concorrente',
  other:      'Outro',
};
export async function getLossReasons({ window = 'all', now = new Date(), from = null, to = null } = {}) {
  // Window-aware: shadow the module postReset so every event filter in this
  // function honors the selected timeframe (window='all' == all-time).
  const { startMs: __startMs, endMs: __endMs } = windowBounds(window, now, from, to);
  const postReset = (iso) => inWindow(iso, __startMs, __endMs);
  const all = await loadAllCreators();
  const counts = new Map();
  let total = 0;
  for (const c of all) {
    if (c.pipelineStatus !== 'cold') continue;
    // Anchor on lostAt when present, otherwise signedAt-style fallback.
    const at = c.lostAt || c.outreach?.repliedAt || c.outreach?.dmSentAt;
    if (!at || !postReset(at)) continue;
    const reason = c.lostReason || 'unknown';
    counts.set(reason, (counts.get(reason) || 0) + 1);
    total += 1;
  }
  const rows = Array.from(counts.entries())
    .map(([reason, count]) => ({
      reason,
      label: LOSS_REASON_LABELS[reason] || 'Desconhecido',
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
  return { total, rows };
}

// 6. FOLLOW-UP EFFECTIVENESS — where do replies actually come from? Compares
//    replies that landed after the cold DM (before any follow-up) vs after
//    each follow-up touch. Pure team-wide.
//
//    Heuristic: bucket by (followUpsDone at the time of the reply). We only
//    have the latest followUpsDone counter, so this assumes the count grew
//    monotonically — it's directional, not exact.
export async function getFollowUpEffectiveness({ window = 'all', now = new Date(), from = null, to = null } = {}) {
  // Window-aware: shadow the module postReset so every event filter in this
  // function honors the selected timeframe (window='all' == all-time).
  const { startMs: __startMs, endMs: __endMs } = windowBounds(window, now, from, to);
  const postReset = (iso) => inWindow(iso, __startMs, __endMs);
  const all = await loadAllCreators();
  const buckets = { cold: { sent: 0, replied: 0 }, fu1: { sent: 0, replied: 0 }, fu2: { sent: 0, replied: 0 }, fu3: { sent: 0, replied: 0 } };
  for (const c of all) {
    const o = c.outreach || {};
    if (!o.dmSentAt || !postReset(o.dmSentAt)) continue;
    const followUps = o.followUpsDone || 0;
    // Every conversation that reached follow-up N necessarily also passed
    // through follow-up N-1 (and the cold DM). So bucket counts the *touch*
    // population at each stage, not the conversation.
    buckets.cold.sent += 1;
    if (followUps >= 1) buckets.fu1.sent += 1;
    if (followUps >= 2) buckets.fu2.sent += 1;
    if (followUps >= 3) buckets.fu3.sent += 1;
    if (o.repliedAt && postReset(o.repliedAt)) {
      // Attribute the reply to the last follow-up touched. followUpsDone === 0
      // means the cold DM did the work.
      if (followUps === 0) buckets.cold.replied += 1;
      else if (followUps === 1) buckets.fu1.replied += 1;
      else if (followUps === 2) buckets.fu2.replied += 1;
      else buckets.fu3.replied += 1;
    }
  }
  const rate = (b) => b.sent > 0 ? Math.round((b.replied / b.sent) * 100) : 0;
  return [
    { stage: 'Cold DM',    key: 'cold', sent: buckets.cold.sent, replied: buckets.cold.replied, rate: rate(buckets.cold) },
    { stage: 'Follow-up 1', key: 'fu1', sent: buckets.fu1.sent,  replied: buckets.fu1.replied,  rate: rate(buckets.fu1) },
    { stage: 'Follow-up 2', key: 'fu2', sent: buckets.fu2.sent,  replied: buckets.fu2.replied,  rate: rate(buckets.fu2) },
    { stage: 'Follow-up 3', key: 'fu3', sent: buckets.fu3.sent,  replied: buckets.fu3.replied,  rate: rate(buckets.fu3) },
  ];
}

// 7. PIPELINE VELOCITY — classic composite:
//      velocity = (# deals × winRate × avgDealValue) / avgCycleDays
//    Result is € of pipeline value flowing per day per user. Useful for
//    spotting whether someone with high volume is actually moving money or
//    just stirring activity.
export async function getPipelineVelocity({ window = 'all', now = new Date(), from = null, to = null } = {}) {
  // Window-aware: shadow the module postReset so every event filter in this
  // function honors the selected timeframe (window='all' == all-time).
  const { startMs: __startMs, endMs: __endMs } = windowBounds(window, now, from, to);
  const postReset = (iso) => inWindow(iso, __startMs, __endMs);
  const all = await loadAllCreators();
  const byUser = new Map();
  for (const c of all) {
    if (!c.addedBy || !postReset(c.addedBy.at)) continue;
    const key = canonicalKey(c.addedBy.firstName);
    if (!byUser.has(key)) byUser.set(key, { firstName: c.addedBy.firstName, openDeals: 0, signed: 0, signedRevenueEur: 0, cycleDays: [] });
    const u = byUser.get(key);
    const o = c.outreach || {};
    if (c.pipelineStatus !== 'signed' && c.pipelineStatus !== 'cold' && postReset(o.dmSentAt)) u.openDeals += 1;
    if (c.pipelineStatus === 'signed' && postReset(c.signedAt)) {
      u.signed += 1;
      // eslint-disable-next-line no-await-in-loop
      u.signedRevenueEur += await _resolveAnnualRevenue(c);
      if (o.dmSentAt) {
        u.cycleDays.push((new Date(c.signedAt).getTime() - new Date(o.dmSentAt).getTime()) / DAY_MS);
      }
    }
  }
  return Array.from(byUser.entries()).map(([key, u]) => {
    const totalDeals = u.openDeals + u.signed;
    const winRate = totalDeals > 0 ? u.signed / totalDeals : 0;
    const avgDealEur = u.signed > 0 ? u.signedRevenueEur / u.signed : 0;
    const avgCycleDays = u.cycleDays.length > 0 ? u.cycleDays.reduce((s, x) => s + x, 0) / u.cycleDays.length : null;
    const velocityEurPerDay = avgCycleDays && avgCycleDays > 0
      ? Math.round((totalDeals * winRate * avgDealEur) / avgCycleDays)
      : null;
    return {
      userId: key,
      firstName: u.firstName,
      openDeals: u.openDeals,
      signed: u.signed,
      winRatePct: Math.round(winRate * 100),
      avgDealEur: Math.round(avgDealEur),
      avgCycleDays: avgCycleDays == null ? null : Math.round(avgCycleDays * 10) / 10,
      velocityEurPerDay,
    };
  });
}

// 8. WIN-RATE TRAJECTORY — close rate over weekly buckets (last N weeks).
//    "Closed" means signed OR lost (cold w/ reason). winRate = signed / (signed + cold)
//    bucketed by the week the deal moved into a terminal state. Trend goes
//    up → offer is improving / better fit selection; trend goes down → leak.
export async function getWinRateTrajectory({ weeks = 8, now = new Date() } = {}) {
  const all = await loadAllCreators();
  // Build week-anchored bucket keys (YYYY-Www, Monday-start, Lisbon-local).
  const buckets = []; // [{ key, label, signed: 0, lost: 0 }]
  for (let i = weeks - 1; i >= 0; i--) {
    const cursor = new Date(now.getTime() - i * 7 * DAY_MS);
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(cursor);
    const [yy, mm, dd] = dateStr.split('-').map(Number);
    const tmp = new Date(Date.UTC(yy, mm - 1, dd));
    const dow = tmp.getUTCDay();
    const daysSinceMon = (dow + 6) % 7;
    const mondayMs = Date.UTC(yy, mm - 1, dd - daysSinceMon);
    const monday = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date(mondayMs));
    if (!buckets.find(b => b.key === monday)) buckets.push({ key: monday, label: monday.slice(5), signed: 0, lost: 0 });
  }
  const bucketKeys = buckets.map(b => b.key);

  const placeIn = (iso) => {
    if (!iso || !postReset(iso)) return null;
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date(iso));
    const [yy, mm, dd] = dateStr.split('-').map(Number);
    const tmp = new Date(Date.UTC(yy, mm - 1, dd));
    const dow = tmp.getUTCDay();
    const daysSinceMon = (dow + 6) % 7;
    const mondayMs = Date.UTC(yy, mm - 1, dd - daysSinceMon);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date(mondayMs));
    return bucketKeys.includes(key) ? key : null;
  };

  for (const c of all) {
    if (c.pipelineStatus === 'signed' && c.signedAt) {
      const k = placeIn(c.signedAt);
      if (k) buckets.find(b => b.key === k).signed += 1;
    } else if (c.pipelineStatus === 'cold' && (c.lostAt || c.outreach?.repliedAt)) {
      const at = c.lostAt || c.outreach?.repliedAt;
      const k = placeIn(at);
      if (k) buckets.find(b => b.key === k).lost += 1;
    }
  }
  return buckets.map(b => {
    const total = b.signed + b.lost;
    return {
      week: b.key,
      label: b.label,
      signed: b.signed,
      lost: b.lost,
      total,
      winRatePct: total > 0 ? Math.round((b.signed / total) * 100) : null,
    };
  });
}
