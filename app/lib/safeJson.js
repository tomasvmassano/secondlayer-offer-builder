/**
 * UTF-16 surrogate-pair sanitiser for JSON request bodies.
 *
 * Why this exists
 * ───────────────
 * Instagram bios / captions / comments often contain emoji (🎯, 🚀, 😅,
 * sparkles, etc.). Every emoji is a surrogate PAIR — one high surrogate
 * (U+D800–U+DBFF) followed by one low surrogate (U+DC00–U+DFFF) in
 * UTF-16. The scrape pipeline occasionally truncates a string mid-emoji,
 * leaving an UNPAIRED surrogate behind in fields like `creator.bio`,
 * `creator.intelligence.captions[i]`, `creator.research.notes`, etc.
 *
 * When the frontend `JSON.stringify`s that object and POSTs to a Next.js
 * API route, the body survives transit fine (HTTP allows raw bytes),
 * but the server's `request.json()` calls a strict UTF-16 validator
 * that rejects unpaired surrogates with:
 *
 *     "no low surrogate in string: line 1 column N (char N-1)"
 *
 * The user sees a cryptic 400 and the DM never generates. The fix is to
 * replace unpaired surrogates with the Unicode REPLACEMENT CHARACTER
 * (U+FFFD, ◇) before stringifying. Visible to humans only as a tiny
 * diamond glyph on truncated emoji — the LLM downstream ignores it.
 */

// Strip unpaired surrogates from a JS string. Paired surrogates (real
// emoji) pass through untouched. Unpaired ones get replaced with U+FFFD.
export function sanitizeUnpairedSurrogates(s) {
  if (typeof s !== 'string') return s;
  return s
    // High surrogate NOT followed by a low surrogate → strip the half.
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '�')
    // Low surrogate NOT preceded by a high surrogate → strip the half.
    .replace(/(^|[^\uD800-\uDBFF])([\uDC00-\uDFFF])/g, '$1�');
}

// JSON.stringify replacement that sanitises every string in the tree.
// Use this anywhere a request body might carry scraped-Instagram data.
//
//   body: safeStringify({ creator, ... })
//
// Identical interface to JSON.stringify(obj) — same output type (string),
// same error semantics for circular refs / unrepresentable values.
export function safeStringify(obj) {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'string' ? sanitizeUnpairedSurrogates(value) : value
  );
}
