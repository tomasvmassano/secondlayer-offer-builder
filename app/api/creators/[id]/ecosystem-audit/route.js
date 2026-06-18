import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { scrapeBioLinks } from '../../../../lib/apify';
import { scrapeKnownAggregators } from '../../../../lib/aggregatorScrapers';
import { fetchUrlPreviews } from '../../../../lib/urlPreview';
import { validateEcosystemAudit, VALID_TIERS, VALID_ROLES } from '../../../../lib/schemas/ecosystemAudit';

// Web_search adds 5-10 tool-use rounds — this can run up to ~90s.
export const maxDuration = 120;

// ─────────────────────────────────────────────────────────────────
// Ecosystem Audit (Phase 1 of the checkpoint wizard).
//
// Maps the creator's existing product ecosystem so the wizard can decide the
// strategic role of the new paid community within their funnel. Output is
// strictly internal — lives under
//   creator.offer.internal_metadata.ecosystem_audit
// and is NEVER rendered to the creator.
//
// Pipeline:
//   1. Collect every URL we already know about (IG multi-link bio, single
//      externalUrl, the Claude-found products from intelligence.bioLinks).
//   2. Resolve aggregator URLs (linktr.ee / beacons.ai / stan.store / ...)
//      via the existing scrapeBioLinks Apify actor.
//   3. Send the deduped URL list + creator context to Claude Sonnet 4 with
//      web_search, asking it to investigate each destination and produce
//      EXACT JSON matching the schema in lib/schemas/ecosystemAudit.js.
//   4. Validate. On failure, retry ONCE with the error list appended to the
//      user message. Surface to the operator on second failure.
//   5. Persist to creator.offer.internal_metadata.ecosystem_audit and return.
// ─────────────────────────────────────────────────────────────────

