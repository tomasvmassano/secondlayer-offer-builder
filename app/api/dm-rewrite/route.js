import { NextResponse } from 'next/server';

export const maxDuration = 60;
import { appendSignature } from '../../lib/operatorSignature';

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

  // Canonical language code — 'en' | 'pt' | 'es' (Castilian). Accepts the
  // raw codes plus the long names ("English", "Portuguese", "Spanish",
  // "Español") so existing callers keep working. Default is PT for
  // back-compat with legacy callers that pre-date language routing.
  const raw = (language || '').toString().toLowerCase();
  const lang = raw.startsWith('en') ? 'en'
             : (raw.startsWith('es') || raw.startsWith('span') || raw.startsWith('espa')) ? 'es'
             : 'pt';
  const langLabel = lang === 'en' ? 'natural English'
                  : lang === 'es' ? 'Castilian Spanish (España), always "tú", never "vos" or "usted"'
                  : 'European Portuguese (NOT Brazilian, always "tu", never "você")';

  // Paired mode: when currentEmail is supplied we rewrite BOTH the DM and
  // the Day 1 email in a single Claude call. The DM and email say the same
  // thing in two formats — applying the same operator feedback to both
  // keeps them consistent without doubling the cost (one cached system
  // prompt, one call, marginal extra output tokens for the email).
  const isPair = !!(currentEmail && (currentEmail.subject || currentEmail.body));

  // 1000-char Instagram cap — anything over gets silently truncated when
  // pasted into the IG inbox. The DM-only rewrite enforces it on the
  // single output; the paired-rewrite enforces it on the ===DM=== section.
  const DM_HARD_CAP = 1000;
  const isDmRewrite = touchpointKey === 'dm';

  const systemTextSingle = `You rewrite outreach messages for Second Layer. Rules:
- Write like a real person, peer to peer. Not an agency pitch.
- NEVER use dashes (—, –, -) as punctuation.
- NEVER mention pricing, commission, %, business model, "partnership", "collaboration", "proposal", "agency", or "services".
- Keep the same tone and format as the original.
- Write in the EXACT language specified in the user message. Do NOT translate. Do NOT switch languages.${isDmRewrite ? `
- HARD CHARACTER CAP: the rewritten DM (including greeting, blank lines, and sign-off) MUST be ${DM_HARD_CAP} characters or fewer. Instagram silently truncates above this. If you're approaching the cap, shorten the observation first, then tighten the question. Never cut the greeting or sign-off.` : ''}
- Output ONLY the rewritten message. No explanation, no preamble.`;

  const systemTextPair = `You rewrite a paired outreach unit for Second Layer: the cold DM + the Day 1 email. Both say the SAME thing in two formats — the DM is the short version, the email is the longer written version with one extra paragraph of context. They MUST stay consistent: same observation, same pitch, same close, same voice.

Rules:
- Write like a real person, peer to peer. Not an agency pitch.
- NEVER use dashes (—, –, -) as punctuation.
- NEVER mention pricing, commission, %, business model, "partnership", "collaboration", "proposal", "agency", or "services".
- Apply the operator's feedback to BOTH messages. If they say "make it sharper", both get sharper. If they say "mention the podcast", both reference the podcast.
- Preserve each format's scaffold:
  - DM: short, no email-style greeting, no subject. Pure body. HARD CHARACTER CAP ${DM_HARD_CAP}: the entire DM section (greeting + blocks + sign-off) MUST be ${DM_HARD_CAP} characters or fewer. Instagram silently truncates above this. The email is NOT capped — it can be longer.
  - Email: keep the greeting line ("Olá X" / "Hey X" / "Hola X"), the Instagram acknowledgement opener ("Enviei mensagem para o Instagram, mas..." / "I also messaged you on Instagram but..." / "Te envié mensaje por Instagram, pero..."), the partnership-frame line, the video CTA, the soft close ("Faz sentido?" / "Does it make sense?" / "¿Tiene sentido?"), and the sign-off ("Abraço,", "Cheers,", "Un abrazo,"). The OBSERVATION + PITCH paragraphs absorb the rewrite; the scaffold stays.
