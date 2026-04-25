/**
 * Welcome / kickoff notification email.
 * Fires when a creator's pipelineStatus first flips to 'signed'.
 *
 * v1: notifies the team (Tomas + Raul) with the onboarding link they can forward
 * to the creator. Creator-direct send happens once we collect a verified contact email.
 */

const NOTIFY_EMAILS = ['tomas@informallabs.com', 'raul@informallabs.com'];
const HUB_BASE = process.env.NEXT_PUBLIC_HUB_URL || 'https://hub.secondlayerhq.com';

export async function sendWelcomeEmail(creator, request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[welcomeEmail] no RESEND_API_KEY — skipping');
    return;
  }

  const origin = request?.headers?.get('origin') || HUB_BASE;
  const token = creator?.onboarding?.token;
  if (!token) {
    console.warn('[welcomeEmail] creator has no onboarding token — skipping');
    return;
  }

  const onboardingUrl = `${origin}/onboarding/${token}`;
  const kickoffUrl = `${origin}/creators/${creator.id}?tab=kickoff`;
  const subject = `[Second Layer] ${creator.name} signed — onboarding ready`;

  const text = `${creator.name} just moved to "signed".

Phase 1 is now active. Share the onboarding link with the creator:
${onboardingUrl}

Open the kickoff dashboard:
${kickoffUrl}

Phase 1 timeline (7 days max):
  Day 0-1  Send onboarding link
  Day 2-4  Creator fills form (10 required + 20 optional)
  Day 4-5  Review responses, draft kickoff agenda
  Day 6-7  90-min kickoff call (Tomas + Raul)
  Day 7    Generate signed Kickoff Brief PDF`;

  const html = `<div style="font-family: -apple-system, sans-serif; max-width: 560px; color: #1a1a1a;">
  <h2 style="margin:0 0 8px; font-size: 20px;">${creator.name} signed.</h2>
  <p style="color: #555; margin:0 0 20px;">Phase 1 (Kickoff) is now active. Share the onboarding link with the creator and open the kickoff dashboard to track progress.</p>
  <p style="margin: 16px 0;">
    <a href="${onboardingUrl}" style="display:inline-block; padding: 10px 18px; background: #7A0E18; color:#fff; text-decoration:none; border-radius: 6px; font-weight: 600; margin-right: 8px;">Onboarding link (share with creator)</a>
  </p>
  <p style="margin: 16px 0;">
    <a href="${kickoffUrl}" style="display:inline-block; padding: 10px 18px; background: #1a1a1a; color:#fff; text-decoration:none; border-radius: 6px; font-weight: 600;">Open kickoff dashboard</a>
  </p>
  <hr style="border:none; border-top:1px solid #eee; margin: 24px 0;" />
  <p style="font-size: 12px; color: #888; line-height: 1.6;">
    <strong>Phase 1 timeline (7 days max)</strong><br/>
    Day 0-1 — Send onboarding link<br/>
    Day 2-4 — Creator fills form (10 required + 20 optional)<br/>
    Day 4-5 — Review responses, draft kickoff agenda<br/>
    Day 6-7 — 90-min kickoff call (Tomas + Raul)<br/>
    Day 7 — Generate signed Kickoff Brief PDF
  </p>
</div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Second Layer Hub <hub@informallabs.com>',
      to: NOTIFY_EMAILS,
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}
