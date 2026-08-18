/**
 * CRM Kanban — outreach pipeline (volume model, 2026-07).
 *
 * Stages are DERIVED from existing creator data. Operator can ALSO drag
 * a card between columns; the drag handler maps each stage to the
 * field-set that needs to be patched to land in that stage.
 *
 * Value-first playbook (no video, no Loom):
 *   1. Por contactar        — added, no DM/email sent yet
 *   2. Em outreach          — DM/email sent, no reply yet
 *   3. Follow-up dia 3/7/14 — no-reply nudge cadence (value-first)
 *   4. Respondeu            — creator replied; operator keeps giving value
 *   5. Reunião marcada      — discovery call booked (setter, manual)
 *   6. Reunião realizada    — call happened (callHeldAt)
 *   7. Proposta             — post-meeting offer / proposal sent (pitch.sentAt)
 *   8. Frio                 — cold (manual or auto-aged-out)
 *
 * There is no video step: the flow jumps straight from a reply to a booking.
 * Legacy leads that used to sit in "Vídeo enviado" (they have repliedAt) re-bucket
 * to `contacto_feito` (Respondeu) automatically, with no data surgery.
 *
 * Signed creators jump out of this Kanban into the Delivery page.
 */

export const STAGES = [
  { key: 'por_contactar',        label: 'Por contactar',      accent: '#666',    description: 'Add criado · sem outreach' },
  { key: 'em_outreach',          label: 'Em outreach',        accent: '#eab308', description: 'DM/email enviado · sem resposta' },
  // Three follow-up windows between initial outreach and a real reply. A card
  // lands in the matching column the moment its follow-up message is copied.
  { key: 'followup_3',           label: 'Follow-up · dia 3',  accent: '#f59e0b', description: '1º follow-up enviado · à espera' },
  { key: 'followup_7',           label: 'Follow-up · dia 7',  accent: '#f97316', description: '2º follow-up enviado · à espera' },
  { key: 'followup_14',          label: 'Follow-up · dia 14', accent: '#ea580c', description: 'Último toque · 7 dias até Frio' },
  // Replied. The operator keeps giving value here until the meeting is booked —
  // there is no video step; the flow jumps straight from a reply to a booking.
  { key: 'contacto_feito',       label: 'Respondeu',          accent: '#3b82f6', description: 'Respondeu · a dar valor até marcar' },
  { key: 'reuniao_marcada',      label: 'Reunião marcada',    accent: '#22c55e', description: 'Call de descoberta agendada' },
  // Meeting sequence: R1 (first call held) → R2 → Q&A. R1 reuses callHeldAt so
  // existing "meeting held" leads land here; R2/Q&A have their own timestamps.
  { key: 'r1',                   label: 'R1',                 accent: '#16a34a', description: 'Reunião 1 realizada' },
  { key: 'r2',                   label: 'R2',                 accent: '#15803d', description: 'Reunião 2 realizada' },
  { key: 'qna',                  label: 'Q&A',                accent: '#0d9488', description: 'Sessão de Q&A' },
  { key: 'apresentacao_enviada', label: 'Proposta',           accent: '#7A0E18', description: 'Proposta / oferta enviada · à espera de decisão' },
  // Replied but no immediate interest — long-term nurture instead of straight
  // to Frio (outreach.nutricaoAt).
  { key: 'nutricao',             label: 'Nutrição',           accent: '#0ea5e9', description: 'Respondeu mas sem interesse imediato · a nutrir' },
  { key: 'frio',                 label: 'Frio',               accent: '#444',    description: 'Não interessado ou parou', terminal: true },
];

export const STAGE_KEYS = STAGES.map(s => s.key);
export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

// Event-phrased labels for the per-lead journey timeline. The Kanban column
// names describe a *state* ("Em outreach"); the journey wants the *event* that
// put the lead there ("1ª DM"). Same stages, worded as a log: Adicionado → 1ª
// DM → Respondeu → … Terminal outcomes get their own labels.
export const STAGE_EVENT_LABELS = {
  por_contactar:        'Adicionado',
  em_outreach:          '1ª DM',
  followup_3:           'Follow-up 1',
  followup_7:           'Follow-up 2',
  followup_14:          'Follow-up 3',
  contacto_feito:       'Respondeu',
  reuniao_marcada:      'Reunião marcada',
  r1:                   'R1',
  r2:                   'R2',
  qna:                  'Q&A',
  apresentacao_enviada: 'Proposta',
  nutricao:             'Nutrição',
  signed:               'Fechado',
  frio:                 'Frio',
};

