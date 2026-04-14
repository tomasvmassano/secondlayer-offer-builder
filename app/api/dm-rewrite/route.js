import { NextResponse } from 'next/server';

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'No API key' }, { status: 500 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { touchpointKey, currentContent, instruction, creatorName, senderName, language } = body;
  if (!touchpointKey || !currentContent) {
    return NextResponse.json({ error: 'Missing touchpointKey or currentContent' }, { status: 400 });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: `You rewrite outreach messages for Second Layer. Rules:
- Write like a real person, peer to peer. Not an agency pitch.
- NEVER use dashes (—, –, -) as punctuation.
- NEVER mention pricing, commission, %, business model, "partnership", "collaboration", "proposal", "agency", or "services".
- Keep the same tone and format as the original.
- Default to Portuguese unless told otherwise.
- Output ONLY the rewritten message. No explanation, no preamble.`,
        messages: [{
          role: 'user',
          content: `Rewrite this ${touchpointKey} for creator "${creatorName || 'this creator'}".

CURRENT VERSION:
${currentContent}

${instruction ? `INSTRUCTIONS FOR REWRITE:\n${instruction}` : 'Just improve it — make it feel more natural and human.'}

Sender: ${senderName || 'Tomás'}
Language: ${language || 'Portuguese'}

Write ONLY the rewritten message. Nothing else.`,
        }],
      }),
    });

    const data = await r.json();
    if (!r.ok) return NextResponse.json({ error: data.error?.message || 'Rewrite failed' }, { status: 500 });

    const rewritten = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    return NextResponse.json({ rewritten });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
