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
async function scrapeInstagram(username) {
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
  const related = (p.relatedProfiles || p.similarAccounts || []).slice(0, 5).map(r => ({
    username: r.username || '',
    fullName: r.fullName || r.full_name || '',
    followers: r.followersCount || r.edge_followed_by?.count || 0,
    url: r.username ? `https://instagram.com/${r.username}` : '',
    profilePicUrl: r.profilePicUrl || r.profile_pic_url || '',
  }));

  return {
    name: p.fullName || p.name || p.username || username,
    bio: p.biography || p.bio || p.description || '',
    followers,
    following,
    postCount: p.postsCount || p.mediaCount || p.postCount || 0,
    isVerified: p.verified || p.isVerified || false,
    isBusinessAccount: p.isBusinessAccount || p.isBusiness || false,
    externalUrl: p.externalUrl || p.externalUrlShimmed || p.website || '',
    externalUrls: p.externalUrls || [],
    profilePicUrl: p.profilePicUrlHD || p.profilePicUrl || p.profilePic || '',
    engagementRate,
    avgLikes,
    avgComments,
    followerFollowingRatio: following > 0 ? (followers / following).toFixed(1) : '0',
    botScore,
    relatedProfiles: related,
    recentPosts: posts.slice(0, 12).map(post => ({
      caption: (post.caption || '').slice(0, 200),
      likes: post.likesCount || post.likes || 0,
      comments: post.commentsCount || post.comments || 0,
      timestamp: post.timestamp || '',
      type: post.type || 'image',
    })),
    _debug: Object.keys(p).filter(k => !['latestPosts', 'recentPosts'].includes(k)),
  };
}

/**
 * Scrape Linktree / bio link pages for product URLs
 */
async function scrapeBioLinks(url) {
  if (!url) return [];
  // Only scrape known link-in-bio services
  const bioServices = ['linktr.ee', 'linktree.com', 'beacons.ai', 'stan.store', 'carrd.co', 'taplink.cc', 'allmylinks.com', 'linkin.bio', 'bio.link', 'linkr.bio'];
  const isBioService = bioServices.some(d => url.toLowerCase().includes(d));
  if (!isBioService) return [];

  try {
    const items = await runApifyActor('ahmed_jasarevic~linktree-beacons-bio-email-scraper-extract-leads', {
      urls: [url],
    });
    if (!items || items.length === 0) return [];

    const links = [];
    for (const item of items) {
      // Extract social links and other URLs
      if (item.links) {
        for (const link of item.links) {
          links.push({ title: link.title || link.text || '', url: link.url || link.href || '' });
        }
      }
      // Some scrapers return flat fields
      if (item.url && item.title) {
        links.push({ title: item.title, url: item.url });
      }
    }
    return links.filter(l => l.url);
  } catch {
    return [];
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
 * Main scrape function — detects platform from URL and scrapes accordingly
 */
export async function scrapeCreator(url) {
  if (!hasApify()) return { error: 'APIFY_TOKEN not configured', source: 'none' };

  const isInstagram = /instagram\.com/i.test(url);
  const isTikTok = /tiktok\.com/i.test(url);

  // Extract username from URL
  let username = '';
  if (isInstagram) {
    const match = url.match(/instagram\.com\/([^/?]+)/i);
    username = match ? match[1].replace(/^@/, '') : '';
  } else if (isTikTok) {
    const match = url.match(/tiktok\.com\/@?([^/?]+)/i);
    username = match ? match[1].replace(/^@/, '') : '';
  }

  if (!username) return { error: 'Could not extract username from URL', source: 'none' };

  try {
    if (isInstagram) {
      const data = await scrapeInstagram(username);
      if (!data) return { error: 'No data returned', source: 'apify' };
      return {
        source: 'apify',
        platform: 'Instagram',
        username,
        ...data,
      };
    }

    if (isTikTok) {
      const data = await scrapeTikTok(username);
      if (!data) return { error: 'No data returned', source: 'apify' };
      return {
        source: 'apify',
        platform: 'TikTok',
        username,
        ...data,
      };
    }

    return { error: 'Unsupported platform', source: 'none' };
  } catch (err) {
    return { error: err.message, source: 'apify' };
  }
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

  // Scrape bio links in parallel if external URL is a link-in-bio service
  const externalUrl = igData?.externalUrl || '';
  let bioLinks = [];
  if (externalUrl) {
    bioLinks = await scrapeBioLinks(externalUrl).catch(() => []);
  }

  const profile = {
    name,
    niche: '',
    primaryPlatform: igData ? 'Instagram' : 'TikTok',
    engagement: igData?.engagementRate || '',
    bio,
    externalUrl,
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
