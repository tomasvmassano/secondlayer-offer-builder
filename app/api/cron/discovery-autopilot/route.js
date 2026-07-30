import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
import { runDiscoveryAutopilot } from '../../../lib/discovery';
import { recordCronRun } from '../../../lib/adminInfra';

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────
// Discovery autopilot — weekday creator-feed filler.
//
// One budget-capped discovery batch per invocation (seed → related profiles →
// GO/NO GO → Discovery queue), then a best-effort self-chain to keep filling
// until the daily GO target or the monthly $ cap. Vercel's 60s cap means one
// invocation only clears a small batch, so the self-chain fans out follow-up
// runs; every firing is bounded by THREE independent guards inside
// runDiscoveryAutopilot (monthly cap · per-run scrape cap · daily target), so
// it can never overspend no matter how many times it fires.
//
// Stays inert until the autopilot flag is ON (Discovery tab / /admin), so it
// never spends by accident.
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

  const { searchParams } = new URL(request.url);
  const chain = Number(searchParams.get('chain')) || 0;
  const MAX_CHAINS = Number(process.env.DISCOVERY_MAX_CHAINS) || 12;

  let res;
  try {
    res = await runDiscoveryAutopilot({ maxScrapesPerRun: 12 });
  } catch (err) {
    await recordCronRun('discovery-autopilot', { ok: false, summary: err.message }).catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  // Best-effort self-chain while there's work + budget. Fire-and-forget: on a
  // frozen serverless instance it may not always fire, and that's fine — the
  // next scheduled/manual run resumes exactly where this left off (queued and
  // dismissed handles are skipped on the next pass), and the guards keep every
  // firing safe. Only chains on the trusted secret path, never a team session.
  let chained = false;
  if (res.ok && !res.done && chain < MAX_CHAINS && bySecret) {
    try {
      const next = new URL(request.url);
      next.searchParams.set('chain', String(chain + 1));
      fetch(next.toString(), { headers: { Authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      chained = true;
    } catch { /* self-chain is best-effort */ }
  }

  // Record the run once per chain (on the first link), so /admin shows one row.
  if (chain === 0) {
    const b = res.budget || {};
    await recordCronRun('discovery-autopilot', {
      ok: res.ok !== false,
      summary: `${res.queued ?? 0} GO · ${b.goToday ?? '?'}/${b.dailyTarget ?? '?'} hoje · $${b.spent ?? '?'}/${b.cap ?? '?'}${res.reason ? ` · ${res.reason}` : ''}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ...res, chain, chained });
}
