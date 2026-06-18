/**
 * Strategic Frame (Phase 4 · Checkpoint 1) schema + validator.
 *
 * The frame is internal — it's the strategic decision the operator commits
 * to BEFORE the wizard writes a single line of creator-facing copy. CP2+
 * read it as system context but the creator never sees it.
 *
 * Lives under:
 *   creator.offer.internal_metadata.strategic_frame
 *
 * Source inputs (the endpoint passes all three as prompt context):
 *   - ecosystem_audit       — strategic_role, products_found, gaps_identified
 *   - archetype_classification — primary archetype + fame tier
 *   - uniqueness_extraction  — creator_voice_summary + top elements
 *
 * Constraints:
 *   - confirmed_role     : strict enum (matches ecosystem_audit role enum)
 *   - rationale          : exactly 3-5 bullets — forces concision, no novels
 *   - negative_qualifiers: 2-5 bullets — the model MUST say who it's NOT for,
 *                          a classic Hormozi step that's easy to skip
 *   - positioning_tension: non-empty — the conflict the offer resolves. If
 *                          there's no tension, there's no offer.
 */

export const VALID_CONFIRMED_ROLES = [
  'entry_point',
  'continuity',
  'premium_upsell',
  'standalone',
];

// Imported lazily inside the validator (top-level import would create
// a circular dependency between this file and offerArchetypes if the
// latter ever needs frame helpers). The string match is what matters.
import { OFFER_ARCHETYPES, OFFER_ARCHETYPE_LABELS } from './offerArchetypes';

/**
 * Format the Strategic Frame for inclusion in a downstream wizard's
 * user-message context. Replaces the bespoke inline blocks that each
 * wizard route used to build by hand (which only included 5 of the
 * 11+ fields and ignored the six load-bearing moves entirely).
 *
 * Returns an empty string when the frame is missing — caller can just
 * concatenate the result with their other context.
 *
 * Output is operator-facing prompt context, not creator-facing copy.
 * The trailing CONSTRAINT block tells the downstream LLM to treat the
 * thesis as the boss — if the offer it's about to write contradicts
 * the reflex_trap or undermines the binding_constraint, it must
 * reconsider rather than charge ahead.
 */
