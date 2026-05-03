import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
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
    },
  });
}