export async function POST(request, { params }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const creator = await getCreator(id);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    // ── Step 1 + 2: gather + resolve URLs ──
    const seedUrls = new Set();
    if (creator.externalUrl) seedUrls.add(creator.externalUrl);
    const igLinks = creator.platforms?.instagram?.bioLinks || [];
    for (const l of igLinks) {
      if (l?.url) seedUrls.add(l.url);
    }
    const intelLinks = creator.intelligence?.bioLinks || [];
    for (const p of intelLinks) {
      if (p?.url) seedUrls.add(p.url);
    }

    // Aggregator detection — same allowlist scrapeBioLinks uses.
    const AGGREGATORS = ['linktr.ee', 'linktree.com', 'beacons.ai', 'stan.store', 'carrd.co', 'taplink.cc', 'allmylinks.com', 'linkin.bio', 'bio.link', 'linkr.bio'];
    const isAggregator = (u) => AGGREGATORS.some(d => String(u).toLowerCase().includes(d));

    const finalUrls = [];          // [{ url, source, title? }]
    const aggregatorsSeen = [];
    const aggregatorResolutionDiag = []; // { url, resolved_count, kept_aggregator }
    for (const u of seedUrls) {
      if (isAggregator(u)) {
        aggregatorsSeen.push(u);
        const result = await scrapeBioLinks(u).catch(() => ({ links: [], email: null }));
        const resolved = result?.links || [];
        for (const r of resolved) {
          if (r.url) finalUrls.push({ url: r.url, source: u, title: r.title || '' });
        }
        // Safety net: when Apify returns 0 destinations (rate limit, timeout,
        // format change, captcha), keep the aggregator URL itself in the
        // inspection pool so the LLM still has something to web_search and
        // the deterministic scraper still has something to fetch. Otherwise
        // we end up with "0 urls inspected" and an empty audit.
        if (resolved.length === 0) {
          finalUrls.push({ url: u, source: 'direct', title: '(aggregator — Apify returned 0)' });
        }
        aggregatorResolutionDiag.push({ url: u, resolved_count: resolved.length, kept_aggregator: resolved.length === 0 });
      } else {
        // Find the title from the IG multi-link bio if present
        const known = igLinks.find(l => l.url === u);
        finalUrls.push({ url: u, source: 'direct', title: known?.title || '' });
      }
    }

    // Dedupe by URL
    const seen = new Set();
    const dedupedUrls = [];
    for (const item of finalUrls) {
      const key = String(item.url).replace(/\/$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      dedupedUrls.push(item);
    }

    // ── Step 2.5: deterministic aggregator scrape ──
    // For known aggregators with predictable structure (stan.store first;
    // linktr.ee / beacons.ai later) we extract products directly from the
    // page's __NEXT_DATA__ / HTML instead of asking the LLM to enumerate.
    // The LLM is unreliable at exhaustive enumeration of 8+ product cards
    // on a single page — it summarises and skips. Deterministic scrape
    // fixes that. Result: products feed into the LLM as a "preDiscovered"
    // list with names+prices already known; LLM's job becomes tier
    // classification + transformation copy, not discovery.
    //
    // Scrape the union of seed URLs + resolved destinations so a
    // linktr.ee → stan.store chain still triggers the stan.store scraper.
    const scrapeTargets = Array.from(new Set([
      ...seedUrls,
      ...finalUrls.map(f => f.url),
    ]));
    const aggregatorScrape = await scrapeKnownAggregators(scrapeTargets);
    const preDiscoveredProducts = aggregatorScrape.products;

    // ── Step 2.75: server-side URL previews ──
    // For URLs that fall through the aggregator scrapers (personal sites,
    // Substack, Skool, Whop, Patreon, custom paywall landing pages…) we
    // fetch the HTML ourselves and pull title + meta description +
    // visible text + any price-like strings. Without this the LLM relies
    // on web_search alone, which is unreliable for paywalled or
    // JS-rendered content (the price usually lives on a subpage). Cheap
    // and parallel — ~5s for 5 URLs, no LLM cost.
    //
    // Skip aggregator URLs that we've already deterministically scraped
    // (preDiscoveredProducts covers them) and obvious dead-end domains
    // (instagram.com, tiktok.com, youtube.com — those are creators' own
    // social handles, not products).
    const SOCIAL_DOMAINS = ['instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'facebook.com'];
    const previewTargets = dedupedUrls
      .map(u => u.url)
      .filter(u => {
        try {
          const host = new URL(u).hostname.toLowerCase().replace(/^www\./, '');
          if (SOCIAL_DOMAINS.some(d => host === d || host.endsWith('.' + d))) return false;
          // If we already pre-discovered products from this URL via the
          // deterministic scraper, skip preview to save bandwidth.
          if (aggregatorScrape.scrapedUrls?.includes(u)) return false;
          return true;
        } catch { return false; }
      });
    const urlPreviews = await fetchUrlPreviews(previewTargets);
    const urlPreviewsWithSignal = urlPreviews.filter(p => p && (p.title || p.description || p.textExcerpt || p.priceHints?.length));

    // ── Step 3: ask Claude ──
    const audit = await runAudit(apiKey, creator, dedupedUrls, aggregatorsSeen, preDiscoveredProducts, urlPreviewsWithSignal);
    if (audit.error) {
      // Persist failure diagnostics so the next debug session has the raw
      // model output + the failure reason. Without this we lose the
      // evidence the moment the response is sent.
      try {
        const existingOffer = creator.offer || {};
        const existingMeta = existingOffer.internal_metadata || {};
        await updateCreator(id, {
          offer: {
            ...existingOffer,
            internal_metadata: {
              ...existingMeta,
              ecosystem_audit_diagnostics: {
                error: audit.error,
                errors: audit.errors || [],
                // Trim to 8KB — enough to debug, not enough to blow up Redis values.
                raw_excerpt: (audit.raw || '').slice(0, 8000),
                seed_urls: seedUrls.size,
                aggregators_resolved: aggregatorsSeen.length,
                aggregator_resolution: aggregatorResolutionDiag,
                final_urls_inspected: dedupedUrls.length,
                deterministic_scrape: aggregatorScrape.diagnostics,
                pre_discovered_count: preDiscoveredProducts.length,
                retries: audit.retries,
                ran_at: new Date().toISOString(),
              },
            },
          },
        });
      } catch { /* persistence is best-effort, don't fail the response */ }
      return NextResponse.json({ error: audit.error, errors: audit.errors, raw: audit.raw }, { status: 502 });
    }

    // ── Step 5: persist ──
    // Diagnostics persisted alongside the audit so the bulk-audit page (and
    // anyone debugging "why did this creator come back empty?") can see
    // exactly which step dropped products. Without this we re-run audits
    // blind.
    const diagnostics = {
      seed_urls: seedUrls.size,
      aggregators_resolved: aggregatorsSeen.length,
      aggregator_resolution: aggregatorResolutionDiag,
      final_urls_inspected: dedupedUrls.length,
      deterministic_scrape: aggregatorScrape.diagnostics,
      pre_discovered_count: preDiscoveredProducts.length,
      // URL-preview step (fetched server-side, fed as ground-truth context
      // to the LLM). Per-URL summary lets the operator see WHICH URLs
      // contributed signal and which failed.
      url_previews: urlPreviewsWithSignal.map(p => ({
        url: p.url,
        title: p.title || '',
        priceHints: p.priceHints || [],
        had_text: !!p.textExcerpt,
        error: p.error || null,
      })),
      url_previews_count: urlPreviewsWithSignal.length,
      retries: audit.retries,
      products_returned: audit.data?.ecosystem_map?.products_found?.length || 0,
      communities_returned: audit.data?.ecosystem_map?.existing_communities?.length || 0,
      ran_at: new Date().toISOString(),
    };
    const existingOffer = creator.offer || {};
    const existingMeta = existingOffer.internal_metadata || {};
    const updated = await updateCreator(id, {
      offer: {
        ...existingOffer,
        internal_metadata: {
          ...existingMeta,
          ecosystem_audit: audit.data,
          ecosystem_audit_diagnostics: diagnostics,
          generation_timestamps: {
            ...(existingMeta.generation_timestamps || {}),
            ecosystem_audit: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      ecosystem_audit: audit.data,
      _diagnostics: diagnostics,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Audit failed' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// Claude call wrapper with schema validation + one retry.
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `# ECOSYSTEM AUDIT — Product Mapping for Community Strategy

You analyze a content creator's existing product ecosystem and decide the strategic role a paid community would play within it. Your output is structured JSON used by an internal system — NEVER shown to the creator.

## TASK

Given a list of URLs (Instagram bio links, Linktree pages, external sites, etc.), investigate each one using web_search. For each product/service you find, extract its name, price, format, and the transformation it promises.

## AGGREGATOR PAGE EXHAUSTIVENESS — DO NOT SKIP CARDS

Some URLs in the input are link-in-bio aggregator pages: linktr.ee/<handle>, beacons.ai/<handle>, stan.store/<handle>, koji.com/<handle>, taplink.cc/<handle>, allmylinks.com/<handle>, bio.link/<handle>, carrd.co.

These pages contain MANY product/link cards (typically 5-15). Failure mode you must avoid: scanning the page, listing the 2-3 most prominent cards, and moving on. That is wrong. You MUST enumerate EVERY card.

Required behavior for any aggregator URL:
  1. Do a web_search on the aggregator URL itself.
  2. Count the product cards visible on that page.
  3. For EACH card, do an additional web_search on the individual product URL (the click-through destination) to get exact name + price + transformation. Do not infer — fetch.
  4. Report EVERY card as a separate entry in products_found. Skipping a card because it "looks like a duplicate" or "is just a freebie" or "is the same as another product" is wrong. List them all.

If the aggregator page renders product names that match items in the PRE-DISCOVERED PRODUCTS block (when present), do NOT duplicate them — the deterministic scraper already captured those. Only add cards the scraper missed (rare, but possible if the scraper had a partial failure).

How many products should you typically find on each aggregator?
  - stan.store storefront: 5-12 products
  - linktr.ee: 5-20 links (many are social, not products — filter to commerce-only)
  - beacons.ai: 5-15
If your final products_found list contains fewer items than the page visibly shows, you've failed.

## REQUIRED ADDITIONAL DISCOVERY — scale to URL density

The creator's bio links DO NOT necessarily list everything they sell. The hub team has been burned by missing existing communities (e.g. a creator with a Skool community at a custom domain that wasn't in their bio). Use these additional web_search queries before producing output:

  1. '"[creator name]" community'        — finds branded community pages, custom domains, etc.
  2. '"[creator name]" skool OR whop'    — finds Skool/Whop-hosted communities
  3. '"[creator name]" membership OR newsletter premium' — finds paid memberships/Substack-style products

**HOW MANY TO RUN** — scale to the URL list you were given:
  - 0–2 input URLs (sparse bio): run ALL THREE — the bio probably hides a community.
  - 3–4 input URLs: run #1 (community) ONLY — the bio is meaty enough that the other two are usually redundant.
  - 5+ input URLs: SKIP all three — the bio is dense, run them only if your URL-inspection turned up zero commerce signals.

This scaling matters: every extra web_search consumes 500–2000 tokens of result text, and dense-bio creators were exhausting the output budget before the JSON could complete. The community-search (#1) is the highest-value of the three since missed communities are the most expensive failure for the downstream wizard.

Replace [creator name] with the actual creator name from the input. If the creator is well-known by a brand name as well (e.g. "Late Checkout" for Greg Isenberg), run the brand-name variant of #1 too.

Anything you find via these searches MUST be added to products_found and (if it's a community) to existing_communities.

## CRITICAL — IDENTITY VERIFICATION (avoid same-first-name false positives)

Common failure mode: web_search returns a different creator with the same first name and you include their products as if they belonged to OUR creator. Example: pitching "Mariah Brunner" — web_search for "Mariah community" returns Mariah Coz's "Profit Architecture" Skool, and the audit mistakenly attributes it to Mariah Brunner.

Before adding ANY product or community to the output, VERIFY ownership by at least one of:

  1. The URL belongs to a domain or platform handle owned by THIS creator (e.g. for Mariah Brunner: stan.store/mariahbrunner, theaiincomelabs.com, instagram.com/itsmariahbrunner). NOT skool.com/some-other-mariah.

  2. The product page or community description explicitly references THIS creator's FULL name (first + last). A page that says "by Mariah Coz" is NOT proof of ownership when pitching "Mariah Brunner".

  3. The page links back to one of the creator's verified social profiles (their Instagram, TikTok, YouTube as listed in the input).

If you find a candidate but cannot verify via at least one of the three rules above, OMIT IT. A missing product is recoverable (operator can add it manually). A wrong product is corrupting — it derails the wizard's tier logic and produces a pitch deck citing assets that don't belong to the creator.

Names alone are NEVER sufficient. "First name + niche match" is NEVER sufficient. Verify the URL/page reference.

## TIER CLASSIFICATION

Classify each product into EXACTLY ONE of these tiers:
- lead_magnet: free or under €10, designed to capture leads (free newsletters, mini-PDFs, free trials)
- low_ticket: €10-100 — ebooks, templates, mini-courses, one-off small products
- mid_ticket: €100-500 — proper courses, workshops, small-group programs
- high_ticket: €500+ — 1-on-1 coaching, masterminds, large programs, certifications
- recurring: subscription pricing (€X/month or €X/year regardless of total) — communities, memberships, SaaS
- service: done-for-you / 1-on-1 paid per project (not coaching). Consulting one-off, ad management retainers, design work, etc.
- physical_product: any physical good (book, hardware, merch)

If price isn't visible after web_search, set price_eur to null and rely on format + transformation to classify the tier (a "1-on-1 mentorship" with no published price is high_ticket; a "free newsletter" is lead_magnet).

## CURRENCY — DO NOT CONVERT

When a product's price is visible, record the NUMBER in price_eur AS-IS in its original currency (the field name is legacy; the value is whatever currency the creator charges) and set the \`currency\` field to one of: 'EUR', 'USD', 'GBP'.

Examples:
  - "$49/month" on a US creator's site  →  price_eur: 49, currency: 'USD'
  - "€19/mês" on a Portuguese creator    →  price_eur: 19, currency: 'EUR'
  - "£29 one-off" on a UK creator        →  price_eur: 29, currency: 'GBP'
  - "$319" on a Stan.store storefront    →  price_eur: 319, currency: 'USD'

NEVER convert between currencies. If you see "$49", do NOT multiply by 0.92 to get €45 — store 49 + USD. The creator charges in USD, the checkout charges in USD, the operator needs to see USD. Converting introduces error and breaks the offer-pricing math downstream.

When the currency isn't visible (price hint shows just a number without a symbol), default to EUR if the creator's domain is .pt / .es / .fr / .de / European Substack / Portuguese-language content; default to USD if the storefront is on Stan.store / Gumroad / Beehiiv with USD-default pricing; default to USD otherwise. When in doubt, default USD and flag it in transformation_offered (e.g. "USD assumed — verify"). Do NOT guess EUR by default.

## STRATEGIC ROLE

The hub team is building this creator a paid monthly community. Pick ONE role for it:

- entry_point: creator already has a high_ticket product (€500+). The community is a warm-up funnel — members later get pitched the high-ticket. Use when there's already mature high-ticket and the audience needs nurturing before they pay 4-figures.
- continuity: creator has mid_ticket courses/workshops sold one-off but NO recurring product. The community keeps members engaged after they buy a course, generating recurring revenue. Use when creator already converts but loses members after one purchase.
- premium_upsell: creator only has low_ticket products and no premium offer. The community becomes the premium tier of their catalog. Use when creator monetises cheaply and has clear room above their existing price points.
- standalone: creator has no structured products (or only lead magnets). The community is their first real offer.

## OUTPUT — EXACT JSON SCHEMA

Return ONLY this JSON. No markdown code fences. No commentary. No prefix or suffix:

{
  "ecosystem_map": {
    "products_found": [
      {
        "name": "string",
        "price_eur": number_or_null,
        "currency": "EUR|USD|GBP",
        "format": "course|ebook|coaching|app|service|book|physical_product|newsletter|community|template|other",
        "tier": "lead_magnet|low_ticket|mid_ticket|high_ticket|recurring|service|physical_product",
        "url": "string",
        "transformation_offered": "string (1 specific outcome sentence)"
      }
    ],
    "existing_communities": [
      {
        "name": "string",
        "price_eur": number_or_null,
        "currency": "EUR|USD|GBP",
        "tier": "lead_magnet|low_ticket|mid_ticket|high_ticket|recurring|service|physical_product",
        "format": "string (e.g. 'Skool community', 'Whop monthly', 'private Discord')",
        "url": "string (optional, '' if not crawlable)"
      }
    ],
    "community_cannibalization_risk": "high|medium|low|none",
    "has_high_ticket": boolean,
    "has_mid_ticket": boolean,
    "has_recurring": boolean,
    "ecosystem_completeness_score": number_0_to_100
  },
  "strategic_role": "entry_point|continuity|premium_upsell|standalone",
  "strategic_role_reasoning": "string (max 2 sentences)",
  "cannibalization_constraints": ["string", ...],
  "synergy_opportunities": ["string", ...]
}

## ecosystem_completeness_score (0-100)

- 0-25: no products / only lead magnets
- 26-50: 1-2 low-ticket products, no funnel
- 51-75: low + mid OR low + high (gap somewhere)
- 76-100: lead magnet + low + mid + high + recurring (complete ladder)

## existing_communities + community_cannibalization_risk — READ CAREFULLY

A community offer (Skool, Whop, paid Discord, paid Circle, paid Patreon at >€5/mo, etc.) that the creator ALREADY sells is the #1 cannibalization risk for the offer we are about to build for them. The wizard's CP1 strategic_frame uses these two fields to decide whether to FORBID matching tiers.

**existing_communities**: every CURRENTLY-SELLING community the creator runs. Pull from web_search results — look for Skool URLs, Whop URLs, "join the community", "exclusive group", paid Patreon tiers, etc. Each entry needs name + price_eur + tier + format. Use [] if none.

DO NOT confuse one-time courses or 1-on-1 services for communities — only count offers with ongoing access + recurring or paid-membership pricing.

**community_cannibalization_risk**:
- "high"   — creator already runs a community at the SAME tier the new offer would target (e.g. their existing community is low_ticket and the obvious play is also low_ticket)
- "medium" — creator runs a community at an ADJACENT tier (e.g. existing mid_ticket; new offer might land low or high)
- "low"    — creator has a community but in a clearly different tier band or different audience
- "none"   — creator has no community offer at all

When risk is "high", the strategic_role field MUST be set to a role that puts the new offer at a DIFFERENT tier than the existing community. Specifically:
- Existing low_ticket community  →  strategic_role: premium_upsell  (new offer at mid or high tier — advanced track for graduates)
- Existing mid_ticket community  →  strategic_role: standalone OR entry_point (different audience / lower tier as feeder)
- Existing high_ticket community →  strategic_role: entry_point (lower-tier funnel-feeder)

If risk is "high" and you still pick strategic_role: continuity at the same tier, you have FAILED the task.

## cannibalization_constraints

For each existing product the community could overlap with, write what promise the community must NOT make. Reference the existing product by name. Examples:
- "Cannot promise 1-on-1 access — that's part of the €1500 Strategy Session"
- "Cannot include full course content — Notion Template (€47) already teaches the system"

Empty array [] if there's no overlap risk.

## synergy_opportunities

How the community can feed sales of existing products. Reference existing products by name. Examples:
- "Founders Circle tier auto-promotes members into the Strategy Session funnel"
- "Library content references the Notion Template purchase as the next step"

Empty array [] if standalone.

## HARD RULES

1. NEVER invent products. Only report what web_search actually confirms exists on each URL.
2. Flag consistency:
   - has_high_ticket MUST be true iff products_found contains at least one product with tier='high_ticket'.
   - has_mid_ticket MUST be true iff products_found contains at least one product with tier='mid_ticket'.
   - has_recurring MUST be true iff EITHER (a) products_found contains a product with tier='recurring' OR (b) existing_communities is non-empty. Paid communities are subscription-based by definition — even if you classify a particular community as 'mid_ticket' (e.g. annual flat fee), has_recurring is still true because there's an ongoing-access offer.
3. If a URL is a 404 / parked / private / errored, OMIT it from products_found rather than including a placeholder.
4. Run the REQUIRED ADDITIONAL DISCOVERY queries scaled to URL density (see that section). With 5+ input URLs, default is to skip them.
5. Output must be VALID JSON. No surrounding text. No explanation.`;

async function runAudit(apiKey, creator, urls, aggregatorsSeen, preDiscoveredProducts = [], urlPreviews = [], retryCount = 0) {
  const creatorContext = [
    `Creator: ${creator.name || 'Unknown'}`,
    `Niche: ${creator.niche || 'Unknown'}`,
    `Primary platform: ${creator.primaryPlatform || 'Instagram'}`,
    `IG followers: ${creator.platforms?.instagram?.followers || 0}`,
    `TT followers: ${creator.platforms?.tiktok?.followers || 0}`,
    `YT subs: ${creator.platforms?.youtube?.subscribers || 0}`,
    `Bio: ${(creator.bio || '').slice(0, 280)}`,
    `Existing reputation notes: ${(creator.reputation || 'None').slice(0, 200)}`,
  ].join('\n');

  const urlList = urls.length > 0
    ? urls.map((u, i) => `${i + 1}. ${u.url}${u.title ? `  — labelled "${u.title}"` : ''}${u.source !== 'direct' ? `  (from aggregator ${u.source})` : ''}`).join('\n')
    : '(no public links discovered)';

  // Resolve the creator's social handles so the LLM has concrete anchors
  // when it does identity-verification on web_search results. Otherwise it
  // doesn't know what counts as "this creator's domain".
  const igHandle = (creator.platforms?.instagram?.url || '').match(/instagram\.com\/([^/?#]+)/i)?.[1] || '';
  const tkHandle = (creator.platforms?.tiktok?.url || '').match(/tiktok\.com\/@?([^/?#]+)/i)?.[1] || '';
  const ytHandle = (creator.platforms?.youtube?.url || '').match(/(?:youtube\.com\/(?:@|c\/|user\/))([^/?#]+)/i)?.[1] || '';
  const ownedHandles = [igHandle && `@${igHandle} (IG)`, tkHandle && `@${tkHandle} (TT)`, ytHandle && `@${ytHandle} (YT)`].filter(Boolean).join(', ') || '(none)';

  // Inject deterministically-scraped products into the prompt as "already
  // verified" entries the model should include unchanged. The model's job
  // for these is enrichment (tier classification + transformation copy),
  // not discovery — that's already done.
  const preDiscoveredBlock = preDiscoveredProducts.length > 0
    ? `## PRE-DISCOVERED PRODUCTS (already verified by deterministic scraper — INCLUDE ALL OF THESE)

These products were extracted directly from the aggregator HTML (stan.store __NEXT_DATA__, linktr.ee __NEXT_DATA__, etc.) and have been verified to belong to THIS creator. Include EVERY ONE in products_found. The scraper gave you name + URL + (sometimes) price + a tentative tier — your job for these is to:
  - Keep name + url AS-IS unless you have stronger evidence
  - Add a transformation_offered field (1 sentence describing the outcome)
  - Verify the tier matches our enum and adjust ONLY if obviously wrong

**CRITICAL — cross-reference URL_PREVIEWS for prices when price_eur is null:**
Many pre-discovered products (especially from Linktree) arrive with \`price_eur: null\` because the aggregator scraper only captures name + URL. The URL_PREVIEWS block below DOES contain the actual price for these products — fetched server-side from the destination page (Hotmart checkout, Substack pricing page, etc.). For each pre-discovered product:
  1. Find the URL_PREVIEW entry whose URL matches the product's URL (match by domain + path, ignore query strings).
  2. If the preview has \`priceHints\`, use the first numeric value as the product's price_eur AND detect the currency from the symbol/code in the hint:
       - "$49", "$49 /month", "49 USD"      → price_eur: 49, currency: 'USD'
       - "€19", "19,99 €", "19 EUR"          → price_eur: 19, currency: 'EUR' (or 19.99)
       - "£29", "29 GBP"                     → price_eur: 29, currency: 'GBP'
     Do NOT convert — preserve the original currency. The field name "price_eur" is legacy; the value is the amount in the original currency, and the \`currency\` field tells the UI which symbol to render.
  3. Example: pre-discovered product { name: "Ebook X", url: "pay.hotmart.com/ABC?bid=123", price_eur: null }; URL_PREVIEW priceHints: ["5,29 €"] → price_eur: 5.29, currency: 'EUR'.
  4. Example: pre-discovered product { name: "UGC Method", url: "stan.store/rachmartinez/...", price_eur: null }; URL_PREVIEW priceHints: ["$319"] → price_eur: 319, currency: 'USD' (NOT 293.48).

If both the scraper and the URL preview have prices, prefer the URL preview (it's the live page; the scraper may have stale data).

You may add ADDITIONAL products beyond this list (from URLs not covered by the scraper, from web_search), but you may NOT drop any of these.

${preDiscoveredProducts.map((p, i) => `${i + 1}. name: ${p.name}
   price_eur: ${p.price_eur}
   currency (tentative): ${p.currency || '(unknown — detect from URL_PREVIEW)'}
   url: ${p.url}
   format: ${p.format}
   tier (tentative): ${p.tier}`).join('\n\n')}

`
    : '';

  // Page-preview block — title + meta description + visible text + price
  // hints we fetched server-side. This is what closes the gap for URLs
  // that don't expose products via web_search alone (personal sites,
  // Substack, Skool, Patreon, custom paywall pages, etc.). For each URL
  // the model gets the actual page text — it no longer has to guess from
  // search snippets.
  const previewsBlock = urlPreviews.length > 0
    ? `## URL PREVIEWS (server-fetched HTML — use this BEFORE web_search)

For each URL in the input list, we fetched the page server-side and pulled the title, meta description, visible text, and any price-like substrings. We ALSO followed up to 2 pricing-related sub-pages per primary URL (look for "Discovered from: ..." in the entries below) — that's how we surface $X/month pricing when the homepage doesn't show it but /pricing does.

Use these previews as your PRIMARY source for product details. Only fall through to web_search when the preview is missing pricing AND a follow-up sub-page wasn't auto-discovered.

The previews are GROUND TRUTH for what THIS creator publishes — they came from THIS creator's own bio URLs (or sub-pages of those URLs). Identity-verification does NOT apply to anything in these previews.

**When a preview has \`Discovered from: X\`, treat it as enriching the primary URL X**. Example: primary URL is valuebyraph.com (homepage, no price visible); a follow-up preview for valuebyraph.com/pricing/ contains "$49/month" — that's the price for the Pro tier of the SAME creator. Attribute it to that product, not to a new product.

${urlPreviews.map((p, i) => {
  const lines = [`${i + 1}. ${p.url}`];
  if (p.sourceUrl) lines.push(`   Discovered from: ${p.sourceUrl} (followed pricing-related link)`);
  if (p.error) {
    lines.push(`   (fetch error: ${p.error} — try web_search instead)`);
    return lines.join('\n');
  }
  if (p.title) lines.push(`   Title: ${p.title}`);
  if (p.description) lines.push(`   Description: ${p.description}`);
  if (p.priceHints?.length) lines.push(`   Price hints found: ${p.priceHints.join(' | ')}`);
  if (p.textExcerpt) lines.push(`   Page text (first ~2500 chars):\n   "${p.textExcerpt.slice(0, 2500)}"`);
  return lines.join('\n');
}).join('\n\n')}

`
    : '';

  const userMessage = `Investigate this creator's existing product ecosystem and return the JSON per the schema in your system prompt.

## CREATOR
${creatorContext}

## OWNED HANDLES (for identity verification)
${ownedHandles}

## URL PROVENANCE
The URLs under "URLS TO INSPECT" come from THIS creator's own IG bio (externalUrl + multi-link bio). They are owned by definition. The identity-verification rule applies ONLY to extras you find via web_search, NOT to these input URLs. If an aggregator shows "(aggregator — Apify returned 0)", web_search the aggregator URL directly and list every visible product card.

${preDiscoveredBlock}${previewsBlock}## URLS TO INSPECT — count: ${urls.length}
Use the URL PREVIEWS above as your primary source. Only run web_search when a URL preview is missing or when you need to follow a subpage hinted at by the preview (e.g. preview shows "Pricing" / "Pro" nav links — search for the price page).
Per the URL-density rule in your system prompt: ${urls.length >= 5 ? 'this is DENSE (5+) — SKIP the 3 additional discovery searches unless URL inspection turns up zero commerce signals.' : urls.length >= 3 ? 'this is MEDIUM (3-4) — run ONLY the community-search (#1), skip #2 and #3.' : 'this is SPARSE (0-2) — run ALL THREE additional discovery searches.'}
${urlList}

${aggregatorsSeen.length > 0 ? `## AGGREGATORS RESOLVED\nThese aggregator URLs were already resolved; their destinations appear in URLS above:\n${aggregatorsSeen.map(a => `- ${a}`).join('\n')}\n\n` : ''}## OUTPUT
Return ONLY the JSON object matching the schema in your system prompt. Start your response with { and end with }. No code fences. No commentary before or after. No "Here's the analysis" preamble. JSON only.`;

  // Anthropic call wrapped so we can retry on 429 (rate limit). The Hobby
  // plan caps at 30k tokens/min — bulk-import's auto-audit can fire 3+ of
  // these per minute, so 429s are expected. The dm-writer route handles
  // 429s the same way; mirroring the pattern here keeps the auto-audit
  // pipeline resilient without a server-side queue.
  const callAnthropic = () => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      // 4000 → 8000 (2026-05-19) → 12000 (2026-05-20) → 6000 (2026-06-18).
      // The 12000 ceiling was burning ~$0.40-0.50 per audit with Sonnet 4.5
      // filling the budget. 6000 still fits the JSON for the
      // overwhelming majority of creators and slashes per-call cost by
      // ~50%. If a specific dense-bio creator truncates at 6K, the
      // operator can retry — cheaper than paying the bloat for every
      // run, and the validator now FAILS FAST instead of doing a second
      // 4000-token retry call (~$0.06 extra per audit saved).
      max_tokens: 6000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  let resp = await callAnthropic();
  let data = await resp.json();
  if (resp.status === 429) {
    // Sleep ~65s (just past the 60s window) then try once more. If that
    // also 429s, surface to the caller so the auto-audit worker can mark
    // the row 'failed' and the operator can re-queue manually.
    await new Promise(r => setTimeout(r, 65000));
    resp = await callAnthropic();
    data = await resp.json();
  }
  if (!resp.ok) {
    return { error: data.error?.message || `Anthropic ${resp.status}`, errors: [], raw: null, retries: retryCount };
  }

  // Concat all text blocks (web_search produces tool_use + tool_result + final text)
  const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const parsed = tryParseJson(rawText);
  if (!parsed) {
    if (retryCount < 1) {
      return runAudit(apiKey, creator, urls, aggregatorsSeen, preDiscoveredProducts, urlPreviews, retryCount + 1);
    }
    return { error: 'Model returned non-JSON output after retry', raw: rawText, errors: [], retries: retryCount };
  }

  const validation = validateEcosystemAudit(parsed);
  if (!validation.valid) {
    // Validation-failure retry was removed 2026-06-18 as part of an
    // emergency cost-reduction pass. Each retry fired another
    // ~$0.10-0.15 Anthropic call (4000 tokens + web_search rounds)
    // even when the original output was 95% correct. Now: fail fast,
    // return the validator errors to the operator, let them re-run
    // manually if needed. Net per-audit cost halved.
    if (false) {
      // legacy retry block — preserved for one commit so we can revive
      // if fail-fast turns out too aggressive.
      const retryResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [
            { role: 'user', content: userMessage },
            { role: 'assistant', content: rawText },
            { role: 'user', content: `Your output failed schema validation. Fix and resend ONLY the JSON.\n\nErrors:\n${validation.errors.map(e => '- ' + e).join('\n')}` },
          ],
        }),
      });
      const retryData = await retryResp.json();
      if (retryResp.ok) {
        const retryText = (retryData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
        const retryParsed = tryParseJson(retryText);
        if (retryParsed) {
          const retryValidation = validateEcosystemAudit(retryParsed);
          if (retryValidation.valid) return { data: retryParsed, retries: retryCount + 1 };
          return { error: 'Schema validation failed twice', errors: retryValidation.errors, raw: retryText, retries: retryCount + 1 };
        }
      }
    }
    return { error: 'Schema validation failed', errors: validation.errors, raw: rawText, retries: retryCount };
  }

  return { data: parsed, retries: retryCount };
}

// Extract the first valid JSON object from the model's text output. The model
// SHOULD return raw JSON but we strip markdown fences defensively in case it
// wraps with ```json...```.
function tryParseJson(text) {
  if (!text) return null;
  let s = String(text).trim();
  // Strip ```json or ``` fences if present
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // Find the first { and the matching closing }
  const start = s.indexOf('{');
  if (start === -1) return null;
  // Walk to find the matching brace
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(s.slice(start, i + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
}
