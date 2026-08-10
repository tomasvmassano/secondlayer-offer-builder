import { NextResponse } from 'next/server';
import { classifyReply } from '../../../lib/replyClassifier';

// Tags a creator reply for the Respostas analytics (blame/subtype/sentiment/
// offerReaction). No response draft — the DM reply suggestion was removed. Cheap
// classify-only call. Middleware gates this to a valid session.
export const maxDuration = 30;

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  try {
    const body = await request.json().catch(() => ({}));
    const text = body.creatorReply || body.text;
    if (!text) return NextResponse.json({ error: 'Missing reply text' }, { status: 400 });
    const tags = await classifyReply(apiKey, text, { name: body.creatorName || body.creator?.name, niche: body.niche || body.creator?.niche });
    if (!tags) return NextResponse.json({ error: 'Classification failed' }, { status: 502 });
    return NextResponse.json({
      detectedBlame: tags.blame,
      subType: tags.subtype,
      sentiment: tags.sentiment,
      offerReaction: tags.offerReaction,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
