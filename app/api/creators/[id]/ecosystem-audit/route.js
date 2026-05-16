import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { scrapeBioLinks } from '../../../../lib/apify';
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
    for (const u of seedUrls) {
      if (isAggregator(u)) {
        aggregatorsSeen.push(u);
        const resolved = await scrapeBioLinks(u).catch(() => []);
        for (const r of resolved) {
          if (r.url) finalUrls.push({ url: r.url, source: u, title: r.title || '' });
        }
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

    // ── Step 3: ask Claude ──
    const audit = await runAudit(apiKey, creator, dedupedUrls, aggregatorsSeen);
    if (audit.error) {
      return NextResponse.json({ error: audit.error, errors: audit.errors, raw: audit.raw }, { status: 502 });
    }

    // ── Step 5: persist ──
    const existingOffer = creator.offer || {};
    const existingMeta = existingOffer.internal_metadata || {};
    const updated = await updateCreator(id, {
      offer: {
        ...existingOffer,
        internal_metadata: {
          ...existingMeta,
          ecosystem_audit: audit.data,
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
      _diagnostics: {
        seed_urls: seedUrls.size,
        aggregators_resolved: aggregatorsSeen.length,
        final_urls_inspected: dedupedUrls.length,
        retries: audit.retries,
      },
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

## REQUIRED ADDITIONAL DISCOVERY — DO THIS EVEN IF THE URL LIST IS COMPLETE

The creator's bio links DO NOT necessarily list everything they sell. The hub team has been burned by missing existing communities (e.g. a creator with a Skool community at a custom domain that wasn't in their bio). To prevent this, you MUST perform at minimum these THREE additional web_search queries before producing output, and incorporate anything you find:

  1. '"[creator name]" community'        — finds branded community pages, custom domains, etc.
  2. '"[creator name]" skool OR whop'    — finds Skool/Whop-hosted communities
  3. '"[creator name]" membership OR newsletter premium' — finds paid memberships/Substack-style products

Replace [creator name] with the actual creator name from the input. If the creator is well-known by a brand name as well (e.g. "Late Checkout" for Greg Isenberg, "The AI Income Labs" for Mariah Brunner), run the brand-name variant too.

Anything you find via these searches MUST be added to products_found and (if it's a community) to existing_communities. This is non-negotiable — a missed existing community is the most expensive failure mode for the downstream wizard.

DO NOT skip these searches even if the URL list seems comprehensive. Bio links are routinely incomplete.

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
2. has_high_ticket / has_mid_ticket / has_recurring MUST be true iff products_found contains at least one product of that tier. Be consistent.
3. If a URL is a 404 / parked / private / errored, OMIT it from products_found rather than including a placeholder.
4. Run the REQUIRED ADDITIONAL DISCOVERY queries before producing output. Missing an existing community is the worst failure mode.
5. Output must be VALID JSON. No surrounding text. No explanation.`;

async function runAudit(apiKey, creator, urls, aggregatorsSeen, retryCount = 0) {
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

  const userMessage = `Investigate this creator's existing product ecosystem and return the JSON per the schema in your system prompt.

## CREATOR
${creatorContext}

## URLS TO INSPECT (use web_search on each)
${urlList}

${aggregatorsSeen.length > 0 ? `## AGGREGATORS RESOLVED\nThe following aggregator URLs were already resolved and their destinations appear in the URLS list above (so you don't need to re-scrape them):\n${aggregatorsSeen.map(a => `- ${a}`).join('\n')}\n\n` : ''}Return ONLY the JSON object. No code fences, no preamble.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    return { error: data.error?.message || `Anthropic ${resp.status}`, errors: [], raw: null, retries: retryCount };
  }

  // Concat all text blocks (web_search produces tool_use + tool_result + final text)
  const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const parsed = tryParseJson(rawText);
  if (!parsed) {
    if (retryCount < 1) {
      return runAudit(apiKey, creator, urls, aggregatorsSeen, retryCount + 1);
    }
    return { error: 'Model returned non-JSON output after retry', raw: rawText, errors: [], retries: retryCount };
  }

  const validation = validateEcosystemAudit(parsed);
  if (!validation.valid) {
    if (retryCount < 1) {
      // Retry once with the validation errors fed back to the model.
      const retryResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          system: SYSTEM_PROMPT,
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
