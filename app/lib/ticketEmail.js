/**
 * Notification emails for the Support / Feedback ticket system.
 *
 * Two flows:
 *  - sendTicketCreatedEmail   → fires the moment a ticket is submitted.
 *                                Goes to tomas@informallabs.com so he sees
 *                                every bug / suggestion in his inbox.
 *                                Attaches any files the submitter uploaded
 *                                (drag-drop on the form).
 *  - sendTicketResolvedEmail  → fires when a ticket transitions to
 *                                status='done'. Goes to the submitter's
 *                                email (captured from the signed-in
 *                                session at submission time) so they
 *                                learn "your request is live" without
 *                                having to keep checking the board.
 *
 * Both are best-effort: a Resend failure must NEVER prevent ticket
 * creation or status updates. Callers should `.catch(() => {})` or
 * not await at all.
 */

const HUB_BASE = process.env.NEXT_PUBLIC_HUB_URL || 'https://hub.secondlayerhq.com';
const TRIAGE_INBOX = 'tomas@informallabs.com';

// Strip a data-URL prefix and return just the base64 payload.
// Resend's attachments API wants the raw base64 string.
function dataUrlToBase64(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  const idx = dataUrl.indexOf('base64,');
  return idx >= 0 ? dataUrl.slice(idx + 'base64,'.length) : '';
}

// Map our ticket's attachmentFiles array → Resend's expected shape.
// Each entry: { filename, content: <base64> }.
function buildAttachments(attachmentFiles) {
  if (!Array.isArray(attachmentFiles)) return undefined;
  const out = [];
  for (const f of attachmentFiles) {
    const b64 = dataUrlToBase64(f?.dataUrl);
    if (!b64 || !f?.name) continue;
    out.push({ filename: f.name, content: b64 });
  }
  return out.length ? out : undefined;
}

export async function sendTicketCreatedEmail(ticket) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[ticketEmail] no RESEND_API_KEY — created notice skipped');
    return { ok: false, reason: 'no_api_key' };
  }

  const typeLabel = ticket.type === 'bug' ? 'Bug' : 'Sugestão';
  const priLabel  = { low: 'Low', medium: 'Medium', high: 'High' }[ticket.priority] || 'Medium';
  const ticketUrl = `${HUB_BASE}/support`;
  const subject   = `[Support] ${typeLabel} · ${ticket.area} · ${ticket.title}`;

  const lines = [
    `${typeLabel} · ${ticket.area} · ${priLabel}`,
    `Submetido por: ${ticket.submitter || 'Anónimo'}${ticket.submitterEmail ? ` <${ticket.submitterEmail}>` : ''}`,
    '',
    ticket.title,
    '',
  ];
  if (ticket.why)        lines.push(`PORQUÊ / O QUE DEVERIA ACONTECER\n${ticket.why}\n`);
  if (ticket.suggestion) lines.push(`COMO / PASSOS PARA REPRODUZIR\n${ticket.suggestion}\n`);
  if (ticket.example)    lines.push(`EXEMPLO / ERRO\n${ticket.example}\n`);
  if (ticket.attachments)lines.push(`LINK: ${ticket.attachments}\n`);
  lines.push(`Abrir no hub: ${ticketUrl}`);
  const text = lines.join('\n');

  const typeColor = ticket.type === 'bug' ? '#ef4444' : '#3b82f6';
  const html = `<div style="font-family: -apple-system, sans-serif; max-width: 600px; color: #1a1a1a;">
  <div style="margin-bottom: 8px;">
    <span style="display:inline-block; font-size:11px; font-weight:700; color:${typeColor}; padding:3px 8px; background:${ticket.type === 'bug' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)'}; border-radius:4px; text-transform:uppercase; letter-spacing:0.05em;">${typeLabel}</span>
    <span style="display:inline-block; font-size:11px; color:#555; margin-left:8px;">${ticket.area} · ${priLabel}</span>
  </div>
  <h2 style="margin:0 0 6px; font-size: 18px;">${escapeHtml(ticket.title)}</h2>
  <p style="color:#888; margin:0 0 20px; font-size: 12px;">Submetido por <strong>${escapeHtml(ticket.submitter || 'Anónimo')}</strong>${ticket.submitterEmail ? ` &lt;${escapeHtml(ticket.submitterEmail)}&gt;` : ''}</p>
  ${section(ticket.type === 'bug' ? 'O que deveria acontecer' : 'Porquê', ticket.why)}
  ${section(ticket.type === 'bug' ? 'Passos para reproduzir' : 'Como', ticket.suggestion)}
  ${section(ticket.type === 'bug' ? 'Screenshot / Erro' : 'Exemplo', ticket.example)}
  ${ticket.attachments ? `<p style="margin:14px 0; font-size:13px;"><strong>Link:</strong> <a href="${escapeHtml(ticket.attachments)}" style="color:#7A0E18;">${escapeHtml(ticket.attachments)}</a></p>` : ''}
  <p style="margin: 24px 0 8px;">
    <a href="${ticketUrl}" style="display:inline-block; padding: 10px 18px; background: #7A0E18; color:#fff; text-decoration:none; border-radius: 6px; font-weight: 600;">Abrir no hub</a>
  </p>
</div>`;

  const attachments = buildAttachments(ticket.attachmentFiles);
  const body = {
    from: 'Second Layer Hub <hub@informallabs.com>',
    to: [TRIAGE_INBOX],
    subject,
    text,
    html,
  };
  if (attachments) body.attachments = attachments;
  // Reply-To the submitter so a quick reply lands in the right inbox.
  if (ticket.submitterEmail) body.reply_to = ticket.submitterEmail;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    console.error('[ticketEmail/created] Resend', res.status, errBody.slice(0, 300));
    return { ok: false, status: res.status };
  }
  return { ok: true };
}

