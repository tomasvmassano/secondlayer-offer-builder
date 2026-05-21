/**
 * Apify integration for scraping Instagram and TikTok profiles.
 *
 * Uses:
 * - apify/instagram-profile-scraper for Instagram
 * - clockworks/tiktok-profile-scraper for TikTok (profile data from first few posts)
 *
 * Falls back to Claude web search if Apify is not configured.
 */

const APIFY_TOKEN = process.env.APIFY_TOKEN;

function hasApify() {
  return !!APIFY_TOKEN;
}

// Extract Instagram's multi-link bio (the "Links" popup on the profile —
// Instagram lets accounts add up to 5 titled links, the array is exposed by
// most scrapers but under different field names across actor versions).
//
// We try every known field name and normalise into a `[{ title, url }]` array.
// Falls back to wrapping the single `externalUrl` if no array is present.
function extractIgBioLinks(p) {
  if (!p) return [];
  const candidates = [
    p.bio_links, p.bioLinks, p.bioLink, p.biolinks,
    p.externalUrls, p.external_urls,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      const out = [];
      for (const item of c) {
        if (typeof item === 'string' && /^https?:\/\//i.test(item)) {
          out.push({ title: '', url: item });
        } else if (item && typeof item === 'object') {
          const url = item.url || item.href || item.link || item.lynx_url || item.web_url || '';
          const title = item.title || item.text || item.linkText || item.lynx_text || '';
          if (url) out.push({ title: String(title || '').trim(), url: String(url).trim() });
        }
      }
      if (out.length > 0) return out;
    }
  }
  // Last resort: wrap the single externalUrl as a one-item list.
  const single = p.externalUrlShimmed || p.externalUrl || p.website || '';
  if (single) return [{ title: '', url: String(single).trim() }];
  return [];
}

async function runApifyActor(actorId, input) {
  // Use sync API with 45-second timeout (fits within Vercel's 60s limit)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50000);

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=45`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      }
    );
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Apify error ${res.status}: ${err.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Scrape Instagram profile via Apify
 * Returns structured creator data
 */
export async function scrapeInstagram(username) {
  // Run Instagram scraper and bot detector in parallel
  const [items, botResult] = await Promise.all([
    runApifyActor('apify~instagram-scraper', {
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: 'details',
      resultsLimit: 1,
    }),
    runApifyActor('louisdeconinck~instagram-bot-detector', {
      username,
    }).catch(() => null),
  ]);

  if (!items || items.length === 0) return null;
  const p = items[0];

  // Calculate engagement from recent posts
  const posts = p.latestPosts || p.recentPosts || [];
  let avgLikes = 0, avgComments = 0;
  if (posts.length > 0) {
    avgLikes = Math.round(posts.reduce((s, post) => s + (post.likesCount || post.likes || 0), 0) / posts.length);
    avgComments = Math.round(posts.reduce((s, post) => s + (post.commentsCount || post.comments || 0), 0) / posts.length);
  }
  const followers = p.followersCount || p.followers || 0;
  const following = p.followsCount || p.followingCount || p.following || 0;
  const engagementRate = followers > 0 ? (((avgLikes + avgComments) / followers) * 100).toFixed(2) + '%' : '0%';

  // Bot score from detector (0 = real, 1 = bot)
  const botData = botResult?.[0] || null;
  const botScore = botData?.botScore ?? botData?.bot_score ?? null;

  // Related profiles (competitors suggested by Instagram)
  // Capture up to 15 — Instagram typically returns 8-12, we keep whatever is available.
  const related = (p.relatedProfiles || p.similarAccounts || []).slice(0, 15).map(r => ({
    username: r.username || '',
    fullName: r.fullName || r.full_name || '',
    followers: r.followersCount || r.edge_followed_by?.count || 0,
    url: r.username ? `https://instagram.com/${r.username}` : '',
    profilePicUrl: r.profilePicUrl || r.profile_pic_url || '',
  }));

  return {
    name: p.fullName || p.name || p.username || username,
    bio: p.biography || p.bio || p.description || '',
    // Business / public contact email exposed by IG profile pages. Field
    // names vary by Apify actor version — check every plausible shape.
    // Falls back to a regex scan over the bio text below in the merger.
    publicEmail: p.publicEmail || p.public_email || p.email || null,
    businessEmail: p.businessEmail || p.business_email || p.businessContactEmail || null,
    followers,
    following,
    postCount: p.postsCount || p.mediaCount || p.postCount || 0,
    isVerified: p.verified || p.isVerified || false,
    isBusinessAccount: p.isBusinessAccount || p.isBusiness || false,
    externalUrl: p.externalUrl || p.externalUrlShimmed || p.website || '',
    externalUrls: p.externalUrls || [],
    // Instagram's multi-link bio (the "Links" popup) — `[{ title, url }]`.
    // Reads multiple Apify field aliases; falls back to wrapping externalUrl.
    igBioLinks: extractIgBioLinks(p),
    profilePicUrl: p.profilePicUrlHD || p.profilePicUrl || p.profilePic || '',
    engagementRate,
    avgLikes,
    avgComments,
    followerFollowingRatio: following > 0 ? (followers / following).toFixed(1) : '0',
    botScore,
    relatedProfiles: related,
    // Capture up to 30 captions (whatever Apify actually returned, capped).
    // Used downstream by the Phase 2 archetype classifier — it needs breadth
    // of caption signal to classify content patterns reliably.
    recentPosts: posts.slice(0, 30).map(post => ({
      caption: (post.caption || '').slice(0, 240),
      likes: post.likesCount || post.likes || 0,
      comments: post.commentsCount || post.comments || 0,
      timestamp: post.timestamp || '',
      type: post.type || 'image',
    })),
    _debug: Object.keys(p).filter(k => !['latestPosts', 'recentPosts'].includes(k)),
  };
}

