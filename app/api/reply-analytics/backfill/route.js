import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../lib/creators';
import { listUntaggedReplyCreators, invalidateCreatorLoadCache } from '../../../lib/teamStats';

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

const BLAME = ['circumstances', 'other-people', 'self', 'genuine-question', 'positive', 'disqualify'];
const SENT = ['positive', 'neutral', 'negative'];
const REACT = ['liked', 'not-for-me', 'didnt-understand', 'na'];
const norm = (v, allowed) => { const s = (v || '').toLowerCase().trim(); return allowed.includes(s) ? s : null; };

// Compact classify-only call (Haiku). Returns { blame, subtype, sentiment, offerReaction } or null.
async function classifyReply(apiKey, text, ctx) {
  const system = `You classify a creator's reply to our cold outreach (we help creators turn their audience into a paid community / recurring revenue). Output EXACTLY these 4 lines, nothing else:
BLAME: <circumstances|other-people|self|genuine-question|positive|disqualify>
SUBTYPE: <time|money|spouse|self-doubt|price|tried-agencies|content-vs-monetize|how-do-i-know|need-to-think|null>
SENTIMENT: <positive|neutral|negative>
OFFER_REACTION: <liked|not-for-me|didnt-understand|na>

BLAME: positive = interested/wants the video; genuine-question = neutral logistics/info question; circumstances = time/money; other-people = needs a partner/spouse/team; self = self-doubt; disqualify = clearly not a fit / hard no.
SENTIMENT = how they feel about our message and offer.
OFFER_REACTION: liked = understood and interested; not-for-me = understood but declines; didnt-understand = confused about the offer or the video ask; na = pure logistics, not applicable.`;
  const user = `Creator: ${ctx.name || 'Unknown'} (${ctx.niche || 'niche n/a'})
Reply: "${String(text).slice(0, 1200)}"`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const raw = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const grab = (label) => { const m = raw.match(new RegExp(`${label}:\\s*([^\\n]+)`, 'i')); return m ? m[1].trim() : ''; };
  const subtype = grab('SUBTYPE');
  return {
    blame: norm(grab('BLAME'), BLAME),
    subtype: subtype && subtype.toLowerCase() !== 'null' ? subtype.toLowerCase() : null,
    sentiment: norm(grab('SENTIMENT'), SENT),
    offerReaction: norm(grab('OFFER_REACTION'), REACT),
  };
}

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
