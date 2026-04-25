import { NextResponse } from 'next/server';
import { saveCreator, listCreators, searchCreators } from '../../lib/creators';
import { scrapeCreator, apifyToCreatorProfile, scrapeMultiplePlatforms } from '../../lib/apify';
import { resolvePrimaryLanguage } from '../../lib/language';

// Allow up to 120 seconds for Apify scraping + intelligence analysis
export const maxDuration = 120;

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

    // Step 1: Try Apify multi-platform scraping
    if (instagramUrl || tiktokUrl || youtubeUrl) {
      const multiResult = await scrapeMultiplePlatforms(instagramUrl, tiktokUrl, youtubeUrl);

      if (multiResult.source === 'apify' && multiResult.profile) {
        profile = multiResult.profile;

        // Store youtubeUrl — only set platform stub if Apify didn't already populate it
        if (youtubeUrl) {
          if (!profile.platforms.youtube) {
            profile.platforms.youtube = { url: youtubeUrl, subscribers: 0 };
          }
          profile.youtubeUrl = youtubeUrl;
        }
        if (tiktokUrl) profile.tiktokUrl = tiktokUrl;

        // Step 2: Use Claude to analyze the raw data (niche, products, reputation, intelligence)
        if (apiKey && profile) {
          try {
            const igRaw = multiResult.igRaw;
            const tkRaw = multiResult.tkRaw;
            const allPosts = [
              ...(igRaw?.recentPosts || []).map(p => ({ caption: p.caption, likes: p.likes, comments: p.comments, type: p.type || 'image', platform: 'Instagram' })),
              ...(tkRaw?.recentVideos || []).map(v => ({ caption: v.caption, likes: v.likes, comments: v.comments, views: v.views, shares: v.shares, platform: 'TikTok' })),
            ];
            const recentContent = allPosts.slice(0, 6).map(p => p.caption).filter(Boolean).join(' | ');

            // Build post performance data for content analysis
            const postPerformanceData = allPosts.slice(0, 12).map((p, i) =>
              `Post ${i + 1} [${p.platform}${p.type ? '/' + p.type : ''}]: "${(p.caption || '').slice(0, 100)}" — ${p.likes || 0} likes, ${p.comments || 0} comments${p.views ? ', ' + p.views + ' views' : ''}`
            ).join('\n');

            // Build bio links data
            const bioLinksData = (profile.bioLinks || []).map(l => `- ${l.title || 'Link'}: ${l.url}`).join('\n') || 'None found';

            const analysisResponse = await fetch('https://api.anthropic.com/v1/messages', {
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
                messages: [{
                  role: 'user',
                  content: `You are analyzing a content creator's profile to build a complete intelligence report. Respond with ONLY the lines below, filled in accurately.

=== BASIC ANALYSIS ===
NICHE: [their niche, e.g. "Food / Baking", "Fitness", "Photography", "Business"]
PRODUCTS: [comma-separated list of anything they sell: courses, workshops, ebooks, merch, communities, or "None found"]
REPUTATION: [any notable achievements, media mentions, awards, or "No notable mentions"]

=== AUDIENCE ESTIMATE ===
AUDIENCE_GENDER: [estimated gender split, e.g. "70% Female, 30% Male"]
AUDIENCE_AGE: [estimated primary age range, e.g. "25-34"]
AUDIENCE_LOCATION: [estimated primary countries, e.g. "Portugal 60%, Brazil 25%, Other 15%"]
AUDIENCE_LANGUAGE: [primary language of content, e.g. "Portuguese 80%, English 20%"]
AUDIENCE_INTERESTS: [5 comma-separated audience interest categories]

=== CONTENT ANALYSIS ===
TOP_POST_1: [caption snippet]|||[engagement rate vs avg]|||[format: reel/carousel/static/video]|||[topic]
TOP_POST_2: [caption snippet]|||[engagement rate vs avg]|||[format]|||[topic]
TOP_POST_3: [caption snippet]|||[engagement rate vs avg]|||[format]|||[topic]
FORMAT_REELS: [estimated % of content that is reels/videos, e.g. "60"]
FORMAT_CAROUSELS: [estimated % carousels, e.g. "25"]
FORMAT_STATIC: [estimated % static/single image, e.g. "15"]
POSTS_PER_WEEK: [estimated average posts per week, e.g. "4.2"]

=== BIO LINK PRODUCTS ===
IMPORTANT: If the creator has an External URL (especially Linktree, Stan Store, Beacons, or similar), you MUST search for that URL to find all their links and products. Visit/search "${profile.externalUrl || 'none'}" to discover what they sell.
For each product/service found, detect the platform (Skool, Hotmart, Gumroad, Teachable, Kajabi, Stan Store, Shopify, Linktree, personal site) and pricing if visible.
BIO_PRODUCT_1: [url]|||[platform detected]|||[product name]|||[price or "Unknown"]|||[currency or "EUR"]
BIO_PRODUCT_2: [url]|||[platform]|||[product name]|||[price]|||[currency]
BIO_PRODUCT_3: [url]|||[platform]|||[product name]|||[price]|||[currency]
BIO_PRODUCT_4: [url]|||[platform]|||[product name]|||[price]|||[currency]
BIO_PRODUCT_5: [url]|||[platform]|||[product name]|||[price]|||[currency]
(Include ALL links/products found on their Linktree or bio page. Write "NONE" only if genuinely no products detected.)

=== COMPETITORS ===
Search for the top 3-5 creators/businesses in this creator's niche who sell courses, communities, or digital products in the same language/market. Include pricing if you can find it.
COMPETITOR_1: [name]|||[platform: Skool/Hotmart/YouTube/Instagram/Website]|||[price or "Unknown"]|||[currency]|||[estimated community size or "Unknown"]|||[url]
COMPETITOR_2: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]
COMPETITOR_3: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]
COMPETITOR_4: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]
COMPETITOR_5: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]
(Include as many as found, up to 5.)

=== CREATOR DATA ===
Name: ${profile.name}
Bio: ${profile.bio || 'No bio'}
External URL: ${profile.externalUrl || 'None'}
Platform: ${profile.primaryPlatform}
Instagram Followers: ${igRaw?.followers || 0}
TikTok Followers: ${tkRaw?.followers || 0}
Engagement: ${profile.engagement || 'Unknown'}
Is verified: ${profile.isVerified}
Is business account: ${profile.isBusinessAccount}

Bio links found:
${bioLinksData}

Recent posts with performance:
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
          model: 'claude-sonnet-4-20250514',
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

    const { id } = await saveCreator(profile);
    return NextResponse.json({ id, creator: { id, ...profile } });
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
