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
  { email: 'tom@secondlayerhq.com',      firstName: 'Tomás'    },
  { email: 'raul@secondlayerhq.com',     firstName: 'Raul'     },
  { email: 'carolina@secondlayerhq.com', firstName: 'Carolina' },
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
// Sends ONE digest email per day to the OPERATORS above (@secondlayerhq.com).
// ─────────────────────────────────────────────────────────────────

export async function GET(request) {
  // Cron secret guard — FAIL CLOSED in deployed environments. This route
  // is middleware-public AND mutates state (auto-colds creators, marks
  // remindersSent) — if CRON_SECRET ever disappeared from the Vercel env,
  // the old `if (cronSecret && ...)` shape silently made it publicly
  // triggerable. Only skip the check locally (no VERCEL env).
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret && process.env.VERCEL) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
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

  // CATCHUP RATE-LIMIT.
  // The catchup endpoint sends one email per invocation. A runaway client
  // (e.g. a polling loop that hits the URL faster than Vercel's function
  // duration) can cause N invocations all running to completion server-
  // side, sending N emails to the operator. Happened once already — never
  // again. Per-operator in-memory lock with 5min TTL, stored on globalThis
  // so it survives across warm invocations on the same function instance.
  // Not 100% reliable across cold starts / multi-instance routing, but
  // catches the realistic accidental-burst case.
  if (isCatchup && forEmail) {
    globalThis.__slCatchupLocks ||= new Map();
    const lastFiredAt = globalThis.__slCatchupLocks.get(forEmail);
    if (lastFiredAt && (Date.now() - lastFiredAt) < 5 * 60 * 1000) {
      const ageS = Math.round((Date.now() - lastFiredAt) / 1000);
      return NextResponse.json({
        error: `catchup recently fired for ${forEmail} (${ageS}s ago). Wait ${300 - ageS}s before retrying.`,
        rateLimited: true,
      }, { status: 429 });
    }
    globalThis.__slCatchupLocks.set(forEmail, Date.now());
  }

  const now = new Date();
  const summaries = await listCreators();
  // Active = prospect status, not signed, not already cold, not replied.
  // (repliedAt is in the summary, so we drop engaged creators before any
  // full-record read.)
  const candidates = summaries.filter(s => {
    const st = s.pipelineStatus || 'prospect';
    return st !== 'signed' && st !== 'cold' && !s.repliedAt;
  });

  // Batch-load full records in parallel chunks of 25 instead of the old
  // sequential per-creator loop. The loop below still does the milestone
  // math + inline auto-cold writes; it just iterates preloaded records so
  // the read phase is ~N/25 round-trips, not N sequential (which grew
  // linearly and could 504 the operator-triggered catchup mode).
  const fulls = [];
  for (let i = 0; i < candidates.length; i += 25) {
    const chunk = candidates.slice(i, i + 25);
    const loaded = await Promise.all(chunk.map(s => getCreator(s.id).catch(() => null)));
    fulls.push(...loaded);
  }

  const buckets = { lastTouch: [], valueDrop: [], softNudge: [], noDm: [], autoCold: [] };
  const cooled = []; // creators we auto-mark cold this run

  for (const c of fulls) {
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
        // Re-check repliedAt on a FRESH read right before mutating — this
        // loop runs for minutes over hundreds of creators, and an operator
        // marking a reply mid-run must not have their creator auto-colded.
        // The outreach update is SPARSE (updateCreator deep-merges it onto
        // fresh state) so no other outreach field can be clobbered.
        const freshCheck = await getCreator(c.id, { fresh: true }).catch(() => null);
        if (!freshCheck?.outreach?.repliedAt) {
          await updateCreator(c.id, {
            pipelineStatus: 'cold',
            outreach: { remindersSent: { autoCold: now.toISOString() } },
          }).catch(() => null);
        }
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
      // Milestone key drives the /r/follow-up redirect URLs in the email.
      milestoneKey: matched.key,
      // Has-email flag — controls whether the "Email reply" button is
      // even shown in the digest. Avoids dead-end mailto links.
      hasContactEmail: !!(c.contactEmail || c.email),
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

export function buildFollowUpDm(milestoneKey, creatorFirstName, senderFirstName, langCode) {
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
export function pickStoredFollowUpEmail(creator, milestoneKey) {
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

  // ── Email is now a REMINDER ONLY ──
  // The actual click-to-copy + open-IG work moved into the in-app
  // floating tray on /creators. The email's job is to surface the
  // operator-specific count so they remember to open the hub. Keeps
  // mobile inboxes uncluttered and removes the mismatch where clicking
  // a stale email link could advance a creator twice.
  const headlineCount = stats.opTotalDue ?? stats.totalDue ?? 0;
  const subjectPrefix = opts.catchup ? '[CATCHUP] ' : '';
  const subject = headlineCount > 0
    ? `${subjectPrefix}[Second Layer] ${headlineCount} follow-up${headlineCount === 1 ? '' : 's'} no hub`
    : `${subjectPrefix}[Second Layer] Reminders · sem follow-ups hoje`;

  // ── Plain-text version ──
  const lines = [
    `Olá ${operator.firstName},`,
    ``,
    headlineCount === 0
      ? `Não tens follow-ups pendentes hoje.`
      : `Tens ${headlineCount} follow-up${headlineCount === 1 ? '' : 's'} para fazer hoje.`,
    ``,
  ];
  if (buckets.lastTouch.length) lines.push(`• ${buckets.lastTouch.length} dia 14 (último toque)`);
  if (buckets.valueDrop.length) lines.push(`• ${buckets.valueDrop.length} dia 7 (value drop)`);
  if (buckets.softNudge.length) lines.push(`• ${buckets.softNudge.length} dia 3 (soft nudge)`);
  if (headlineCount > 0) {
    lines.push('');
    lines.push(`Abre o CRM e usa o widget no canto inferior direito — clica num follow-up para copiar a mensagem e abrir o Instagram automaticamente.`);
    lines.push('');
    lines.push(`Hub: ${HUB_BASE}/creators`);
  }
  if (buckets.noDm.length) {
    lines.push('');
    lines.push(`📭 ${buckets.noDm.length} creator${buckets.noDm.length === 1 ? '' : 's'} sem DM ainda (informativo).`);
    buckets.noDm.slice(0, 8).forEach(c => lines.push(`  • ${c.name}${c.niche ? ' · ' + c.niche : ''} · adicionado há ${c.ageDays}d`));
    if (buckets.noDm.length > 8) lines.push(`  … e mais ${buckets.noDm.length - 8}`);
  }
  if (buckets.autoCold.length) {
    lines.push('');
    lines.push(`❄️ ${buckets.autoCold.length} auto-cooled hoje (21+ dias sem resposta).`);
  }
  const text = lines.join('\n');

  // ── HTML version ──
  // Big count, three counters, one button. That's the entire email now.
  const counterRow = (color, label, n) => n === 0 ? '' : `
    <div style="display: inline-block; padding: 10px 16px; margin: 0 8px 8px 0; background: rgba(255,255,255,0.03); border: 1px solid ${color}33; border-radius: 8px;">
      <div style="font-size: 22px; font-weight: 700; color: ${color}; line-height: 1;">${n}</div>
      <div style="font-size: 10px; color: #888; margin-top: 4px; letter-spacing: 0.06em; text-transform: uppercase;">${label}</div>
    </div>`;

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; color: #f5f5f5; background: #0a0a0a; padding: 32px 28px; max-width: 560px;">
  <div style="font-size: 9px; color: #B11E2F; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;">● Reminders · ${escape(operator.firstName)}</div>
  <h1 style="font-size: 36px; font-weight: 700; margin: 8px 0 4px; color: #f5f5f5; letter-spacing: -0.02em;">${headlineCount === 0 ? 'Tudo em dia ✓' : `${headlineCount} follow-up${headlineCount === 1 ? '' : 's'} hoje`}</h1>
  <p style="font-size: 13px; color: #888; margin: 0 0 24px;">${lisbonTime} · Lisboa · Só os teus creators</p>

  ${headlineCount === 0 ? '' : `
    <div style="margin: 4px 0 22px;">
      ${counterRow('#ea580c', 'Dia 14',  buckets.lastTouch.length)}
      ${counterRow('#f97316', 'Dia 7',   buckets.valueDrop.length)}
      ${counterRow('#f59e0b', 'Dia 3',   buckets.softNudge.length)}
    </div>
    <p style="font-size: 14px; color: #ccc; margin: 0 0 22px; line-height: 1.55;">Abre o CRM e clica no widget no canto inferior direito. Cada follow-up copia a mensagem e abre o Instagram automaticamente — sem mais cliques.</p>
    <p style="margin: 0 0 32px;"><a href="${HUB_BASE}/creators" style="display: inline-block; padding: 12px 22px; background: #B11E2F; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Abrir CRM e fazer follow-ups</a></p>
  `}
  ${headlineCount === 0 ? `<p style="font-size: 14px; color: #888; margin: 0 0 24px;">Sem follow-ups pendentes para ti hoje. Bom dia.</p>` : ''}

  ${buckets.noDm.length === 0 ? '' : `
    <h3 style="font-size: 11px; color: #3b82f6; letter-spacing: 0.16em; text-transform: uppercase; margin: 28px 0 4px;">📭 Sem DM ainda <span style="color: #888; font-weight: 400;">· ${buckets.noDm.length}</span></h3>
    <p style="font-size: 12px; color: #888; margin: 0 0 12px;">Creators no CRM há ≥1 dia sem outreach. Não contam como follow-ups mas vale a pena fechar.</p>
    <ul style="padding-left: 16px; margin: 0; list-style: disc; font-size: 12px; color: #ccc;">${buckets.noDm.slice(0, 10).map(c => `<li style="margin-bottom: 4px;"><a href="${HUB_BASE}/creators/${c.id}?tab=dm" style="color: #ccc; text-decoration: none;">${escape(c.name)}</a> <span style="color: #666;">${c.niche ? '· ' + escape(c.niche) : ''} · há ${c.ageDays}d</span></li>`).join('')}${buckets.noDm.length > 10 ? `<li style="color:#555;">… e mais ${buckets.noDm.length - 10}</li>` : ''}</ul>`}

  ${buckets.autoCold.length === 0 ? '' : `
    <h3 style="font-size: 11px; color: #555; letter-spacing: 0.16em; text-transform: uppercase; margin: 28px 0 4px;">❄️ Auto-cold <span style="color: #555; font-weight: 400;">· ${buckets.autoCold.length}</span></h3>
    <p style="font-size: 12px; color: #888; margin: 0;">21+ dias sem resposta. Movidos automaticamente para Frio.</p>`}
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
