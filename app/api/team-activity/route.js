import { NextResponse } from 'next/server';
import { getRecentActivity } from '../../lib/teamStats';

// Full team-activity feed for /equipa/atividade. Middleware already gates this
// to a valid session. One aggregation (all events post-reset, newest first),
// capped so a huge history can't blow the response up.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 200, 1), 500);
    const events = await getRecentActivity({ limit });
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