- Write in the EXACT language specified in the user message. Do NOT translate. Do NOT switch languages.
- Output strictly in this format (no preamble, no commentary):

===DM===
[rewritten DM, ready to paste — MUST be ≤ ${DM_HARD_CAP} chars]
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
        model: 'claude-sonnet-4-5-20250929',
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

    // Helper — one shot at compressing an over-cap DM. Same pattern as
    // dm-writer's overflow handler: send the over-long text back to Claude
    // with a tight "shorten while preserving observation + question + voice"
    // instruction. Returns the trimmed string when the compression actually
    // fits; otherwise returns null so the caller can decide what to do.
    async function compressDm(overLongDm) {
      const compressSystem = `You are a copy editor compressing a cold Instagram DM. The DM below is ${overLongDm.length} characters (over the ${DM_HARD_CAP}-char Instagram limit). Rewrite it to be ≤ ${DM_HARD_CAP} characters total INCLUDING the greeting, blank lines, and sign-off.

Rules:
- Keep the same observation, same question, same voice. Do NOT add new content.
- Shorten the observation first by one sentence. Tighten the question if still over.
- Preserve the greeting and sign-off lines exactly.
- ZERO em dashes, en dashes, or " - " punctuation.
- Output ONLY the rewritten DM. No commentary.`;
      const compressRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1500,
          system: [{ type: 'text', text: compressSystem }],
          messages: [{ role: 'user', content: overLongDm }],
        }),
      });
      if (!compressRes.ok) return null;
      const compressData = await compressRes.json();
      const shrunk = (compressData.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
      return (shrunk && shrunk.length <= DM_HARD_CAP) ? shrunk : null;
    }

    if (!isPair) {
      let out = rawText;
      let overflow = null;
      // Only enforce the cap when the operator is rewriting the DM itself.
      // Touchpoints like emails/comments are not Instagram-bound.
      if (isDmRewrite && out.length > DM_HARD_CAP) {
        const shrunk = await compressDm(out).catch(() => null);
        if (shrunk) out = shrunk;
        else overflow = { length: out.length, cap: DM_HARD_CAP };
      }
      // Email rewrites get the operator's contact card appended. DMs never
      // do — Instagram has no signature concept and the 1000-char cap
      // can't afford the extra lines. The signature helper is a no-op when
      // the sender isn't on the hardcoded operator list.
      if (!isDmRewrite) {
        out = appendSignature(out, senderName);
      }
      return NextResponse.json({ rewritten: out, ...(overflow ? { dm_overflow: overflow } : {}) });
    }

    // Parse delimited sections. Tolerant of extra whitespace and missing
    // sections (when the model drops one, we fall back to the original
    // so the operator isn't left with empty content).
    const extract = (start, end) => {
      const re = new RegExp(`===${start}===\\s*([\\s\\S]*?)(?====${end || ''}===|$)`);
      const m = rawText.match(re);
      return m ? m[1].trim() : '';
    };
    let rewrittenDm = extract('DM', 'EMAIL_SUBJECT') || currentContent;
    const rewrittenSubject = extract('EMAIL_SUBJECT', 'EMAIL') || currentEmail?.subject || '';
    const rewrittenBody = extract('EMAIL', '') || currentEmail?.body || '';

    // Same overflow guard for the paired DM. The email half is not capped.
    let dmOverflow = null;
    if (rewrittenDm.length > DM_HARD_CAP) {
      const shrunk = await compressDm(rewrittenDm).catch(() => null);
      if (shrunk) rewrittenDm = shrunk;
      else dmOverflow = { length: rewrittenDm.length, cap: DM_HARD_CAP };
    }

    // Signature goes on the email body only. The DM stays sig-less because
    // Instagram doesn't render signatures and the 1000-char cap is already
    // tight. appendSignature is a no-op if the sender isn't on the
    // hardcoded operator list, so unknown senders pass through unchanged.
    const rewrittenBodyWithSig = appendSignature(rewrittenBody, senderName);

    return NextResponse.json({
      rewritten: rewrittenDm,
      rewrittenEmail: { subject: rewrittenSubject, body: rewrittenBodyWithSig },
      ...(dmOverflow ? { dm_overflow: dmOverflow } : {}),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
