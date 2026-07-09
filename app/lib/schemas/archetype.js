/**
 * Archetype Classification (Phase 2) schema + validator.
 *
 * Strictly internal — output lives under
 *   creator.offer.internal_metadata.archetype_classification
 * and is NEVER rendered to the creator.
 *
 * Two outputs in one call:
 *   1. primary archetype (with optional secondary when ambiguous)
 *   2. fame tier (based on external recognition signals, not follower count)
 *
 * Ambiguity rule: if primary_confidence < 70 the validator REQUIRES
 * a secondary_archetype + secondary_confidence pair so the operator has
 * something to disambiguate against in Checkpoint 1.
 */

import { normalizeEnum } from './normalize';

export const VALID_ARCHETYPES = [
  'expert_educator',
  'performer_practitioner',
  'coach_transformation',
  'personality_entertainer',
  'curator_aggregator',
  'builder_operator',
];

export const VALID_FAME_TIERS = [
  'micro',
  'niche_recognized',
  'cross_niche_recognized',
  'celebrity',
];

function isStr(v) { return typeof v === 'string' && v.length > 0; }
function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function isStrArray(v) { return Array.isArray(v) && v.every(x => typeof x === 'string'); }
function inRange(v, lo, hi) { return isNum(v) && v >= lo && v <= hi; }

export function validateArchetype(obj) {
  const errors = [];
  const push = (path, msg) => errors.push(`${path}: ${msg}`);

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['root: must be a JSON object'] };
  }

  // Coerce enum case/spacing before validating (2026-07-09) — the LLM
  // occasionally returns "Expert Educator" / "Micro-Influencer" instead
  // of the snake_case canonical form, which used to hard-fail the phase.
  { const a = normalizeEnum(obj.primary_archetype, VALID_ARCHETYPES); if (a) obj.primary_archetype = a; }
  { const s = normalizeEnum(obj.secondary_archetype, VALID_ARCHETYPES); if (s) obj.secondary_archetype = s; }
  { const f = normalizeEnum(obj.fame_tier, VALID_FAME_TIERS); if (f) obj.fame_tier = f; }

  // primary
  if (!VALID_ARCHETYPES.includes(obj.primary_archetype)) {
    push('primary_archetype', `must be one of ${VALID_ARCHETYPES.join('|')}`);
  }
  if (!inRange(obj.primary_confidence, 0, 100)) {
    push('primary_confidence', 'required number between 0 and 100');
  }

  // secondary — null OR (must be a valid archetype + confidence)
  const hasSecondary = obj.secondary_archetype != null;
  if (hasSecondary) {
    if (!VALID_ARCHETYPES.includes(obj.secondary_archetype)) {
      push('secondary_archetype', `must be one of ${VALID_ARCHETYPES.join('|')} or null`);
    }
    if (obj.secondary_archetype === obj.primary_archetype) {
      push('secondary_archetype', 'cannot equal primary_archetype');
    }
    if (!inRange(obj.secondary_confidence, 0, 100)) {
      push('secondary_confidence', 'required number between 0 and 100 when secondary_archetype is set');
    }
  } else {
    if (obj.secondary_confidence != null && !inRange(obj.secondary_confidence, 0, 100)) {
      push('secondary_confidence', 'must be null when secondary_archetype is null');
    }
  }

  // Ambiguity rule: low primary confidence → secondary REQUIRED.
  if (isNum(obj.primary_confidence) && obj.primary_confidence < 70 && !hasSecondary) {
    push('secondary_archetype', 'required when primary_confidence < 70 (per ambiguity rule)');
  }

  // evidence
  if (!isStrArray(obj.classification_evidence)) {
    push('classification_evidence', 'must be an array of strings');
  } else if (obj.classification_evidence.length === 0) {
    push('classification_evidence', 'must contain at least one evidence string');
  }

  // fame
  if (!VALID_FAME_TIERS.includes(obj.fame_tier)) {
    push('fame_tier', `must be one of ${VALID_FAME_TIERS.join('|')}`);
  }
  if (!isStr(obj.fame_tier_evidence)) {
    push('fame_tier_evidence', 'required non-empty string (say so explicitly if no signals found)');
  }

  return { valid: errors.length === 0, errors };
}
