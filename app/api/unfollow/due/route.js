import { NextResponse } from 'next/server';
import { listCreators, getCreator } from '../../../lib/creators';
import { getCurrentUser } from '../../../lib/auth';

/**
 * GET /api/unfollow/due
 *
 * End-of-cycle unfollow cleanup. Returns the current operator's creators who:
 *   - went COLD (the outreach cadence auto-cold'd them),
 *   - NEVER replied,
 *   - reached the end of the cadence (~day 21),
 *   - haven't been unfollowed yet.
 *
 * Each item carries the Instagram URL so the /unfollow page can open the
 * profile in a new tab (the operator unfollows manually there) — exactly the
 * "button to their profile" flow the DM tray uses, but kept OFF the CRM.
 *
 * ?count=1 returns just the summary-gated count (no full-record reads) for the
 * badge on the /creators header link.
 */

const DAY_MS = 86_400_000;
const daysBetween = (a, b) => Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);

// Surface once the no-reply cadence has run its course and the lead is cold:
// day 3/7/14 follow-ups + the auto-cold buffer land around day 21. Anchored on
// the first DM (or video request). Tune here to unfollow sooner/later.
const UNFOLLOW_AFTER_DAYS = 21;

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
    const anchor = s.dmSentAt || null;
    if (!anchor) return false;                           // never actually reached out
    return daysBetween(anchor, now) >= UNFOLLOW_AFTER_DAYS;
  });

  // Cheap badge count — summary-gated only, no full-record reads.
  const { searchParams } = new URL(request.url);
  if (searchParams.get('count') === '1') {
    return NextResponse.json({ total: candidates.length });
  }

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
    const anchor = out.dmSentAt || null;
    // Silence = days since the last thing we did (follow-up, voice note, or the
    // first DM), so the operator sees how long it's been quiet.
    const lastTouch = out.voiceNotedAt || out.lastFollowUpAt || out.dmSentAt || null;
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
