import { NextResponse } from 'next/server';
import { repairJsonWithHaiku } from '../../../../../lib/jsonRepair';
import { getCreator, updateCreator } from '../../../../../lib/creators';
import { validateValueStack } from '../../../../../lib/schemas/valueStack';
import { formatStrategicFrameForPrompt } from '../../../../../lib/schemas/strategicFrame';
import { readCheckpointProgress } from '../../../../../lib/offerSchema';
import { OPERATOR_INSTRUCTIONS_RULE, formatInstructionsBlock, formatInstructionsReminder } from '../../../../../lib/operatorInstructions';

// Largest output of any CP — mechanism + value stack + pricing tiers + bonuses.
// ~$0.08-0.12 / call. max_tokens scaled up to 5000.
export const maxDuration = 60; // Hobby plan hard cap — 120 was silently clamped; budget honestly

// ─────────────────────────────────────────────────────────────────
// Phase 4 · Checkpoint 4 — Value Stack + Pricing
//
// The Hormozi step: turn the offer into a perceived value much greater
// than the price. Produces FOUR coordinated pieces of client_facing_output:
//   1. mechanism            — named A-O acronym ("S.T.R.I.D.E.")
//   2. value_stack          — items[] with $ values, total = 5-10× price
//   3. pricing_tiers        — 1-3 tier table for the pitch deck
//   4. unlocked_bonuses     — month-by-month value drops
//
// Inputs:
//   - LOCKED CP1 strategic_frame (positioning_tension informs mechanism naming)
//   - LOCKED CP2 core_offer      (target_price + audience anchor everything)
//   - LOCKED CP3 modules         (each module becomes 1 stack item)
//   - Phase 1 ecosystem audit    (existing products → repackaged as bonuses)
//   - Phase 2 archetype          (shapes bonus types — builder→templates, coach→1-1)
//   - Phase 3 uniqueness         (high-monetization elements anchor perceived value)
// ─────────────────────────────────────────────────────────────────

