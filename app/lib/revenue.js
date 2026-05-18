/**
 * Revenue calculations — single source of truth.
 *
 * Used by:
 *   - Creator page Revenue Projector tab (Oferta → Revenue Projector)
 *   - Offer Detail page Revenue Projector tab
 *   - Pitch Deck Numbers slide
 *
 * All three pages MUST use these exports so the displayed numbers
 * are mathematically consistent.
 *
 * ─── HORMOZI 5-STEP FUNNEL ───
 * Active Clients = audience × VR × engMult × LR × CR × P × (1 − churn)
 *                  capped at audience × cap
 *
 *   VR  = visibility rate per post
 *   LR  = lead rate (people who enter the funnel)
 *   CR  = conversion rate (leads who pay)
 *   P   = monetization posts/month
 *   churn = monthly subscriber loss
 *   cap = max % of audience that can become members
 *
 *   engMult = engagement adjustment (benchmark 2%, half-weight smoothing,
 *             clamped to [0.3, 3.0])
 */

export const SCENARIOS = {
  conservador: {
    label: 'Conservador',
    color: '#888888',
    vr: 0.10, lr: 0.02, cr: 0.05, p: 12, churn: 0.12, cap: 0.03,
  },
  moderado: {
    label: 'Moderado',
    color: '#7A0E18',
    vr: 0.15, lr: 0.03, cr: 0.08, p: 15, churn: 0.08, cap: 0.05,
  },
  agressivo: {
    label: 'Agressivo',
    color: '#22c55e',
    vr: 0.20, lr: 0.05, cr: 0.12, p: 18, churn: 0.05, cap: 0.08,
  },
};

export const ENGAGEMENT_BENCHMARK = 2.0; // 2% is the reference point

// ─────────────────────────────────────────────────────────────────
// TIER-AWARE CONVERSION (grounded in published benchmarks 2026-05)
// ─────────────────────────────────────────────────────────────────
//
// Source: acceleroi.com/blog/average-conversion-rate-online-courses —
// sales-page CVR by price tier. Mapped to our scenario triple
// (conservador/moderado/agressivo) by taking the low / mid / top-end of
// each tier's reported range.
//
// These OVERRIDE SCENARIOS.cap when the offer's pricing tier bucket is
// mid/high/premium — the default cap (0.03/0.05/0.08) was calibrated
// for low-ticket recurring (€50-200) and is too generous for higher
// tiers. Below those values is the % of audience that can realistically
// become buyers at that price point.
//
// Buckets:
//   low      → €30-200/mo recurring · €100-300 one-time  → matches SCENARIOS.cap
//   mid      → €200-1000/mo recurring · €500-1500 one-time
//   high     → €1000+/mo recurring · €1500-3000 one-time
//   premium  → €3000+ one-time (cohorts, mentorship, services)
export const TIER_CONVERSION_CAP = {
  low:     { conservador: 0.03,   moderado: 0.05,  agressivo: 0.08  },
  mid:     { conservador: 0.01,   moderado: 0.02,  agressivo: 0.035 },
  high:    { conservador: 0.003,  moderado: 0.007, agressivo: 0.015 },
  premium: { conservador: 0.001,  moderado: 0.003, agressivo: 0.007 },
};

// Per-launch acquisition rate for ONE-TIME and HYBRID offers. Different
// from TIER_CONVERSION_CAP because:
//   - CAP is a STEADY-STATE ceiling for recurring members ("max % of
//     audience that can be paying members at once")
//   - PER-LAUNCH is "% of audience converting in a single launch window"
//     — each launch reaches a subset, not the full ceiling
//
// Anchored to acceleroi sales-page CVR, but multiplied through by typical
// "% of audience that engages with a launch" (~10-20%) so we end up with
// realistic per-launch cohort sizes:
//   - 76K creator, mid-tier €1497 moderado: 76K × 0.001 × engMult(2) = 152/launch
//   - 76K creator, premium €4850 moderado: 76K × 0.0001 × engMult(2) = 15/launch
export const TIER_PER_LAUNCH_RATE = {
  low:     { conservador: 0.002,   moderado: 0.004,   agressivo: 0.008   },
  mid:     { conservador: 0.0005,  moderado: 0.001,   agressivo: 0.002   },
  high:    { conservador: 0.0002,  moderado: 0.0005,  agressivo: 0.001   },
  premium: { conservador: 0.00005, moderado: 0.0001,  agressivo: 0.0003  },
};

