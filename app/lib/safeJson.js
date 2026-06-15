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
//
// Uses lookahead + lookbehind (both zero-width) so consecutive unpaired
// surrogates all get caught. An earlier version used a consuming
// lookback like `(^|[^\uD800-\uDBFF])` which "ate" the preceding
// character, so a run like `DC00 DC00 DC00` only had its first low
// surrogate scrubbed — the rest survived and still tripped the server's
// strict UTF-16 validator. Zero-width assertions fix that.
export function sanitizeUnpairedSurrogates(s) {
  if (typeof s !== 'string') return s;
  return s
    // High surrogate NOT followed by a low surrogate → replace half.
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '�')
    // Low surrogate NOT preceded by a high surrogate → replace half.
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�');
}

// Scrub orphan `\uXXXX` JSON ESCAPES from raw JSON text.
//
// Modern V8's JSON.stringify (Node 12+) emits orphan surrogate code units
// as 6-character ASCII escapes — e.g. an unpaired high half becomes the
// literal characters \, u, D, 8, 0, 0. JSON.parse then throws "no low
// surrogate in string" when it decodes the escape and finds no matching
// pair on the next 6 chars. That's the actual error path users hit:
// orphan reaches the server inside the JSON text envelope, not as a raw
// UTF-16 code unit.
//
// Fix: walk the raw JSON text and rewrite every orphan \uXXXX escape to
// � (the replacement character) BEFORE JSON.parse runs. Lookbehind
// is fixed-length (6 chars) so this works in all modern V8.
export function sanitizeUnpairedSurrogateEscapes(jsonText) {
  if (typeof jsonText !== 'string') return jsonText;
  const HI = '\\\\u[Dd][89AaBb][0-9A-Fa-f]{2}';     // \uD800-\uDBFF
  const LO = '\\\\u[Dd][CcDdEeFf][0-9A-Fa-f]{2}';   // \uDC00-\uDFFF
  return jsonText
    // High-surrogate escape NOT immediately followed by low-surrogate escape.
    .replace(new RegExp(`${HI}(?!${LO})`, 'g'), '\\uFFFD')
    // Low-surrogate escape NOT immediately preceded by high-surrogate escape.
    .replace(new RegExp(`(?<!${HI})${LO}`, 'g'), '\\uFFFD');
}

// Parse a raw JSON string that may contain unpaired UTF-16 surrogates in
// EITHER form: raw code units (emoji-truncated mid-pair in the source
// string) or literal `\uXXXX` escapes (the way modern JSON.stringify
// renders them). Strict `JSON.parse` accepts neither in escape form;
// Next.js's `request.json()` also rejects raw orphans. Use this
// server-side in any route that receives creator-profile bodies:
//
//   const raw  = await request.text();
//   const body = safeParse(raw);
//
// Throws SyntaxError if the body is structurally invalid JSON (just like
// JSON.parse). Only the surrogate problem is masked.
export function safeParse(rawText) {
  let s = sanitizeUnpairedSurrogates(rawText);
  s = sanitizeUnpairedSurrogateEscapes(s);
  return JSON.parse(s);
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