export async function sendTicketResolvedEmail(ticket) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: 'no_api_key' };
  if (!ticket.submitterEmail) {
    console.log('[ticketEmail/resolved] no submitterEmail — skipping', ticket.id);
    return { ok: false, reason: 'no_submitter_email' };
  }

  const firstName = (ticket.submitter || '').trim().split(/\s+/)[0] || 'olá';
  const typeLabel = ticket.type === 'bug' ? 'bug' : 'sugestão';
  const ticketUrl = `${HUB_BASE}/support`;
  const subject = `Resolvido: ${ticket.title}`;

  const text = `${firstName},

A tua ${typeLabel} ficou resolvida:

"${ticket.title}"

Já está live no hub. Se vires algo a não bater certo, abre um novo ticket e diz.

Abrir o board: ${ticketUrl}

— Second Layer`;

  const html = `<div style="font-family: -apple-system, sans-serif; max-width: 540px; color: #1a1a1a;">
  <p style="font-size:15px; margin:0 0 12px;">${escapeHtml(firstName)},</p>
  <p style="font-size:14px; color:#444; margin:0 0 18px;">A tua ${typeLabel} ficou resolvida:</p>
  <div style="padding: 14px 18px; background:#f5f5f5; border-left: 3px solid #22c55e; border-radius: 6px; margin-bottom: 20px;">
    <p style="margin:0; font-size:14px; font-weight:600; color:#1a1a1a;">${escapeHtml(ticket.title)}</p>
  </div>
  <p style="font-size:13px; color:#555; margin:0 0 20px;">Já está live no hub. Se vires algo a não bater certo, abre um novo ticket e diz.</p>
  <p style="margin: 16px 0;">
    <a href="${ticketUrl}" style="display:inline-block; padding: 10px 18px; background: #7A0E18; color:#fff; text-decoration:none; border-radius: 6px; font-weight: 600;">Abrir o board</a>
  </p>
  <hr style="border:none; border-top:1px solid #eee; margin: 24px 0;" />
  <p style="font-size:11px; color:#999; margin:0;">— Second Layer</p>
</div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Second Layer Hub <hub@informallabs.com>',
      to: [ticket.submitterEmail],
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    console.error('[ticketEmail/resolved] Resend', res.status, errBody.slice(0, 300));
    return { ok: false, status: res.status };
  }
  return { ok: true };
}

// Tiny helpers — kept local so this file has zero deps beyond fetch + env.
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function section(label, value) {
  if (!value) return '';
  return `<div style="margin:14px 0; padding:14px 16px; background:#fafafa; border-radius:6px;">
    <p style="font-size:10px; font-weight:700; color:#777; text-transform:uppercase; letter-spacing:0.06em; margin:0 0 6px;">${escapeHtml(label)}</p>
    <p style="font-size:13px; color:#333; line-height:1.6; margin:0; white-space:pre-wrap;">${escapeHtml(value)}</p>
  </div>`;
}
