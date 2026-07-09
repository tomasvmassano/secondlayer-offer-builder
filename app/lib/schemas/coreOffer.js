import { normalizeEnum, clampStr } from './normalize';

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
 *
 * HIGH-TIER HARDENING (added 2026-05) — when pricing_tier is "high", the
 * model MUST also produce seven structural fields that protect against
 * cannibalising the creator's existing low/recurring offers and force
 * the high-tier offer to justify its price through delivery (not just
 * content):
 *
 *   - cannibalisation_check     : how this differs structurally from existing low/recurring
 *   - qualification_filter      : who is filtered out and why (excludes community avatar)
 *   - mechanism_name            : named proprietary framework / system
 *   - mechanism_logic           : why this sequence — explainable in one sentence
 *   - quantified_transformation : numeric outcome (hours saved / revenue mult / headcount avoided)
 *   - format_justification      : why the format matches the price
 *   - ladder_coherence          : why this rung sits where it does in the existing ladder
 *
 * At high tier with target_price ≥ €2,000, format_justification + core_mechanic
 * + weekly_rhythm combined must reference at least ONE of:
 *   [cohort cap with scarcity, 1:1 / 1-on-1 sessions, done-with-you build,
 *    outcome guarantee, named guarantee]
 * At ≥ €3,000 they must reference at least TWO. Pure group + templates is not
 * enough above €1,500.
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

// Numeric tier ranges for staleness-checking a stored revenuePrice against
// the tier the operator just picked. Slightly wider than TIER_PRICE_HINTS
// so a recurring high-ticket creator at €800 isn't rejected as "stale" —
// the bands overlap on purpose where the boundary is genuinely fuzzy.
export const TIER_PRICE_RANGES = {
  low:  { monthly: [20, 150],    one_time: [80, 400]   },
  mid:  { monthly: [150, 600],   one_time: [400, 2000] },
  high: { monthly: [800, 50000], one_time: [2000, 100000] },
};

// Returns true when a stored revenuePrice (numeric, EUR-assumed) is
// consistent with the operator-picked tier. Used by CP2 wizard to decide
// whether to honor the override or treat it as stale and let the model
// price from scratch within the tier band.
//
// We accept the price if EITHER the monthly OR one_time range matches —
// without knowing the final pricing_model yet, "high tier with €1,500"
// is plausible both as monthly subscription and as one-time cohort.
export function revenuePriceMatchesTier(price, tier) {
  if (!Number.isFinite(price) || price <= 0) return false;
  const ranges = TIER_PRICE_RANGES[tier];
  if (!ranges) return false;
  const inMonthly  = price >= ranges.monthly[0]  && price <= ranges.monthly[1];
  const inOneTime  = price >= ranges.one_time[0] && price <= ranges.one_time[1];
  return inMonthly || inOneTime;
}

function isStr(v) { return typeof v === 'string' && v.length > 0; }

// Pull the first numeric value out of a price string like "€3,497 one-time"
// or "€1497/mo" or "USD 2,997". Returns 0 if nothing extractable.
function priceNumericValue(s) {
  if (typeof s !== 'string') return 0;
  const m = s.match(/(\d[\d.,]*)/);
  if (!m) return 0;
  // Heuristic for thousand separators: "1.497" (European) vs "1,497" (US).
  // We only need the magnitude band (≥2000 / ≥3000) for the format check,
  // so treat both . and , as thousands separators when the number has 4+
  // digits after stripping.
  const raw = m[1];
  const stripped = raw.replace(/[.,]/g, '');
  return parseInt(stripped, 10) || 0;
}

// Signal terms that justify a high-ticket format. The high-tier validator
// scans format_justification + core_mechanic + weekly_rhythm for these.
// Multi-language because creator-facing copy may be PT or EN.
const HIGH_TIER_FORMAT_SIGNALS = [
  // Cohort cap / scarcity
  'cohort cap', 'cohort limit', 'limited cohort', 'limited seats', 'seats only',
  'limited spots', 'spots only', 'cap of', 'capped at',
  'limite de', 'apenas ', 'lugares limitados', 'turma limitada',
  // 1:1 / 1-on-1 / one-on-one
  '1:1', '1-1', '1-on-1', 'one-on-one', 'one on one', 'private session', 'private call',
  '1 a 1', '1-a-1', 'sessão privada', 'sessão individual', 'individual call',
  // Done-with-you / done-for-you / build sessions
  'done-with-you', 'done with you', 'done-for-you', 'done for you', 'dwy',
  'build session', 'build call', 'implementation call', 'implementação ao vivo',
  'construção em conjunto', 'trabalhamos contigo', 'feito contigo',
  // Outcome guarantee
  'guarantee', 'money-back', 'money back', 'refund if', 'or your money',
  'garantia', 'devolução', 'dinheiro de volta',
];

