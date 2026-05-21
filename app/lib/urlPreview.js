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

// Find pricing-related internal links on a page. The fetcher uses these
// to do a single 1-level follow — fetch the top 2 candidates so prices
// that live on /pricing or /join (not on the homepage) still surface.
// Score: match in the URL path is worth more than match in link text
// because text can be ambiguous ("Pro" might be a button to a Pro tier
// OR a content tag).
// Two tiers of pricing-related signals. STRONG signals are URLs/text
// that almost always lead to a pricing page (e.g. /pricing, /plans,
// /checkout). WEAK signals are ambiguous (e.g. /pro could be a content
// category tag; "Premium" could be a feature page). Weighting both
// ensures we pick the unambiguous candidate when both are present.
const PRICING_STRONG_PATH = /\/(pricing|plans?|join|subscribe|membership|checkout|tiers?)(\/|\?|#|$)/i;
const PRICING_WEAK_PATH = /\/(upgrade|premium|pro|paid|gold|plus)(\/|\?|#|$)/i;
const PRICING_STRONG_TEXT = /^\s*(pricing|plans?|join now|subscribe|membership|checkout|tiers?|see pricing|view plans?)\s*$/i;
const PRICING_WEAK_TEXT = /\b(upgrade|premium|pro|paid|gold|plus)\b/i;

function extractPricingLinks(html, baseUrl) {
  let baseHost;
  try { baseHost = new URL(baseUrl).hostname; } catch { return []; }

  const links = new Map(); // url → { score, text }
  const anchorRe = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;

    // Strip nested tags from link text and decode entities so "<span>Pricing</span>" still scores.
    const text = htmlToText(m[2]).slice(0, 100);

    let score = 0;
    if (PRICING_STRONG_PATH.test(href)) score += 5;
    else if (PRICING_WEAK_PATH.test(href)) score += 2;
    if (PRICING_STRONG_TEXT.test(text)) score += 4;
    else if (PRICING_WEAK_TEXT.test(text)) score += 1;
    if (score === 0) continue;

    // Resolve to absolute URL on the same host. Cross-origin pricing
    // links (e.g. → stripe.com/checkout) are out of scope here — those
    // are platform-specific landings the LLM can web_search if needed.
    let absUrl;
    try {
      absUrl = new URL(href, baseUrl);
      if (absUrl.hostname !== baseHost) continue;
      // Strip query strings + fragments to dedupe; some sites tack on UTM params per nav slot
      absUrl.hash = '';
      absUrl.search = '';
    } catch { continue; }

    const finalUrl = absUrl.toString();
    if (finalUrl === baseUrl.replace(/[?#].*$/, '')) continue; // Don't follow back to self
    const existing = links.get(finalUrl);
    if (!existing || score > existing.score) {
      links.set(finalUrl, { score, text });
    }
  }

  return [...links.entries()]
    .map(([url, info]) => ({ url, ...info }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
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

// Extract the first plausible contact email from raw HTML. Mailto anchors
// come first because they're explicit, then falls back to a regex over the
// visible text (covers creators who paste "hi@domain.com" as text rather
// than as a clickable link). Rejects common boilerplate addresses that
// show up on marketing footers (info@instagram, noreply@*, etc.).
function findEmailInHtml(html) {
  if (!html) return null;
  // Step 1: mailto: anchors — the canonical signal that this address is
  // intended as a contact point.
  const mailtoMatch = html.match(/href=["']mailto:([^"'?#]+)/i);
  if (mailtoMatch) {
    const candidate = String(mailtoMatch[1]).toLowerCase().trim();
    if (candidate && !/^(noreply|no-reply|donotreply|info@(instagram|meta|facebook)|press@(meta|facebook)|support@meta|abuse@)/i.test(candidate)) {
      return candidate;
    }
  }
  // Step 2: visible-text regex. Strip tags first so we don't grab garbage
  // out of script blocks (analytics IDs sometimes look like emails).
  const text = htmlToText(html);
  const m = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (!m) return null;
  const email = m[0].toLowerCase();
  if (/^(noreply|no-reply|donotreply|info@(instagram|meta|facebook)|press@(meta|facebook)|support@meta|abuse@|example@|test@|sentry@|dev@example|admin@example)/i.test(email)) {
    return null;
  }
  return email;
}

/**
 * Lightweight email lookup on a single URL. Same fetch + 10s timeout as
 * fetchUrlPreview but cheaper because it only returns the email — no
 * pricing extraction, no link discovery. Used by the scrape pipeline as a
 * final fallback when the in-data cascade (IG bio, TikTok bio, YouTube
 * description, bio-link titles) didn't surface an address.
 *
 * Soft-fail: any fetch error returns null so the caller can move on.
 */
export async function findEmailOnUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    return findEmailInHtml(html);
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Fetch one URL and return a structured preview. Soft-fail: any error
 * (timeout, 4xx, 5xx, dns) returns an object with { error } instead of
 * throwing, so the caller can continue with the URLs that did work.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {boolean} [opts.extractLinks=true]  When true, also scan the HTML
 *   for pricing-related internal links and return them under
 *   `discoveredPricingLinks` so the batch caller can do a 1-level follow.
 *   Set false on the follow-up fetches themselves to avoid recursion.
 */
export async function fetchUrlPreview(url, opts = {}) {
  const { extractLinks = true } = opts;
  if (!url || !/^https?:\/\//i.test(url)) {
    return { url, title: '', description: '', priceHints: [], textExcerpt: '', discoveredPricingLinks: [], error: 'invalid URL' };
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
      return { url, title: '', description: '', priceHints: [], textExcerpt: '', discoveredPricingLinks: [], error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const { title, description } = extractMetaTitleDescription(html);
    const fullText = htmlToText(html);
    const textExcerpt = fullText.slice(0, MAX_TEXT_CHARS);
    const priceHints = extractPriceHints(fullText);
    const discoveredPricingLinks = extractLinks ? extractPricingLinks(html, url) : [];
    return { url, title, description, priceHints, textExcerpt, discoveredPricingLinks };
  } catch (err) {
    clearTimeout(timer);
    return { url, title: '', description: '', priceHints: [], textExcerpt: '', discoveredPricingLinks: [], error: err.name === 'AbortError' ? 'timeout' : (err.message || 'fetch failed') };
  }
}

/**
 * Fetch previews for a batch of URLs in parallel. Returns one entry per
 * input URL (even on failure, with `error` populated). Bounded
 * concurrency would be polite but at typical audit sizes (3-10 URLs)
 * unrestricted Promise.all is fine.
 *
 * Pass 2: for every primary URL that surfaced a pricing-related internal
 * link (homepage with /pricing in the nav, /pro tier link, etc.) we fetch
 * the top discovered link too. This is what closes the gap when a
 * creator's homepage doesn't show the price — the price lives on the
 * sub-page. We follow ONE level deep and skip if the URL is already in
 * the input list. The follow-up itself doesn't recursively discover more
 * links (extractLinks: false) so we never spider.
 */
export async function fetchUrlPreviews(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return [];

  const inputUrls = urls.map(u => typeof u === 'string' ? u : u?.url).filter(Boolean);
  const primary = await Promise.all(inputUrls.map(u => fetchUrlPreview(u, { extractLinks: true })));

  // Collect follow-up candidates from each primary's discoveredPricingLinks.
  // Dedupe across primaries (a /pricing link might appear on every page).
  // Cap at 2 follow-ups per primary URL (top-scoring) — covers cases like
  // "creator has BOTH /pricing AND /pro" where each landing matters.
  // Total follow-ups bounded by primaries × 2.
  const inputSet = new Set(inputUrls.map(u => u.replace(/[?#].*$/, '')));
  const followCandidates = new Map(); // url → { sourceUrl }
  for (const p of primary) {
    if (!p?.discoveredPricingLinks?.length) continue;
    for (const candidate of p.discoveredPricingLinks.slice(0, 2)) {
      const normalised = candidate.url.replace(/[?#].*$/, '');
      if (inputSet.has(normalised)) continue;        // already in user-provided URLs
      if (followCandidates.has(normalised)) continue; // dedup across primaries
      followCandidates.set(normalised, { sourceUrl: p.url, linkText: candidate.text });
    }
  }

  if (followCandidates.size === 0) return primary;

  const followUrls = [...followCandidates.keys()];
  const followResults = await Promise.all(followUrls.map(u => fetchUrlPreview(u, { extractLinks: false })));

  // Annotate follow-ups so the LLM knows they were discovered from another URL.
  const annotated = followResults.map(r => ({
    ...r,
    sourceUrl: followCandidates.get(r.url.replace(/[?#].*$/, ''))?.sourceUrl || null,
    discoveredFrom: 'follow-pricing-link',
  }));

  return [...primary, ...annotated];
}
