import { NextResponse } from 'next/server';
import { getOffer } from '../../../lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const offer = await getOffer(id);
    if (!offer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(offer);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
