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

  return { valid: errors.length === 0, errors };
}
