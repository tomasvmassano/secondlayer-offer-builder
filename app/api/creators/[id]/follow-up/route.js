import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { getCurrentUser, displayFirstName } from '../../../../lib/auth';

/**
 * POST /api/creators/:id/follow-up
 * Body: { channel?: 'dm' | 'email', milestone?: 'softNudge' | 'valueDrop' | 'lastTouch' }
 *
 * Atomically records one follow-up touch on the creator's outreach.followUps
 * array. The append model means:
 *   - The Kanban can reclassify the card to followup_3 / 7 / 14 based on
 *     the new array length.
 *   - The cron's remindersSent gate becomes irrelevant — the floating
 *     tray is now the source of truth for "what's actually been sent".
 *
 * This is a write that must happen atomically: load → append → save. We
 * read the full creator, push, then PATCH so the deep-merge in
 * updateCreator re-derives followUpsDone + lastFollowUpAt + lastFollowUpBy.
 */
export async function POST(request, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body = {};
  try { body = await request.json(); } catch { /* empty body is fine */ }
  const channel = body.channel === 'email' ? 'email' : 'dm';
  // videoNudge (video sent → booking) and pediuVideo (asked for the video, not
  // sent yet) are volume-model touches for creators who already replied. They
  // must NOT increment the no-reply followUpsDone counter (that would corrupt
  // the dia-3/7/14 cadence) and must NOT move the card out of its column — they
  // record their own dedup timestamp and leave the derived stage intact.
  const isVideoNudge = body.milestone === 'videoNudge';
  const isPediuVideo = body.milestone === 'pediuVideo';
  // voiceNote is the day-45 revival touch. It's fired against a COLD lead and
  // must not change pipelineStatus or the counter — it only records that the
  // voice note went out (dedup for both the tray and the cron digest).
  const isVoiceNote = body.milestone === 'voiceNote';
  const milestone = ['softNudge', 'valueDrop', 'lastTouch'].includes(body.milestone)
    ? body.milestone
    : null;

  const creator = await getCreator(id);
  if (!creator) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Ownership guard: an operator can only mark their OWN creators as
  // followed-up. Prevents accidental Carolina-marking-Raul's-creator
  // cross-talk on a shared screen.
  if (creator.addedBy?.userId && creator.addedBy.userId !== user.userId) {
    return NextResponse.json({
      error: 'Este criador pertence a outro operador',
      ownedBy: creator.addedBy.firstName || null,
    }, { status: 403 });
  }

  if (isVideoNudge) {
    const at = new Date().toISOString();
    const by = { userId: user.userId, firstName: displayFirstName(user), email: user.email };
    const updated = await updateCreator(id, {
      outreach: { ...creator.outreach, videoNudgedAt: at, videoNudgedBy: by },
    });
    return NextResponse.json({ ok: true, videoNudge: true, creator: updated });
  }

  if (isPediuVideo) {
    const at = new Date().toISOString();
    const by = { userId: user.userId, firstName: displayFirstName(user), email: user.email };
    const updated = await updateCreator(id, {
      outreach: { ...creator.outreach, pediuVideoNudgedAt: at, pediuVideoNudgedBy: by },
    });
    return NextResponse.json({ ok: true, pediuVideo: true, creator: updated });
  }

  if (isVoiceNote) {
    const at = new Date().toISOString();
    const by = { userId: user.userId, firstName: displayFirstName(user), email: user.email };
    const updated = await updateCreator(id, {
      outreach: {
        ...creator.outreach,
        voiceNotedAt: at,
        voiceNotedBy: by,
        // Mirror the cron dedup key so the daily digest won't also chase it.
        remindersSent: { ...(creator.outreach?.remindersSent || {}), voiceNote45: at },
      },
    });
    return NextResponse.json({ ok: true, voiceNote: true, creator: updated });
  }

  const existing = Array.isArray(creator.outreach?.followUps) ? creator.outreach.followUps : [];
  // Hard cap at 3 entries — beyond day-14 the next state is Frio, not a
  // 4th follow-up. Re-clicking after 3 is a no-op.
  if (existing.length >= 3) {
    return NextResponse.json({
      ok: false,
      reason: 'all_followups_done',
      followUpsDone: existing.length,
    });
  }

  const at = new Date().toISOString();
  const by = { userId: user.userId, firstName: displayFirstName(user), email: user.email };
  // If caller didn't pass a milestone, infer from the slot we're filling.
  const inferred = ['softNudge', 'valueDrop', 'lastTouch'][existing.length];
  const entry = { channel, at, by, milestone: milestone || inferred, source: 'tray' };

  const nextFollowUps = [...existing, entry];

  const updated = await updateCreator(id, {
    outreach: {
      ...creator.outreach,
      followUps: nextFollowUps,
      // The lib deep-merge re-derives followUpsDone + lastFollowUpAt
      // from the array, so passing the array alone is enough — but we
      // set them explicitly anyway for clarity and to ensure stale
      // legacy values don't override.
      followUpsDone: nextFollowUps.length,
      lastFollowUpAt: at,
      lastFollowUpBy: by,
    },
  });

  return NextResponse.json({
    ok: true,
    followUpsDone: nextFollowUps.length,
    milestone: entry.milestone,
    creator: updated,
  });
}
