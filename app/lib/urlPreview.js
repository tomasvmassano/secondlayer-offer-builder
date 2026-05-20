/**
 * Generic URL preview fetcher — for non-aggregator URLs that fall through
 * the deterministic-scraper net (personal sites, Substack newsletters,
 * Skool communities, Patreon, Whop, Memberful, custom paywall pages…).
 *
 * The audit's web_search alone is unreliable on these: pricing usually
 * lives on subpages, behind paywalls, or in JS-rendered content that
 * Google never indexed. By fetching the HTML ourselves server-side and
 * extracting title + visible text + price-like substrings, we give the
 * LLM the actual page content as PREVIEW context — it no longer has to
 * speculate from search snippets.
 *
 * Output shape per URL:
 *   { url, title, description, priceHints: [...], textExcerpt, error? }
 *
 * Used by the ecosystem-audit route, between the deterministic aggregator
 * scrape and the Claude call.
 */

const FETCH_TIMEOUT_MS = 10000; // 10s per URL — pages that don't respond by then aren't going to help
const MAX_TEXT_CHARS = 2500;    // budget per URL in the prompt; covers headline + hero + pricing CTA
const MAX_PRICE_HINTS = 8;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

// Strip HTML tags, collapse whitespace, decode common entities, trim.
// Cheap and good enough for "show the LLM what's on the page" — we don't
// need DOM-perfect parsing, just enough signal that Claude can find the
// price, the product name, the CTA copy.
function htmlToText(html) {
  if (!html) return '';
  let s = String(html);
  // Drop noise: scripts, styles, SVGs, noscript, head metadata
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  s = s.replace(/<head[\s\S]*?<\/head>/gi, ' ');
  // Keep alt/title attributes — pricing CTAs often live in image alts or button titles
  s = s.replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, ' $1 ');
  s = s.replace(/<[^>]+title="([^"]*)"[^>]*>/gi, ' $1 ');
  // Strip remaining tags
  s = s.replace(/<[^>]+>/g, ' ');
  // Decode entities
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
       .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// Extract <title> and meta description before tags get stripped.
function extractMetaTitleDescription(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(/<meta[^>]+(?:name|property)="(?:description|og:description)"[^>]+content="([^"]*)"/i)
    || html.match(/<meta[^>]+content="([^"]*)"[^>]+(?:name|property)="(?:description|og:description)"/i);
  return {
    title: titleMatch ? htmlToText(titleMatch[1]) : '',
    description: descMatch ? htmlToText(descMatch[1]) : '',
  };
}

// Price-pattern matcher. Covers the formats SL creators' pages use:
//   USD: $49, $49/month, $49 / mo, $1,200
//   EUR: €19, €19/mês, €19 / month, 19€
//   GBP: £29
//   Bare-number monthly: "19/mês", "29/month", "9.99 USD/mo"
// Returns deduplicated up to MAX_PRICE_HINTS, with surrounding ~40 chars for context.
function extractPriceHints(text) {
  if (!text) return [];
  const hits = [];
  const seen = new Set();
  const PRICE_REGEXES = [
    /\$\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?(?:\s?(?:\/|per\s)\s?(?:mo|mês|mes|month|year|yr|ano))?[^\d]?[\w\s]{0,30}/gi,
    /€\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?(?:\s?(?:\/|por\s)\s?(?:mo|mês|mes|month|year|yr|ano))?[^\d]?[\w\s]{0,30}/gi,
    /£\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?(?:\s?(?:\/|per\s)\s?(?:mo|mês|mes|month|year))?[^\d]?[\w\s]{0,30}/gi,
    /\b\d{1,4}(?:[.,]\d{1,2})?\s?€(?:\s?(?:\/|por\s)\s?(?:mo|mês|mes|month|year|yr|ano))?[^\d]?[\w\s]{0,30}/gi,
    /\b\d{1,4}(?:[.,]\d{1,2})?\s?(?:USD|EUR|GBP)(?:\s?(?:\/|per\s)\s?(?:mo|mês|mes|month|year|yr|ano))?[^\d]?[\w\s]{0,30}/gi,
    /\b\d{1,4}\s?\/\s?(?:mo|mês|mes|month|year|yr|ano)\b/gi,
  ];
  for (const re of PRICE_REGEXES) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const raw = m[0].trim().replace(/\s+/g, ' ').slice(0, 80);
      const key = raw.toLowerCase().replace(/[^\w$€£/]/g, '');
      if (seen.has(key)) continue;
      // Skip obvious non-price noise like "$190B" (billions = not a creator product price)
      if (/\b\$?\d+\s*[BT]\b/i.test(raw) && !/\$\d+\.?\d*\s*(\/|per|month)/i.test(raw)) continue;
      seen.add(key);
      hits.push(raw);
      if (hits.length >= MAX_PRICE_HINTS) return hits;
    }
  }
  return hits;
}

/**
 * Fetch one URL and return a structured preview. Soft-fail: any error
 * (timeout, 4xx, 5xx, dns) returns an object with { error } instead of
 * throwing, so the caller can continue with the URLs that did work.
 */
export async function fetchUrlPreview(url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { url, title: '', description: '', priceHints: [], textExcerpt: '', error: 'invalid URL' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { url, title: '', description: '', priceHints: [], textExcerpt: '', error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const { title, description } = extractMetaTitleDescription(html);
    const fullText = htmlToText(html);
    const textExcerpt = fullText.slice(0, MAX_TEXT_CHARS);
    const priceHints = extractPriceHints(fullText);
    return { url, title, description, priceHints, textExcerpt };
  } catch (err) {
    clearTimeout(timer);
    return { url, title: '', description: '', priceHints: [], textExcerpt: '', error: err.name === 'AbortError' ? 'timeout' : (err.message || 'fetch failed') };
  }
}

/**
 * Fetch previews for a batch of URLs in parallel. Returns one entry per
 * input URL (even on failure, with `error` populated). Bounded
 * concurrency would be polite but at typical audit sizes (3-10 URLs)
 * unrestricted Promise.all is fine.
 */
export async function fetchUrlPreviews(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  return Promise.all(urls.map(u => fetchUrlPreview(typeof u === 'string' ? u : u?.url)));
}
