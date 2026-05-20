import { NextResponse } from 'next/server';
import { listCreators, getCreator, updateCreator } from '../../../lib/creators';

// Daily cron should finish in seconds — listCreators returns summaries, we
// fetch full records only for prospects that haven't replied.
export const maxDuration = 60;

// Per-operator routing (2026-05-20). Each operator gets their OWN digest
// covering only the creators they added. Creators with no addedBy.email
// (legacy / ambiguous) go to BOTH so we never silently drop them — that
// forces the operator to explicitly assign an owner.
//
// Email keys MUST be lowercased to match creator.addedBy.email.toLowerCase().
const OPERATORS = [
  { email: 'tomas@informallabs.com', firstName: 'Tomás' },
  { email: 'raul@informallabs.com',  firstName: 'Raul'  },
];
const HUB_BASE = 'https://hub.secondlayerhq.com';

// Outreach cadence — days since the initial DM was sent.
const CADENCE = {
  softNudge:  { day: 3,  followUpsDoneCap: 0, reminderKey: 'followUp1', title: 'Soft nudge',  hint: 'Reforça com 1 ângulo concreto ou referência um post recente.' },
  valueDrop:  { day: 7,  followUpsDoneCap: 1, reminderKey: 'followUp2', title: 'Value drop',  hint: 'Drop de valor — partilha um caso ou número específico.' },
  lastTouch:  { day: 14, followUpsDoneCap: 2, reminderKey: 'followUp3', title: 'Último toque', hint: 'Último contacto — pergunta direta + porta aberta para o futuro.' },
};
const AUTO_COLD_DAYS = 21;

const DAY_MS = 86_400_000;
const daysBetween = (a, b) => Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);

// ─────────────────────────────────────────────────────────────────
// Daily reminders cron — runs at 08:00 Europe/Lisbon (07:00 UTC).
//
// For every active prospect:
//   • days since first DM sent → categorize into soft nudge (3), value drop (7),
//     last touch (14), or auto-cold (21+).
//   • Skip if creator replied, signed, already cold, or the operator already
//     marked the matching follow-up done.
//
// Also gathers "new prospects with no DM yet" so they aren't forgotten.
// Sends ONE digest email per day to tomas@ + raul@informallabs.com.
// ─────────────────────────────────────────────────────────────────