export async function POST(request, { params }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const instruction = typeof body?.instruction === 'string' && body.instruction.trim()
      ? body.instruction.trim().slice(0, 1000)
      : null;
    const creator = await getCreator(id);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    const meta = creator.offer?.internal_metadata || {};
    const progress = readCheckpointProgress(meta);
    for (let i = 1; i <= 3; i++) {
      if (!progress.locked[i]) {
        return NextResponse.json({ error: `CP${i} must be locked before running CP4.` }, { status: 412 });
      }
    }
    if (progress.locked[4]) {
      return NextResponse.json({
        error: 'Checkpoint 4 is locked. Unlock it first (cascade-invalidates CP5).',
        locked_at: progress.locked[4],
      }, { status: 412 });
    }

    const result = await runValueStack(apiKey, creator, 0, instruction);
    if (result.error) {
      return NextResponse.json({ error: result.error, errors: result.errors, raw: result.raw }, { status: 502 });
    }

    const existingOffer = creator.offer || {};
    const existingMeta = existingOffer.internal_metadata || {};
    const existingClient = existingOffer.client_facing_output || {};
    await updateCreator(id, {
      offer: {
        ...existingOffer,
        client_facing_output: {
          ...existingClient,
          mechanism: result.data.mechanism,
          value_stack: result.data.value_stack,
          pricing_tiers: result.data.pricing_tiers,
          unlocked_bonuses: result.data.unlocked_bonuses,
        },
        internal_metadata: {
          ...existingMeta,
          generation_timestamps: {
            ...(existingMeta.generation_timestamps || {}),
            value_stack: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      mechanism: result.data.mechanism,
      value_stack: result.data.value_stack,
      pricing_tiers: result.data.pricing_tiers,
      unlocked_bonuses: result.data.unlocked_bonuses,
      _diagnostics: {
        modules_input: result.modulesInput,
        target_price_input: result.targetPriceInput,
        warnings: result.warnings,
        retries: result.retries,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Value stack generation failed' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// Prompt + Claude call
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `# VALUE STACK + PRICING — Phase 4 · Checkpoint 4

The Hormozi step. You're not designing the offer — that's done. You're FRAMING it so the perceived value is dramatically higher than the price. Four coordinated outputs in one JSON object.

## OUTPUT 1 · MECHANISM (named A-O acronym)

A named system the creator owns. Examples: "S.T.R.I.D.E.", "P.A.C.E.", "D.O.C.S.". Pick a 4-6 letter acronym where:
- Each letter stands for ONE phase or principle of how the transformation actually happens
- The acronym is pronounceable and brandable
- The full unfurled meaning maps to the offer's actual mechanic

Format (one entry in mechanism.letters per letter of mechanism.name):

{
  "name": "S.T.R.I.D.E.",
  "description": "1-2 sentences explaining the mechanism as a whole",
  "letters": [
    { "letter": "S", "word": "Submit", "explanation": "..." },
    { "letter": "T", "word": "...", "explanation": "..." },
    ...
  ]
}

The letters array MUST have exactly one entry per letter in name. "S.T.R.I.D.E." → 6 letters → 6 entries. The 'letter' field of each entry must match the position in the name.

## CURRENCY RULE (read this before writing ANY price)

The currency symbol MUST match the creator's primary language:
- **English creator** → ALL prices use \`$\` and US-style notation (e.g. \`$297/mo\`, \`$2,970/yr\`)
- **Portuguese creator** → ALL prices use \`€\` and EU-style notation (e.g. \`€297/mês\`, \`€2.970/ano\`)

This applies to every dollarValue, every total, every tier price, every actualPrice. Do NOT mix currencies inside the same offer. Do NOT use \`€\` for an English creator just because the examples below show \`€\`.

## OUTPUT 2 · VALUE STACK (Hormozi-style items)

4-6 items. Each is ONE component of the offer with its own perceived value. NEVER more than 6 — the pitch slide cuts off above 6 rows. Consolidate weaker items if necessary. Format:

{
  "items": [
    {
      "problem": "the specific pain this addresses (in audience's voice)",
      "solution": "how the offer solves it",
      "delivery": "the actual format (e.g. 'Weekly live audit calls')",
      "dollarValue": "€500   ← swap € for $ when creator is English"
    },
    ...
  ],
  "total": "€2,500   ← swap € for $ when creator is English",
  "actualPrice": "matches CP2 target_price exactly (same currency)"
}

PRICING DISCIPLINE — this is non-negotiable:
- value_stack.total must be 5-10× value_stack.actualPrice
- Each dollarValue should map to a real market comparable. "€2K for AI consulting" is honest; "€50K for a Notion template" is fantasy and breaks trust
- Items typically derive 1:1 from CP3 modules — each module becomes a stack item

## OUTPUT 3 · PRICING TIERS

2-3 tiers. Default shape (mandatory for monthly offers):
  - Tier 1 (monthly):     value_stack.actualPrice exactly (e.g. "€297/mo")
  - Tier 2 (annual):      price × 10 framed as annual prepay ("€2,970/yr — 2 months free")
                          — same currency, no inflation
  - Tier 3 (premium):     OPTIONAL — only include if there's a real differentiator
                          (e.g. monthly 1-1 access). Price ~2-3× the monthly tier.
                          Skip if the creator profile doesn't support it.

For one-time pricing (pricing_model == "one_time"), tiers are usually a
single-tier with the actualPrice. Don't invent multiple tiers if the offer
doesn't need them.

The slide deck renders these as cards in a 2-column or 3-column grid. Keep tier names short (≤40 chars) and notes punchy (≤120 chars). Use creator language for tier names: PT creators get "Mensal" / "Anual" / "Premium"; EN creators get "Monthly" / "Annual" / "Premium".

Format:

{
  "pricing_tiers": [
    { "name": "Mensal", "price": "€297/mês", "note": "Sistema completo + comunidade" },
    { "name": "Anual",  "price": "€2.970/ano", "note": "2 meses grátis vs mensal" },
    { "name": "Premium", "price": "€697/mês", "note": "Mensal + 1-on-1 mensal comigo" }
  ]
}

For an ENGLISH creator the same shape becomes:

{
  "pricing_tiers": [
    { "name": "Monthly", "price": "$297/mo", "note": "Complete system + community" },
    { "name": "Annual",  "price": "$2,970/yr", "note": "2 months free vs monthly" },
    { "name": "Premium", "price": "$697/mo", "note": "Monthly + 1-on-1 with me" }
  ]
}

## OUTPUT 4 · UNLOCKED BONUSES (month-by-month drops)

4-8 month-tagged value adds. They prevent churn — every month a new asset drops. Format:

[
  "Month 1: Database template pack — 6 working Notion DBs you copy and customise",
  "Month 2: AI prompt library — 40+ tested prompts for decision automation",
  ...
]

Pull from:
- Phase 1 ecosystem_audit.products_found — existing assets the creator can repackage
- Phase 3 uniqueness elements — proprietary frameworks, templates, vocabulary
- The natural progression of the CP1+CP2 transformation arc

## STYLE RULES (same as CP2/CP3)

- No "Unlock", "Discover", "Transform" verbs
- No 3-adjective stacks
- No "this isn't just X, it's Y"
- Match creator_voice_summary tone
- Pricing strings use the creator's currency (look at CP2's target_price — if it's €, use €; if it's $, use $)

## OUTPUT

Return ONLY a JSON object with all four pieces. No prose, no markdown fences.

{
  "mechanism": { ... },
  "value_stack": { items: [...], total: "...", actualPrice: "..." },
  "pricing_tiers": [...],
  "unlocked_bonuses": [...]
}

${OPERATOR_INSTRUCTIONS_RULE}`;

async function runValueStack(apiKey, creator, retryCount = 0, extraInstruction = null) {
  const meta = creator.offer?.internal_metadata || {};
  const client = creator.offer?.client_facing_output || {};
  const frame = meta.strategic_frame || null;
  const archetype = meta.archetype_classification || null;
  const uniqueness = meta.uniqueness_extraction || null;
  const audit = meta.ecosystem_audit || null;
  const modules = Array.isArray(client.modules) ? client.modules : [];

  // ── CP1 frame — shared formatter so the six moves + adversarial
  //     review reach value-stack generation (previously only 2 fields).
  const frameBlock = formatStrategicFrameForPrompt(frame);

  // ── CP2 core offer
  const offerBlock = `## CP2 CORE OFFER (LOCKED — actualPrice in value_stack MUST match target_price)
Community: ${client.community_name}
Central promise: ${client.central_promise}
Transformation: From "${client.transformation?.from}" → "${client.transformation?.to}" in ${client.transformation?.timeframe}
Pricing: ${client.target_price} · ${client.pricing_model} · ${client.pricing_tier}
Core mechanic: ${client.core_mechanic}`;

  // ── CP3 modules — these become the stack items
  const modulesBlock = `## CP3 MODULES (LOCKED — each module typically becomes ONE stack item)
${modules.map((m, i) => `  ${i + 1}. [${m.format}] ${m.name}
     ${m.description}
     Delivers: ${m.transformation_delivered}
     Cadence: ${m.delivery_cadence}`).join('\n\n')}`;

  // ── Phase 1 ecosystem — for repackagable bonuses
  let auditBlock = '';
  if (audit) {
    const products = (audit.ecosystem_map?.products_found || []).map(p =>
      `  - ${p.name} (${p.tier} · ${p.format}${p.price ? ' · ' + p.price : ''})`
    ).join('\n');
    auditBlock = `## ECOSYSTEM (Phase 1 — existing assets to repackage as bonuses)
${products || '  (none mapped)'}`;
  }

  // ── Phase 2 archetype — shapes bonus type
  let archetypeBlock = '';
  if (archetype) {
    archetypeBlock = `## ARCHETYPE (Phase 2)
Primary: ${archetype.primary_archetype}
Bonus-type guidance:
  - builder_operator       → templates, SOPs, working artefacts
  - coach_transformation   → 1-1 audits, personalised plans
  - expert_educator        → curated lesson packs, deep-dive PDFs
  - performer_practitioner → behind-the-scenes recordings, raw process
  - personality_entertainer → exclusive Q&As, AMAs, off-platform calls
  - curator_aggregator     → vetted resource lists, weekly picks`;
  }

  // ── Phase 3 — high-monetization elements + voice
  let uniquenessBlock = '';
  if (uniqueness) {
    const elements = (uniqueness.unique_elements || []).map((e, i) =>
      `  [${i}] (${e.category} · ${e.monetization_potential}$) ${e.element}`
    ).join('\n');
    uniquenessBlock = `## UNIQUENESS (Phase 3)
CREATOR VOICE: ${uniqueness.creator_voice_summary || '(none)'}

Elements (anchor value pricing on the high-monetization ones):
${elements || '(none)'}`;
  }

  // Pitch-rendered output — match creator language. Mechanism name is an
  // acronym; the .word fields per letter follow the language rule (e.g. PT
  // creator → S = "Submeter", T = "Treinar", etc.). Brand-style phrases
  // from Phase 3 stay verbatim.
  const langHint = creator?.primaryLanguage === 'en'
    ? `LANGUAGE: Output every string field in ENGLISH. mechanism.letters[].word + .explanation in English. value_stack item.problem/solution/delivery in English. unlocked_bonuses in English.`
    : creator?.primaryLanguage === 'es'
    ? `LANGUAGE: Output every string field in Castilian Spanish (España, "tú" form). mechanism.letters[].word + .explanation in Spanish (e.g. S = "Someter", T = "Transformar"). value_stack item.problem/solution/delivery in Spanish. unlocked_bonuses in Spanish. KEEP proper nouns / brand phrases / Phase 3 vocabulary elements verbatim. Do NOT mix languages within a single sentence.`
    : `LANGUAGE: Output every string field in PORTUGUESE (PT-PT). mechanism.letters[].word + .explanation in Portuguese. value_stack item.problem/solution/delivery in Portuguese. unlocked_bonuses in Portuguese. KEEP proper nouns / brand phrases / Phase 3 vocabulary elements verbatim. Do NOT mix languages within a single sentence.`;

  const userMessage = `Build the value stack + pricing for this offer. Each CP3 module typically becomes one stack item. value_stack.total MUST be 5-10× value_stack.actualPrice (use the creator's currency from CP2 target_price). mechanism.letters MUST have one entry per letter of mechanism.name.

${formatInstructionsBlock(extraInstruction)}${langHint}

${frameBlock}

${offerBlock}

${modulesBlock}

${auditBlock}

${archetypeBlock}

${uniquenessBlock}

Return ONLY the JSON object per the schema in the system prompt.${formatInstructionsReminder(extraInstruction)}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      // 5000 → 3500 (2026-06-18 emergency cost cut).
      max_tokens: 3500,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    return { error: data.error?.message || `Anthropic ${resp.status}`, errors: [], raw: null, retries: retryCount };
  }

  const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  let parsed = tryParseJson(rawText);
  if (!parsed) {
    // Cheap Haiku JSON-repair instead of re-running the whole (often
    // web_search-backed) call — a parse failure is a formatting slip,
    // not a reasoning failure. ~$0.005 vs re-billing the full generation.
    const repaired = await repairJsonWithHaiku(apiKey, rawText, tryParseJson);
    if (repaired) { parsed = repaired; }
    else return { error: 'Model returned non-JSON output', raw: rawText, errors: [], retries: retryCount };
  }

  // Force actualPrice to exactly match CP2's target_price — prevents drift.
  if (parsed.value_stack && client.target_price) {
    parsed.value_stack.actualPrice = client.target_price;
  }

  const validation = validateValueStack(parsed);
  if (!validation.valid) {
    // Retry-on-validation-failure removed 2026-06-18 (emergency cost cut).
    return { error: 'Schema validation failed', errors: validation.errors, raw: rawText, retries: retryCount };
  }

  return enrich(parsed, modules.length, client.target_price, validation.warnings, retryCount);
}

function enrich(data, modulesInput, targetPriceInput, warnings, retries) {
  return { data, modulesInput, targetPriceInput, warnings, retries };
}

function tryParseJson(text) {
  if (!text) return null;
  let s = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(s.slice(start, i + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
}
