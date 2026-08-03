import { NextResponse } from 'next/server';
import { getAutopilotStatus, setAutopilotEnabled, runDiscoveryAutopilot } from '../../../lib/discovery';

// One manual pass can scrape for a while (seed + candidates). Give it room.
export const maxDuration = 60;

// Full status: enabled flag + seed pool counts (intentSeeds = warm "Pediu
// vídeo"/signed leads, manualSeeds = hand-curated) + budget. The UI needs
// intentSeeds to show that discovery seeds itself from the warm leads and to
// let the toggle enable on warm leads alone.
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

    // "Correr agora" — run one budget-capped pass on demand, seeded from the
    // warm leads (+ manual seeds), regardless of the enabled flag.
    if (body.action === 'run') {
      const res = await runDiscoveryAutopilot({ force: true });
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
