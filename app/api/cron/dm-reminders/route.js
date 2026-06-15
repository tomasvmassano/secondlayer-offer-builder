import { NextResponse } from 'next/server';
import { listCreators, getCreator, updateCreator } from '../../../lib/creators';

// Daily cron should finish in seconds — listCreators returns summaries, we
// fetch full records only for prospects that haven't replied.
export const maxDuration = 60;

// Per-operator routing. Each operator gets their OWN digest covering only
// the creators they added. Creators where the addedBy actor can't be mapped
// to a known operator (genuinely orphaned imports) go to BOTH so they never
// silently drop — forces an explicit owner assignment.
//
// Resolution is by firstName because creator.addedBy is shaped as
// { userId, firstName, at } — there is NO `.email` field on addedBy. The
// previous version of this code keyed on addedBy.email and so EVERY creator
// fell into the "no owner" bucket. Fix 2026-05-23: canonicalise the
// firstName (lowercase + strip diacritics) and look up via FIRSTNAME_TO_EMAIL.
const OPERATORS = [
  { email: 'tomas@informallabs.com',    firstName: 'Tomás'    },
  { email: 'raul@informallabs.com',     firstName: 'Raul'     },
  { email: 'carolina@informallabs.com', firstName: 'Carolina' },
];
// Lowercase + diacritics stripped, mirrors canonicalKey() in lib/teamStats so
// "Tomás" and "Tomas" both resolve correctly regardless of which form the
// scrape pipeline stamped onto addedBy.firstName.
function canonicaliseName(s) {
  if (!s) return '';
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
const FIRSTNAME_TO_EMAIL = OPERATORS.reduce((acc, op) => {
  acc[canonicaliseName(op.firstName)] = op.email;
  return acc;
}, {});

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

  // CATCHUP MODE
  // ?catchup=1&forEmail=<operator@informallabs.com> turns the daily cron
  // into a one-off comprehensive backfill for a single operator:
  //   • Ignores the remindersSent gate — surfaces EVERY overdue follow-up,
  //     including ones the daily cron previously emailed about.
  //   • READ-ONLY — does not mark remindersSent or auto-cold so future
  //     daily runs are unaffected.
  //   • Sends the digest only to the target operator. Subject prefixed
  //     "[CATCHUP] " so it's obviously distinct from the daily one.
  // Cold + signed + replied creators are excluded by the same filters
  // the daily run uses — Frio creators never appear in the catchup either.
  const { searchParams } = new URL(request.url);
  const isCatchup = searchParams.get('catchup') === '1';
  const forEmail = (searchParams.get('forEmail') || '').toLowerCase();

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

    // Owner attribution — map addedBy.firstName to a known operator email.
    // addedBy shape is { userId, firstName, at }, no .email field. We try
    // dmSentBy.firstName as a fallback (set when the operator marked the DM
    // as sent), and finally addedBy.firstName. null means the actor doesn't
    // match any hardcoded operator — those creators land in every operator's
    // digest so they don't silently fall through the cracks.
    const actorName = c.outreach?.dmSentBy?.firstName
      || c.outreach?.emailSentBy?.firstName
      || c.addedBy?.firstName
      || '';
    const ownerEmail = FIRSTNAME_TO_EMAIL[canonicaliseName(actorName)] || null;

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
    // In CATCHUP mode this is read-only — surface the bucket but don't
    // mutate the creator (otherwise running catchup would silently mark
    // a bunch of stale prospects cold, which the operator may want to
    // review first).
    if (days >= AUTO_COLD_DAYS) {
      cooled.push({ id: c.id, name: c.name, daysSinceDM: days });
      if (!isCatchup) {
        await updateCreator(c.id, {
          pipelineStatus: 'cold',
          outreach: { ...out, remindersSent: { ...remindersSent, autoCold: now.toISOString() } },
        }).catch(() => null);
      }
      buckets.autoCold.push({ id: c.id, name: c.name, niche: c.niche, daysSinceDM: days, ownerEmail });
      continue;
    }

    // Pick the highest-priority bucket the creator qualifies for (last touch > value drop > soft nudge).
    // CATCHUP MODE drops the remindersSent gate — we want to see every overdue
    // follow-up even if the daily cron already emailed about it before.
    let matched = null;
    for (const key of ['lastTouch', 'valueDrop', 'softNudge']) {
      const cfg = CADENCE[key];
      const alreadyReminded = !isCatchup && remindersSent[cfg.reminderKey];
      if (days >= cfg.day && followUpsDone <= cfg.followUpsDoneCap && !alreadyReminded) {
        matched = { key, cfg };
        break;
      }
    }
    if (!matched) continue;

    // Resolve the operator that will receive this row so we can sign the
     // copy-paste follow-up text with their name. Default to the addedBy
     // first name; ambiguous owners get "Raul" (the most common case).
    const ownerFirstName = c.addedBy?.firstName || 'Raul';
    const lang = (c.primaryLanguage || 'pt').toLowerCase();
    const langCode = lang === 'en' ? 'en' : lang === 'es' ? 'es' : 'pt';
    const creatorFirstName = (c.name || '').split(/\s+/)[0] || 'pessoa';
    const igUrl = c.platforms?.instagram?.url
      || (c.platforms?.instagram?.handle ? `https://instagram.com/${c.platforms.instagram.handle.replace(/^@/, '')}` : null);
    // Pre-canned follow-up DM text the operator can paste into the IG inbox.
    // One template per milestone × language. Stored emails (day 7 / day 14)
    // come from dmSequence when present — generated previously by dm-writer
    // in stage='followup_7' / 'followup_14'. If absent we fall back to the
    // brand-locked breakup template defined below.
    const followUpDm = buildFollowUpDm(matched.key, creatorFirstName, ownerFirstName, langCode);
    const storedFollowUpEmail = pickStoredFollowUpEmail(c, matched.key);

    buckets[matched.key].push({
      id: c.id,
      name: c.name,
      niche: c.niche,
      followers: pickFollowers(c),
      daysSinceDM: days,
      followUpsDone,
      ownerEmail,
      igUrl,
      followUpDm,
      followUpEmail: storedFollowUpEmail,
    });

    // Mark this reminder as sent for this creator → cron never re-pings the
    // same milestone (unless the operator advances follow-ups manually).
    // CATCHUP: skip this write so the catchup is fully read-only; the next
    // daily run still sees the same state and behaves identically.
    if (!isCatchup) {
      await updateCreator(c.id, {
        outreach: {
          ...out,
          remindersSent: { ...remindersSent, [matched.cfg.reminderKey]: now.toISOString() },
        },
      }).catch(() => null);
    }
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
  // CATCHUP MODE: restrict to a single operator (forEmail param) so we
  // don't accidentally re-email everyone with a giant catchup.
  const perOperator = [];
  const targetOps = isCatchup
    ? OPERATORS.filter(op => op.email.toLowerCase() === forEmail)
    : OPERATORS;
  if (isCatchup && targetOps.length === 0) {
    return NextResponse.json({ error: `catchup requires forEmail to match a known operator. got: ${forEmail || '(empty)'}` }, { status: 400 });
  }
  for (const op of targetOps) {
    const view = filterForOperator(buckets, op.email);
    const opTotalDue = view.lastTouch.length + view.valueDrop.length + view.softNudge.length;
    const actionable = opTotalDue > 0 || view.noDm.length > 0 || view.autoCold.length > 0;
    if (!actionable) {
      perOperator.push({ email: op.email, sent: false, reason: 'nothing-due' });
      continue;
    }
    try {
      await sendDigest(op, view, { ...stats, opTotalDue }, { catchup: isCatchup });
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

// ─── Follow-up DM templates ───
//
// Hand-written so the operator can paste straight into Instagram without
// editing. Tone matches Raul's voice (validate → soft re-ask → sign-off).
// Three milestones × three languages = 9 templates. The {creator} and
// {sender} placeholders get substituted at build time.
const DM_TEMPLATES = {
  pt: {
    softNudge:  `Olá {creator},\n\nNão quero ser persistente. Voltei a pensar no que te enviei e queria saber se fez algum sentido para o teu caso. Mesmo que não seja o momento certo, qualquer feedback ajuda.\n\nAbraço,\n{sender}`,
    valueDrop:  `Olá {creator},\n\nA acompanhar. Estive a trabalhar com alguém parecido com o teu perfil e o resultado deu-me uma ideia concreta para a tua estrutura. Vale o vídeo de 3 minutos?\n\nAbraço,\n{sender}`,
    lastTouch:  `Olá {creator},\n\nÚltimo toque do meu lado. Não vou voltar a mandar mensagem. Se um dia mudar de ideias, a porta fica aberta.\n\nAbraço,\n{sender}`,
  },
  en: {
    softNudge:  `Hey {creator},\n\nNot trying to be pushy. Just thinking about what I sent the other day and wondering if it landed for your case. Even a quick "not now" helps.\n\nCheers,\n{sender}`,
    valueDrop:  `Hey {creator},\n\nFollowing up. I've been working with a creator close to your profile and the result gave me a concrete idea for your structure. Worth a 3-minute video?\n\nCheers,\n{sender}`,
    lastTouch:  `Hey {creator},\n\nLast message from my side. I won't reach out again. If anything changes down the line, the door stays open.\n\nCheers,\n{sender}`,
  },
  es: {
    softNudge:  `Hola {creator},\n\nNo quiero ser pesado. Volví a pensar en lo que te escribí y quería saber si tuvo sentido para tu caso. Aunque no sea el momento, cualquier feedback ayuda.\n\nUn abrazo,\n{sender}`,
    valueDrop:  `Hola {creator},\n\nAtento. He estado trabajando con alguien parecido a tu perfil y el resultado me dio una idea concreta para tu estructura. ¿Vale un vídeo de 3 minutos?\n\nUn abrazo,\n{sender}`,
    lastTouch:  `Hola {creator},\n\nÚltimo mensaje de mi lado. No te volveré a escribir. Si algún día cambia, la puerta queda abierta.\n\nUn abrazo,\n{sender}`,
  },
};

function buildFollowUpDm(milestoneKey, creatorFirstName, senderFirstName, langCode) {
  const lang = DM_TEMPLATES[langCode] || DM_TEMPLATES.pt;
  const tpl = lang[milestoneKey] || lang.softNudge;
  return tpl
    .replace(/\{creator\}/g, creatorFirstName)
    .replace(/\{sender\}/g, senderFirstName);
}

// Surface a stored follow-up email (day 7 / day 14) from the creator's
// dmSequence when one exists. dm-writer only generates these on demand
// (stage='followup_7'/'followup_14') so most creators won't have one
// pre-baked. Returns null when nothing's available.
function pickStoredFollowUpEmail(creator, milestoneKey) {
  const seq = creator?.dmSequence;
  if (!seq) return null;
  const slot = milestoneKey === 'valueDrop'  ? 'email_day7'
             : milestoneKey === 'lastTouch'  ? 'email_day14'
             : null;
  if (!slot) return null;
  const e = seq[slot];
  if (!e || !e.body) return null;
  return { subject: e.subject || '', body: e.body };
}

// ── Email digest ──
//
// Per-operator (2026-05-20): each operator receives a digest with only the
// creators they own. The greeting + subject are personalised so the email
// reads like it was written for that person. Ambiguous (no-owner) creators
// are included in every operator's digest until somebody assigns them.
async function sendDigest(operator, buckets, stats, opts = {}) {
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
  const subjectPrefix = opts.catchup ? '[CATCHUP] ' : '';
  const subject = `${subjectPrefix}[Second Layer] Os teus reminders · ${subjectBits.join(' · ') || 'apenas update'}`;

  // Compact text row — used for noDm / autoCold sections that don't need
  // copy-paste payloads. The "due" sections render a richer per-creator
  // card via fmtCardText / fmtCardHtml below.
  const fmtRow = (c) => `• ${c.name}${c.niche ? ' · ' + c.niche : ''}${c.followers ? ' · ' + c.followers.toLocaleString() + ' followers' : ''} · DM enviada há ${c.daysSinceDM} dias${c.followUpsDone ? ' · ' + c.followUpsDone + ' follow-ups feitos' : ''}${c.ownerEmail ? '' : ' · ⚠ sem owner'}`;
  const fmtRowHtml = (c) => `<li style="margin-bottom: 6px;"><a href="${HUB_BASE}/creators/${c.id}?tab=dm" style="color: #f5f5f5; text-decoration: none; font-weight: 600;">${escape(c.name)}</a> <span style="color: #888;">${c.niche ? '· ' + escape(c.niche) : ''}${c.followers ? ' · ' + c.followers.toLocaleString() + ' followers' : ''} · DM há ${c.daysSinceDM} dias${c.followUpsDone ? ' · ' + c.followUpsDone + ' follow-ups' : ''}${c.ownerEmail ? '' : ' · <span style="color:#eab308;">⚠ sem owner</span>'}</span></li>`;

  // Rich card — for soft-nudge / value-drop / last-touch creators. Includes
  // an Instagram button (clickable on most mobile mail apps) and the
  // pre-canned follow-up DM in a monospace box that's easy to copy.
  // When a stored email (day 7 / day 14) exists, we also surface its
  // subject + body in a second copy block.
  const fmtCardText = (c) => {
    const lines = [];
    lines.push(`• ${c.name}${c.niche ? ' · ' + c.niche : ''}${c.followers ? ' · ' + c.followers.toLocaleString() + ' followers' : ''} · DM há ${c.daysSinceDM} dias${c.followUpsDone ? ' · ' + c.followUpsDone + ' follow-ups' : ''}${c.ownerEmail ? '' : ' · ⚠ sem owner'}`);
    if (c.igUrl) lines.push(`  Instagram: ${c.igUrl}`);
    lines.push(`  Hub: ${HUB_BASE}/creators/${c.id}?tab=dm`);
    if (c.followUpDm) {
      lines.push(`  ── DM follow-up (copia) ──`);
      c.followUpDm.split('\n').forEach(l => lines.push(`  ${l}`));
    }
    if (c.followUpEmail?.body) {
      lines.push(`  ── Email follow-up (copia) ──`);
      if (c.followUpEmail.subject) lines.push(`  Subject: ${c.followUpEmail.subject}`);
      c.followUpEmail.body.split('\n').forEach(l => lines.push(`  ${l}`));
    }
    return lines.join('\n');
  };

  const fmtCardHtml = (c) => {
    const igBtn = c.igUrl
      ? `<a href="${c.igUrl}" style="display: inline-block; padding: 6px 10px; background: #18181b; color: #f5f5f5; text-decoration: none; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; font-size: 11px; font-weight: 600; margin-right: 6px;">↗ Instagram</a>`
      : '';
    const hubBtn = `<a href="${HUB_BASE}/creators/${c.id}?tab=dm" style="display: inline-block; padding: 6px 10px; background: #B11E2F; color: #fff; text-decoration: none; border-radius: 6px; font-size: 11px; font-weight: 600;">↗ Abrir no Hub</a>`;
    const dmBlock = c.followUpDm ? `
      <div style="font-size: 10px; color: #B11E2F; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin: 14px 0 4px;">DM follow-up · copia</div>
      <pre style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #f5f5f5; background: #050505; border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 12px 14px; margin: 0; white-space: pre-wrap; line-height: 1.55;">${escape(c.followUpDm)}</pre>` : '';
    const emailBlock = c.followUpEmail?.body ? `
      <div style="font-size: 10px; color: #eab308; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin: 14px 0 4px;">Email follow-up · copia${c.followUpEmail.subject ? ' · ' + escape(c.followUpEmail.subject) : ''}</div>
      <pre style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #f5f5f5; background: #050505; border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 12px 14px; margin: 0; white-space: pre-wrap; line-height: 1.55;">${escape(c.followUpEmail.body)}</pre>` : '';
    return `
    <div style="background: #111; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px 18px; margin-bottom: 14px;">
      <div style="font-size: 16px; font-weight: 700; color: #f5f5f5;">${escape(c.name)}${c.ownerEmail ? '' : ' <span style="color:#eab308; font-size: 10px; font-weight: 700; letter-spacing: 0.1em;">⚠ SEM OWNER</span>'}</div>
      <div style="font-size: 12px; color: #888; margin: 2px 0 10px;">${c.niche ? escape(c.niche) + ' · ' : ''}${c.followers ? c.followers.toLocaleString() + ' followers · ' : ''}DM há ${c.daysSinceDM} dias${c.followUpsDone ? ' · ' + c.followUpsDone + ' follow-ups' : ''}</div>
      <div>${igBtn}${hubBtn}</div>
      ${dmBlock}
      ${emailBlock}
    </div>`;
  };

  // ── Plain-text version ──
  // Due-bucket creators render as cards (with IG link + copy-paste DM +
  // copy-paste email when available). Informational sections (noDm /
  // autoCold) stay compact rows. Blank line between cards for readability
  // in plain-text mail clients.
  const lines = [`Olá ${operator.firstName},`, ``, `Reminders dos teus creators corridos às ${lisbonTime} (Lisboa).`, ``];
  if (buckets.lastTouch.length) {
    lines.push(`⚠️  ÚLTIMO TOQUE — dia 14 (${buckets.lastTouch.length})`);
    lines.push(`Envia DM #3 e Email #3 (último contacto). Se não responder até dia 21, vai automaticamente para cold.`);
    lines.push('');
    buckets.lastTouch.forEach(c => { lines.push(fmtCardText(c)); lines.push(''); });
  }
  if (buckets.valueDrop.length) {
    lines.push(`🟠 VALUE DROP — dia 7 (${buckets.valueDrop.length})`);
    lines.push(`Envia DM #2 e Email #2. Drop de valor concreto (caso, número).`);
    lines.push('');
    buckets.valueDrop.forEach(c => { lines.push(fmtCardText(c)); lines.push(''); });
  }
  if (buckets.softNudge.length) {
    lines.push(`🟢 SOFT NUDGE — dia 3 (${buckets.softNudge.length})`);
    lines.push(`Envia DM #1 follow-up + Email #1 follow-up. Referência um post recente, sem pressão.`);
    lines.push('');
    buckets.softNudge.forEach(c => { lines.push(fmtCardText(c)); lines.push(''); });
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
  // Two section renderers:
  //   - `section()` for compact <li> rows (noDm / autoCold)
  //   - `cardSection()` for the due-bucket cards with IG button + copy blocks
  const section = (color, title, hint, items, fmt) => items.length === 0 ? '' : `
    <h3 style="font-size: 11px; color: ${color}; letter-spacing: 0.16em; text-transform: uppercase; margin: 28px 0 4px;">${title} <span style="color: #888; font-weight: 400;">· ${items.length}</span></h3>
    <p style="font-size: 13px; color: #888; margin: 0 0 12px;">${hint}</p>
    <ul style="padding-left: 16px; margin: 0; list-style: disc; font-size: 13px; color: #f5f5f5;">${items.map(fmt).join('')}</ul>`;

  const cardSection = (color, title, hint, items) => items.length === 0 ? '' : `
    <h3 style="font-size: 11px; color: ${color}; letter-spacing: 0.16em; text-transform: uppercase; margin: 28px 0 4px;">${title} <span style="color: #888; font-weight: 400;">· ${items.length}</span></h3>
    <p style="font-size: 13px; color: #888; margin: 0 0 14px;">${hint}</p>
    ${items.map(fmtCardHtml).join('')}`;

  // Headline uses opTotalDue — the count for THIS operator's filtered view,
  // not the team-wide total. Falls back to 0 for legacy callers that pass
  // the old stats shape.
  const headlineCount = stats.opTotalDue ?? stats.totalDue ?? 0;
  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; color: #f5f5f5; background: #0a0a0a; padding: 32px 28px; max-width: 640px;">
  <div style="font-size: 9px; color: #B11E2F; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;">● Reminders · ${escape(operator.firstName)}</div>
  <h1 style="font-size: 32px; font-weight: 700; margin: 8px 0 4px; color: #f5f5f5; letter-spacing: -0.02em;">${headlineCount} follow-up${headlineCount === 1 ? '' : 's'} ${headlineCount === 1 ? 'devido hoje' : 'devidos hoje'}</h1>
  <p style="font-size: 13px; color: #888; margin: 0;">${lisbonTime} · Lisboa · Só os teus creators</p>

  ${cardSection('#ef4444', '⚠️ Último toque · dia 14', 'Envia DM #3 e Email #3. Se não responder em 7 dias, vai automaticamente para cold.', buckets.lastTouch)}
  ${cardSection('#eab308', '🟠 Value drop · dia 7', 'Envia DM #2 e Email #2. Drop de valor concreto — caso, número, prova.', buckets.valueDrop)}
  ${cardSection('#22c55e', '🟢 Soft nudge · dia 3', 'Envia DM #1 follow-up + Email #1 follow-up. Referência um post recente, sem pressão.', buckets.softNudge)}

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
