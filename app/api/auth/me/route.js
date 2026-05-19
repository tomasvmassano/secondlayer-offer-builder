import { NextResponse } from 'next/server';
import { getCurrentUser, displayFirstName } from '../../../lib/auth';
import { getUser } from '../../../lib/users';

export async function GET(request) {
  const session = await getCurrentUser(request);
  if (!session) return NextResponse.json({ user: null });

  // Pull fresh user from store so role/creatorId stay in sync if they changed.
  const user = await getUser(session.userId);
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      id: user.id, email: user.email, role: user.role,
      creatorId: user.creatorId, name: user.name,
      // displayFirstName resolves the accented Portuguese form for known
      // operators (Tomás/Raúl) — the raw email slug strips the accent.
      // Used by DM Writer to sign messages with the operator's real name.
      firstName: displayFirstName(user),
    },
  });
}
