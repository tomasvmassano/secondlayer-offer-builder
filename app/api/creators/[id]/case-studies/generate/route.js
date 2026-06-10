import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../../lib/creators';

// ─────────────────────────────────────────────────────────────────
// Case-study generator — niche-specific real-world communities, gated by
// URL + title verification. Used by the pitch deck "Casos Similares" slide.
//
// Why this exists: the curated app/lib/casesDb.js only covers ~7 generic
// creator-economy names rotated across 4 broad buckets. For a Dubai
// real-estate woman or a Portuguese chef, none of them are on-niche.
//
// Flow:
//   1. Build prompt with creator niche/audience/community_name/price/scale
//   2. Ask Claude Sonnet for 5 candidate cases (we filter to 3 verified)
//   3. URL ping each — reject 404/dead
//   4. Fetch HTML, extract <title>, reject if title doesn't share at
//      least one significant token with the case name (catches hallucinated
//      "real-URL-wrong-content" results)
//   5. Persist verified cases to creator.offer.cases when body.persist=true
//
// Returns: { cases: [...verified], rejected: [{name, url, reason}], used_db_fallback: bool }
// ─────────────────────────────────────────────────────────────────

export const maxDuration = 90;
export const dynamic = 'force-dynamic';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
// Same as the audit script — hosts that Cloudflare-gate ALL bot traffic.
// 403 from one of these is treated as "presumed good" rather than rejected.
const PRESUMED_GOOD_403 = new Set([
  'aliabdaal.com',
  'academy.aliabdaal.com',
]);

const SYSTEM_PROMPT = `You pick 3 REAL public communities to put on a pitch deck as proof for a creator who wants to build a paid community.

THE RULES (non-negotiable):
1. Every case must be a REAL community / course / membership that EXISTS today. If you are not confident a case is real, OMIT IT — return fewer cases rather than padding with hallucinations.
2. Niche must overlap the creator's niche meaningfully. Generic creator-economy names (Lenny's Newsletter, Justin Welsh) are FORBIDDEN unless the creator's niche IS creator-economy / product / SaaS.
3. Scale must be comparable. The creator has {follower_count} followers. Cases should have between {follower_count} × 3 and {follower_count} × 30 members. Don't show a 3M-subscriber unicorn next to a 10K-follower creator — that destroys the deck's "this could be you" framing.
4. Pricing model must match. If the creator is doing recurring, prioritize MRR/subscription communities. If one-time, prioritize courses/cohorts. If hybrid, mix.
5. URLs must be real and verifiable. The system pings them after you return — anything that 404s gets rejected automatically.

FOR EACH CASE return:
- name: "Community Name · Creator Name" format (e.g. "Maven · Wes Kao")
- niche: 2-4 word tag matching the creator's niche
- members: "X+ paid" / "X+ members" — your best estimate from public data
- price: e.g. "$49/mo", "€297 one-time", "—" (community = free)
- revenue_type: "mrr" | "one_time" | "community"
- revenue_value: e.g. "~$150K MRR" / "~$500K+ lifetime" / "—"
- trajectory: ONE LINE — "Launched 2021 · grew to X in Y years" (the path, not just destination)
- resume: ONE sentence — what they do
- why: ONE sentence — why this specific case is proof for THIS creator (cite a shared trait: same audience / same mechanic / same price band / same archetype)
- url: HTTPS, verifiable

Return JSON only:
{
  "cases": [ { ...above... }, ... ]
}

If you can only confidently name 1 or 2 real cases, return that. NEVER pad with names you're not sure about.`;

function tryParseJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  // Strip ```json fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  // Find first { ... last }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) { try { return JSON.parse(text.slice(start, end + 1)); } catch {} }
  return null;
}

// Pull the title from raw HTML without a parser. Good enough for the
// sanity-check — falls back to og:title / page text if no <title>.
function extractTitle(html) {
  if (!html) return '';
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (t) return t[1].trim();
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i);
  if (og) return og[1].trim();
  return '';
}

