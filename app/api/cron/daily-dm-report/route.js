import { NextResponse } from 'next/server';
import { getDailyScoreboard } from '../../../lib/teamStats';
import { getObsSnapshot } from '../../../lib/obs';
import { getCurrentUser } from '../../../lib/auth';
import { recordCronRun } from '../../../lib/adminInfra';

// ─────────────────────────────────────────────────────────────────
// End-of-day report — per-operator email with the day's outreach
// metrics + €50 accountability rule.
//
// Scheduled at 03:00 UTC Tue-Sat (vercel.json: "0 3 * * 2-6"), which
// is 04:00 Lisbon during DST and 03:00 Lisbon in winter — close
// enough to "around 4am" for both halves of the year. Reporting on
// the previous Lisbon day means late-night outreach (DMs sent after
// midnight, which used to land in the wrong bucket) now correctly
// counts toward the day the operator was actually working.
//
// Tue-Sat schedule = report on Mon-Fri activity. Sunday/Monday no
// email (no Sunday work day to report on).
//
// Two design changes vs the previous version (2026-05-20):
//   1. Recipients come from the hardcoded OPERATORS list, not
//      listTeamEmails(). The old behaviour silently skipped the
//      email when `team:emails` was empty AND the TEAM_EMAILS env
//      var wasn't set — which is exactly why no EOD email has
//      arrived. Hardcoding the two operators removes that failure
//      mode entirely.
//   2. Each operator now gets their OWN email with their own
//      headline, metric grid, and €50 status. The team scoreboard
//      still appears at the bottom so everyone can see who hit
//      the goal and who owes whom.
//
// The scoreboard math (€50 split when someone misses, even split
// among winners) stays in lib/teamStats so getDailyScoreboard()
// is still the single source of truth.
//
// Auth: middleware lets /api/cron/* through without a session,
// guarded here with CRON_SECRET. Vercel sends the bearer token
// automatically when the env var is set.
// ─────────────────────────────────────────────────────────────────

export const maxDuration = 30;
// Never prerender/cache — this is a stateful cron (sends emails, reads the
// live scoreboard) and can be triggered on demand from /admin.
export const dynamic = 'force-dynamic';

const OPERATORS = [
  { email: 'tom@secondlayerhq.com',  firstName: 'Tomás' },
  { email: 'raul@secondlayerhq.com', firstName: 'Raul'  },
];
const HUB_BASE = 'https://hub.secondlayerhq.com';

async function checkCronAuth(request) {
  const expected = process.env.CRON_SECRET;
  // FAIL CLOSED when deployed: this route is middleware-public, so an
  // unset CRON_SECRET must not make it publicly triggerable. Local dev
  // (no VERCEL env) still allows secret-less runs.
  if (!expected) return !process.env.VERCEL;
  const auth = request.headers.get('authorization') || '';
  if (auth === `Bearer ${expected}`) return true;
  // /admin "Correr agora" — a signed-in team session may also trigger it.
  const u = await getCurrentUser(request);
  return u?.role === 'team';
}

// Returns the Lisbon-local long date string for "yesterday" — i.e. the
// calendar day BEFORE the moment of call. The EOD cron fires at 04:00
// Lisbon and reports on the previous day; the email subject + headline
// need to surface that date, not today's.
function yesterdayLisbonStr() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fmt = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
  return fmt.format(yesterday);
}

