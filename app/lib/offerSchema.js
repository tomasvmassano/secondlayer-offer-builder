/**
 * Offer state schema — single source of truth for everything stored under
 * `creator.offer`. Built for the checkpoint-based generation flow.
 *
 * The rule: `internal_metadata` is the RAW operator-side data. By default
 * it is not rendered to the creator. The pitch deck IS allowed to surface
 * specific, operator-curated subsets (e.g. ecosystem_audit.products_found
 * to demonstrate strategic understanding of the creator's existing funnel)
 * — but those insertions are made deliberately at the slide-builder level,
 * not from a "render everything in internal_metadata" pattern. Treat
 * client_facing_output as the wizard's structured output and
 * internal_metadata as an operator-only knowledge base that the slide
 * builder is allowed to draw from sparingly.
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

// The wizard checkpoints. Used for stepper UI, lock state, and the
// downstream-cascade-invalidation logic in lockCheckpoint/unlockCheckpoint.
//
// CP5 (Sales Copy — differentiator section, hero, objections, FAQ,
// social_proof_line) was disconnected: those outputs are AUDIENCE-facing
// sales copy that the creator pushes AFTER closing the partnership with us.
// Premature for the pitch-the-creator stage. The schema + endpoint + panel
// stay in the codebase (app/lib/schemas/salesCopy.js, app/api/.../wizard/
// sales-copy/route.js, SalesCopyPanel) so we can resurrect them when we
// build the post-close "launch assets" tool.
export const CHECKPOINTS = [
  { id: 1, key: 'strategic_frame',   name: 'Strategic Frame',  short: 'Frame'   },
  { id: 2, key: 'core_offer',        name: 'Core Offer',       short: 'Offer'   },
  { id: 3, key: 'modules',           name: 'Modules',          short: 'Modules' },
  { id: 4, key: 'value_stack',       name: 'Value Stack',      short: 'Stack'   },
];
export const TOTAL_CHECKPOINTS = CHECKPOINTS.length;

// Empty starting shape (used when no offer has been generated yet).
export function emptyInternalMetadata() {
  return {
    generation_id: null,
    status: null,
    ecosystem_audit: null,            // Phase 1
    archetype_classification: null,   // Phase 2
    uniqueness_extraction: null,      // Phase 3
    // Phase 4 · CP1 raw output. Internal — informs CP2+ but is never rendered
    // to the creator. CP2-5 outputs live under client_facing_output.
    strategic_frame: null,
    // Wizard state. `current` is the active checkpoint; `locked` maps each CP
    // id → ISO lock timestamp (null = not yet locked). Downstream
    // invalidation: unlocking CP2 clears locked[3..5] and zeroes their
    // client_facing_output slices.
    checkpoint_progress: {
      current: 1,
      locked: { 1: null, 2: null, 3: null, 4: null, 5: null },
    },
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
    central_promise: null,         // CP2 "Big Idea" — one-sentence hook in creator voice
    transformation: { from: null, to: null, timeframe: null }, // CP2
    // CP2 — who the offer IS / IS NOT for. Two-column rendering on the pitch.
    audience_fit: { for: [], not_for: [] },
    // CP2 — pricing model: 'one_time' | 'monthly' | 'annual' | 'hybrid'.
    // Tier is locked by operator at CP2; CP4 sizes the value stack to back it.
    // 'low' (€30-100/mo), 'mid' (€200-500/mo), 'high' (€1K+/mo or €3K+ one-time).
    pricing_model: null,
    pricing_tier: null,
    target_price: null,
    weekly_rhythm: [],
    weekly_formats: [],
    library: [],
    // CP3 modules. Each must link ≥1 uniqueness element (schema-enforced).
    modules: [],
    unlocked_bonuses: [],
    pricing_tiers: [],
    differentiator_section: null,  // CP5
    strategic_context_line: null,  // CP1/CP5 — separately editable
    mechanism: null,
    value_stack: null,             // CP4
    // CP5 — sales-copy artefacts.
    hero: null,                    // { headline, sub, cta }
    objections: [],                // [{ objection, rebuttal }]
    faq: [],                       // [{ q, a }]
    social_proof_line: null,       // sourced from fame_tier_evidence if available
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

// ──────────────────────────────────────────────────────────────────────────
// Phase 4 wizard — checkpoint progress helpers
// ──────────────────────────────────────────────────────────────────────────
// All pure functions. Endpoints call these, persist the result, and return.
// Frontend mirrors the same logic for stepper UI.

// Coerce a possibly-missing/partial `checkpoint_progress` into the canonical
// shape. Safe to call on legacy creators that pre-date Phase 4.
export function readCheckpointProgress(internalMetadata) {
  const p = internalMetadata?.checkpoint_progress || {};
  const locked = p.locked || {};
  return {
    current: typeof p.current === 'number' ? p.current : 1,
    locked: {
      1: locked[1] || null,
      2: locked[2] || null,
      3: locked[3] || null,
      4: locked[4] || null,
      5: locked[5] || null,
    },
  };
}

// A checkpoint can run only if every checkpoint before it is locked.
// CP1 can always run (no prerequisites). The endpoint should 412 if this
// returns false; the UI should disable the Run button.
export function canRunCheckpoint(internalMetadata, checkpointId) {
  if (checkpointId < 1 || checkpointId > TOTAL_CHECKPOINTS) return false;
  const prog = readCheckpointProgress(internalMetadata);
  for (let i = 1; i < checkpointId; i++) {
    if (!prog.locked[i]) return false;
  }
  return true;
}

// Lock a checkpoint (operator approved its output and is ready to advance).
// Returns the next progress object — caller persists it. Locking CP3 with
// CP2 unlocked is a programmer error and throws.
export function lockCheckpoint(internalMetadata, checkpointId) {
  if (!canRunCheckpoint(internalMetadata, checkpointId)) {
    throw new Error(`Cannot lock CP${checkpointId} — prior checkpoints aren't locked`);
  }
  const prog = readCheckpointProgress(internalMetadata);
  return {
    current: Math.min(checkpointId + 1, TOTAL_CHECKPOINTS),
    locked: { ...prog.locked, [checkpointId]: new Date().toISOString() },
  };
}

// Unlock a checkpoint with downstream cascade invalidation.
// Unlocking CP2 must clear CP3-5 locks AND blank their client_facing_output
// slices (modules, value_stack, pricing_tiers, hero, objections, faq,
// social_proof_line, differentiator_section). The caller is responsible for
// applying the returned slices to the persisted creator.
//
// Returns:
//   {
//     progress: { current, locked },  // updated checkpoint_progress
//     internal_clears: string[],      // keys under internal_metadata to null
//     client_clears: string[],        // keys under client_facing_output to reset
//   }
//
// internal_clears/client_clears tell the API route which keys to wipe so we
// don't leak stale CP3 modules into a re-run CP3.
export function unlockCheckpoint(internalMetadata, checkpointId) {
  if (checkpointId < 1 || checkpointId > TOTAL_CHECKPOINTS) {
    throw new Error(`Invalid checkpoint id ${checkpointId}`);
  }
  const prog = readCheckpointProgress(internalMetadata);
  const newLocked = { ...prog.locked };
  for (let i = checkpointId; i <= TOTAL_CHECKPOINTS; i++) {
    newLocked[i] = null;
  }

  // Which fields each CP wrote — these get cleared on unlock.
  // Internal metadata side:
  const INTERNAL_BY_CP = { 1: ['strategic_frame'] };
  // Client-facing side — each entry is the field name to reset to its empty value.
  // CP3 now also produces weekly_formats + library (formerly CP2 fallbacks);
  // unlocking CP3 clears them too. mechanism + sales-copy fields moved out of
  // CP4/5 because CP5 is disconnected; they live in a quiet hold-zone in case
  // the launch-assets tool revives them later.
  const CLIENT_BY_CP = {
    2: ['central_promise', 'transformation', 'audience_fit', 'pricing_model', 'pricing_tier', 'target_price', 'community_name', 'name_candidates', 'platform', 'core_mechanic', 'weekly_rhythm'],
    3: ['modules', 'weekly_formats', 'library'],
    4: ['value_stack', 'pricing_tiers', 'unlocked_bonuses', 'mechanism'],
    // 5 intentionally omitted — disconnected from the wizard. If sales-copy
    // returns, restore: ['differentiator_section', 'strategic_context_line',
    // 'hero', 'objections', 'faq', 'social_proof_line']
  };

  const internalClears = [];
  const clientClears = [];
  for (let i = checkpointId; i <= TOTAL_CHECKPOINTS; i++) {
    (INTERNAL_BY_CP[i] || []).forEach(k => internalClears.push(k));
    (CLIENT_BY_CP[i] || []).forEach(k => clientClears.push(k));
  }

  return {
    progress: {
      current: checkpointId,
      locked: newLocked,
    },
    internal_clears: internalClears,
    client_clears: clientClears,
  };
}

// Apply an unlockCheckpoint() result to a draft offer object.
// Returns a new offer with the relevant fields zeroed. Pure — no I/O.
export function applyUnlock(offer, unlockResult) {
  const emptyInternal = emptyInternalMetadata();
  const emptyClient = emptyClientFacingOutput();
  const nextInternal = { ...(offer.internal_metadata || {}) };
  const nextClient = { ...(offer.client_facing_output || emptyClient) };

  for (const k of unlockResult.internal_clears) {
    nextInternal[k] = emptyInternal[k] ?? null;
  }
  for (const k of unlockResult.client_clears) {
    nextClient[k] = emptyClient[k];
  }

  nextInternal.checkpoint_progress = unlockResult.progress;

  return {
    ...offer,
    internal_metadata: nextInternal,
    client_facing_output: nextClient,
  };
}
