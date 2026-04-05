import { NextResponse } from 'next/server';
import { saveOffer, listOffers } from '../../lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { id } = await saveOffer(body);
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const offers = await listOffers();
    return NextResponse.json({ offers });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
