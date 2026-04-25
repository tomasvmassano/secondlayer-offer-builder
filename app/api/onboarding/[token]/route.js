import { NextResponse } from 'next/server';
import { findByOnboardingToken, updateCreator } from '../../../lib/creators';

/**
 * GET /api/onboarding/[token]
 * Public endpoint — loads the creator's profile + saved responses by token.
 * Returns only the fields needed by the form (no sensitive internals).
 */
export async function GET(request, { params }) {
  const { token } = params;
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  try {
    const creator = await findByOnboardingToken(token);
    if (!creator) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });

    return NextResponse.json({
      creatorId: creator.id,
      creatorName: creator.name,
      niche: creator.niche,
      profilePicUrl: creator.profilePicUrl,
      primaryLanguage: creator.primaryLanguage,
      onboarding: {
        status: creator.onboarding?.status || 'not_started',
        responses: creator.onboarding?.responses || {},
        formStartedAt: creator.onboarding?.formStartedAt,
        formCompletedAt: creator.onboarding?.formCompletedAt,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/onboarding/[token]
 * Public endpoint — debounced auto-save of form responses.
 * Body: { responses: {...partial} }
 * Updates creator.onboarding.responses (deep-merged).
 */
export async function POST(request, { params }) {
  const { token } = params;
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  try {
    const body = await request.json();
    const creator = await findByOnboardingToken(token);
    if (!creator) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });

    const wasNotStarted = creator.onboarding?.status === 'not_started';
    const updates = {
      onboarding: {
        responses: body.responses || {},
        ...(wasNotStarted ? {
          status: 'form_pending',
          formStartedAt: new Date().toISOString(),
        } : {}),
      },
    };

    const updated = await updateCreator(creator.id, updates);
    return NextResponse.json({
      ok: true,
      status: updated?.onboarding?.status,
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