// Pull the first integer-magnitude number out of a price string like
// "€3,497 one-time", "€1497/mo", "USD 2.997", "$1,497". Strips both . and ,
// as separators (all our prices are integer euros / dollars in practice).
// Returns 0 if nothing extractable.
export function parsePriceNumeric(s) {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const m = String(s).match(/(\d[\d.,]*)/);
  if (!m) return 0;
  // Treat both . and , as thousand separators — our prices are integers.
  // "€1,497" → 1497, "€1.497" → 1497, "€297" → 297, "$2,970" → 2970.
  return parseInt(m[1].replace(/[.,]/g, ''), 10) || 0;
}

// Conservative estimate of current buyers per existing product, as % of
// audience. Operator can override per-product but defaults bias low so
// projections don't overstate status-quo revenue.
//
// Anchored to the bottom of each tier's reported conversion (acceleroi)
// heavily discounted for "audience saturation" — most creators only ever
// convert a small slice of their followers to any given paid product.
// A creator with 76K and 500 community members is at 0.66%; this table
// assumes 0.5% for low/recurring as the conservative baseline.
export const TIER_BUYER_ESTIMATE_PCT = {
  lead_magnet:      0.05,    // 5% — free → roughly email-list size
  low_ticket:       0.005,   // 0.5% — community / cheap one-time
  recurring:        0.005,   // 0.5% — same as low_ticket
  mid_ticket:       0.002,   // 0.2% — mid-price courses/programs
  high_ticket:      0.001,   // 0.1% — high-ticket programs
  service:          0.0005,  // 0.05% — 1-on-1, capacity-bound
  physical_product: 0.003,   // 0.3% — physical merch
};

// Suggested annual launch frequency for one-time offers, by tier bucket.
// Bigger ticket = fewer launches (audience fatigue + per-launch sales
// effort). Defaults the launches_per_year field on the offer.
export const SUGGESTED_LAUNCHES_PER_YEAR = {
  low:     6,  // bi-monthly drops viable for mini-courses
  mid:     3,  // quarterly cohorts
  high:    2,  // semi-annual cohorts
  premium: 1,  // annual flagship
};

// Payment plan availability lifts conversion ~20-30% (article 3,
// learningrevolution). Conservative middle: 1.25× CVR when active.
export const PAYMENT_PLAN_LIFT = 1.25;

// Classify an offer's pricing into a tier bucket for TIER_CONVERSION_CAP.
// The wizard's pricing_tier is already low/mid/high; this adds a
// "premium" bucket for one-time offers at €3K+ that need an even lower
// conversion cap.
export function classifyTierBucket(pricingTier, targetPriceNumeric, pricingModel) {
  const px = Number(targetPriceNumeric) || 0;
  if (pricingTier === 'high') {
    if (pricingModel === 'one_time' && px >= 3000) return 'premium';
    if (px >= 1000) return 'high';
    return 'high';
  }
  if (pricingTier === 'mid') return 'mid';
  return 'low';
}

// Conservative estimate of current buyers for an existing product, used
// when the operator hasn't manually entered a buyer count. Audience ×
// tier-percentage, with engagement-rate adjustment (same engMult logic).
export function estimateCurrentBuyers({ audience, productTier, engagementRate }) {
  if (!audience || audience <= 0) return 0;
  const pct = TIER_BUYER_ESTIMATE_PCT[productTier];
  if (!pct) return 0;
  const engMult = calculateEngagementMultiplier(engagementRate);
  // Engagement above benchmark lifts buyer estimate proportionally, but
  // capped — high engagement doesn't 3x your existing customer base.
  const adjustedPct = pct * Math.min(2.0, engMult);
  return Math.round(audience * adjustedPct);
}

