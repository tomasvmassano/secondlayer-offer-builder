import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { scrapeInstagramBasic } from '../../../../lib/apify';
import { getCurrentUser } from '../../../../lib/auth';

// Fast, DM-focused refresh. Pulls the creator's latest Instagram posts (with
// captions) via Apify so the DM writer's hook is grounded in a REAL recent post
// instead of a generic opener. One profile, ~10-20s, comfortably under the 60s
// cap — the full 3-platform /full-scrape is too heavy for the DM hot path, so
// this is the lean primitive the writer flow calls when a creator has no posts.
export const maxDuration = 60;

// Instagram handle from whatever the record has: the profile URL, an explicit
// username field, or a bare handle. Strips a leading "@".
function igUsername(creator) {
  const url = creator?.platforms?.instagram?.url || creator?.instagramUrl || '';
  const m = String(url).match(/instagram\.com\/([^/?#]+)/i);
  if (m && m[1]) return m[1].replace(/^@/, '').trim();
  const h = creator?.platforms?.instagram?.username || creator?.handle || creator?.instagramHandle || '';
  return String(h).replace(/^@/, '').trim();
}

export async function POST(request, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const creator = await getCreator(id);
  if (!creator) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const username = igUsername(creator);
  if (!username) {
    return NextResponse.json({ error: 'Sem handle de Instagram para atualizar' }, { status: 400 });
  }

  let fresh;
  try {
    fresh = await scrapeInstagramBasic(username);
  } catch (err) {
    return NextResponse.json({ error: `Apify: ${err.message}` }, { status: 502 });
  }
  if (!fresh || !Array.isArray(fresh.recentPosts) || fresh.recentPosts.length === 0) {
    return NextResponse.json({ error: 'O scrape não devolveu posts recentes' }, { status: 502 });
  }

  // Merge the fresh posts (and the engagement signals that come with them) onto
  // the existing Instagram platform blob — everything else on the record stays.
  const ig = { ...(creator.platforms?.instagram || {}) };
  ig.recentPosts = fresh.recentPosts;
  if (fresh.followers) ig.followers = fresh.followers;
  if (fresh.engagementRate) ig.engagementRate = fresh.engagementRate;
  if (fresh.avgLikes) ig.avgLikes = fresh.avgLikes;
  if (fresh.avgComments) ig.avgComments = fresh.avgComments;

  const updated = await updateCreator(id, {
    platforms: { ...(creator.platforms || {}), instagram: ig },
    postsRefreshedAt: Date.now(),
  });

  return NextResponse.json({
    ok: true,
    count: fresh.recentPosts.length,
    recentPosts: fresh.recentPosts,
    creator: updated,
  });
}
