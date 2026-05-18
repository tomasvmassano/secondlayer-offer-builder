import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { scrapeMultiplePlatforms } from '../../../../lib/apify';
import { resolvePrimaryLanguage } from '../../../../lib/language';
import { syncCreatorEmail } from '../../../../lib/syncEmailToSheet';

// Full scrape takes up to ~90s when all 3 platforms + bot detector + web-search
// products discovery run end-to-end.
export const maxDuration = 120;

// ─────────────────────────────────────────────────────────────────
// Full-scrape endpoint — upgrades a lean creator with the data needed
// to build the offer.
//
// Triggered manually after the creator engages (DM reply / call booked).
// Pulls:
//   - Instagram deep scrape (bot detector + related profiles)
//   - TikTok profile + recent videos
//   - YouTube channel + recent videos
//   - Bio-link products (Linktree / Beacons / Stan Store inspection)
//   - Web-search backed Claude analysis: products, competitors, reputation
//
// Idempotent — running again refreshes the full data.
// ─────────────────────────────────────────────────────────────────

export async function POST(request, { params }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    const { id } = await params;
    const creator = await getCreator(id);
    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    // Resolve URLs — prefer the URLs already on the creator record, fall back
    // to whatever the request body provides (for re-binding misclassified URLs).
    let body = {};
    try { body = await request.json(); } catch {}
    const instagramUrl = body.instagramUrl || creator.platforms?.instagram?.url || '';
    const tiktokUrl    = body.tiktokUrl    || creator.tiktokUrl || creator.platforms?.tiktok?.url || '';
    const youtubeUrl   = body.youtubeUrl   || creator.youtubeUrl || creator.platforms?.youtube?.url || '';

    if (!instagramUrl && !tiktokUrl && !youtubeUrl) {
      return NextResponse.json({ error: 'Creator has no platform URLs to scrape' }, { status: 400 });
    }

    // STEP 1 — multi-platform Apify scrape (IG deep + TK + YT + bio links).
    const multiResult = await scrapeMultiplePlatforms(instagramUrl, tiktokUrl, youtubeUrl);
    if (multiResult.source !== 'apify' || !multiResult.profile) {
      return NextResponse.json({ error: 'Apify scrape failed', details: multiResult.error }, { status: 502 });
    }

    // Merge the new platforms/scrape data on top of the existing creator record.
    // We preserve manual edits (name overrides, niche tweaks) made on the lean creator.
    const fresh = multiResult.profile;
    const updates = {
      // Platforms/bio/engagement always overwrite — lean data was stub-quality.
      platforms: { ...creator.platforms, ...fresh.platforms },
      engagement: fresh.engagement || creator.engagement,
      bio: fresh.bio || creator.bio,
      externalUrl: fresh.externalUrl || creator.externalUrl,
      isVerified: fresh.isVerified || creator.isVerified,
      isBusinessAccount: fresh.isBusinessAccount || creator.isBusinessAccount,
      profilePicUrl: fresh.profilePicUrl || creator.profilePicUrl,
      bioLinks: fresh.bioLinks?.length > 0 ? fresh.bioLinks : (creator.bioLinks || []),
      competitors: fresh.competitors?.length > 0 ? fresh.competitors : (creator.competitors || []),
      // Preserve manual fields the user may have edited.
      name: creator.name || fresh.name,
      niche: creator.niche || fresh.niche,
      primaryPlatform: creator.primaryPlatform || fresh.primaryPlatform,
      // Mark the scrape level + timestamp.
      scrapeLevel: 'full',
      fullScrapedAt: Date.now(),
    };

    // STEP 2 — web-search-backed analysis: products, competitors, audience refinement.
    // Skipped if no API key — we still ship the scrape data.
    if (apiKey) {
      try {
        const igRaw = multiResult.igRaw;
        const tkRaw = multiResult.tkRaw;
        const allPosts = [
          ...(igRaw?.recentPosts || []).map(p => ({ caption: p.caption, likes: p.likes, comments: p.comments, type: p.type || 'image', platform: 'Instagram' })),
          ...(tkRaw?.recentVideos || []).map(v => ({ caption: v.caption, likes: v.likes, comments: v.comments, views: v.views, shares: v.shares, platform: 'TikTok' })),
        ];
        const postPerformanceData = allPosts.slice(0, 12).map((p, i) =>
          `Post ${i + 1} [${p.platform}${p.type ? '/' + p.type : ''}]: "${(p.caption || '').slice(0, 100)}" — ${p.likes || 0} likes, ${p.comments || 0} comments${p.views ? ', ' + p.views + ' views' : ''}`
        ).join('\n');
        const bioLinksData = (fresh.bioLinks || []).map(l => `- ${l.title || 'Link'}: ${l.url}`).join('\n') || 'None found';

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
AUDIENCE_GENDER: [estimated gender split]
AUDIENCE_AGE: [estimated primary age range]
AUDIENCE_LOCATION: [estimated primary countries]
AUDIENCE_LANGUAGE: [primary language of content]
AUDIENCE_INTERESTS: [5 comma-separated audience interest categories]

=== CONTENT ANALYSIS ===
TOP_POST_1: [caption snippet]|||[engagement rate vs avg]|||[format: reel/carousel/static/video]|||[topic]
TOP_POST_2: [caption snippet]|||[engagement rate vs avg]|||[format]|||[topic]
TOP_POST_3: [caption snippet]|||[engagement rate vs avg]|||[format]|||[topic]
FORMAT_REELS: [estimated %, e.g. "60"]
FORMAT_CAROUSELS: [estimated %]
FORMAT_STATIC: [estimated %]
POSTS_PER_WEEK: [estimated, e.g. "4.2"]

=== BIO LINK PRODUCTS ===
IMPORTANT: If the creator has an External URL (especially Linktree, Stan Store, Beacons), you MUST search for that URL to find their products. Visit/search "${fresh.externalUrl || 'none'}" to discover what they sell.
For each product/service found, detect the platform and pricing if visible.
BIO_PRODUCT_1: [url]|||[platform]|||[product name]|||[price or "Unknown"]|||[currency or "EUR"]
BIO_PRODUCT_2: [url]|||[platform]|||[product name]|||[price]|||[currency]
BIO_PRODUCT_3: [url]|||[platform]|||[product name]|||[price]|||[currency]
BIO_PRODUCT_4: [url]|||[platform]|||[product name]|||[price]|||[currency]
BIO_PRODUCT_5: [url]|||[platform]|||[product name]|||[price]|||[currency]
(Include ALL links/products found. Write "NONE" only if genuinely no products detected.)

=== COMPETITORS ===
Search for top 3-5 creators/businesses in this niche selling courses/communities/digital products in the same language/market.
COMPETITOR_1: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]
COMPETITOR_2: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]
COMPETITOR_3: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]
COMPETITOR_4: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]
COMPETITOR_5: [name]|||[platform]|||[price]|||[currency]|||[size]|||[url]

