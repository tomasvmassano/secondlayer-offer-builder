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

    return NextResponse.json({
      window, target, quotaEurPerQuarter,
      rows, scoreboard, funnels, streaks, pipeline, velocity, quality,
      monthlyTally, needsAttention, deltas, revenue, activity,
      heatmap, recentActivity, pacing,
      coverage, cac, touchpoints, showUp, lossReasons, followUpEff,
      pipelineVelocity, winRateTrajectory,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
