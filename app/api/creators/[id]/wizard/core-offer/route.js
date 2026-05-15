import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../../lib/creators';
import { validateCoreOffer, VALID_PRICING_TIERS, TIER_PRICE_HINTS } from '../../../../../lib/schemas/coreOffer';
import { readCheckpointProgress } from '../../../../../lib/offerSchema';

// ~$0.04 per call. Sonnet only, no web_search. Bigger output than CP1
// (community name, mechanic, pricing all in one) so max_tokens is higher.
export const maxDuration = 90;

// ─────────────────────────────────────────────────────────────────
// Phase 4 · Checkpoint 2 — Core Offer
//
// First creator-facing checkpoint. Writes the spine of the offer that the
// creator sees: Big Idea, transformation, who-it's-for / not-for, pricing
// tier, community name + platform, core mechanic + weekly rhythm. CP3 will
// fill in modules; CP4 the value stack; CP5 the differentiator + sales copy.
//
// Body: { pricing_tier: 'low' | 'mid' | 'high' } — operator picks before
// generation. The model sizes target_price to the chosen tier.
//
// Inputs (all already gathered):
//   - LOCKED Phase 4 CP1 strategic_frame (cite-able, internal-only)
//   - Phase 1 ecosystem audit (existing price points anchor pricing)
//   - Phase 2 archetype + fame tier (tone + audience trust signals)
//   - Phase 3 uniqueness elements (creator_voice_summary + monetization=high|medium)
//   - Creator bio, niche, audience demographics
//
// Pre-conditions:
//   - CP1 must be locked. If not, refuse.
//   - CP2 must not already be locked. If it is, operator must unlock first
//     (cascade-invalidates CP3-5).
// ─────────────────────────────────────────────────────────────────

