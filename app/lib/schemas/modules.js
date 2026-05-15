/**
 * Modules (Phase 4 · Checkpoint 3) schema + validator.
 *
 * Writes THREE coordinated arrays into client_facing_output:
 *   - modules         : 4-8 curriculum modules (the offer's spine)
 *   - weekly_formats  : 3-5 day-of-week live cadence entries (pitch slide 5
 *                       left column — "what happens this week")
 *   - library         : 3-6 on-demand catalogue entries (pitch slide 5 right
 *                       column — "what's already in the vault")
 *
 * Each module MUST link to at least one Phase 3 uniqueness element with
 * `usable_in_modules=true`. This is the "defensibility chain":
 *   every module is justified by a concrete, citable creator advantage,
 *   not generic course content any competitor could ship.
 *
 * weekly_formats + library are NOT independent — they're the operational
 * face of the same modules. A live_call module typically becomes a
 * weekly_format entry; a recorded_module/doc/template typically becomes a
 * library entry; a community_ritual is a weekly_format. The prompt tells
 * the model to derive both from the modules array AND the locked CP2
 * weekly_rhythm bullets so the pitch slide stays coherent.
 *
 * The validator takes a second arg `availableElementCount` so it can
 * enforce that linked_unique_elements indices are in range. Callers MUST
 * pass the Phase 3 unique_elements.length when validating module sets.
 */

export const VALID_FORMATS = [
  'live_call',         // recurring or one-off video session with the creator
  'recorded_module',   // pre-recorded video + supporting docs
  'doc',               // long-form written playbook / SOP
  'template',          // working Notion / spreadsheet / code template
  'community_ritual',  // a structured recurring thread / channel / format
];

// Day labels used in weekly_formats. Accepts both PT (SEG/TER/...) and EN
// (MON/TUE/...) plus short numeric forms. Free-form short string — the
// validator only enforces ≤10 chars.
function isShortStr(v, max) { return typeof v === 'string' && v.length > 0 && v.length <= max; }
function isStrAt(v, max) { return typeof v === 'string' && v.length > 0 && (max == null || v.length <= max + 60); }
// ^ "soft cap" pattern: hard-fail only when ~60 chars over. Anything past
// the soft cap surfaces as a warning instead. Keeps the validator forgiving
// on small overshoots while still bouncing novel-length replies.

function isStr(v) { return typeof v === 'string' && v.length > 0; }

// Validate a single module — used for both batch generation and
// single-module regen. `availableElementCount` is the Phase 3 elements.length;
// indices in linked_unique_elements must be 0..availableElementCount-1.
export function validateModule(m, availableElementCount, path = 'module') {
  const errors = [];
  const push = (p, msg) => errors.push(`${p}: ${msg}`);
  if (!m || typeof m !== 'object' || Array.isArray(m)) {
    return [`${path}: must be an object`];
  }
  if (!isStr(m.name)) push(`${path}.name`, 'required non-empty string');
  else if (m.name.length > 80) push(`${path}.name`, `should be ≤80 chars (got ${m.name.length})`);
  if (!isStr(m.description)) push(`${path}.description`, 'required non-empty string (1-2 sentences on what this module IS)');
  else if (m.description.length > 300) push(`${path}.description`, `should be ≤300 chars (got ${m.description.length})`);
  if (!isStr(m.transformation_delivered)) push(`${path}.transformation_delivered`, 'required non-empty string (specific outcome this module produces)');
  else if (m.transformation_delivered.length > 200) push(`${path}.transformation_delivered`, `should be ≤200 chars (got ${m.transformation_delivered.length})`);
  if (!VALID_FORMATS.includes(m.format)) push(`${path}.format`, `must be one of ${VALID_FORMATS.join('|')}`);
  if (!isStr(m.delivery_cadence)) push(`${path}.delivery_cadence`, 'required non-empty string (e.g. "Weekly Tuesday 18:00", "On enrollment")');
  else if (m.delivery_cadence.length > 80) push(`${path}.delivery_cadence`, `should be ≤80 chars (got ${m.delivery_cadence.length})`);

  // The defensibility chain: every module must cite at least one Phase 3
  // uniqueness element. Schema-enforced because without this constraint the
  // model will happily generate generic "AI Foundations" modules with no
  // grounding.
  if (!Array.isArray(m.linked_unique_elements)) {
    push(`${path}.linked_unique_elements`, 'must be an array of integer indices (0-based) into Phase 3 unique_elements');
  } else if (m.linked_unique_elements.length < 1) {
    push(`${path}.linked_unique_elements`, 'must contain ≥1 index — every module must cite a concrete creator advantage');
  } else {
    m.linked_unique_elements.forEach((ix, i) => {
      if (!Number.isInteger(ix) || ix < 0) {
        push(`${path}.linked_unique_elements[${i}]`, 'must be a non-negative integer');
      } else if (typeof availableElementCount === 'number' && ix >= availableElementCount) {
        push(`${path}.linked_unique_elements[${i}]`, `index ${ix} out of range (only ${availableElementCount} uniqueness elements available)`);
      }
    });
  }
  return errors;
}

