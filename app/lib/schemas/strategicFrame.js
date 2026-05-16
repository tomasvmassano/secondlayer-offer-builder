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

  return { valid: errors.length === 0, errors };
}
