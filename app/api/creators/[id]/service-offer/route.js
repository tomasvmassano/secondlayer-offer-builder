import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { validateServiceOffer } from '../../../../lib/schemas/productizedService';
import { OPERATOR_INSTRUCTIONS_RULE, formatInstructionsBlock, formatInstructionsReminder } from '../../../../lib/operatorInstructions';
import { repairJsonWithHaiku } from '../../../../lib/jsonRepair';
import { recordLlmUsage, logError } from '../../../../lib/obs';

// Productized-service offer builder. Runs when the strategic frame's
// archetype is `productized_service` — the community CP2-CP5 wizard can't
// shape a done-for-you deliverable. Sonnet 4.5 (the offer copy needs
// nuance). ~$0.05/run. Persists internal_metadata.service_offer.
export const maxDuration = 60;

const SYSTEM_PROMPT = `# PRODUCTIZED SERVICE OFFER BUILDER

You design a DONE-FOR-YOU service offer for a creator whose strategic frame chose the \`productized_service\` archetype. This is NOT a community. It is a fixed-price, repeatable deliverable: the creator (or their small team) produces ONE concrete artifact per buyer using a templatized process — a room design, a mood board, an audit report, a custom plan, an edit pack, a meal plan, etc.

## WHAT MAKES A GOOD PRODUCTIZED SERVICE
- **One clear deliverable.** The buyer knows exactly what lands in their inbox. Name the artifact concretely ("a room-by-room renovation plan as a 12-page PDF", not "consulting").
- **A repeatable process.** The value is that the creator turned their bespoke work into a fixed set of steps. 3-6 steps, each one the creator does the same way every time. This is the "productized" engine — it's what lets them charge without rebuilding from scratch each time.
- **Fixed price, fast turnaround.** Buyers pay for certainty. State a realistic turnaround.
- **Bridges "I admire her" → "I can afford her".** This offer is usually a fraction of the creator's full bespoke/DFY price, so a much larger slice of the audience can buy. Price it accordingly (usually one-time per project, sometimes per unit).
- **Self-qualifying.** who_its_for and who_its_not_for filter the buyer so the creator only gets fitting projects.

## GROUND IT IN THE INPUTS
- Use the strategic frame's dominant_transformation + sequenced_plays[0] as the spine — that play IS this service.
- Use the binding_constraint (usually operator time) to size the packages: never design a service that rebuilds the hours-trap. Templatization is the point.
- Use the Phase-3 uniqueness elements to make the deliverable defensible (name a proprietary method/framework where one genuinely exists).
- Use the capture_gap to inform positioning, not the offer itself.

## PACKAGES
Design 1-3 packages. Most creators start with ONE clear package (don't invent tiers that don't exist). If tiers make sense, keep them concrete: e.g. "Single room" / "Whole home" / "Home + shopping list". Each package has a real price with a currency and a model (per_project | per_unit | per_month). Prefer per_project for one-shot deliverables.

## OUTPUT — RETURN ONLY THIS JSON OBJECT (no prose, no markdown, no commentary)

{
  "service_name": "string ≤80 chars — the productized service name",
  "name_candidates": ["string", "string", ...],   // 2-4 alternates the operator can pick from
  "central_promise": "string ≤240 chars — the transformation in one sentence, buyer voice",
  "core_deliverable": "string ≤400 chars — the CONCRETE artifact the buyer receives (format + what's in it)",
  "delivery_format": "async" | "live" | "hybrid",
  "turnaround": "string ≤60 chars — typical delivery time for the base package (e.g. '5-7 dias úteis')",
  "who_its_for": ["string ≤180 chars", ...],       // 2-4 self-qualifying bullets
  "who_its_not_for": ["string ≤180 chars", ...],   // 2-4 self-disqualifying bullets
  "process_steps": [                                // 3-6 templatized steps — the repeatable engine
    { "name": "string ≤60 chars", "detail": "string ≤220 chars — what the creator does at this step, the same way every time" }
  ],
  "packages": [                                     // 1-3 packages (default to ONE unless tiers are real)
    {
      "name": "string ≤60 chars",
      "whats_included": ["string ≤160 chars", ...], // 2-6 concrete inclusions
      "price": { "amount": number, "currency": "EUR|USD|GBP|AED|CHF|BRL", "model": "per_project|per_unit|per_month" },
      "turnaround": "string ≤60 chars",
      "best_for": "string ≤140 chars — which buyer this package fits"
    }
  ],
  "positioning": "string ≤400 chars — why this beats (a) hiring an agency and (b) doing it themselves. The wedge."
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

function buildUserMessage(creator, extraInstruction) {
  const meta = creator.offer?.internal_metadata || {};
  const frame = meta.strategic_frame || {};
  const audit = meta.ecosystem_audit || {};
  const uniqueness = meta.uniqueness_extraction || {};

  const plays = Array.isArray(frame.sequenced_plays) ? frame.sequenced_plays : [];
  const primary = plays[0] || {};

  const frameBlock = `## STRATEGIC FRAME
