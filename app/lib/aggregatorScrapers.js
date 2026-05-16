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

// ─────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────

const SCRAPERS = {
  'stan.store': scrapeStanStore,
  // 'linktr.ee':  scrapeLinktree,   // next priority after stan.store
  // 'beacons.ai': scrapeBeacons,    // ditto
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
// Stan.store is a Next.js app that ships full page state as a
// __NEXT_DATA__ JSON blob embedded in the HTML. That blob contains the
// creator's store + every product as structured data, so we don't need
// to render JS. We just fetch the HTML, parse out the script tag, and
// walk the JSON for products.
//
// If the schema shifts or the page no longer ships __NEXT_DATA__, we
// fall back to a regex-based product-card heuristic.
//
// Tier inference — stan.store doesn't tag products with our tier enum,
// so we infer from price:
//   free / no price → lead_magnet
//   < €30           → lead_magnet (small upsells)
//   €30-100         → low_ticket
//   €100-500        → mid_ticket
//   €500+           → high_ticket
//   contains "/mo" or "monthly" / "membership" / "community" → recurring
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

  // Pull __NEXT_DATA__ blob. Format:
  //   <script id="__NEXT_DATA__" type="application/json">{...}</script>
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    // Fallback: regex over product cards in the HTML
    return scrapeStanStoreHtmlFallback(html, url);
  }
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch (err) {
    return { ok: false, products: [], error: `stan.store __NEXT_DATA__ parse failed: ${err.message}`, source: 'stan.store' };
  }

  // The exact path varies between stan.store versions. Walk the entire
  // pageProps object looking for arrays of objects that look like products
  // (have a name + price field). This is defensive against schema drift.
  const found = findProductLikeArrays(data?.props?.pageProps || data);
  if (found.length === 0) {
    return scrapeStanStoreHtmlFallback(html, url);
  }

  const baseUrl = url.replace(/\?.*$/, '').replace(/\/$/, '');
  const products = found.map(p => stanProductToStandard(p, baseUrl));
  return { ok: true, products, source: 'stan.store' };
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
        // Stan.store prices are typically USD. Convert at ~0.92 (rough).
        // Operator can edit via the CRUD if exact conversion matters.
        price_eur: Math.round(priceUsd * 0.92),
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
  // Rough USD→EUR conversion. Good enough for audit purposes; operator
  // can correct via CRUD if precision matters for a high-value pitch.
  const price_eur = isFree ? null : Math.round(priceUsd * 0.92);

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