// Suggested launch frequency for a one-time offer. Uses tier + a soft
// audience-size adjustment: tiny audiences can't sustain many launches.
export function suggestLaunchesPerYear({ pricingTier, targetPriceNumeric, pricingModel, audience }) {
  const bucket = classifyTierBucket(pricingTier, targetPriceNumeric, pricingModel);
  const base = SUGGESTED_LAUNCHES_PER_YEAR[bucket] || 2;
  // Audience under 10K → cap at 2 launches (small list fatigue).
  if (audience > 0 && audience < 10000) return Math.min(base, 2);
  return base;
}

/**
 * Calculate the engagement multiplier from a creator's engagement rate.
 * - Engagement at benchmark (2%) → multiplier = 1.0
 * - Half-weight smoothing so extreme engagement doesn't dominate
 * - Clamped to [0.3, 3.0] so no creator gets infinite or zero scaling
 */
function calculateEngagementMultiplier(engagementRate) {
  const eng = parseFloat(engagementRate) || 0;
  if (eng <= 0) return 1.0;
  const rawMult = eng / ENGAGEMENT_BENCHMARK;
  return Math.min(3.0, Math.max(0.3, 1 + (rawMult - 1) * 0.5));
}

/**
 * Steady-state MRR calculation using the Hormozi 5-step funnel.
 * Returns the "established business" number — what an at-equilibrium community generates.
 *
 * @param {Object} params
 * @param {number} params.audience - Total followers/subscribers (primary platform)
 * @param {number} params.price - Monthly price per member (€)
 * @param {number} params.engagementRate - Engagement % (e.g. 2.5 for 2.5%)
 * @param {Object} params.scenario - One of SCENARIOS (conservador/moderado/agressivo)
 * @param {string} params.scenarioKey - 'conservador'|'moderado'|'agressivo' (for tier cap lookup)
 * @param {string} params.tierBucket - 'low'|'mid'|'high'|'premium' (overrides default cap)
 * @param {boolean} params.paymentPlan - True if payment plan is offered (lifts CVR by PAYMENT_PLAN_LIFT)
 */
export function calculateSteadyMRR({ audience, price, engagementRate, scenario, scenarioKey, tierBucket, paymentPlan }) {
  const engMult = calculateEngagementMultiplier(engagementRate);
  const vrAdj = (scenario?.vr || 0) * engMult;
  const planLift = paymentPlan ? PAYMENT_PLAN_LIFT : 1;
  const raw = Math.round(
    (audience || 0) *
    vrAdj *
    (scenario?.lr || 0) *
    (scenario?.cr || 0) *
    planLift *
    (scenario?.p || 0) *
    (1 - (scenario?.churn || 0))
  );
  // Tier-aware cap. Falls back to scenario.cap (calibrated for low-ticket)
  // when tierBucket is missing or 'low'. Higher tiers get a much lower cap.
  const cap = (tierBucket && TIER_CONVERSION_CAP[tierBucket]?.[scenarioKey])
    || (scenario?.cap || 0);
  const maxClients = Math.round((audience || 0) * cap);
  const activeMembers = Math.min(raw, maxClients);
  return {
    activeMembers,
    monthlyRevenue: activeMembers * (price || 0),
    annualRevenue: activeMembers * (price || 0) * 12,
    engMultiplier: engMult,
    pctOfAudience: audience > 0 ? (activeMembers / audience * 100) : 0,
    capUsed: cap,
  };
}

/**
 * One-time offer revenue (cohort-based, no MRR concept).
 * Returns per-launch cohort + annualized revenue assuming N launches/year.
 *
 * Subsequent launches in the same year produce ~50% of first-launch revenue
 * (article 3, learningrevolution: "second annual launch: 40-60% of first").
 * We use 0.5 as the midpoint multiplier.
 */
