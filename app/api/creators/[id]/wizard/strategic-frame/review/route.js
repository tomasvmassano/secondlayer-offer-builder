import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../../../lib/creators';

// Adversarial review of an existing Strategic Frame.
//
// Was originally inline inside /strategic-frame's POST handler — a
// second LLM call after the main thesis succeeded. That worked, but
// total time (main thesis + review) regularly crossed Vercel's 60s
// Hobby-tier maxDuration cap, which surfaced as a non-JSON Vercel
// timeout response that the cascade modal couldn't parse.
//
// Separating into its own endpoint gives the review its own 30s
// budget and decouples its failure mode from the main thesis.
//
// Usage: client calls POST /api/creators/:id/wizard/strategic-frame/review
// AFTER the main strategic-frame call succeeds. The review reads the
// already-saved strategic_frame, runs the critique, and writes it
// back under strategic_frame.adversarial_review.
//
// Best-effort: any failure returns 200 with { ok: false, error } so
// the client UI doesn't bubble up a hard error — the operator just
// doesn't see a critique. The main thesis still ships.
export const maxDuration = 30;

const ADVERSARIAL_SYSTEM_PROMPT = `# STRATEGIC FRAME · ADVERSARIAL REVIEW

You are an experienced strategist asked to STRESS-TEST a strategic thesis that another strategist just produced for a creator-monetization offer.

Your job is NOT to write a new thesis. Your job is to find every reason the existing one might fail. You are paid to be skeptical, not constructive. Default to skepticism; if you cannot find a real weakness in a move, say so explicitly rather than fabricating one.

## WHAT YOU MUST DO

For the thesis you receive, run six checks:

1. **Identify the weakest move.** Of the six moves in the thesis (audience_reframe, reflex_trap, sequenced_plays, binding_constraint, contrarian_bet, capture_gap), name the ONE that's most vulnerable to being wrong and explain why in 2-3 sentences. "Vulnerable" means: the strategy fails hard if this move is wrong, AND the move was stated with thin evidence.

2. **Surface 2-4 assumptions that MUST hold for this thesis to work.** Things the thesis takes for granted without proof. Each assumption: 1 sentence stating the assumption, 1 sentence explaining what breaks if it's false.

3. **Name 2-4 concrete failure modes.** Specific ways the strategy could fail in execution. Not generic "the market shifts" — concrete things like "operator burns out at month 3 because productized e-design at 30 rooms/mo means 30 design calls a month they didn't anticipate" or "the affiliate revenue assumed in play #1 requires 6 months of relationship-building with brands; the thesis treats it as immediate."

4. **State a counter-thesis.** 2-3 sentences. If you had to argue for a DIFFERENT strategic shape entirely, what would you say? Not a refinement — a genuine alternative. If you can't construct a credible counter, say "No credible counter — the thesis is well-anchored" and justify in 1 sentence.

5. **Issue a verdict.** One of:
   - **strong**   — the thesis is well-evidenced, internally consistent, and the failure modes are manageable. Proceed to CP2.
   - **moderate** — the thesis is plausible but has 1-2 must-fix items the operator should address before committing. Specify them.
   - **weak**     — the thesis has structural problems (contradictions, missing evidence, default consensus dressed up). The operator should regenerate or rework before proceeding.

6. **List 0-3 must-fix items.** Concrete things the operator should clarify, validate, or change BEFORE moving to CP2. Empty array = nothing critical. Each item: 1-2 sentences, actionable.

## STYLE

- Sharp, declarative. No hedging language. Either you have a concrete critique or you don't.
- Reference SPECIFIC fields in the thesis when you critique them.
- Operator language, no marketing fluff.
- Match the thesis's output language (Portuguese, English, or Spanish — same as the input).

## OUTPUT

Return ONLY a JSON object matching this schema. No prose, no markdown.

{
  "weakest_move": {
    "move_name": "audience_reframe | reflex_trap | sequenced_plays | binding_constraint | contrarian_bet | capture_gap",
    "why_weakest": "string (2-3 sentences)"
  },
  "assumptions_that_must_hold": [
    { "assumption": "string", "if_false": "string" }
  ],
  "failure_modes": [
    { "mode": "string", "trigger": "string" }
  ],
  "counter_thesis": "string (2-3 sentences)",
  "verdict": "strong" | "moderate" | "weak",
  "must_fix_before_proceeding": [
    "string"
  ]
}`;

// Defensive JSON extractor — same as the main strategic-frame route's.
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

