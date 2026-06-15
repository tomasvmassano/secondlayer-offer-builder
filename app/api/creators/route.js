import { NextResponse } from 'next/server';
import { saveCreator, getCreator, listCreators, searchCreators } from '../../lib/creators';
import { syncCreatorEmail } from '../../lib/syncEmailToSheet';
import { getCurrentUser, displayFirstName } from '../../lib/auth';
import { apifyToCreatorProfile, scrapeMultiplePlatforms, scrapeLean } from '../../lib/apify';
import { resolvePrimaryLanguage } from '../../lib/language';
import { calculateDealScore } from '../../lib/dealScore';

// Lean scrape + lightweight analysis fits well under 60s. The full enrichment
// (TikTok + YouTube + web-search products/competitors) runs separately via
// /api/creators/[id]/full-scrape when the creator engages.
export const maxDuration = 60;

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

        // Lightweight inference — niche + audience + top-post labelling only.
        // No web search (saves 5-10 tool-use rounds vs the full analysis).
        // No bio-link products / competitors — those move to full-scrape.
        if (apiKey && profile) {
          try {
            const igRaw = multiResult.igRaw;
            const allPosts = (igRaw?.recentPosts || []).map(p => ({
              caption: p.caption, likes: p.likes, comments: p.comments, type: p.type || 'image',
            }));
            const postPerformanceData = allPosts.slice(0, 6).map((p, i) =>
              `Post ${i + 1} [${p.type}]: "${(p.caption || '').slice(0, 120)}" — ${p.likes || 0} likes, ${p.comments || 0} comments`
            ).join('\n');

            const analysisResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-5-20250929',
                // Bumped 1500 → 2500 (2026-05-19) to fit BIO_PRODUCT_1-5 +
                // COMPETITOR_1-3 alongside the existing audience/format
                // output. Without the headroom these new fields get
                // truncated and the downstream audit has nothing to chew on.
                max_tokens: 2500,
                messages: [{
                  role: 'user',
                  content: `Infer this Instagram creator's niche + audience + recent-post themes + product hints from the data below. Respond with ONLY these labelled lines — no explanation, no other text:

NICHE: [their niche, e.g. "Food / Baking", "Fitness", "Photography", "Business / Marketing", "Real Estate"]

AUDIENCE_GENDER: [estimated gender split, e.g. "70% Female, 30% Male"]
AUDIENCE_AGE: [estimated primary age range, e.g. "25-34"]
AUDIENCE_LOCATION: [estimated primary countries, e.g. "Portugal 60%, Brazil 25%, Other 15%"]
AUDIENCE_LANGUAGE: [primary language of content, e.g. "Portuguese 80%, English 20%"]
AUDIENCE_INTERESTS: [5 comma-separated audience interest categories]

TOP_POST_1: [caption snippet, ≤80 chars]|||[engagement rate vs avg, e.g. "2x avg"]|||[reel/carousel/static/video]|||[topic, 3-5 words]
TOP_POST_2: [...]|||[...]|||[...]|||[...]
TOP_POST_3: [...]|||[...]|||[...]|||[...]
FORMAT_REELS: [estimated % reels/videos, e.g. "60"]
FORMAT_CAROUSELS: [estimated % carousels]
FORMAT_STATIC: [estimated % static]
POSTS_PER_WEEK: [estimated, e.g. "4.2"]

BIO_PRODUCT_1: [url]|||[platform, e.g. "Stan Store", "Linktree", "Gumroad", "Own site"]|||[product name]|||[price if visible, else "Unknown"]|||[currency, e.g. "EUR", "USD"]
BIO_PRODUCT_2: [...]|||[...]|||[...]|||[...]|||[...]
BIO_PRODUCT_3: [...]|||[...]|||[...]|||[...]|||[...]
BIO_PRODUCT_4: [...]|||[...]|||[...]|||[...]|||[...]
BIO_PRODUCT_5: [...]|||[...]|||[...]|||[...]|||[...]
COMPETITOR_1: [name]|||[platform e.g. "Skool", "Patreon", "own course"]|||[price if visible, else "Unknown"]|||[currency]|||[estimated audience size if visible]|||[url if visible]
COMPETITOR_2: [...]|||[...]|||[...]|||[...]|||[...]|||[...]
COMPETITOR_3: [...]|||[...]|||[...]|||[...]|||[...]|||[...]

For BIO_PRODUCT_*: enumerate every paid product, lead magnet, course, ebook, app, community, or service you can identify from the bio text, the external URL, and the multi-link bio array below. Don't invent — only list what's referenced. If the creator only has one product, fill BIO_PRODUCT_1 and put NONE on the rest. If the only link is an aggregator (Linktree / Stan / Beacons) without enough info to enumerate cards, still list it as one product entry referencing the aggregator URL.

For COMPETITOR_*: name 3-5 competitors in the same niche/audience with similar offers. Use known direct competitors when possible; otherwise generic well-known names in the niche. Put NONE if you genuinely don't know any.

Use "NONE" as the whole value for any slot you can't fill — never invent.

=== CREATOR DATA ===
Name: ${profile.name}
Bio: ${profile.bio || 'No bio'}
External URL: ${profile.externalUrl || 'None'}
Instagram multi-link bio: ${(profile.platforms?.instagram?.bioLinks || []).map(l => `${l.title || '(no title)'} → ${l.url}`).join(' | ') || 'None'}
Instagram Followers: ${igRaw?.followers || 0}
Engagement: ${profile.engagement || 'Unknown'}
Verified: ${profile.isVerified}
Business account: ${profile.isBusinessAccount}

Recent posts (most recent first):
${postPerformanceData || 'No post data available'}`,
                }],
              }),
            });

            const analysisData = await analysisResponse.json();
            if (analysisResponse.ok) {
              const analysisText = (analysisData.content || [])
                .filter(b => b.type === 'text')
                .map(b => b.text)
                .join('\n');

              // Basic analysis
              const getNiche = analysisText.match(/^NICHE:\s*(.+)/mi);
              const getProducts = analysisText.match(/^PRODUCTS:\s*(.+)/mi);
              const getReputation = analysisText.match(/^REPUTATION:\s*(.+)/mi);
              const getGender = analysisText.match(/^AUDIENCE_GENDER:\s*(.+)/mi);
              const getAge = analysisText.match(/^AUDIENCE_AGE:\s*(.+)/mi);
              const getLocation = analysisText.match(/^AUDIENCE_LOCATION:\s*(.+)/mi);
              const getLanguage = analysisText.match(/^AUDIENCE_LANGUAGE:\s*(.+)/mi);
              const getInterests = analysisText.match(/^AUDIENCE_INTERESTS:\s*(.+)/mi);

              if (getNiche) profile.niche = getNiche[1].trim();
              if (getProducts && getProducts[1].trim() !== 'None found') {
                profile.products = getProducts[1].trim().split(',').map(p => p.trim()).filter(Boolean);
              }
              if (getReputation && getReputation[1].trim() !== 'No notable mentions') {
                profile.reputation = getReputation[1].trim();
              }

              // Audience estimate
              profile.audienceEstimate = {
                gender: getGender ? getGender[1].trim() : null,
                age: getAge ? getAge[1].trim() : null,
                location: getLocation ? getLocation[1].trim() : null,
                language: getLanguage ? getLanguage[1].trim() : null,
                interests: getInterests ? getInterests[1].trim().split(',').map(i => i.trim()).filter(Boolean) : [],
              };

              // === INTELLIGENCE: Content Analysis ===
              const topPosts = [];
              for (let i = 1; i <= 3; i++) {
                const match = analysisText.match(new RegExp(`^TOP_POST_${i}:\\s*(.+)`, 'mi'));
                if (match) {
                  const parts = match[1].split('|||').map(s => s.trim());
                  if (parts.length >= 4) {
                    topPosts.push({ caption: parts[0], engagementRate: parts[1], format: parts[2], topic: parts[3] });
                  }
                }
              }

              const getReels = analysisText.match(/^FORMAT_REELS:\s*(\d+)/mi);
              const getCarousels = analysisText.match(/^FORMAT_CAROUSELS:\s*(\d+)/mi);
              const getStatic = analysisText.match(/^FORMAT_STATIC:\s*(\d+)/mi);
              const getPostsPerWeek = analysisText.match(/^POSTS_PER_WEEK:\s*([\d.]+)/mi);

              const contentStyle = {
                formatBreakdown: {
                  reels: getReels ? parseInt(getReels[1]) : 0,
                  carousels: getCarousels ? parseInt(getCarousels[1]) : 0,
                  static: getStatic ? parseInt(getStatic[1]) : 0,
                },
                postsPerWeek: getPostsPerWeek ? parseFloat(getPostsPerWeek[1]) : 0,
              };

              // === INTELLIGENCE: Bio Link Products ===
              const isNone = (s) => !s || /^none$/i.test(s) || /^n\/?a$/i.test(s) || /^\[/.test(s) || s === '-';
              const bioLinkProducts = [];
              for (let i = 1; i <= 10; i++) {
                const match = analysisText.match(new RegExp(`^BIO_PRODUCT_${i}:\\s*(.+)`, 'mi'));
                if (match) {
                  const raw = match[1].trim();
                  if (isNone(raw)) continue; // "NONE" as whole value
                  const parts = raw.split('|||').map(s => s.trim());
                  if (parts.length >= 3 && !isNone(parts[0]) && !isNone(parts[2])) {
                    bioLinkProducts.push({
                      url: isNone(parts[0]) ? null : parts[0],
                      platform: isNone(parts[1]) ? 'Unknown' : parts[1],
                      productName: parts[2],
                      price: (parts[3] && !isNone(parts[3]) && parts[3] !== 'Unknown') ? parts[3] : null,
                      currency: (parts[4] && !isNone(parts[4])) ? parts[4] : 'EUR',
                    });
                  }
                }
              }

              // === INTELLIGENCE: Competitors ===
              const competitors = [];
              for (let i = 1; i <= 5; i++) {
                const match = analysisText.match(new RegExp(`^COMPETITOR_${i}:\\s*(.+)`, 'mi'));
                if (match) {
                  const raw = match[1].trim();
                  if (isNone(raw)) continue;
                  const parts = raw.split('|||').map(s => s.trim());
                  if (parts.length >= 2 && !isNone(parts[0])) {
                    competitors.push({
                      name: parts[0],
                      platform: isNone(parts[1]) ? 'Unknown' : parts[1],
                      price: (parts[2] && !isNone(parts[2]) && parts[2] !== 'Unknown') ? parts[2] : null,
                      currency: (parts[3] && !isNone(parts[3])) ? parts[3] : 'EUR',
                      estimatedSize: (parts[4] && !isNone(parts[4]) && parts[4] !== 'Unknown') ? parts[4] : null,
                      url: (parts[5] && !isNone(parts[5])) ? parts[5] : null,
                    });
                  }
                }
              }

              // Store intelligence
              const audienceLanguage = getLanguage ? getLanguage[1].trim() : null;
              profile.intelligence = {
                bioLinks: bioLinkProducts,
                topPosts,
                contentStyle,
                competitors,
                audience: {
                  primaryCountry: getLocation ? getLocation[1].trim() : null,
                  primaryLanguage: audienceLanguage,
                  estimatedAgeRange: getAge ? getAge[1].trim() : null,
                },
              };

              // Resolve deliverable language (pt/en/null) for all asset generation routing
              profile.primaryLanguage = resolvePrimaryLanguage(audienceLanguage);
            }
          } catch {
            // Analysis failed, we still have the raw Apify data
          }
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
