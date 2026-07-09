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

    // Notify the team — before this existed, a creator completing the
    // 30-question form produced NO signal anywhere; operators only found
    // out by manually opening the workspace. Best-effort: a Resend
    // failure must never fail the creator's submit.
    notifyTeamFormComplete(creator).catch(() => {});

    return NextResponse.json({
      ok: true,
      status: updated?.onboarding?.status,
      completedAt: updated?.onboarding?.formCompletedAt,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Team notification on form completion. Hardcoded operator list matches
// the cron digests (no TEAM_EMAILS env by design — see dm-reminders).
const OPERATORS = ['tomas@informallabs.com', 'raul@informallabs.com', 'carolina@informallabs.com'];
const HUB_BASE = process.env.NEXT_PUBLIC_HUB_URL || 'https://hub.secondlayerhq.com';

async function notifyTeamFormComplete(creator) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const url = `${HUB_BASE}/creators/${creator.id}`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: 'Second Layer Hub <hub@informallabs.com>',
      to: OPERATORS,
      subject: `[Second Layer] ${creator.name} completou o onboarding ✓`,
      html: `
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6">
          <p><strong>${creator.name}</strong> acabou de submeter o formulário de onboarding (10 obrigatórias + opcionais).</p>
          <p>Próximo passo: rever as respostas e agendar a kickoff call.</p>
          <p><a href="${url}" style="color:#B11E2F;font-weight:bold">Abrir workspace no hub →</a></p>
        </div>`,
    }),
  });
}
