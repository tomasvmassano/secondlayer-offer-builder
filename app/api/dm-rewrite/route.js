import { NextResponse } from 'next/server';

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'No API key' }, { status: 500 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { touchpointKey, currentContent, currentEmail, instruction, creatorName, senderName, language } = body;
  if (!touchpointKey || !currentContent) {
    return NextResponse.json({ error: 'Missing touchpointKey or currentContent' }, { status: 400 });
  }

  // Canonical language code — 'en' if explicitly english-ish, else 'pt'.
  // Accepts 'en' / 'pt' / 'English' / 'Portuguese' so existing callers keep
  // working. Previously this route hardcoded a PT-default which silently
  // translated English creators' DMs back to Portuguese on every rewrite.
  const lang = (language || '').toString().toLowerCase().startsWith('en') ? 'en' : 'pt';
  const langLabel = lang === 'en' ? 'natural English' : 'European Portuguese (NOT Brazilian, always "tu", never "você")';

  // Paired mode: when currentEmail is supplied we rewrite BOTH the DM and
  // the Day 1 email in a single Claude call. The DM and email say the same
  // thing in two formats — applying the same operator feedback to both
  // keeps them consistent without doubling the cost (one cached system
  // prompt, one call, marginal extra output tokens for the email).
  const isPair = !!(currentEmail && (currentEmail.subject || currentEmail.body));

  const systemTextSingle = `You rewrite outreach messages for Second Layer. Rules:
- Write like a real person, peer to peer. Not an agency pitch.
- NEVER use dashes (—, –, -) as punctuation.
- NEVER mention pricing, commission, %, business model, "partnership", "collaboration", "proposal", "agency", or "services".
- Keep the same tone and format as the original.
- Write in the EXACT language specified in the user message. Do NOT translate. Do NOT switch languages.
- Output ONLY the rewritten message. No explanation, no preamble.`;

  const systemTextPair = `You rewrite a paired outreach unit for Second Layer: the cold DM + the Day 1 email. Both say the SAME thing in two formats — the DM is the short version, the email is the longer written version with one extra paragraph of context. They MUST stay consistent: same observation, same pitch, same close, same voice.

Rules:
- Write like a real person, peer to peer. Not an agency pitch.
- NEVER use dashes (—, –, -) as punctuation.
- NEVER mention pricing, commission, %, business model, "partnership", "collaboration", "proposal", "agency", or "services".
- Apply the operator's feedback to BOTH messages. If they say "make it sharper", both get sharper. If they say "mention the podcast", both reference the podcast.
- Preserve each format's scaffold:
  - DM: short, no email-style greeting, no subject. Pure body.
  - Email: keep the greeting line ("Olá X" / "Hey X"), the Instagram acknowledgement opener ("Enviei mensagem para o Instagram, mas..." / "I also messaged you on Instagram but..."), the partnership-frame line, the video CTA, the soft close ("Faz sentido?" / "Does it make sense?"), and the sign-off. The OBSERVATION + PITCH paragraphs absorb the rewrite; the scaffold stays.
- Write in the EXACT language specified in the user message. Do NOT translate. Do NOT switch languages.
- Output strictly in this format (no preamble, no commentary):

===DM===
[rewritten DM, ready to paste]
===EMAIL_SUBJECT===
[rewritten subject line — keep close to original unless operator feedback demands change]
===EMAIL===
[rewritten email body, ready to paste]`;

  const systemText = isPair ? systemTextPair : systemTextSingle;
  const userMessageSingle = `Rewrite this ${touchpointKey} for creator "${creatorName || 'this creator'}".

## LANGUAGE
Write in ${langLabel}. The original (below) is in ${langLabel}. Keep it that way.

## CURRENT VERSION
${currentContent}

${instruction ? `## INSTRUCTIONS FOR REWRITE\n${instruction}` : '## INSTRUCTION\nJust improve it — make it feel more natural and human.'}

## SENDER
${senderName || 'Raul'}

Write ONLY the rewritten message in ${langLabel}. Nothing else.`;

  const userMessagePair = `Rewrite the cold DM + Day 1 email pair for creator "${creatorName || 'this creator'}".

## LANGUAGE
Write in ${langLabel}. The originals (below) are in ${langLabel}. Keep it that way.

## CURRENT DM
${currentContent}

## CURRENT EMAIL
Subject: ${currentEmail?.subject || ''}

${currentEmail?.body || ''}

${instruction ? `## INSTRUCTIONS FOR REWRITE (applies to BOTH)\n${instruction}` : '## INSTRUCTION\nJust improve both — same observation, same pitch, sharper voice. Apply consistently to DM + email.'}

## SENDER
${senderName || 'Raul'}

Output the three delimited sections in ${langLabel}. Nothing else.`;

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
        // Paired mode needs more output room: DM + subject + email body
        // ≈ 1500-2200 tokens. Single-message stays 1500.
        max_tokens: isPair ? 3000 : 1500,
        system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: isPair ? userMessagePair : userMessageSingle }],
      }),
    });

    const data = await r.json();
    if (!r.ok) return NextResponse.json({ error: data.error?.message || 'Rewrite failed' }, { status: 500 });

    const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');

    if (!isPair) {
      return NextResponse.json({ rewritten: rawText });
    }

    // Parse delimited sections. Tolerant of extra whitespace and missing
    // sections (when the model drops one, we fall back to the original
    // so the operator isn't left with empty content).
    const extract = (start, end) => {
      const re = new RegExp(`===${start}===\\s*([\\s\\S]*?)(?====${end || ''}===|$)`);
      const m = rawText.match(re);
      return m ? m[1].trim() : '';
    };
    const rewrittenDm = extract('DM', 'EMAIL_SUBJECT') || currentContent;
    const rewrittenSubject = extract('EMAIL_SUBJECT', 'EMAIL') || currentEmail?.subject || '';
    const rewrittenBody = extract('EMAIL', '') || currentEmail?.body || '';

    return NextResponse.json({
      rewritten: rewrittenDm,
      rewrittenEmail: { subject: rewrittenSubject, body: rewrittenBody },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
