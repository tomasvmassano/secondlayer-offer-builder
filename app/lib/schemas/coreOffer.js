/**
 * Core Offer (Phase 4 · Checkpoint 2) schema + validator.
 *
 * First creator-facing checkpoint. Writes into client_facing_output:
 *   central_promise, transformation, audience_fit, pricing_*,
 *   community_name, name_candidates, platform, core_mechanic, weekly_rhythm.
 *
 * What CP2 does NOT cover (deferred to later CPs):
 *   - Detailed weekly_formats (day-by-day breakdown) — CP3
 *   - Library of pre-recorded modules — CP3
 *   - Modules / curriculum — CP3
 *   - Value stack with $ values + bonuses — CP4
 *   - Differentiator section, hero, objections, FAQ — CP5
 *
 * Constraints:
 *   - pricing_model + pricing_tier : strict enums
 *   - audience_fit.for             : 3-6 bullets
 *   - audience_fit.not_for         : 2-5 bullets
 *   - name_candidates              : 2-4 alternates (model proposes, operator picks)
 *   - weekly_rhythm                : 3-6 short bullets
 *   - target_price                 : free-form string (e.g. "€297/mo")
 */

export const VALID_PRICING_MODELS = ['one_time', 'monthly', 'annual', 'hybrid'];
export const VALID_PRICING_TIERS = ['low', 'mid', 'high'];
export const VALID_PLATFORMS = ['Skool', 'Whop', 'Circle', 'Discord'];

// Price range hint per tier — used by the prompt to keep target_price honest.
// The validator does NOT enforce these (price is a string and EUR/USD mixing
// would make a numeric check brittle), but the prompt tells the model.
export const TIER_PRICE_HINTS = {
  low: '€30-100/mo or €100-300 one-time',
  mid: '€200-500/mo or €500-1500 one-time',
  high: '€1000+/mo or €3000+ one-time',
};

function isStr(v) { return typeof v === 'string' && v.length > 0; }

export function validateCoreOffer(obj) {
  const errors = [];
  const push = (p, m) => errors.push(`${p}: ${m}`);

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['root: must be a JSON object'] };
  }

  // central_promise — the Big Idea, in creator voice.
  if (!isStr(obj.central_promise)) {
    push('central_promise', 'required non-empty string (one-sentence Big Idea in creator voice)');
  } else if (obj.central_promise.length > 240) {
    push('central_promise', `should be at most ~240 chars (got ${obj.central_promise.length}) — tighten`);
  }

  // transformation — { from, to, timeframe } all required.
  if (!obj.transformation || typeof obj.transformation !== 'object' || Array.isArray(obj.transformation)) {
    push('transformation', 'required object { from, to, timeframe }');
  } else {
    if (!isStr(obj.transformation.from)) push('transformation.from', 'required non-empty string (the "before" state)');
    if (!isStr(obj.transformation.to)) push('transformation.to', 'required non-empty string (the "after" state)');
    if (!isStr(obj.transformation.timeframe)) push('transformation.timeframe', 'required non-empty string (e.g. "60 days", "3 months")');
  }

  // audience_fit — for[] 3-6, not_for[] 2-5. These render as two columns on
  // the pitch deck so the lengths must be display-friendly.
  if (!obj.audience_fit || typeof obj.audience_fit !== 'object' || Array.isArray(obj.audience_fit)) {
    push('audience_fit', 'required object { for: [], not_for: [] }');
  } else {
    if (!Array.isArray(obj.audience_fit.for)) {
      push('audience_fit.for', 'must be an array of 3-6 bullets');
    } else if (obj.audience_fit.for.length < 3 || obj.audience_fit.for.length > 6) {
      push('audience_fit.for', `must contain 3-6 bullets (got ${obj.audience_fit.for.length})`);
    } else {
      obj.audience_fit.for.forEach((s, i) => { if (!isStr(s)) push(`audience_fit.for[${i}]`, 'must be a non-empty string'); });
    }
    if (!Array.isArray(obj.audience_fit.not_for)) {
      push('audience_fit.not_for', 'must be an array of 2-5 bullets');
    } else if (obj.audience_fit.not_for.length < 2 || obj.audience_fit.not_for.length > 5) {
      push('audience_fit.not_for', `must contain 2-5 bullets (got ${obj.audience_fit.not_for.length})`);
    } else {
      obj.audience_fit.not_for.forEach((s, i) => { if (!isStr(s)) push(`audience_fit.not_for[${i}]`, 'must be a non-empty string'); });
    }
  }

  // Pricing trio — model, tier, target_price.
  if (!VALID_PRICING_MODELS.includes(obj.pricing_model)) {
    push('pricing_model', `must be one of ${VALID_PRICING_MODELS.join('|')}`);
  }
  if (!VALID_PRICING_TIERS.includes(obj.pricing_tier)) {
    push('pricing_tier', `must be one of ${VALID_PRICING_TIERS.join('|')}`);
  }
  if (!isStr(obj.target_price)) {
    push('target_price', 'required non-empty string (e.g. "€297/mo", "€1497 one-time")');
  }

  // Naming + platform.
  if (!isStr(obj.community_name)) {
    push('community_name', 'required non-empty string (operator can edit/swap to a name_candidate)');
  } else if (obj.community_name.length > 60) {
    push('community_name', `should be at most 60 chars (got ${obj.community_name.length})`);
  }
  if (!Array.isArray(obj.name_candidates)) {
    push('name_candidates', 'must be an array of 2-4 alternates');
  } else if (obj.name_candidates.length < 2 || obj.name_candidates.length > 4) {
    push('name_candidates', `must contain 2-4 alternates (got ${obj.name_candidates.length})`);
  } else {
    obj.name_candidates.forEach((s, i) => { if (!isStr(s)) push(`name_candidates[${i}]`, 'must be a non-empty string'); });
  }
  if (!VALID_PLATFORMS.includes(obj.platform)) {
    push('platform', `must be one of ${VALID_PLATFORMS.join('|')}`);
  }

  // Core mechanic — short prose describing the weekly rhythm.
  if (!isStr(obj.core_mechanic)) {
    push('core_mechanic', 'required non-empty string (1-3 sentences on what happens weekly)');
  } else if (obj.core_mechanic.length > 500) {
    push('core_mechanic', `should be at most ~500 chars (got ${obj.core_mechanic.length})`);
  }

  // Weekly rhythm — short bullets that complement core_mechanic.
  if (!Array.isArray(obj.weekly_rhythm)) {
    push('weekly_rhythm', 'must be an array of 3-6 short bullets');
  } else if (obj.weekly_rhythm.length < 3 || obj.weekly_rhythm.length > 6) {
    push('weekly_rhythm', `must contain 3-6 bullets (got ${obj.weekly_rhythm.length})`);
  } else {
    obj.weekly_rhythm.forEach((s, i) => {
      if (!isStr(s)) push(`weekly_rhythm[${i}]`, 'must be a non-empty string');
      else if (s.length > 100) push(`weekly_rhythm[${i}]`, `should be ≤100 chars (got ${s.length}) — short bullets only`);
    });
  }

  return { valid: errors.length === 0, errors };
}
