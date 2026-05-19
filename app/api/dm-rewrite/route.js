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

  // Canonical language code — 'en' if explicitly english-ish, else 'pt'.
  // Accepts 'en' / 'pt' / 'English' / 'Portuguese' so existing callers keep
  // working. Previously this route hardcoded a PT-default which silently
  // translated English creators' DMs back to Portuguese on every rewrite.
  const lang = (language || '').toString().toLowerCase().startsWith('en') ? 'en' : 'pt';
  const langLabel = lang === 'en' ? 'natural English' : 'European Portuguese (NOT Brazilian, always "tu", never "você")';

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
        system: [{ type: 'text', text: `You rewrite outreach messages for Second Layer. Rules:
- Write like a real person, peer to peer. Not an agency pitch.
- NEVER use dashes (—, –, -) as punctuation.
- NEVER mention pricing, commission, %, business model, "partnership", "collaboration", "proposal", "agency", or "services".
- Keep the same tone and format as the original.
- Write in the EXACT language specified in the user message. Do NOT translate. Do NOT switch languages. If the user message says "Write in natural English", the output MUST be English. If it says "European Portuguese", output MUST be European Portuguese.
- Output ONLY the rewritten message. No explanation, no preamble.`, cache_control: { type: 'ephemeral' } }],
        messages: [{
          role: 'user',
          content: `Rewrite this ${touchpointKey} for creator "${creatorName || 'this creator'}".

## LANGUAGE
Write in ${langLabel}. The original (below) is in ${langLabel}. Keep it that way.

## CURRENT VERSION
${currentContent}

${instruction ? `## INSTRUCTIONS FOR REWRITE\n${instruction}` : '## INSTRUCTION\nJust improve it — make it feel more natural and human.'}

## SENDER
${senderName || 'Raul'}

Write ONLY the rewritten message in ${langLabel}. Nothing else.`,
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
