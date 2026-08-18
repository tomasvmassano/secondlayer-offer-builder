import { NextResponse } from 'next/server';
import {
  getTeamStats, getDailyScoreboard,
  getFunnels, getTeamFunnel, getFunnelTiming, getStageAnalytics, getStreaks, getPipelineHealth, getVelocity,
  getQualityBreakdowns, getMonthlyTally, getNeedsAttention,
  getDeltas, getRevenueForecast, getActivitySeries,
  getHeatmap, getRecentActivity, getPacing,
  getPipelineCoverage, getCAC, getTouchpointsPerClose,
  getShowUpRate, getLossReasons, getFollowUpEffectiveness,
  getPipelineVelocity, getWinRateTrajectory,
} from '../../lib/teamStats';

// In-memory 5-min response cache, keyed by (window, target, quota).
// Each /equipa load fan-outs 24 aggregations, each reading the creators
// index + every full record. Five minutes of staleness on a leaderboard
// dashboard is acceptable, and the cache slashes Redis traffic during
// active sessions where one operator reloads the page repeatedly.
//
// Cache survives across requests on the same warm Vercel function
// instance. Cold starts re-populate. Writes elsewhere (PATCH /api/creators/:id)
// do NOT invalidate this — staleness is bounded by the 5-min TTL.
const RESPONSE_TTL_MS = 5 * 60_000;
const _respCache = new Map(); // key → { val, expiresAt }
function _respGet(key) {
  const e = _respCache.get(key);
  if (!e) return undefined;
  if (e.expiresAt < Date.now()) { _respCache.delete(key); return undefined; }
  return e.val;
}
function _respSet(key, val) {
  _respCache.set(key, { val, expiresAt: Date.now() + RESPONSE_TTL_MS });
}

