// ─────────────────────────────────────────────────────────────────
// LLM JSON repair — cheap Haiku pass to salvage a non-parseable
// model response instead of re-running the whole (often web_search-
// backed) generation.
//
// WHY: several wizard routes used to handle "the model wrapped its JSON
// in prose / markdown fences / a stray sentence" by RE-RUNNING the
// entire call — for ecosystem-audit that means paying the full
// ~$0.10-0.15 again INCLUDING all web searches. A parse failure is
// almost never a reasoning failure; it's a formatting slip. Feeding the
// broken text to Haiku with "return only the JSON object" fixes it for
// ~$0.005 and ~2s, with no tools and no context re-derivation.
// ─────────────────────────────────────────────────────────────────

/**
 * Attempt to extract a valid JSON object from a model response that
 * failed a first parse. Returns the parsed object, or null if repair
 * also fails (caller should then fail fast).
 *
 * @param {string} apiKey       Anthropic key
 * @param {string} brokenText   the raw model output that wouldn't parse
 * @param {function} tryParse   the route's own tryParseJson (brace matcher)
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=15000]
 */
export async function repairJsonWithHaiku(apiKey, brokenText, tryParse, opts = {}) {
  if (!apiKey || !brokenText) return null;
  const timeoutMs = opts.timeoutMs ?? 15000;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          // The broken text may contain the full valid object wrapped in
          // prose or fences, or a lightly-malformed one (trailing comma,
          // smart quotes). Haiku just has to emit the clean object.
          content: `The text below was supposed to be a single JSON object but failed to parse. Extract and return ONLY the corrected JSON object — no prose, no markdown fences, no commentary. Preserve all field values exactly; only fix structural/syntax issues.\n\n${brokenText.slice(0, 24000)}`,
        }],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    return tryParse(text);
  } catch {
    return null;
  }
}
