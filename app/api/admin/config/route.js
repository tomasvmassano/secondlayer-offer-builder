import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
import { getSalesConfig, setSalesConfig } from '../../../lib/adminInfra';

// Team-gated sales-target config (monthly goal, ticket, daily DM target,
// working days, quarterly quota). Persisted in Redis; the /admin "Config de
// vendas" panel edits it. Input-only values, no secrets.
async function requireTeam(request) {
  const u = await getCurrentUser(request);
  return u && u.role === 'team' ? u : null;
}

export async function GET(request) {
  if (!await requireTeam(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ sales: await getSalesConfig() });
}

export async function POST(request) {
  if (!await requireTeam(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const sales = await setSalesConfig(body || {});
  return NextResponse.json({ sales });
}