export async function GET(request) {
  // Vercel cron secret guard (skipped if no secret configured locally).
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const summaries = await listCreators();
  // Active = prospect status, not signed, not already cold.
  const candidates = summaries.filter(s => {
    const st = s.pipelineStatus || 'prospect';
    return st !== 'signed' && st !== 'cold';
  });

  const buckets = { lastTouch: [], valueDrop: [], softNudge: [], noDm: [], autoCold: [] };
  const cooled = []; // creators we auto-mark cold this run

  for (const s of candidates) {
    const c = await getCreator(s.id);
    if (!c) continue;
    const out = c.outreach || {};
    if (out.repliedAt) continue;                                  // engaged → skip

    // Owner attribution — addedBy.email (lowercased) is the routing key.
    // null means "no owner": such creators get included in every operator's
    // digest so they don't silently fall through the cracks.
    const ownerEmail = c.addedBy?.email ? String(c.addedBy.email).toLowerCase() : null;

    // The "first contact" anchor: explicit outreach.dmSentAt wins, else fall
    // back to dmSequence.generatedAt (the user usually sends within minutes of
    // generating). If neither exists, the creator is in "no DM yet" bucket.
    const dmAnchor = out.dmSentAt || c.dmSequence?.generatedAt || null;
    if (!dmAnchor) {
      // Only flag creators that have been in the CRM for at least 1 day (so we
      // don't pester about creators added this morning).
      const ageDays = c.createdAt ? daysBetween(c.createdAt, now) : 0;
      if (ageDays >= 1) {
        buckets.noDm.push({ id: c.id, name: c.name, niche: c.niche, followers: pickFollowers(c), ageDays, ownerEmail });
      }
      continue;
    }

    const days = daysBetween(dmAnchor, now);
    const followUpsDone = out.followUpsDone || 0;
    const remindersSent = out.remindersSent || {};

    // Auto-cold: 21+ days, 3 follow-ups done OR exhausted reminders.
    if (days >= AUTO_COLD_DAYS) {
      cooled.push({ id: c.id, name: c.name, daysSinceDM: days });
      await updateCreator(c.id, {
        pipelineStatus: 'cold',
        outreach: { ...out, remindersSent: { ...remindersSent, autoCold: now.toISOString() } },
      }).catch(() => null);
      buckets.autoCold.push({ id: c.id, name: c.name, niche: c.niche, daysSinceDM: days, ownerEmail });
      continue;
    }

    // Pick the highest-priority bucket the creator qualifies for (last touch > value drop > soft nudge).
    let matched = null;
    for (const key of ['lastTouch', 'valueDrop', 'softNudge']) {
      const cfg = CADENCE[key];
      if (days >= cfg.day && followUpsDone <= cfg.followUpsDoneCap && !remindersSent[cfg.reminderKey]) {
        matched = { key, cfg };
        break;
      }
    }
    if (!matched) continue;

    buckets[matched.key].push({
      id: c.id,
      name: c.name,
      niche: c.niche,
      followers: pickFollowers(c),
      daysSinceDM: days,
      followUpsDone,
      ownerEmail,
    });

    // Mark this reminder as sent for this creator → cron never re-pings the
    // same milestone (unless the operator advances follow-ups manually).
    await updateCreator(c.id, {
      outreach: {
        ...out,
        remindersSent: { ...remindersSent, [matched.cfg.reminderKey]: now.toISOString() },
      },
    }).catch(() => null);
  }

  const totalDue = buckets.lastTouch.length + buckets.valueDrop.length + buckets.softNudge.length;
  const stats = {
    type: 'dm-reminders',
    status: 'ok',
    lastTouch: buckets.lastTouch.length,
    valueDrop: buckets.valueDrop.length,
    softNudge: buckets.softNudge.length,
    noDm: buckets.noDm.length,
    autoCold: buckets.autoCold.length,
    totalDue,
    timestamp: now.toISOString(),
  };

  // Per-operator dispatch. Each operator receives a digest that includes
  // only the creators they own (addedBy.email match), PLUS any creators
  // with no owner attribution (those go to everyone so the gap stays
  // visible). Operators with nothing actionable skip the email entirely.
  const perOperator = [];
  for (const op of OPERATORS) {
    const view = filterForOperator(buckets, op.email);
    const opTotalDue = view.lastTouch.length + view.valueDrop.length + view.softNudge.length;
    const actionable = opTotalDue > 0 || view.noDm.length > 0 || view.autoCold.length > 0;
    if (!actionable) {
      perOperator.push({ email: op.email, sent: false, reason: 'nothing-due' });
      continue;
    }
    try {
      await sendDigest(op, view, { ...stats, opTotalDue });
      perOperator.push({
        email: op.email,
        sent: true,
        lastTouch: view.lastTouch.length,
        valueDrop: view.valueDrop.length,
        softNudge: view.softNudge.length,
        noDm: view.noDm.length,
        autoCold: view.autoCold.length,
      });
    } catch (err) {
      console.error(`[dm-reminders] email to ${op.email} failed:`, err.message);
      perOperator.push({ email: op.email, sent: false, error: err.message });
    }
  }

  return NextResponse.json({ ...stats, perOperator });
}

// Filter every bucket down to creators that belong to one operator.
// Ownership rule: ownerEmail matches OR ownerEmail is null (ambiguous →
// everyone). This is intentional — see OPERATORS comment at the top of
// the file.
function filterForOperator(buckets, operatorEmail) {
  const op = String(operatorEmail || '').toLowerCase();
  const keep = (item) => !item.ownerEmail || item.ownerEmail === op;
  return {
    lastTouch: buckets.lastTouch.filter(keep),
    valueDrop: buckets.valueDrop.filter(keep),
    softNudge: buckets.softNudge.filter(keep),
    noDm:      buckets.noDm.filter(keep),
    autoCold:  buckets.autoCold.filter(keep),
  };
}

function pickFollowers(c) {
  const ig = c.platforms?.instagram?.followers || 0;
  const tk = c.platforms?.tiktok?.followers || 0;
  const yt = c.platforms?.youtube?.subscribers || 0;
  return Math.max(ig, tk, yt);
}