// Find the row that belongs to a specific operator. canonicalKey() in
// teamStats lowercases + strips accents, so "Tomás" → "tomas". Match
// against the operator's firstName the same way.
function findRowFor(scoreboard, firstName) {
  const key = String(firstName || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  return scoreboard.find(r => r.userId === key) || null;
}

// Empty row shape so the email always renders, even when an operator
// hasn't touched anything today. Without this we'd skip the email and
// the operator wouldn't know they missed the goal.
function zeroRow(firstName) {
  return {
    userId: String(firstName || '').toLowerCase(),
    firstName,
    creatorsAdded: 0,
    dmsSent: 0,
    emailsSent: 0,
    touchesSent: 0,
    followUpsDone: 0,
    followUpsDm: 0,
    followUpsEmail: 0,
    repliesReceived: 0,
    repliesViaDm: 0,
    repliesViaEmail: 0,
    signed: 0,
    replyRate: 0,
    dmReplyRate: 0,
    emailReplyRate: 0,
    target: 30,
    missedGoal: true,
    totalOwedEur: 0,
    totalEarnedEur: 0,
  };
}

// ── Email body builders ──

function buildOperatorEmail(operator, myRow, scoreboard, target) {
  const dateStr = yesterdayLisbonStr();
  const winners = scoreboard.filter(r => !r.missedGoal);
  const losers = scoreboard.filter(r => r.missedGoal);
  const hit = !myRow.missedGoal;
  const deficit = Math.max(0, target - myRow.touchesSent);

  // Subject — fast read in the inbox. Leads with hit/miss + count.
  const status = hit ? 'OK' : `falta ${deficit}`;
  const subject = `[Second Layer] EOD · ${operator.firstName} · ${myRow.touchesSent}/${target} touches · ${status}`;

  // €50 verdict — bilateral split. Winners earn €50 from each loser.
  // Losers owe €50 to each winner. When nobody hits or everyone hits,
  // the verdict line stays informational ("ninguém deve nada").
  let verdictText;
  let verdictHtml;
  if (losers.length === 0) {
    verdictText = `Toda a equipa cumpriu. Ninguém deve €50.`;
    verdictHtml = `<p style="margin: 0; color: #22c55e; font-size: 14px; font-weight: 600;">Toda a equipa cumpriu. Ninguém deve €50.</p>`;
  } else if (winners.length === 0) {
    verdictText = `Ninguém cumpriu o objetivo de ${target}. Sem €50 a transferir.`;
    verdictHtml = `<p style="margin: 0; color: #eab308; font-size: 14px; font-weight: 600;">Ninguém cumpriu o objetivo de ${target}. Sem €50 a transferir.</p>`;
  } else if (hit) {
    const losersNames = losers.map(l => l.firstName).join(', ');
    const earned = losers.length * 50;
    verdictText = `Cumpriste. Recebes €${earned} de ${losersNames}.`;
    verdictHtml = `<p style="margin: 0; color: #22c55e; font-size: 14px; font-weight: 600;">Cumpriste. Recebes <span style="font-weight: 800;">€${earned}</span> de ${losersNames}.</p>`;
  } else {
    const winnersNames = winners.map(w => w.firstName).join(', ');
    const owed = winners.length * 50;
    verdictText = `Falhaste por ${deficit}. Deves €${owed} (€50 a cada um: ${winnersNames}).`;
    verdictHtml = `<p style="margin: 0; color: #ef4444; font-size: 14px; font-weight: 600;">Falhaste por ${deficit}. Deves <span style="font-weight: 800;">€${owed}</span> (€50 a cada um: ${winnersNames}).</p>`;
  }

  // Metric grid — the operator's full day at a glance. Combined "Replies"
  // shows the channel split inline ("3 (2 DM · 1 email)") so the reader
  // doesn't have to mentally aggregate two cells. Same for follow-ups.
  const repliesSplit = myRow.repliesReceived > 0
    ? ` (${myRow.repliesViaDm} DM · ${myRow.repliesViaEmail} email)`
    : '';
  const followUpsSplit = myRow.followUpsDone > 0
    ? ` (${myRow.followUpsDm} DM · ${myRow.followUpsEmail} email)`
    : '';

  const metricGrid = [
    { label: 'Outreach touches', value: `${myRow.touchesSent} / ${target}`, accent: hit ? '#22c55e' : '#ef4444', hint: 'Creators únicos contactados · meta diária' },
    { label: 'DMs enviadas', value: myRow.dmsSent, hint: 'Mensagens Instagram enviadas' },
    { label: 'Emails enviados', value: myRow.emailsSent, hint: 'Emails Day 1 enviados' },
    { label: 'Follow-ups feitos', value: `${myRow.followUpsDone}${followUpsSplit}`, hint: 'Soft nudge / value drop / último toque marcados' },
    { label: 'Respostas', value: `${myRow.repliesReceived}${repliesSplit}`, accent: myRow.repliesReceived > 0 ? '#22c55e' : null, hint: 'Creators que responderam' },
    { label: 'Reply rate', value: `${myRow.replyRate}%`, hint: `DM ${myRow.dmReplyRate}% · Email ${myRow.emailReplyRate}%` },
    { label: 'Creators adicionados', value: myRow.creatorsAdded, hint: 'Novos creators que entraram no CRM' },
    { label: 'Signed', value: myRow.signed, accent: myRow.signed > 0 ? '#22c55e' : null, hint: 'Deals fechados' },
  ];

  // ── Plain text ──
  const textLines = [];
  textLines.push(`EOD · ${operator.firstName} · ${dateStr}`);
  textLines.push('');
  textLines.push(`${myRow.touchesSent}/${target} touches · ${hit ? 'CUMPRIU ✓' : 'FALHOU (deficit ' + deficit + ')'}`);
  textLines.push(verdictText);
  textLines.push('');
  textLines.push(`── Métricas de ${dateStr} ──`);
  for (const m of metricGrid) {
    textLines.push(`${m.label}: ${m.value}${m.hint ? '  (' + m.hint + ')' : ''}`);
  }
  textLines.push('');
  textLines.push('── Scoreboard da equipa ──');
  for (const r of scoreboard) {
    const status = r.missedGoal ? `falhou (${r.touchesSent}/${target})` : `OK (${r.touchesSent})`;
    const debt = r.totalOwedEur > 0 ? ` · deve €${r.totalOwedEur}` : r.totalEarnedEur > 0 ? ` · recebe €${r.totalEarnedEur}` : '';
    textLines.push(`- ${r.firstName}: ${status}${debt}`);
  }
  textLines.push('');
  textLines.push(`Equipa completa: ${HUB_BASE}/equipa`);
  const text = textLines.join('\n');

  // ── HTML ──
  const metricCell = (m) => `
    <td style="padding: 14px 16px; background: #111; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; vertical-align: top; width: 50%;">
      <div style="font-size: 10px; color: #888; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 6px;">${m.label}</div>
      <div style="font-size: 22px; font-weight: 700; color: ${m.accent || '#f5f5f5'}; line-height: 1.1; letter-spacing: -0.01em;">${m.value}</div>
      ${m.hint ? `<div style="font-size: 11px; color: #666; margin-top: 6px;">${m.hint}</div>` : ''}
    </td>`;

  // Pair cells into 2-column rows so the email reads well on mobile.
  const gridRows = [];
  for (let i = 0; i < metricGrid.length; i += 2) {
    gridRows.push(`<tr>${metricCell(metricGrid[i])}<td style="width: 8px;"></td>${metricGrid[i + 1] ? metricCell(metricGrid[i + 1]) : '<td></td>'}</tr><tr><td colspan="3" style="height: 8px; line-height: 8px;">&nbsp;</td></tr>`);
  }

  const scoreboardRows = scoreboard.map(r => {
    const dot = r.missedGoal ? '#ef4444' : '#22c55e';
    const status = r.missedGoal ? `falhou (${r.touchesSent}/${target})` : `OK (${r.touchesSent})`;
    const debt = r.totalOwedEur > 0 ? `<span style="color: #ef4444; font-weight: 700;">deve €${r.totalOwedEur}</span>`
      : r.totalEarnedEur > 0 ? `<span style="color: #22c55e; font-weight: 700;">recebe €${r.totalEarnedEur}</span>`
      : `<span style="color: #888;">—</span>`;
    return `<tr>
      <td style="padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #f5f5f5;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${dot}; margin-right: 8px;"></span>${escape(r.firstName)}</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #aaa;">${status}</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: right;">${debt}</td>
    </tr>`;
  }).join('');

  const headlineColor = hit ? '#22c55e' : '#ef4444';

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; color: #f5f5f5; background: #0a0a0a; padding: 32px 28px; max-width: 640px;">
    <div style="font-size: 9px; color: #B11E2F; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;">● End of Day · ${escape(operator.firstName)}</div>
    <h1 style="font-size: 36px; font-weight: 700; margin: 8px 0 4px; color: ${headlineColor}; letter-spacing: -0.02em;">${myRow.touchesSent} <span style="color: #555; font-size: 24px; font-weight: 500;">/ ${target}</span> <span style="font-size: 20px; color: #aaa; font-weight: 600;">touches</span></h1>
    <p style="font-size: 13px; color: #888; margin: 0;">${dateStr} · Lisboa</p>

    <div style="margin-top: 22px; padding: 18px 22px; background: ${hit ? 'rgba(34,197,94,0.06)' : losers.length === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.06)'}; border: 1px solid ${hit ? 'rgba(34,197,94,0.25)' : losers.length === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.25)'}; border-radius: 10px;">
      <div style="font-size: 10px; color: #888; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 6px;">€50</div>
      ${verdictHtml}
    </div>

    <h2 style="font-size: 12px; color: #888; letter-spacing: 0.16em; text-transform: uppercase; margin: 32px 0 14px;">Métricas de ${escape(dateStr)}</h2>
    <table style="width: 100%; border-collapse: separate; border-spacing: 0;">${gridRows.join('')}</table>

    <h2 style="font-size: 12px; color: #888; letter-spacing: 0.16em; text-transform: uppercase; margin: 32px 0 10px;">Scoreboard da equipa</h2>
    <table style="width: 100%; border-collapse: collapse; background: #0f0f0f; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: rgba(255,255,255,0.03);">
          <th style="padding: 10px 14px; text-align: left; font-size: 10px; letter-spacing: 0.14em; color: #666; text-transform: uppercase; font-weight: 600;">Pessoa</th>
          <th style="padding: 10px 14px; text-align: left; font-size: 10px; letter-spacing: 0.14em; color: #666; text-transform: uppercase; font-weight: 600;">Estado</th>
          <th style="padding: 10px 14px; text-align: right; font-size: 10px; letter-spacing: 0.14em; color: #666; text-transform: uppercase; font-weight: 600;">€50</th>
        </tr>
      </thead>
      <tbody>${scoreboardRows}</tbody>
    </table>

    <p style="margin-top: 32px;"><a href="${HUB_BASE}/equipa" style="display: inline-block; padding: 10px 18px; background: #B11E2F; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px;">Abrir scoreboard</a></p>
    <p style="font-size: 11px; color: #555; margin-top: 24px;">Objetivo: ${target} outreach touches por pessoa por dia (Seg-Sex). Touch = creator único contactado por DM e/ou email no dia. Falhar = €50 para cada teammate que cumpriu. Relatório enviado às 04:00 Lisboa para incluir DMs enviadas tarde.</p>
  </div>`;

  return { subject, text, html };
}

async function sendEmail(to, subject, text, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[daily-dm-report] RESEND_API_KEY missing — would send to ${to}`);
    return { sent: false, reason: 'no-api-key' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Second Layer Hub <hub@informallabs.com>',
      to: [to],
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
  if (!await checkCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const target = Number(process.env.DAILY_DM_TARGET) || 30;
    // 'yesterday' window — the cron fires at 04:00 Lisbon and reports on
    // the previous day's outreach. Without this, late-night DMs (the
    // exact reason we moved the cron to 4am) would land in today's
    // window with no other activity to compare against.
    const scoreboardRaw = await getDailyScoreboard({ target, windowKey: 'yesterday' });

    // Always make sure both operators appear on the scoreboard, even if
    // they did zero outreach today. Without this, an inactive operator
    // doesn't get the "you missed by 30" reminder — which is the whole
    // point of the email.
    const scoreboard = OPERATORS.map(op => {
      const found = findRowFor(scoreboardRaw, op.firstName);
      return found || zeroRow(op.firstName);
    });
    // Re-derive the €50 split with the synthetic-zero rows included.
    const winners = scoreboard.filter(r => !r.missedGoal);
    const losers = scoreboard.filter(r => r.missedGoal);
    for (const r of scoreboard) {
      r.target = target;
      r.totalOwedEur = r.missedGoal ? winners.length * 50 : 0;
      r.totalEarnedEur = !r.missedGoal ? losers.length * 50 : 0;
    }

    const perOperator = [];
    for (const op of OPERATORS) {
      const myRow = findRowFor(scoreboard, op.firstName) || zeroRow(op.firstName);
      const { subject, text, html } = buildOperatorEmail(op, myRow, scoreboard, target);
      try {
        const result = await sendEmail(op.email, subject, text, html);
        perOperator.push({ email: op.email, ...result, touches: myRow.touchesSent, missed: myRow.missedGoal });
      } catch (err) {
        console.error(`[daily-dm-report] send to ${op.email} failed:`, err.message);
        perOperator.push({ email: op.email, sent: false, error: err.message });
      }
    }

    // Ops summary — ONE email to the triage inbox with yesterday's LLM
    // spend + error count. Global data, so it doesn't repeat per operator.
    // Best-effort: never let an obs failure break the scoreboard emails.
    let obsSummary = null;
    try {
      const snap = await getObsSnapshot({ recentErrors: 10 });
      if (snap?.available) {
        const { subject, html } = buildOpsSummaryEmail(snap);
        await sendEmail('tom@secondlayerhq.com', subject, '', html).catch(() => {});
        obsSummary = { costYesterday: snap.costYesterday, errorsToday: snap.errorsToday };
      }
    } catch { /* best-effort */ }

    const sentCount = Array.isArray(perOperator) ? perOperator.filter(o => o.sent).length : 0;
    await recordCronRun('daily-dm-report', { ok: true, summary: `${sentCount} relatórios enviados` }).catch(() => {});
    return NextResponse.json({ ok: true, target, perOperator, scoreboard, obsSummary });
  } catch (err) {
    console.error('[daily-dm-report] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Global ops summary — LLM spend + errors. Reads yesterday's total since
// the cron reports on the previous day (costYesterday in the snapshot).
function buildOpsSummaryEmail(snap) {
  const routes = Object.entries(snap.perRoute || {})
    .sort((a, b) => (b[1].cost || 0) - (a[1].cost || 0));
  const routeRows = routes.length
    ? routes.map(([r, v]) => `<tr><td style="padding:4px 10px;color:#ccc;font-size:12px;">${escape(r)}</td><td style="padding:4px 10px;color:#888;font-size:12px;text-align:right;font-family:monospace;">$${v.cost.toFixed(3)}</td><td style="padding:4px 10px;color:#666;font-size:12px;text-align:right;font-family:monospace;">${v.calls}×</td></tr>`).join('')
    : `<tr><td colspan="3" style="padding:8px 10px;color:#555;font-size:12px;">Sem chamadas registadas hoje.</td></tr>`;
  const errRows = (snap.recentErrors || []).length
    ? snap.recentErrors.slice(0, 10).map(e => `<div style="font-size:11px;color:#f5b5bb;padding:3px 0;font-family:monospace;">${escape(e.route || '?')} · ${escape((e.message || '').slice(0, 120))}</div>`).join('')
    : `<div style="font-size:12px;color:#22c55e;">Sem erros nas últimas 24h ✓</div>`;
  const errColor = snap.errorsToday > 0 ? '#ef4444' : '#22c55e';
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#f5f5f5;background:#0a0a0a;padding:32px 28px;max-width:640px;">
    <div style="font-size:9px;color:#B11E2F;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">● Ops · Custo & Erros</div>
    <h1 style="font-size:20px;font-weight:700;margin:8px 0 20px;">Resumo de operações</h1>
    <div style="display:flex;gap:12px;margin-bottom:20px;">
      <div style="flex:1;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
        <div style="font-size:10px;color:#888;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:6px;">Custo LLM ontem</div>
        <div style="font-size:22px;font-weight:700;font-family:monospace;">$${(snap.costYesterday || 0).toFixed(2)}</div>
      </div>
      <div style="flex:1;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
        <div style="font-size:10px;color:#888;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:6px;">Erros (24h)</div>
        <div style="font-size:22px;font-weight:700;color:${errColor};font-family:monospace;">${snap.errorsToday || 0}</div>
      </div>
    </div>
    <div style="font-size:10px;color:#888;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 8px;">Custo por rota (hoje)</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">${routeRows}</table>
    <div style="font-size:10px;color:#888;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 8px;">Erros recentes</div>
    ${errRows}
  </div>`;
  return { subject: `[Second Layer] Ops · $${(snap.costYesterday || 0).toFixed(2)} LLM · ${snap.errorsToday || 0} erros`, html };
}

function escape(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