// The forward "happy path" — the sequence a winning lead walks, ending at
// Fechado. Drives the dimmed not-yet-reached nodes on the journey timeline.
// Deliberately excludes the no-reply follow-up windows (a branch) and Frio (a
// failure outcome), which are handled separately.
export const HAPPY_PATH = [
  'por_contactar', 'em_outreach', 'contacto_feito',
  'reuniao_marcada', 'r1', 'r2', 'qna', 'apresentacao_enviada', 'signed',
];

// Follow-up stage ↔ cron-milestone mapping. Single source of truth so the
// tray, the Kanban, and the cron all agree which "dia X" matches which
// template ('softNudge' / 'valueDrop' / 'lastTouch').
export const FOLLOWUP_STAGE_TO_MILESTONE = {
  followup_3:  'softNudge',
  followup_7:  'valueDrop',
  followup_14: 'lastTouch',
};
export const MILESTONE_TO_FOLLOWUP_STAGE = {
  softNudge:  'followup_3',
  valueDrop:  'followup_7',
  lastTouch:  'followup_14',
};
// Day-14 follow-up + N days with no reply → silent move to Frio.
export const DAYS_FROM_DAY14_TO_FRIO = 7;

/**
 * Compute current stage from creator data. Walk LATEST signal first so a
 * card with a proposal sent registers as 'apresentacao_enviada' (Proposta)
 * even if every earlier timestamp is also set.
 *
 * Returns one of STAGE_KEYS, or 'signed' (which the Kanban filters out).
 */
export function computeOutreachStage(creator) {
  if (!creator) return 'por_contactar';

  if (creator.pipelineStatus === 'signed') return 'signed';
  if (creator.pipelineStatus === 'cold')   return 'frio';

  // Tolerant of both shapes: full record stores under creator.outreach.*,
  // the CRM list summary flattens them to the top level.
  const o = creator.outreach || {};
  const notInterestedAt = o.notInterestedAt || creator.notInterestedAt;
  const pitchSentAt     = creator.pitch?.sentAt || creator.pitchSentAt;
  const qnaAt           = o.qnaAt         || creator.qnaAt;
  const r2At            = o.r2At          || creator.r2At;
  const callHeldAt      = o.callHeldAt    || creator.callHeldAt;   // R1 (first meeting held)
  const callBookedAt    = o.callBookedAt  || o.callAgreedAt || creator.callBookedAt;
  const nutricaoAt      = o.nutricaoAt    || creator.nutricaoAt;
  const repliedAt       = o.repliedAt     || creator.repliedAt;
  const dmSentAt        = o.dmSentAt      || creator.dmSentAt;
  const emailSentAt     = o.emailSentAt   || creator.emailSentAt;
  const followUpsDone   = Number(o.followUpsDone ?? creator.followUpsDone ?? 0);
  const lastFollowUpAt  = o.lastFollowUpAt || creator.lastFollowUpAt || null;

  if (notInterestedAt)              return 'frio';
  if (pitchSentAt)                  return 'apresentacao_enviada'; // Proposta
  if (qnaAt)                        return 'qna';
  if (r2At)                         return 'r2';
  if (callHeldAt)                   return 'r1';                   // first meeting held
  if (callBookedAt)                 return 'reuniao_marcada';
  // Nutrição sits BELOW the meeting stages: a lead who booked/held a meeting
  // has re-engaged and shows there; only a replied-but-stalled lead lands here.
  if (nutricaoAt)                   return 'nutricao';
  if (repliedAt)                    return 'contacto_feito';       // Respondeu — warm, giving value until booked
  // Day-14 follow-up sent + N days, no reply → Frio (silent auto-cold).
  if (followUpsDone >= 3 && lastFollowUpAt) {
    const ms = Date.now() - new Date(lastFollowUpAt).getTime();
    if (ms >= DAYS_FROM_DAY14_TO_FRIO * 86_400_000) return 'frio';
  }
  if (followUpsDone >= 3)           return 'followup_14';
  if (followUpsDone === 2)          return 'followup_7';
  if (followUpsDone === 1)          return 'followup_3';
  if (dmSentAt || emailSentAt)      return 'em_outreach';
  return 'por_contactar';
}

