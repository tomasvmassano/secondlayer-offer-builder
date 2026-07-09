// ─────────────────────────────────────────────────────────────────
// Shared validator normalizers.
//
// The wizard schema validators kept hard-FAILING on trivial LLM
// deviations — an enum in the wrong case ("High Risk" vs "high"), a
// string 10% over a char cap, an array with one item too many. Every
// hard fail = a 502 + a wasted generation the operator has to re-run,
// and we fixed them reactively one prod incident at a time (currency,
// booleans, char caps). These helpers let validators COERCE instead of
// reject: normalize what the LLM clearly meant, only hard-fail on
// structurally missing data.
// ─────────────────────────────────────────────────────────────────

/**
 * Coerce a value onto an allowed enum. Case/space/hyphen-insensitive,
 * with an optional synonym map. Returns the canonical value, or null if
 * no match (caller decides whether null is acceptable).
 *
 *   normalizeEnum('High Risk', ['high','medium','low','none'])          → null
 *   normalizeEnum('High', ['high','medium','low','none'])               → 'high'
 *   normalizeEnum('one-time', ['recurring','one_time'], {'one-time':'one_time'}) → 'one_time'
 */
export function normalizeEnum(value, allowed, synonyms = {}) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (allowed.includes(raw)) return raw;

  const canon = s => String(s).trim().toLowerCase().replace(/[\s-]+/g, '_');
  const target = canon(raw);

  // Synonym map first (keys canonicalised too).
  for (const [k, v] of Object.entries(synonyms)) {
    if (canon(k) === target) return v;
  }
  // Then a canonicalised match against the allowed set.
  for (const a of allowed) {
    if (canon(a) === target) return a;
  }
  return null;
}

/**
 * Clamp a string to a max length at a word boundary (no mid-word cut).
 * Returns the original if under cap. Non-strings pass through untouched.
 */
export function clampStr(value, max) {
  if (typeof value !== 'string' || value.length <= max) return value;
  const slice = value.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  // Only back up to a word boundary if it doesn't lose more than ~15%.
  const cut = lastSpace > max * 0.85 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[\s,;:.–—-]+$/, '');
}

/**
 * Clamp an array to [min, max] length. Over max → trimmed to max.
 * Under min → returned as-is (the caller still hard-fails, since you
 * can't fabricate missing items). Non-arrays pass through.
 */
export function clampArray(value, min, max) {
  if (!Array.isArray(value)) return value;
  if (value.length > max) return value.slice(0, max);
  return value;
}
