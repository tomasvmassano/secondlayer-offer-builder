import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
import { listTeamEmails, addTeamEmail, removeTeamEmail, listUsers, deleteUser, findUserByEmail } from '../../../lib/users';

async function requireTeam(request) {
  const u = await getCurrentUser(request);
  if (!u || u.role !== 'team') return null;
  return u;
}

export async function GET(request) {
  const u = await requireTeam(request);
  if (!u) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const [emails, users] = await Promise.all([listTeamEmails(), listUsers()]);
  return NextResponse.json({ allowlist: emails, users });
}

/**
 * POST /api/admin/team
 * Body: { action: 'add'|'remove', email }
 * For 'remove' we also delete the user record if they exist.
 */
export async function POST(request) {
  const u = await requireTeam(request);
  if (!u) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  const action = body?.action;

  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }

  if (action === 'add') {
    await addTeamEmail(email);
  } else if (action === 'remove') {
    if (email === u.email) {
      return NextResponse.json({ error: "Can't remove yourself." }, { status: 400 });
    }
    await removeTeamEmail(email);
    // Also clear their user record if exists, so they can't sign back in.
    const existing = await findUserByEmail(email);
    if (existing && existing.role === 'team') await deleteUser(existing.id);
  } else {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }

  const [emails, users] = await Promise.all([listTeamEmails(), listUsers()]);
  return NextResponse.json({ allowlist: emails, users });
}
