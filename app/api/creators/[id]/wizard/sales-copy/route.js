import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../../lib/creators';
import { validateSalesCopy } from '../../../../../lib/schemas/salesCopy';
import { readCheckpointProgress } from '../../../../../lib/offerSchema';

// Final checkpoint. Many output strings, voice-heavy. ~$0.10-0.15 / call.
export const maxDuration = 120;

// ─────────────────────────────────────────────────────────────────
// Phase 4 · Checkpoint 5 — Sales Copy assembly
//
// The polish pass. Reads EVERY locked checkpoint (CP1-4) + Phase 1-3
// internal_metadata as context and produces the final sales-language
// pieces that complete client_facing_output:
//   - differentiator_section : "Why this isn't another X" (benefit-led)
//   - strategic_context_line : 1-line strategic header
//   - hero                   : { headline, sub, cta } — pitch top
//   - objections             : 4-6 { objection, rebuttal } pairs
//   - faq                    : 8-12 { q, a } items
//   - social_proof_line      : pulls fame_tier_evidence when present
//
// After CP5 locks, the offer is "complete" — pitch deck, launch-plan PDF,
// and PPTX export should all render from client_facing_output.
//
// Pre-conditions:
//   - CP1+CP2+CP3+CP4 all locked
//   - CP5 not yet locked
// ─────────────────────────────────────────────────────────────────