/**
 * Inverse mapping for drag-and-drop. Returns a SPARSE creator patch that,
 * fed back through computeOutreachStage(), lands the card in targetStage.
 * Forward moves stamp "now" when a field is missing; backward moves clear
 * later fields. Fields not mentioned are preserved by the server deep-merge.
 */
export function stagePatch(creator, targetStage) {
  const now = new Date().toISOString();
  const getOutreach = (key) => creator?.outreach?.[key] ?? creator?.[key] ?? null;
  const getPitchSent = () => creator?.pitch?.sentAt ?? creator?.pitchSentAt ?? null;

  switch (targetStage) {
    case 'por_contactar':
      // Clear EVERYTHING outreach-related — card returns to start.
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: null, emailSentAt: null,
          repliedAt: null, repliedChannel: null,
          followUps: [], followUpsDone: 0, lastFollowUpAt: null,          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
          r2At: null, qnaAt: null, nutricaoAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'em_outreach':
      // Keep dmSentAt; clear everything from reply onwards.
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: null, repliedChannel: null,
          followUps: [], followUpsDone: 0, lastFollowUpAt: null,          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
          r2At: null, qnaAt: null, nutricaoAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'followup_3':
    case 'followup_7':
    case 'followup_14': {
      const targetLen = targetStage === 'followup_3' ? 1
                       : targetStage === 'followup_7' ? 2 : 3;
      const existing = Array.isArray(getOutreach('followUps')) ? getOutreach('followUps') : [];
      const trimmed = existing.slice(0, targetLen);
      const milestoneFor = ['softNudge', 'valueDrop', 'lastTouch'];
      while (trimmed.length < targetLen) {
        trimmed.push({ channel: 'unknown', at: now, by: null, milestone: milestoneFor[trimmed.length], source: 'drag' });
      }
      const last = trimmed[trimmed.length - 1];
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: null, repliedChannel: null,
          followUps: trimmed,
          followUpsDone: trimmed.length,
          lastFollowUpAt: last?.at || now,          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
          r2At: null, qnaAt: null, nutricaoAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    }
    case 'contacto_feito':
      // Replied — warm, giving value until a meeting is booked. Clear the
      // meeting/proposal fields so a drag back here means "still working the reply".
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
          r2At: null, qnaAt: null, nutricaoAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'reuniao_marcada':
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          callBookedAt: getOutreach('callBookedAt') || getOutreach('callAgreedAt') || now,
          callHeldAt: null, r2At: null, qnaAt: null, nutricaoAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'r1': // Reunião 1 realizada (reuses callHeldAt)
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          callBookedAt: getOutreach('callBookedAt') || getOutreach('callAgreedAt') || now,
          callHeldAt: getOutreach('callHeldAt') || now,
          r2At: null, qnaAt: null, nutricaoAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'r2': // Reunião 2 realizada
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          callBookedAt: getOutreach('callBookedAt') || getOutreach('callAgreedAt') || now,
          callHeldAt: getOutreach('callHeldAt') || now,
          r2At: getOutreach('r2At') || now,
          qnaAt: null, nutricaoAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'qna': // Sessão de Q&A
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          callBookedAt: getOutreach('callBookedAt') || getOutreach('callAgreedAt') || now,
          callHeldAt: getOutreach('callHeldAt') || now,
          r2At: getOutreach('r2At') || now,
          qnaAt: getOutreach('qnaAt') || now,
          nutricaoAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'apresentacao_enviada': // Proposta
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          callBookedAt: getOutreach('callBookedAt') || getOutreach('callAgreedAt') || now,
          callHeldAt: getOutreach('callHeldAt') || now,
          nutricaoAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: getPitchSent() || now },
      };
    case 'nutricao':
      // Replied but no immediate interest — parked for long-term nurture. Clear
      // the meeting/proposal fields so it derives to Nutrição; keep the reply
      // as history. Not cold — pipelineStatus stays 'prospect'.
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          nutricaoAt: getOutreach('nutricaoAt') || now,
          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
          r2At: null, qnaAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'frio':
      return {
        pipelineStatus: 'cold',
        outreach: { notInterestedAt: getOutreach('notInterestedAt') || now },
      };
    default:
      return null;
  }
}

