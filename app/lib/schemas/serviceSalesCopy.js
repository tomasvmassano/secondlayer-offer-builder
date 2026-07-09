import { clampStr, clampArray } from './normalize';

/**
 * Service Sales Copy — the "sell it" layer for the productized_service
 * archetype (slice 2). Sits on top of a generated service_offer and
 * produces the creator-facing pieces that turn the offer into a sale:
 *
 *   hero               : { headline, sub, cta } — the top of the sales pitch
 *   differentiator     : "why this beats an agency AND doing it yourself",
 *                        benefit-led prose (expands service_offer.positioning)
 *   objections         : 3-6 { objection (buyer voice), rebuttal (creator voice) }
 *   faq                : 4-8 { q, a }
 *   guarantee          : a risk-reversal line (services live or die on this —
 *                        "how do I know it'll be good?"). May be null if the
 *                        creator genuinely can't offer one, but strongly urged.
 *   social_proof_angle : what proof to show + how to frame it (we rarely have
 *                        real testimonials at this stage, so this is guidance)
 *   outreach_dm        : a short, ready-to-send DM the operator can paste to a
 *                        warm lead to pitch this service (creator voice).
 *
 * Every string is in the creator's language + voice. Char caps are soft
 * ceilings clamped by the validator (never hard-fail on length); we only
 * hard-fail on missing/empty required fields or wrong shape.
 *
 * Lives at internal_metadata.service_sales_copy.
 */

const isStr = v => typeof v === 'string' && v.trim().length > 0;

const CAP = {
  headline: 100,
  sub: 240,
  cta: 40,
  differentiator: 700,
  objection: 160,
  rebuttal: 320,
  q: 160,
  a: 460,
  guarantee: 300,
  social: 300,
  dm: 900,
};

export function validateServiceSalesCopy(obj) {
  const errors = [];
  const push = (p, m) => errors.push(`${p}: ${m}`);

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['root: must be a JSON object'] };
  }

  // ── hero
  if (!obj.hero || typeof obj.hero !== 'object' || Array.isArray(obj.hero)) {
    push('hero', 'required object { headline, sub, cta }');
  } else {
    if (isStr(obj.hero.headline)) obj.hero.headline = clampStr(obj.hero.headline, CAP.headline);
    if (isStr(obj.hero.sub))      obj.hero.sub      = clampStr(obj.hero.sub, CAP.sub);
    if (isStr(obj.hero.cta))      obj.hero.cta      = clampStr(obj.hero.cta, CAP.cta);
    if (!isStr(obj.hero.headline)) push('hero.headline', 'required non-empty string');
    if (!isStr(obj.hero.sub))      push('hero.sub', 'required non-empty string');
    if (!isStr(obj.hero.cta))      push('hero.cta', 'required non-empty string (button label)');
  }

  // ── differentiator
  if (isStr(obj.differentiator)) obj.differentiator = clampStr(obj.differentiator, CAP.differentiator);
  if (!isStr(obj.differentiator)) push('differentiator', 'required non-empty string');

  // ── objections — 3-6
  if (!Array.isArray(obj.objections)) {
    push('objections', 'must be an array of 3-6 { objection, rebuttal }');
  } else {
    obj.objections = clampArray(obj.objections, 3, 6);
    if (obj.objections.length < 3) push('objections', 'need at least 3 objections');
    obj.objections.forEach((o, i) => {
      const root = `objections[${i}]`;
      if (!o || typeof o !== 'object') { push(root, 'must be an object'); return; }
      if (isStr(o.objection)) o.objection = clampStr(o.objection, CAP.objection);
      if (isStr(o.rebuttal))  o.rebuttal  = clampStr(o.rebuttal, CAP.rebuttal);
      if (!isStr(o.objection)) push(`${root}.objection`, 'required non-empty string');
      if (!isStr(o.rebuttal))  push(`${root}.rebuttal`, 'required non-empty string');
    });
  }

  // ── faq — 4-8
  if (!Array.isArray(obj.faq)) {
    push('faq', 'must be an array of 4-8 { q, a }');
  } else {
    obj.faq = clampArray(obj.faq, 4, 8);
    if (obj.faq.length < 4) push('faq', 'need at least 4 FAQ items');
    obj.faq.forEach((f, i) => {
      const root = `faq[${i}]`;
      if (!f || typeof f !== 'object') { push(root, 'must be an object'); return; }
      if (isStr(f.q)) f.q = clampStr(f.q, CAP.q);
      if (isStr(f.a)) f.a = clampStr(f.a, CAP.a);
      if (!isStr(f.q)) push(`${root}.q`, 'required non-empty string');
      if (!isStr(f.a)) push(`${root}.a`, 'required non-empty string');
    });
  }

  // ── guarantee — optional but clamp when present
  if (obj.guarantee != null && obj.guarantee !== '') {
    if (isStr(obj.guarantee)) obj.guarantee = clampStr(obj.guarantee, CAP.guarantee);
    else push('guarantee', 'if present, must be a non-empty string or null');
  }

  // ── social_proof_angle — optional
  if (obj.social_proof_angle != null && obj.social_proof_angle !== '') {
    if (isStr(obj.social_proof_angle)) obj.social_proof_angle = clampStr(obj.social_proof_angle, CAP.social);
    else push('social_proof_angle', 'if present, must be a non-empty string or null');
  }

  // ── outreach_dm — required (it's the operator's main use of this)
  if (isStr(obj.outreach_dm)) obj.outreach_dm = clampStr(obj.outreach_dm, CAP.dm);
  if (!isStr(obj.outreach_dm)) push('outreach_dm', 'required non-empty string (ready-to-send DM)');

  return { valid: errors.length === 0, errors };
}
