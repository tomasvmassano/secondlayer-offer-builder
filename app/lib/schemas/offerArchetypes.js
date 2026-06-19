/**
 * Offer archetypes — single source of truth.
 *
 * Until 2026-06-18 the hub had ONE offer shape baked into it: a paid
 * community / monthly recurring offer. CP2-CP4 prompts, the pitch deck
 * slides, and the sales-copy templates all assumed this. When the
 * Strategic Frame's sequenced_plays[0] called for anything else (a
 * productized service, an affiliate/commerce play, a cohort course),
 * the downstream wizards still built a community-shaped offer.
 *
 * This module names the shapes so they can be reasoned about. The
 * Strategic Frame LLM now labels its own output with one of these
 * archetypes; CP2-CP4 see the label and adapt; future commits will
 * branch the actual schemas + templates per archetype.
 *
 * Five shapes cover the realistic creator-monetization space:
 *
 *   - community_recurring    Paid community / monthly recurring, with
 *                            cohorts, modules, member rituals.
 *                            (Current default — 90% of past creators.)
 *
 *   - productized_service    Fixed-price async deliverable. Operator
 *                            ships an artifact per buyer. Templatizable
 *                            but operator-time bound. E.g. async
 *                            interior design at €290-490/room.
 *
 *   - commerce_affiliate     Curated shoppable content + brand
 *                            partnerships. No own product; revenue
 *                            from intent leakage already in the
 *                            creator's content.
 *
 *   - cohort_education       Fixed-cohort course or program. Time-
 *                            bound, premium-priced, designer-school
 *                            style. Different audience than the
 *                            recurring community.
 *
 *   - hybrid_stack           Explicit combo of 2+ plays running in
 *                            parallel — e.g. commerce engine on top
 *                            of a productized service. Sequenced
 *                            in the strategic frame.
 *
 * The enum is the contract. Don't add a sixth archetype without
 * adding the matching downstream branches; the system fails open
 * (assumes community_recurring) on unknown values today.
 */

export const OFFER_ARCHETYPES = [
  'community_recurring',
  'productized_service',
  'commerce_affiliate',
  'cohort_education',
  'hybrid_stack',
];

// LLM-facing labels + descriptions. Used inside the Strategic Frame system
// prompt (archetypeEnumForPrompt) and the downstream formatter
// (formatStrategicFrameForPrompt in strategicFrame.js). Stay in English —
// the LLM reads them as schema documentation.
export const OFFER_ARCHETYPE_LABELS = {
  community_recurring: 'Community · recurring',
  productized_service: 'Productized service',
  commerce_affiliate:  'Commerce + affiliate',
  cohort_education:    'Cohort education',
  hybrid_stack:        'Hybrid stack',
};

export const OFFER_ARCHETYPE_DESCRIPTIONS = {
  community_recurring:
    'Paid community / monthly recurring revenue. Members pay a recurring fee for access to a space + cadenced content + rituals. Cohort-based or evergreen. The classic creator-MRR model.',
  productized_service:
    "Fixed-price async deliverable. The creator (or their team) produces ONE artifact per buyer using a templatized process — mood board, room design, audit report, custom plan, etc. Templatizable but operator-time bound. Bridges 'I admire her work' → 'I can afford her' for creators whose full DFY service is out of reach.",
  commerce_affiliate:
    "Curated shoppable content + 2-3 anchor brand partnerships. The creator captures intent that's already leaking out of their content for free. Zero new product to build, leverages content cadence they already maintain.",
  cohort_education:
    'Fixed-cohort course or program. Time-bound (4-12 weeks typically), premium-priced (€500-3K), often delivered live in cohorts of 30-80. Sells to a DIFFERENT audience than the recurring community — usually practitioners or aspiring practitioners.',
  hybrid_stack:
    'Two or more of the above running in parallel as an explicit combination. E.g. commerce engine layered on top of a productized service, OR a recurring community feeding into a productized service. Pricing tiers map to different shapes.',
};

// PT-PT labels + descriptions for the operator-facing hub UI. The hub is
// internal Portuguese-only — these are what render in panels, gates, and
// summary cards. Keep semantic meaning identical to the EN versions above
// so swapping consumers between locales doesn't shift behaviour.
export const OFFER_ARCHETYPE_LABELS_PT = {
  community_recurring: 'Comunidade · recorrente',
  productized_service: 'Serviço productizado',
  commerce_affiliate:  'Commerce + afiliados',
  cohort_education:    'Curso em cohort',
  hybrid_stack:        'Stack híbrida',
};

export const OFFER_ARCHETYPE_DESCRIPTIONS_PT = {
  community_recurring:
    'Comunidade paga / receita recorrente mensal. Os membros pagam mensalmente para aceder a um espaço + conteúdo cadenciado + rituais. Em cohort ou evergreen. O modelo clássico de MRR de criadora.',
  productized_service:
    "Entregável assíncrono a preço fixo. A criadora (ou a equipa) produz UM artefacto por comprador com um processo templatizado — moodboard, design de divisão, relatório de auditoria, plano personalizado, etc. Templatizável mas limitado pelo tempo da operadora. Faz a ponte 'admiro o trabalho dela' → 'consigo pagar' para criadoras cujo DFY completo está fora do alcance.",
  commerce_affiliate:
    'Conteúdo shoppable curado + 2-3 partnerships com marcas-âncora. A criadora captura intenção que já está a sair do conteúdo gratuitamente. Zero produto novo para construir, aproveita a cadência de conteúdo que já mantém.',
  cohort_education:
    'Curso ou programa em cohort fixo. Time-bound (4-12 semanas tipicamente), preço premium (€500-3K), frequentemente entregue ao vivo em cohorts de 30-80. Vende para uma audiência DIFERENTE da comunidade recorrente — geralmente praticantes ou aspirantes a praticantes.',
  hybrid_stack:
    'Duas ou mais das opções acima a correr em paralelo como combinação explícita. Ex: motor de commerce sobreposto a um serviço productizado, OU uma comunidade recorrente a alimentar um serviço productizado. Os tiers de pricing mapeiam para shapes diferentes.',
};

/**
 * Type guard. Returns true if `s` is a recognised archetype string.
 * Anything else (null, '', a typo, a new archetype not yet defined)
 * returns false — callers should fall back to community_recurring,
 * which is the historical default the hub was built around.
 */
export function isValidOfferArchetype(s) {
  return typeof s === 'string' && OFFER_ARCHETYPES.includes(s);
}

/**
 * For the system prompt — produce a numbered enum description so the
 * LLM picks from a closed set with full context, not a free string.
 */
export function archetypeEnumForPrompt() {
  return OFFER_ARCHETYPES.map((k, i) => `  ${i + 1}. ${k}\n     ${OFFER_ARCHETYPE_DESCRIPTIONS[k]}`).join('\n');
}