/**
 * Lean Instagram scrape for discovery pipeline — skips bot detector and
 * related profiles lookup. Returns just what's needed for deal scoring.
 * ~€0.15 per call vs ~€0.30 for full scrapeInstagram.
 */
export async function scrapeInstagramBasic(username) {
  if (!APIFY_TOKEN) return null;

  const items = await runApifyActor('apify~instagram-scraper', {
    directUrls: [`https://www.instagram.com/${username}/`],
    resultsType: 'details',
    resultsLimit: 1,
  }).catch(() => null);

  if (!items || items.length === 0) return null;
  const p = items[0];

  const posts = p.latestPosts || p.recentPosts || [];
  let avgLikes = 0, avgComments = 0;
  if (posts.length > 0) {
    avgLikes = Math.round(posts.reduce((s, post) => s + (post.likesCount || post.likes || 0), 0) / posts.length);
    avgComments = Math.round(posts.reduce((s, post) => s + (post.commentsCount || post.comments || 0), 0) / posts.length);
  }
  const followers = p.followersCount || p.followers || 0;
  const following = p.followsCount || p.followingCount || p.following || 0;
  const engagementRate = followers > 0 ? (((avgLikes + avgComments) / followers) * 100).toFixed(2) + '%' : '0%';

  return {
    username,
    name: p.fullName || p.name || p.username || username,
    bio: p.biography || p.bio || p.description || '',
    publicEmail: p.publicEmail || p.public_email || p.email || null,
    businessEmail: p.businessEmail || p.business_email || p.businessContactEmail || null,
    followers,
    following,
    postCount: p.postsCount || p.mediaCount || p.postCount || 0,
    isVerified: p.verified || p.isVerified || false,
    isBusinessAccount: p.isBusinessAccount || p.isBusiness || false,
    externalUrl: p.externalUrl || p.externalUrlShimmed || p.website || '',
    igBioLinks: extractIgBioLinks(p),
    profilePicUrl: p.profilePicUrlHD || p.profilePicUrl || p.profilePic || '',
    engagementRate,
    avgLikes,
    avgComments,
    followerFollowingRatio: following > 0 ? (followers / following).toFixed(1) : '0',
    recentPosts: posts.slice(0, 6).map(post => ({
      caption: (post.caption || '').slice(0, 200),
      likes: post.likesCount || post.likes || 0,
      comments: post.commentsCount || post.comments || 0,
      type: post.type || 'image',
    })),
  };
}

