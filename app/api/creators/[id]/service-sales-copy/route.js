import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { validateServiceSalesCopy } from '../../../../lib/schemas/serviceSalesCopy';
import { OPERATOR_INSTRUCTIONS_RULE, formatInstructionsBlock, formatInstructionsReminder } from '../../../../lib/operatorInstructions';
import { repairJsonWithHaiku } from '../../../../lib/jsonRepair';
import { recordLlmUsage, logError } from '../../../../lib/obs';

// Sales copy for the productized-service offer (slice 2). Runs on top of
// a generated service_offer. Sonnet 4.5 — copy needs voice + nuance.
// ~$0.05/run. Persists internal_metadata.service_sales_copy.
export const maxDuration = 60;

const SYSTEM_PROMPT = `# PRODUCTIZED SERVICE — SALES COPY

You write the sales layer for a DONE-FOR-YOU service offer. The offer already exists (name, deliverable, process, packages, positioning). Your job is to turn it into copy that SELLS — objections handled, FAQ answered, risk reversed, and a ready-to-send DM.

## RULES
- **Creator's voice.** Match the voice summary provided. No corporate filler, no "unlock/elevate/seamless", no hype the creator wouldn't say out loud.
- **Buyer's objections, not yours.** For a productized service the real objections are: "how do I know it'll actually be good?", "why not just hire someone cheaper on Fiverr/an agency?", "what if I don't like the result?", "is my case too specific for a templatized process?", "why is it this price?". Write the objections in the BUYER's voice and rebut in the CREATOR's voice.
- **Risk reversal is everything for a service.** A stranger paying upfront for bespoke work needs a reason to trust. Write a genuine guarantee if one is plausible (revision rounds, satisfaction-or-fix, milestone check-ins). If the creator genuinely can't offer one, set guarantee to null — do NOT invent a refund they can't honour.
- **The DM is the operator's main tool.** outreach_dm is a short message the operator pastes to a warm lead (someone who engaged) to pitch this service. Personal, specific, one clear ask. NOT a generic broadcast. Keep it tight — this lands in an Instagram DM.
- **Ground everything in the offer + frame provided.** Don't contradict the packages or the positioning.

## OUTPUT — RETURN ONLY THIS JSON OBJECT (no prose, no markdown, no commentary)

{
  "hero": {
    "headline": "string ≤100 chars — the promise as a sales line",
    "sub": "string ≤240 chars — who it's for + what they get, one line",
    "cta": "string ≤40 chars — button/label text"
  },
  "differentiator": "string ≤700 chars — why this beats (a) an agency and (b) doing it themselves. Benefit-led prose, not a feature list.",
  "objections": [                                   // 3-6
    { "objection": "string ≤160 chars — buyer voice", "rebuttal": "string ≤320 chars — creator voice" }
  ],
  "faq": [                                          // 4-8
    { "q": "string ≤160 chars", "a": "string ≤460 chars" }
  ],
  "guarantee": "string ≤300 chars OR null — a genuine risk-reversal. null ONLY if none is plausible.",
  "social_proof_angle": "string ≤300 chars OR null — what proof to show + how to frame it (guidance, since real testimonials may not exist yet)",
  "outreach_dm": "string ≤900 chars — a ready-to-send DM to a warm lead, creator voice, one clear ask"
}

HARD CHAR CAPS: the ≤N values are ceilings, not targets. Aim 70-80% of cap.

${OPERATOR_INSTRUCTIONS_RULE}`;