=== CREATOR DATA ===
Name: ${fresh.name}
Bio: ${fresh.bio || 'No bio'}
External URL: ${fresh.externalUrl || 'None'}
Platform: ${fresh.primaryPlatform}
Instagram Followers: ${igRaw?.followers || 0}
TikTok Followers: ${tkRaw?.followers || 0}
Engagement: ${fresh.engagement || 'Unknown'}
Verified: ${fresh.isVerified}
Business account: ${fresh.isBusinessAccount}

Bio links found:
${bioLinksData}

Recent posts with performance:
${postPerformanceData || 'No post data available'}`,
            }],
          }),
        });

        const analysisData = await analysisResponse.json();
        if (analysisResponse.ok) {
          const analysisText = (analysisData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');

          const get = (key) => {
            const m = analysisText.match(new RegExp(`^${key}:\\s*(.+)`, 'mi'));
            return m ? m[1].trim() : null;
          };

          if (get('NICHE')) updates.niche = creator.niche || get('NICHE');
          const products = get('PRODUCTS');
          if (products && products !== 'None found') {
            updates.products = products.split(',').map(p => p.trim()).filter(Boolean);
          }
          const reputation = get('REPUTATION');
          if (reputation && reputation !== 'No notable mentions') {
            updates.reputation = reputation;
          }

          updates.audienceEstimate = {
            gender:    get('AUDIENCE_GENDER')    || creator.audienceEstimate?.gender    || null,
            age:       get('AUDIENCE_AGE')       || creator.audienceEstimate?.age       || null,
            location:  get('AUDIENCE_LOCATION')  || creator.audienceEstimate?.location  || null,
            language:  get('AUDIENCE_LANGUAGE')  || creator.audienceEstimate?.language  || null,
            interests: (get('AUDIENCE_INTERESTS') || '').split(',').map(i => i.trim()).filter(Boolean) || creator.audienceEstimate?.interests || [],
          };

          // Content analysis
          const topPosts = [];
          for (let i = 1; i <= 3; i++) {
            const match = analysisText.match(new RegExp(`^TOP_POST_${i}:\\s*(.+)`, 'mi'));
            if (match) {
              const parts = match[1].split('|||').map(s => s.trim());
              if (parts.length >= 4) topPosts.push({ caption: parts[0], engagementRate: parts[1], format: parts[2], topic: parts[3] });
            }
          }
          const reels = parseInt(get('FORMAT_REELS') || '0') || 0;
          const carousels = parseInt(get('FORMAT_CAROUSELS') || '0') || 0;
          const staticPct = parseInt(get('FORMAT_STATIC') || '0') || 0;
          const postsPerWeek = parseFloat(get('POSTS_PER_WEEK') || '0') || 0;
          const contentStyle = { formatBreakdown: { reels, carousels, static: staticPct }, postsPerWeek };

          // Bio-link products
          const isNone = (s) => !s || /^none$/i.test(s) || /^n\/?a$/i.test(s) || /^\[/.test(s) || s === '-';
          const bioLinkProducts = [];
          for (let i = 1; i <= 10; i++) {
            const m = analysisText.match(new RegExp(`^BIO_PRODUCT_${i}:\\s*(.+)`, 'mi'));
            if (m) {
              const raw = m[1].trim();
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

          // Competitors
          const competitors = [];
          for (let i = 1; i <= 5; i++) {
            const m = analysisText.match(new RegExp(`^COMPETITOR_${i}:\\s*(.+)`, 'mi'));
            if (m) {
              const raw = m[1].trim();
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

          updates.intelligence = {
            bioLinks: bioLinkProducts,
            topPosts,
            contentStyle,
            competitors,
            audience: {
              primaryCountry: updates.audienceEstimate.location,
              primaryLanguage: updates.audienceEstimate.language,
              estimatedAgeRange: updates.audienceEstimate.age,
            },
          };

          updates.primaryLanguage = resolvePrimaryLanguage(updates.audienceEstimate.language);
        }
      } catch {
        // Analysis failed — we still save the platform/scrape data.
      }
    }

    const saved = await updateCreator(id, updates);
    // Full scrape may have found an email that the lean scrape missed
    // (aggregator-page extraction only runs in the full path). Fire-and-forget
    // sync — never blocks the response on Sheets API failure.
    syncCreatorEmail(saved).catch(() => {});
    return NextResponse.json({ ok: true, creator: saved });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Full scrape failed' }, { status: 500 });
  }
}
