import { NextResponse } from 'next/server';
import { findByOnboardingToken, updateCreator } from '../../../../lib/creators';

/**
 * POST /api/onboarding/[token]/complete
 * Marks the form as complete (creator clicked "Submit").
 * Validates that all 10 required fields are answered, otherwise returns 400.
 */

const REQUIRED_FIELDS = [
  'logo',                  // A1 — at least a placeholder name if no upload
  'topQuestions',          // B6
  'painPoints',            // B7
  'revenueStreams',        // C13
  'emailList',             // C14
  'revenueTarget',         // D19
  'launchDate',            // D21
  'hoursPerWeek',          // D22
  'hardNos',               // E25
  'preferredLanguage',     // F28
];

function isFilled(val) {
  if (val == null) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0 && val.some(v => isFilled(v));
  if (typeof val === 'object') {
    // For object fields like emailList: { size, provider }, require at least one truthy
    return Object.values(val).some(v => isFilled(v));
  }
  if (typeof val === 'number') return val > 0;
  return Boolean(val);
}

export async function POST(request, { params }) {
  const { token } = params;
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  try {
    const creator = await findByOnboardingToken(token);
    if (!creator) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });

    const responses = creator.onboarding?.responses || {};
    const missing = REQUIRED_FIELDS.filter(f => !isFilled(responses[f]));
    if (missing.length > 0) {
      return NextResponse.json({
        error: 'Required fields missing',
        missing,
      }, { status: 400 });
    }

    const updated = await updateCreator(creator.id, {
      onboarding: {
        status: 'form_complete',
        formCompletedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      status: updated?.onboarding?.status,
      completedAt: updated?.onboarding?.formCompletedAt,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