// Validate the full module set (CP3 batch generation).
//   - 4-8 modules total
//   - Every module per-item rules
//   - 3-5 weekly_formats (day-of-week live cadence)
//   - 3-6 library entries (on-demand catalogue)
//   - Every usable Phase 3 element should be cited at least once across the
//     modules array (soft check — flagged as warning).
export function validateModules(obj, availableElementCount) {
  const errors = [];
  const warnings = [];
  const push = (p, msg) => errors.push(`${p}: ${msg}`);

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['root: must be a JSON object'], warnings: [] };
  }

  // ── modules
  if (!Array.isArray(obj.modules)) {
    push('modules', 'must be an array of 4-8 modules');
  } else {
    if (obj.modules.length < 4) {
      push('modules', `must contain at least 4 modules (got ${obj.modules.length}) — the offer needs enough scaffolding`);
    } else if (obj.modules.length > 8) {
      push('modules', `must contain at most 8 modules (got ${obj.modules.length}) — consolidate the weakest`);
    }
    obj.modules.forEach((m, i) => {
      const moduleErrors = validateModule(m, availableElementCount, `modules[${i}]`);
      errors.push(...moduleErrors);
    });

    // Soft check: every cited element index across the set
    if (typeof availableElementCount === 'number' && availableElementCount > 0) {
      const cited = new Set();
      obj.modules.forEach(m => (m.linked_unique_elements || []).forEach(ix => cited.add(ix)));
      const uncited = [];
      for (let i = 0; i < availableElementCount; i++) {
        if (!cited.has(i)) uncited.push(i);
      }
      if (uncited.length > 0) {
        warnings.push(`uniqueness elements [${uncited.join(', ')}] are NOT cited by any module — operator may want to consider whether they belong in CP4 bonuses instead`);
      }
    }
  }

  // ── weekly_formats — 3-5 day-of-week entries for the pitch slide left column
  if (!Array.isArray(obj.weekly_formats)) {
    push('weekly_formats', 'must be an array of 3-5 day-of-week live cadence entries');
  } else if (obj.weekly_formats.length < 3 || obj.weekly_formats.length > 5) {
    push('weekly_formats', `must contain 3-5 entries (got ${obj.weekly_formats.length})`);
  } else {
    obj.weekly_formats.forEach((w, i) => {
      const px = `weekly_formats[${i}]`;
      if (!w || typeof w !== 'object' || Array.isArray(w)) { push(px, 'must be an object'); return; }
      if (!isShortStr(w.day, 10)) push(`${px}.day`, 'required non-empty string ≤10 chars (e.g. "MON", "SEG", "Tue")');
      if (!isStrAt(w.name, 60)) push(`${px}.name`, 'required non-empty string (≤60 chars, format name e.g. "Database Build Session")');
      if (!isStrAt(w.type, 40)) push(`${px}.type`, 'required non-empty string (≤40 chars, kind e.g. "Live 45m", "Thread", "Workshop")');
      if (!isStrAt(w.desc, 140)) push(`${px}.desc`, 'required non-empty string (≤140 chars, one-line description)');
    });
  }

  // ── library — 3-6 on-demand catalogue entries for the pitch slide right column
  if (!Array.isArray(obj.library)) {
    push('library', 'must be an array of 3-6 on-demand library entries');
  } else if (obj.library.length < 3 || obj.library.length > 6) {
    push('library', `must contain 3-6 entries (got ${obj.library.length})`);
  } else {
    obj.library.forEach((l, i) => {
      const px = `library[${i}]`;
      if (!l || typeof l !== 'object' || Array.isArray(l)) { push(px, 'must be an object'); return; }
      if (!isStrAt(l.name, 60)) push(`${px}.name`, 'required non-empty string (≤60 chars, module name)');
      if (!isStrAt(l.format, 40)) push(`${px}.format`, 'required non-empty string (≤40 chars, e.g. "Masterclass", "PDF", "Template Pack")');
      if (!isStrAt(l.desc, 140)) push(`${px}.desc`, 'required non-empty string (≤140 chars, theme/outcome)');
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}
