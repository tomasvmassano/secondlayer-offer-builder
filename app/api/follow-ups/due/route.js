import { NextResponse } from 'next/server';
import { listCreators, getCreator } from '../../../lib/creators';
import { getCurrentUser } from '../../../lib/auth';
import {
  buildFollowUpDm,
  pickStoredFollowUpEmail,
} from '../../cron/dm-reminders/route';

/**
 * GET /api/follow-ups/due
 *
 * Returns the follow-up tasks owed by the signed-in operator. Used by the
 * floating tray on the CRM Kanban (/creators). Each item is fully primed
 * for the click-to-copy → open-Instagram flow — no second fetch needed.
 *
 * Filter rules (mirror the daily-reminders cron):
 *   - Only prospects (no signed, no cold) belonging to the current user
 *     by addedBy.userId.
 *   - DM was sent (outreach.dmSentAt or dmSequence.generatedAt as anchor).
 *   - Creator has not replied.
 *   - Days since DM ≥ next milestone day (3 / 7 / 14).
 *   - followUpsDone count maps to milestone: 0→softNudge, 1→valueDrop,
 *     2→lastTouch. Already-done milestones are skipped.
 *
 * Sorted by urgency (lastTouch first, then valueDrop, then softNudge),
 * then by days-since-DM descending so the most overdue lands on top.
 */

const DAY_MS = 86_400_000;
const daysBetween = (a, b) => Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);

const CADENCE = {
  softNudge: { day: 3,  followUpsDoneCap: 0, label: 'Dia 3'  },
  valueDrop: { day: 7,  followUpsDoneCap: 1, label: 'Dia 7'  },
  lastTouch: { day: 14, followUpsDoneCap: 2, label: 'Dia 14' },
};
// A live lead that already replied is the warmest thing on the board, so the
// post-reply touches (give value, then book) sort above the no-reply cadence.
const URGENCY = { bookNudge: 5, giveValue: 4, lastTouch: 3, valueDrop: 2, softNudge: 1 };
const REPLY_NUDGE_DAY = 2; // days after the reply / last touch before the next post-reply nudge is due

