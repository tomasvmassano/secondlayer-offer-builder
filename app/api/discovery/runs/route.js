import { NextResponse } from 'next/server';
import { listRecentRuns } from '../../../lib/discovery';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const runs = await listRecentRuns(limit);
    return NextResponse.json({ runs });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
