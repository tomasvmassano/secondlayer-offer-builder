import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../../lib/creators';
import { validateStrategicFrame, VALID_CONFIRMED_ROLES } from '../../../../../lib/schemas/strategicFrame';
import { readCheckpointProgress } from '../../../../../lib/offerSchema';
import { OPERATOR_INSTRUCTIONS_RULE, formatInstructionsBlock, formatInstructionsReminder } from '../../../../../lib/operatorInstructions';

// Pure Sonnet 4 call (no web_search) — fast (~10-20s), ~$0.02.
// CP1 has no external lookups; everything it needs is in Phases 1-3.
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────
// Phase 4 · Checkpoint 1 — Strategic Frame
//
// Synthesises Phase 1+2+3 into the operator's strategic commitment BEFORE
// any creator-facing copy is written. The frame answers:
//   - What role does the new offer play in the funnel?
//   - What dominant transformation does it deliver?
//   - Who is it for (and explicitly NOT for)?
//   - What positioning tension does it resolve?
//
// Output: internal-only. Lives under
//   creator.offer.internal_metadata.strategic_frame
//
// Re-run policy: refused if CP1 is already locked. Operator must explicitly
// unlock CP1 first (which cascades-invalidates downstream checkpoints).
// ─────────────────────────────────────────────────────────────────

