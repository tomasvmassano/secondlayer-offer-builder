import { NextResponse } from 'next/server';
import { getReplyAnalytics } from '../../lib/teamStats';

// Aggregated analysis of the classified creator replies (outreach.replyMessages).
// Middleware gates this to a valid session. One memoized full-record load (shared
// with /equipa), so it's cheap on a warm instance.
export const maxDuration = 60;

const _cache = new Map(); // key → { val, expiresAt }
const TTL = 5 * 60_000;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const isCustom = !!(from && to) && dateRe.test(from) && dateRe.test(to);
    const window = isCustom ? 'custom' : (searchParams.get('window') || 'all');
    const valid = ['today', 'yesterday', 'week', 'month', 'quarter', 'ytd', '30d', '90d', 'all'];
    if (!isCustom && !valid.includes(window)) {
      return NextResponse.json({ error: `window must be one of ${valid.join('|')}` }, { status: 400 });
    }

    const key = `${window}|${from || ''}|${to || ''}`;
    const fresh = searchParams.get('fresh') === '1'; // bypass cache after a backfill
    const hit = _cache.get(key);
    if (!fresh && hit && hit.expiresAt > Date.now()) return NextResponse.json(hit.val);

    const data = await getReplyAnalytics({ window, from: isCustom ? from : null, to: isCustom ? to : null });
    _cache.set(key, { val: data, expiresAt: Date.now() + TTL });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
