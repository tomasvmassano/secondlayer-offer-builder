import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
import { listTeamEmails, addTeamEmail, removeTeamEmail, listUsers, deleteUser, findUserByEmail, renameUserEmail } from '../../../lib/users';

async function requireTeam(request) {
  const u = await getCurrentUser(request);
  if (!u || u.role !== 'team') return null;
  return u;
}

// One-time team email switch to the official @secondlayerhq.com addresses.
// Server-side + hardcoded on purpose: auth changes never trust client input.
// Each rename preserves the userId so ALL data + capabilities carry over.
const SECONDLAYER_MIGRATION = [
  { oldEmail: 'tomas@informallabs.com',    newEmail: 'tom@secondlayerhq.com',      name: 'Tomás'    },
  { oldEmail: 'raul@informallabs.com',     newEmail: 'raul@secondlayerhq.com',     name: 'Raúl'     },
  { oldEmail: 'carolina@informallabs.com', newEmail: 'carolina@secondlayerhq.com', name: 'Carolina' },
];

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

  // Fixed-mapping migration — runs BEFORE the per-email validation because it
  // carries no `email` in the body (the mappings are hardcoded server-side).
  if (action === 'migrate-secondlayer') {
    const migration = [];
    for (const m of SECONDLAYER_MIGRATION) {
      try { migration.push(await renameUserEmail(m)); }
      catch (e) { migration.push({ status: 'error', oldEmail: m.oldEmail, newEmail: m.newEmail, message: e.message }); }
    }
    const [emails, users] = await Promise.all([listTeamEmails(), listUsers()]);
    return NextResponse.json({ allowlist: emails, users, migration });
  }

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
