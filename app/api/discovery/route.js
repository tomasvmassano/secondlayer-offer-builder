import { NextResponse } from 'next/server';
import { listQueue, runDiscoveryForCreator, runBulkDiscovery, runDiscoveryFromSeeds, clearOutOfRange, clearAllDismissed, listBlacklist, unblockHandle } from '../../lib/discovery';

// Allow longer duration for bulk scraping
export const maxDuration = 120;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

    if (view === 'blacklist') {
      const blacklist = await listBlacklist();
      return NextResponse.json(blacklist);
    }

    const queue = await listQueue();
    return NextResponse.json({ queue });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { creatorId, max = 10, action } = body;

    // Reset filters — user loosened ICP and wants previously out-of-range
    // (and optionally all dismissed) candidates to be re-evaluated
    if (action === 'reset_range') {
      const cleared = await clearOutOfRange();
      return NextResponse.json({ cleared });
    }
    if (action === 'reset_all') {
      const cleared = await clearAllDismissed();
      return NextResponse.json({ cleared });
    }
    if (action === 'unblock') {
      const { handle } = body;
      if (!handle) return NextResponse.json({ error: 'handle required' }, { status: 400 });
      const removed = await unblockHandle(handle);
      return NextResponse.json({ unblocked: removed, handle });
    }

    // Per-creator run
    if (creatorId) {
      const result = await runDiscoveryForCreator(creatorId, max);
      if (result.error) return NextResponse.json(result, { status: 404 });
      return NextResponse.json(result);
    }

    // Seed-based run — user pasted Instagram URLs
    if (Array.isArray(body.seeds) && body.seeds.length > 0) {
      const result = await runDiscoveryFromSeeds(body.seeds, max);
      return NextResponse.json(result);
    }

    // Bulk run across entire CRM
    const result = await runBulkDiscovery(max);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
