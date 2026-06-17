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
const URGENCY = { lastTouch: 3, valueDrop: 2, softNudge: 1 };

export async function GET(request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ items: [], total: 0 }, { status: 401 });

  const now = new Date();
  const summaries = await listCreators();

  // First-pass filter on the cheap summary: prospect, not cold, owned by me.
  const mine = summaries.filter(s => {
    const st = s.pipelineStatus || 'prospect';
    if (st === 'signed' || st === 'cold') return false;
    return s.addedByUserId === user.userId;
  });

  const items = [];
  for (const s of mine) {
    const c = await getCreator(s.id);
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

  items.sort((a, b) => {
    const u = (URGENCY[b.milestone] || 0) - (URGENCY[a.milestone] || 0);
    if (u !== 0) return u;
    return b.daysSinceDM - a.daysSinceDM;
  });

  return NextResponse.json({
    items,
    total: items.length,
    byMilestone: {
      lastTouch: items.filter(i => i.milestone === 'lastTouch').length,
      valueDrop: items.filter(i => i.milestone === 'valueDrop').length,
      softNudge: items.filter(i => i.milestone === 'softNudge').length,
    },
  });
}
