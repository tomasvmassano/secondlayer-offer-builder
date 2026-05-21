import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../../lib/creators';
import { validateModules } from '../../../../../lib/schemas/modules';
import { readCheckpointProgress } from '../../../../../lib/offerSchema';

// ~$0.05-0.08 per call. Sonnet only. 4-8 modules, each with description +
// transformation + format + linked elements + cadence — larger output than
// CP2 so max_tokens scaled up.
export const maxDuration = 90;

// ─────────────────────────────────────────────────────────────────
// Phase 4 · Checkpoint 3 — Modules (batch generation)
//
// Produces 4-8 modules that constitute the offer's curriculum. Each module
// MUST link to at least one Phase 3 uniqueness element with
// usable_in_modules=true. This is the "defensibility chain": every piece of
// the curriculum is grounded in a citable creator advantage, not generic
// course content.
//
// Operator can regenerate a single module via the sibling endpoint
//   POST /api/creators/[id]/wizard/modules/[index]
// which preserves the other modules and only swaps the one at [index].
//
// Pre-conditions:
//   - CP1 + CP2 must be locked
//   - CP3 must not already be locked (412 — unlock cascades to CP4/5)
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
    if (!progress.locked[1]) {
      return NextResponse.json({ error: 'CP1 (Strategic Frame) must be locked before running CP3.' }, { status: 412 });
    }
    if (!progress.locked[2]) {
      return NextResponse.json({ error: 'CP2 (Core Offer) must be locked before running CP3.' }, { status: 412 });
    }
    if (progress.locked[3]) {
      return NextResponse.json({
        error: 'Checkpoint 3 is locked. Unlock it first (cascade-invalidates CP4-5).',
        locked_at: progress.locked[3],
      }, { status: 412 });
    }

    const result = await runModules(apiKey, creator, 0, instruction);
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
          modules: result.data.modules,
          weekly_formats: result.data.weekly_formats,
          library: result.data.library,
        },
        internal_metadata: {
          ...existingMeta,
          generation_timestamps: {
            ...(existingMeta.generation_timestamps || {}),
            modules: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      modules: result.data.modules,
      weekly_formats: result.data.weekly_formats,
      library: result.data.library,
      _diagnostics: {
        modules_returned: result.data.modules.length,
        weekly_formats_returned: result.data.weekly_formats.length,
        library_returned: result.data.library.length,
        usable_elements_input: result.usableElementsInput,
        warnings: result.warnings,
        retries: result.retries,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Modules generation failed' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// Prompt + Claude call
// ─────────────────────────────────────────────────────────────────

export const MODULES_SYSTEM_PROMPT = `# MODULES — Phase 4 · Checkpoint 3

You are designing THREE coordinated arrays that together describe the offer's content surface:

  - modules         : 4-8 curriculum modules — the offer's spine
  - weekly_formats  : 3-5 day-of-week live cadence entries
  - library         : 3-6 on-demand catalogue entries

modules is the source of truth. weekly_formats + library are the
operational face — what the creator's audience SEES as the rhythm of
consumption. They derive from modules + the locked CP2 weekly_rhythm.

## REQUIREMENTS FOR EACH MODULE

1. **Grounded in a concrete creator advantage** — each module's linked_unique_elements array MUST include the index of at least one Phase 3 uniqueness element (those marked usable_in_modules=true preferred). If a module can't cite a specific creator advantage, it's generic and shouldn't exist.

   This is a HARD schema requirement, not a suggestion:
     - The array must be present on every module.
     - The array must have at least one integer.
     - An empty array (`linked_unique_elements: []`) FAILS validation.
     - A missing field FAILS validation.
     - "Cite" means index — pick the [N] number that appears in the PHASE 3 UNIQUENESS ELEMENTS block of the user message. If you cite [3] and [7], output `"linked_unique_elements": [3, 7]`.
     - If the same element is the strongest link for two modules, you may cite it twice (once per module). Citation is not exclusive.
     - If NO element in the supplied list seems to fit, pick the closest faithful index anyway. Empty arrays are never acceptable.

2. **In creator voice** — match the creator_voice_summary. Reuse Phase 3 vocabulary verbatim where it fits. Same banned words as CP2: no "Unlock", "Discover", "Transform" verbs. No 3-adjective stacks. No "this isn't just X, it's Y".

3. **Mapped to a delivery format** — pick the format that actually fits, not the most impressive-sounding. A weekly thread is community_ritual, not "doc". A 90-min Zoom is live_call.

## FORMATS (strict enum)

- live_call         : recurring/one-off video session with the creator. Pick when human presence is the value.
- recorded_module   : pre-recorded video + supporting materials. Pick for evergreen frameworks the creator only needs to teach once.
- doc               : long-form written playbook / SOP. Pick for reference material people return to.
- template          : working Notion / spreadsheet / code template. Pick when the artefact IS the value.
- community_ritual  : recurring thread / channel / structured format. Pick when peer interaction is the engine.

## STRUCTURE

- Generate 4-8 modules. Default 5-6.
- Cover the transformation arc: onboarding → core mechanism → application → community ritual → results.
- Don't over-index on live calls (max 2 — each live call is a recurring time commitment).
- Mix formats deliberately — a 6-module set of all "recorded_module" is a course, not an offer.
- Every module's transformation_delivered must be specific and CITED somewhere in the CP1 or CP2 transformation arc. ("Members ship their first documented decision database" not "Members learn about databases").

## DEFENSIBILITY CHAIN — read carefully

The Phase 3 uniqueness elements you'll receive are indexed 0..N-1. Each module's linked_unique_elements must include the 0-based index of every element it leverages. Examples:
- Module about Notion databases → cite index of the "6 Notion databases" element
- Module about decision documentation → cite index of any element about documentation
- Module about the contrarian "less tools" positioning → cite the relevant contrarian_angle index

It is REQUIRED that ≥1 index appears per module. Modules that cite 2-3 elements are stronger.

## WEEKLY_FORMATS (3-5 entries)

The day-of-week live cadence the audience SEES every week. Each entry:
  - day  : short label, ≤10 chars. Use the LANGUAGE of the creator's audience
           (PT: SEG/TER/QUA/QUI/SEX/SAB/DOM; EN: MON/TUE/WED/THU/FRI/SAT/SUN)
  - name : the recurring format's name (≤60 chars), creator-voiced. Pull
           directly from a module with format=live_call or community_ritual.
           If CP2's weekly_rhythm has named beats ("Mon · Decision Documentation Thread"),
           reuse those names.
  - type : short kind label (≤40 chars). Examples: "Live 45m", "Thread",
           "Workshop", "AMA", "Group call", "Community channel"
  - desc : ≤140 chars, one-line description of what happens on this day

Coverage rules:
  - Cover the full weekly_rhythm from CP2 — if CP2 has 4 weekly beats,
    weekly_formats should reflect all 4 (or consolidate where it makes sense)
  - At least one live entry per week (otherwise the offer doesn't feel alive)
  - Don't invent days that conflict with CP2's weekly_rhythm

## LIBRARY (3-6 entries)

The on-demand catalogue — recorded modules, docs, templates the audience
gets when they join. Each entry:
  - name   : module name (≤60 chars)
  - format : short kind label (≤40 chars). Examples: "Masterclass",
             "Mini-course", "PDF Playbook", "Template Pack", "Audio Program",
             "Calculator", "Notion Doc"
  - desc   : ≤140 chars, theme + outcome

Sourcing:
  - Primary source: modules with format ∈ [recorded_module, doc, template]
  - Secondary source: Phase 1 ecosystem_audit.products_found — existing
    assets the creator can drop in as part of the library (e.g. "Stride
    System Template" if it exists in their bio links)
  - DO include diverse formats — a library of 5 PDFs is boring; mix
    masterclasses, templates, audio, etc.

## OUTPUT

Return ONLY a JSON object. No prose, no markdown.

{
  "modules": [
    {
      "name": "string (≤80 chars, brandable in creator voice)",
      "description": "string (≤300 chars, 1-2 sentences on what this module IS)",
      "transformation_delivered": "string (≤200 chars, specific outcome)",
      "format": "live_call" | "recorded_module" | "doc" | "template" | "community_ritual",
      "linked_unique_elements": [0, 3],  // 0-based indices into PHASE 3 UNIQUENESS ELEMENTS. MUST be a non-empty array. Example shown; pick real indices.
      "delivery_cadence": "string (≤80 chars, when/how often)"
    },
    ...
  ],
  "weekly_formats": [
    { "day": "MON", "name": "...", "type": "Live 45m", "desc": "..." },
    ...   // 3-5 entries
  ],
  "library": [
    { "name": "...", "format": "Masterclass", "desc": "..." },
    ...   // 3-6 entries
  ]
}`;

async function runModules(apiKey, creator, retryCount = 0, extraInstruction = null) {
  const meta = creator.offer?.internal_metadata || {};
  const client = creator.offer?.client_facing_output || {};
  const frame = meta.strategic_frame || null;
  const archetype = meta.archetype_classification || null;
  const uniqueness = meta.uniqueness_extraction || null;
  const audit = meta.ecosystem_audit || null;

  const elements = uniqueness?.unique_elements || [];
  const usableCount = elements.length;

  // Hard precondition. The schema requires every module to cite ≥1 Phase 3
  // uniqueness element. With zero elements available the LLM has no indices
  // to cite, the validator fails 6 times (once per module), and the retry
  // loop spins until it gives up — surfacing a cryptic "Schema validation
  // failed" wall instead of telling the operator what's actually missing.
  //
  // Fail fast with a single clear error pointing at the prerequisite step.
  if (usableCount === 0) {
    return {
      error: 'A extração de Uniqueness (Fase 3) ainda não foi corrida — sem elementos para citar, os módulos não podem ser gerados. Corre o passo de Uniqueness primeiro.',
      errors: [
        'meta.uniqueness_extraction.unique_elements: empty — every module must cite ≥1 element by index, but no elements exist yet',
        'Required step: run the Uniqueness Extraction (Phase 3) for this creator before generating modules (CP3)',
      ],
      raw: null,
      retries: 0,
      missing_prerequisite: 'uniqueness_extraction',
    };
  }

  // Build the Phase 3 elements block with indices the model can cite
  const elementsBlock = elements.map((e, i) =>
    `  [${i}] (${e.category} · ${e.monetization_potential}$${e.usable_in_modules ? ' · MOD' : ''}) ${e.element}\n      evidence: ${e.evidence_source}`
  ).join('\n');

  let frameBlock = '';
  if (frame) {
    frameBlock = `## CP1 STRATEGIC FRAME (LOCKED)
Role: ${frame.confirmed_role}
Dominant transformation (internal): ${frame.dominant_transformation}
Positioning tension: ${frame.positioning_tension}`;
  }

  const offerBlock = `## CP2 CORE OFFER (LOCKED)
Community name: ${client.community_name || '?'}
Platform: ${client.platform || '?'}
Central promise: ${client.central_promise || '?'}
Transformation: From "${client.transformation?.from || '?'}" → To "${client.transformation?.to || '?'}" in ${client.transformation?.timeframe || '?'}
Core mechanic: ${client.core_mechanic || '?'}
Weekly rhythm:
${(client.weekly_rhythm || []).map(r => '  - ' + r).join('\n')}
Pricing: ${client.target_price || '?'} · ${client.pricing_model || '?'} · ${client.pricing_tier || '?'}
Audience for:
${(client.audience_fit?.for || []).map(f => '  - ' + f).join('\n')}`;

  const archetypeBlock = archetype
    ? `## ARCHETYPE (Phase 2)\nPrimary: ${archetype.primary_archetype} — modules should reflect this style (e.g. builder_operator → systems/templates heavy; coach_transformation → live coaching heavy; expert_educator → recorded curriculum heavy)`
    : '';

  let auditGaps = '';
  if (audit?.ecosystem_map?.gaps_identified?.length > 0) {
    auditGaps = `## GAPS TO FILL (Phase 1)
The existing product ecosystem has these gaps — modules can be designed to fill them:
${audit.ecosystem_map.gaps_identified.map(g => '  - ' + g).join('\n')}`;
  }

  const uniquenessBlock = `## PHASE 3 UNIQUENESS ELEMENTS — index these by their [N] number when citing in linked_unique_elements
${elementsBlock || '  (none)'}

CREATOR VOICE: ${uniqueness?.creator_voice_summary || '(none)'}`;

  const langHint = creator?.primaryLanguage === 'en'
    ? `LANGUAGE: Output every string field in ENGLISH. Use English day labels (MON/TUE/WED/THU/FRI/SAT/SUN) for weekly_formats.day.`
    : creator?.primaryLanguage === 'es'
    ? `LANGUAGE: Output every string field in Castilian Spanish (España, "tú" form). Use Spanish day labels (LUN/MAR/MIÉ/JUE/VIE/SÁB/DOM) for weekly_formats.day. Phase 3 vocabulary may be in English or Portuguese — keep proper nouns / brand phrases / vocabulary elements verbatim ("Stride System Template", etc.) but translate descriptions and transformation_delivered into Spanish. Do NOT mix languages within a single sentence.`
    : `LANGUAGE: Output every string field in PORTUGUESE (PT-PT). Use Portuguese day labels (SEG/TER/QUA/QUI/SEX/SÁB/DOM) for weekly_formats.day. Phase 3 vocabulary may be in English — keep proper nouns / brand phrases / vocabulary elements verbatim ("Stride System Template", etc.) but translate descriptions and transformation_delivered into Portuguese. Do NOT mix languages within a single sentence.`;

  const userMessage = `Design 4-8 modules for this offer plus the weekly_formats + library arrays that derive from them. Every module must link to ≥1 Phase 3 uniqueness element by its [index] number.

${langHint}

${frameBlock}

${offerBlock}

${archetypeBlock}

${auditGaps}

${uniquenessBlock}

${extraInstruction ? `## ADDITIONAL INSTRUCTION\n${extraInstruction}\n\n` : ''}Return ONLY the JSON object per the schema in the system prompt.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 5500,
      system: [{ type: 'text', text: MODULES_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    return { error: data.error?.message || `Anthropic ${resp.status}`, errors: [], raw: null, retries: retryCount };
  }

  const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const parsed = tryParseJson(rawText);
  if (!parsed) {
    if (retryCount < 1) return runModules(apiKey, creator, retryCount + 1, 'Your previous response was not parseable JSON. Return ONLY a JSON object — no prose, no markdown fences.');
    return { error: 'Model returned non-JSON output after retry', raw: rawText, errors: [], retries: retryCount };
  }

  const validation = validateModules(parsed, usableCount);
  if (!validation.valid) {
    if (retryCount < 1) {
      const retryResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 5500,
          system: [{ type: 'text', text: MODULES_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [
            { role: 'user', content: userMessage },
            { role: 'assistant', content: rawText },
            { role: 'user', content: `Your output failed schema validation. Fix and resend ONLY the JSON.\n\nErrors:\n${validation.errors.map(e => '- ' + e).join('\n')}` },
          ],
        }),
      });
      const retryData = await retryResp.json();
      if (retryResp.ok) {
        const retryText = (retryData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
        const retryParsed = tryParseJson(retryText);
        if (retryParsed) {
          const retryValidation = validateModules(retryParsed, usableCount);
          if (retryValidation.valid) return { data: retryParsed, warnings: retryValidation.warnings, usableElementsInput: usableCount, retries: retryCount + 1 };
          return { error: 'Schema validation failed twice', errors: retryValidation.errors, raw: retryText, retries: retryCount + 1 };
        }
      }
    }
    return { error: 'Schema validation failed', errors: validation.errors, raw: rawText, retries: retryCount };
  }

  return { data: parsed, warnings: validation.warnings, usableElementsInput: usableCount, retries: retryCount };
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