export async function POST(request, { params }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const pricingTier = body.pricing_tier;
    if (!VALID_PRICING_TIERS.includes(pricingTier)) {
      return NextResponse.json({ error: `pricing_tier is required, must be one of: ${VALID_PRICING_TIERS.join('|')}` }, { status: 400 });
    }

    const creator = await getCreator(id);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    const meta = creator.offer?.internal_metadata || {};
    const progress = readCheckpointProgress(meta);
    if (!progress.locked[1]) {
      return NextResponse.json({ error: 'CP1 (Strategic Frame) must be locked before running CP2.' }, { status: 412 });
    }
    if (progress.locked[2]) {
      return NextResponse.json({
        error: 'Checkpoint 2 is locked. Unlock it first (this will cascade-invalidate CP3-5).',
        locked_at: progress.locked[2],
      }, { status: 412 });
    }

    const result = await runCoreOffer(apiKey, creator, pricingTier);
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
          central_promise: result.data.central_promise,
          transformation: result.data.transformation,
          audience_fit: result.data.audience_fit,
          pricing_model: result.data.pricing_model,
          pricing_tier: result.data.pricing_tier,
          target_price: result.data.target_price,
          community_name: result.data.community_name,
          name_candidates: result.data.name_candidates,
          platform: result.data.platform,
          core_mechanic: result.data.core_mechanic,
          weekly_rhythm: result.data.weekly_rhythm,
        },
        internal_metadata: {
          ...existingMeta,
          generation_timestamps: {
            ...(existingMeta.generation_timestamps || {}),
            core_offer: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      core_offer: result.data,
      _diagnostics: {
        pricing_tier_input: pricingTier,
        frame_role: result.frameRole,
        uniqueness_elements_input: result.uniquenessElementsInput,
        retries: result.retries,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Core offer generation failed' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// Prompt + Claude call
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `# CORE OFFER — Phase 4 · Checkpoint 2

You are writing the SPINE of an offer that a creator will sell to their audience. This is the first creator-facing output of the wizard. From this checkpoint onward, EVERY string must sound like the creator wrote it themselves.

## VOICE — the most important constraint

You will be given a creator_voice_summary describing the creator's tone, vocabulary, and stylistic tics. Match it. Do not write in generic marketing voice. If the voice summary says "direct, systems-focused, anti-complexity," then:
- Don't write "Unlock your AI superpower"
- Do write "Stop testing 15 tools every week. Pick two. Build the system around them."

The creator's audience can smell generic copy in one line. If the output reads like a Hormozi clone or a SaaS landing page, you've failed.

## WHAT YOU PRODUCE

A JSON object with these fields. EVERY string in creator voice.

1. **central_promise** — One sentence. The Big Idea / hook. Specific, concrete, and (where possible) reuses vocabulary or contrarian angles from Phase 3 uniqueness elements. Max ~240 chars.
   - Bad: "Master AI to grow your business."
   - Good: "Build a documented, AI-orchestrated business that runs on 6 Notion databases — and stop drowning in tool recommendations."

2. **transformation** — { from, to, timeframe }
   - from: the BEFORE state in the audience's words ("juggling 15 AI tools, nothing connects")
   - to: the AFTER state, specific and measurable
   - timeframe: realistic (60-90 days, 3 months, etc.)

3. **audience_fit** — { for: [3-6 bullets], not_for: [2-5 bullets] }
   - for: positive qualifiers — translate CP1's audience_segment into "you" language ("You run a one-person business with one existing service")
   - not_for: REWRITE the operator's negative_qualifiers as creator-voice bullets — don't just copy them. Sharp. Specific. Sales-confident, not apologetic.

4. **pricing_model** — One of: one_time | monthly | annual | hybrid
   - Choose based on CP1's confirmed_role:
     * continuity → monthly (typically)
     * entry_point → low monthly or one-time low-ticket
     * premium_upsell → high one-time OR hybrid (initial + monthly)
     * standalone → match what makes sense for the transformation timeframe

5. **pricing_tier** — Use the tier passed in the user message (operator already picked it).

6. **target_price** — A specific price string that fits the tier. Examples:
   - low + monthly: "€47/mo", "€97/mo"
   - mid + monthly: "€297/mo", "€397/mo"
   - high + monthly: "€997/mo", "€1497/mo"
   - mid + one-time: "€997 one-time"
   - high + hybrid: "€2497 + €197/mo"

7. **community_name** — A specific, brand-able name for the community. Pull from Phase 3 vocabulary if a strong term exists. Avoid clichés (no "Academy", "Mastermind", "Inner Circle" unless those genuinely fit the creator).

8. **name_candidates** — 2-4 ALTERNATE names operator can swap in. Each must be a distinct flavour (one descriptive, one metaphorical, one short-snappy, etc.) — not minor variants of the primary.

9. **platform** — One of: Skool | Whop | Circle | Discord
   - Skool : default for community-forward offers, course + chat
   - Whop  : aggressive monetization, integrations, paywall flexibility
   - Circle: more polished / brand-conscious creators
   - Discord: technical / dev / younger audiences, live-chat heavy

10. **core_mechanic** — 1-3 sentences describing what HAPPENS in the community each week. Not the value, the mechanic. ("Every Monday, members submit one system bottleneck. Every Thursday we audit one publicly on a live call and ship the fix.")

11. **weekly_rhythm** — 3-6 short bullets (≤100 chars each) listing the weekly cadence. Day + format. ("Mon · System Submit Thread", "Thu · Live Audit Call", "Fri · Template Drop")

## STYLE RULES

- No "Unlock", "Discover", "Transform" verbs. They're banned.
- No 3-adjective stacks ("smart, fast, scalable"). They're banned.
- No "this isn't just X, it's Y" construction. Banned.
- Reuse Phase 3 vocabulary elements verbatim when they exist (e.g. if Phase 3 has "Stride System Template", USE that phrase, don't invent a parallel one).
- Reference Phase 3 contrarian angles in central_promise or transformation.from when possible.

## OUTPUT

Return ONLY a JSON object. No prose, no markdown.

{
  "central_promise": "string (max 240)",
  "transformation": { "from": "string", "to": "string", "timeframe": "string" },
  "audience_fit": { "for": ["..."], "not_for": ["..."] },
  "pricing_model": "one_time" | "monthly" | "annual" | "hybrid",
  "pricing_tier": "low" | "mid" | "high",
  "target_price": "string",
  "community_name": "string (max 60)",
  "name_candidates": ["...", "..."],
  "platform": "Skool" | "Whop" | "Circle" | "Discord",
  "core_mechanic": "string (max 500)",
  "weekly_rhythm": ["≤100 chars", ...]
}`;

async function runCoreOffer(apiKey, creator, pricingTier, retryCount = 0, extraInstruction = null) {
  const meta = creator.offer?.internal_metadata || {};
  const frame = meta.strategic_frame || null;
  const audit = meta.ecosystem_audit || null;
  const archetype = meta.archetype_classification || null;
  const uniqueness = meta.uniqueness_extraction || null;

  // ── Phase 4 CP1 — the locked strategic commit
  let frameBlock = '';
  if (frame) {
    frameBlock = `## STRATEGIC FRAME (CP1 · LOCKED — cite by signal, never copy verbatim into creator-facing fields)
Confirmed role: ${frame.confirmed_role}
Dominant transformation (operator language): ${frame.dominant_transformation}
Audience segment: ${frame.audience_segment?.description}
Audience anchor: ${frame.audience_segment?.demographics_anchor}
Negative qualifiers (translate these into "not for" bullets — REWRITE in creator voice):
${(frame.negative_qualifiers || []).map(q => '  - ' + q).join('\n')}
Positioning tension: ${frame.positioning_tension}`;
  }

  // ── Phase 1 — existing price points anchor pricing decisions
  let auditBlock = '';
  if (audit) {
    const products = (audit.ecosystem_map?.products_found || []).map(p =>
      `  - ${p.name} (${p.tier} · ${p.format}${p.price ? ' · ' + p.price : ''})`
    ).join('\n');
    auditBlock = `## ECOSYSTEM (Phase 1)
Existing products (use these as price anchors):
${products || '  (none mapped)'}`;
  }

  // ── Phase 2 — archetype shapes tone, fame anchors confidence
  let archetypeBlock = '';
  if (archetype) {
    archetypeBlock = `## ARCHETYPE + FAME (Phase 2)
Archetype: ${archetype.primary_archetype} (${archetype.primary_confidence}%)
Fame tier: ${archetype.fame_tier} — ${archetype.fame_tier_evidence || '(no external signal)'}`;
  }

  // ── Phase 3 — the voice + the differentiator material
  let uniquenessBlock = '';
  if (uniqueness) {
    const elements = (uniqueness.unique_elements || []).map((e, i) =>
      `  ${i + 1}. [${e.category} · ${e.monetization_potential}$${e.usable_in_modules ? ' · MOD' : ''}] ${e.element}\n     evidence: ${e.evidence_source}`
    ).join('\n');
    uniquenessBlock = `## UNIQUENESS (Phase 3)
CREATOR VOICE (match this tone exactly):
${uniqueness.creator_voice_summary || '(none)'}

Unique elements (reuse vocabulary + contrarian angles in creator-facing copy):
${elements || '(none)'}`;
  }

  const ae = creator.audienceEstimate || {};
  const audienceLine = [
    ae.gender, ae.age, ae.location, ae.language,
    Array.isArray(ae.interests) ? `interests: ${ae.interests.slice(0, 5).join(', ')}` : null,
  ].filter(Boolean).join(' · ') || 'unknown';

  const creatorBlock = `## CREATOR
Name: ${creator.name || 'Unknown'}
Niche: ${creator.niche || 'Unknown'}
Bio: ${(creator.bio || '').slice(0, 500) || '(no bio)'}
Audience: ${audienceLine}`;

  const tierLine = `## PRICING TIER (locked by operator)
Tier: ${pricingTier} — target range: ${TIER_PRICE_HINTS[pricingTier]}
Pick pricing_model and target_price that fit this tier AND the confirmed_role.`;

  const userMessage = `Generate the core offer for this creator. Match the creator_voice_summary tone exactly. Reuse Phase 3 vocabulary when possible.

${creatorBlock}

${frameBlock}

${auditBlock}

${archetypeBlock}

${uniquenessBlock}

${tierLine}

${extraInstruction ? `## ADDITIONAL INSTRUCTION\n${extraInstruction}\n\n` : ''}Return ONLY the JSON object per the schema in the system prompt.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3500,
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
    if (retryCount < 1) return runCoreOffer(apiKey, creator, pricingTier, retryCount + 1, 'Your previous response was not parseable JSON. Return ONLY a JSON object — no prose, no markdown fences.');
    return { error: 'Model returned non-JSON output after retry', raw: rawText, errors: [], retries: retryCount };
  }

  // Operator's tier choice is authoritative — overwrite whatever the model
  // returned to prevent it drifting (e.g. asked for "mid", model picks "high"
  // because target_price felt premium).
  parsed.pricing_tier = pricingTier;

  const validation = validateCoreOffer(parsed);
  if (!validation.valid) {
    if (retryCount < 1) {
      const retryResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3500,
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
          retryParsed.pricing_tier = pricingTier;
          const retryValidation = validateCoreOffer(retryParsed);
          if (retryValidation.valid) return enrich(retryParsed, frame, uniqueness, retryCount + 1);
          return { error: 'Schema validation failed twice', errors: retryValidation.errors, raw: retryText, retries: retryCount + 1 };
        }
      }
    }
    return { error: 'Schema validation failed', errors: validation.errors, raw: rawText, retries: retryCount };
  }

  return enrich(parsed, frame, uniqueness, retryCount);
}

function enrich(data, frame, uniqueness, retries) {
  return {
    data,
    frameRole: frame?.confirmed_role || null,
    uniquenessElementsInput: (uniqueness?.unique_elements || []).length,
    retries,
  };
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
