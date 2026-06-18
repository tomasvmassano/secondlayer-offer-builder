import { NextResponse } from 'next/server';
import {
  getTeamStats, getDailyScoreboard,
  getFunnels, getStreaks, getPipelineHealth, getVelocity,
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
    const window = searchParams.get('window') || 'today';
    const target = Number(searchParams.get('target')) || 30;
    // Quarterly quota for pipeline-coverage math. Overridable per env so the
    // dashboard doesn't need a redeploy when targets shift.
    const quotaEurPerQuarter = Number(searchParams.get('quota'))
      || Number(process.env.SALES_QUARTERLY_QUOTA_EUR)
      || 50000;

    const valid = ['today', 'week', 'month', 'all'];
    if (!valid.includes(window)) {
      return NextResponse.json({ error: `window must be one of ${valid.join('|')}` }, { status: 400 });
    }

    // Serve from the 5-min response cache if we have a hit for this
    // (window, target, quota) tuple. The dashboard refreshes every time
    // the operator clicks a window chip, so deduplication matters.
    const cacheKey = `${window}|${target}|${quotaEurPerQuarter}`;
    const cachedResp = _respGet(cacheKey);
    if (cachedResp) return NextResponse.json(cachedResp);

    // Run all aggregations in parallel.
    const [
      rows,
      scoreboard,
      funnels,
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
      getTeamStats({ window }),
      window === 'today' ? getDailyScoreboard({ target }) : null,
      getFunnels(),
      getStreaks({ target }),
      getPipelineHealth(),
      getVelocity(),
      getQualityBreakdowns(),
      getMonthlyTally({ target }),
      getNeedsAttention({ dailyTarget: target }),
      window !== 'all' ? getDeltas({ window: window === 'today' ? 'week' : window }) : null,
      getRevenueForecast(),
      getActivitySeries({ days: 7 }),
      getHeatmap({ weeks: 4 }),
      getRecentActivity({ limit: 8 }),
      getPacing({ target }),
      getPipelineCoverage({ quotaEurPerQuarter }),
      getCAC(),
      getTouchpointsPerClose(),
      getShowUpRate(),
      getLossReasons(),
      getFollowUpEffectiveness(),
      getPipelineVelocity(),
      getWinRateTrajectory({ weeks: 8 }),
    ]);

    const payload = {
      window, target, quotaEurPerQuarter,
      rows, scoreboard, funnels, streaks, pipeline, velocity, quality,
      monthlyTally, needsAttention, deltas, revenue, activity,
      heatmap, recentActivity, pacing,
      coverage, cac, touchpoints, showUp, lossReasons, followUpEff,
      pipelineVelocity, winRateTrajectory,
    };
    _respSet(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
