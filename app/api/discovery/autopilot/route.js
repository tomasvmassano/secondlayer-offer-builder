import { NextResponse } from 'next/server';
import { getAutopilotStatus, setAutopilotEnabled, startDiscoveryRun, harvestDiscoveryRun } from '../../../lib/discovery';

// Both POST actions return fast now: 'run' only STARTS an Apify run, 'poll'
// checks/harvests it. Neither blocks on the ~90s scrape, so we don't need the
// full cap — but keep headroom for a slow harvest (dataset read + scoring).
export const maxDuration = 60;

// Full status: enabled flag + keyword-matrix count (nicho × geo) + budget.
// The UI reads `keywords` to show what the autopilot searches and to gate the
// on/off toggle. `intentSeeds` remains as a back-compat alias for older reads.
export async function GET() {
  try {
    return NextResponse.json(await getAutopilotStatus());
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    // "Correr agora" step 1 — START one keyword search (async). Returns
    // immediately with a runId; the client then polls (action:'poll') until the
    // scrape finishes and its profiles are evaluated. Ignores the enabled flag.
    if (body.action === 'run') {
      const res = await startDiscoveryRun({ force: true, searchLimit: 10 });
      return NextResponse.json(res);
    }

    // "Correr agora" step 2 — POLL the in-flight run. While RUNNING it reports
    // progress; once SUCCEEDED it evaluates the results, bills spend, logs the
    // run, and returns the outcome. Safe to call repeatedly.
    if (body.action === 'poll') {
      const res = await harvestDiscoveryRun();
      return NextResponse.json(res);
    }

    // Enable/disable the daily autopilot.
    const { enabled } = body;
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled (boolean) required' }, { status: 400 });
    }
    const newValue = await setAutopilotEnabled(enabled);
    return NextResponse.json({ enabled: newValue });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
