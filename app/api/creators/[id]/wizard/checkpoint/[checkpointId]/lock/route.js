import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../../../../lib/creators';
import { lockCheckpoint, TOTAL_CHECKPOINTS } from '../../../../../../../lib/offerSchema';

// ─────────────────────────────────────────────────────────────────
// POST /api/creators/[id]/wizard/checkpoint/[checkpointId]/lock
//
// Marks a checkpoint as locked (operator-approved). The Phase 4 wizard
// state machine requires every prior CP to be locked before this one can
// lock, so this endpoint relies on lockCheckpoint() in offerSchema.js to
// enforce that invariant.
//
// Side effects: advances checkpoint_progress.current to N+1 (or stays at
// TOTAL_CHECKPOINTS if N == 5) and stamps locked[N] with the current ISO.
// Does NOT mutate the CP's output — operator already approved what's there.
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

    // The wizard requires the CP to actually have output before locking.
    // Without this, an operator could lock CP1 with no strategic_frame and
    // CP2 would have nothing to work with. The check below maps each CP to
    // its required output field.
    const REQUIRED_FIELDS_INTERNAL = { 1: 'strategic_frame' };
    const REQUIRED_FIELDS_CLIENT = {
      2: 'central_promise',          // CP2 hasn't shipped yet — placeholder
      3: 'modules',                  // CP3 hasn't shipped yet
      4: 'value_stack',              // CP4 hasn't shipped yet
      5: 'differentiator_section',   // CP5 hasn't shipped yet
    };
    const internalKey = REQUIRED_FIELDS_INTERNAL[cpId];
    const clientKey = REQUIRED_FIELDS_CLIENT[cpId];
    if (internalKey && !meta[internalKey]) {
      return NextResponse.json({ error: `Cannot lock CP${cpId}: ${internalKey} is missing — generate it first` }, { status: 412 });
    }
    if (clientKey && !(offer.client_facing_output || {})[clientKey]) {
      return NextResponse.json({ error: `Cannot lock CP${cpId}: ${clientKey} is missing — generate it first` }, { status: 412 });
    }

    let nextProgress;
    try {
      nextProgress = lockCheckpoint(meta, cpId);
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 412 });
    }

    await updateCreator(id, {
      offer: {
        ...offer,
        internal_metadata: {
          ...meta,
          checkpoint_progress: nextProgress,
          checkpoint_history: [
            ...(meta.checkpoint_history || []),
            { checkpoint: cpId, status: 'approved', at: new Date().toISOString() },
          ],
        },
      },
    });

    return NextResponse.json({ ok: true, checkpoint_progress: nextProgress });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to lock checkpoint' }, { status: 500 });
  }
}
