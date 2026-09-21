import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { logError } from '../../../../lib/obs';
import { ensureIntel, PipelineStop } from '../../../../lib/outreachPipeline';

// POST /api/creators/:id/intel   body: { force? }
//
// Stage 1 on its own: make sure this creator has a current intelligence object
// (one scrape + one analysis, reused for 30 days) and return it. The DM writer
// calls this before generating, so the Instagram DM is built from the same
// reading as the email and the WhatsApp message instead of its own scrape.
export const maxDuration = 60;

export async function POST(request, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY em falta' }, { status: 500 });
  const creator = await getCreator(id);
  if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

  const cost = { llmUsd: 0, apifyUsd: 0 };
  try {
    const { intel, fresh } = await ensureIntel(creator, { apiKey, cost, force: body?.force === true });
    if (fresh) await updateCreator(id, { outreachIntel: intel }, { skipIndexIfUnchanged: true });
    return NextResponse.json({ id, outcome: 'ok', reused: !fresh, cost, intel });
  } catch (err) {
    if (err instanceof PipelineStop) {
      return NextResponse.json({ id, outcome: err.outcome, cost, ...err.extra }, { status: err.outcome === 'rate_limited' ? 429 : 200 });
    }
    logError('outreach-intel', err, { creatorId: id }).catch(() => {});
    return NextResponse.json({ id, outcome: 'error', cost, error: err?.message || 'erro' });
  }
}
