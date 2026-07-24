import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
import { flushReadCache, rebuildAllSummaries } from '../../../lib/creators';

// Team-gated data-ops for /admin. Maintenance actions that were previously only
// implicit (self-healing) — surfaced as explicit buttons.
export const maxDuration = 60;

export async function POST(request) {
  const u = await getCurrentUser(request);
  if (!u || u.role !== 'team') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  try {
    if (action === 'flush-cache') {
      flushReadCache();
      return NextResponse.json({ ok: true, action, message: 'Cache de leitura limpa nesta instância.' });
    }
    if (action === 'rebuild-index') {
      const res = await rebuildAllSummaries();
      return NextResponse.json({ ok: true, action, message: `Reindex concluído · ${res.rebuilt} criadores.`, ...res });
    }
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'erro na ação' }, { status: 500 });
  }
}
