import { NextResponse } from 'next/server';
import { saveCreator, getCreator, listCreators, searchCreators } from '../../lib/creators';
import { syncCreatorEmail } from '../../lib/syncEmailToSheet';
import { getCurrentUser, displayFirstName } from '../../lib/auth';
import { apifyToCreatorProfile, scrapeMultiplePlatforms, scrapeLean } from '../../lib/apify';
import { calculateDealScore } from '../../lib/dealScore';

// Lean scrape only — no LLM inference. Ecosystem audit fires next in the
// pipeline and does full niche/audience/product inference with web search.
// Import now fits comfortably under 60s on every account (previously the
// Haiku analysis step was pushing large accounts past the cap).
export const maxDuration = 60;

// Cheap bio-text heuristic to seed primaryLanguage without a real LLM call.
// The audit refines this with proper audience-language inference. Just needs
// to be close enough that the audit gets the right output-language hint on
// its first run. Falls back to null when no bio (audit will resolve later).
function inferLanguageFromBio(bio) {
  if (!bio) return null;
  const b = bio.toLowerCase();
  // Portuguese-specific tokens (ê/ã/ç + PT common words). Weighted first
  // because we're a PT-market hub — false positives here are cheaper than
  // false negatives on Spanish/English.
  if (/\b(não|é|olá|obrigado|obrigada|português|acompanha|criador|criadora|nova|semana|conteúdo)\b/i.test(bio) || /[ãõçê]/.test(b)) {
    return 'pt';
  }
  // Spanish-specific tokens (ñ + ES common words).
  if (/\b(hola|gracias|español|sigue|creadora|semana|contenido|más|cómo|día|años)\b/i.test(bio) || /ñ/.test(b)) {
    return 'es';
  }
  // Default to English — the audit will correct if wrong.
  return 'en';
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const status = searchParams.get('status'); // 'prospect', 'signed', or null (all)

    let creators;
    if (q) {
      creators = await searchCreators(q);
    } else {
      creators = await listCreators();
    }

    // Filter by pipeline status if requested
    if (status) {
      creators = creators.filter(c => (c.pipelineStatus || 'prospect') === status);
    }

    return NextResponse.json({ creators });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Support both new format { instagramUrl, tiktokUrl, youtubeUrl, name } and old format { url, name }
  let { instagramUrl, tiktokUrl, youtubeUrl, name, url } = body;

  // Backward compat: if only `url` is sent (old format), detect platform
  if (url && !instagramUrl && !tiktokUrl && !youtubeUrl) {
    if (/instagram\.com/i.test(url)) instagramUrl = url;
    else if (/tiktok\.com/i.test(url)) tiktokUrl = url;
    else if (/youtube\.com|youtu\.be/i.test(url)) youtubeUrl = url;
    else instagramUrl = url; // default to Instagram
  }

  if (!instagramUrl && !tiktokUrl && !youtubeUrl) {
    return NextResponse.json({ error: 'At least one platform URL is required' }, { status: 400 });
  }

  try {
    let profile = null;

    // ── LEAN SCRAPE ──
    // Top-of-funnel only hits Instagram (basic actor, no bot detector) and stores
    // TikTok/YouTube URLs as stubs. Cuts Apify cost from ~€0.45-0.60 down to
    // ~€0.10-0.12 per creator and Claude cost from ~$0.05 (Sonnet+web_search)
    // down to ~$0.01 (Sonnet, no tools, smaller output).
    //
    // The full enrichment (TikTok scrape, YouTube scrape, IG bot detector,
    // bio-link product discovery, competitor research) runs on demand via
    // /api/creators/[id]/full-scrape once the creator engages.
    if (instagramUrl || tiktokUrl || youtubeUrl) {
      const multiResult = await scrapeLean(instagramUrl, tiktokUrl, youtubeUrl);

      if (multiResult.source === 'apify-lean' && multiResult.profile) {
        profile = multiResult.profile;

        // LLM analysis REMOVED (2026-07-01) — was 30-100+ lines of Haiku
        // structured extraction pushing Apify+LLM past Vercel's 60s cap.
        // Every field it produced (niche, audience, bio_products,
        // competitors, top_posts, format breakdown) is either re-derived
        // by the ecosystem-audit (which fires next in the pipeline and
        // does the same inference with richer web-search context) or
        // is nice-to-have UI data the operator doesn't need at import
        // time. Import now: Apify scrape → save → return. ~15-45s
        // wall-clock, comfortably under the 60s cap on every account.
        //
        // primaryLanguage is set below from a lightweight bio-text
        // heuristic so the auto-fired audit knows what language to
        // output in. The audit refines it with real audience data.
        if (profile) {
          profile.primaryLanguage = inferLanguageFromBio(profile.bio);
        }
      }
    }

    // Fallback: if Apify didn't work or only YouTube was provided, use Claude web search
    if (!profile) {
      if (!apiKey) {
        return NextResponse.json({ error: 'Neither APIFY_TOKEN nor ANTHROPIC_API_KEY configured' }, { status: 500 });
      }

      const primaryUrl = instagramUrl || tiktokUrl || youtubeUrl;
      const usernameMatch = primaryUrl.match(/(?:instagram\.com|tiktok\.com|youtube\.com)\/[@]?([^/?]+)/i);
      const username = usernameMatch ? usernameMatch[1] : '';
      const platform = primaryUrl.includes('tiktok') ? 'TikTok' : primaryUrl.includes('youtube') ? 'YouTube' : 'Instagram';

      const researchResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{
            role: 'user',
            content: `Search for this ${platform} creator: ${primaryUrl}
${name ? `Name: ${name}` : `Username: ${username}`}

Search for "${username} ${platform}" and "${username} followers".

Respond with ONLY these lines:

NAME: ${name || '[full name]'}
NICHE: [e.g. Food / Baking, Fitness, Photography]
PRIMARY_PLATFORM: ${platform}
INSTAGRAM_FOLLOWERS: [number, e.g. 181000]
INSTAGRAM_URL: ${instagramUrl || ''}
TIKTOK_FOLLOWERS: [number]
TIKTOK_LIKES: [number]
TIKTOK_URL: ${tiktokUrl || ''}
YOUTUBE_SUBSCRIBERS: [number]
YOUTUBE_URL: ${youtubeUrl || ''}
ENGAGEMENT: [e.g. 3.5%]
PRODUCTS: [comma-separated, or "None found"]
REPUTATION: [brief summary, or "No notable mentions"]
RESEARCH: [2-3 paragraph summary]`,
          }],
        }),
      });

      const researchData = await researchResponse.json();
      if (!researchResponse.ok) {
        return NextResponse.json({ error: researchData.error?.message || 'Research failed' }, { status: 500 });
      }

      const researchText = (researchData.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n\n');

      profile = parseClaudeResearch(researchText, name, username, primaryUrl, platform);
    }

    if (name && profile) profile.name = name;
    if (tiktokUrl && profile) profile.tiktokUrl = tiktokUrl;
    if (youtubeUrl && profile) profile.youtubeUrl = youtubeUrl;

    // Bulk-import opt-in: callers can pass `minDealScore` (e.g. 35 to drop D-tier).
    // We compute the score on the freshly built profile BEFORE saving so rejected
    // creators never touch the DB — saves Apify cost on obvious passes and keeps
    // the CRM clean. The client gets back the score so it can show why each row
    // was rejected.
    if (profile && body.minDealScore != null) {
      try {
        const score = calculateDealScore(profile);
        if (score && score.score < Number(body.minDealScore)) {
          return NextResponse.json({
            rejected: true,
            reason: 'below_min_score',
            score: score.score,
            grade: score.grade,
            profile: { name: profile.name, niche: profile.niche, primaryPlatform: profile.primaryPlatform },
          });
        }
      } catch {
        // Score calc failed — save anyway, don't punish the creator for our bug.
      }
    }

    // Attribution: stamp the team member who added this creator so the
    // dashboard can show "creators added by Tomás vs Raúl" by date range.
    // displayFirstName returns the accented form ("Tomás" / "Raúl") for
    // known operators — important so the CRM filter dropdown doesn't end
    // up with both unaccented and accented variants of the same person.
    // Falls back to null when there's no session (cron, scripts).
    const currentUser = await getCurrentUser(request);
    if (currentUser) {
      profile.addedBy = {
        userId: currentUser.userId,
        firstName: displayFirstName(currentUser),
        at: new Date().toISOString(),
      };
    }

    // saveCreator dedupes by IG handle internally: if the creator already
    // exists, it returns { id: <existing>, duplicate: true } without writing.
    // We need to surface that to the caller so the UI can show "already in CRM"
    // (with a link to the existing creator) instead of pretending the row was
    // newly added — that's what made earlier imports silently disappear into
    // tabs the operator wasn't looking at.
    const result = await saveCreator(profile);
    if (result.duplicate) {
      const existing = await getCreator(result.id);
      return NextResponse.json({
        id: result.id,
        duplicate: true,
        creator: existing || { id: result.id, ...profile },
        message: 'Creator already exists in the CRM',
      });
    }
    // Fire-and-forget Google Sheets email sync — fails silently when sheets
    // env isn't configured. Never blocks the scrape response.
    syncCreatorEmail({ id: result.id, ...profile }).catch(() => {});
    return NextResponse.json({ id: result.id, creator: { id: result.id, ...profile } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}

function parseClaudeResearch(text, fallbackName, username, url, platform) {
  const get = (key) => {
    const match = text.match(new RegExp(`^${key}:\\s*(.+)`, 'mi'));
    return match ? match[1].trim().replace(/^\[.*\]$/, '') : '';
  };

  const getNum = (key) => {
    const val = get(key);
    if (!val || val === '0') return 0;
    let cleaned = val.replace(/[,\s]/g, '');
    if (/(\d+(?:\.\d+)?)\s*[kK]/.test(cleaned)) return Math.round(parseFloat(RegExp.$1) * 1000);
    if (/(\d+(?:\.\d+)?)\s*[mM]/.test(cleaned)) return Math.round(parseFloat(RegExp.$1) * 1000000);
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
  };

  const researchMatch = text.match(/^RESEARCH:\s*([\s\S]+)/mi);
  const productsRaw = get('PRODUCTS');

  const platforms = {};
  if (platform === 'Instagram' || getNum('INSTAGRAM_FOLLOWERS')) {
    platforms.instagram = { followers: getNum('INSTAGRAM_FOLLOWERS'), url: get('INSTAGRAM_URL') || (platform === 'Instagram' ? url : '') };
  }
  if (platform === 'TikTok' || getNum('TIKTOK_FOLLOWERS')) {
    platforms.tiktok = { followers: getNum('TIKTOK_FOLLOWERS'), totalLikes: getNum('TIKTOK_LIKES'), url: get('TIKTOK_URL') || (platform === 'TikTok' ? url : '') };
  }
  if (platform === 'YouTube' || getNum('YOUTUBE_SUBSCRIBERS')) {
    platforms.youtube = { subscribers: getNum('YOUTUBE_SUBSCRIBERS'), url: get('YOUTUBE_URL') || (platform === 'YouTube' ? url : '') };
  }

  return {
    name: get('NAME') || fallbackName || username || 'Unknown',
    niche: get('NICHE') || '',
    primaryPlatform: get('PRIMARY_PLATFORM') || platform || 'Instagram',
    platforms,
    engagement: get('ENGAGEMENT') || '',
    products: productsRaw && productsRaw !== 'None found' ? productsRaw.split(',').map(p => p.trim()).filter(Boolean) : [],
    reputation: get('REPUTATION') || '',
    research: researchMatch ? researchMatch[1].trim() : text,
  };
}
