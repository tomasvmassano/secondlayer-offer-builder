import { NextResponse } from 'next/server';
import { createTicket, listTickets } from '../../lib/tickets';
import { getCurrentUser } from '../../lib/auth';
import { sendTicketCreatedEmail } from '../../lib/ticketEmail';

export async function GET() {
  try {
    const tickets = await listTickets();
    return NextResponse.json(tickets);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    if (!data.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Capture the signed-in user's email so we can notify them when their
    // ticket gets resolved. Best-effort: if for any reason no session is
    // attached (middleware should make this impossible on /support, but
    // just in case), we fall back to whatever submitterEmail the client
    // happened to send.
    const user = await getCurrentUser(request).catch(() => null);
    const submitterEmail = user?.email || data.submitterEmail || null;

    const result = await createTicket({ ...data, submitterEmail });

    // Fire the triage notification to Tomas. Fire-and-forget — if the
    // email service hiccups the ticket should still land in the board.
    sendTicketCreatedEmail({ ...data, ...result, submitterEmail })
      .catch(err => console.error('[tickets/POST] created-email failed:', err));

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
