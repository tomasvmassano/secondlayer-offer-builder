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

export const VALID_CANNIBALIZATION_RISK = ['high', 'medium', 'low', 'none'];

// Currency: ISO-4217 codes for the three currencies SL operates in. The
// field is REQUIRED on every product now — we no longer convert to EUR.
// Stored alongside price_eur (the field name is legacy; the value is the
// price in the original currency). UI reads `currency` to pick the symbol.
export const VALID_CURRENCIES = ['EUR', 'USD', 'GBP'];

// Shape (for reference — JS, not a runtime type system):
//
// {
//   ecosystem_map: {
//     products_found: [
//       { name, price_eur, currency, format, tier, url, transformation_offered }
//     ],
//     // NEW: Existing communities are called out separately from products,
//     // because they're the highest cannibalization risk for our offer.
//     // The wizard's CP1 strategic_frame uses this to FORBID picking the
//     // same tier — if Tomás already has Blueprint Academy at €36/mo
//     // (low_ticket), we cannot ship another low-ticket community.
//     existing_communities: [
//       { name, price_eur, currency, tier, format, url }
//     ],
//     community_cannibalization_risk: 'high' | 'medium' | 'low' | 'none',
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
        // currency — required when price_eur is set. Legacy records (pre
        // currency field) get a soft-default to EUR in the migration layer
        // so this only fails on FRESH outputs missing the field.
        if (p.price_eur != null && p.currency != null && !VALID_CURRENCIES.includes(p.currency)) {
          push(`${px}.currency`, `must be one of ${VALID_CURRENCIES.join('|')} (got ${p.currency})`);
        }
        if (!isStr(p.format)) push(`${px}.format`, 'required non-empty string');
        if (!VALID_TIERS.includes(p.tier)) push(`${px}.tier`, `must be one of ${VALID_TIERS.join('|')}`);
        if (!isStr(p.url)) push(`${px}.url`, 'required non-empty string');
        if (!isStr(p.transformation_offered)) push(`${px}.transformation_offered`, 'required non-empty string');
      });
    }
    // existing_communities — explicit list of competing community offers.
    // Required (use [] if none). Each entry mirrors products_found shape but
    // is JUST for communities (not courses, not 1-on-1 services).
    if (!Array.isArray(em.existing_communities)) {
      push('ecosystem_map.existing_communities', 'must be an array (use [] if creator has no existing community offer)');
    } else {
      em.existing_communities.forEach((ec, i) => {
        const px = `ecosystem_map.existing_communities[${i}]`;
        if (!ec || typeof ec !== 'object' || Array.isArray(ec)) { push(px, 'must be an object'); return; }
        if (!isStr(ec.name)) push(`${px}.name`, 'required non-empty string');
        if (ec.price_eur != null && !isNum(ec.price_eur)) push(`${px}.price_eur`, 'must be number or null');
        if (ec.price_eur != null && ec.currency != null && !VALID_CURRENCIES.includes(ec.currency)) {
          push(`${px}.currency`, `must be one of ${VALID_CURRENCIES.join('|')} (got ${ec.currency})`);
        }
        if (!VALID_TIERS.includes(ec.tier)) push(`${px}.tier`, `must be one of ${VALID_TIERS.join('|')}`);
        if (!isStr(ec.format)) push(`${px}.format`, 'required non-empty string');
        // url optional — sometimes the community URL isn't crawlable
      });
    }
    // community_cannibalization_risk — strict enum. The CP1 prompt uses
    // this to decide whether to FORBID matching tiers.
    if (!VALID_CANNIBALIZATION_RISK.includes(em.community_cannibalization_risk)) {
      push('ecosystem_map.community_cannibalization_risk', `must be one of ${VALID_CANNIBALIZATION_RISK.join('|')}`);
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

  // Consistency cross-checks. has_high_ticket / has_mid_ticket only count
  // products_found tiers. has_recurring is broader: a creator HAS recurring
  // revenue if either (a) products_found contains a recurring-tier product
  // OR (b) existing_communities is non-empty. Paid communities are
  // subscription-based by definition in our taxonomy — even if the LLM
  // classifies a particular community as "mid_ticket" (e.g. annual flat
  // fee), it still counts toward has_recurring for the wizard's purposes.
  // This matches the PATCH endpoint's recompute logic in
  //   app/api/creators/[id]/ecosystem-audit/patch/route.js
  // so a manual edit and a fresh LLM run end up internally consistent.
  if (Array.isArray(em?.products_found)) {
    const tiers = new Set(em.products_found.map(p => p?.tier).filter(Boolean));
    const hasAnyCommunity = Array.isArray(em.existing_communities) && em.existing_communities.length > 0;
    const expectedRecurring = tiers.has('recurring') || hasAnyCommunity;
    if (em.has_high_ticket !== tiers.has('high_ticket')) push('ecosystem_map.has_high_ticket', 'inconsistent with products_found tiers');
    if (em.has_mid_ticket !== tiers.has('mid_ticket'))   push('ecosystem_map.has_mid_ticket',   'inconsistent with products_found tiers');
    if (em.has_recurring !== expectedRecurring)          push('ecosystem_map.has_recurring',    'inconsistent with products_found tiers + existing_communities');
  }

  return { valid: errors.length === 0, errors };
}
