/**
 * Uniqueness Extraction (Phase 3) schema + validator.
 *
 * The raw extraction stays under
 *   creator.offer.internal_metadata.uniqueness_extraction
 * — operator-only. Phase 4 (the wizard) translates the strongest elements
 * into sales-language differentiator copy that lands in
 * client_facing_output.differentiator_section.
 *
 * Constraints:
 *   - exactly 5-8 elements (per spec)
 *   - each element MUST cite a concrete evidence_source
 *   - category and monetization_potential are strict enums
 *   - usable_in_modules is required boolean (drives Phase 4 module generation —
 *     every offer module must be linked to at least one unique element with
 *     this flag set)
 */

export const VALID_CATEGORIES = [
  'story',
  'credential',
  'viral_moment',
  'vocabulary',
  'contrarian_angle',
  'proprietary_method',
  'behind_the_scenes_access',
];

export const VALID_MONETIZATION = ['high', 'medium', 'low'];

function isStr(v) { return typeof v === 'string' && v.length > 0; }
function isBool(v) { return typeof v === 'boolean'; }

export function validateUniqueness(obj) {
  const errors = [];
  const push = (path, msg) => errors.push(`${path}: ${msg}`);

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['root: must be a JSON object'] };
  }

  // unique_elements
  if (!Array.isArray(obj.unique_elements)) {
    push('unique_elements', 'must be an array of 5-8 elements');
  } else {
    if (obj.unique_elements.length < 5) {
      push('unique_elements', `must contain at least 5 elements (got ${obj.unique_elements.length}) — look harder, include weaker elements with monetization_potential 'low' if you must`);
    } else if (obj.unique_elements.length > 8) {
      push('unique_elements', `must contain at most 8 elements (got ${obj.unique_elements.length}) — consolidate the weakest`);
    }
    obj.unique_elements.forEach((e, i) => {
      const px = `unique_elements[${i}]`;
      if (!e || typeof e !== 'object' || Array.isArray(e)) { push(px, 'must be an object'); return; }
      if (!isStr(e.element)) push(`${px}.element`, 'required non-empty string');
      if (!VALID_CATEGORIES.includes(e.category)) push(`${px}.category`, `must be one of ${VALID_CATEGORIES.join('|')}`);
      if (!isStr(e.evidence_source)) push(`${px}.evidence_source`, 'required non-empty string (cite a specific caption/bio phrase/post/external mention)');
      if (!VALID_MONETIZATION.includes(e.monetization_potential)) push(`${px}.monetization_potential`, `must be one of ${VALID_MONETIZATION.join('|')}`);
      if (!isBool(e.usable_in_modules)) push(`${px}.usable_in_modules`, 'required boolean');
    });
  }

  // creator_voice_summary
  if (!isStr(obj.creator_voice_summary)) {
    push('creator_voice_summary', 'required non-empty string (max 3 sentences describing tone + style)');
  } else {
    // Soft check on length — anything over ~600 chars suggests model wrote a paragraph.
    if (obj.creator_voice_summary.length > 600) {
      push('creator_voice_summary', `should be at most 3 sentences (~600 chars, got ${obj.creator_voice_summary.length})`);
    }
  }

  return { valid: errors.length === 0, errors };
}
