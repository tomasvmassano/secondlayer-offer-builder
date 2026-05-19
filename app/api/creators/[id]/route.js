import { NextResponse } from 'next/server';
import { getCreator, updateCreator, deleteCreator } from '../../../lib/creators';
import { sendWelcomeEmail } from '../../../lib/welcomeEmail';
import { getCurrentUser, displayFirstName } from '../../../lib/auth';

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
  // Unmark cases — clear the *By when *At is null so the field stays consistent.
  if (outreach.dmSentAt === null) stamped.dmSentBy = null;
  if (outreach.emailSentAt === null) stamped.emailSentBy = null;
  if (outreach.repliedAt === null) stamped.repliedMarkedBy = null;
  if (outreach.callAgreedAt === null) stamped.callAgreedBy = null;
  if (outreach.callHeldAt === null) stamped.callHeldBy = null;
  return stamped;
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
