import { NextResponse } from 'next/server';
import { getTeamStats, getDailyScoreboard } from '../../lib/teamStats';

// Read-only endpoint that backs the /equipa dashboard. Middleware ensures
// the caller has a valid session — every team member sees everyone's stats
// (it's a competition, transparency is the point).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const window = searchParams.get('window') || 'today';
    const target = Number(searchParams.get('target')) || 30;

    const valid = ['today', 'week', 'month', 'all'];
    if (!valid.includes(window)) {
      return NextResponse.json({ error: `window must be one of ${valid.join('|')}` }, { status: 400 });
    }

    const rows = await getTeamStats({ window });
    // Today view also returns the scoreboard with the €50 debt math so the
    // dashboard can show who owes whom without a second call.
    const scoreboard = window === 'today' ? await getDailyScoreboard({ target }) : null;

    return NextResponse.json({ window, target, rows, scoreboard });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
