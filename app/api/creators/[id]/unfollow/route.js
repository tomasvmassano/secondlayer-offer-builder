import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { getCurrentUser, displayFirstName } from '../../../../lib/auth';

/**
 * POST /api/creators/:id/unfollow
 *
 * Marks a cold, never-replied creator as unfollowed on Instagram (end-of-cycle
 * cleanup). Stamps outreach.unfollowedAt + unfollowedBy so the /unfollow due
 * list drops it. Purely a record flag — the actual unfollow happens by hand on
 * Instagram (this just tracks that it's done). Does NOT touch pipelineStatus.
 *
 * Body: { undo?: boolean } — undo clears the flag (in case of a misclick).
 */
export async function POST(request, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body = {};
  try { body = await request.json(); } catch { /* empty body is fine */ }

  const creator = await getCreator(id);
  if (!creator) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Ownership guard — mirror the follow-up route: only your own creators.
  if (creator.addedBy?.userId && creator.addedBy.userId !== user.userId) {
    return NextResponse.json({
      error: 'Este criador pertence a outro operador',
      ownedBy: creator.addedBy.firstName || null,
    }, { status: 403 });
  }

  const undo = body.undo === true;
  const at = undo ? null : new Date().toISOString();
  const by = undo ? null : { userId: user.userId, firstName: displayFirstName(user), email: user.email };
  const updated = await updateCreator(id, {
    outreach: { ...creator.outreach, unfollowedAt: at, unfollowedBy: by },
  });
  return NextResponse.json({ ok: true, unfollowedAt: at, creator: updated });
}
