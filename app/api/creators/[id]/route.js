import { NextResponse } from 'next/server';
import { getCreator, updateCreator, deleteCreator } from '../../../lib/creators';
import { sendWelcomeEmail } from '../../../lib/welcomeEmail';

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