export function calculateOneTimeRevenue({ audience, price, engagementRate, scenario, scenarioKey, tierBucket, launchesPerYear, paymentPlan }) {
  const engMult = calculateEngagementMultiplier(engagementRate);
  const planLift = paymentPlan ? PAYMENT_PLAN_LIFT : 1;
  // Use the per-launch rate table (NOT the steady-state cap). Falls back to
  // SCENARIOS.cap × 0.1 if tierBucket is missing, since cap is a steady-state
  // ceiling and a single launch reaches roughly a tenth of that pool.
  const perLaunchRate = (tierBucket && TIER_PER_LAUNCH_RATE[tierBucket]?.[scenarioKey])
    || (scenario?.cap || 0) * 0.1;
  const firstLaunchBuyers = Math.round((audience || 0) * perLaunchRate * Math.min(2.0, engMult) * planLift);
  const launches = Math.max(1, Number(launchesPerYear) || 1);
  // Subsequent launches: 50% of first (article 3 midpoint — "second annual
  // launch produces 40-60% of first launch's revenue").
  const subsequentMultiplier = 0.5;
  const totalAnnualBuyers = launches === 1
    ? firstLaunchBuyers
    : Math.round(firstLaunchBuyers * (1 + (launches - 1) * subsequentMultiplier));
  return {
    firstLaunchBuyers,
    launchesPerYear: launches,
    annualBuyers: totalAnnualBuyers,
    perLaunchRevenue: firstLaunchBuyers * (price || 0),
    annualRevenue: totalAnnualBuyers * (price || 0),
    engMultiplier: engMult,
    pctOfAudience: audience > 0 ? (totalAnnualBuyers / audience * 100) : 0,
    rateUsed: perLaunchRate,
  };
}

/**
 * Hybrid offer revenue: initial cohort fee + monthly retainer for N months.
 * Combines a one-time cohort fee with a recurring tail.
 *
 * @param {number} params.initialFee - One-time enrollment fee (€)
 * @param {number} params.monthlyFee - Monthly retainer that follows (€)
 * @param {number} params.retentionMonths - How long members stay paying (default 6)
 */
export function calculateHybridRevenue({ audience, initialFee, monthlyFee, engagementRate, scenario, scenarioKey, tierBucket, launchesPerYear, retentionMonths = 6, paymentPlan }) {
  const oneTime = calculateOneTimeRevenue({
    audience, price: initialFee, engagementRate, scenario, scenarioKey, tierBucket, launchesPerYear, paymentPlan,
  });
  // Recurring tail: each cohort buyer pays monthlyFee × retentionMonths.
  const recurringFromCohorts = oneTime.annualBuyers * (monthlyFee || 0) * retentionMonths;
  return {
    ...oneTime,
    initialFee: initialFee || 0,
    monthlyFee: monthlyFee || 0,
    retentionMonths,
    initialRevenue: oneTime.annualRevenue,           // from the initial fee
    recurringRevenue: recurringFromCohorts,           // from the monthly tail
    annualRevenue: oneTime.annualRevenue + recurringFromCohorts,
  };
}

/**
 * Dispatcher: routes to the correct revenue formula based on the offer's
 * pricing_model. Returns a normalised shape so callers don't need to know
 * which formula ran.
 *
 * @param {Object} params.offer - { pricing_model, pricing_tier, target_price }
 * @param {Object} params.creator - { primary audience, engagement rate }
 * @param {string} params.scenarioKey - 'conservador' | 'moderado' | 'agressivo'
 */
export function calculateOfferRevenue({ offer, creator, scenarioKey, audienceOverride, priceOverride }) {
  const scenario = SCENARIOS[scenarioKey] || SCENARIOS.moderado;
  const audience = audienceOverride
    || creator?.platforms?.instagram?.followers
    || creator?.platforms?.tiktok?.followers
    || creator?.platforms?.youtube?.subscribers
    || 0;
  const engagementRate = parseFloat(creator?.engagement) || 0;
  const priceStr = priceOverride || offer?.target_price || '';
  const priceNumeric = parsePriceNumeric(priceStr);
  const tierBucket = classifyTierBucket(offer?.pricing_tier, priceNumeric, offer?.pricing_model);
  const paymentPlan = !!offer?.payment_plan_available;
  const model = offer?.pricing_model || 'monthly';

  if (model === 'one_time') {
    const launches = Number(offer?.launches_per_year)
      || suggestLaunchesPerYear({ pricingTier: offer?.pricing_tier, targetPriceNumeric: priceNumeric, pricingModel: model, audience });
    const r = calculateOneTimeRevenue({
      audience, price: priceNumeric, engagementRate, scenario, scenarioKey, tierBucket, launchesPerYear: launches, paymentPlan,
    });
    return { mode: 'one_time', tierBucket, priceNumeric, ...r };
  }
  if (model === 'hybrid') {
    // For hybrid we expect target_price to encode "€X initial + €Y/mo" — try to parse,
    // fall back to assuming target_price IS the initial fee with no recurring tail.
    const hybridMatch = String(priceStr).match(/(\d[\d.,]*).+?(\d[\d.,]*)\s*\/\s*m/i);
    const initial = hybridMatch ? parseInt(hybridMatch[1].replace(/[.,]/g, ''), 10) || priceNumeric : priceNumeric;
    const monthly = hybridMatch ? parseInt(hybridMatch[2].replace(/[.,]/g, ''), 10) || 0 : 0;
    const launches = Number(offer?.launches_per_year)
      || suggestLaunchesPerYear({ pricingTier: offer?.pricing_tier, targetPriceNumeric: initial, pricingModel: model, audience });
    const r = calculateHybridRevenue({
      audience, initialFee: initial, monthlyFee: monthly, engagementRate, scenario, scenarioKey, tierBucket, launchesPerYear: launches, paymentPlan,
    });
    return { mode: 'hybrid', tierBucket, priceNumeric: initial, monthlyFee: monthly, ...r };
  }
  // Default: monthly or annual recurring
  const r = calculateSteadyMRR({
    audience, price: priceNumeric, engagementRate, scenario, scenarioKey, tierBucket, paymentPlan,
  });
  return { mode: 'recurring', tierBucket, priceNumeric, ...r };
}