function tryParseJson(text) {
  if (!text) return null;
  let s = String(text).trim().replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\`\`\`\s*$/i, '').trim();
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (depth === 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

function buildUserMessage(creator, svc, extraInstruction) {
  const meta = creator.offer?.internal_metadata || {};
  const frame = meta.strategic_frame || {};
  const uniqueness = meta.uniqueness_extraction || {};

  const pkgBlock = (svc.packages || []).map(p => {
    const price = p.price ? `${p.price.amount} ${p.price.currency} (${p.price.model})` : '?';
    return `  - ${p.name} — ${price}${p.best_for ? ' · ' + p.best_for : ''}\n    inclui: ${(p.whats_included || []).join('; ')}`;
  }).join('\n');

  const offerBlock = `## THE SERVICE OFFER (already generated — sell THIS)
name: ${svc.service_name}
promise: ${svc.central_promise}
deliverable: ${svc.core_deliverable}
turnaround: ${svc.turnaround} · format: ${svc.delivery_format}
positioning: ${svc.positioning}
process: ${(svc.process_steps || []).map(s => s.name).join(' → ')}
who it's for: ${(svc.who_its_for || []).join('; ')}
who it's NOT for: ${(svc.who_its_not_for || []).join('; ')}
packages:
${pkgBlock || '  (none)'}`;

  const frameBlock = `## STRATEGIC CONTEXT
dominant_transformation: ${frame.dominant_transformation || '(none)'}
positioning_tension: ${frame.positioning_tension || '(none)'}
audience_segment: ${frame.audience_segment?.description || '(none)'}`;

  const voiceBlock = `## CREATOR VOICE (match this exactly)
${uniqueness.creator_voice_summary || '(no voice summary — write natural, direct, human)'}`;

  const creatorBlock = `## CREATOR
name: ${creator.name || 'Unknown'}
niche: ${creator.niche || 'Unknown'}`;

  const langHint = creator?.primaryLanguage === 'en'
    ? 'LANGUAGE: Output every string field in ENGLISH.'
    : creator?.primaryLanguage === 'es'
    ? 'LANGUAGE: Output every string field in Castilian Spanish (España, "tú" form).'
    : 'LANGUAGE: Output every string field in PORTUGUESE (PT-PT).';

  return `Write the sales copy for the service offer below.

${formatInstructionsBlock(extraInstruction)}${langHint}

${creatorBlock}

${offerBlock}

${frameBlock}

${voiceBlock}

Return ONLY the JSON object per the schema in the system prompt.${formatInstructionsReminder(extraInstruction)}`;
}

export async function POST(request, { params }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  try {
    const { id } = await params;
    const creator = await getCreator(id);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    const svc = creator.offer?.internal_metadata?.service_offer;
    if (!svc) {
      return NextResponse.json({ error: 'Sem oferta de serviço. Gera a oferta primeiro.' }, { status: 412 });
    }

    const body = await request.json().catch(() => ({}));
    const instruction = typeof body?.instruction === 'string' && body.instruction.trim()
      ? body.instruction.trim().slice(0, 1000)
      : null;

    const userMessage = buildUserMessage(creator, svc, instruction);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(50000),
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 3500,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return NextResponse.json({ error: data.error?.message || `Anthropic ${resp.status}` }, { status: 502 });
    }
    if (data?.usage) recordLlmUsage({ route: 'service-sales-copy', model: 'claude-sonnet-4-5-20250929', usage: data.usage }).catch(() => {});

    const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    let parsed = tryParseJson(rawText);
    if (!parsed) {
      parsed = await repairJsonWithHaiku(apiKey, rawText, tryParseJson);
      if (!parsed) {
        return NextResponse.json({
          error: 'Model returned non-JSON output (re-clica Gerar)',
          errors: [`stop_reason: ${data.stop_reason || '?'}`, `output_tokens: ${data.usage?.output_tokens ?? '?'} (cap: 3500)`, `tail: ${rawText.slice(-300)}`],
        }, { status: 502 });
      }
    }

    const validation = validateServiceSalesCopy(parsed);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Schema validation failed', errors: validation.errors, raw: parsed }, { status: 502 });
    }

    const existingOffer = creator.offer || {};
    const existingMeta = existingOffer.internal_metadata || {};
    await updateCreator(id, {
      offer: {
        ...existingOffer,
        internal_metadata: {
          ...existingMeta,
          service_sales_copy: parsed,
          generation_timestamps: {
            ...(existingMeta.generation_timestamps || {}),
            service_sales_copy: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({ ok: true, service_sales_copy: parsed, _diagnostics: { output_tokens: data.usage?.output_tokens ?? null } });
  } catch (err) {
    logError('service-sales-copy', err).catch(() => {});
    return NextResponse.json({ error: err?.message || 'unknown' }, { status: 500 });
  }
}
