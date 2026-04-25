import { NextResponse } from 'next/server';
import { getQueueItem, removeFromQueue, addToDismissed } from '../../../lib/discovery';
import { saveCreator } from '../../../lib/creators';
import { scrapeBioLinks, scrapeMultiplePlatforms } from '../../../lib/apify';
import { resolvePrimaryLanguage } from '../../../lib/language';

// Stage 4 needs Claude + optional Linktree scrape
export const maxDuration = 120;

/**
 * POST /api/discovery/[id] — accept candidate, run Stage 4 (full intelligence),
 * add to CRM as Novos, remove from queue.
 */
export async function POST(request, { params }) {
  const { id } = params;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Optional TikTok/YouTube URLs provided manually during acceptance
  let body = {};
  try { body = await request.json(); } catch {}
  const tiktokUrl = body.tiktokUrl?.trim() || null;
  const youtubeUrl = body.youtubeUrl?.trim() || null;

  try {
    const candidate = await getQueueItem(id);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found in queue' }, { status: 404 });
    }

    // Build base profile from Stage 2 data we already have
    const profile = {
      name: candidate.name,
      niche: candidate.niche || '',
      primaryPlatform: 'Instagram',
      engagement: candidate.engagement,
      bio: candidate.bio,
      externalUrl: candidate.externalUrl,
      isVerified: candidate.isVerified,
      isBusinessAccount: candidate.isBusinessAccount,
      profilePicUrl: candidate.profilePicUrl,
      tiktokUrl: tiktokUrl || '',
      youtubeUrl: youtubeUrl || '',
      platforms: {
        instagram: {
          followers: candidate.followers,
          avgLikes: candidate.avgLikes,
          avgComments: candidate.avgComments,
          followerFollowingRatio: candidate.followerFollowingRatio,
          engagementRate: candidate.engagement,
          url: candidate.url,
          recentPosts: candidate.recentPosts || [],
        },
      },
      products: [],
      bioLinks: [],
      competitors: [],
      reputation: '',
      research: '',
    };

    // If TT/YT URLs provided, scrape those platforms and merge data
    if (tiktokUrl || youtubeUrl) {
      try {
        const multi = await scrapeMultiplePlatforms(null, tiktokUrl, youtubeUrl);
        if (multi?.profile?.platforms?.tiktok) {
          profile.platforms.tiktok = multi.profile.platforms.tiktok;
        }
        if (multi?.profile?.platforms?.youtube) {
          profile.platforms.youtube = multi.profile.platforms.youtube;
        }
      } catch {
        // silent fail — TT/YT scrape optional, IG-only save still works
      }
    }

    // Try Linktree scrape if external URL looks like one
    if (candidate.externalUrl) {
      try {
        const bioLinks = await scrapeBioLinks(candidate.externalUrl);
        if (bioLinks?.length > 0) profile.bioLinks = bioLinks;
      } catch {
        // silent fail — optional enhancement
      }
    }

    // Stage 4: Claude intelligence analysis (matches /api/creators logic)
    if (apiKey) {
      try {
        const bioLinksData = (profile.bioLinks || []).map(l => `- ${l.title || 'Link'}: ${l.url}`).join('\n') || 'None found';
        const postPerformanceData = (candidate.recentPosts || []).slice(0, 12).map((p, i) =>
          `Post ${i + 1} [${p.type || 'image'}]: "${(p.caption || '').slice(0, 100)}" — ${p.likes || 0} likes, ${p.comments || 0} comments`
        ).join('\n');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
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
              content: `You are analyzing a content creator's profile to build a complete intelligence report. Respond with ONLY the lines below.

=== BASIC ANALYSIS ===
NICHE: [e.g. "Food / Baking", "Fitness", "Photography", "Business"]
PRODUCTS: [comma-separated list of anything they sell, or "None found"]
REPUTATION: [notable achievements, or "No notable mentions"]

=== AUDIENCE ESTIMATE ===
AUDIENCE_GENDER: [e.g. "70% Female, 30% Male"]
AUDIENCE_AGE: [e.g. "25-34"]
AUDIENCE_LOCATION: [e.g. "Portugal 60%, Brazil 25%, Other 15%"]
AUDIENCE_LANGUAGE: [e.g. "Portuguese 80%, English 20%"]
AUDIENCE_INTERESTS: [5 comma-separated interest categories]

=== CONTENT ANALYSIS ===
TOP_POST_1: [caption snippet]|||[engagement rate vs avg]|||[format]|||[topic]
TOP_POST_2: [caption]|||[rate]|||[format]|||[topic]
TOP_POST_3: [caption]|||[rate]|||[format]|||[topic]
FORMAT_REELS: [%]
FORMAT_CAROUSELS: [%]
FORMAT_STATIC: [%]
POSTS_PER_WEEK: [number]

=== BIO LINK PRODUCTS ===
IMPORTANT: If the creator has an External URL (especially Linktree, Stan Store, Beacons), you MUST search for that URL. Visit/search "${candidate.externalUrl || 'none'}" to discover what they sell.
BIO_PRODUCT_1: [url]|||[platform]|||[product name]|||[price or "Unknown"]|||[currency]
BIO_PRODUCT_2: [url]|||[platform]|||[name]|||[price]|||[currency]
BIO_PRODUCT_3: [url]|||[platform]|||[name]|||[price]|||[currency]
BIO_PRODUCT_4: [url]|||[platform]|||[name]|||[price]|||[currency]
BIO_PRODUCT_5: [url]|||[platform]|||[name]|||[price]|||[currency]
(Write "NONE" only if genuinely no products detected.)

=== COMPETITORS ===
COMPETITOR_1: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]
COMPETITOR_2: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]
COMPETITOR_3: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]
COMPETITOR_4: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]
COMPETITOR_5: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]

=== CREATOR DATA ===
Name: ${profile.name}
Bio: ${profile.bio || 'No bio'}
External URL: ${profile.externalUrl || 'None'}
Platform: Instagram
Instagram Followers: ${profile.platforms.instagram.followers}
Engagement: ${profile.engagement}
Is verified: ${profile.isVerified}
Is business account: ${profile.isBusinessAccount}

Bio links found:
${bioLinksData}

Recent posts:
${postPerformanceData || 'No post data'}`,
            }],
          }),
        });

        const data = await response.json();
        if (response.ok) {
          const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');

          const get = (key) => {
            const match = text.match(new RegExp(`^${key}:\\s*(.+)`, 'mi'));
            return match ? match[1].trim() : null;
          };

          const isNone = (s) => !s || /^none$/i.test(s) || /^n\/?a$/i.test(s) || /^\[/.test(s) || s === '-';

          if (get('NICHE')) profile.niche = get('NICHE');
          const productsRaw = get('PRODUCTS');
          if (productsRaw && productsRaw !== 'None found') {
            profile.products = productsRaw.split(',').map(p => p.trim()).filter(Boolean);
          }
          const reputation = get('REPUTATION');
          if (reputation && reputation !== 'No notable mentions') profile.reputation = reputation;

          profile.audienceEstimate = {
            gender: get('AUDIENCE_GENDER'),
            age: get('AUDIENCE_AGE'),
            location: get('AUDIENCE_LOCATION'),
            language: get('AUDIENCE_LANGUAGE'),
            interests: get('AUDIENCE_INTERESTS') ? get('AUDIENCE_INTERESTS').split(',').map(i => i.trim()) : [],
          };

          // Parse top posts
          const topPosts = [];
          for (let i = 1; i <= 3; i++) {
            const match = text.match(new RegExp(`^TOP_POST_${i}:\\s*(.+)`, 'mi'));
            if (match) {
              const parts = match[1].split('|||').map(s => s.trim());
              if (parts.length >= 4) topPosts.push({ caption: parts[0], engagementRate: parts[1], format: parts[2], topic: parts[3] });
            }
          }

          const reels = parseInt(get('FORMAT_REELS') || '0') || 0;
          const carousels = parseInt(get('FORMAT_CAROUSELS') || '0') || 0;
          const staticPosts = parseInt(get('FORMAT_STATIC') || '0') || 0;
          const postsPerWeek = parseFloat(get('POSTS_PER_WEEK') || '0') || 0;

          // Parse bio link products
          const bioLinkProducts = [];
          for (let i = 1; i <= 10; i++) {
            const match = text.match(new RegExp(`^BIO_PRODUCT_${i}:\\s*(.+)`, 'mi'));
            if (match) {
              const raw = match[1].trim();
              if (isNone(raw)) continue;
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

          // Parse competitors
          const competitors = [];
          for (let i = 1; i <= 5; i++) {
            const match = text.match(new RegExp(`^COMPETITOR_${i}:\\s*(.+)`, 'mi'));
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

          const audienceLanguage = get('AUDIENCE_LANGUAGE');
          profile.intelligence = {
            bioLinks: bioLinkProducts,
            topPosts,
            contentStyle: { formatBreakdown: { reels, carousels, static: staticPosts }, postsPerWeek },
            competitors,
            audience: {
              primaryCountry: get('AUDIENCE_LOCATION'),
              primaryLanguage: audienceLanguage,
              estimatedAgeRange: get('AUDIENCE_AGE'),
            },
          };

          // Resolve deliverable language for all asset generation routing
          profile.primaryLanguage = resolvePrimaryLanguage(audienceLanguage);
        }
      } catch {
        // Intelligence failed — still save with Stage 2 data
      }
    }

    // Save to CRM as Novos (or return existing if already exists)
    const saved = await saveCreator(profile);

    // Remove from discovery queue regardless (duplicate or new)
    await removeFromQueue(id);

    return NextResponse.json({
      id: saved.id,
      duplicate: saved.duplicate || false,
      creator: { id: saved.id, ...profile },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/discovery/[id] — dismiss candidate (blacklist permanently).
 */
export async function DELETE(request, { params }) {
  const { id } = params;
  try {
    const candidate = await getQueueItem(id);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }
    await addToDismissed(candidate.handle);
    await removeFromQueue(id);
    return NextResponse.json({ success: true, dismissed: candidate.handle });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
