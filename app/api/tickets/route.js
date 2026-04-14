import { NextResponse } from 'next/server';
import { createTicket, listTickets } from '../../lib/tickets';

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
    const result = await createTicket(data);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