/**
 * Scrape Linktree / bio link pages for product URLs
 */
// Generic email extractor. Defensive against obfuscated forms commonly seen
// in bios ("name [at] domain dot com", "name@domain dot com", spaces in
// "name @ domain.com"). Returns the FIRST email found, or null. We bias toward
// the first match because creators usually put the contact-of-record first
// in their bio.
export function extractEmail(text) {
  if (!text || typeof text !== 'string') return null;
  // Step 1: normalise common obfuscations into plain @ and . characters.
  let s = text;
  s = s.replace(/\s*\[\s*at\s*\]\s*|\s+at\s+/gi, '@');
  s = s.replace(/\s*\[\s*dot\s*\]\s*|\s+dot\s+/gi, '.');
  s = s.replace(/\s*\(\s*at\s*\)\s*/gi, '@');
  s = s.replace(/\s+@\s+/g, '@');
  // Step 2: standard email regex. Allows hyphens and dots in local part.
  const m = s.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (!m) return null;
  const email = m[0].toLowerCase();
  // Step 3: reject obvious non-personal addresses that show up in marketing
  // boilerplate scraped alongside bios.
  if (/^(noreply|no-reply|donotreply|do-not-reply|info@instagram|info@meta|press@|support@meta|abuse@)/i.test(email)) {
    return null;
  }
  return email;
}

export async function scrapeBioLinks(url) {
  if (!url) return { links: [], email: null };
  // Only scrape known link-in-bio services
  const bioServices = ['linktr.ee', 'linktree.com', 'beacons.ai', 'stan.store', 'carrd.co', 'taplink.cc', 'allmylinks.com', 'linkin.bio', 'bio.link', 'linkr.bio'];
  const isBioService = bioServices.some(d => url.toLowerCase().includes(d));
  if (!isBioService) return { links: [], email: null };

  try {
    const items = await runApifyActor('ahmed_jasarevic~linktree-beacons-bio-email-scraper-extract-leads', {
      urls: [url],
    });
    if (!items || items.length === 0) return { links: [], email: null };

    const links = [];
    let email = null;
    for (const item of items) {
      // The actor's name promises it extracts emails — check every plausible
      // field shape it might return them in, plus a regex fallback over
      // whatever text content came back.
      if (!email) {
        const candidate = item.email || item.contactEmail || item.contact_email
          || (Array.isArray(item.emails) ? item.emails[0] : null)
          || extractEmail(item.bio || item.description || item.title || '')
          || extractEmail(JSON.stringify(item).slice(0, 5000));
        if (candidate) email = extractEmail(candidate) || (typeof candidate === 'string' ? candidate.toLowerCase() : null);
      }
      if (item.links) {
        for (const link of item.links) {
          links.push({ title: link.title || link.text || '', url: link.url || link.href || '' });
        }
      }
      if (item.url && item.title) {
        links.push({ title: item.title, url: item.url });
      }
    }
    return { links: links.filter(l => l.url), email };
  } catch {
    return { links: [], email: null };
  }
}

/**
 * Scrape TikTok profile via Apify
 * Returns structured creator data
 */
async function scrapeTikTok(username) {
  const items = await runApifyActor('clockworks~tiktok-profile-scraper', {
    profiles: [username],
    resultsPerPage: 6,
    profileScrapeSections: ['videos'],
  });

  if (!items || items.length === 0) return null;

  // TikTok scraper returns video items — extract profile info from the first one
  const first = items[0];
  const authorMeta = first.authorMeta || {};

  // Calculate avg views from videos
  const avgViews = items.length > 0
    ? Math.round(items.reduce((s, v) => s + (v.playCount || 0), 0) / items.length)
    : 0;

  return {
    name: authorMeta.name || authorMeta.nickName || username,
    bio: authorMeta.signature || '',
    followers: authorMeta.fans || 0,
    following: authorMeta.following || 0,
    totalLikes: authorMeta.heart || 0,
    videoCount: authorMeta.video || 0,
    isVerified: authorMeta.verified || false,
    profilePicUrl: authorMeta.avatar || '',
    avgViews,
    recentVideos: items.slice(0, 6).map(v => ({
      caption: (v.text || '').slice(0, 200),
      views: v.playCount || 0,
      likes: v.diggCount || 0,
      comments: v.commentCount || 0,
      shares: v.shareCount || 0,
    })),
  };
}

