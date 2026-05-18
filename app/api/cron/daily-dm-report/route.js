import { NextResponse } from 'next/server';
import { getDailyScoreboard } from '../../../lib/teamStats';
import { listTeamEmails } from '../../../lib/users';

// ─────────────────────────────────────────────────────────────────
// Daily DM accountability report — fired by Vercel Cron near end of day
// Europe/Lisbon. Sends one email to every team member showing the
// scoreboard + who owes €50 to whom for that day.
//
// Scheduled at 22:55 UTC weekdays (vercel.json). To handle DST:
//   - Summer (DST):  22:55 UTC === 23:55 Lisbon → 5 min before midnight
//   - Winter:        22:55 UTC === 22:55 Lisbon → ~65 min early
// Hobby plan limits crons to 2, so a single schedule is used for both
// halves of the year. The early-winter case is fine for accountability —
// the operator has had all day to hit the goal at that point.
//
// Mon-Fri only — `55 22 * * 1-5` enforces weekdays.
//
// Auth: middleware lets /api/cron/* through without a session, so we
// guard here with CRON_SECRET. Vercel sends "Authorization: Bearer
// <CRON_SECRET>" when the env var is set.
// ─────────────────────────────────────────────────────────────────

export const maxDuration = 30;

function checkCronAuth(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // dev: no secret set, allow
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${expected}`;
}

function todayLisbonStr() {
  const fmt = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
  return fmt.format(new Date());
}

function buildScoreboardHtml(scoreboard, target) {
  const dateStr = todayLisbonStr();
  const winners = scoreboard.filter(r => !r.missedGoal);
  const losers = scoreboard.filter(r => r.missedGoal);

  const rows = scoreboard.map(r => {
    const dot = r.missedGoal ? '#ef4444' : '#22c55e';
    const status = r.missedGoal ? `Falhou (${r.dmsSent}/${target})` : `✓ Cumpriu (${r.dmsSent})`;
    const debt = r.totalOwedEur > 0 ? `<span style="color:#ef4444; font-weight:600;">Deve €${r.totalOwedEur}</span>`
      : r.totalEarnedEur > 0 ? `<span style="color:#22c55e; font-weight:600;">Recebe €${r.totalEarnedEur}</span>`
      : `<span style="color:#888;">—</span>`;
    return `<tr>
      <td style="padding:10px 14px; border-bottom:1px solid #eee;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${dot}; margin-right:8px;"></span><strong>${r.firstName}</strong></td>
      <td style="padding:10px 14px; border-bottom:1px solid #eee; color:#444;">${status}</td>
      <td style="padding:10px 14px; border-bottom:1px solid #eee; text-align:right;">${debt}</td>
    </tr>`;
  }).join('');

  let summary = '';
  if (losers.length === 0) {
    summary = `<p style="margin:0 0 18px; color:#22c55e; font-size:14px;"><strong>Toda a equipa cumpriu hoje.</strong> Sem débitos.</p>`;
  } else if (winners.length === 0) {
    summary = `<p style="margin:0 0 18px; color:#eab308; font-size:14px;"><strong>Ninguém cumpriu hoje.</strong> Sem débitos (todos falharam).</p>`;
  } else {
    const loserNames = losers.map(l => l.firstName).join(', ');
    const winnerNames = winners.map(w => w.firstName).join(', ');
    summary = `<p style="margin:0 0 18px; color:#444; font-size:14px;"><strong>${loserNames}</strong> não cumpriu(ram). <strong>${winnerNames}</strong> recebe(m) €50 de cada um.</p>`;
  }

  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif; max-width:560px; margin:0 auto; padding:24px; color:#1a1a1a;">
    <h2 style="margin:0 0 4px; font-size:18px;">DMs do dia · ${dateStr}</h2>
    <p style="margin:0 0 20px; color:#888; font-size:13px;">Objetivo: ${target} DMs por pessoa. Falhar = €50 para cada teammate que cumpriu.</p>
    ${summary}
    <table style="width:100%; border-collapse:collapse; background:#fafafa; border-radius:8px; overflow:hidden; font-size:14px;">
      <thead><tr style="background:#f0f0f0;">
        <th style="padding:10px 14px; text-align:left; font-size:11px; letter-spacing:0.08em; color:#666; text-transform:uppercase;">Pessoa</th>
        <th style="padding:10px 14px; text-align:left; font-size:11px; letter-spacing:0.08em; color:#666; text-transform:uppercase;">Estado</th>
        <th style="padding:10px 14px; text-align:right; font-size:11px; letter-spacing:0.08em; color:#666; text-transform:uppercase;">€50/dia</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:20px 0 0; color:#999; font-size:11px;">Relatório automático · Second Layer Hub · podes consultar o scoreboard em qualquer altura em hub.secondlayerhq.com/equipa</p>
  </body></html>`;
}

function buildScoreboardText(scoreboard, target) {
  const lines = [];
  lines.push(`DMs do dia · ${todayLisbonStr()}`);
  lines.push(`Objetivo: ${target} DMs por pessoa. Falhar = €50 para cada teammate que cumpriu.`);
  lines.push('');
  for (const r of scoreboard) {
    const status = r.missedGoal ? `Falhou (${r.dmsSent}/${target})` : `OK (${r.dmsSent})`;
    const debt = r.totalOwedEur > 0 ? ` · deve €${r.totalOwedEur}`
      : r.totalEarnedEur > 0 ? ` · recebe €${r.totalEarnedEur}`
      : '';
    lines.push(`- ${r.firstName}: ${status}${debt}`);
  }
  return lines.join('\n');
}

async function sendReportEmail(recipients, html, text) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[daily-dm-report] RESEND_API_KEY missing — would send to:', recipients);
    return { sent: false, reason: 'no-api-key' };
  }
  const subject = `Scoreboard de DMs · ${todayLisbonStr()}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Second Layer Hub <hub@informallabs.com>',
      to: recipients,
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
  return { sent: true };
}

export async function GET(request) {
  if (!checkCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const target = Number(process.env.DAILY_DM_TARGET) || 30;
    const scoreboard = await getDailyScoreboard({ target });
    if (scoreboard.length === 0) {
      return NextResponse.json({ ok: true, sent: false, reason: 'no-activity' });
    }

    const recipients = await listTeamEmails();
    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, sent: false, reason: 'no-recipients' });
    }

    const html = buildScoreboardHtml(scoreboard, target);
    const text = buildScoreboardText(scoreboard, target);
    const result = await sendReportEmail(recipients, html, text);
    return NextResponse.json({ ok: true, ...result, recipients: recipients.length, scoreboard });
  } catch (err) {
    console.error('[daily-dm-report] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