// Check whether a high-tier offer's format passes the price-justification
// rule. Returns { ok, matchedSignals, requiredCount }.
function checkHighTierFormat(obj) {
  const price = priceNumericValue(obj.target_price || '');
  const requiredCount = price >= 3000 ? 2 : (price >= 2000 ? 1 : 0);
  if (requiredCount === 0) return { ok: true, matchedSignals: [], requiredCount };

  const blob = [
    obj.format_justification,
    obj.core_mechanic,
    Array.isArray(obj.weekly_rhythm) ? obj.weekly_rhythm.join(' ') : '',
  ].filter(Boolean).join(' ').toLowerCase();

  // Dedup matches by the "category" of signal so two flavours of 1:1
  // wording don't both count.
  const matched = new Set();
  for (const sig of HIGH_TIER_FORMAT_SIGNALS) {
    if (blob.includes(sig)) {
      // Bucket: 1:1, dwy, cohort, guarantee
      let bucket = 'other';
      if (/1[: -]?1|on[- ]one|sessão privada|sessão individual|individual call|private/.test(sig)) bucket = '1:1';
      else if (/done|dwy|build|implementação|construção|trabalhamos|feito contigo/.test(sig)) bucket = 'dwy';
      else if (/cohort|seats|spots|cap|limite|apenas|lugares|turma/.test(sig)) bucket = 'cohort';
      else if (/guarantee|garantia|refund|money|devolução|dinheiro/.test(sig)) bucket = 'guarantee';
      matched.add(bucket);
    }
  }
  return { ok: matched.size >= requiredCount, matchedSignals: [...matched], requiredCount };
}

