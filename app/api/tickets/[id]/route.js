import { NextResponse } from 'next/server';
import { getTicket, updateTicket, deleteTicket } from '../../../lib/tickets';
import { sendTicketResolvedEmail } from '../../../lib/ticketEmail';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const ticket = await getTicket(id);
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(ticket);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const updates = await request.json();

    // Snapshot the previous status BEFORE writing so we can detect the
    // specific transition "→ done" and fire the resolved notification
    // exactly once. Any subsequent PATCH that leaves status='done'
    // unchanged won't re-send.
    const previous = await getTicket(id);
    const wasDone = previous?.status === 'done';

    const updated = await updateTicket(id, updates);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Status transitioned non-done → done: tell the submitter. Best-effort
    // (don't block the PATCH response on the email send).
    if (!wasDone && updated.status === 'done') {
      sendTicketResolvedEmail(updated)
        .catch(err => console.error('[tickets/PATCH] resolved-email failed:', err));
    }

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const ok = await deleteTicket(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