/**
 * Scrape YouTube channel via Apify
 * Returns structured channel data with recent videos
 */
async function scrapeYouTube(channelUrl) {
  const items = await runApifyActor('streamers~youtube-channel-scraper', {
    startUrls: [{ url: channelUrl }],
    maxResults: 3,
    maxResultsShorts: 0,
    maxResultStreams: 0,
  });

  if (!items || items.length === 0) return null;

  // Filter out error items (e.g. NO_VIDEOS)
  const validItems = items.filter(v => !v.error && v.title);

  // Extract channel info from first item (even error items have aboutChannelInfo)
  const first = items[0];
  const about = first.aboutChannelInfo || {};
  const channelName = about.channelName || first.channelName || '';

  // numberOfSubscribers can be a string like "1.2K" or a number
  let subscribers = 0;
  const rawSubs = about.numberOfSubscribers ?? first.channelSubscribers ?? first.numberOfSubscribers ?? 0;
  if (typeof rawSubs === 'string') {
    const m = rawSubs.replace(/[,\s]/g, '').match(/([\d.]+)\s*([KkMm])?/);
    if (m) {
      subscribers = parseFloat(m[1]);
      if (/k/i.test(m[2] || '')) subscribers *= 1000;
      if (/m/i.test(m[2] || '')) subscribers *= 1000000;
      subscribers = Math.round(subscribers);
    }
  } else {
    subscribers = rawSubs || 0;
  }

  // Parse totalViews similarly
  let totalViews = 0;
  const rawViews = about.channelTotalViews ?? first.channelTotalViews ?? 0;
  if (typeof rawViews === 'string') {
    totalViews = parseInt(rawViews.replace(/[,\s]/g, ''), 10) || 0;
  } else {
    totalViews = rawViews || 0;
  }

  // Parse totalVideos
  let totalVideos = 0;
  const rawVids = about.channelTotalVideos ?? first.channelTotalVideos ?? first.channelVideoCount ?? 0;
  if (typeof rawVids === 'string') {
    totalVideos = parseInt(rawVids.replace(/[,\s]/g, ''), 10) || 0;
  } else {
    totalVideos = rawVids || 0;
  }

  const videos = validItems.map(v => ({
    title: (v.title || '').slice(0, 150),
    views: v.viewCount || 0,
    likes: v.likes || 0,
    comments: v.commentsCount || 0,
    date: v.date || '',
    url: v.url || '',
    duration: v.duration || '',
  }));

  // Compute averages from scraped videos
  const avgViews = videos.length > 0 ? Math.round(videos.reduce((s, v) => s + v.views, 0) / videos.length) : 0;

  // View-based engagement: avg views / subscribers (since likes/comments not available from this scraper)
  const viewEngagement = subscribers > 0 ? ((avgViews / subscribers) * 100).toFixed(1) + '%' : '';

  return {
    name: channelName,
    subscribers,
    totalViews,
    videoCount: totalVideos,
    channelUrl: about.channelUrl || first.channelUrl || channelUrl,
    channelDescription: about.channelDescription || '',
    isVerified: about.isChannelVerified || first.isChannelVerified || false,
    avatarUrl: about.channelAvatarUrl || '',
    joinedDate: about.channelJoinedDate || '',
    avgViews,
    viewEngagement,
    recentVideos: videos,
  };
}

/**
 * Scrape multiple platforms in parallel and merge into one profile.
 * Returns a merged creator profile object (not raw scrape data).
 */