// Read-only endpoint that backs the /equipa dashboard. Middleware ensures
// the caller has a valid session — every team member sees everyone's stats
// (it's a competition, transparency is the point).
//
// Single endpoint, returns the entire dashboard payload in one call. We
// fan out N parallel aggregations against the creators index. For a small
// CRM this is much cheaper than 10 separate round-trips from the client.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const target = Number(searchParams.get('target')) || 50;
    // Quarterly quota for pipeline-coverage math. Overridable per env so the
    // dashboard doesn't need a redeploy when targets shift.
    const quotaEurPerQuarter = Number(searchParams.get('quota'))
      || Number(process.env.SALES_QUARTERLY_QUOTA_EUR)
      || 50000;

    // Custom date range (YYYY-MM-DD, Lisbon calendar days). When BOTH are
    // present and valid, they override the named window with window='custom'
    // and carry explicit [start,end) bounds into every range-aware aggregation.
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const isCustom = !!(from && to) && dateRe.test(from) && dateRe.test(to);
    if ((from || to) && !isCustom) {
      return NextResponse.json({ error: 'from/to must both be YYYY-MM-DD' }, { status: 400 });
    }
    if (isCustom && from > to) {
      return NextResponse.json({ error: 'from must be on or before to' }, { status: 400 });
    }
    const window = isCustom ? 'custom' : (searchParams.get('window') || 'today');

    const valid = ['today', 'yesterday', 'week', 'month', 'quarter', 'ytd', '30d', '90d', 'all'];
    if (!isCustom && !valid.includes(window)) {
      return NextResponse.json({ error: `window must be one of ${valid.join('|')}` }, { status: 400 });
    }

    // Serve from the 5-min response cache if we have a hit for this
    // (window, from, to, target, quota) tuple.
    const cacheKey = `${window}|${from || ''}|${to || ''}|${target}|${quotaEurPerQuarter}`;
    const cachedResp = _respGet(cacheKey);
    if (cachedResp) return NextResponse.json(cachedResp);

    // Structural funnel/conversion metrics don't make sense over a single
    // day, so today/yesterday fall back to the month; a custom range and every
    // other window pass straight through (custom carries from/to bounds).
    const funnelWindow = (window === 'today' || window === 'yesterday') ? 'month' : window;

    // Run all aggregations in parallel.
    const [
      rows,
      scoreboard,
      funnels,
      teamFunnel,
      funnelTiming,
      stageAnalytics,
      streaks,
      pipeline,
      velocity,
      quality,
      monthlyTally,
      needsAttention,
      deltas,
      revenue,
      activity,
      heatmap,
      recentActivity,
      pacing,
      coverage,
      cac,
      touchpoints,
      showUp,
      lossReasons,
      followUpEff,
      pipelineVelocity,
      winRateTrajectory,
    ] = await Promise.all([
      getTeamStats({ window, from, to }),
      // Daily scoreboard on the Hoje view (against today's target) and on
      // the Ontem view (against yesterday's target — same daily number,
      // but the cron uses windowKey='yesterday' to look at the EOD).
      window === 'today'     ? getDailyScoreboard({ target })                              :
      window === 'yesterday' ? getDailyScoreboard({ target, windowKey: 'yesterday' })      : null,
      getFunnels(null, { window: funnelWindow, from, to }),
      // Team-wide sales funnel (windowed) + stage-to-stage timing (all-time).
      // Both derived from the Kanban timestamps — no manual entry.
      getTeamFunnel({ window: funnelWindow, from, to }),
      getFunnelTiming({ window: funnelWindow, from, to }),
      // Full-pipeline stage analytics (all-time): step conversion + median
      // time-in-stage across every volume-model stage. Team-wide.
      getStageAnalytics({ window: funnelWindow, from, to }),
      isCustom ? null : getStreaks({ target }),
      getPipelineHealth(),
      getVelocity({ window: funnelWindow, from, to }),
      getQualityBreakdowns({ window: funnelWindow, from, to }),
      isCustom ? null : getMonthlyTally({ target }),
      getNeedsAttention({ dailyTarget: target }),
      // getDeltas only supports 'week' or 'month'. For today we compare to
      // the previous week (legacy). For yesterday we don't surface its
      // own deltas — the dashboard already shows yesterday's actuals as
      // the headline; comparing yesterday to last week reads as noise.
      window === 'all' || window === 'yesterday' || isCustom
        ? null
        : getDeltas({ window: window === 'today' ? 'week' : window }),
      getRevenueForecast(),
      getActivitySeries({ days: 7 }),
      getHeatmap({ weeks: 4 }),
      getRecentActivity({ limit: 12 }),
      isCustom ? null : getPacing({ target }),
      getPipelineCoverage({ quotaEurPerQuarter }),
      getCAC({ window: funnelWindow, from, to }),
      getTouchpointsPerClose({ window: funnelWindow, from, to }),
      getShowUpRate({ window: funnelWindow, from, to }),
      getLossReasons({ window: funnelWindow, from, to }),
      getFollowUpEffectiveness({ window: funnelWindow, from, to }),
      getPipelineVelocity({ window: funnelWindow, from, to }),
      getWinRateTrajectory({ weeks: 8 }),
    ]);

    // Ship yesterday's per-person rows alongside today's payload so the
    // client can render "vs ontem" delta chips without a second request.
    // Cheap: getTeamStats reads through the 30s creator cache, so this
    // second pass adds zero Redis hits beyond the first.
    const vsYesterday = window === 'today'
      ? { rows: await getTeamStats({ window: 'yesterday' }) }
      : null;

    const payload = {
      window, from: from || null, to: to || null, target, quotaEurPerQuarter,
      rows, scoreboard, funnels, teamFunnel, funnelTiming, stageAnalytics, streaks, pipeline, velocity, quality,
      monthlyTally, needsAttention, deltas, revenue, activity,
      heatmap, recentActivity, pacing,
      coverage, cac, touchpoints, showUp, lossReasons, followUpEff,
      pipelineVelocity, winRateTrajectory,
      vsYesterday,
    };
    _respSet(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
