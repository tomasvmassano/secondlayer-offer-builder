import { NextResponse } from 'next/server';
import { saveCreator, listCreators, searchCreators } from '../../lib/creators';
import { scrapeCreator, apifyToCreatorProfile, scrapeMultiplePlatforms } from '../../lib/apify';

// Allow up to 60 seconds for Apify scraping
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

        // Step 2: Use Claude to analyze the raw data (niche, products, reputation)
        if (apiKey && profile) {
          try {
            const igRaw = multiResult.igRaw;
            const tkRaw = multiResult.tkRaw;
            const recentContent = [
              ...(igRaw?.recentPosts || []).slice(0, 3).map(p => p.caption),
              ...(tkRaw?.recentVideos || []).slice(0, 3).map(v => v.caption),
            ].filter(Boolean).join(' | ');

            const analysisResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1500,
                messages: [{
                  role: 'user',
                  content: `Analyze this creator's profile data and respond with ONLY these lines:

NICHE: [their niche, e.g. "Food / Baking", "Fitness", "Photography", "Business"]
PRODUCTS: [comma-separated list of anything they sell: courses, workshops, ebooks, merch, or "None found"]
REPUTATION: [any notable achievements, or "No notable mentions"]
AUDIENCE_GENDER: [estimated gender split, e.g. "70% Female, 30% Male" — infer from niche and content style]
AUDIENCE_AGE: [estimated primary age range, e.g. "25-34" — infer from content topics and language style]
AUDIENCE_LOCATION: [estimated primary countries/regions, e.g. "Portugal 60%, Brazil 25%, Other 15%" — infer from bio language, location hints]
AUDIENCE_LANGUAGE: [primary language of content, e.g. "Portuguese 70%, English 20%, Spanish 10%"]
AUDIENCE_INTERESTS: [5 comma-separated audience interest categories, e.g. "Healthy Lifestyle, Meal Prep, Weight Loss, Home Cooking, Fitness" — infer from content themes]

Creator data:
Name: ${profile.name}
Bio: ${profile.bio || 'No bio'}
External URL: ${profile.externalUrl || 'None'}
Platform: ${profile.primaryPlatform}
Instagram Followers: ${igRaw?.followers || 0}
TikTok Followers: ${tkRaw?.followers || 0}
Engagement: ${profile.engagement || 'Unknown'}
Is verified: ${profile.isVerified}
Is business account: ${profile.isBusinessAccount}
Recent content: ${recentContent}
Bio links found: ${(profile.bioLinks || []).map(l => l.title || l.url).join(', ') || 'None'}`,
                }],
              }),
            });

            const analysisData = await analysisResponse.json();
            if (analysisResponse.ok) {
              const analysisText = (analysisData.content || [])
                .filter(b => b.type === 'text')
                .map(b => b.text)
                .join('\n');

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

              // Audience estimate from AI inference
              profile.audienceEstimate = {
                gender: getGender ? getGender[1].trim() : null,
                age: getAge ? getAge[1].trim() : null,
                location: getLocation ? getLocation[1].trim() : null,
                language: getLanguage ? getLanguage[1].trim() : null,
                interests: getInterests ? getInterests[1].trim().split(',').map(i => i.trim()).filter(Boolean) : [],
              };
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