export async function scrapeMultiplePlatforms(instagramUrl, tiktokUrl, youtubeUrl) {
  if (!hasApify()) return { error: 'APIFY_TOKEN not configured', source: 'none' };

  const tasks = [];

  if (instagramUrl) {
    const match = instagramUrl.match(/instagram\.com\/([^/?]+)/i);
    const username = match ? match[1].replace(/^@/, '') : '';
    if (username) tasks.push(scrapeInstagram(username).then(d => ({ platform: 'instagram', data: d, url: instagramUrl })).catch(() => ({ platform: 'instagram', data: null, url: instagramUrl })));
  }

  if (tiktokUrl) {
    const match = tiktokUrl.match(/tiktok\.com\/@?([^/?]+)/i);
    const username = match ? match[1].replace(/^@/, '') : '';
    if (username) tasks.push(scrapeTikTok(username).then(d => ({ platform: 'tiktok', data: d, url: tiktokUrl })).catch(() => ({ platform: 'tiktok', data: null, url: tiktokUrl })));
  }

  if (youtubeUrl) {
    tasks.push(scrapeYouTube(youtubeUrl).then(d => ({ platform: 'youtube', data: d, url: youtubeUrl })).catch(() => ({ platform: 'youtube', data: null, url: youtubeUrl })));
  }

  if (tasks.length === 0) return { error: 'No valid URLs provided', source: 'none' };

  const results = await Promise.all(tasks);

  // Build merged profile
  const igResult = results.find(r => r.platform === 'instagram');
  const tkResult = results.find(r => r.platform === 'tiktok');
  const ytResult = results.find(r => r.platform === 'youtube');
  const igData = igResult?.data;
  const tkData = tkResult?.data;
  const ytData = ytResult?.data;

  // Pick name/bio from whichever platform returned data (prefer Instagram)
  const name = igData?.name || tkData?.name || ytData?.name || 'Unknown';
  const bio = igData?.bio || tkData?.bio || '';
  const profilePicUrl = igData?.profilePicUrl || tkData?.profilePicUrl || '';

  // Scrape bio links in parallel if external URL is a link-in-bio service.
  // The actor also returns emails — capture them so the operator gets a
  // contact email surfaced as early as possible (zero extra API cost).
  const externalUrl = igData?.externalUrl || '';
  let bioLinks = [];
  let bioLinksEmail = null;
  if (externalUrl) {
    const result = await scrapeBioLinks(externalUrl).catch(() => ({ links: [], email: null }));
    bioLinks = result.links || [];
    bioLinksEmail = result.email || null;
  }

  // Email priority. Cheapest-first cascade. Steps 1-6 use already-fetched
  // data and add zero latency. Step 7 fetches the externalUrl when it's a
  // non-aggregator personal site — adds at most one 10s HTTP request, only
  // fires when nothing earlier matched. Expanded 2026-05-21 because
  // operators were manually finding emails the original cascade skipped.
  //
  //   1. IG explicit business/public email     (canonical, when set)
  //   2. Aggregator-page email                  (Linktree etc, when scraped)
  //   3. IG bio regex
  //   4. TikTok bio regex                       (NEW)
  //   5. YouTube channel description regex      (NEW)
  //   6. Bio-link titles regex                  (NEW)
  //   7. External URL fetch — mailto: anchors   (NEW — personal sites)
  //      first, then visible-text regex
  //
  // First non-null hit wins. extractEmail() handles obfuscated forms
  // ("name [at] domain dot com") so this catches more than a vanilla regex.
  const bioLinksText = (bioLinks || [])
    .map(l => `${l.title || ''} ${l.url || ''}`)
    .join(' ');
  let contactEmail = igData?.publicEmail
    || igData?.businessEmail
    || bioLinksEmail
    || extractEmail(bio)
    || extractEmail(tkData?.bio || '')
    || extractEmail(ytData?.channelDescription || '')
    || extractEmail(bioLinksText)
    || null;

  // Personal-site fallback. Only fires when we have an externalUrl that
  // ISN'T a known bio-link aggregator (those were already handled by
  // scrapeBioLinks at step 2). One HTTP request, soft-fails on timeout.
  // Scope is deliberately narrow — chasing emails across every external
  // URL would blow the scrape budget on creators who already have one.
  if (!contactEmail && externalUrl) {
    const aggregatorHosts = ['linktr.ee', 'linktree.com', 'beacons.ai', 'stan.store', 'carrd.co', 'taplink.cc', 'allmylinks.com', 'linkin.bio', 'bio.link', 'linkr.bio'];
    const isAggregator = aggregatorHosts.some(d => externalUrl.toLowerCase().includes(d));
    if (!isAggregator) {
      try {
        const { findEmailOnUrl } = await import('./urlPreview.js');
        contactEmail = await findEmailOnUrl(externalUrl);
      } catch {
        // dynamic import failed (shouldn't, but stay quiet) — leave email null
      }
    }
  }

  const profile = {
    name,
    niche: '',
    primaryPlatform: igData ? 'Instagram' : 'TikTok',
    engagement: igData?.engagementRate || '',
    bio,
    externalUrl,
    contactEmail,
    isVerified: igData?.isVerified || tkData?.isVerified || false,
    isBusinessAccount: igData?.isBusinessAccount || false,
    profilePicUrl,
    platforms: {},
    products: [],
    bioLinks,
    competitors: igData?.relatedProfiles || [],
    reputation: '',
    research: '',
    _apifyDebug: igData?._debug || null,
  };

  if (igData) {
    profile.platforms.instagram = {
      followers: igData.followers || 0,
      following: igData.following || 0,
      postCount: igData.postCount || 0,
      avgLikes: igData.avgLikes || 0,
      avgComments: igData.avgComments || 0,
      followerFollowingRatio: igData.followerFollowingRatio || '0',
      engagementRate: igData.engagementRate || '',
      botScore: igData.botScore,
      url: instagramUrl,
      // IG's multi-link bio — the popup with up to 5 titled links. Captured
      // verbatim from Apify so the operator can see every link the creator
      // is funnelling traffic to (not just the primary externalUrl).
      bioLinks: igData.igBioLinks || [],
      recentPosts: igData.recentPosts || [],
    };
  }

  if (tkData) {
    profile.platforms.tiktok = {
      followers: tkData.followers || 0,
      following: tkData.following || 0,
      totalLikes: tkData.totalLikes || 0,
      videoCount: tkData.videoCount || 0,
      avgViews: tkData.avgViews || 0,
      url: tiktokUrl,
      recentVideos: tkData.recentVideos || [],
    };
  }

  if (ytData) {
    profile.platforms.youtube = {
      subscribers: ytData.subscribers || 0,
      totalViews: ytData.totalViews || 0,
      videoCount: ytData.videoCount || 0,
      avgViews: ytData.avgViews || 0,
      viewEngagement: ytData.viewEngagement || '',
      isVerified: ytData.isVerified || false,
      joinedDate: ytData.joinedDate || '',
      url: ytData.channelUrl || youtubeUrl,
      recentVideos: ytData.recentVideos || [],
    };
  }

  // Return both profile and raw data for Claude analysis
  return {
    source: 'apify',
    profile,
    igRaw: igData,
    tkRaw: tkData,
    ytRaw: ytData,
  };
}