/**
 * Ordered stage → entry-timestamp extractor. Returns, for every pipeline
 * stage, the ISO moment the creator ENTERED it (or null if never), in the
 * canonical STAGES order. This is the single source of truth behind both the
 * per-lead journey timeline (Negócio card) and the team stage analytics, so
 * the two can never disagree about when a stage started.
 *
 * Tolerant of both shapes: full record (creator.outreach.*) and CRM summary
 * (flattened to the top level), mirroring computeOutreachStage.
 */
export function stageEntries(creator) {
  if (!creator) return { entries: [], signedAt: null, frioAt: null };
  const o = creator.outreach || {};
  const pick = (k) => o[k] ?? creator[k] ?? null;
  const followUps = Array.isArray(o.followUps) ? o.followUps
                   : Array.isArray(creator.followUps) ? creator.followUps : [];
  const entries = [
    { key: 'por_contactar',        at: creator.createdAt || null },
    { key: 'em_outreach',          at: pick('dmSentAt') || pick('emailSentAt') || null },
    { key: 'followup_3',           at: followUps[0]?.at || null },
    { key: 'followup_7',           at: followUps[1]?.at || null },
    { key: 'followup_14',          at: followUps[2]?.at || null },
    { key: 'contacto_feito',       at: pick('repliedAt') || null },
    { key: 'reuniao_marcada',      at: pick('callBookedAt') || pick('callAgreedAt') || null },
    { key: 'r1',                   at: pick('callHeldAt') || null },
    { key: 'r2',                   at: pick('r2At') || null },
    { key: 'qna',                  at: pick('qnaAt') || null },
    { key: 'apresentacao_enviada', at: creator.pitch?.sentAt || pick('pitchSentAt') || null },
    { key: 'nutricao',             at: pick('nutricaoAt') || null },
  ];
  const signedAt = creator.pipelineStatus === 'signed' ? (creator.signedAt || null) : null;
  const frioAt = pick('notInterestedAt') || o.remindersSent?.autoCold || null;
  return { entries, signedAt, frioAt };
}

/**
 * Build the lead's journey as an ordered list of stages it actually entered,
 * each with the time spent there. Duration of a stage = (entry of the NEXT
 * stage the lead entered) − (entry of this stage), so skipped stages don't
 * break the chain. The final active stage is marked `ongoing` and measured to
 * `nowMs`. Terminal outcomes (Assinado / Frio) are returned separately so the
 * UI can cap the journey.
 */
export function stageTimeline(creator, nowMs = Date.now()) {
  const { entries, signedAt, frioAt } = stageEntries(creator);
  const present = entries.filter(e => e.at && Number.isFinite(new Date(e.at).getTime()));
  const currentKey = computeOutreachStage(creator);
  const isSigned = creator?.pipelineStatus === 'signed' || currentKey === 'signed';
  const isFrio = currentKey === 'frio';
  const terminalAt = isSigned ? signedAt : isFrio ? frioAt : null;

  const steps = present.map((e, i) => {
    const meta = STAGES.find(s => s.key === e.key) || {};
    const startMs = new Date(e.at).getTime();
    let endMs;
    let ongoing = false;
    if (i + 1 < present.length) {
      endMs = new Date(present[i + 1].at).getTime();
    } else if ((isSigned || isFrio) && terminalAt) {
      endMs = new Date(terminalAt).getTime();
    } else if (isSigned || isFrio) {
      endMs = startMs; // terminal but no reliable end stamp → 0 dwell
    } else {
      endMs = nowMs; ongoing = true; // still sitting here
    }
    return {
      key: e.key,
      label: meta.label || e.key,
      eventLabel: STAGE_EVENT_LABELS[e.key] || meta.label || e.key,
      accent: meta.accent || '#666',
      enteredAt: e.at,
      durationMs: Math.max(0, endMs - startMs),
      ongoing,
    };
  });

  let terminal = null;
  if (isSigned) terminal = { key: 'signed', label: 'Assinado', eventLabel: STAGE_EVENT_LABELS.signed, accent: '#22c55e', enteredAt: terminalAt || null };
  else if (isFrio) terminal = { key: 'frio', label: 'Frio', eventLabel: STAGE_EVENT_LABELS.frio, accent: '#444', enteredAt: terminalAt || null };

  // Upcoming stages the lead hasn't reached yet — rendered as dimmed
  // placeholders so the whole road ahead (ending at Fechado) is always visible.
  // The happy path only: the no-reply follow-up windows are a branch, not a
  // forward step, so they're excluded. Empty for terminal (signed / frio) leads.
  let future = [];
  if (!isSigned && !isFrio) {
    // Map the current stage onto the happy path. Follow-up stages sit at the
    // same point as "1ª DM" (still pre-reply), so the road ahead starts at
    // "Respondeu".
    const preReply = { followup_3: 1, followup_7: 1, followup_14: 1 };
    const idx = preReply[currentKey] != null ? preReply[currentKey] : HAPPY_PATH.indexOf(currentKey);
    if (idx >= 0) {
      future = HAPPY_PATH.slice(idx + 1).map(k => ({
        key: k,
        eventLabel: STAGE_EVENT_LABELS[k] || k,
        accent: k === 'signed' ? '#22c55e' : (STAGES.find(s => s.key === k)?.accent || '#666'),
      }));
    }
  }

  const firstMs = present.length ? new Date(present[0].at).getTime() : null;
  const endTotalMs = (terminal && terminal.enteredAt) ? new Date(terminal.enteredAt).getTime()
                   : (isSigned || isFrio) ? (present.length ? new Date(present[present.length - 1].at).getTime() : null)
                   : nowMs;
  const totalMs = (firstMs != null && endTotalMs != null) ? Math.max(0, endTotalMs - firstMs) : null;

  return { steps, terminal, future, totalMs, currentKey };
}

