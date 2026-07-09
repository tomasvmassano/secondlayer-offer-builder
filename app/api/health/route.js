import { NextResponse } from 'next/server';
import { getObsSnapshot } from '../../lib/obs';

// Session-gated (middleware protects /api/*). Returns the observability
// snapshot: today's + yesterday's LLM spend, per-route breakdown, error
// counts, and the most recent errors. The operator-facing surface for
// "what did we spend and what's breaking" without a Sentry dependency.
export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = await getObsSnapshot({ recentErrors: 30 });
  return NextResponse.json(snapshot);
}