/**
 * Project month-by-month growth that converges toward the steady state.
 * Uses the Hormozi steady-state members as the target.
 * Launch month gets a 3x acquisition spike (waitlist effect).
 */
const DEFAULT_LAUNCH_MULTIPLIER = 3;

export function projectGrowth({ audience, price, engagementRate, scenario, launchMultiplier = DEFAULT_LAUNCH_MULTIPLIER }) {
  const steady = calculateSteadyMRR({ audience, price, engagementRate, scenario });
  const targetMembers = steady.activeMembers;
  const churn = scenario?.churn || 0.08;
  // In equilibrium: monthly_acquisition = members × churn
  const monthlyAcquisition = Math.round(targetMembers * churn);
  const launchAcquisition = Math.round(monthlyAcquisition * launchMultiplier);

  const months = [];
  let members = 0;
  for (let m = 1; m <= 12; m++) {
    const newMembers = m === 1 ? launchAcquisition : monthlyAcquisition;
    members = Math.round(members * (1 - churn)) + newMembers;
    // Don't overshoot the target
    if (members > targetMembers) members = targetMembers;
    months.push({
      month: m,
      newMembers,
      totalMembers: members,
      mrr: members * (price || 0),
    });
  }
  return months;
}

export function cumulativeRevenue(months) {
  return (months || []).reduce((sum, m) => sum + (m.mrr || 0), 0);
}

// ─────────────────────────────────────────────────────────────────
// ECOSYSTEM FLOW MODEL (v1: feeder + upgrade flows, no cannibalization)
// ─────────────────────────────────────────────────────────────────
//
// Estimates total ecosystem revenue when a new offer slots into the
// creator's existing product ladder. Computes:
//   - Status quo: existing products × current buyers × price
//   - With new offer: status quo + new offer revenue + upgrade lifts − retirements
//
// v1 deliberately excludes cannibalization rates, refund rates, and
// niche-specific tuning — see project_revenue_model_deferred memory.
//
// FLOW RATES (scenario-scaled, applied annually):
//   - Feeder: when new offer is entry_point, X% of audience that wasn't
//     converting now enters via the new offer. Already captured by
//     calculateOfferRevenue for the new offer itself.
//   - Upgrade: when new offer is premium_upsell or sits above existing
//     products in the ladder, X% of lower-tier customers upgrade. Default
//     5%/10%/20% by scenario (anchored to learningrevolution's 5%
//     "existing customer" baseline). Applied as a one-way flow that
//     ADDS revenue at the upgrade tier without removing it from the
//     lower tier (v1 simplification — upgraders are net-new on the
//     higher rung, even though some would have churned anyway).

export const UPGRADE_RATE = {
  conservador: 0.05,
  moderado:    0.10,
  agressivo:   0.20,
};

