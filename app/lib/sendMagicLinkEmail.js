/**
 * Send a magic-link email via Resend.
 * Includes both a clickable link AND a 6-digit code (cross-device fallback).
 */

export async function sendMagicLinkEmail({ email, link, code }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[magicLink] RESEND_API_KEY missing — link not sent. Token:', link, 'Code:', code);
    return { ok: false, reason: 'no_api_key' };
  }

  const subject = `Second Layer — entrar (código ${code})`;
  const text = `Olá,

Para entrar no Second Layer Hub, abre este link:
${link}

Ou usa este código de 6 dígitos no ecrã onde pediste:
${code}

O link e o código expiram em 15 minutos. Foram emitidos para ${email}.

Se não foste tu, podes ignorar este email — não foi feita nenhuma alteração à tua conta.

— Second Layer`;

  const html = `<div style="font-family: -apple-system, sans-serif; max-width: 480px; color: #1a1a1a;">
  <h2 style="margin:0 0 8px; font-size: 18px;">Entrar no Second Layer</h2>
  <p style="color:#555; margin:0 0 20px; font-size: 14px;">Para entrar com <strong>${email}</strong>, clica no botão abaixo:</p>
  <p style="margin: 16px 0 28px;">
    <a href="${link}" style="display:inline-block; padding: 12px 22px; background:#7A0E18; color:#fff; text-decoration:none; border-radius:6px; font-weight:600;">Entrar agora</a>
  </p>
  <p style="color:#555; font-size:13px; margin: 0 0 8px;">Ou usa este código no ecrã onde pediste o login:</p>
  <div style="font-family: 'SF Mono', Menlo, monospace; font-size: 32px; letter-spacing: 0.4em; padding: 14px 18px; background:#f5f5f5; border-radius:8px; text-align:center; font-weight:600;">${code}</div>
  <hr style="border:none; border-top:1px solid #eee; margin: 24px 0;" />
  <p style="font-size:11px; color:#999; line-height:1.5; margin:0;">
    O link e o código expiram em <strong>15 minutos</strong>. Se não foste tu, ignora este email — nada foi alterado.
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
      to: [email],
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
  return { ok: true };
}
