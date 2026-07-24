import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
import { getObsSnapshot, getCostTrend } from '../../../lib/obs';
import { checkEnv, getSalesConfig, getCronLastRun, getRebuildingState, CRON_CATALOGUE } from '../../../lib/adminInfra';
import { listCreators, SUMMARY_VERSION } from '../../../lib/creators';
import { getAutopilotEnabled } from '../../../lib/discovery';

export const maxDuration = 30;

// Single read endpoint that powers the whole /admin dashboard. Team-gated.
// Everything here is derived from data the system already keeps — LLM metering,
// the cron last-run markers, env presence (booleans only), Redis index state.
export async function GET(request) {
  const u = await getCurrentUser(request);
  if (!u || u.role !== 'team') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [obs, costTrend, sales, autopilotEnabled, rebuilding, creators, ...cronRuns] = await Promise.all([
    getObsSnapshot({ recentErrors: 25 }).catch(() => ({ available: false })),
    getCostTrend(30).catch(() => []),
    getSalesConfig().catch(() => ({})),
    getAutopilotEnabled().catch(() => false),
    getRebuildingState().catch(() => false),
    listCreators().catch(() => []),
    ...CRON_CATALOGUE.map(c => getCronLastRun(c.name).catch(() => null)),
  ]);

  const crons = CRON_CATALOGUE.map((c, i) => ({ ...c, lastRun: cronRuns[i] || null }));

  return NextResponse.json({
    obs,
    costTrend,
    env: checkEnv(),
    data: {
      creators: Array.isArray(creators) ? creators.length : 0,
      summaryVersion: SUMMARY_VERSION,
      rebuilding,
    },
    crons,
    autopilotEnabled,
    sales,
  });
}