// Tier index for ladder positioning. Lower = cheaper/entry. Lead magnets
// are treated as audience reservoirs, not paid tiers.
const TIER_LADDER_INDEX = {
  lead_magnet:      -1,
  low_ticket:        0,
  recurring:         0,
  mid_ticket:        1,
  high_ticket:       2,
  service:           2,
  physical_product:  0,
};

/**
 * Annual revenue from an existing product, given a buyer count estimate.
 * Tier-aware: recurring/community products are buyer_count × price × 12,
 * everything else is buyer_count × price (one-shot or one-shot-equivalent).
 */
function annualRevenueFromExistingProduct(product, buyers) {
  if (!product || !buyers || buyers <= 0) return 0;
  const price = Number(product.price_eur) || 0;
  if (!price) return 0;
  // recurring / community → MRR × 12. Everything else → assume annual cycle.
  if (product.tier === 'recurring' || product.tier === 'low_ticket' && /\/mo|\/m[êe]s/i.test(product.format || '')) {
    return buyers * price * 12;
  }
  return buyers * price;
}

/**
 * Build the ecosystem revenue projection.
 *
 * @param {Object} params.creator - full creator object (audience + engagement)
 * @param {Object} params.offer - the new offer (pricing_model, pricing_tier, target_price, payment_plan_available, launches_per_year)
 * @param {Array}  params.existingProducts - audit's products_found + existing_communities,
 *                  each augmented with { estimated_buyers?: number, retire_on_launch?: boolean }
 * @param {string} params.scenarioKey - 'conservador'|'moderado'|'agressivo'
 * @param {string} params.confirmedRole - CP1 frame.confirmed_role
 *
 * Returns { scenarioKey, statusQuo, withNewOffer, perTier: [...], headline: { statusQuo, withNewOffer, delta } }
 */