/**
 * Compact human duration in PT-PT. Tuned for pipeline dwell times: minutes →
 * hours → days → weeks → months. Always one significant unit.
 */
export function formatDurationShort(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 60_000) return 'agora';
  const mins = ms / 60_000;
  if (mins < 60) return `${Math.round(mins)}min`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 14) return `${Math.round(days)}d`;
  const weeks = days / 7;
  if (weeks < 9) return `${Math.round(weeks)} sem`;
  const months = days / 30;
  return `${Math.round(months)} ${Math.round(months) === 1 ? 'mês' : 'meses'}`;
}

/**
 * Group an array of creators by computed stage. Empty stages still get an
 * empty array so the Kanban can render every column.
 */
export function groupByStage(creators) {
  const grouped = Object.fromEntries(STAGE_KEYS.map(k => [k, []]));
  for (const c of creators || []) {
    const stage = computeOutreachStage(c);
    if (stage === 'signed') continue; // signed → Delivery page
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push(c);
  }
  return grouped;
}

function daysSince(iso) {
  if (!iso) return -1;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return -1;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/**
 * Per-stage staleness rules. Returns { days, level, stale }.
 * Used to render age chips + auto-suggest pills on cards.
 */
export function stageStaleness(creator) {
  const stage = computeOutreachStage(creator);
  const o = creator?.outreach || {};
  switch (stage) {
    case 'por_contactar':
      return { days: daysSince(creator?.createdAt), level: 'ok', stale: false };
    case 'em_outreach': {
      const d = daysSince(o.dmSentAt || o.emailSentAt || creator?.dmSentAt);
      if (d > 14) return { days: d, level: 'cold', stale: true };
      if (d > 7)  return { days: d, level: 'warn', stale: false };
      return { days: d, level: 'ok', stale: false };
    }
    case 'contacto_feito': {
      // Replied — warm. Keep giving value and push for the booking; the
      // reply→booking gap is the warm-lead killer, so it colds faster.
      const d = daysSince(o.repliedAt || creator?.repliedAt);
      if (d > 5) return { days: d, level: 'cold', stale: true };
      if (d > 2) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'reuniao_marcada': {
      const booked = o.callBookedAt || o.callAgreedAt;
      const d = daysSince(booked);
      if (d > 3 && !o.callHeldAt) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'r1': {
      const d = daysSince(o.callHeldAt);
      if (d > 7) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'r2': {
      const d = daysSince(o.r2At);
      if (d > 7) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'qna': {
      const d = daysSince(o.qnaAt);
      if (d > 7) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'apresentacao_enviada': {
      const d = daysSince(creator?.pitch?.sentAt || o.callHeldAt);
      if (d > 10) return { days: d, level: 'cold', stale: true };
      if (d > 5)  return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'nutricao': {
      // Long-term nurture — slow burn, so it only nudges after a long gap.
      const d = daysSince(o.nutricaoAt);
      if (d > 45) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'frio':
    default:
      return { days: -1, level: 'ok', stale: false };
  }
}
