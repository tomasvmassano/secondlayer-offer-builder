import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET() {
  const token = process.env.APIFY_TOKEN;
  if (!token) return NextResponse.json({ error: 'No token' });

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=45`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: ['https://www.instagram.com/_andre.teixeira/'],
          resultsType: 'details',
          resultsLimit: 1,
        }),
        signal: AbortSignal.timeout(50000),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Status ${res.status}`, body: await res.text().catch(() => '') });
    }

    const items = await res.json();
    if (!items || items.length === 0) return NextResponse.json({ error: 'No items', raw: items });

    // Return first 3000 chars of raw JSON + all field names
    const first = items[0];
    return NextResponse.json({
      fieldNames: Object.keys(first),
      hasBiography: 'biography' in first,
      hasBio: 'bio' in first,
      hasDescription: 'description' in first,
      hasExternalUrl: 'externalUrl' in first,
      biography: first.biography || null,
      bio: first.bio || null,
      externalUrl: first.externalUrl || null,
      fullName: first.fullName || null,
      followersCount: first.followersCount || null,
      followers: first.followers || null,
      raw: JSON.stringify(first).slice(0, 3000),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
