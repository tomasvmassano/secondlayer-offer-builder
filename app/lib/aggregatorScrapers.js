/**
 * Aggregator scrapers — deterministic product extraction from link-in-bio
 * platforms.
 *
 * The Phase 1 ecosystem audit was missing products from stan.store-style
 * aggregators (one URL → many product cards). Asking an LLM with web_search
 * to enumerate dense aggregator pages is unreliable — it summarises and
 * skips cards. So for known aggregator domains we run a deterministic
 * scraper FIRST and feed its output directly into the audit's
 * products_found list. The LLM is then only used for tier classification
 * + transformation extraction on the structured products.
 *
 * Dispatcher pattern — add new aggregators by dropping a function into
 * SCRAPERS. Each scraper takes a URL and returns:
 *
 *   {
 *     ok: boolean,
 *     products: [{ name, price_eur, url, format }],
 *     source: string  // human-readable scraper id for diagnostics
 *   }
 *
 *  Or { ok: false, products: [], error: string } on failure. Callers
 *  should fall through to the LLM-based audit on failure.
 */

import vm from 'node:vm';

// ─────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────

const SCRAPERS = {
  'stan.store': scrapeStanStore,
  'linktr.ee':  scrapeLinktree,
  // 'beacons.ai': scrapeBeacons,    // next priority
};