export function projectEcosystemRevenue({ creator, offer, existingProducts, scenarioKey, confirmedRole }) {
  const scenario = SCENARIOS[scenarioKey] || SCENARIOS.moderado;
  const audience = creator?.platforms?.instagram?.followers
    || creator?.platforms?.tiktok?.followers
    || creator?.platforms?.youtube?.subscribers
    || 0;
  const engagementRate = parseFloat(creator?.engagement) || 0;
  const upgradeRate = UPGRADE_RATE[scenarioKey] || UPGRADE_RATE.moderado;

  // 1. Existing products — annual revenue per product, using operator-set
  // buyer count when available, else conservative estimate.
  const existingRows = (existingProducts || []).map(p => {
    const buyers = (typeof p.estimated_buyers === 'number' && p.estimated_buyers >= 0)
      ? p.estimated_buyers
      : estimateCurrentBuyers({ audience, productTier: p.tier, engagementRate });
    const annualRev = annualRevenueFromExistingProduct(p, buyers);
    return {
      name: p.name,
      tier: p.tier,
      tierIndex: TIER_LADDER_INDEX[p.tier] ?? 0,
      price: Number(p.price_eur) || 0,
      buyers,
      retireOnLaunch: !!p.retire_on_launch,
      statusQuoAnnual: annualRev,
      // After-launch revenue. If retired, zero. Otherwise, gets upgrade
      // lift applied later (kept neutral here, modified below).
      withNewOfferAnnual: p.retire_on_launch ? 0 : annualRev,
    };
  });

  // 2. New offer revenue (annualised).
  const newOfferProjection = calculateOfferRevenue({ offer, creator, scenarioKey });
  const newOfferAnnual = newOfferProjection.annualRevenue || 0;
  const newOfferBuyers = newOfferProjection.activeMembers
    ?? newOfferProjection.annualBuyers
    ?? 0;
  const newOfferTierIndex = TIER_LADDER_INDEX[offer?.pricing_tier === 'high' ? 'high_ticket' : (offer?.pricing_tier === 'mid' ? 'mid_ticket' : 'recurring')] ?? 0;

  // 3. Upgrade lift. v1 model:
  //   - If new offer is premium_upsell, lift = upgradeRate × buyers in
  //     all existing tiers BELOW the new offer's tier index. Lift accrues
  //     to the new offer (extra buyers who came from existing rungs).
  //   - If new offer is entry_point, lift = upgradeRate × NEW community
  //     members, accruing to existing higher tiers (those rungs gain
  //     buyers from the new feeder).
  //   - Standalone / continuity → no upgrade flow (simple sum).
  let upgradeLiftToNew = 0;
  let upgradeLiftToExisting = 0;
  if (confirmedRole === 'premium_upsell') {
    const lowerTierBuyers = existingRows
      .filter(r => !r.retireOnLaunch && r.tierIndex < newOfferTierIndex && r.tierIndex >= 0)
      .reduce((sum, r) => sum + r.buyers, 0);
    upgradeLiftToNew = Math.round(lowerTierBuyers * upgradeRate);
  } else if (confirmedRole === 'entry_point') {
    upgradeLiftToExisting = Math.round(newOfferBuyers * upgradeRate);
  }

  // Extra revenue from upgrades. Upgrade-to-new uses new offer's price/cycle.
  // Upgrade-to-existing distributes evenly across existing higher tiers.
  const extraNewRevenue = (() => {
    if (upgradeLiftToNew === 0) return 0;
    const price = newOfferProjection.priceNumeric || 0;
    if (newOfferProjection.mode === 'recurring') return upgradeLiftToNew * price * 12;
    return upgradeLiftToNew * price;
  })();
  const higherTiers = existingRows.filter(r => !r.retireOnLaunch && r.tierIndex > 0 && r.tierIndex >= newOfferTierIndex);
  const upgradePerHigherTier = higherTiers.length > 0 ? Math.round(upgradeLiftToExisting / higherTiers.length) : 0;
  let extraExistingRevenue = 0;
  if (upgradePerHigherTier > 0) {
    higherTiers.forEach(r => {
      const addRev = annualRevenueFromExistingProduct({ tier: r.tier, price_eur: r.price }, upgradePerHigherTier);
      r.withNewOfferAnnual += addRev;
      r.upgradeBuyers = (r.upgradeBuyers || 0) + upgradePerHigherTier;
      extraExistingRevenue += addRev;
    });
  }

  const statusQuoTotal = existingRows.reduce((s, r) => s + r.statusQuoAnnual, 0);
  const withNewOfferExistingTotal = existingRows.reduce((s, r) => s + r.withNewOfferAnnual, 0);
  const withNewOfferTotal = withNewOfferExistingTotal + newOfferAnnual + extraNewRevenue;

  return {
    scenarioKey,
    audience,
    upgradeRate,
    newOffer: {
      name: offer?.community_name || 'New offer',
      tier: offer?.pricing_tier,
      tierBucket: newOfferProjection.tierBucket,
      mode: newOfferProjection.mode,
      annualRevenue: newOfferAnnual + extraNewRevenue,
      baseBuyers: newOfferBuyers,
      upgradeBuyers: upgradeLiftToNew,
      projection: newOfferProjection,
    },
    existing: existingRows,
    upgrade: {
      role: confirmedRole,
      rate: upgradeRate,
      liftToNew: upgradeLiftToNew,
      liftToExisting: upgradeLiftToExisting,
      extraNewRevenue,
      extraExistingRevenue,
    },
    headline: {
      statusQuoAnnual: statusQuoTotal,
      withNewOfferAnnual: withNewOfferTotal,
      deltaAnnual: withNewOfferTotal - statusQuoTotal,
    },
  };
}

/**
 * Default price for a niche. Used by callers that locally implement the
 * niche→pricing mapping (e.g. pitch deck). Kept as an export for reuse.
 */
export const NICHE_PRICING = {
  imobiliario: { low: 49, mid: 97, high: 297 },
  investimento: { low: 49, mid: 97, high: 297 },
  fitness: { low: 19, mid: 39, high: 79 },
  empreendedorismo: { low: 49, mid: 97, high: 247 },
  business: { low: 49, mid: 97, high: 247 },
  nutricao: { low: 19, mid: 37, high: 69 },
  dietetica: { low: 19, mid: 37, high: 69 },
  financas: { low: 29, mid: 59, high: 149 },
  educacao: { low: 19, mid: 39, high: 97 },
  desenvolvimento: { low: 19, mid: 39, high: 97 },
  culinaria: { low: 9, mid: 24, high: 49 },
  gastronomia: { low: 9, mid: 24, high: 49 },
};