export async function POST(_request, { params }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const creator = await getCreator(id);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    const meta = creator.offer?.internal_metadata || {};
    const progress = readCheckpointProgress(meta);
    for (let i = 1; i <= 4; i++) {
      if (!progress.locked[i]) {
        return NextResponse.json({ error: `CP${i} must be locked before running CP5.` }, { status: 412 });
      }
    }
    if (progress.locked[5]) {
      return NextResponse.json({
        error: 'Checkpoint 5 is locked. Unlock it first to re-run.',
        locked_at: progress.locked[5],
      }, { status: 412 });
    }

    const result = await runSalesCopy(apiKey, creator);
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
          differentiator_section: result.data.differentiator_section,
          strategic_context_line: result.data.strategic_context_line,
          hero: result.data.hero,
          objections: result.data.objections,
          faq: result.data.faq,
          social_proof_line: result.data.social_proof_line || null,
        },
        internal_metadata: {
          ...existingMeta,
          generation_timestamps: {
            ...(existingMeta.generation_timestamps || {}),
            sales_copy: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      differentiator_section: result.data.differentiator_section,
      strategic_context_line: result.data.strategic_context_line,
      hero: result.data.hero,
      objections: result.data.objections,
      faq: result.data.faq,
      social_proof_line: result.data.social_proof_line || null,
      _diagnostics: {
        fame_tier: result.fameTier,
        objections_returned: result.data.objections.length,
        faq_returned: result.data.faq.length,
        warnings: result.warnings,
        retries: result.retries,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Sales copy generation failed' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// Prompt + Claude call
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `# SALES COPY — Phase 4 · Checkpoint 5 (Final Assembly)

This is the polish pass. The offer's spine (CP2), curriculum (CP3), and value stack (CP4) are all locked. Your job: write the sales-language pieces that complete the pitch.

EVERY string must read like the creator wrote it. The audience can smell generic landing-page copy in one sentence. If you produce Hormozi-clone or SaaS-template tone, you've failed.

## OUTPUTS

### 1. differentiator_section (≤800 chars)

"Why this isn't another X." Benefit-led prose, NOT a feature comparison list.
- 3-4 short paragraphs (one sentence each is fine)
- Each paragraph names a real differentiator from Phase 3 uniqueness elements
- Don't enumerate "We do X, they don't" — write claims that imply the contrast
- Reuse Phase 3 vocabulary verbatim where it fits

Example for a Builder/Operator-style offer (don't copy, illustrative):
"Most AI communities throw 15 new tools at you every week. We pick two and build the system around them.
You don't learn AI here. You document your business so AI can run it.
By month 3, six Notion databases handle 70% of your daily decisions. Not more apps. Less work."

### 2. strategic_context_line (≤300 chars)

A single line that frames the offer's role in the audience's life. Goes in the pitch deck header. Often a contrarian or anti-norm statement.

Example: "Built for solo operators who'd rather document once than test 15 tools weekly."

### 3. hero — { headline, sub, cta }

- headline: ≤80 chars, attention-grabbing, specific to THIS creator's positioning
- sub: ≤200 chars, expands the headline with the actual transformation
- cta: ≤30 chars, button text. Match the creator's voice (no "Join Now!", no "Get Started Today")

### 4. objections (4-6 pairs)

The TOP objections this audience will raise. Each pair:
- objection: in the audience's voice ("I'm too early for this — I don't have a business yet")
- rebuttal: in the creator's voice. Direct, not defensive. Sometimes the right answer is "you're right, this isn't for you" — that's a strong rebuttal, not a weakness.

Pull objection candidates from:
- CP1 negative_qualifiers (who this is NOT for → those people will object)
- CP2 audience_fit.not_for (same)
- Phase 3 contrarian_angle elements (the audience will push back on the contrarian take)
- Pricing concerns (target_price feels high)

### 5. faq (8-12 items)

Practical questions about logistics, expectations, refunds, time commitment, prerequisites, what happens after enrollment, etc. Each answer ≤400 chars. Match the creator's voice.

Cover at minimum:
- Time commitment per week
- What if I'm a beginner / advanced
- Refund policy (creator decides — don't invent)
- Platform/access logistics
- Live call schedule and timezone
- What happens after the timeframe
- One question that surfaces the creator's positioning_tension

### 6. social_proof_line (≤240 chars, optional)

Only fill this if Phase 2 fame_tier is niche_recognized or stronger. Pull from fame_tier_evidence verbatim (don't paraphrase). Example: "Speaking at TechHaus Sydney March 2026 on AI-at-Work alongside PwC Australia."

If fame_tier is "micro", return social_proof_line: null.

## STYLE RULES (same as CP2/CP3/CP4)

- No "Unlock", "Discover", "Transform" verbs
- No 3-adjective stacks
- No "this isn't just X, it's Y"
- Match creator_voice_summary tone exactly
- Reuse Phase 3 vocabulary verbatim where it fits

## OUTPUT

Return ONLY a JSON object. No prose, no markdown fences.

{
  "differentiator_section": "string",
  "strategic_context_line": "string",
  "hero": { "headline": "string", "sub": "string", "cta": "string" },
  "objections": [ { "objection": "...", "rebuttal": "..." }, ... ],
  "faq": [ { "q": "...", "a": "..." }, ... ],
  "social_proof_line": "string or null"
}`;

async function runSalesCopy(apiKey, creator, retryCount = 0, extraInstruction = null) {
  const meta = creator.offer?.internal_metadata || {};
  const client = creator.offer?.client_facing_output || {};
  const frame = meta.strategic_frame || null;
  const archetype = meta.archetype_classification || null;
  const uniqueness = meta.uniqueness_extraction || null;

  // CP1
  let frameBlock = '';
  if (frame) {
    frameBlock = `## CP1 STRATEGIC FRAME (LOCKED — internal only, cite for objection material)
Role: ${frame.confirmed_role}
Dominant transformation (internal): ${frame.dominant_transformation}
Positioning tension: ${frame.positioning_tension}
Negative qualifiers (objection seeds):
${(frame.negative_qualifiers || []).map(q => '  - ' + q).join('\n')}`;
  }

  // CP2
  const offerBlock = `## CP2 CORE OFFER (LOCKED)
Community: ${client.community_name}
Platform: ${client.platform}
Central promise: ${client.central_promise}
Transformation: From "${client.transformation?.from}" → "${client.transformation?.to}" in ${client.transformation?.timeframe}
Pricing: ${client.target_price} · ${client.pricing_model} · ${client.pricing_tier}
Core mechanic: ${client.core_mechanic}
Audience for:
${(client.audience_fit?.for || []).map(f => '  - ' + f).join('\n')}
Audience not_for (objection material):
${(client.audience_fit?.not_for || []).map(f => '  - ' + f).join('\n')}`;

  // CP3 modules
  const modules = Array.isArray(client.modules) ? client.modules : [];
  const modulesBlock = `## CP3 MODULES (LOCKED)
${modules.map((m, i) => `  ${i + 1}. [${m.format}] ${m.name} → ${m.transformation_delivered}`).join('\n')}`;

  // CP4 value stack + mechanism
  const mechanism = client.mechanism;
  const stack = client.value_stack;
  let stackBlock = '## CP4 VALUE STACK + MECHANISM (LOCKED)';
  if (mechanism) {
    stackBlock += `\nMechanism: ${mechanism.name} — ${mechanism.description}`;
  }
  if (stack) {
    stackBlock += `\nValue stack total: ${stack.total} vs actual ${stack.actualPrice}`;
    stackBlock += `\nStack items:\n${(stack.items || []).map((it, i) => `  ${i + 1}. ${it.solution} (${it.dollarValue})`).join('\n')}`;
  }

  // Phase 2 archetype + fame tier (drives social_proof_line and tone)
  let archetypeBlock = '';
  if (archetype) {
    archetypeBlock = `## ARCHETYPE + FAME (Phase 2)
Primary: ${archetype.primary_archetype} (${archetype.primary_confidence}%)
Fame tier: ${archetype.fame_tier}
Fame evidence (USE this verbatim for social_proof_line if fame_tier ≥ niche_recognized): ${archetype.fame_tier_evidence || '(none)'}`;
  }

  // Phase 3 voice + elements (the contrarian elements drive objection seeds)
  let uniquenessBlock = '';
  if (uniqueness) {
    const elements = (uniqueness.unique_elements || []).map((e, i) =>
      `  [${i}] (${e.category} · ${e.monetization_potential}$) ${e.element}`
    ).join('\n');
    uniquenessBlock = `## UNIQUENESS (Phase 3)
CREATOR VOICE: ${uniqueness.creator_voice_summary || '(none)'}

Elements (esp. contrarian_angle ones — those audiences push back on):
${elements || '(none)'}`;
  }

  const userMessage = `Write the final sales copy for this offer. Match creator voice precisely. Reuse Phase 3 vocabulary verbatim. The audience has read the rest of the pitch — this is the polish that closes them.

${frameBlock}

${offerBlock}

${modulesBlock}

${stackBlock}

${archetypeBlock}

${uniquenessBlock}

${extraInstruction ? `## ADDITIONAL INSTRUCTION\n${extraInstruction}\n\n` : ''}Return ONLY the JSON object per the schema in the system prompt.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
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
    if (retryCount < 1) return runSalesCopy(apiKey, creator, retryCount + 1, 'Your previous response was not parseable JSON. Return ONLY a JSON object — no prose, no markdown fences.');
    return { error: 'Model returned non-JSON output after retry', raw: rawText, errors: [], retries: retryCount };
  }

  const validation = validateSalesCopy(parsed);
  if (!validation.valid) {
    if (retryCount < 1) {
      const retryResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 6000,
          system: SYSTEM_PROMPT,
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
          const retryValidation = validateSalesCopy(retryParsed);
          if (retryValidation.valid) return enrich(retryParsed, archetype, retryValidation.warnings, retryCount + 1);
          return { error: 'Schema validation failed twice', errors: retryValidation.errors, raw: retryText, retries: retryCount + 1 };
        }
      }
    }
    return { error: 'Schema validation failed', errors: validation.errors, raw: rawText, retries: retryCount };
  }

  return enrich(parsed, archetype, validation.warnings, retryCount);
}

function enrich(data, archetype, warnings, retries) {
  return { data, fameTier: archetype?.fame_tier || null, warnings, retries };
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
