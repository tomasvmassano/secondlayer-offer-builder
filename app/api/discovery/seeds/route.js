import { NextResponse } from 'next/server';
import { listSeeds, addSeed, removeSeed } from '../../../lib/discovery';

export async function GET() {
  try {
    const seeds = await listSeeds();
    return NextResponse.json({ seeds });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const urls = Array.isArray(body.urls) ? body.urls : (body.url ? [body.url] : []);
    if (urls.length === 0) {
      return NextResponse.json({ error: 'urls or url required' }, { status: 400 });
    }
    const niche = body.niche || null;
    const country = body.country || null;

    let added = 0;
    for (const url of urls) {
      const ok = await addSeed(url, niche, country);
      if (ok) added++;
    }
    const seeds = await listSeeds();
    return NextResponse.json({ added, total: seeds.length, seeds });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const url = body.url;
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
    const removed = await removeSeed(url);
    const seeds = await listSeeds();
    return NextResponse.json({ removed, total: seeds.length, seeds });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
