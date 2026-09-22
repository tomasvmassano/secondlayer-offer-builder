import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
import { getRouteCosts } from '../../../lib/obs';

// GET /api/admin/costs?days=40 — measured Anthropic spend per route over the
// last N days (max 40, the counters' retention). Team only.
export async function GET(request) {
  const u = await getCurrentUser(request);
  if (!u || u.role !== 'team') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const days = Number(new URL(request.url).searchParams.get('days')) || 40;
  return NextResponse.json(await getRouteCosts(days));
}