export function formatStrategicFrameForPrompt(frame) {
  if (!frame || typeof frame !== 'object') return '';
  const lines = [];
  lines.push('## STRATEGIC FRAME (CP1 · LOCKED — this is the boss)');
  lines.push('Every downstream choice must align with the six moves below. Cite the move you derived from when justifying a decision. Do NOT recommend what reflex_trap.default_move rejected — that path was explicitly ruled out.');
  lines.push('');

  // ── Offer archetype — surface this PROMINENTLY at the top so the
  //    downstream wizard immediately knows whether it's building a
  //    community-shaped offer, a productized service, a commerce play,
  //    a cohort course, or a hybrid. Fields below (community_name,
  //    weekly_rhythm, etc.) still exist but their semantics shift
  //    based on the archetype.
  const arch = frame.primary_offer_archetype;
  if (arch && OFFER_ARCHETYPES.includes(arch)) {
    lines.push(`### >>> OFFER ARCHETYPE: ${arch.toUpperCase()} (${OFFER_ARCHETYPE_LABELS[arch]})`);
    if (frame.archetype_rationale) lines.push(`Why this archetype: ${frame.archetype_rationale}`);
    if (arch !== 'community_recurring') {
      // The hub's current schemas were built assuming community_recurring.
      // For other shapes we tell the LLM to REUSE the existing fields
      // with shifted semantics — until separate schemas land in a
      // future commit, this is the bridge that keeps non-community
      // outputs coherent.
      lines.push('');
      lines.push('SEMANTIC SHIFT — this is NOT a community offer. Reuse the existing schema fields with these adjusted meanings:');
      if (arch === 'productized_service') {
        lines.push('  - community_name → product/service name (e.g. "El Salón Edit")');
        lines.push('  - central_promise → outcome the deliverable produces, not "community vibe"');
        lines.push('  - weekly_rhythm → delivery cadence per buyer (e.g. "questionnaire → mood board in 5 days → call → revisions")');
        lines.push('  - core_mechanic → the templatized production method, not group rituals');
        lines.push('  - modules → stages of the delivery process, not curriculum weeks');
        lines.push('  - pricing_model is almost always "one_time" per delivery');
      } else if (arch === 'commerce_affiliate') {
        lines.push('  - community_name → the curated edit / shop concept name (e.g. "El Salón de Leyre")');
        lines.push('  - central_promise → "the rooms she shows, ready to buy" — taste-curation, not transformation');
        lines.push('  - weekly_rhythm → posting/edit-drop cadence');
        lines.push('  - core_mechanic → the curation method (taste filter + brand-partnership flow)');
        lines.push('  - modules → likely fewer/lighter — focus on the curated catalog, anchor partnerships, content flywheel');
        lines.push('  - pricing_model is "one_time" per affiliate sale (revenue is per-purchase, not per-member)');
      } else if (arch === 'cohort_education') {
        lines.push('  - community_name → the program/course name');
        lines.push('  - central_promise → the practitioner-level capability built (NOT consumer transformation)');
        lines.push('  - weekly_rhythm → the cohort schedule (weeks 1-N)');
        lines.push('  - core_mechanic → the teaching method (live cohorts, recorded, etc.)');
        lines.push('  - modules → curriculum weeks, fixed sequence');
        lines.push('  - pricing_model is "one_time" — cohort tuition, not subscription');
      } else if (arch === 'hybrid_stack') {
        lines.push('  - You are building a STACK. Use pricing tiers to express each shape side-by-side.');
        lines.push('  - central_promise must work for the WHOLE stack, not just one tier.');
        lines.push('  - modules can be archetype-mixed (some delivery-process, some curriculum, some content-edit).');
      }
    } else {
      lines.push('(Community-shaped — the schema fields apply with their original meanings.)');
    }
    lines.push('');
  }

  if (frame.confirmed_role) lines.push(`Confirmed role: ${frame.confirmed_role}`);
  if (frame.dominant_transformation) lines.push(`Dominant transformation: ${frame.dominant_transformation}`);

  // ── The six moves ─────────────────────────────────────────────
  const ar = frame.audience_reframe;
  if (ar) {
    lines.push('');
    lines.push('### Move 1 — Audience reframe');
    if (ar.raw_observation)         lines.push(`Raw observation: ${ar.raw_observation}`);
    if (ar.default_interpretation)  lines.push(`Default reading (REJECTED): ${ar.default_interpretation}`);
    if (ar.reframe)                 lines.push(`Reframe (USE THIS): ${ar.reframe}`);
  }

  const rt = frame.reflex_trap;
  if (rt) {
    lines.push('');
    lines.push('### Move 2 — Reflex trap (DO NOT BUILD THIS)');
    if (rt.default_move) lines.push(`Default move to AVOID: ${rt.default_move}`);
    if (rt.why_wrong)    lines.push(`Why wrong: ${rt.why_wrong}`);
  }

  const plays = Array.isArray(frame.sequenced_plays) ? frame.sequenced_plays : [];
  if (plays.length) {
    lines.push('');
    lines.push('### Move 3 — Sequenced plays (execution order, fastest cash first)');
    plays.forEach((p, i) => {
      const range = (p.realistic_monthly_low != null || p.realistic_monthly_high != null)
        ? ` · €${p.realistic_monthly_low ?? '?'}–${p.realistic_monthly_high ?? '?'}/mo`
        : '';
      lines.push(`  ${i + 1}. ${p.name || '(unnamed)'}${range}`);
      if (p.why_now)               lines.push(`     why now: ${p.why_now}`);
      if (p.time_to_first_revenue) lines.push(`     time-to-revenue: ${p.time_to_first_revenue}`);
      if (p.leverages)             lines.push(`     leverages: ${p.leverages}`);
      if (p.templatization_potential) lines.push(`     templatization: ${p.templatization_potential}`);
    });
    lines.push(`>>> The CURRENT offer being built should implement play #1 (${plays[0]?.name || 'the first play'}) — that's the one this wizard is sizing for. Later plays are downstream business, not this round.`);
  }

  const bc = frame.binding_constraint;
  if (bc) {
    lines.push('');
    lines.push('### Move 4 — Binding constraint');
    if (bc.name)        lines.push(`Constraint: ${bc.name}`);
    if (bc.implication) lines.push(`Implication: ${bc.implication}`);
  }

  const cb = frame.contrarian_bet;
  if (cb) {
    lines.push('');
    lines.push('### Move 5 — Contrarian bet');
    if (cb.conventional_wisdom) lines.push(`Conventional: ${cb.conventional_wisdom}`);
    if (cb.bet)                 lines.push(`Bet: ${cb.bet}`);
    if (cb.evidence)            lines.push(`Evidence: ${cb.evidence}`);
  }

  const cg = frame.capture_gap;
  if (cg) {
    lines.push('');
    lines.push('### Move 6 — Capture gap (close this FIRST)');
    if (cg.gap)          lines.push(`Gap: ${cg.gap}`);
    if (cg.first_action) lines.push(`First action: ${cg.first_action}`);
  }

  // ── Existing strategic-frame fields ───────────────────────────
  if (frame.audience_segment?.description || frame.audience_segment?.demographics_anchor) {
    lines.push('');
    lines.push('### Audience segment');
    if (frame.audience_segment?.description)         lines.push(`Description: ${frame.audience_segment.description}`);
    if (frame.audience_segment?.demographics_anchor) lines.push(`Anchor: ${frame.audience_segment.demographics_anchor}`);
  }
  if (Array.isArray(frame.negative_qualifiers) && frame.negative_qualifiers.length) {
    lines.push('');
    lines.push('### Negative qualifiers (NOT for)');
    frame.negative_qualifiers.forEach(q => lines.push(`  - ${q}`));
  }
  if (frame.positioning_tension) {
    lines.push('');
    lines.push(`### Positioning tension`);
    lines.push(frame.positioning_tension);
  }
  if (frame.differentiation_from_existing) {
    lines.push('');
    lines.push(`### Differentiation from existing communities`);
    lines.push(frame.differentiation_from_existing);
  }

  // ── Adversarial review — flag any must-fix items so the
  //     downstream wizard knows where the thesis is weakest. We
  //     don't BLOCK on a weak verdict (the operator can choose to
  //     proceed) but the LLM sees the verdict and the critique.
  const ar2 = frame.adversarial_review;
  if (ar2 && (ar2.verdict || ar2.weakest_move || (ar2.must_fix_before_proceeding || []).length)) {
    lines.push('');
    lines.push('### Adversarial review (skeptic\'s critique of the thesis)');
    if (ar2.verdict) lines.push(`Verdict: ${ar2.verdict.toUpperCase()}`);
    if (ar2.weakest_move?.move_name) {
      lines.push(`Weakest move: ${ar2.weakest_move.move_name}`);
      if (ar2.weakest_move.why_weakest) lines.push(`Why: ${ar2.weakest_move.why_weakest}`);
    }
    const mf = Array.isArray(ar2.must_fix_before_proceeding) ? ar2.must_fix_before_proceeding : [];
    if (mf.length) {
      lines.push('Must-fix flags (address in this output if possible):');
      mf.forEach(s => lines.push(`  - ${s}`));
    }
  }

  return lines.join('\n');
}