/**
 * LEAN multi-platform scrape — top of funnel.
 *
 * Hits Instagram ONLY (basic actor, no bot detector, no related profiles),
 * just enough to compute the Deal Score and write a personalized DM.
 * TikTok/YouTube URLs are stored as platform stubs (no scrape) so the
 * Deal Score's Multi-Platform metric can still count them. Apify cost
 * drops from ~€0.45-0.60 down to ~€0.10-0.12 per creator.
 *
 * Use this for new prospects. Promote to full via /api/creators/[id]/full-scrape
 * once the creator engages — that's when we need TikTok/YouTube data + bot
 * detector + bio-link product discovery to build the offer.
 *
 * Output shape mirrors scrapeMultiplePlatforms so the route logic in
 * /api/creators is interchangeable.
 */
export async function scrapeLean(instagramUrl, tiktokUrl, youtubeUrl) {
  if (!hasApify()) return { error: 'APIFY_TOKEN not configured', source: 'none' };

  let igData = null;
  if (instagramUrl) {
    const match = instagramUrl.match(/instagram\.com\/([^/?]+)/i);
    const username = match ? match[1].replace(/^@/, '') : '';
    if (username) {
      igData = await scrapeInstagramBasic(username).catch(() => null);
    }
  }

  if (!igData && !instagramUrl) {
    return { error: 'Lean scrape requires an Instagram URL', source: 'none' };
  }

  const name = igData?.name || 'Unknown';
  const bio = igData?.bio || '';
  const profilePicUrl = igData?.profilePicUrl || '';
  const externalUrl = igData?.externalUrl || '';

  // Email extraction on lean path — IG business profile email first, then a
  // regex scan over the bio text. Aggregator-page email scraping is skipped
  // here (kept for the full scrape path) to keep the lean call fast.
  const contactEmail = igData?.publicEmail
    || igData?.businessEmail
    || extractEmail(bio)
    || null;

  const profile = {
    name,
    niche: '',
    primaryPlatform: 'Instagram',
    engagement: igData?.engagementRate || '',
    bio,
    externalUrl,
    contactEmail,
    isVerified: igData?.isVerified || false,
    isBusinessAccount: igData?.isBusinessAccount || false,
    profilePicUrl,
    platforms: {},
    products: [],
    bioLinks: [],
    competitors: [],
    reputation: '',
    research: '',
    scrapeLevel: 'lean',
    leanScrapedAt: Date.now(),
  };

  if (igData) {
    profile.platforms.instagram = {
      followers: igData.followers || 0,
      following: igData.following || 0,
      postCount: igData.postCount || 0,
      avgLikes: igData.avgLikes || 0,
      avgComments: igData.avgComments || 0,
      followerFollowingRatio: igData.followerFollowingRatio || '0',
      engagementRate: igData.engagementRate || '',
      url: instagramUrl,
      // IG multi-link bio captured even on lean scrape — it's the same Apify
      // call so no extra cost. Lets us inspect ecosystem links on day one.
      bioLinks: igData.igBioLinks || [],
      recentPosts: (igData.recentPosts || []).slice(0, 5),
    };
  }
  // Store TikTok/YouTube as URL-only stubs. Full-scrape upgrades these with
  // real follower counts later.
  if (tiktokUrl) {
    profile.platforms.tiktok = { url: tiktokUrl, followers: 0, _stub: true };
    profile.tiktokUrl = tiktokUrl;
  }
  if (youtubeUrl) {
    profile.platforms.youtube = { url: youtubeUrl, subscribers: 0, _stub: true };
    profile.youtubeUrl = youtubeUrl;
  }

  return {
    source: 'apify-lean',
    profile,
    igRaw: igData,
    tkRaw: null,
    ytRaw: null,
  };
}

