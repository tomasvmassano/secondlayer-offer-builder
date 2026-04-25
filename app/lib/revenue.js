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

/**
 * Calculate the engagement multiplier from a creator's engagement rate.
 * - Engagement at benchmark (2%) → multiplier = 1.0
 * - Half-weight smoothing so extreme engagement doesn't dominate
 * - Clamped to [0.3, 3.0] so no creator gets infinite or zero scaling
 */
export function calculateEngagementMultiplier(engagementRate) {
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
 */
export function calculateSteadyMRR({ audience, price, engagementRate, scenario }) {
  const engMult = calculateEngagementMultiplier(engagementRate);
  const vrAdj = (scenario?.vr || 0) * engMult;
  const raw = Math.round(
    (audience || 0) *
    vrAdj *
    (scenario?.lr || 0) *
    (scenario?.cr || 0) *
    (scenario?.p || 0) *
    (1 - (scenario?.churn || 0))
  );
  const maxClients = Math.round((audience || 0) * (scenario?.cap || 0));
  const activeMembers = Math.min(raw, maxClients);
  return {
    activeMembers,
    monthlyRevenue: activeMembers * (price || 0),
    annualRevenue: activeMembers * (price || 0) * 12,
    engMultiplier: engMult,
    pctOfAudience: audience > 0 ? (activeMembers / audience * 100) : 0,
  };
}

/**
 * Project month-by-month growth that converges toward the steady state.
 * Uses the Hormozi steady-state members as the target.
 * Launch month gets a 3x acquisition spike (waitlist effect).
 */
export const DEFAULT_LAUNCH_MULTIPLIER = 3;

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

/**
 * Helper: detect default price for a niche if user hasn't customized.
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

const NICHE_ALIASES = {
  'real estate': 'imobiliario', property: 'imobiliario',
  investing: 'investimento', investment: 'investimento',
  gym: 'fitness', workout: 'fitness', training: 'fitness', coaching: 'fitness',
  entrepreneur: 'empreendedorismo', entrepreneurship: 'empreendedorismo', startup: 'empreendedorismo',
  marketing: 'business', 'creator economy': 'business',
  nutrition: 'nutricao', diet: 'dietetica', 'healthy eating': 'nutricao',
  finance: 'financas', 'personal finance': 'financas', money: 'financas',
  education: 'educacao', teaching: 'educacao', learning: 'educacao',
  'personal development': 'desenvolvimento', mindset: 'desenvolvimento',
  food: 'culinaria', cooking: 'culinaria', baking: 'culinaria', culinary: 'culinaria',
};

export function detectNichePricing(nicheString) {
  if (!nicheString) return NICHE_PRICING.fitness;
  const lower = nicheString.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const key of Object.keys(NICHE_PRICING)) {
    if (lower.includes(key)) return NICHE_PRICING[key];
  }
  for (const [alias, key] of Object.entries(NICHE_ALIASES)) {
    if (lower.includes(alias)) return NICHE_PRICING[key];
  }
  return NICHE_PRICING.fitness;
}
