import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
import { harvestDiscoveryRun, startDiscoveryRun, getAutopilotStatus } from '../../../lib/discovery';
import { recordCronRun } from '../../../lib/adminInfra';

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────
// Discovery autopilot — weekday creator-feed filler.
//
// A keyword search + details scrape takes ~90s (Instagram throttles the actor
// to ~11s/profile), which can't fit one 60s invocation. So discovery is async:
// each firing HARVESTS the run started last time (evaluate → GO/NO GO →
// Discovery queue) and then STARTS the next keyword's run for the following
// firing to harvest. One keyword rotates in per weekday; the matrix cycles on
// its own. Every start is bounded by the monthly $ cap + daily GO target, so it
// can never overspend, and it stays inert until the autopilot flag is ON.
// ─────────────────────────────────────────────────────────────────
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed in production: this route SPENDS money, so never let it run
  // publicly if the secret ever disappears from the env.
  if (!cronSecret && process.env.VERCEL) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  const bySecret = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const byTeam = !bySecret && (await getCurrentUser(request))?.role === 'team';
  if (cronSecret && !bySecret && !byTeam) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let harvest, start;
  try {
    // 1. Harvest whatever the previous firing started (no-op if idle/running).
    harvest = await harvestDiscoveryRun();
    // 2. Start the next keyword's run (respects the enabled flag + budget).
    start = await startDiscoveryRun({ force: false });
  } catch (err) {
    await recordCronRun('discovery-autopilot', { ok: false, summary: err.message }).catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const b = await getAutopilotStatus().catch(() => ({}));
  const harvestPart = harvest.status === 'done'
    ? `harvest: ${harvest.queued ?? 0} GO de ${harvest.scanned ?? 0} ("${harvest.keyword}")`
    : `harvest: ${harvest.status}`;
  const startPart = start.started
    ? `start: "${start.keyword}"`
    : `start: ${start.reason || (start.alreadyRunning ? 'já a correr' : 'nenhum')}`;
  await recordCronRun('discovery-autopilot', {
    ok: harvest.status !== 'failed',
    summary: `${harvestPart} · ${startPart} · ${b.goToday ?? '?'}/${b.dailyTarget ?? '?'} hoje · $${b.spent ?? '?'}/${b.cap ?? '?'}`,
  }).catch(() => {});

  return NextResponse.json({ harvest, start });
}