// ── Email digest ──
//
// Per-operator (2026-05-20): each operator receives a digest with only the
// creators they own. The greeting + subject are personalised so the email
// reads like it was written for that person. Ambiguous (no-owner) creators
// are included in every operator's digest until somebody assigns them.
async function sendDigest(operator, buckets, stats) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[dm-reminders] RESEND_API_KEY missing — digest for ${operator.email} not sent`);
    return;
  }

  const lisbonTime = new Date(stats.timestamp).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'medium', timeStyle: 'short' });

  // Subject summarises severity for THIS operator. Falls back to "apenas
  // update" when only informational sections (noDm / autoCold) fired.
  const subjectBits = [];
  if (buckets.lastTouch.length) subjectBits.push(`${buckets.lastTouch.length} críticos`);
  if (buckets.valueDrop.length) subjectBits.push(`${buckets.valueDrop.length} value drops`);
  if (buckets.softNudge.length) subjectBits.push(`${buckets.softNudge.length} soft nudges`);
  if (buckets.autoCold.length)  subjectBits.push(`${buckets.autoCold.length} cooled`);
  const subject = `[Second Layer] Os teus reminders · ${subjectBits.join(' · ') || 'apenas update'}`;

  const fmtRow = (c) => `• ${c.name}${c.niche ? ' · ' + c.niche : ''}${c.followers ? ' · ' + c.followers.toLocaleString() + ' followers' : ''} · DM enviada há ${c.daysSinceDM} dias${c.followUpsDone ? ' · ' + c.followUpsDone + ' follow-ups feitos' : ''}${c.ownerEmail ? '' : ' · ⚠ sem owner'}`;
  const fmtRowHtml = (c) => `<li style="margin-bottom: 6px;"><a href="${HUB_BASE}/creators/${c.id}?tab=dm" style="color: #f5f5f5; text-decoration: none; font-weight: 600;">${escape(c.name)}</a> <span style="color: #888;">${c.niche ? '· ' + escape(c.niche) : ''}${c.followers ? ' · ' + c.followers.toLocaleString() + ' followers' : ''} · DM há ${c.daysSinceDM} dias${c.followUpsDone ? ' · ' + c.followUpsDone + ' follow-ups' : ''}${c.ownerEmail ? '' : ' · <span style="color:#eab308;">⚠ sem owner</span>'}</span></li>`;

  // ── Plain-text version ──
  const lines = [`Olá ${operator.firstName},`, ``, `Reminders dos teus creators corridos às ${lisbonTime} (Lisboa).`, ``];
  if (buckets.lastTouch.length) {
    lines.push(`⚠️  ÚLTIMO TOQUE — dia 14 (${buckets.lastTouch.length})`);
    lines.push(`Envia DM #3 e Email #3 (último contacto). Se não responder até dia 21, vai automaticamente para cold.`);
    buckets.lastTouch.forEach(c => lines.push(fmtRow(c)));
    lines.push('');
  }
  if (buckets.valueDrop.length) {
    lines.push(`🟠 VALUE DROP — dia 7 (${buckets.valueDrop.length})`);
    lines.push(`Envia DM #2 e Email #2. Drop de valor concreto (caso, número).`);
    buckets.valueDrop.forEach(c => lines.push(fmtRow(c)));
    lines.push('');
  }
  if (buckets.softNudge.length) {
    lines.push(`🟢 SOFT NUDGE — dia 3 (${buckets.softNudge.length})`);
    lines.push(`Envia DM #1 follow-up + Email #1 follow-up. Referência um post recente, sem pressão.`);
    buckets.softNudge.forEach(c => lines.push(fmtRow(c)));
    lines.push('');
  }
  if (buckets.noDm.length) {
    lines.push(`📭 SEM DM AINDA (${buckets.noDm.length})`);
    lines.push(`Creators no CRM há ≥1 dia sem outreach. Gera DM ou marca como skip.`);
    buckets.noDm.forEach(c => lines.push(`• ${c.name}${c.niche ? ' · ' + c.niche : ''}${c.followers ? ' · ' + c.followers.toLocaleString() + ' followers' : ''} · adicionado há ${c.ageDays} dias`));
    lines.push('');
  }
  if (buckets.autoCold.length) {
    lines.push(`❄️  AUTO-COLD (${buckets.autoCold.length})`);
    lines.push(`Movidos para cold automaticamente — 21+ dias sem resposta. Já não aparecem em reminders.`);
    buckets.autoCold.forEach(c => lines.push(`• ${c.name}${c.niche ? ' · ' + c.niche : ''} · DM há ${c.daysSinceDM} dias`));
    lines.push('');
  }
  lines.push(`Hub: ${HUB_BASE}/creators`);
  const text = lines.join('\n');

  // ── HTML version ──
  const section = (color, title, hint, items, fmt) => items.length === 0 ? '' : `
    <h3 style="font-size: 11px; color: ${color}; letter-spacing: 0.16em; text-transform: uppercase; margin: 28px 0 4px;">${title} <span style="color: #888; font-weight: 400;">· ${items.length}</span></h3>
    <p style="font-size: 13px; color: #888; margin: 0 0 12px;">${hint}</p>
    <ul style="padding-left: 16px; margin: 0; list-style: disc; font-size: 13px; color: #f5f5f5;">${items.map(fmt).join('')}</ul>`;

  // Headline uses opTotalDue — the count for THIS operator's filtered view,
  // not the team-wide total. Falls back to 0 for legacy callers that pass
  // the old stats shape.
  const headlineCount = stats.opTotalDue ?? stats.totalDue ?? 0;
  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; color: #f5f5f5; background: #0a0a0a; padding: 32px 28px; max-width: 640px;">
  <div style="font-size: 9px; color: #B11E2F; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;">● Reminders · ${escape(operator.firstName)}</div>
  <h1 style="font-size: 32px; font-weight: 700; margin: 8px 0 4px; color: #f5f5f5; letter-spacing: -0.02em;">${headlineCount} follow-up${headlineCount === 1 ? '' : 's'} ${headlineCount === 1 ? 'devido hoje' : 'devidos hoje'}</h1>
  <p style="font-size: 13px; color: #888; margin: 0;">${lisbonTime} · Lisboa · Só os teus creators</p>

  ${section('#ef4444', '⚠️ Último toque · dia 14', 'Envia DM #3 e Email #3. Se não responder em 7 dias, vai automaticamente para cold.', buckets.lastTouch, fmtRowHtml)}
  ${section('#eab308', '🟠 Value drop · dia 7', 'Envia DM #2 e Email #2. Drop de valor concreto — caso, número, prova.', buckets.valueDrop, fmtRowHtml)}
  ${section('#22c55e', '🟢 Soft nudge · dia 3', 'Envia DM #1 follow-up + Email #1 follow-up. Referência um post recente, sem pressão.', buckets.softNudge, fmtRowHtml)}

  ${buckets.noDm.length === 0 ? '' : `
    <h3 style="font-size: 11px; color: #3b82f6; letter-spacing: 0.16em; text-transform: uppercase; margin: 28px 0 4px;">📭 Sem DM ainda <span style="color: #888; font-weight: 400;">· ${buckets.noDm.length}</span></h3>
    <p style="font-size: 13px; color: #888; margin: 0 0 12px;">Creators no CRM há ≥1 dia sem outreach.</p>
    <ul style="padding-left: 16px; margin: 0; list-style: disc; font-size: 13px; color: #f5f5f5;">${buckets.noDm.map(c => `<li style="margin-bottom: 6px;"><a href="${HUB_BASE}/creators/${c.id}?tab=dm" style="color: #f5f5f5; text-decoration: none; font-weight: 600;">${escape(c.name)}</a> <span style="color: #888;">${c.niche ? '· ' + escape(c.niche) : ''}${c.followers ? ' · ' + c.followers.toLocaleString() + ' followers' : ''} · adicionado há ${c.ageDays} dias</span></li>`).join('')}</ul>`}

  ${buckets.autoCold.length === 0 ? '' : `
    <h3 style="font-size: 11px; color: #555; letter-spacing: 0.16em; text-transform: uppercase; margin: 28px 0 4px;">❄️ Auto-cold <span style="color: #555; font-weight: 400;">· ${buckets.autoCold.length}</span></h3>
    <p style="font-size: 13px; color: #888; margin: 0 0 12px;">21+ dias sem resposta. Movidos automaticamente.</p>
    <ul style="padding-left: 16px; margin: 0; list-style: disc; font-size: 12px; color: #888;">${buckets.autoCold.map(c => `<li>${escape(c.name)}${c.niche ? ' · ' + escape(c.niche) : ''} · DM há ${c.daysSinceDM} dias</li>`).join('')}</ul>`}

  <p style="margin-top: 32px;"><a href="${HUB_BASE}/creators" style="display: inline-block; padding: 10px 18px; background: #B11E2F; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px;">Abrir CRM</a></p>
  <p style="font-size: 11px; color: #555; margin-top: 24px;">Marcaste sent? Marca o follow-up no creator para a próxima rodada não voltar a aparecer. Quando o criador responder, clica em "Marcar respondeu" — pára todos os reminders desse creator.</p>
</div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Second Layer Hub <hub@informallabs.com>',
      to: [operator.email],
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

// Very small HTML escape — just enough so creator names with `<` don't break.
function escape(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
