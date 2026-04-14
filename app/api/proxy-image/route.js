import { NextResponse } from 'next/server';

const ALLOWED_DOMAINS = [
  'instagram.com',
  'cdninstagram.com',
  'fbcdn.net',
  'googleusercontent.com',
  'ggpht.com',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'apify.com',
  'apifyusercontent.com',
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const parsed = new URL(imageUrl);
    const isAllowed = ALLOWED_DOMAINS.some(d => parsed.hostname.endsWith(d));
    if (!isAllowed) {
      return new NextResponse('Domain not allowed', { status: 403 });
    }

    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return new NextResponse('Image fetch failed', { status: 502 });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    });
  } catch {
    return new NextResponse('Image proxy error', { status: 502 });
  }
}
