import { NextResponse } from 'next/server';
import { repairJsonWithHaiku } from '../../../../lib/jsonRepair';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { validateArchetype, VALID_ARCHETYPES, VALID_FAME_TIERS } from '../../../../lib/schemas/archetype';

// web_search adds 3-8 tool-use rounds (fame_tier check). Cap at 120s.
export const maxDuration = 60; // Hobby plan hard cap — 120 was silently clamped; budget honestly

// ─────────────────────────────────────────────────────────────────
// Archetype Classifier (Phase 2 of the checkpoint wizard).
//
// Classifies the creator into one of 6 archetypes + assesses fame tier
// (recognition OUTSIDE their direct platform audience). Output is strictly
// internal — lives under
//   creator.offer.internal_metadata.archetype_classification
// and is NEVER rendered to the creator.
//
// Pipeline:
//   1. Gather inputs: bio, niche, recent captions, top posts, content style,
//      audience estimate, ecosystem audit summary (if Phase 1 ran).
//   2. Single Claude Sonnet 4 call with web_search. The web_search is for
//      external fame signals (TV/radio/press/books/talks) — these can't be
//      inferred from IG content alone.
//   3. Validate against schema. On failure, ONE retry with the validation
//      errors fed back to the model.
//   4. Ambiguity rule: if primary_confidence < 70 the schema validator
//      REQUIRES secondary_archetype + secondary_confidence so the operator
//      has something to disambiguate against later in Checkpoint 1.
//   5. Persist + return.
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

    const result = await runArchetype(apiKey, creator);
    if (result.error) {
      return NextResponse.json({ error: result.error, errors: result.errors, raw: result.raw }, { status: 502 });
    }

    // Persist under internal_metadata, preserving anything already there
    // (ecosystem_audit from Phase 1 etc.).
    const existingOffer = creator.offer || {};
    const existingMeta = existingOffer.internal_metadata || {};
    await updateCreator(id, {
      offer: {
        ...existingOffer,
        internal_metadata: {
          ...existingMeta,
          archetype_classification: result.data,
          generation_timestamps: {
            ...(existingMeta.generation_timestamps || {}),
            archetype_classification: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      archetype_classification: result.data,
      _diagnostics: {
        captions_available: result.captionsAvailable,
        ecosystem_audit_used: result.ecosystemAuditUsed,
        retries: result.retries,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Archetype classification failed' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// Prompt + Claude call wrapper
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `# ARCHETYPE CLASSIFIER — Internal Creator Categorization

Classify a content creator into ONE of 6 archetypes and assess their fame tier. Output is JSON used by an internal system — NEVER shown to the creator.

## 6 ARCHETYPES

Pick the BEST single match. If two fit equally well, set primary to the stronger fit and use secondary for the runner-up.

### expert_educator
Teaches concrete, transferable knowledge. Audience follows to LEARN.
Examples: finance educators, code teachers, language coaches, marketing strategists with frameworks.
Signal: posts that say "here's how to X", "the 3 mistakes", "framework for Y". Strong educational structure.
Typical products: courses, ebooks, frameworks.

### performer_practitioner
DOES the craft in public. Audience follows to WATCH skill or process.
Examples: chefs cooking, athletes training, musicians playing, artists creating, designers showing process.
Signal: posts SHOW the work being done. Process > theory. The craft is the content.
Typical products: live shows, books, branded products, sponsorships, custom commissions.

### coach_transformation
Sells MEASURABLE personal change. Audience follows to BECOME better at something specific.
Examples: personal trainers, nutritionists, life coaches, productivity coaches, weight-loss coaches.
Signal: before/after, transformation testimonials, "I helped X go from A to B in T weeks". Outcome-focused language.
Typical products: 1-on-1 coaching, transformation programs, memberships.

### personality_entertainer
Audience follows for the PERSON. Charisma over content.
Examples: lifestyle vloggers, comedians, reaction creators, "day in my life" accounts.
Signal: heavy personal life, family, opinions, jokes. The niche IS the personality.
Typical products: merch, brand deals, podcasts, books.

### curator_aggregator
Audience follows for TASTE / FILTER. Trusts their picks.
Examples: fashion finds accounts, restaurant reviewers, travel curators, deal aggregators, "where to eat in X".
Signal: "found this", "best of", reviews, recommendations. Less self, more filter.
Typical products: affiliate, sponsored placements, paid newsletter, list/database.

### builder_operator
Shows the PROCESS of building something. Founders, indie hackers, operators.
Examples: SaaS founders, e-commerce builders, real estate investors building portfolio, agency operators.
Signal: revenue numbers, build-in-public posts, behind-the-scenes of running a business, MRR screenshots, tooling.
Typical products: cohort courses about their journey, communities of fellow builders, consulting/services.

## CONFIDENCE SCORING

Score 0-100 the strength of the match:
- 85-100: classic textbook example. No ambiguity.
- 70-84: strong fit, minor overlap with another archetype.
- 50-69: clear primary but secondary worth noting.
- 30-49: ambiguous — primary < 70 AND secondary > 40.
- <30: don't pick this archetype as primary.

HARD RULE: if primary_confidence < 70, secondary_archetype + secondary_confidence MUST be set (operator needs something to disambiguate against).

## FAME TIERS

Score recognition OUTSIDE the creator's direct platform audience. **Followers alone do NOT determine fame** — a 500K-follower fitness account known only to their own followers is still micro. Use web_search to verify external presence.

### micro
Known only to direct followers. No external press. Default for accounts under 100K followers OR no external mentions surface in web_search.

### niche_recognized
Recognized within their professional niche. Mentioned in industry publications/podcasts. Speaks at industry events. Audience inside the niche knows them by name.

### cross_niche_recognized
Crosses into adjacent niches. Mainstream business/lifestyle press picks them up. TV/radio appearances on national shows (not just niche podcasts). Published book in a major imprint (not self-pub).

### celebrity
Household name. National TV regularly. Major book deals. Mass-market sponsorships. Recognized outside any single niche.

Web_search for:
- TV/radio mentions (national, not local podcasts)
- Press articles in mainstream outlets (NOT just blog posts or directories)
- Published books with ISBN in major imprints
- Conference keynotes / awards
- Wikipedia entry (strong signal of cross_niche_recognized or higher)

If web_search finds nothing → default to micro (or niche_recognized if the niche-specific signal is strong).

## OUTPUT — EXACT JSON

Return ONLY this JSON. No markdown code fences. No commentary.

{
  "primary_archetype": "expert_educator|performer_practitioner|coach_transformation|personality_entertainer|curator_aggregator|builder_operator",
  "primary_confidence": number_0_to_100,
  "secondary_archetype": "same_enum_or_null",
  "secondary_confidence": number_or_null,
  "classification_evidence": [
    "string — specific signal (bio phrase, caption topic, product type, content pattern). Quote when possible."
  ],
  "fame_tier": "micro|niche_recognized|cross_niche_recognized|celebrity",
  "fame_tier_evidence": "string — what web_search found (or 'no external mentions found' explicitly)"
}

## HARD RULES

1. classification_evidence MUST cite SPECIFIC signals (a bio phrase, a caption topic, a product, a recurring content pattern). Generic statements ("teaches a lot") fail validation.
2. fame_tier_evidence MUST describe what web_search actually returned. If nothing, say "no external mentions found in web_search" explicitly.
3. NEVER invent press, books, or appearances. Only cite what web_search confirmed.
4. If primary_confidence < 70, you MUST include a secondary_archetype + secondary_confidence.
5. secondary_archetype cannot equal primary_archetype.
6. Output VALID JSON only. No surrounding text.`;

async function runArchetype(apiKey, creator, retryCount = 0) {
  // ── Build inputs ──
  const ig = creator.platforms?.instagram || {};
  const intel = creator.intelligence || {};
  const audit = creator.offer?.internal_metadata?.ecosystem_audit || null;

  // Captions: prefer the broader recentPosts list (up to 30 after the slice
  // bump). Each entry is `{ caption, likes, comments, type }`.
  const captions = (ig.recentPosts || []).slice(0, 30).map((p, i) => {
    const c = (p.caption || '').replace(/\s+/g, ' ').trim();
    if (!c) return null;
    return `${i + 1}. [${p.type || 'post'} · ${p.likes || 0} likes] ${c.slice(0, 220)}`;
  }).filter(Boolean).join('\n');

  // Top labelled posts (from full-scrape intelligence) — 3 max.
  const topPosts = (intel.topPosts || []).slice(0, 3).map((p, i) =>
    `T${i + 1} [${p.format || '?'} · ${p.engagementRate || '?'}]: "${(p.caption || '').slice(0, 160)}" — topic: ${p.topic || '?'}`
  ).join('\n');

  const cs = intel.contentStyle || {};
  const contentBreakdown = cs.formatBreakdown
    ? `reels ${cs.formatBreakdown.reels || 0}% / carousels ${cs.formatBreakdown.carousels || 0}% / static ${cs.formatBreakdown.static || 0}%, ${cs.postsPerWeek || '?'} posts/week`
    : 'not analysed yet';

  const ae = creator.audienceEstimate || {};
  const audienceLine = [
    ae.gender, ae.age, ae.location, ae.language,
    Array.isArray(ae.interests) ? `interests: ${ae.interests.slice(0, 5).join(', ')}` : null,
  ].filter(Boolean).join(' · ');

  // Ecosystem audit (Phase 1) summary — short, just enough to bias the archetype decision.
  let auditSummary = '';
  if (audit?.ecosystem_map?.products_found?.length > 0) {
    const products = audit.ecosystem_map.products_found.map(p => `${p.name} (${p.tier} · ${p.format})`).join(' | ');
    auditSummary = `\n## ECOSYSTEM AUDIT (Phase 1, INTERNAL)
Strategic role inferred: ${audit.strategic_role}
Products: ${products}
Completeness: ${audit.ecosystem_map.ecosystem_completeness_score}/100`;
  }

  const creatorContext = [
    `Creator: ${creator.name || 'Unknown'} (@${(ig.url || '').split('/').filter(Boolean).pop() || '?'})`,
    `Niche: ${creator.niche || 'Unknown'}`,
    `IG followers: ${ig.followers || 0}${creator.platforms?.tiktok?.followers ? `, TT ${creator.platforms.tiktok.followers}` : ''}${creator.platforms?.youtube?.subscribers ? `, YT ${creator.platforms.youtube.subscribers}` : ''}`,
    `Engagement: ${ig.engagementRate || creator.engagement || '?'}`,
    `Verified: ${creator.isVerified ? 'yes' : 'no'} · Business: ${creator.isBusinessAccount ? 'yes' : 'no'}`,
    `Bio: ${(creator.bio || '').slice(0, 400) || '(no bio)'}`,
    `Reputation notes (from scrape): ${(creator.reputation || 'none').slice(0, 300)}`,
    `Audience estimate: ${audienceLine || 'unknown'}`,
    `Content breakdown: ${contentBreakdown}`,
  ].join('\n');

  const userMessage = `Classify this creator. Use web_search to verify fame_tier (look for external mentions: TV, radio, press, books, talks). Return JSON per the schema.

## CREATOR
${creatorContext}
${auditSummary}

## RECENT CAPTIONS (raw, most recent first)
${captions || '(no captions captured)'}

## TOP-PERFORMING POSTS (labelled by content analysis)
${topPosts || '(no top-post labels yet)'}

Return ONLY the JSON object. No code fences, no preamble.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    return { error: data.error?.message || `Anthropic ${resp.status}`, errors: [], raw: null, retries: retryCount };
  }

  const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  let parsed = tryParseJson(rawText);
  if (!parsed) {
    // Cheap Haiku JSON-repair instead of re-running the whole (often
    // web_search-backed) call — a parse failure is a formatting slip,
    // not a reasoning failure. ~$0.005 vs re-billing the full generation.
    const repaired = await repairJsonWithHaiku(apiKey, rawText, tryParseJson);
    if (repaired) { parsed = repaired; }
    else return { error: 'Model returned non-JSON output', raw: rawText, errors: [], retries: retryCount };
  }

  const validation = validateArchetype(parsed);
  if (!validation.valid) {
    // Retry-on-validation-failure removed 2026-06-18 (emergency cost cut).
    return { error: 'Schema validation failed', errors: validation.errors, raw: rawText, retries: retryCount };
  }

  return enrich(parsed, captions, audit, retryCount);
}

function enrich(data, captionsRaw, audit, retries) {
  return {
    data,
    captionsAvailable: captionsRaw ? captionsRaw.split('\n').length : 0,
    ecosystemAuditUsed: !!audit,
    retries,
  };
}

// Defensive JSON extractor — handles stray ```json fences + finds first balanced {...}.
function tryParseJson(text) {
  if (!text) return null;
  let s = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = s.indexOf('{');
  if (start === -1) return null;
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