export async function POST(_request, { params }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { id } = await params;
    const creator = await getCreator(id);
    if (!creator) return NextResponse.json({ ok: false, error: 'Creator not found' });

    const meta = creator.offer?.internal_metadata || {};
    const frame = meta.strategic_frame;
    if (!frame || typeof frame !== 'object') {
      return NextResponse.json({ ok: false, error: 'No strategic_frame to review yet' });
    }

    // Build prompt context — same shape as the inline version was.
    const audit = meta.ecosystem_audit || null;
    const archetype = meta.archetype_classification || null;
    const anchor = [
      `Creator: ${creator.name || 'Unknown'} · ${creator.niche || 'Unknown niche'}`,
      `Followers: IG ${creator.platforms?.instagram?.followers || 0}${creator.platforms?.tiktok?.followers ? `, TT ${creator.platforms.tiktok.followers}` : ''}${creator.platforms?.youtube?.subscribers ? `, YT ${creator.platforms.youtube.subscribers}` : ''}`,
      audit?.ecosystem_map?.community_cannibalization_risk
        ? `Cannibalization risk: ${audit.ecosystem_map.community_cannibalization_risk}`
        : null,
      archetype?.primary_archetype
        ? `Archetype: ${archetype.primary_archetype} (${archetype.primary_confidence}%)`
        : null,
    ].filter(Boolean).join('\n');

    // Strip any previous adversarial_review — never review your own previous review.
    const { adversarial_review: _ignored, ...frameForReview } = frame;

    const langHint = creator?.primaryLanguage === 'en'
      ? 'LANGUAGE: critique strings in English.'
      : creator?.primaryLanguage === 'es'
      ? 'LANGUAGE: critique strings in Castilian Spanish ("tú" form).'
      : 'LANGUAGE: critique strings in Portuguese (PT-PT).';

    const userMessage = `${langHint}

## CREATOR ANCHOR
${anchor}

## THESIS TO STRESS-TEST
\`\`\`json
${JSON.stringify(frameForReview, null, 2)}
\`\`\`

Run the six checks. Return the JSON critique only.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        system: [{ type: 'text', text: ADVERSARIAL_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      return NextResponse.json({ ok: false, error: `Anthropic ${resp.status}: ${errBody.slice(0, 200)}` });
    }
    const data = await resp.json();
    const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    const parsed = tryParseJson(rawText);
    if (!parsed) return NextResponse.json({ ok: false, error: 'Non-JSON response from model' });

    // Shape-check + dimensional caps. Same normalisation logic as before.
    const validVerdicts = new Set(['strong', 'moderate', 'weak']);
    const validMoves = new Set([
      'audience_reframe', 'reflex_trap', 'sequenced_plays',
      'binding_constraint', 'contrarian_bet', 'capture_gap',
    ]);
    const normalized = {
      weakest_move: parsed.weakest_move && typeof parsed.weakest_move === 'object'
        ? {
            move_name: validMoves.has(parsed.weakest_move.move_name) ? parsed.weakest_move.move_name : null,
            why_weakest: typeof parsed.weakest_move.why_weakest === 'string' ? parsed.weakest_move.why_weakest : '',
          }
        : null,
      assumptions_that_must_hold: Array.isArray(parsed.assumptions_that_must_hold)
        ? parsed.assumptions_that_must_hold
            .filter(a => a && typeof a === 'object' && typeof a.assumption === 'string' && typeof a.if_false === 'string')
            .slice(0, 4)
        : [],
      failure_modes: Array.isArray(parsed.failure_modes)
        ? parsed.failure_modes
            .filter(f => f && typeof f === 'object' && typeof f.mode === 'string' && typeof f.trigger === 'string')
            .slice(0, 4)
        : [],
      counter_thesis: typeof parsed.counter_thesis === 'string' ? parsed.counter_thesis : '',
      verdict: validVerdicts.has(parsed.verdict) ? parsed.verdict : null,
      must_fix_before_proceeding: Array.isArray(parsed.must_fix_before_proceeding)
        ? parsed.must_fix_before_proceeding.filter(s => typeof s === 'string').slice(0, 3)
        : [],
      generated_at: new Date().toISOString(),
    };

    // Write the review back into the existing strategic_frame.
    const existingOffer = creator.offer || {};
    const existingMeta = existingOffer.internal_metadata || {};
    const existingFrame = existingMeta.strategic_frame || {};
    await updateCreator(id, {
      offer: {
        ...existingOffer,
        internal_metadata: {
          ...existingMeta,
          strategic_frame: { ...existingFrame, adversarial_review: normalized },
        },
      },
    });

    return NextResponse.json({ ok: true, adversarial_review: normalized });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message || 'Review failed' });
  }
}
