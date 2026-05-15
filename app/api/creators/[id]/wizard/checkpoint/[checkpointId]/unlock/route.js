import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../../../../lib/creators';
import { unlockCheckpoint, applyUnlock, TOTAL_CHECKPOINTS } from '../../../../../../../lib/offerSchema';

// ─────────────────────────────────────────────────────────────────
// POST /api/creators/[id]/wizard/checkpoint/[checkpointId]/unlock
//
// Unlocks a checkpoint AND cascade-invalidates everything downstream.
// Unlocking CP2 wipes CP3 modules, CP4 stack, CP5 copy from
// client_facing_output AND clears their lock timestamps.
//
// This is the only safe way to re-edit an earlier decision — bypassing it
// leaves stale CP3/CP4/CP5 output that no longer reflects the new frame.
//
// Returns the updated checkpoint_progress + the lists of fields that were
// cleared so the UI can refresh / show a notice.
// ─────────────────────────────────────────────────────────────────

export async function POST(_request, { params }) {
  try {
    const { id, checkpointId } = await params;
    const cpId = parseInt(checkpointId, 10);
    if (!Number.isInteger(cpId) || cpId < 1 || cpId > TOTAL_CHECKPOINTS) {
      return NextResponse.json({ error: `Invalid checkpoint id (must be 1-${TOTAL_CHECKPOINTS})` }, { status: 400 });
    }

    const creator = await getCreator(id);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    const offer = creator.offer || {};
    const meta = offer.internal_metadata || {};

    let unlockResult;
    try {
      unlockResult = unlockCheckpoint(meta, cpId);
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const nextOffer = applyUnlock(offer, unlockResult);

    // Persist with a history entry per cleared checkpoint so we can audit
    // how decisions get rewound.
    const cascadeIds = [];
    for (let i = cpId; i <= TOTAL_CHECKPOINTS; i++) cascadeIds.push(i);
    const history = [...(meta.checkpoint_history || [])];
    cascadeIds.forEach(c => {
      history.push({ checkpoint: c, status: c === cpId ? 'overridden' : 'regenerated', at: new Date().toISOString() });
    });

    await updateCreator(id, {
      offer: {
        ...nextOffer,
        internal_metadata: {
          ...nextOffer.internal_metadata,
          checkpoint_history: history,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      checkpoint_progress: unlockResult.progress,
      cleared: {
        internal: unlockResult.internal_clears,
        client: unlockResult.client_clears,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to unlock checkpoint' }, { status: 500 });
  }
}