/**
 * Convert Apify scrape data into our creator profile format
 */
export function apifyToCreatorProfile(scrapeData, url) {
  if (scrapeData.error || scrapeData.source === 'none') return null;

  const profile = {
    name: scrapeData.name || scrapeData.username || 'Unknown',
    niche: '', // Will be filled by Claude analysis
    primaryPlatform: scrapeData.platform,
    engagement: scrapeData.engagementRate || '',
    bio: scrapeData.bio || '',
    externalUrl: scrapeData.externalUrl || '',
    isVerified: scrapeData.isVerified || false,
    isBusinessAccount: scrapeData.isBusinessAccount || false,
    profilePicUrl: scrapeData.profilePicUrl || '',
    platforms: {},
    products: [],
    reputation: '',
    research: '',
  };

  if (scrapeData.platform === 'Instagram') {
    profile.platforms.instagram = {
      followers: scrapeData.followers || 0,
      following: scrapeData.following || 0,
      postCount: scrapeData.postCount || 0,
      avgLikes: scrapeData.avgLikes || 0,
      avgComments: scrapeData.avgComments || 0,
      followerFollowingRatio: scrapeData.followerFollowingRatio || '0',
      url,
      recentPosts: scrapeData.recentPosts || [],
    };
    profile.engagement = scrapeData.engagementRate || '';
  }

  if (scrapeData.platform === 'TikTok') {
    profile.platforms.tiktok = {
      followers: scrapeData.followers || 0,
      following: scrapeData.following || 0,
      totalLikes: scrapeData.totalLikes || 0,
      videoCount: scrapeData.videoCount || 0,
      avgViews: scrapeData.avgViews || 0,
      url,
      recentVideos: scrapeData.recentVideos || [],
    };
  }

  return profile;
}
