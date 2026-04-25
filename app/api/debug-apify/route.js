import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET(request) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return NextResponse.json({ error: 'No APIFY_TOKEN' });

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') || 'youtube';
  const url = searchParams.get('url') || 'https://www.youtube.com/@andreteixeira';

  try {
    let actorId, input;

    if (platform === 'youtube') {
      actorId = 'streamers~youtube-channel-scraper';
      input = { startUrls: [{ url }], maxResults: 3, maxResultsShorts: 0, maxResultStreams: 0 };
    } else if (platform === 'instagram') {
      const username = url.match(/instagram\.com\/([^/?]+)/i)?.[1] || url;
      actorId = 'apify~instagram-scraper';
      input = { directUrls: [`https://www.instagram.com/${username}/`], resultsType: 'details', resultsLimit: 1 };
    } else {
      return NextResponse.json({ error: 'Unsupported platform' });
    }

    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=45`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(50000),
      }
    );

    if (!res.ok) return NextResponse.json({ error: `Apify ${res.status}`, body: await res.text().catch(() => '') });

    const items = await res.json();
    if (!items?.length) return NextResponse.json({ error: 'No items', raw: items });

    // Return all field names + first item raw
    return NextResponse.json({
      count: items.length,
      fieldNames: Object.keys(items[0]),
      items: items.map(item => {
        const trimmed = {};
        for (const [k, v] of Object.entries(item)) {
          if (typeof v === 'string' && v.length > 300) trimmed[k] = v.slice(0, 300) + '...';
          else trimmed[k] = v;
        }
        return trimmed;
      }),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