export async function POST(request, { params }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const creator = await getCreator(id);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    // Optional operator-supplied instruction for re-runs — gets appended to
    // the user message under "## ADDITIONAL INSTRUCTION". Lets the operator
    // steer the regen ("make it more conservative", "emphasise the missing
    // mid-tier", "shorten bullet 0", etc.) without unlocking + losing the
    // downstream CPs.
    const body = await request.json().catch(() => ({}));
    const instruction = typeof body?.instruction === 'string' && body.instruction.trim()
      ? body.instruction.trim().slice(0, 1000)
      : null;

    // Block if CP1 already locked — operator must unlock first (cascade) to
    // avoid stale downstream output silently surviving a frame change.
    const meta = creator.offer?.internal_metadata || {};
    const progress = readCheckpointProgress(meta);
    if (progress.locked[1]) {
      return NextResponse.json({
        error: 'Checkpoint 1 is locked. Unlock it first (this will cascade-invalidate CP2-5).',
        locked_at: progress.locked[1],
      }, { status: 412 });
    }

    const result = await runStrategicFrame(apiKey, creator, 0, instruction);
    if (result.error) {
      return NextResponse.json({ error: result.error, errors: result.errors, raw: result.raw }, { status: 502 });
    }

    const existingOffer = creator.offer || {};
    const existingMeta = existingOffer.internal_metadata || {};
    await updateCreator(id, {
      offer: {
        ...existingOffer,
        internal_metadata: {
          ...existingMeta,
          strategic_frame: result.data,
          generation_timestamps: {
            ...(existingMeta.generation_timestamps || {}),
            strategic_frame: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      strategic_frame: result.data,
      _diagnostics: {
        audit_role_input: result.auditRoleInput,
        archetype_used: result.archetypeUsed,
        uniqueness_elements_input: result.uniquenessElementsInput,
        retries: result.retries,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Strategic frame generation failed' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// Prompt + Claude call
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `# STRATEGIC FRAME — Phase 4 · Checkpoint 1

You are synthesising three internal analyses (ecosystem audit, archetype classification, uniqueness extraction) into the strategic decision the operator commits to BEFORE writing any creator-facing copy.

This output is INTERNAL. It is not the sales copy. It is not even close to sales copy. It is the operator's commit to a positioning. Use direct, operator-language phrasing — no marketing fluff.

## CANNIBALIZATION CHECK — DO THIS FIRST

Before deciding anything else, read Phase 1's ecosystem_audit.ecosystem_map.existing_communities and community_cannibalization_risk.

If community_cannibalization_risk is "high" or "medium":
  - The creator ALREADY runs a paid community. The new offer CANNOT compete with it head-on.
  - You MUST set confirmed_role to a value that puts the new offer at a DIFFERENT tier than the existing community:
      Existing low_ticket community  → confirmed_role = premium_upsell  (new offer at mid or high tier)
      Existing mid_ticket community  → confirmed_role = standalone OR entry_point (different audience or lower tier)
      Existing high_ticket community → confirmed_role = entry_point (lower-tier funnel-feeder)
  - You MUST fill the differentiation_from_existing field with 2-4 sentences making the distinction explicit. Reference the existing community by name. Example: "Blueprint Academy serves beginners learning the foundations at €36/mo. The Six Database System serves Blueprint Academy graduates and advanced operators ready to systematise — different audience, different price band, complementary not competing."

If community_cannibalization_risk is "low" or "none":
  - differentiation_from_existing may be left empty / null.
  - confirmed_role can match Phase 1's strategic_role suggestion.

## THINKING DISCIPLINE — DO THIS FIRST

Before you fill any field, force yourself through five strategic moves. Each one of them is a load-bearing claim — if your output skips them or fills them generically, the offer downstream collapses into the same generic course/community that a junior operator would produce.

**Move 1 — Audience reframe.** Look at the demographics + geography + interests. State what the data literally says. Then state what an inexperienced operator would conclude from it. Then state the NON-OBVIOUS reinterpretation that flips the monetization conclusion. Example: a Spanish interior designer's 409K audience is 80% Spain, 75% women 30-45 — default interpretation is "designer audience, sell a course teaching design." Reframe: "this is a CONSUMER audience watching before/afters and dreaming about their own homes — the money is in fixing THEIR space, not training them to do design." That single sentence collapses an entire monetization branch.

**Move 2 — Reflex trap.** Name the obvious move the operator would default to. Then name why it's wrong — usually because it addresses the wrong slice of the audience, or hits the binding constraint head-on. Example: "Default move = course teaching interior design fundamentals. Wrong because it serves the 5% of the 409K who want to become designers; the other 95% want their home fixed."

**Move 3 — Sequenced plays.** Order the monetization plays by TIME-TO-CASH, fastest first. Each play funds the next. Don't list a flat menu of options; list a phased execution plan. Each play needs: what it is, why it goes at THIS step, realistic monthly revenue range in the creator's currency, and what existing behaviour/asset it leverages. Example sequence for a consumer-audience interior designer:
  1. Commerce now (affiliate edits + brand partnerships) — zero new product, leverages content she's already making, €3-6K/mo within a quarter
  2. Productized e-design (€290-490/room async) — bridges "I admire her" → "I can never afford her", 30-50 rooms/mo = €10-20K
  3. "Diseña tu casa" community (€19-29/mo for homeowners, NOT designers) — recurring, doubles as lead pool for #2
  4. Designer education (PR/visibility positioning) — later, different audience, different product

**Move 4 — Binding constraint.** Say the constraint out loud. Usually it's operator time. Sometimes capital, sometimes trust deficit, sometimes audience capture. Once you name it, the scalable plays fall out naturally and the un-scalable ones get demoted. Example: "Operator's time. Reforma Integral can never scale past her hours, so it sits at the top as a ceiling but the funnel does NOT feed into it as the destination."

**Move 5 — Contrarian bet.** State the conventional wisdom for this creator type, then state the bet this offer makes against it. Without naming the contrarian view, you can't tell whether the offer is differentiated or just default consensus dressed up. Example: "Conventional wisdom = high-ticket DFY sits at the top of the funnel as the goal. Bet = high-ticket DFY is the CEILING but commerce + productized + recurring are the engine; only a small number of community members graduate into DFY rather than the whole audience funnelling toward it."

**Move 6 — Capture gap.** Name ONE specific owned-audience or operational gap that must be closed first because every euro built above is more durable once it's closed. Most often this is email capture (lead magnet). Sometimes it's a specific platform pivot or a CRM hole. One sentence on what + one sentence on the specific first step.

These six moves go into named output fields below. The rest of the output (confirmed_role, dominant_transformation, audience_segment, etc.) flows OUT of these — you should be able to justify every other field by pointing back to one of the six.

## WHAT YOU MUST DECIDE

1. **confirmed_role** — One of: entry_point | continuity | premium_upsell | standalone
   - Phase 1's ecosystem_audit.strategic_role is a suggestion. You may confirm it, OR override it with a 1-sentence justification in the rationale array.
   - entry_point: the new community is the cheapest way in (top of funnel)
   - continuity: monthly subscription that retains existing buyers
   - premium_upsell: highest-ticket offer (graduates of cheaper tiers)
   - standalone: doesn't fit into the existing funnel — sits beside it
   - **If cannibalization risk is high/medium, the rules in the CANNIBALIZATION CHECK section override these.**

2. **dominant_transformation** — A short, operator-language description of the change the offer delivers. NOT sales copy.
   - Bad: "Unlock your AI superpower today"
   - Good: "Solo operators with one existing service productise it into a community by month 3"

3. **audience_segment** — Object:
   - description: 1-2 sentences naming the specific person, not "everyone interested in X"
   - demographics_anchor: a concrete signal pulled from audience data — age range, profession, niche markers. Cite the source.

4. **negative_qualifiers** — 2-5 bullets. Who this is explicitly NOT for. This forces clarity.
   - Examples: "Not for absolute beginners with no prior service", "Not for agencies above $50K MRR", "Not for people who want a course, not a community"

5. **positioning_tension** — 1-2 sentences. The conflict the offer resolves. Without tension there is no offer.
   - "Wants AI-powered systems but doesn't want to build alone OR pay $10K/mo for an agency"

6. **rationale** — 3-5 bullets. Each bullet justifies one of the choices above using EVIDENCE from the inputs (cite which Phase the signal came from).
   - Example: "Confirmed entry_point because Phase 1 shows the existing high-ticket consultancy at €5K means the community at €100-300/mo functions as a lead magnet"

7. **differentiation_from_existing** — 2-4 sentences. ONLY required when cannibalization risk is high/medium. Must reference existing communities by name. Explains why the new offer serves a different audience, tier, or stage than what the creator already sells. See CANNIBALIZATION CHECK section above.

8. **ecosystem_impact** — 3-5 bullets, ≤320 chars each. Lands on pitch deck slide 3 (Mapa do Ecossistema). Bullet[0] is the BIG QUOTE on the right; bullets[1+] render as smaller supporting notes underneath.

   **Bullet[0] — the human WHY (most important bullet).**
   ONE sentence (≤200 chars) that reads like a senior strategist explaining over coffee why this offer FITS at this exact rung of the ladder. NOT a calculation. NOT a projection. A diagnosis.
   - Reference the gap by name. Name the existing rungs above and below. Explain the slot.
   - Use plain language. No "MRR adicional", no "%", no "X membros em Y meses" math. Save that for bullets[1+].
   - GOOD: "Esta tier encaixa entre o Chase AI+ (€95) e a mentoria 1:1 (€4850) — é o passo natural para quem já paga, vê valor, e quer mais do que a comunidade mas ainda não está pronto para a mentoria."
   - GOOD: "The €297 rung is the missing middle: today members either pay €95 and stay, or jump €4,755 to the 1:1 — nobody upgrades in the middle because there is no middle."
   - BAD: "Graduados X que fazem upgrade para Y geram €Z/mês se W% fazem transição em N meses" (this is a calculation, not a why — move it to bullets[1+])
   - BAD: "Adds recurring revenue stream" (abstract)

   **Bullets[1+] — the money-anchored supporting details.**
   2-4 bullets that flesh out the financial picture. THESE can be numerical, projective, specific. Each bullet should be specific, money-anchored, and felt — not abstract.
   - GOOD: "Blueprint Academy graduates upgrading at €297/mo add ~€7,000/mo if 5% of the 4,500 members jump in 6 months."
   - GOOD: "Strategic consultancy clients (€5K each) get nudged into the recurring tier post-engagement — recovers retainer revenue lost when projects end."
   - BAD: "Increases customer lifetime value" (vague, no number, no entity)
   - BAD: "Synergy with existing offers" (meaningless)

## STYLE

- Operator language, not creator language
- Short, dense bullets — no padding
- Cite Phase signals when possible ("Phase 2 archetype=builder_operator implies...")
- If Phase 1, 2, or 3 is missing, work with what's there and add a rationale bullet noting the gap

## OUTPUT

Return ONLY a JSON object matching this schema. No prose, no markdown, no commentary.

{
  // ─── The six strategic moves (load-bearing). Every other field below
  //     must be justifiable by reference to one of these. Do NOT skip
  //     any of them — if a move genuinely doesn't apply, write that
  //     down explicitly instead of inventing a generic answer. ───

  "audience_reframe": {
    "raw_observation": "string (1-2 sentences) — what the demographics + geography + interests data literally shows. Cite numbers when available.",
    "default_interpretation": "string (1 sentence) — what an inexperienced operator would conclude from the raw observation alone.",
    "reframe": "string (1-2 sentences) — the non-obvious reinterpretation that flips the monetization conclusion. This must be a real reframe, not a restatement. If there is no genuine reframe, write 'No reframe — default reading holds' and justify in rationale."
  },

  "reflex_trap": {
    "default_move": "string (1 sentence) — the obvious monetization move the operator would default to (course, community, agency, etc.)",
    "why_wrong": "string (1-2 sentences) — why this addresses the wrong slice of the audience or hits the binding constraint head-on. Cite percentages or constraints."
  },

  "sequenced_plays": [   // 3-5 plays in EXECUTION ORDER (fastest cash first). Each play funds the next.
    {
      "name": "string — short title (e.g., 'Commerce: affiliate edits + brand partnerships')",
      "why_now": "string (1-2 sentences) — why this play goes at THIS step, not earlier or later",
      "time_to_first_revenue": "string — concrete estimate ('within a quarter', 'month 1', etc.)",
      "realistic_monthly_low": number | null,    // monthly revenue floor in the creator's primary currency (EUR unless otherwise noted)
      "realistic_monthly_high": number | null,   // monthly revenue ceiling, same currency
      "leverages": "string — what existing asset/behaviour/skill this play piggybacks on (e.g., 'reels she already makes')",
      "templatization_potential": "low" | "medium" | "high"
    }
  ],

  "binding_constraint": {
    "name": "string — the actual bottleneck (operator time, capital, trust deficit, audience capture, etc.)",
    "implication": "string (1-2 sentences) — what this constraint forces about the strategy (what's scalable vs not, what should be the ceiling vs the engine)"
  },

  "contrarian_bet": {
    "conventional_wisdom": "string (1 sentence) — the default playbook for this creator type",
    "bet": "string (1-2 sentences) — how this offer rejects that default",
    "evidence": "string (1-2 sentences) — what in Phases 1-3 supports the bet"
  },

  "capture_gap": {
    "gap": "string (1 sentence) — the specific owned-audience or operational hole to close first (usually email capture)",
    "first_action": "string (1 sentence) — the concrete first step (e.g., 'free room-by-room before/after PDF as a lead magnet')"
  },

  // ─── The original strategic-frame fields. These FLOW OUT of the six
  //     moves above. If any of them contradicts the six moves, the six
  //     moves win — rewrite the lower field, don't fudge the move. ───

  "confirmed_role": "entry_point" | "continuity" | "premium_upsell" | "standalone",
  "dominant_transformation": "string (max ~240 chars)",
  "audience_segment": {
    "description": "string",
    "demographics_anchor": "string"
  },
  "negative_qualifiers": ["string", "string", ...],   // 2-5 items
  "positioning_tension": "string (max ~400 chars)",
  "rationale": ["string", ...],                        // 3-5 bullets — each must cite which of the 6 moves it derives from
  "differentiation_from_existing": "string or null",   // required when cannibalization_risk ∈ {high, medium}; null otherwise
  "ecosystem_impact": ["string", ...]                  // 3-5 bullets, ≤320 chars each, money-anchored
}

${OPERATOR_INSTRUCTIONS_RULE}`;

async function runStrategicFrame(apiKey, creator, retryCount = 0, extraInstruction = null) {
  const meta = creator.offer?.internal_metadata || {};
  const audit = meta.ecosystem_audit || null;
  const archetype = meta.archetype_classification || null;
  const uniqueness = meta.uniqueness_extraction || null;

  // ── Phase 1 summary
  let auditBlock = '';
  if (audit) {
    const products = (audit.ecosystem_map?.products_found || []).map(p => {
      const sym = p.currency === 'USD' ? '$' : p.currency === 'GBP' ? '£' : '€';
      return `${p.name} (${p.tier} · ${p.format}${p.price_eur ? ' · ' + sym + p.price_eur : ''})`;
    }).join('\n  - ');
    const gaps = (audit.ecosystem_map?.gaps_identified || []).join('\n  - ');
    const cannibalization = (audit.cannibalization_constraints || []).join('\n  - ');
    const synergy = (audit.synergy_opportunities || []).join('\n  - ');
    // NEW: surface existing_communities + community_cannibalization_risk
    // prominently — the prompt's CANNIBALIZATION CHECK section reads these.
    const existingComms = (audit.ecosystem_map?.existing_communities || []).map(c =>
      `${c.name} (${c.tier}${c.price_eur ? ' · €' + c.price_eur + '/mo' : ''} · ${c.format})`
    ).join('\n  - ');
    const cannibalRisk = audit.ecosystem_map?.community_cannibalization_risk || 'unknown';
    auditBlock = `## PHASE 1 · ECOSYSTEM AUDIT
Suggested strategic_role: ${audit.strategic_role}
Has high-ticket: ${audit.ecosystem_map?.has_high_ticket ?? '?'}
Completeness: ${audit.ecosystem_map?.ecosystem_completeness_score ?? '?'}%

### EXISTING COMMUNITIES (cannibalization risk: ${cannibalRisk.toUpperCase()})
${existingComms ? '  - ' + existingComms : '  (none — creator does not currently sell any paid community)'}

Products found:
  - ${products || '(none mapped)'}

Gaps identified:
  - ${gaps || '(none)'}

Cannibalization constraints:
  - ${cannibalization || '(none)'}

Synergy opportunities:
  - ${synergy || '(none)'}`;
  } else {
    auditBlock = '## PHASE 1 · ECOSYSTEM AUDIT\n(not yet run — note this in rationale)';
  }

  // ── Phase 2 summary
  let archetypeBlock = '';
  if (archetype) {
    archetypeBlock = `## PHASE 2 · ARCHETYPE + FAME
Primary: ${archetype.primary_archetype} (${archetype.primary_confidence}%)${archetype.secondary_archetype ? ` · Secondary: ${archetype.secondary_archetype} (${archetype.secondary_confidence}%)` : ''}
Fame tier: ${archetype.fame_tier}
Fame evidence: ${archetype.fame_tier_evidence || '(none)'}
Classification evidence:
${(archetype.classification_evidence || []).map(e => '  - ' + e).join('\n') || '  (none)'}`;
  } else {
    archetypeBlock = '## PHASE 2 · ARCHETYPE + FAME\n(not yet run — note this in rationale)';
  }

  // ── Phase 3 summary — full uniqueness elements so the model can spot
  //    high-value differentiators that should anchor positioning_tension
  let uniquenessBlock = '';
  if (uniqueness) {
    const elements = (uniqueness.unique_elements || []).map((e, i) =>
      `  ${i + 1}. [${e.category} · ${e.monetization_potential}$${e.usable_in_modules ? ' · MOD' : ''}] ${e.element}\n     evidence: ${e.evidence_source}`
    ).join('\n');
    uniquenessBlock = `## PHASE 3 · UNIQUENESS
Creator voice (summary): ${uniqueness.creator_voice_summary || '(none)'}

Unique elements (${(uniqueness.unique_elements || []).length}):
${elements || '(none)'}`;
  } else {
    uniquenessBlock = '## PHASE 3 · UNIQUENESS\n(not yet run — note this in rationale)';
  }

  // ── Audience signal
  const ae = creator.audienceEstimate || {};
  const audienceLine = [
    ae.gender, ae.age, ae.location, ae.language,
    Array.isArray(ae.interests) ? `interests: ${ae.interests.slice(0, 5).join(', ')}` : null,
  ].filter(Boolean).join(' · ') || 'unknown';

  const creatorBlock = `## CREATOR
Name: ${creator.name || 'Unknown'}
Niche: ${creator.niche || 'Unknown'}
IG followers: ${creator.platforms?.instagram?.followers || 0}${creator.platforms?.tiktok?.followers ? `, TT ${creator.platforms.tiktok.followers}` : ''}${creator.platforms?.youtube?.subscribers ? `, YT ${creator.platforms.youtube.subscribers}` : ''}
Bio: ${(creator.bio || '').slice(0, 500) || '(no bio)'}
Audience: ${audienceLine}`;

  // Wizard outputs feed the pitch deck the creator sees — every string must
  // be in the creator's primary language. Phase 1-3 inputs above may be in
  // English (they're operator-only); the model is responsible for outputting
  // in the target language regardless.
  const langHint = creator?.primaryLanguage === 'en'
    ? `LANGUAGE: Output every string field in ENGLISH. The Phase 1-3 inputs above may be in English already — keep it that way.`
    : creator?.primaryLanguage === 'es'
    ? `LANGUAGE: Output every string field in Castilian Spanish (España, "tú" form). The Phase 1-3 inputs above may be in English or Portuguese — translate the strategic substance into Spanish for the output. Do NOT mix languages.`
    : `LANGUAGE: Output every string field in PORTUGUESE (PT-PT). The Phase 1-3 inputs above may be in English — translate the strategic substance into Portuguese for the output. Do NOT mix languages.`;

  const userMessage = `Synthesise the three internal analyses below into the strategic frame for this creator's new offer.

${formatInstructionsBlock(extraInstruction)}${langHint}

${creatorBlock}

${auditBlock}

${archetypeBlock}

${uniquenessBlock}

Return ONLY the JSON object per the schema in the system prompt.${formatInstructionsReminder(extraInstruction)}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
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
    if (retryCount < 1) return runStrategicFrame(apiKey, creator, retryCount + 1, 'Your previous response was not parseable JSON. Return ONLY a JSON object — no prose, no markdown fences.');
    return { error: 'Model returned non-JSON output after retry', raw: rawText, errors: [], retries: retryCount };
  }

  const validation = validateStrategicFrame(parsed);
  if (!validation.valid) {
    if (retryCount < 1) {
      // Same retry pattern as Phase 3 — feed errors back via a follow-up.
      const retryResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4000,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
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
          const retryValidation = validateStrategicFrame(retryParsed);
          if (retryValidation.valid) return enrich(retryParsed, audit, archetype, uniqueness, retryCount + 1);
          return { error: 'Schema validation failed twice', errors: retryValidation.errors, raw: retryText, retries: retryCount + 1 };
        }
      }
    }
    return { error: 'Schema validation failed', errors: validation.errors, raw: rawText, retries: retryCount };
  }

  return enrich(parsed, audit, archetype, uniqueness, retryCount);
}

function enrich(data, audit, archetype, uniqueness, retries) {
  return {
    data,
    auditRoleInput: audit?.strategic_role || null,
    archetypeUsed: !!archetype,
    uniquenessElementsInput: (uniqueness?.unique_elements || []).length,
    retries,
  };
}

// Defensive JSON extractor.
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
