/**
 * Offer state schema — single source of truth for everything stored under
 * `creator.offer`. Built for the checkpoint-based generation flow.
 *
 * The hard rule: `internal_metadata` is for the system + operator only and
 * MUST NEVER appear in any artefact the creator sees (pitch deck, launch-plan
 * PDF, PPTX export). `client_facing_output` is the only thing rendered to
 * the creator.
 *
 *   creator.offer = {
 *     // Markdown blob from the LLM (kept so we can re-parse if the parser improves).
 *     raw: string | null,
 *     generatedAt: ISO,
 *     reparsedAt: ISO | null,
 *
 *     // System-only metadata used by the wizard, the offer builder, future
 *     // fine-tunes, and operator inspection. NEVER rendered to the creator.
 *     internal_metadata: {
 *       generation_id: string,
 *       status: 'in_progress' | 'approved' | 'abandoned',
 *       ecosystem_audit: object | null,        // Phase 1 output
 *       archetype_classification: object | null, // Phase 2 output
 *       uniqueness_extraction: object | null,  // Phase 3 output
 *       checkpoint_history: Array<{
 *         checkpoint: 1 | 2 | 3 | 4 | 5,
 *         status: 'pending' | 'approved' | 'overridden' | 'regenerated',
 *         at: ISO,
 *         note: string,
 *       }>,
 *       generation_timestamps: Record<string, ISO>,
 *       legacy_parsed: object | null,          // back-compat for offers parsed
 *                                                with the v2/v3 markdown flow
 *     },
 *
 *     // The ONLY thing rendered to the creator. Pitch deck, launch plan PDF
 *     // and PPTX export read exclusively from here. Field names are sales-
 *     // language, not internal jargon.
 *     client_facing_output: {
 *       community_name: string | null,
 *       central_promise: string | null,
 *       transformation: {
 *         from: string | null,
 *         to: string | null,
 *         timeframe: string | null,
 *       },
 *       weekly_rhythm: string[],                          // legacy short bullets
 *       weekly_formats: Array<{ day, name, type, desc }>, // pitch slide 5 left
 *       library: Array<{ name, format, desc }>,           // pitch slide 5 right
 *       modules: Array<{ title, desc, bonus_label? }>,    // post-Checkpoint 5
 *       unlocked_bonuses: string[],                       // month-1/2/3/4/6/12
 *       pricing_tiers: Array<{ name, price, note }>,      // pitch slide 4
 *       differentiator_section: string | null,            // pitch slide 5 footer
 *       strategic_context_line: string | null,            // separate from differentiator
 *                                                          so the wizard can edit it on its own
 *       mechanism: {
 *         name: string | null,
 *         letters: Array<{ letter, word, explanation }>,
 *         description: string | null,
 *       } | null,
 *       value_stack: {
 *         items: Array<{ problem, solution, delivery, dollarValue }>,
 *         total: string | null,
 *         actualPrice: string | null,
 *       } | null,
 *       cases: Array<{ name, niche, members, price, mrr, resume, why }>,
 *     },
 *   }
 */

// Empty starting shape (used when no offer has been generated yet).
export function emptyInternalMetadata() {
  return {
    generation_id: null,
    status: null,
    ecosystem_audit: null,
    archetype_classification: null,
    uniqueness_extraction: null,
    checkpoint_history: [],
    generation_timestamps: {},
    legacy_parsed: null,
  };
}

export function emptyClientFacingOutput() {
  return {
    community_name: null,
    name_candidates: [],          // alternates shown on pitch slide 4 header
    platform: null,                // Skool / Whop / Circle / Discord — pitch slide 4
    core_mechanic: null,           // 1-3 sentence "what happens weekly" — pitch slide 4
    central_promise: null,
    transformation: { from: null, to: null, timeframe: null },
    weekly_rhythm: [],
    weekly_formats: [],
    library: [],
    modules: [],
    unlocked_bonuses: [],
    pricing_tiers: [],
    differentiator_section: null,
    strategic_context_line: null,
    mechanism: null,
    value_stack: null,
    cases: [],
  };
}

// Map a v2/v3 `parsed` blob (produced by parseOutput in offerParser.jsx) into
// the new dual shape. Pure mapping — no LLM, no I/O, no mutations.
//
// Used in two places:
//   1. Read path: if a legacy creator has `creator.offer.parsed` but no
//      `client_facing_output`, derive it on the fly so the pitch/launch-plan
//      keep rendering correctly.
//   2. Migration: when an operator runs the new wizard, we keep the legacy
//      parsed blob under `internal_metadata.legacy_parsed` for reference.
//
// Anything that doesn't exist in the legacy shape stays null/empty — the
// wizard fills the rest.
export function legacyParsedToOfferState(parsed) {
  if (!parsed) {
    return {
      internal_metadata: emptyInternalMetadata(),
      client_facing_output: emptyClientFacingOutput(),
    };
  }

  const c = parsed.community || {};

  return {
    internal_metadata: {
      ...emptyInternalMetadata(),
      legacy_parsed: parsed,
    },
    client_facing_output: {
      community_name:         c.primaryName || null,
      name_candidates:        Array.isArray(c.nameCandidates) ? c.nameCandidates : [],
      platform:               c.platform || null,
      core_mechanic:          c.mechanic || null,
      central_promise:        null,   // wizard-only
      transformation:         { from: null, to: null, timeframe: null }, // wizard-only
      weekly_rhythm:          Array.isArray(c.weeklyRhythm) ? c.weeklyRhythm : [],
      weekly_formats:         Array.isArray(c.weeklyFormats) ? c.weeklyFormats : [],
      library:                Array.isArray(c.library) ? c.library : [],
      modules:                [],     // wizard-only
      unlocked_bonuses:       Array.isArray(c.bonuses) ? c.bonuses : [],
      pricing_tiers:          Array.isArray(c.tiers) ? c.tiers : [],
      differentiator_section: c.differentiator || null,
      strategic_context_line: null,   // wizard-only
      mechanism:              parsed.uniqueMechanism || null,
      value_stack:            parsed.valueStack || null,
      cases:                  Array.isArray(parsed.cases) ? parsed.cases : [],
    },
  };
}

// Read helper — the canonical accessor every consumer should use.
// Order of precedence:
//   1. `creator.offer.client_facing_output` if it exists (wizard-generated offers)
//   2. derived from `creator.offer.parsed` on the fly (legacy / pre-wizard offers)
//   3. empty shape (no offer yet)
//
// Always returns the dual `{ internal_metadata, client_facing_output }` shape
// so callers don't branch.
export function readOfferState(creator) {
  const o = creator?.offer;
  if (!o) {
    return {
      internal_metadata: emptyInternalMetadata(),
      client_facing_output: emptyClientFacingOutput(),
    };
  }
  if (o.client_facing_output) {
    return {
      internal_metadata: o.internal_metadata || emptyInternalMetadata(),
      client_facing_output: o.client_facing_output,
    };
  }
  // Legacy fallback — lazy-derive from the old parsed blob.
  return legacyParsedToOfferState(o.parsed);
}

// Convenience for the most common usage site (pitch deck / launch-plan PDF).
export function readClientFacing(creator) {
  return readOfferState(creator).client_facing_output;
}