export function validateCoreOffer(obj) {
  const errors = [];
  const push = (p, m) => errors.push(`${p}: ${m}`);

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['root: must be a JSON object'] };
  }

  // ── COERCE common LLM enum slips before validating (2026-07-09). These
  // used to hard-fail the whole offer on "one-time" vs "one_time",
  // "Premium" vs "high", "monthly" casing, etc. Normalize what the model
  // clearly meant; the strict checks below then only fire on genuine
  // structural problems.
  {
    const pm = normalizeEnum(obj.pricing_model, VALID_PRICING_MODELS, {
      'one-time': 'one_time', 'onetime': 'one_time', 'single': 'one_time',
      'month': 'monthly', 'recurring': 'monthly', 'subscription': 'monthly',
      'year': 'annual', 'yearly': 'annual', 'auto': 'monthly',
    });
    if (pm) obj.pricing_model = pm;
    const pt = normalizeEnum(obj.pricing_tier, VALID_PRICING_TIERS, {
      'medium': 'mid', 'middle': 'mid', 'premium': 'high', 'entry': 'low', 'budget': 'low',
    });
    if (pt) obj.pricing_tier = pt;
    if (obj.price && typeof obj.price === 'object' && obj.price.currency != null) {
      const cur = normalizeEnum(obj.price.currency, ['EUR', 'USD', 'GBP', 'AED', 'CHF', 'BRL'], {
        '€': 'EUR', 'eur': 'EUR', '$': 'USD', 'usd': 'USD', '£': 'GBP', 'gbp': 'GBP',
      });
      obj.price.currency = cur; // null → the check below reports it (or auto-nulls per its own rule)
    }
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

  // Structured price — the canonical source of truth that every downstream
  // render (slide 4 ecosystem, slide 5 community tiers, slide 7 value-stack
  // actualPrice, slide 10 projection, projector hero) consumes. The freeform
  // target_price string above is kept for back-compat + LLM-friendly copy.
  //
  // Without this, the pitch deck used to render the same offer three
  // different ways: "AED 2,497 + AED 997/quarter" (hybrid quarterly with
  // setup) on slide 4, "AED 2,497/mo" (setup dropped, period swapped) on
  // slide 7, "€2,497/mo" (currency never converted) on slide 10. The
  // structured object fixes the data model; render paths just consume it.
  if (!obj.price || typeof obj.price !== 'object' || Array.isArray(obj.price)) {
    push('price', 'required object { setup_amount, recurring_amount, recurring_period, one_time_amount, currency }');
  } else {
    const VALID_PERIODS = ['month', 'quarter', 'year', 'week'];
    const VALID_CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'CHF', 'BRL'];
    const p = obj.price;
    // Auto-null unknown currency instead of hard-failing (consistent with
    // ecosystemAudit). The coercion block above already mapped symbols +
    // casing; anything still unrecognized loses currency precision rather
    // than killing the whole offer. Downstream render defaults to EUR.
    if (p.currency != null && !VALID_CURRENCIES.includes(p.currency)) {
      p.currency = null;
    }
    const setup     = Number(p.setup_amount);
    const recurring = Number(p.recurring_amount);
    const oneTime   = Number(p.one_time_amount);
    const hasSetup     = Number.isFinite(setup)     && setup     > 0;
    const hasRecurring = Number.isFinite(recurring) && recurring > 0;
    const hasOneTime   = Number.isFinite(oneTime)   && oneTime   > 0;
    // At least one amount must be set.
    if (!hasSetup && !hasRecurring && !hasOneTime) {
      push('price', 'at least one of setup_amount / recurring_amount / one_time_amount must be > 0');
    }
    // If recurring_amount is set, recurring_period is required.
    if (hasRecurring && !VALID_PERIODS.includes(p.recurring_period)) {
      push('price.recurring_period', `required when recurring_amount > 0; must be one of ${VALID_PERIODS.join('|')}`);
    }
    // Hybrid model coherence: setup + recurring should both be present.
    if (obj.pricing_model === 'hybrid' && (!hasSetup || !hasRecurring)) {
      push('price', 'pricing_model="hybrid" requires BOTH setup_amount > 0 AND recurring_amount > 0');
    }
    // One-time model coherence: one_time_amount should be set (or setup, since
    // a one-time charge can also be called "setup" — accept either).
    if (obj.pricing_model === 'one_time' && !hasOneTime && !hasSetup) {
      push('price', 'pricing_model="one_time" requires one_time_amount > 0 (or setup_amount as one-time charge)');
    }
    // Monthly/annual model coherence.
    if ((obj.pricing_model === 'monthly' || obj.pricing_model === 'annual') && !hasRecurring) {
      push('price', `pricing_model="${obj.pricing_model}" requires recurring_amount > 0`);
    }
    // Period coherence with model.
    if (obj.pricing_model === 'monthly' && hasRecurring && p.recurring_period !== 'month') {
      push('price.recurring_period', `pricing_model="monthly" expects recurring_period="month" (got "${p.recurring_period}")`);
    }
    if (obj.pricing_model === 'annual' && hasRecurring && p.recurring_period !== 'year') {
      push('price.recurring_period', `pricing_model="annual" expects recurring_period="year" (got "${p.recurring_period}")`);
    }
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
  } else if (obj.core_mechanic.length > 580) {
    push('core_mechanic', `should be at most ~580 chars (got ${obj.core_mechanic.length})`);
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

  // ── High-tier structural fields ──────────────────────────────────
  // These seven fields are how the operator validates that the high-tier
  // offer (1) doesn't cannibalise existing low/recurring, (2) qualifies
  // buyers above the community avatar, (3) has a proprietary mechanism
  // rather than borrowing the creator's brand authority, (4) quantifies
  // outcome, (5) justifies its format/price match, (6) coheres with the
  // existing ladder, and (7) qualifies people OUT.
  //
  // Optional at low/mid tier (the cannibalisation risk is lower and the
  // price doesn't demand a structural breakdown). Required at high tier.
  const HIGH_TIER_FIELDS = {
    cannibalisation_check:     'how this offer differs structurally from existing low/recurring products (name each by title)',
    qualification_filter:      'who is filtered out (must explicitly exclude the existing community avatar)',
    mechanism_name:            'named proprietary framework (e.g. "The Agent Stack Method")',
    mechanism_logic:           'why this sequence, in one sentence',
    quantified_transformation: 'numeric outcome (hours saved/week, revenue multiplier, headcount avoided)',
    format_justification:      'why the format matches the price (cohort cap, 1:1, DWY, guarantee)',
    ladder_coherence:          'why this rung sits where it does in the existing ladder',
  };

  if (obj.pricing_tier === 'high') {
    for (const [field, desc] of Object.entries(HIGH_TIER_FIELDS)) {
      if (!isStr(obj[field])) push(field, `required non-empty string at high tier — ${desc}`);
    }
    // NOTE: This used to enforce a business-anchor rule on at least one
    // "for" bullet at high tier (revenue floor / team size / recurring
    // customers). Removed 2026-06-19: the rule assumed B2B/SaaS buyers
    // and failed every high-tier B2C offer (premium fitness, premium
    // coaching for individuals, high-ticket consumer education, etc.)
    // where the buyer is a person not a business. The original comment
    // already said "Optional sanity ... we don't strictly enforce
    // wording" — but the code was pushing to errors, blocking the
    // generation. Trust the strategic frame's audience_segment to
    // carry the qualification signal instead.
    // Format → price coherence check.
    const check = checkHighTierFormat(obj);
    if (!check.ok) {
      const examples = ['cohort cap with scarcity', '1:1 sessions', 'done-with-you build sessions', 'outcome guarantee'];
      const tier = priceNumericValue(obj.target_price) >= 3000 ? '≥€3,000' : '≥€2,000';
      push('format_justification', `at ${tier} the format must include at least ${check.requiredCount} of [${examples.join(', ')}] — currently matched: ${check.matchedSignals.length ? check.matchedSignals.join(', ') : '(none)'}. Pure group + templates is not enough above €1,500.`);
    }
  } else {
    // At low/mid tier, the new fields are optional but, if present, must be
    // valid strings. Lets the model still emit them without breaking.
    for (const field of Object.keys(HIGH_TIER_FIELDS)) {
      if (obj[field] != null && !isStr(obj[field])) push(field, 'if provided, must be a non-empty string');
    }
  }

  return { valid: errors.length === 0, errors };
}