// Pull the bare hostname out of a URL string. Returns lowercase domain
// without protocol or path; defaults to '' on malformed input.
function hostnameOf(url) {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Dispatch a URL to the matching aggregator scraper. Returns null when no
// scraper covers this domain — caller should fall through to LLM path.
export async function tryScrapeAggregator(url) {
  const host = hostnameOf(url);
  if (!host) return null;
  // Check exact host + parent-domain match (stan.store matches www.stan.store)
  for (const [domain, scraper] of Object.entries(SCRAPERS)) {
    if (host === domain || host.endsWith('.' + domain)) {
      try {
        const result = await scraper(url);
        return result;
      } catch (err) {
        return { ok: false, products: [], error: err.message || 'scraper threw', source: domain };
      }
    }
  }
  return null;
}

// Convenience for the audit endpoint — runs scrapers on a list of seed
// URLs and returns the aggregated structured products + which URLs were
// successfully scraped. Failed URLs are returned so the LLM path can
// retry them with web_search.
export async function scrapeKnownAggregators(urls) {
  const products = [];
  const scrapedUrls = [];
  const failedUrls = [];
  const diagnostics = [];

  for (const u of urls) {
    const url = typeof u === 'string' ? u : u?.url;
    if (!url) continue;
    const result = await tryScrapeAggregator(url);
    if (!result) continue; // No dedicated scraper; LLM will handle.
    if (result.ok && result.products.length > 0) {
      products.push(...result.products);
      scrapedUrls.push(url);
      diagnostics.push({ url, source: result.source, count: result.products.length });
    } else {
      failedUrls.push(url);
      diagnostics.push({ url, source: result.source || hostnameOf(url), error: result.error || 'no products' });
    }
  }

  return { products, scrapedUrls, failedUrls, diagnostics };
}

// ─────────────────────────────────────────────────────────────────
// Stan.store scraper
// ─────────────────────────────────────────────────────────────────
//
// Stan.store is a Nuxt.js app (Vue SSR). The full page state ships as a
// `window.__NUXT__=(function(a,b,c,...){...}(<args>))` IIFE in the HTML.
// The function body builds the data object using letter-aliased
// references (e.g. title:B, price:{amount:b}) and the actual values are
// passed in as the IIFE's arguments at the end.
//
// We can't just regex this out — the aliases require mapping. So we
// evaluate the IIFE in an isolated Node `vm` context with a 2s timeout
// and read back the structured result. The IIFE only constructs and
// returns a plain object — no DOM, no fetch, no globals beyond a
// passed-in empty `W` object that it decorates.
//
// Fallback chain:
//   1. Nuxt __NUXT__ IIFE (current stan.store frontend)
//   2. Legacy Next __NEXT_DATA__ JSON blob (older stan.store stores)
//   3. Regex over product-card HTML (last resort)
//
// Tier inference — stan.store doesn't tag products with our tier enum,
// so we infer from price + membership flag:
//   membership_duration_available → recurring
//   free / no price                → lead_magnet
//   < €30                          → lead_magnet (small upsells)
//   €30-100                        → low_ticket
//   €100-500                       → mid_ticket
//   €500+                          → high_ticket
// The audit's LLM step can override these if it has more context.

async function scrapeStanStore(url) {
  const res = await fetch(url, {
    headers: {
      // Pretend to be a real browser — some stores 403 default user-agents
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    return { ok: false, products: [], error: `stan.store HTTP ${res.status}`, source: 'stan.store' };
  }
  const html = await res.text();

  // ── Path 1: Nuxt window.__NUXT__ IIFE (current stan.store) ──
  const nuxtData = parseNuxtData(html);
  if (nuxtData) {
    const baseUrl = url.replace(/\?.*$/, '').replace(/\/$/, '');
    const products = extractNuxtProducts(nuxtData, baseUrl);
    if (products.length > 0) {
      return { ok: true, products, source: 'stan.store (nuxt)' };
    }
  }

  // ── Path 2: Legacy Next __NEXT_DATA__ blob (tolerant of extra
  // attributes like crossorigin="anonymous" on the script tag). ──
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (match) {
    try {
      const data = JSON.parse(match[1]);
      const found = findProductLikeArrays(data?.props?.pageProps || data);
      if (found.length > 0) {
        const baseUrl = url.replace(/\?.*$/, '').replace(/\/$/, '');
        const products = found.map(p => stanProductToStandard(p, baseUrl));
        return { ok: true, products, source: 'stan.store (next)' };
      }
    } catch {
      // fall through to regex fallback
    }
  }

  // ── Path 3: HTML regex fallback ──
  return scrapeStanStoreHtmlFallback(html, url);
}

// Evaluate the `window.__NUXT__=(function(...){...}(...))` IIFE in an
// isolated vm context and return the resulting data structure. Returns
// null if the page doesn't ship a Nuxt blob or eval fails.
//
// We balance parens forward from the first `(` after `window.__NUXT__=`
// to find the IIFE's end, being careful to skip over string literals
// (which can contain unbalanced parens in product descriptions).
function parseNuxtData(html) {
  const marker = 'window.__NUXT__=';
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return null;

  let i = startIdx + marker.length;
  while (i < html.length && /\s/.test(html[i])) i++;
  if (html[i] !== '(') return null;

  // Balanced-paren walk, with string-literal awareness so a `)` inside
  // a description string doesn't close the IIFE prematurely.
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;
  let endIdx = -1;
  for (let j = i; j < html.length; j++) {
    const ch = html[j];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (inString) {
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) { endIdx = j + 1; break; }
    }
  }
  if (endIdx === -1) return null;

  const expr = html.slice(i, endIdx);
  try {
    const ctx = { window: {}, Date, Math, JSON };
    vm.createContext(ctx);
    vm.runInContext(`window.__NUXT__=${expr}`, ctx, { timeout: 2000 });
    return ctx.window.__NUXT__ || null;
  } catch {
    return null;
  }
}

// Walk a parsed Nuxt data tree and pull product entries out of
// `data[0].store.pages`. Each page may or may not be a product — we
// only emit entries where `data.product.title` exists.
function extractNuxtProducts(nuxtData, baseUrl) {
  // The top-level shape is { layout, data: [{ user, store: { pages: [...] } }] }
  const dataArr = Array.isArray(nuxtData?.data) ? nuxtData.data : [];
  const pages = dataArr[0]?.store?.pages;
  if (!Array.isArray(pages) || pages.length === 0) return [];

  const products = [];
  for (const page of pages) {
    const product = nuxtPageToProduct(page, baseUrl);
    if (product) products.push(product);
  }
  return products;
}

// Normalise a single Nuxt page into our standard product shape. Returns
// null if the page doesn't represent a product (e.g. a pure external
// link button with no priced item attached).
function nuxtPageToProduct(page, baseUrl) {
  const product = page?.data?.product;
  if (!product || typeof product.title !== 'string' || !product.title.trim()) return null;

  const price = product.price || {};
  // Prefer sale_amount when on sale; otherwise amount. Both are USD whole
  // numbers (e.g. 78 = $78, 190 = $190) based on observed stan.store data.
  let priceUsd = null;
  const saleAvailable = price.sale_amount_available === true && typeof price.sale_amount === 'number' && price.sale_amount > 0;
  if (saleAvailable) {
    priceUsd = price.sale_amount;
  } else if (typeof price.amount === 'number') {
    priceUsd = price.amount;
  }

  const isMembership = price.membership_duration_available === true ||
    (typeof price.membership_duration === 'number' && price.membership_duration > 0);
  const isFree = priceUsd === 0 || priceUsd == null;
  // Stan.store stores prices natively in USD. We keep the value AS-IS
  // (no EUR conversion) and stamp currency='USD' so the UI displays
  // "$319" instead of "€319". The field name price_eur is legacy.
  const price_eur = isFree ? null : priceUsd;
  const currency = isFree ? null : 'USD';

  const slug = (page.slug || '').replace(/^\//, '');
  const productUrl = slug ? `${baseUrl}/${slug}` : baseUrl;

  const lowerName = product.title.toLowerCase();
  // Tier thresholds use USD bands since Stan.store is USD-native.
  // ($30 / $100 / $500 is roughly equivalent to the EUR bands the
  // creator-side wizard uses — close enough for the LLM to override
  // if it sees stronger evidence.)
  let tier;
  if (isMembership) tier = 'recurring';
  else if (isFree) tier = 'lead_magnet';
  else if (price_eur < 30) tier = 'lead_magnet';
  else if (price_eur < 100) tier = 'low_ticket';
  else if (price_eur < 500) tier = 'mid_ticket';
  else tier = 'high_ticket';

  let format = 'digital product';
  if (isMembership) format = 'community';
  else if (lowerName.includes('bootcamp') || lowerName.includes('cohort') || lowerName.includes('course')) format = 'course';
  else if (lowerName.includes('guide') || lowerName.includes('ebook') || lowerName.includes('pdf')) format = 'ebook';
  else if (lowerName.includes('template') || lowerName.includes('agent') || lowerName.includes('bundle')) format = 'template';
  else if (lowerName.includes('coaching') || lowerName.includes('1-on-1') || lowerName.includes('consultation')) format = 'coaching';
  else if (isFree) format = 'lead magnet';

  return {
    name: product.title.trim(),
    price_eur,
    currency,
    url: productUrl,
    format,
    tier,
    transformation_offered: '',
  };
}

// Regex-only fallback when __NEXT_DATA__ isn't available. Less reliable —
// hits common stan.store DOM patterns but may miss customised layouts.
function scrapeStanStoreHtmlFallback(html, url) {
  // Pattern: product cards typically wrap a name in <h3> / <h4> with a
  // sibling element containing the price. This is heuristic.
  const products = [];
  const cardRe = /<h[34][^>]*>([^<]{3,120})<\/h[34]>[\s\S]{0,400}?\$([\d,.]+)/g;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const name = decodeHtmlEntities(m[1].trim());
    const priceUsd = parseFloat(m[2].replace(/,/g, ''));
    if (Number.isFinite(priceUsd) && name) {
      products.push({
        name,
        // Stan.store is USD-native. Keep the original price + stamp
        // currency so the UI shows "$" instead of fake-converting to "€".
        price_eur: priceUsd,
        currency: 'USD',
        url,
        format: 'digital product',
      });
    }
  }
  if (products.length === 0) {
    return { ok: false, products: [], error: 'stan.store: no __NEXT_DATA__ and HTML fallback found 0 products', source: 'stan.store' };
  }
  return { ok: true, products, source: 'stan.store' };
}

// Walk an arbitrary JSON tree and return arrays whose items look like
// product records. We recognise product shapes by a (name|title) +
// (price|price_cents|amount) pair.
function findProductLikeArrays(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return [];
  if (Array.isArray(node)) {
    const looksLikeProducts = node.length > 0 && node.every(item =>
      item && typeof item === 'object' &&
      (item.name || item.title) &&
      (item.price != null || item.price_cents != null || item.amount != null || item.price_in_cents != null)
    );
    if (looksLikeProducts) return node;
    // Otherwise, recurse into each element looking for nested arrays.
    let acc = [];
    for (const child of node) {
      acc = acc.concat(findProductLikeArrays(child, depth + 1));
    }
    return acc;
  }
  let acc = [];
  for (const key of Object.keys(node)) {
    acc = acc.concat(findProductLikeArrays(node[key], depth + 1));
  }
  return acc;
}

// Normalise a stan.store product record into our standard shape.
function stanProductToStandard(p, baseUrl) {
  const name = (p.name || p.title || '').trim();
  // Stan.store stores price as cents in some schemas, dollars in others.
  // Recognise both.
  let priceUsd = null;
  if (typeof p.price_cents === 'number') priceUsd = p.price_cents / 100;
  else if (typeof p.price_in_cents === 'number') priceUsd = p.price_in_cents / 100;
  else if (typeof p.price === 'number') {
    // Heuristic: > 1000 → assume cents; otherwise dollars
    priceUsd = p.price > 1000 ? p.price / 100 : p.price;
  } else if (typeof p.amount === 'number') {
    priceUsd = p.amount > 1000 ? p.amount / 100 : p.amount;
  }
  const isFree = priceUsd === 0 || priceUsd == null;
  // Stan.store is USD-native. Keep the value as-is and stamp currency
  // so downstream rendering shows "$" not a fake-converted "€".
  const price_eur = isFree ? null : priceUsd;
  const currency = isFree ? null : 'USD';

  // Tier inference — free = lead_magnet, recurring keyword → recurring,
  // otherwise band by price.
  const lower = name.toLowerCase();
  const isRecurring = p.recurring === true ||
    /\bmonth(ly)?\b|\b\/mo\b|membership|community|subscription/i.test(name) ||
    p.billing_period === 'monthly' || p.billing_period === 'month';
  let tier = 'low_ticket';
  if (isFree) tier = 'lead_magnet';
  else if (isRecurring) tier = 'recurring';
  else if (price_eur < 30) tier = 'lead_magnet';
  else if (price_eur < 100) tier = 'low_ticket';
  else if (price_eur < 500) tier = 'mid_ticket';
  else tier = 'high_ticket';

  // Format inference from product attributes when available, otherwise
  // a generic catch-all.
  let format = 'digital product';
  if (isRecurring) format = 'community';
  else if (lower.includes('bootcamp') || lower.includes('cohort') || lower.includes('course')) format = 'course';
  else if (lower.includes('guide') || lower.includes('ebook') || lower.includes('pdf')) format = 'ebook';
  else if (lower.includes('template') || lower.includes('agent')) format = 'template';
  else if (lower.includes('coaching') || lower.includes('1-on-1') || lower.includes('consultation')) format = 'coaching';
  else if (isFree) format = 'lead magnet';

  // Construct product URL — stan.store doesn't always expose deep links
  // in the JSON, so fall back to the storefront URL.
  let productUrl = p.url || p.product_url || p.slug ? (baseUrl + '/' + (p.slug || '').replace(/^\//, '')) : baseUrl;
  if (typeof productUrl !== 'string' || !productUrl.startsWith('http')) {
    productUrl = baseUrl;
  }

  return {
    name: name || '(unnamed product)',
    price_eur,
    currency,
    url: productUrl,
    format,
    tier,
    // Transformation is empty; the LLM step will fill this when it
    // processes the structured product list.
    transformation_offered: '',
  };
}

// Minimal HTML entity decoder — covers the entities stan.store actually
// uses in product names. Avoids pulling in a full library.
function decodeHtmlEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// ─────────────────────────────────────────────────────────────────
// Linktree scraper
// ─────────────────────────────────────────────────────────────────
//
// Linktree is a Next.js app. The entire link list ships in a
// `<script id="__NEXT_DATA__" type="application/json">{...}</script>`
// blob inside the HTML — no IIFE, no eval, just JSON.parse.
//
// The link array lives at `props.pageProps.account.links` (current shape
// since 2023). Each entry has at minimum:
//   { id, type, title, url, position, isActive, ... }
// Types we care about (we keep them all and let the audit's LLM classify):
//   "CLASSIC"          — plain external link
//   "MUSIC"            — audio embed
//   "VIDEO"            — video embed
//   "COMMERCE"         — Linktree's own paid-content tier
//   "SHOP"             — Shopify-style product
//
// We DON'T attempt price/tier inference for Linktree because the link
// titles rarely include prices — the LLM enriches each via web_search
// of the destination URL. We return tier='unknown' so the audit's
// "PRE-DISCOVERED PRODUCTS" block treats them as the LLM's enrichment
// candidates (vs Stan.store entries which arrive with concrete pricing).
//
// Fallback chain:
//   1. Parse __NEXT_DATA__ JSON, read account.links
//   2. Regex over <a class="...sc-...Link..."> patterns (older Linktree)
//   3. Return ok:false so the audit's LLM-with-web_search takes over
//
// Why this matters: Apify's bio-link expander (used as the runtime
// safety net upstream) silently fails on Linktree fairly often
// (rate limit, captcha, DOM change). When that happens we end up with
// "1 URL inspected" and Claude can't web_search a JS-rendered Linktree
// page reliably — the page cards aren't in Google's index. The
// deterministic scraper here closes that gap.

async function scrapeLinktree(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });
  } catch (err) {
    return { ok: false, products: [], error: `linktree fetch failed: ${err.message}`, source: 'linktr.ee' };
  }
  if (!res.ok) {
    return { ok: false, products: [], error: `linktr.ee HTTP ${res.status}`, source: 'linktr.ee' };
  }
  const html = await res.text();

  // Path 1 — __NEXT_DATA__ JSON blob. Linktree ships the tag with
  // additional attributes after type="application/json" (e.g.
  // crossorigin="anonymous"), so the regex must tolerate anything
  // between the id and the closing >.
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (match) {
    try {
      const data = JSON.parse(match[1]);
      // The path varies slightly across Linktree releases. Check the most
      // common locations in order.
      const account = data?.props?.pageProps?.account
        || data?.props?.pageProps?.profile
        || data?.props?.pageProps?.user
        || null;
      const linksRaw = account?.links
        || data?.props?.pageProps?.links
        || [];
      if (Array.isArray(linksRaw) && linksRaw.length > 0) {
        const products = linksRaw
          .filter(l => l && (l.url || l.modifiers?.contactDetails) && l.isActive !== false)
          .map(l => ({
            name: decodeHtmlEntities(l.title || l.label || l.text || 'Untitled link'),
            price_eur: null,            // LLM enriches from URL_PREVIEW of the destination
            currency: null,             // LLM detects from destination preview
            url: l.url || '',
            format: linktreeTypeToFormat(l.type),
            tier: 'unknown',            // LLM classifies
            transformation_offered: '', // LLM fills in
          }))
          .filter(p => p.url && /^https?:\/\//i.test(p.url));
        if (products.length > 0) {
          return { ok: true, products, source: 'linktr.ee (next-data)' };
        }
      }
    } catch {
      // fall through to regex
    }
  }

  // Path 2 — regex over rendered anchor tags. Linktree wraps each card in
  // an <a> tag with both data-testid="LinkButton" and the destination URL.
  // This is brittle (Linktree changes class names regularly) but useful
  // when __NEXT_DATA__ isn't present (rare).
  const anchorMatches = [...html.matchAll(/<a[^>]*data-testid="LinkButton"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi)];
  if (anchorMatches.length > 0) {
    const products = anchorMatches.map(m => ({
      name: decodeHtmlEntities(m[2].replace(/<[^>]+>/g, '').trim()),
      price_eur: null,
      currency: null,
      url: m[1],
      format: 'other',
      tier: 'unknown',
      transformation_offered: '',
    })).filter(p => p.url && p.name);
    if (products.length > 0) {
      return { ok: true, products, source: 'linktr.ee (anchor regex)' };
    }
  }

  return { ok: false, products: [], error: 'No links found in HTML', source: 'linktr.ee' };
}

function linktreeTypeToFormat(type) {
  switch (String(type || '').toUpperCase()) {
    case 'MUSIC':    return 'other';
    case 'VIDEO':    return 'other';
    case 'COMMERCE': return 'other';
    case 'SHOP':     return 'physical_product';
    default:         return 'other';
  }
}