archetype: ${frame.primary_offer_archetype || '(none)'}
archetype_rationale: ${frame.archetype_rationale || '(none)'}
dominant_transformation: ${frame.dominant_transformation || '(none)'}
positioning_tension: ${frame.positioning_tension || '(none)'}
audience_segment: ${frame.audience_segment?.description || '(none)'}
binding_constraint: ${frame.binding_constraint?.name || '(none)'} — ${frame.binding_constraint?.implication || ''}
capture_gap: ${frame.capture_gap?.gap || '(none)'}

## THE PLAY THIS SERVICE IMPLEMENTS (sequenced_plays[0])
name: ${primary.name || '(none)'}
why_now: ${primary.why_now || '(none)'}
leverages: ${primary.leverages || '(none)'}
realistic_monthly: ${primary.realistic_monthly_low || '?'}-${primary.realistic_monthly_high || '?'} (creator currency)
templatization_potential: ${primary.templatization_potential || '(none)'}`;

  const products = (audit.ecosystem_map?.products_found || []).slice(0, 6).map(p =>
    `${p.name} (${p.tier} · ${p.format}${p.price_eur ? ' · €' + p.price_eur : ''})`
  ).join('; ');
  const auditBlock = `## PHASE 1 · AUDIT
existing products: ${products || '(none)'}
strategic_role: ${audit.strategic_role || '(none)'}`;

  const uniqueElements = (uniqueness.unique_elements || []).slice(0, 6).map((e, i) =>
    `  ${i + 1}. [${e.category}] ${e.element}`
  ).join('\n');
  const uniquenessBlock = `## PHASE 3 · UNIQUENESS
voice: ${uniqueness.creator_voice_summary || '(none)'}
elements:
${uniqueElements || '  (none)'}`;

  const creatorBlock = `## CREATOR
name: ${creator.name || 'Unknown'}
niche: ${creator.niche || 'Unknown'}
IG followers: ${creator.platforms?.instagram?.followers || 0}
bio: ${(creator.bio || '').slice(0, 400) || '(no bio)'}`;

  const langHint = creator?.primaryLanguage === 'en'
    ? 'LANGUAGE: Output every string field in ENGLISH.'
    : creator?.primaryLanguage === 'es'
    ? 'LANGUAGE: Output every string field in Castilian Spanish (España, "tú" form).'
    : 'LANGUAGE: Output every string field in PORTUGUESE (PT-PT).';

  return `Design the productized service offer for this creator, grounded in the frame below.

${formatInstructionsBlock(extraInstruction)}${langHint}

${creatorBlock}

${frameBlock}

${auditBlock}

${uniquenessBlock}

Return ONLY the JSON object per the schema in the system prompt.${formatInstructionsReminder(extraInstruction)}`;
}

export async function POST(request, { params }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  try {
    const { id } = await params;
    const creator = await getCreator(id);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    const frame = creator.offer?.internal_metadata?.strategic_frame;
    if (!frame) {
      return NextResponse.json({ error: 'Sem strategic_frame. Corre o CP1 primeiro.' }, { status: 412 });
    }

    const body = await request.json().catch(() => ({}));
    const instruction = typeof body?.instruction === 'string' && body.instruction.trim()
      ? body.instruction.trim().slice(0, 1000)
      : null;

    const userMessage = buildUserMessage(creator, instruction);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(50000),
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 3000,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return NextResponse.json({ error: data.error?.message || `Anthropic ${resp.status}` }, { status: 502 });
    }
    if (data?.usage) recordLlmUsage({ route: 'service-offer', model: 'claude-sonnet-4-5-20250929', usage: data.usage }).catch(() => {});

    const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    let parsed = tryParseJson(rawText);
    if (!parsed) {
      parsed = await repairJsonWithHaiku(apiKey, rawText, tryParseJson);
      if (!parsed) {
        return NextResponse.json({
          error: 'Model returned non-JSON output (re-clica Gerar)',
          errors: [`stop_reason: ${data.stop_reason || '?'}`, `output_tokens: ${data.usage?.output_tokens ?? '?'} (cap: 3000)`, `tail: ${rawText.slice(-300)}`],
        }, { status: 502 });
      }
    }

    const validation = validateServiceOffer(parsed);
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
          service_offer: parsed,
          generation_timestamps: {
            ...(existingMeta.generation_timestamps || {}),
            service_offer: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      service_offer: parsed,
      _diagnostics: { packages: parsed.packages?.length ?? 0, output_tokens: data.usage?.output_tokens ?? null },
    });
  } catch (err) {
    logError('service-offer', err).catch(() => {});
    return NextResponse.json({ error: err?.message || 'unknown' }, { status: 500 });
  }
}
