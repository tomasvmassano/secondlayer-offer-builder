/**
 * Language routing for creator content and outreach.
 *
 * Second Layer delivers services in PT or EN only. This module parses
 * Claude's audience-language detection and resolves the creator to a
 * deliverable language, or flags them as language_not_served.
 */

const THRESHOLD = 20; // Minimum % of audience/content in a language to be deliverable

/**
 * Parse a language string like "Portuguese 70%, English 20%, Spanish 10%"
 * into a map of { pt: 70, en: 20, es: 10, ... }
 */
function parseLanguageString(str) {
  if (!str || typeof str !== 'string') return {};
  const result = {};
  const lower = str.toLowerCase();

  // Match patterns like "portuguese 70%", "english 40 %", "pt 70%"
  const patterns = [
    { key: 'pt', regex: /\b(portuguese|português|portugues|pt)\s*[-:–—]?\s*(\d+(?:\.\d+)?)\s*%?/gi },
    { key: 'en', regex: /\b(english|inglês|ingles|en)\s*[-:–—]?\s*(\d+(?:\.\d+)?)\s*%?/gi },
    { key: 'es', regex: /\b(spanish|español|espanol|es)\s*[-:–—]?\s*(\d+(?:\.\d+)?)\s*%?/gi },
    { key: 'ar', regex: /\b(arabic|árabe|arabe|ar)\s*[-:–—]?\s*(\d+(?:\.\d+)?)\s*%?/gi },
    { key: 'fr', regex: /\b(french|francês|frances|fr)\s*[-:–—]?\s*(\d+(?:\.\d+)?)\s*%?/gi },
    { key: 'it', regex: /\b(italian|italiano|it)\s*[-:–—]?\s*(\d+(?:\.\d+)?)\s*%?/gi },
    { key: 'de', regex: /\b(german|deutsch|alemão|alemao|de)\s*[-:–—]?\s*(\d+(?:\.\d+)?)\s*%?/gi },
  ];

  for (const { key, regex } of patterns) {
    const matches = [...lower.matchAll(regex)];
    for (const m of matches) {
      const pct = parseFloat(m[2]);
      if (!isNaN(pct)) {
        // Keep highest match if regex fired multiple times for the same language
        if (!result[key] || pct > result[key]) result[key] = pct;
      }
    }
  }

  return result;
}

/**
 * Resolve a creator's primary deliverable language.
 *
 * Returns:
 *   "pt" — Portuguese dominates and meets the threshold
 *   "es" — Spanish dominates and meets the threshold (added 2026-05-20)
 *   "en" — every other case: EN >= threshold, OR no single language reaches
 *          threshold, OR detected language is something Second Layer does
 *          not deliver in yet (Arabic, French, etc.).
 *
 * Decision (2026-05-18, extended 2026-05-20): Second Layer now ships
 * outreach + assets in PT, EN, and ES. For audiences that don't match any
 * of those, we default to EN rather than null so downstream branches that
 * check `=== 'en'` produce content instead of falling back to PT.
 *
 * When MORE THAN ONE supported language meets the threshold, the highest
 * percentage wins. Ties resolve in priority order: PT > ES > EN (PT and ES
 * are the smaller markets; if a creator's audience is half-EN we still
 * default to the dominant non-EN audience because the operator is more
 * likely to want to address the local one).
 *
 * @param {string|object} input Language string from intelligence.audience.primaryLanguage
 *                              OR a pre-parsed object like { pt: 70, en: 20, es: 10 }
 * @param {number} threshold Minimum percent (default 20). Lower = more inclusive.
 */
export function resolvePrimaryLanguage(input, threshold = THRESHOLD) {
  const langs = typeof input === 'string' ? parseLanguageString(input) : (input || {});
  const pt = langs.pt || 0;
  const en = langs.en || 0;
  const es = langs.es || 0;

  const candidates = [];
  if (pt >= threshold) candidates.push(['pt', pt]);
  if (es >= threshold) candidates.push(['es', es]);
  if (en >= threshold) candidates.push(['en', en]);

  if (candidates.length === 0) return 'en';

  // Highest percentage wins. Tie-break order: PT > ES > EN (smaller markets
  // first so a 30/30 PT/EN audience still gets PT assets).
  const priority = { pt: 3, es: 2, en: 1 };
  candidates.sort((a, b) => b[1] - a[1] || priority[b[0]] - priority[a[0]]);
  return candidates[0][0];
}

/**
 * Coerce any incoming language value to one of the three supported codes.
 * Used by API routes and UI components that branch on the language. Keeps
 * legacy values, mis-cased input, and full-name strings ("Spanish", "es-MX")
 * normalised to 'pt' | 'en' | 'es'.
 */
export function normalizeLanguageCode(value, fallback = 'en') {
  if (!value) return fallback;
  const v = String(value).toLowerCase().trim();
  if (v === 'pt' || v.startsWith('pt-') || v.startsWith('portugu')) return 'pt';
  if (v === 'es' || v.startsWith('es-') || v.startsWith('spanish') || v.startsWith('espa')) return 'es';
  if (v === 'en' || v.startsWith('en-') || v.startsWith('engl')) return 'en';
  return fallback;
}