function isStr(v) { return typeof v === 'string' && v.length > 0; }

export function validateStrategicFrame(obj) {
  const errors = [];
  const push = (p, m) => errors.push(`${p}: ${m}`);

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['root: must be a JSON object'] };
  }

  if (!VALID_CONFIRMED_ROLES.includes(obj.confirmed_role)) {
    push('confirmed_role', `must be one of ${VALID_CONFIRMED_ROLES.join('|')}`);
  }

  if (!isStr(obj.dominant_transformation)) {
    push('dominant_transformation', 'required non-empty string (short, internal phrasing — sales copy comes later)');
  } else if (obj.dominant_transformation.length > 240) {
    push('dominant_transformation', `should be at most ~240 chars (got ${obj.dominant_transformation.length}) — tighten`);
  }

  // audience_segment — object with description + a demographics anchor.
  if (!obj.audience_segment || typeof obj.audience_segment !== 'object' || Array.isArray(obj.audience_segment)) {
    push('audience_segment', 'required object { description, demographics_anchor }');
  } else {
    if (!isStr(obj.audience_segment.description)) push('audience_segment.description', 'required non-empty string');
    if (!isStr(obj.audience_segment.demographics_anchor)) push('audience_segment.demographics_anchor', 'required non-empty string (cite a specific signal from the audience data — age range, profession, niche)');
  }

  // negative_qualifiers — 2-5 bullets. Forces the model to define who it's
  // NOT for, a classic Hormozi step.
  if (!Array.isArray(obj.negative_qualifiers)) {
    push('negative_qualifiers', 'must be an array of 2-5 bullets (who this is NOT for)');
  } else if (obj.negative_qualifiers.length < 2 || obj.negative_qualifiers.length > 5) {
    push('negative_qualifiers', `must contain 2-5 bullets (got ${obj.negative_qualifiers.length})`);
  } else {
    obj.negative_qualifiers.forEach((s, i) => {
      if (!isStr(s)) push(`negative_qualifiers[${i}]`, 'must be a non-empty string');
    });
  }

  if (!isStr(obj.positioning_tension)) {
    push('positioning_tension', 'required non-empty string (the conflict the offer resolves — without tension there is no offer)');
  } else if (obj.positioning_tension.length > 400) {
    push('positioning_tension', `should be at most ~400 chars (got ${obj.positioning_tension.length})`);
  }

  // differentiation_from_existing — REQUIRED when the ecosystem audit
  // reported community_cannibalization_risk ∈ {high, medium}. We can't
  // enforce that conditionally here without passing audit context, so the
  // field is OPTIONAL at the schema level but the prompt makes it
  // mandatory when cannibalization risk is present.
  if (obj.differentiation_from_existing != null) {
    if (!isStr(obj.differentiation_from_existing)) {
      push('differentiation_from_existing', 'if present, must be a non-empty string');
    } else if (obj.differentiation_from_existing.length > 500) {
      push('differentiation_from_existing', `should be at most ~500 chars (got ${obj.differentiation_from_existing.length})`);
    }
  }

  // ecosystem_impact — 3-5 bullets describing how the new offer changes
  // the economics of the creator's existing ecosystem. Required.
  // Drives the right column of pitch slide 3 (Mapa do Ecossistema).
  // Should be specific and money-anchored ("Blueprint Academy graduates
  // upgrading to The Six Database System would add €X/mo per member").
  if (!Array.isArray(obj.ecosystem_impact)) {
    push('ecosystem_impact', 'must be an array of 3-5 bullets (impact on existing ecosystem — specific, money-anchored)');
  } else if (obj.ecosystem_impact.length < 3 || obj.ecosystem_impact.length > 5) {
    push('ecosystem_impact', `must contain 3-5 bullets (got ${obj.ecosystem_impact.length})`);
  } else {
    obj.ecosystem_impact.forEach((s, i) => {
      if (!isStr(s)) push(`ecosystem_impact[${i}]`, 'must be a non-empty string');
      else if (s.length > 320) push(`ecosystem_impact[${i}]`, `should be ≤320 chars (got ${s.length}) — punchy, scannable`);
    });
  }

  // rationale — 3-5 bullets justifying every choice above. Operator scans
  // these at review time. Anything outside the range fails — long lists are
  // just CYA noise, short lists hide unjustified leaps.
  if (!Array.isArray(obj.rationale)) {
    push('rationale', 'must be an array of 3-5 bullets');
  } else if (obj.rationale.length < 3 || obj.rationale.length > 5) {
    push('rationale', `must contain 3-5 bullets (got ${obj.rationale.length})`);
  } else {
    obj.rationale.forEach((s, i) => {
      if (!isStr(s)) push(`rationale[${i}]`, 'must be a non-empty string');
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // THE SIX STRATEGIC MOVES (2026-06-18). Each one is load-bearing —
  // the offer downstream needs all six to be filled non-generically
  // for the strategy to actually be a strategy. Validator enforces
  // PRESENCE; the prompt enforces non-generic CONTENT.
  // ─────────────────────────────────────────────────────────────────

  // Move 1 — Audience reframe. Raw observation → default reading → reframe.
  if (!obj.audience_reframe || typeof obj.audience_reframe !== 'object' || Array.isArray(obj.audience_reframe)) {
    push('audience_reframe', 'required object { raw_observation, default_interpretation, reframe }');
  } else {
    if (!isStr(obj.audience_reframe.raw_observation))        push('audience_reframe.raw_observation', 'required non-empty string (what the data literally shows)');
    if (!isStr(obj.audience_reframe.default_interpretation)) push('audience_reframe.default_interpretation', 'required non-empty string (the naive reading)');
    if (!isStr(obj.audience_reframe.reframe))                push('audience_reframe.reframe', 'required non-empty string (the load-bearing reinterpretation)');
  }

  // Move 2 — Reflex trap.
  if (!obj.reflex_trap || typeof obj.reflex_trap !== 'object' || Array.isArray(obj.reflex_trap)) {
    push('reflex_trap', 'required object { default_move, why_wrong }');
  } else {
    if (!isStr(obj.reflex_trap.default_move)) push('reflex_trap.default_move', 'required non-empty string (the obvious monetization move)');
    if (!isStr(obj.reflex_trap.why_wrong))    push('reflex_trap.why_wrong', 'required non-empty string (why it addresses the wrong audience slice or hits the constraint)');
  }

  // Move 3 — Sequenced plays. 3-5 ordered, fastest cash first.
  if (!Array.isArray(obj.sequenced_plays)) {
    push('sequenced_plays', 'must be an array of 3-5 plays in execution order (fastest cash first)');
  } else if (obj.sequenced_plays.length < 3 || obj.sequenced_plays.length > 5) {
    push('sequenced_plays', `must contain 3-5 plays (got ${obj.sequenced_plays.length})`);
  } else {
    const validTemplatization = new Set(['low', 'medium', 'high']);
    obj.sequenced_plays.forEach((p, i) => {
      if (!p || typeof p !== 'object' || Array.isArray(p)) {
        push(`sequenced_plays[${i}]`, 'must be an object');
        return;
      }
      if (!isStr(p.name))                  push(`sequenced_plays[${i}].name`, 'required non-empty string');
      if (!isStr(p.why_now))               push(`sequenced_plays[${i}].why_now`, 'required non-empty string (why THIS step)');
      if (!isStr(p.time_to_first_revenue)) push(`sequenced_plays[${i}].time_to_first_revenue`, 'required non-empty string');
      if (!isStr(p.leverages))             push(`sequenced_plays[${i}].leverages`, 'required non-empty string (existing asset/behaviour)');
      if (!validTemplatization.has(p.templatization_potential)) push(`sequenced_plays[${i}].templatization_potential`, `must be one of low|medium|high (got ${p.templatization_potential})`);
      if (p.realistic_monthly_low  != null && typeof p.realistic_monthly_low  !== 'number') push(`sequenced_plays[${i}].realistic_monthly_low`,  'must be number or null');
      if (p.realistic_monthly_high != null && typeof p.realistic_monthly_high !== 'number') push(`sequenced_plays[${i}].realistic_monthly_high`, 'must be number or null');
      if (
        typeof p.realistic_monthly_low === 'number' &&
        typeof p.realistic_monthly_high === 'number' &&
        p.realistic_monthly_low > p.realistic_monthly_high
      ) {
        push(`sequenced_plays[${i}].realistic_monthly_low`, 'must be ≤ realistic_monthly_high');
      }
    });
  }

  // Move 4 — Binding constraint.
  if (!obj.binding_constraint || typeof obj.binding_constraint !== 'object' || Array.isArray(obj.binding_constraint)) {
    push('binding_constraint', 'required object { name, implication }');
  } else {
    if (!isStr(obj.binding_constraint.name))        push('binding_constraint.name', 'required non-empty string (operator time, capital, trust, etc.)');
    if (!isStr(obj.binding_constraint.implication)) push('binding_constraint.implication', 'required non-empty string (what it forces about strategy)');
  }

  // Move 5 — Contrarian bet.
  if (!obj.contrarian_bet || typeof obj.contrarian_bet !== 'object' || Array.isArray(obj.contrarian_bet)) {
    push('contrarian_bet', 'required object { conventional_wisdom, bet, evidence }');
  } else {
    if (!isStr(obj.contrarian_bet.conventional_wisdom)) push('contrarian_bet.conventional_wisdom', 'required non-empty string (default playbook)');
    if (!isStr(obj.contrarian_bet.bet))                 push('contrarian_bet.bet', 'required non-empty string (how this offer rejects the default)');
    if (!isStr(obj.contrarian_bet.evidence))            push('contrarian_bet.evidence', 'required non-empty string (what supports the bet)');
  }

  // Move 6 — Capture gap.
  if (!obj.capture_gap || typeof obj.capture_gap !== 'object' || Array.isArray(obj.capture_gap)) {
    push('capture_gap', 'required object { gap, first_action }');
  } else {
    if (!isStr(obj.capture_gap.gap))          push('capture_gap.gap', 'required non-empty string (owned-audience or operational hole)');
    if (!isStr(obj.capture_gap.first_action)) push('capture_gap.first_action', 'required non-empty string (concrete first step)');
  }

  // Offer archetype — labels sequenced_plays[0]'s offer shape so CP2-CP4
  // can adapt. Required since 2026-06-18; falling back to
  // community_recurring on unknown values is the caller's choice, not
  // the validator's. archetype_rationale ties the label to the play.
  if (!OFFER_ARCHETYPES.includes(obj.primary_offer_archetype)) {
    push('primary_offer_archetype', `must be one of ${OFFER_ARCHETYPES.join('|')}`);
  }
  if (!isStr(obj.archetype_rationale)) {
    push('archetype_rationale', 'required non-empty string (cite sequenced_plays[0] by name + the constraint that forced this archetype)');
  }

  return { valid: errors.length === 0, errors };
}
