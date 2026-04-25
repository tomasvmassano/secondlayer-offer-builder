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
 *   "pt" — PT >= threshold, use Portuguese
 *   "en" — EN >= threshold, use English
 *   null — neither reaches threshold (language_not_served)
 *
 * When BOTH meet threshold, the higher % wins.
 *
 * @param {string|object} input Language string from intelligence.audience.primaryLanguage
 *                              OR a pre-parsed object like { pt: 70, en: 20 }
 * @param {number} threshold Minimum percent (default 20). Lower = more inclusive.
 */
export function resolvePrimaryLanguage(input, threshold = THRESHOLD) {
  const langs = typeof input === 'string' ? parseLanguageString(input) : (input || {});
  const pt = langs.pt || 0;
  const en = langs.en || 0;

  if (pt >= threshold && en >= threshold) {
    return pt >= en ? 'pt' : 'en';
  }
  if (pt >= threshold) return 'pt';
  if (en >= threshold) return 'en';
  return null; // language_not_served
}

/**
 * Format a language code for display.
 */
export function languageLabel(code) {
  const labels = { pt: 'PT', en: 'EN', es: 'ES', ar: 'AR', fr: 'FR', it: 'IT', de: 'DE' };
  return labels[code] || code?.toUpperCase() || '?';
}

/**
 * Get breakdown of all detected languages for display purposes.
 * Returns array sorted by percentage desc: [{ code: "en", pct: 60 }, ...]
 */
export function languageBreakdown(input) {
  const langs = typeof input === 'string' ? parseLanguageString(input) : (input || {});
  return Object.entries(langs)
    .map(([code, pct]) => ({ code, pct }))
    .sort((a, b) => b.pct - a.pct);
}