export async function GET(request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ items: [], total: 0 }, { status: 401 });

  const now = new Date();
  const summaries = await listCreators();

  // First-pass filter on the cheap summary: prospect, not cold, not
  // replied, owned by me — all summary fields, zero full-record reads.
  const mine = summaries.filter(s => {
    const st = s.pipelineStatus || 'prospect';
    if (st === 'signed' || st === 'cold') return false;
    if (s.repliedAt) return false;
    return s.addedByUserId === user.userId;
  });

  // Second-pass milestone GATE, still summary-only. The summary carries
  // dmSentAt + followUpsDone, so we can decide who's at a day-3/7/14
  // milestone WITHOUT loading their full record. Only creators that pass
  // this gate get a full fetch (for language, IG url, stored email body).
  // Creators with no dmSentAt but hasDm=true might still have a
  // dmSequence.generatedAt anchor — keep those for the full check too.
  const candidates = mine.filter(s => {
    const anchor = s.dmSentAt || null;
    const followUpsDone = Number(s.followUpsDone) || 0;
    if (!anchor) return !!s.hasDm; // needs full record to read generatedAt
    const days = daysBetween(anchor, now);
    return ['lastTouch', 'valueDrop', 'softNudge'].some(k =>
      days >= CADENCE[k].day && followUpsDone <= CADENCE[k].followUpsDoneCap);
  });

  // Batch-load the (much smaller) candidate set in parallel chunks of 25
  // instead of the old sequential per-owned-prospect loop.
  const fulls = [];
  for (let i = 0; i < candidates.length; i += 25) {
    const chunk = candidates.slice(i, i + 25);
    const loaded = await Promise.all(chunk.map(s => getCreator(s.id).catch(() => null)));
    fulls.push(...loaded);
  }

  const items = [];
  for (const c of fulls) {
    if (!c) continue;
    const out = c.outreach || {};
    if (out.repliedAt) continue;

    const dmAnchor = out.dmSentAt || c.dmSequence?.generatedAt || null;
    if (!dmAnchor) continue;

    const days = daysBetween(dmAnchor, now);
    const followUpsDone = Number(out.followUpsDone) || 0;

    // Pick the highest-priority milestone the creator qualifies for.
    let matched = null;
    for (const key of ['lastTouch', 'valueDrop', 'softNudge']) {
      const cfg = CADENCE[key];
      if (days >= cfg.day && followUpsDone <= cfg.followUpsDoneCap) {
        matched = { key, cfg };
        break;
      }
    }
    if (!matched) continue;

    const creatorFirstName = (c.name || '').split(/\s+/)[0] || 'pessoa';
    const ownerFirstName = c.addedBy?.firstName || 'Raul';
    const lang = (c.primaryLanguage || 'pt').toLowerCase();
    const langCode = lang === 'en' ? 'en' : lang === 'es' ? 'es' : 'pt';
    const igUrl = c.platforms?.instagram?.url
      || (c.platforms?.instagram?.handle
            ? `https://instagram.com/${c.platforms.instagram.handle.replace(/^@/, '')}`
            : null);
    const followUpDm = buildFollowUpDm(matched.key, creatorFirstName, ownerFirstName, langCode);
    const storedFollowUpEmail = pickStoredFollowUpEmail(c, matched.key);
    const hasContactEmail = !!(c.contactEmail || c.email);

    items.push({
      id: c.id,
      name: c.name,
      niche: c.niche,
      profilePicUrl: c.profilePicUrl || null,
      daysSinceDM: days,
      followUpsDone,
      milestone: matched.key,
      milestoneLabel: matched.cfg.label,
      dmText: followUpDm,
      igUrl,
      hasContactEmail,
      contactEmail: c.contactEmail || c.email || null,
      emailSubject: storedFollowUpEmail?.subject || null,
      emailBody: storedFollowUpEmail?.body || null,
    });
  }

  // ── Post-reply booking nudges (value-first) ──
  // Creators who REPLIED (so they're excluded from the no-reply pass above) but
  // haven't booked. First a value drop (give a tailored idea), then nudges toward
  // the call. Summary-only gate, then a full fetch for the ones that qualify.
  const repliedCandidates = summaries.filter(s => {
    const st = s.pipelineStatus || 'prospect';
    if (st === 'signed' || st === 'cold') return false;
    if (s.addedByUserId !== user.userId) return false;
    if (!s.repliedAt) return false;
    if (s.callBookedAt || s.callHeldAt || s.pitchSentAt) return false;
    return daysBetween(s.repliedAt, now) >= REPLY_NUDGE_DAY;
  });
  const repliedFulls = [];
  for (let i = 0; i < repliedCandidates.length; i += 25) {
    const chunk = repliedCandidates.slice(i, i + 25);
    repliedFulls.push(...await Promise.all(chunk.map(s => getCreator(s.id).catch(() => null))));
  }
  for (const c of repliedFulls) {
    if (!c) continue;
    const out = c.outreach || {};
    if (!out.repliedAt) continue;
    if (out.callBookedAt || out.callAgreedAt || out.callHeldAt || c.pitch?.sentAt) continue;
    // No value given yet → drop a tailored idea; otherwise nudge toward the call.
    // Deduped by the most recent post-reply touch.
    const milestone = out.valueGivenAt ? 'bookNudge' : 'giveValue';
    const lastTouchAt = out.bookNudgedAt || out.valueGivenAt || out.repliedAt;
    if (daysBetween(lastTouchAt, now) < REPLY_NUDGE_DAY) continue;
    const rdays = daysBetween(out.repliedAt, now);
    const creatorFirstName = (c.name || '').split(/\s+/)[0] || 'pessoa';
    const ownerFirstName = out.repliedMarkedBy?.firstName || c.addedBy?.firstName || 'Raul';
    const lang = (c.primaryLanguage || 'pt').toLowerCase();
    const langCode = lang === 'en' ? 'en' : lang === 'es' ? 'es' : 'pt';
    const igUrl = c.platforms?.instagram?.url
      || (c.platforms?.instagram?.handle ? `https://instagram.com/${c.platforms.instagram.handle.replace(/^@/, '')}` : null);
    items.push({
      id: c.id,
      name: c.name,
      niche: c.niche,
      profilePicUrl: c.profilePicUrl || null,
      daysSinceDM: rdays, // reused for sort — here it's days-since-reply
      followUpsDone: 0,
      milestone,
      milestoneLabel: milestone === 'giveValue' ? 'Dar valor' : 'Marcar call',
      dmText: buildFollowUpDm(milestone, creatorFirstName, ownerFirstName, langCode),
      igUrl,
      hasContactEmail: !!(c.contactEmail || c.email),
      contactEmail: c.contactEmail || c.email || null,
      emailSubject: null,
      emailBody: null,
    });
  }

  items.sort((a, b) => {
    const u = (URGENCY[b.milestone] || 0) - (URGENCY[a.milestone] || 0);
    if (u !== 0) return u;
    return b.daysSinceDM - a.daysSinceDM;
  });

  return NextResponse.json({
    items,
    total: items.length,
    byMilestone: {
      giveValue: items.filter(i => i.milestone === 'giveValue').length,
      bookNudge: items.filter(i => i.milestone === 'bookNudge').length,
      lastTouch: items.filter(i => i.milestone === 'lastTouch').length,
      valueDrop: items.filter(i => i.milestone === 'valueDrop').length,
      softNudge: items.filter(i => i.milestone === 'softNudge').length,
    },
  });
}
