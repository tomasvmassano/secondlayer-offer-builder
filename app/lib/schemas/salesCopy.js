/**
 * Sales Copy (Phase 4 · Checkpoint 5) schema + validator.
 *
 * Final assembly. Produces the last creator-facing pieces of
 * client_facing_output:
 *   - differentiator_section : "Why this isn't another X" — benefit-led,
 *                              NOT a feature comparison list
 *   - strategic_context_line : the 1-line strategic frame for the pitch
 *                              header
 *   - hero                   : { headline, sub, cta } for the pitch top
 *   - objections             : 4-6 { objection, rebuttal } pairs
 *   - faq                    : 8-12 { q, a } pairs
 *   - social_proof_line      : optional (only when Phase 2 fame_tier is
 *                              niche_recognized or stronger)
 *
 * Every string MUST match the creator_voice_summary from Phase 3 — the
 * prompt enforces this with banned words and stylistic rules.
 *
 * Validator notes:
 *   - social_proof_line is OPTIONAL by default. If the prompt's been told
 *     the creator has niche-recognized+ fame, the prompt should fill it,
 *     but the validator doesn't force it (operator can override at edit time).
 *   - All char limits are SOFT max — exceeding by 10% triggers a warning
 *     but not a hard error. We hard-fail only when the field is missing,
 *     empty, or violates the structural shape.
 */

function isStr(v) { return typeof v === 'string' && v.length > 0; }

export function validateSalesCopy(obj) {
  const errors = [];
  const warnings = [];
  const push = (p, msg) => errors.push(`${p}: ${msg}`);

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['root: must be a JSON object'], warnings: [] };
  }

  // ── differentiator_section
  if (!isStr(obj.differentiator_section)) {
    push('differentiator_section', 'required non-empty string ("Why this isn\'t another X" — benefit-led, ≤800 chars)');
  } else if (obj.differentiator_section.length > 900) {
    push('differentiator_section', `should be ≤800 chars (got ${obj.differentiator_section.length}) — tighten`);
  } else if (obj.differentiator_section.length > 800) {
    warnings.push(`differentiator_section is ${obj.differentiator_section.length} chars (target ≤800)`);
  }

  // ── strategic_context_line
  if (!isStr(obj.strategic_context_line)) {
    push('strategic_context_line', 'required non-empty string (≤300 chars — pitch header context)');
  } else if (obj.strategic_context_line.length > 340) {
    push('strategic_context_line', `should be ≤300 chars (got ${obj.strategic_context_line.length})`);
  }

  // ── hero
  if (!obj.hero || typeof obj.hero !== 'object' || Array.isArray(obj.hero)) {
    push('hero', 'required object { headline, sub, cta }');
  } else {
    if (!isStr(obj.hero.headline)) push('hero.headline', 'required non-empty string (≤80 chars)');
    else if (obj.hero.headline.length > 100) push('hero.headline', `should be ≤80 chars (got ${obj.hero.headline.length})`);
    if (!isStr(obj.hero.sub)) push('hero.sub', 'required non-empty string (≤200 chars)');
    else if (obj.hero.sub.length > 240) push('hero.sub', `should be ≤200 chars (got ${obj.hero.sub.length})`);
    if (!isStr(obj.hero.cta)) push('hero.cta', 'required non-empty string (≤30 chars, button label)');
    else if (obj.hero.cta.length > 40) push('hero.cta', `should be ≤30 chars (got ${obj.hero.cta.length})`);
  }

  // ── objections — 4-6 pairs
  if (!Array.isArray(obj.objections)) {
    push('objections', 'must be an array of 4-6 objection/rebuttal pairs');
  } else if (obj.objections.length < 4 || obj.objections.length > 6) {
    push('objections', `must contain 4-6 objections (got ${obj.objections.length})`);
  } else {
    obj.objections.forEach((o, i) => {
      const px = `objections[${i}]`;
      if (!o || typeof o !== 'object' || Array.isArray(o)) { push(px, 'must be an object'); return; }
      if (!isStr(o.objection)) push(`${px}.objection`, 'required non-empty string (≤150 chars, in audience\'s voice)');
      else if (o.objection.length > 180) push(`${px}.objection`, `should be ≤150 chars (got ${o.objection.length})`);
      if (!isStr(o.rebuttal)) push(`${px}.rebuttal`, 'required non-empty string (≤300 chars, creator voice)');
      else if (o.rebuttal.length > 350) push(`${px}.rebuttal`, `should be ≤300 chars (got ${o.rebuttal.length})`);
    });
  }

  // ── FAQ — 8-12 items
  if (!Array.isArray(obj.faq)) {
    push('faq', 'must be an array of 8-12 Q&A pairs');
  } else if (obj.faq.length < 8 || obj.faq.length > 12) {
    push('faq', `must contain 8-12 FAQ items (got ${obj.faq.length})`);
  } else {
    obj.faq.forEach((f, i) => {
      const px = `faq[${i}]`;
      if (!f || typeof f !== 'object' || Array.isArray(f)) { push(px, 'must be an object'); return; }
      if (!isStr(f.q)) push(`${px}.q`, 'required non-empty string (≤120 chars)');
      else if (f.q.length > 150) push(`${px}.q`, `should be ≤120 chars (got ${f.q.length})`);
      if (!isStr(f.a)) push(`${px}.a`, 'required non-empty string (≤400 chars)');
      else if (f.a.length > 460) push(`${px}.a`, `should be ≤400 chars (got ${f.a.length})`);
    });
  }

  // ── social_proof_line — optional, but enforce shape if present
  if (obj.social_proof_line != null && obj.social_proof_line !== '') {
    if (typeof obj.social_proof_line !== 'string') {
      push('social_proof_line', 'if present, must be a string (≤240 chars)');
    } else if (obj.social_proof_line.length > 280) {
      push('social_proof_line', `should be ≤240 chars (got ${obj.social_proof_line.length})`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