// Significant tokens for the title-overlap check. Drops platform suffixes,
// generic words, and short noise.
function significantTokens(name) {
  if (!name) return [];
  return name
    .toLowerCase()
    .replace(/[·.·,()\[\]"'`]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 4)
    .filter(t => !['community','newsletter','academy','course','premium','members','membership','official','website','home','page'].includes(t));
}

async function verifyCase(caseObj) {
  const url = caseObj?.url;
  if (!url) return { ok: false, reason: 'no_url' };
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const headers = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' };
  let res;
  try {
    res = await fetch(url, { method: 'GET', redirect: 'follow', headers, signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    return { ok: false, reason: `fetch_error: ${err.message || err}` };
  }
  // Cloudflare-gated hosts: 403 here is "presumed good", let it through.
  if (res.status === 403 && PRESUMED_GOOD_403.has(host)) {
    return { ok: true, presumedGood: true, title: '' };
  }
  if (res.status < 200 || res.status >= 400) {
    return { ok: false, reason: `http_${res.status}` };
  }
  // Title sanity check — at least one significant token from the case
  // name must appear in the page title. Catches "URL works but points
  // to wrong content" hallucinations.
  let html = '';
  try { html = await res.text(); } catch { /* ignore */ }
  const title = extractTitle(html).toLowerCase();
  const tokens = significantTokens(caseObj.name);
  const hit = tokens.find(t => title.includes(t));
  if (!hit && tokens.length > 0) {
    return { ok: false, reason: `title_mismatch — title="${title.slice(0, 80)}" no overlap with [${tokens.slice(0, 3).join(', ')}]` };
  }
  return { ok: true, title: title.slice(0, 120) };
}

export async function POST(request, { params }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const persist = body.persist !== false; // default true

    const creator = await getCreator(id);
    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    const cfo = creator.offer?.client_facing_output || {};
    const frame = creator.offer?.internal_metadata?.strategic_frame || {};
    const archetype = creator.offer?.internal_metadata?.archetype_classification?.primary_archetype;

    // Primary follower count for scale-matching. Same logic as creators.js.
    const followers = (() => {
      if (!creator.platforms) return 0;
      const plat = (creator.primaryPlatform || 'instagram').toLowerCase();
      const p = creator.platforms[plat];
      if (p?.followers || p?.subscribers) return p.followers || p.subscribers || 0;
      for (const k of Object.keys(creator.platforms)) {
        const v = creator.platforms[k];
        if (v?.followers || v?.subscribers) return v.followers || v.subscribers || 0;
      }
      return 0;
    })();

    const niche       = creator.niche || frame?.audience_segment?.description || cfo.niche || 'creator economy';
    const community   = cfo.community_name || '(unnamed)';
    const audience    = frame?.audience_segment?.description || cfo.target_audience || '';
    const price       = cfo.target_price || '';
    const model       = cfo.pricing_model || 'monthly';
    const lang        = (creator.primaryLanguage || 'pt').toLowerCase();

    const userMessage = `Creator profile:
- Name: ${creator.name || '(unknown)'}
- Niche: ${niche}
- Audience: ${audience || '(not specified)'}
- Primary platform: ${creator.primaryPlatform || 'instagram'} · ${followers.toLocaleString()} followers
- Archetype: ${archetype || '(not classified)'}

Offer we're building:
- Community name: ${community}
- Pricing: ${price} (${model})

Find 3 REAL communities that match this creator's niche, scale, and pricing model. Follow the rules in the system prompt strictly. Return JSON only.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: [{ type: 'text', text: SYSTEM_PROMPT.replace('{follower_count}', String(followers || 10000)).replace('{follower_count}', String(followers || 10000)).replace('{follower_count}', String(followers || 10000)), cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return NextResponse.json({ error: data.error?.message || `Anthropic ${resp.status}` }, { status: 500 });
    }

    const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    const parsed = tryParseJson(rawText);
    if (!parsed || !Array.isArray(parsed.cases)) {
      return NextResponse.json({ error: 'Model returned non-JSON or missing cases array', raw: rawText.slice(0, 500) }, { status: 500 });
    }

    // Verify each case in parallel — URL ping + title sanity check.
    const verifications = await Promise.all(
      parsed.cases.map(async (c) => ({ case: c, result: await verifyCase(c) }))
    );

    const verified = [];
    const rejected = [];
    for (const v of verifications) {
      if (v.result.ok) {
        // Promote { pt, en } language pairs if the model returned them; else
        // wrap the single string under the creator's lang so the pitch slide
        // (which expects either a string or { pt, en }) handles it.
        const c = v.case;
        verified.push({
          name: c.name,
          niche: c.niche,
          members: c.members || '',
          price: c.price || '',
          revenue_type: c.revenue_type || 'mrr',
          revenue_value: c.revenue_value || '—',
          trajectory: c.trajectory || '',
          resume: c.resume || '',
          why: c.why || '',
          url: c.url,
          _verified: { title: v.result.title || '', presumedGood: !!v.result.presumedGood, at: new Date().toISOString() },
        });
      } else {
        rejected.push({ name: v.case.name, url: v.case.url, reason: v.result.reason });
      }
    }

    // Take the top 3 verified. The LLM is asked for ~5 so we have headroom
    // when 1-2 get rejected by verification.
    const top3 = verified.slice(0, 3);

    if (persist && top3.length > 0) {
      const nextOffer = {
        ...(creator.offer || {}),
        client_facing_output: {
          ...(creator.offer?.client_facing_output || {}),
          cases: top3,
        },
        internal_metadata: {
          ...(creator.offer?.internal_metadata || {}),
          case_studies_last_generated: {
            at: new Date().toISOString(),
            verified_count: top3.length,
            rejected_count: rejected.length,
            rejected,
            lang,
          },
        },
      };
      await updateCreator(id, { offer: nextOffer });
    }

    return NextResponse.json({
      cases: top3,
      rejected,
      total_candidates: parsed.cases.length,
      verified_count: verified.length,
      persisted: persist && top3.length > 0,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
