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
// voiceNote (day-45 revival of a cold lead) is the rarest + most deliberate, so
// it pins to the very top. pediuVideo (asked for the video, not sent yet) is the
// warmest live lead — they asked and we owe the send — so it sorts next.
const URGENCY = { voiceNote: 6, pediuVideo: 5, videoNudge: 4, lastTouch: 3, valueDrop: 2, softNudge: 1 };
const VIDEO_NUDGE_DAY = 2; // days after videoSentAt before the first nudge is due
const PEDIU_VIDEO_NUDGE_DAY = 2; // days after videoRequestedAt before the first nudge is due
const VOICE_NOTE_DAY = 45; // days after first DM / video request before the day-45 voice note
const VOICE_NOTE_WINDOW_END = 60; // upper bound so old cold leads don't resurface in bulk

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

  // ── Video→booking nudges (volume model) ──
  // Separate pass: these creators REPLIED (so they're excluded above) and got
  // the generic video but haven't booked. Summary-only gate first, then a full
  // fetch for the ones that qualify.
  const videoCandidates = summaries.filter(s => {
    const st = s.pipelineStatus || 'prospect';
    if (st === 'signed' || st === 'cold') return false;
    if (s.addedByUserId !== user.userId) return false;
    if (!s.videoSentAt) return false;
    if (s.callBookedAt || s.callHeldAt || s.pitchSentAt) return false;
    return daysBetween(s.videoSentAt, now) >= VIDEO_NUDGE_DAY;
  });
  const videoFulls = [];
  for (let i = 0; i < videoCandidates.length; i += 25) {
    const chunk = videoCandidates.slice(i, i + 25);
    videoFulls.push(...await Promise.all(chunk.map(s => getCreator(s.id).catch(() => null))));
  }
  for (const c of videoFulls) {
    if (!c) continue;
    const out = c.outreach || {};
    if (out.callBookedAt || out.callAgreedAt || out.callHeldAt || c.pitch?.sentAt) continue;
    if (!out.videoSentAt) continue;
    const vdays = daysBetween(out.videoSentAt, now);
    if (vdays < VIDEO_NUDGE_DAY) continue;
    // Deduped: skip if the operator already nudged in the last couple of days.
    if (out.videoNudgedAt && daysBetween(out.videoNudgedAt, now) < VIDEO_NUDGE_DAY) continue;
    const creatorFirstName = (c.name || '').split(/\s+/)[0] || 'pessoa';
    const ownerFirstName = out.videoSentBy?.firstName || c.addedBy?.firstName || 'Raul';
    const lang = (c.primaryLanguage || 'pt').toLowerCase();
    const langCode = lang === 'en' ? 'en' : lang === 'es' ? 'es' : 'pt';
    const igUrl = c.platforms?.instagram?.url
      || (c.platforms?.instagram?.handle ? `https://instagram.com/${c.platforms.instagram.handle.replace(/^@/, '')}` : null);
    items.push({
      id: c.id,
      name: c.name,
      niche: c.niche,
      profilePicUrl: c.profilePicUrl || null,
      daysSinceDM: vdays, // reused for sort — here it's days-since-video
      followUpsDone: 0,
      milestone: 'videoNudge',
      milestoneLabel: 'Vídeo',
      dmText: buildFollowUpDm('videoNudge', creatorFirstName, ownerFirstName, langCode),
      igUrl,
      hasContactEmail: !!(c.contactEmail || c.email),
      contactEmail: c.contactEmail || c.email || null,
      emailSubject: null,
      emailBody: null,
    });
  }

  // ── Pediu-vídeo nudges (volume model) ──
  // Creators who asked for / accepted the video (videoRequestedAt) but we
  // haven't sent it yet (no videoSentAt) and they haven't booked. They also
  // REPLIED, so they're excluded from the top pass — separate gate here.
  const pediuCandidates = summaries.filter(s => {
    const st = s.pipelineStatus || 'prospect';
    if (st === 'signed' || st === 'cold') return false;
    if (s.addedByUserId !== user.userId) return false;
    if (!s.videoRequestedAt) return false;
    if (s.videoSentAt) return false; // already sent → handled by the video pass
    if (s.callBookedAt || s.callHeldAt || s.pitchSentAt) return false;
    return daysBetween(s.videoRequestedAt, now) >= PEDIU_VIDEO_NUDGE_DAY;
  });
  const pediuFulls = [];
  for (let i = 0; i < pediuCandidates.length; i += 25) {
    const chunk = pediuCandidates.slice(i, i + 25);
    pediuFulls.push(...await Promise.all(chunk.map(s => getCreator(s.id).catch(() => null))));
  }
  for (const c of pediuFulls) {
    if (!c) continue;
    const out = c.outreach || {};
    if (out.videoSentAt) continue;
    if (out.callBookedAt || out.callAgreedAt || out.callHeldAt || c.pitch?.sentAt) continue;
    if (!out.videoRequestedAt) continue;
    const pdays = daysBetween(out.videoRequestedAt, now);
    if (pdays < PEDIU_VIDEO_NUDGE_DAY) continue;
    // Deduped: skip if the operator already nudged in the last day.
    if (out.pediuVideoNudgedAt && daysBetween(out.pediuVideoNudgedAt, now) < PEDIU_VIDEO_NUDGE_DAY) continue;
    const creatorFirstName = (c.name || '').split(/\s+/)[0] || 'pessoa';
    const ownerFirstName = out.videoRequestedBy?.firstName || c.addedBy?.firstName || 'Raul';
    const lang = (c.primaryLanguage || 'pt').toLowerCase();
    const langCode = lang === 'en' ? 'en' : lang === 'es' ? 'es' : 'pt';
    const igUrl = c.platforms?.instagram?.url
      || (c.platforms?.instagram?.handle ? `https://instagram.com/${c.platforms.instagram.handle.replace(/^@/, '')}` : null);
    items.push({
      id: c.id,
      name: c.name,
      niche: c.niche,
      profilePicUrl: c.profilePicUrl || null,
      daysSinceDM: pdays, // reused for sort — here it's days-since-request
      followUpsDone: 0,
      milestone: 'pediuVideo',
      milestoneLabel: 'Pediu vídeo',
      dmText: buildFollowUpDm('pediuVideo', creatorFirstName, ownerFirstName, langCode),
      igUrl,
      hasContactEmail: !!(c.contactEmail || c.email),
      contactEmail: c.contactEmail || c.email || null,
      emailSubject: null,
      emailBody: null,
    });
  }

  // ── Day-45 voice-note revival (cold leads) ──
  // Unlike every other pass, this one deliberately INCLUDES cold creators — the
  // whole point is to revive a lead that went cold without converting, with a
  // single manual voice note (script attached). Auto-declined leads
  // (notInterestedAt) are excluded. Anchored on the video request if they asked,
  // else the first DM. Windowed + deduped (voiceNotedAt) so it stays a one-off.
  const voiceCandidates = summaries.filter(s => {
    if ((s.pipelineStatus || 'prospect') !== 'cold') return false;
    if (s.addedByUserId !== user.userId) return false;
    const anchor = s.videoRequestedAt || s.dmSentAt || null;
    if (!anchor) return false;
    const d = daysBetween(anchor, now);
    return d >= VOICE_NOTE_DAY && d <= VOICE_NOTE_WINDOW_END;
  });
  const voiceFulls = [];
  for (let i = 0; i < voiceCandidates.length; i += 25) {
    const chunk = voiceCandidates.slice(i, i + 25);
    voiceFulls.push(...await Promise.all(chunk.map(s => getCreator(s.id).catch(() => null))));
  }
  for (const c of voiceFulls) {
    if (!c) continue;
    const out = c.outreach || {};
    if (out.notInterestedAt) continue;                                   // said no → leave alone
    if (out.callBookedAt || out.callAgreedAt || out.callHeldAt || c.pitch?.sentAt) continue; // progressed → skip
    // Dedup ONLY on the operator-action field (voiceNotedAt), NOT the cron's
    // remindersSent.voiceNote45 — the cron sets that just by emailing the count,
    // and the tray must keep showing the task until it's actually done.
    if (out.voiceNotedAt) continue;
    const anchor = out.videoRequestedAt || out.dmSentAt || c.dmSequence?.generatedAt || null;
    if (!anchor) continue;
    const vdays = daysBetween(anchor, now);
    if (vdays < VOICE_NOTE_DAY || vdays > VOICE_NOTE_WINDOW_END) continue;
    const creatorFirstName = (c.name || '').split(/\s+/)[0] || 'pessoa';
    const ownerFirstName = out.videoRequestedBy?.firstName || out.dmSentBy?.firstName || c.addedBy?.firstName || 'Raul';
    const lang = (c.primaryLanguage || 'pt').toLowerCase();
    const langCode = lang === 'en' ? 'en' : lang === 'es' ? 'es' : 'pt';
    const igUrl = c.platforms?.instagram?.url
      || (c.platforms?.instagram?.handle ? `https://instagram.com/${c.platforms.instagram.handle.replace(/^@/, '')}` : null);
    items.push({
      id: c.id,
      name: c.name,
      niche: c.niche,
      profilePicUrl: c.profilePicUrl || null,
      daysSinceDM: vdays, // reused for sort — here it's days-since-anchor
      followUpsDone: 0,
      milestone: 'voiceNote',
      milestoneLabel: 'Nota de voz',
      dmText: buildFollowUpDm('voiceNote', creatorFirstName, ownerFirstName, langCode),
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
      voiceNote: items.filter(i => i.milestone === 'voiceNote').length,
      pediuVideo: items.filter(i => i.milestone === 'pediuVideo').length,
      videoNudge: items.filter(i => i.milestone === 'videoNudge').length,
      lastTouch: items.filter(i => i.milestone === 'lastTouch').length,
      valueDrop: items.filter(i => i.milestone === 'valueDrop').length,
      softNudge: items.filter(i => i.milestone === 'softNudge').length,
    },
  });
}
