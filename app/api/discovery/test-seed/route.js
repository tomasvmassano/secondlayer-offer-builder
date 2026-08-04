import { NextResponse } from 'next/server';
import { scrapeInstagram } from '../../../lib/apify';

// Discovery diagnostic — scrape ONE Instagram handle with a generous timeout
// (just 1 scrape, fits the 60s cap) and report exactly what the Apify actor
// returned. The point is to settle *why* discovery scans 0 candidates:
//   - relatedCount > 0  -> the actor DOES return related profiles (so 0 scanned
//     is dedup: they're already in the CRM)
//   - relatedCount 0 but a related-looking key appears in debugKeys -> the actor
//     returns them under a field name our extractor doesn't read (a bug to fix)
//   - relatedCount 0 and no related key in debugKeys -> the actor no longer
//     returns related profiles at all (need a different discovery method)
//
// Usage (logged in as team): /api/discovery/test-seed?handle=natgeo
export const maxDuration = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('handle') || '';
  const handle = raw
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .trim();
  if (!handle) {
    return NextResponse.json({ error: 'handle required, e.g. ?handle=natgeo' }, { status: 400 });
  }

  const t0 = Date.now();
  try {
    const scraped = await scrapeInstagram(handle, { timeoutMs: 45000, apifyTimeoutSec: 42 });
    if (!scraped) {
      return NextResponse.json({ handle, ok: false, error: 'scrape returned null (no data)', ms: Date.now() - t0 });
    }
    const related = scraped.relatedProfiles || [];
    return NextResponse.json({
      handle,
      ok: true,
      ms: Date.now() - t0,
      followers: scraped.followers,
      relatedCount: related.length,
      relatedSample: related.slice(0, 6).map(r => r.username).filter(Boolean),
      // Every field name the actor actually returned — reveals a related field
      // under a name our extractor (relatedProfiles / similarAccounts) misses.
      debugKeys: scraped._debug || [],
    });
  } catch (err) {
    return NextResponse.json({ handle, ok: false, error: err.message, ms: Date.now() - t0 });
  }
}
