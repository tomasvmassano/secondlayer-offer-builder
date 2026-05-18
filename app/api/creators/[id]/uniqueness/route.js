import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { validateUniqueness, VALID_CATEGORIES, VALID_MONETIZATION } from '../../../../lib/schemas/uniqueness';

// No web_search → fast call (~10-20s). Cap at 60s.
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────
// Uniqueness Extractor (Phase 3 of the checkpoint wizard).
//
// Extracts 5-8 elements that make THIS creator different from generic
// competitors in their niche. Raw output lives under
//   creator.offer.internal_metadata.uniqueness_extraction
// and stays internal. Phase 4 (the wizard) will translate the strongest
// elements with monetization_potential=high into sales-language copy that
// lands in client_facing_output.differentiator_section.
//
// Inputs (all already gathered upstream — no fresh scrapes or web_search):
//   - Creator bio, niche, audience demographics
//   - Up to 30 recent captions (raw, from the post-bump scrape)
//   - Top 3 labelled posts from intelligence.topPosts
//   - Phase 1 ecosystem audit summary (strategic role + products)
//   - Phase 2 archetype + fame tier (incl. fame_tier_evidence which already
//     consumed web_search results — no need to re-search)
//
// Each module in the Phase 4 offer generation will be REQUIRED to link to
// at least one element with usable_in_modules=true. That's why the schema
// makes usable_in_modules mandatory.
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

    const result = await runUniqueness(apiKey, creator);
    if (result.error) {
      return NextResponse.json({ error: result.error, errors: result.errors, raw: result.raw }, { status: 502 });
    }

    const existingOffer = creator.offer || {};
    const existingMeta = existingOffer.internal_metadata || {};
    await updateCreator(id, {
      offer: {
        ...existingOffer,
        internal_metadata: {
          ...existingMeta,
          uniqueness_extraction: result.data,
          generation_timestamps: {
            ...(existingMeta.generation_timestamps || {}),
            uniqueness_extraction: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      uniqueness_extraction: result.data,
      _diagnostics: {
        captions_analysed: result.captionsAnalysed,
        archetype_used: result.archetypeUsed,
        ecosystem_audit_used: result.ecosystemAuditUsed,
        retries: result.retries,
        elements_returned: result.data.unique_elements.length,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Uniqueness extraction failed' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────
// Prompt + Claude call
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `# UNIQUENESS EXTRACTOR — Internal Differentiation Analysis

Extract 5-8 elements that make THIS creator different from generic competitors in their niche. Output is JSON for an internal system. The raw extraction is NEVER shown to the creator — Phase 4 will translate the strongest elements into sales copy.

## WHAT COUNTS AS "UNIQUE"

"Unique" = something ONLY this creator can offer. A competitor in the same niche could NOT honestly claim it.

GENERIC (DO NOT extract):
- "Teaches business automation" — every business educator does
- "Has a strong work ethic" — meaningless filler
- "Posts regularly on Instagram" — every creator does
- "Helps people grow" — generic outcome
- "10+ years of experience" — common, not differentiating

UNIQUE (DO extract):
- "Runs his entire business on 6 Notion databases with an AI making 70% of decisions" (proprietary_method)
- "Stand-up comedian who left a Harvard MBA to do crowd work full-time" (credential + story → pick the stronger)
- "Viral reel about quitting his Goldman job got 8M views and was on Bloomberg" (viral_moment)
- "Coined the phrase 'sourcing compass' for his weekly product-pick ritual" (vocabulary)
- "Argues that course launches are dead — audience wants ongoing, not events" (contrarian_angle)
- "Dines weekly with billionaires through his family's investment fund" (behind_the_scenes_access)

## CATEGORIES (strict enum)

- story — a specific personal narrative (founding, pivot, failure-to-success arc)
- credential — rare professional qualification, affiliation, or institutional access
- viral_moment — a specific piece of content (reel, post, appearance) that broke through
- vocabulary — a phrase or term the creator coined or uses with distinct ownership
- contrarian_angle — a public position opposing mainstream niche thinking
- proprietary_method — a system / framework the creator NAMED themselves
- behind_the_scenes_access — privileged access most competitors don't have

Pick ONE category per element. If two fit, pick the more concrete one (proprietary_method > story; viral_moment > credential).

## MONETIZATION_POTENTIAL

- high — the offer's premium driver. People will pay 2-5× MORE because of this element. Foundation of the central promise.
- medium — useful as a module/bonus/hook angle inside the offer. Supporting material.
- low — interesting context but doesn't sell. "About me" not "buy now".

## USABLE_IN_MODULES

- true — you can imagine an offer module/lesson/bonus built ON this element.
- false — biographical context only, not a teachable thing.

(Phase 4 will REQUIRE every offer module to cite at least one element with usable_in_modules=true.)

## OUTPUT — EXACT JSON

Return ONLY this JSON. No markdown code fences. No commentary.

{
  "unique_elements": [
    {
      "element": "string — what makes the creator different (specific, not generic)",
      "category": "story|credential|viral_moment|vocabulary|contrarian_angle|proprietary_method|behind_the_scenes_access",
      "evidence_source": "string — cite the specific caption, bio phrase, post, or fame_tier finding this came from. Quote when possible.",
      "monetization_potential": "high|medium|low",
      "usable_in_modules": boolean
    }
  ],
  "creator_voice_summary": "string — tone and characteristic style. Max 3 sentences."
}

## HARD RULES

1. RETURN 5-8 ELEMENTS. If the creator genuinely feels thin, include weaker elements with monetization_potential 'low'. Five is the floor.
2. evidence_source MUST cite something concrete: a caption phrase (quote it), a bio line, a specific post topic, or a confirmed external mention from fame_tier_evidence. Statements like "based on overall vibe" or "their content suggests" FAIL validation.
3. NEVER invent. If you can't find evidence for an element, drop it and look for another.
4. Output VALID JSON only — no surrounding text.`;

async function runUniqueness(apiKey, creator, retryCount = 0, extraInstruction = null) {
  const ig = creator.platforms?.instagram || {};
  const intel = creator.intelligence || {};
  const meta = creator.offer?.internal_metadata || {};
  const audit = meta.ecosystem_audit || null;
  const archetype = meta.archetype_classification || null;

  // Captions — up to 30 from the bumped slice.
  const captions = (ig.recentPosts || []).slice(0, 30).map((p, i) => {
    const c = (p.caption || '').replace(/\s+/g, ' ').trim();
    if (!c) return null;
    return `${i + 1}. [${p.type || 'post'} · ${p.likes || 0} likes] ${c.slice(0, 240)}`;
  }).filter(Boolean);
  const captionsBlock = captions.join('\n');

  // Top labelled posts (intelligence.topPosts)
  const topPosts = (intel.topPosts || []).slice(0, 3).map((p, i) =>
    `T${i + 1} [${p.format || '?'} · ${p.engagementRate || '?'}]: "${(p.caption || '').slice(0, 180)}" — topic: ${p.topic || '?'}`
  ).join('\n');

  // Bio links (Instagram's multi-link feature) — useful for product naming signals
  const bioLinks = (ig.bioLinks || []).map(l => `"${l.title || ''}" → ${l.url}`).join('\n');

  // Phase 1: ecosystem
  let auditSummary = '';
  if (audit?.ecosystem_map?.products_found?.length > 0) {
    const products = audit.ecosystem_map.products_found.map(p => `${p.name} (${p.tier} · ${p.format})`).join(' | ');
    auditSummary = `\n## ECOSYSTEM (Phase 1)
Strategic role: ${audit.strategic_role}
Products: ${products}`;
  }

  // Phase 2: archetype + fame
  let archetypeSummary = '';
  if (archetype) {
    archetypeSummary = `\n## ARCHETYPE + FAME (Phase 2)
Primary: ${archetype.primary_archetype} (${archetype.primary_confidence}%)${archetype.secondary_archetype ? ` · Secondary: ${archetype.secondary_archetype} (${archetype.secondary_confidence}%)` : ''}
Fame tier: ${archetype.fame_tier}
Fame evidence: ${archetype.fame_tier_evidence}
Classification evidence:
${(archetype.classification_evidence || []).map(e => '  - ' + e).join('\n')}`;
  }

  const ae = creator.audienceEstimate || {};
  const audienceLine = [
    ae.gender, ae.age, ae.location, ae.language,
    Array.isArray(ae.interests) ? `interests: ${ae.interests.slice(0, 5).join(', ')}` : null,
  ].filter(Boolean).join(' · ');

  const creatorContext = [
    `Creator: ${creator.name || 'Unknown'}`,
    `Niche: ${creator.niche || 'Unknown'}`,
    `IG followers: ${ig.followers || 0}${creator.platforms?.tiktok?.followers ? `, TT ${creator.platforms.tiktok.followers}` : ''}${creator.platforms?.youtube?.subscribers ? `, YT ${creator.platforms.youtube.subscribers}` : ''}`,
    `Engagement: ${ig.engagementRate || creator.engagement || '?'}`,
    `Bio: ${(creator.bio || '').slice(0, 500) || '(no bio)'}`,
    `Reputation notes (from scrape): ${(creator.reputation || 'none').slice(0, 400)}`,
    `Audience: ${audienceLine || 'unknown'}`,
  ].join('\n');

  const userMessage = `Extract the unique elements that make this creator different from generic competitors in their niche. Return JSON per the schema.

## CREATOR
${creatorContext}
${auditSummary}${archetypeSummary}

## BIO LINKS (titles + URLs from IG profile)
${bioLinks || '(no bio links captured)'}

## RECENT CAPTIONS (raw, most recent first)
${captionsBlock || '(no captions captured)'}

## TOP-PERFORMING POSTS (labelled)
${topPosts || '(no top-post labels)'}

${extraInstruction ? `## ADDITIONAL INSTRUCTION\n${extraInstruction}\n\n` : ''}Return ONLY the JSON object.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    return { error: data.error?.message || `Anthropic ${resp.status}`, errors: [], raw: null, retries: retryCount };
  }

  const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const parsed = tryParseJson(rawText);
  if (!parsed) {
    if (retryCount < 1) return runUniqueness(apiKey, creator, retryCount + 1);
    return { error: 'Model returned non-JSON output after retry', raw: rawText, errors: [], retries: retryCount };
  }

  const validation = validateUniqueness(parsed);
  if (!validation.valid) {
    if (retryCount < 1) {
      // Retry with errors fed back via a follow-up user message — keeps the
      // earlier assistant turn intact so the model doesn't re-search context.
      const retryResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
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
          const retryValidation = validateUniqueness(retryParsed);
          if (retryValidation.valid) return enrich(retryParsed, captions.length, archetype, audit, retryCount + 1);
          return { error: 'Schema validation failed twice', errors: retryValidation.errors, raw: retryText, retries: retryCount + 1 };
        }
      }
    }
    return { error: 'Schema validation failed', errors: validation.errors, raw: rawText, retries: retryCount };
  }

  return enrich(parsed, captions.length, archetype, audit, retryCount);
}

function enrich(data, captionsAnalysed, archetype, audit, retries) {
  return {
    data,
    captionsAnalysed,
    archetypeUsed: !!archetype,
    ecosystemAuditUsed: !!audit,
    retries,
  };
}

// Defensive JSON extractor.
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
