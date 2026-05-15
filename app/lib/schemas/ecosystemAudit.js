/**
 * Ecosystem Audit (Phase 1) schema + validator.
 *
 * Strictly internal — output lives under
 *   creator.offer.internal_metadata.ecosystem_audit
 * and is NEVER rendered to the creator.
 *
 * Hand-rolled validator instead of pulling in Zod / Ajv. Returns
 *   { valid: boolean, errors: string[] }
 * so the LLM-call site can decide whether to regenerate.
 */

export const VALID_TIERS = [
  'lead_magnet',
  'low_ticket',
  'mid_ticket',
  'high_ticket',
  'recurring',
  'service',
  'physical_product',
];

export const VALID_ROLES = [
  'entry_point',
  'continuity',
  'premium_upsell',
  'standalone',
];

// Shape (for reference — JS, not a runtime type system):
//
// {
//   ecosystem_map: {
//     products_found: [
//       { name, price_eur, format, tier, url, transformation_offered }
//     ],
//     has_high_ticket: boolean,
//     has_mid_ticket: boolean,
//     has_recurring: boolean,
//     ecosystem_completeness_score: 0..100
//   },
//   strategic_role: enum VALID_ROLES,
//   strategic_role_reasoning: string (max 2 sentences),
//   cannibalization_constraints: string[],
//   synergy_opportunities: string[]
// }
//

function isStr(v) { return typeof v === 'string' && v.length > 0; }
function isBool(v) { return typeof v === 'boolean'; }
function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function isStrArray(v) { return Array.isArray(v) && v.every(x => typeof x === 'string'); }

export function validateEcosystemAudit(obj) {
  const errors = [];
  const push = (path, msg) => errors.push(`${path}: ${msg}`);

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['root: must be a JSON object'] };
  }

  // ecosystem_map
  const em = obj.ecosystem_map;
  if (!em || typeof em !== 'object' || Array.isArray(em)) {
    push('ecosystem_map', 'missing or not an object');
  } else {
    if (!Array.isArray(em.products_found)) {
      push('ecosystem_map.products_found', 'must be an array (use [] if no products found)');
    } else {
      em.products_found.forEach((p, i) => {
        const px = `ecosystem_map.products_found[${i}]`;
        if (!p || typeof p !== 'object' || Array.isArray(p)) { push(px, 'must be an object'); return; }
        if (!isStr(p.name)) push(`${px}.name`, 'required non-empty string');
        if (p.price_eur != null && !isNum(p.price_eur)) push(`${px}.price_eur`, 'must be number or null');
        if (p.price_eur != null && p.price_eur < 0) push(`${px}.price_eur`, 'must be >= 0');
        if (!isStr(p.format)) push(`${px}.format`, 'required non-empty string');
        if (!VALID_TIERS.includes(p.tier)) push(`${px}.tier`, `must be one of ${VALID_TIERS.join('|')}`);
        if (!isStr(p.url)) push(`${px}.url`, 'required non-empty string');
        if (!isStr(p.transformation_offered)) push(`${px}.transformation_offered`, 'required non-empty string');
      });
    }
    if (!isBool(em.has_high_ticket)) push('ecosystem_map.has_high_ticket', 'required boolean');
    if (!isBool(em.has_mid_ticket))  push('ecosystem_map.has_mid_ticket',  'required boolean');
    if (!isBool(em.has_recurring))   push('ecosystem_map.has_recurring',   'required boolean');
    if (!isNum(em.ecosystem_completeness_score)) {
      push('ecosystem_map.ecosystem_completeness_score', 'required number');
    } else if (em.ecosystem_completeness_score < 0 || em.ecosystem_completeness_score > 100) {
      push('ecosystem_map.ecosystem_completeness_score', 'must be between 0 and 100');
    }
  }

  // strategic_role
  if (!VALID_ROLES.includes(obj.strategic_role)) {
    push('strategic_role', `must be one of ${VALID_ROLES.join('|')}`);
  }
  if (!isStr(obj.strategic_role_reasoning)) {
    push('strategic_role_reasoning', 'required non-empty string');
  }

  // cannibalization + synergy
  if (!isStrArray(obj.cannibalization_constraints)) {
    push('cannibalization_constraints', 'must be an array of strings (use [] if none)');
  }
  if (!isStrArray(obj.synergy_opportunities)) {
    push('synergy_opportunities', 'must be an array of strings (use [] if none)');
  }

  // Consistency cross-checks (warn but don't fail — these catch sloppy LLM output)
  if (Array.isArray(em?.products_found)) {
    const tiers = new Set(em.products_found.map(p => p?.tier).filter(Boolean));
    if (em.has_high_ticket !== tiers.has('high_ticket')) push('ecosystem_map.has_high_ticket', 'inconsistent with products_found tiers');
    if (em.has_mid_ticket !== tiers.has('mid_ticket'))   push('ecosystem_map.has_mid_ticket',   'inconsistent with products_found tiers');
    if (em.has_recurring !== tiers.has('recurring'))     push('ecosystem_map.has_recurring',    'inconsistent with products_found tiers');
  }

  return { valid: errors.length === 0, errors };
}
