import { NextResponse } from 'next/server';
import { listCreators, getCreator } from '../../../lib/creators';
import { getCurrentUser } from '../../../lib/auth';

/**
 * GET /api/unfollow/due
 *
 * End-of-cycle unfollow cleanup. Returns the current operator's creators who:
 *   - went COLD (the outreach cadence auto-cold'd them),
 *   - NEVER replied,
 *   - are past the full cycle — i.e. past the day-45 voice-note revival window,
 *     so we don't unfollow someone still being worked,
 *   - haven't been unfollowed yet.
 *
 * Each item carries the Instagram URL so the /unfollow page can open the
 * profile in a new tab (the operator unfollows manually there) — exactly the
 * "button to their profile" flow the DM tray uses, but kept OFF the CRM.
 */

const DAY_MS = 86_400_000;
const daysBetween = (a, b) => Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);

// Only surface once the WHOLE cycle is done: cadence (day 3/7/14) + auto-cold
// + the day-45 voice-note revival window (ends day 60). Tune here to unfollow
// sooner/later. Anchored on the first DM (or video request).
const UNFOLLOW_AFTER_DAYS = 60;

export async function GET(request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ items: [], total: 0 }, { status: 401 });

  const now = new Date();
  const summaries = await listCreators();

  // Cheap summary gate: cold + never-replied + mine + not-yet-unfollowed +
  // reached out to (has a DM/request anchor) + past the full cycle.
  const candidates = summaries.filter(s => {
    if ((s.pipelineStatus || 'prospect') !== 'cold') return false;
    if (s.repliedAt) return false;                       // only never-repliers
    if (s.unfollowedAt) return false;                    // already done
    if (s.addedByUserId !== user.userId) return false;   // only mine
    const anchor = s.videoRequestedAt || s.dmSentAt || null;
    if (!anchor) return false;                           // never actually reached out
    return daysBetween(anchor, now) >= UNFOLLOW_AFTER_DAYS;
  });

  // Batch-load the (small) candidate set for the IG url + fresh guards.
  const fulls = [];
  for (let i = 0; i < candidates.length; i += 25) {
    const chunk = candidates.slice(i, i + 25);
    fulls.push(...await Promise.all(chunk.map(s => getCreator(s.id).catch(() => null))));
  }

  const items = [];
  for (const c of fulls) {
    if (!c) continue;
    const out = c.outreach || {};
    if (out.repliedAt || out.unfollowedAt) continue;            // re-check on the full record
    if (c.pipelineStatus !== 'cold') continue;
    const igUrl = c.platforms?.instagram?.url
      || (c.platforms?.instagram?.handle
            ? `https://instagram.com/${c.platforms.instagram.handle.replace(/^@/, '')}`
            : null);
    if (!igUrl) continue;                                       // no profile → can't unfollow
    const handle = c.platforms?.instagram?.handle
      ? c.platforms.instagram.handle.replace(/^@/, '')
      : null;
    const anchor = out.videoRequestedAt || out.dmSentAt || null;
    // Silence = days since the last thing we did (follow-up, voice note, video
    // request, or the first DM), so the operator sees how long it's been quiet.
    const lastTouch = out.voiceNotedAt || out.lastFollowUpAt || out.videoSentAt || out.videoRequestedAt || out.dmSentAt || null;
    items.push({
      id: c.id,
      name: c.name,
      niche: c.niche,
      handle,
      profilePicUrl: c.profilePicUrl || null,
      igUrl,
      daysCold: anchor ? daysBetween(anchor, now) : null,      // days since first contact
      daysSilent: lastTouch ? daysBetween(lastTouch, now) : null,
    });
  }

  // Longest-silent first — the ones most overdue for cleanup on top.
  items.sort((a, b) => (b.daysCold || 0) - (a.daysCold || 0));

  return NextResponse.json({ items, total: items.length });
}
