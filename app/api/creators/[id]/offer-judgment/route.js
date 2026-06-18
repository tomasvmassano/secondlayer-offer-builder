import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { validateOfferJudgment } from '../../../../lib/schemas/offerJudgment';
import { OPERATOR_INSTRUCTIONS_RULE, formatInstructionsBlock, formatInstructionsReminder } from '../../../../lib/operatorInstructions';

// Phase 5 — Offer Judgment (Kill Test).
// Skeptical evaluation of each sequenced_play in the strategic_frame.
// Uses Sonnet 4.5 (no Haiku — the role requires nuance the smaller model
// won't carry consistently). max_tokens 2500 fits the schema for 3 plays.
// Cost: ~$0.05 / run.
export const maxDuration = 60;

const SYSTEM_PROMPT = `# PHASE 5 · OFFER JUDGMENT (KILL TEST)

## ROLE AND STANCE

You are the operator's most skeptical advisor. Every prior phase was built to find opportunity. Your job is the opposite: to KILL bad offers cheaply before the creator wastes a quarter building them. A correct output of this phase can be "do not build any of these." You are not being helpful by finding opportunity; you are being helpful by being right.

Your single most important corrective: **FOLLOWER COUNT IS NOT MARKET SIZE.** Audience size measures attention, not purchase intent. Most followers of any creator are passive. Your default assumption is that the buyer pool is a small fraction of the audience, and the burden of proof is on raising that estimate, never on lowering it.

## INPUTS (provided in the user message)
- Strategic frame: positioning, archetype, six moves, **sequenced_plays** (the candidate offers you evaluate)
- Ecosystem audit (Phase 1): strategic role, existing products, cannibalization risk
- Archetype + fame (Phase 2): creator archetype, fame tier
- Uniqueness (Phase 3): real differentiators
- Audience demographics + engagement signal

## NOTE ON MARKET VALIDATION
Phase 4.5 (market comparable scan) is NOT YET IMPLEMENTED. Score market_validation conservatively from the ecosystem audit alone: if a comparable product appears in audit.ecosystem_map.products_found with similar format → score 4. If audit notes the format as a gap with no operators → score 2. If unknown → score 3 (the median, since absence is ambiguous).

## STEP 1 — CLASSIFY THE AUDIENCE

Before evaluating any offer, classify on two axes:

- **audience_posture**: PASSIVE (consumes content for enjoyment/aspiration — visual niches like interiors, travel, food, fitness aesthetics) vs ACTIVE (consumes content to act — learning a skill, solving a current problem, building something). Most aspirational visual niches are PASSIVE. State which and why in 1-2 sentences.
- **what_audience_trusts_creator_FOR**: in one sentence. The specific thing the audience values. NOT the same as the creator's credentials. (e.g. "they trust her as the artist whose home transformations they love watching" — NOT "they trust her as an IED faculty member.")

These two constrain every offer below. An offer that requires an ACTIVE audience, or requires the audience to want something other than what they trust the creator FOR, starts at a severe disadvantage.

## STEP 2 — SCORE EACH OFFER (1-5, higher is better)

For EVERY sequenced_play, produce a scores block with these six fields. Each score has a one-line justification (≤180 chars):

- **buyer_intent_density**: what fraction of the audience plausibly has purchase intent for THIS offer, given audience_posture. Tie to a number, not an adjective. Default pessimistic.
- **audience_offer_fit**: does this offer match what_audience_trusts_creator_FOR? 5 = exact match, 1 = requires them to want something unrelated.
- **creator_time_cost**: 5 = fully leveraged/async/templated; 1 = rebuilds the hours-trap (1:1, live, per-client bespoke). Practitioner/performer archetypes are hours-bound by default — any offer scoring 1-2 here must be flagged as non-scalable in the justification.
- **friction**: how much must the buyer DO to get value? 5 = hand over a problem, receive a result (commerce, done-for-you, e-design). 1 = must participate, post, show up, do homework (community, cohort). Cross-reference with audience_posture: high-friction + PASSIVE audience = validate before build, mandatory.
- **market_validation**: see note above. Be conservative without Phase 4.5 evidence.
- **defensibility**: how hard is this for a competitor to copy? Tie to a specific uniqueness element from Phase 3 where possible.

## STEP 3 — THE KILL TEST (THE CORE OF THIS PHASE)

For each offer, you MUST answer:
- **strongest_failure_reason**: in one sentence — the single strongest reason this offer FAILS.
- **survives**: true/false. Does the offer survive its own strongest objection?
- **survival_reason**: required when survives=true. A concrete reason it holds anyway. NOT a softening — a real defeater of the objection.

If the honest answer is no, mark survives=false and set verdict=KILL. Do not soften. Do not rescue a doomed offer with caveats.

## STEP 4 — RANK AND RECOMMEND

- **weighting_explanation**: state the weighting rule and cite the audience_posture. For PASSIVE audiences, weight friction and buyer_intent_density highest. For ACTIVE audiences, weight audience_offer_fit and defensibility highest.
- **ranked_offers**: every offer (including KILL'd) with a weighted_score and rank. KILL'd offers get the lowest ranks.
- **launch_first**: name the single offer to launch first and why it beats the others on evidence (not vibe). Set to null if every offer is KILL'd.
- **required_validation_tests**: for any offer scoring ≤2 on market_validation but still proposed, require a cheap validation test (waitlist + deposit, comment-mining, lead-magnet opt-in rate) with a GO/NO-GO threshold BEFORE any build. Empty array OK if nothing speculative survives.

## TONE
Blunt, evidence-led, operator-facing. No optimism for its own sake. If the best honest recommendation is "kill the exciting speculative one and monetize the boring proven one," say exactly that in launch_first.why_it_beats_others.

## OUTPUT — RETURN ONLY THIS JSON OBJECT (no prose, no markdown, no commentary)

{
  "audience_classification": {
    "posture": "PASSIVE" | "ACTIVE",
    "posture_rationale": "string ≤220 chars",
    "what_audience_trusts_creator_FOR": "string ≤180 chars"
  },
  "offer_evaluations": [
    {
      "offer_name": "string (must match a sequenced_plays[i].name exactly)",
      "scores": {
        "buyer_intent_density": { "score": 1-5, "justification": "string ≤180 chars" },
        "audience_offer_fit":   { "score": 1-5, "justification": "string ≤180 chars" },
        "creator_time_cost":    { "score": 1-5, "justification": "string ≤180 chars" },
        "friction":             { "score": 1-5, "justification": "string ≤180 chars" },
        "market_validation":    { "score": 1-5, "justification": "string ≤180 chars" },
        "defensibility":        { "score": 1-5, "justification": "string ≤180 chars" }
      },
      "kill_test": {
        "strongest_failure_reason": "string ≤220 chars",
        "survives": true | false,
        "survival_reason": "string ≤220 chars OR null (required when survives=true)"
      },
      "verdict": "KILL" | "SURVIVES"
    }
  ],
  "ranking": {
    "weighting_explanation": "string ≤220 chars",
    "ranked_offers": [ { "offer_name": "string", "weighted_score": number, "rank": integer } ],
    "launch_first": { "offer_name": "string", "why_it_beats_others": "string ≤300 chars" } | null,
    "required_validation_tests": [ { "offer_name": "string", "test": "string ≤180 chars", "threshold": "string ≤140 chars" } ]
  }
}

${OPERATOR_INSTRUCTIONS_RULE}`;

