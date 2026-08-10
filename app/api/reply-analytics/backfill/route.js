import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../lib/creators';
import { listUntaggedReplyCreators, invalidateCreatorLoadCache } from '../../../lib/teamStats';
import { classifyReply } from '../../../lib/replyClassifier';

// Backfill worker for the Respostas dashboard. Classifies OLD replies that were
// stored before sentiment/offer-reaction tagging existed, so they land in the
// right buckets. Classify-only (tags, no response draft), on a cheap/fast model.
//
//   GET  → { creators: [{id,name,count}], total }  — the work list.
//   POST { creatorId } → classifies that creator's untagged replies, writes the
//         tags back onto outreach.replyMessages[].ai, returns { classified }.
//
// The client (Respostas page) loops POST per creator, exactly like Bulk Audit.
export const maxDuration = 60;

export async function GET() {
  try {
    const creators = await listUntaggedReplyCreators();
    const total = creators.reduce((s, c) => s + c.count, 0);
    return NextResponse.json({ creators, total });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  try {
    const { creatorId } = await request.json().catch(() => ({}));
    if (!creatorId) return NextResponse.json({ error: 'creatorId required' }, { status: 400 });
    const c = await getCreator(creatorId);
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const msgs = Array.isArray(c.outreach?.replyMessages) ? c.outreach.replyMessages : [];
    let classified = 0;
    const next = [];
    for (const m of msgs) {
      if (m?.content && !m.ai?.blame) {
        const tags = await classifyReply(apiKey, m.content, { name: c.name, niche: c.niche });
        if (tags?.blame) {
          classified++;
          next.push({ ...m, ai: { ...(m.ai || {}), ...tags, backfilledAt: new Date().toISOString() } });
          continue;
        }
      }
      next.push(m);
    }

    if (classified > 0) {
      await updateCreator(creatorId, { outreach: { ...c.outreach, replyMessages: next } });
      invalidateCreatorLoadCache(); // so the dashboard reflects the new tags on refresh
    }
    return NextResponse.json({ ok: true, classified });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
