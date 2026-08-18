import { NextResponse } from 'next/server';
import { getCreator, updateCreator, deleteCreator } from '../../../lib/creators';
import { sendWelcomeEmail } from '../../../lib/welcomeEmail';
import { getCurrentUser, displayFirstName } from '../../../lib/auth';
import { computeOutreachStage } from '../../../lib/outreachStages';

// Attribution helper — when a PATCH sets an outreach action timestamp
// (dmSentAt, emailSentAt, lastFollowUpAt, repliedAt) we automatically stamp
// the actor onto the corresponding *By field. Keeps the client side simple
// (no need to pass user info) and centralizes the actor logic on the server.
//
// Each *By field is { userId, firstName, at } — at duplicates the action
// timestamp so a single read can answer "who did this and when".
// firstName uses displayFirstName so we get the accented form ("Tomás" /
// "Raúl") instead of the email-derived ASCII slug. Without this, the CRM
// filter dropdown ends up showing "Tomas" AND "Tomás" as separate values.
function actorFromUser(u, at) {
  if (!u) return null;
  return { userId: u.userId, firstName: displayFirstName(u), at };
}

function stampOutreachActor(outreach, user) {
  if (!outreach || typeof outreach !== 'object' || !user) return outreach;
  const stamped = { ...outreach };
  if (outreach.dmSentAt && !outreach.dmSentBy) {
    stamped.dmSentBy = actorFromUser(user, outreach.dmSentAt);
  }
  if (outreach.emailSentAt && !outreach.emailSentBy) {
    stamped.emailSentBy = actorFromUser(user, outreach.emailSentAt);
  }
  if (outreach.lastFollowUpAt && !outreach.lastFollowUpBy) {
    stamped.lastFollowUpBy = actorFromUser(user, outreach.lastFollowUpAt);
  }
  if (outreach.repliedAt && !outreach.repliedMarkedBy) {
    stamped.repliedMarkedBy = actorFromUser(user, outreach.repliedAt);
  }
  // New sales-funnel stages: call agreed, call held. Stamped the same way.
  if (outreach.callAgreedAt && !outreach.callAgreedBy) {
    stamped.callAgreedBy = actorFromUser(user, outreach.callAgreedAt);
  }
  if (outreach.callHeldAt && !outreach.callHeldBy) {
    stamped.callHeldBy = actorFromUser(user, outreach.callHeldAt);
  }
  // Follow-ups: when a new entry comes in without `by`, stamp it with the
  // signed-in operator. The client sends { channel, at } and we fill in the
  // actor server-side so the team scoreboard can credit it correctly.
  if (Array.isArray(outreach.followUps)) {
    stamped.followUps = outreach.followUps.map(entry => {
      if (entry && !entry.by && entry.at) {
        return { ...entry, by: actorFromUser(user, entry.at) };
      }
      return entry;
    });
  }
  // Unmark cases — clear the *By when *At is null so the field stays consistent.
  if (outreach.dmSentAt === null) stamped.dmSentBy = null;
  if (outreach.emailSentAt === null) stamped.emailSentBy = null;
  if (outreach.repliedAt === null) {
    stamped.repliedMarkedBy = null;
    // Clearing the reply also clears its channel attribution.
    stamped.repliedChannel = null;
  }
  if (outreach.callAgreedAt === null) stamped.callAgreedBy = null;
  if (outreach.callHeldAt === null) stamped.callHeldBy = null;
  return stamped;
}

// Reply attribution (capture gap #1). Given the state a lead was in BEFORE the
// reply landed, work out which touch earned it and which stage it came from.
// Pure derivation from timestamps already on the record, so it costs the
// operator nothing. Runs once, the instant repliedAt first appears.
function computeReplyAttribution(before, repliedAtISO) {
  const o = before?.outreach || {};
  const replyMs = new Date(repliedAtISO).getTime();
  const fu = Array.isArray(o.followUps) ? o.followUps : [];
  const lastFu = fu.length ? fu[fu.length - 1] : null;
  const fuStage = lastFu
    ? (lastFu.milestone === 'lastTouch' ? 'followup_14'
      : lastFu.milestone === 'valueDrop' ? 'followup_7' : 'followup_3')
    : null;
  // Every touch that could have earned the reply, kept only if it landed
  // at-or-before the reply. The latest one wins.
  const cands = [
    { touch: 'dm',         at: o.dmSentAt || o.emailSentAt },
    { touch: fuStage,      at: lastFu?.at },
    { touch: 'voiceNote',  at: o.voiceNotedAt },
  ].filter(c => c.touch && c.at && Number.isFinite(new Date(c.at).getTime()) && new Date(c.at).getTime() <= replyMs);

  const repliedFromStage = computeOutreachStage(before);
  if (!cands.length) {
    return { repliedFromStage, repliedAfterTouch: 'unknown', repliedTouchAgeHrs: null };
  }
  cands.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const top = cands[0];
  const ageHrs = Math.round(((replyMs - new Date(top.at).getTime()) / 3_600_000) * 10) / 10;
  return { repliedFromStage, repliedAfterTouch: top.touch, repliedTouchAgeHrs: ageHrs };
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const creator = await getCreator(id);
    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }
    return NextResponse.json(creator);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Stamp actor info on outreach action timestamps so the team dashboard
    // can answer "who marked the DM sent / replied / etc." per creator.
    // Session is already verified by middleware; we just decode it here.
    const currentUser = await getCurrentUser(request);
    if (body.outreach && currentUser) {
      body.outreach = stampOutreachActor(body.outreach, currentUser);
    }

    const before = await getCreator(id);

    // Reply attribution (capture gap #1) — the first time repliedAt appears,
    // stamp which touch earned the reply and which stage it came from, derived
    // from the pre-reply state. Folded into this same write so it persists atomically.
    if (body.outreach?.repliedAt && !before?.outreach?.repliedAt) {
      body.outreach = { ...body.outreach, ...computeReplyAttribution(before, body.outreach.repliedAt) };
    }

    // Stage-at-loss (capture gap #2) — when a lead first goes cold, record the
    // stage it died in, derived from the pre-cold state. Reason/objection come
    // from the loss prompt; this fills in the "where" automatically.
    if (body.pipelineStatus === 'cold' && before?.pipelineStatus !== 'cold' && body.lostStage == null) {
      body.lostStage = computeOutreachStage(before);
    }

    // Response latency (capture gap #4) — the first time the operator marks
    // their reply sent, derive the lag from the creator's reply. Needs both
    // ends: repliedAt (theirs) and firstResponseAt (ours).
    if (body.outreach?.firstResponseAt && !before?.outreach?.firstResponseAt) {
      const repliedAt = before?.outreach?.repliedAt || body.outreach?.repliedAt;
      if (repliedAt) {
        const hrs = (new Date(body.outreach.firstResponseAt).getTime() - new Date(repliedAt).getTime()) / 3_600_000;
        if (Number.isFinite(hrs)) body.outreach.firstResponseLatencyHrs = Math.max(0, Math.round(hrs * 10) / 10);
      }
    }

    const updated = await updateCreator(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    // Phase 1 trigger — first transition into "signed" sends the welcome / kickoff email.
    const wasSigned = before?.pipelineStatus === 'signed';
    const isSigned = updated?.pipelineStatus === 'signed';
    if (!wasSigned && isSigned) {
      sendWelcomeEmail(updated, request).catch(err => {
        console.error('[creators PATCH] welcome email failed:', err.message);
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteCreator(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