function tryParseJson(text) {
  if (!text) return null;
  let s = String(text).trim().replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\`\`\`\s*$/i, '').trim();
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

function buildUserMessage(creator, extraInstruction) {
  const meta = creator.offer?.internal_metadata || {};
  const frame = meta.strategic_frame || {};
  const audit = meta.ecosystem_audit || {};
  const archetype = meta.archetype_classification || {};
  const uniqueness = meta.uniqueness_extraction || {};

  // Strategic frame summary — the offers under evaluation live in sequenced_plays
  const plays = Array.isArray(frame.sequenced_plays) ? frame.sequenced_plays : [];
  const playsBlock = plays.map((p, i) => {
    const range = p.realistic_monthly_low && p.realistic_monthly_high
      ? ` (range €${p.realistic_monthly_low}-${p.realistic_monthly_high}/mês)`
      : '';
    return `  Play ${i + 1}: "${p.name}"${range}
    why_now: ${p.why_now || '(none)'}
    time_to_first_revenue: ${p.time_to_first_revenue || '(none)'}
    leverages: ${p.leverages || '(none)'}
    templatization: ${p.templatization_potential || '(none)'}`;
  }).join('\n\n');

  const frameBlock = `## STRATEGIC FRAME
archetype: ${frame.primary_offer_archetype || '(none)'}
confirmed_role: ${frame.confirmed_role || '(none)'}
dominant_transformation: ${frame.dominant_transformation || '(none)'}
positioning_tension: ${frame.positioning_tension || '(none)'}
audience_segment: ${frame.audience_segment?.description || '(none)'}
binding_constraint: ${frame.binding_constraint?.name || '(none)'} — ${frame.binding_constraint?.implication || ''}

## CANDIDATE OFFERS (these are what you judge)
${playsBlock || '(no sequenced_plays — nothing to evaluate)'}`;

  // Phase 1-3 context — kept compact
  const productsLine = (audit.ecosystem_map?.products_found || []).slice(0, 6).map(p =>
    `${p.name} (${p.tier} · ${p.format}${p.price_eur ? ' · €' + p.price_eur : ''})`
  ).join('; ');
  const auditBlock = `## PHASE 1 · AUDIT
strategic_role: ${audit.strategic_role || '(none)'}
existing products: ${productsLine || '(none)'}
gaps: ${(audit.ecosystem_map?.gaps_identified || []).slice(0, 4).join('; ') || '(none)'}`;

  const archetypeBlock = `## PHASE 2 · ARCHETYPE + FAME
primary: ${archetype.primary_archetype || '(none)'} (${archetype.primary_confidence || '?'}%)
fame_tier: ${archetype.fame_tier || '(none)'}`;

  const uniqueElements = (uniqueness.unique_elements || []).slice(0, 6).map((e, i) =>
    `  ${i + 1}. [${e.category}] ${e.element}`
  ).join('\n');
  const uniquenessBlock = `## PHASE 3 · UNIQUENESS
voice: ${uniqueness.creator_voice_summary || '(none)'}
top elements:
${uniqueElements || '  (none)'}`;

  // Audience signal
  const ae = creator.audienceEstimate || {};
  const audienceLine = [
    ae.gender, ae.age, ae.location, ae.language,
    Array.isArray(ae.interests) ? `interests: ${ae.interests.slice(0, 5).join(', ')}` : null,
  ].filter(Boolean).join(' · ') || 'unknown';
  const creatorBlock = `## CREATOR
name: ${creator.name || 'Unknown'}
niche: ${creator.niche || 'Unknown'}
IG followers: ${creator.platforms?.instagram?.followers || 0}
bio: ${(creator.bio || '').slice(0, 400) || '(no bio)'}
audience: ${audienceLine}`;

  const langHint = creator?.primaryLanguage === 'en'
    ? 'LANGUAGE: Output every string field in ENGLISH.'
    : creator?.primaryLanguage === 'es'
    ? 'LANGUAGE: Output every string field in Castilian Spanish (España, "tú" form).'
    : 'LANGUAGE: Output every string field in PORTUGUESE (PT-PT).';

  return `Judge the candidate offers in the strategic frame below. Be skeptical. Default to KILL.

${formatInstructionsBlock(extraInstruction)}${langHint}

${creatorBlock}

${frameBlock}

${auditBlock}

${archetypeBlock}

${uniquenessBlock}

Return ONLY the JSON object per the schema in the system prompt.${formatInstructionsReminder(extraInstruction)}`;
}

export async function POST(request, { params }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const creator = await getCreator(id);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    const frame = creator.offer?.internal_metadata?.strategic_frame;
    if (!frame || !Array.isArray(frame.sequenced_plays) || frame.sequenced_plays.length === 0) {
      return NextResponse.json({
        error: 'Cannot judge: strategic_frame is missing or has no sequenced_plays. Run CP1 first.',
      }, { status: 412 });
    }

    const body = await request.json().catch(() => ({}));
    const instruction = typeof body?.instruction === 'string' && body.instruction.trim()
      ? body.instruction.trim().slice(0, 1000)
      : null;

    const userMessage = buildUserMessage(creator, instruction);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        // Sonnet 4.5 — the skeptical role and the kill-test require nuance
        // Haiku won't carry consistently. Cost: ~$0.05/run.
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2500,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return NextResponse.json({
        error: data.error?.message || `Anthropic ${resp.status}`,
      }, { status: 502 });
    }

    const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    const parsed = tryParseJson(rawText);
    if (!parsed) {
      return NextResponse.json({
        error: 'Model returned non-JSON output (re-clica Run kill test)',
        errors: [
          `stop_reason: ${data.stop_reason || '?'}`,
          `output_tokens: ${data.usage?.output_tokens ?? '?'} (cap: 2500)`,
          `tail: ${rawText.slice(-300)}`,
        ],
      }, { status: 502 });
    }

    const validation = validateOfferJudgment(parsed);
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Schema validation failed',
        errors: validation.errors,
        raw: parsed,
      }, { status: 502 });
    }

    const existingOffer = creator.offer || {};
    const existingMeta = existingOffer.internal_metadata || {};
    await updateCreator(id, {
      offer: {
        ...existingOffer,
        internal_metadata: {
          ...existingMeta,
          offer_judgment: parsed,
          generation_timestamps: {
            ...(existingMeta.generation_timestamps || {}),
            offer_judgment: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      offer_judgment: parsed,
      _diagnostics: {
        plays_evaluated: frame.sequenced_plays.length,
        survivors: parsed.offer_evaluations.filter(e => e.verdict === 'SURVIVES').length,
        output_tokens: data.usage?.output_tokens ?? null,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'unknown' }, { status: 500 });
  }
}
