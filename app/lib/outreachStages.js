/**
 * CRM Kanban — outreach pipeline (volume model, 2026-07).
 *
 * Stages are DERIVED from existing creator data. Operator can ALSO drag
 * a card between columns; the drag handler maps each stage to the
 * field-set that needs to be patched to land in that stage.
 *
 * New volume playbook (no more per-creator Loom):
 *   1. Por contactar        — added, no DM/email sent yet
 *   2. Em outreach          — DM/email sent, no reply yet
 *   3. Follow-up dia 3/7/14 — no-reply nudge cadence
 *   4. Respondeu            — creator replied (interested). Operator sends the
 *                             ONE generic video here (outreach.videoSentAt),
 *                             then the setter books the call. No column change.
 *   5. Reunião marcada      — discovery call booked
 *   6. Reunião realizada    — call happened (callHeldAt)
 *   7. Proposta             — post-meeting offer / proposal sent (pitch.sentAt)
 *   8. Frio                 — cold (manual or auto-aged-out)
 *
 * The per-creator Loom stages (pediu_loom / proposta_terminada / loom_enviado)
 * were removed in the volume pivot. Cards that sat in them re-bucket to
 * `contacto_feito` (Respondeu) automatically — they have repliedAt, so the
 * derivation lands them there with no data surgery.
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
  // Replied. The operator sends the generic video here and the setter books —
  // both happen inside this column (tracked via outreach.videoSentAt).
  { key: 'contacto_feito',       label: 'Respondeu',          accent: '#3b82f6', description: 'Respondeu · enviar vídeo / marcar call' },
  { key: 'reuniao_marcada',      label: 'Reunião marcada',    accent: '#22c55e', description: 'Call de descoberta agendada' },
  { key: 'reuniao_realizada',    label: 'Reunião realizada',  accent: '#16a34a', description: 'Call feita · preparar proposta' },
  { key: 'apresentacao_enviada', label: 'Proposta',           accent: '#7A0E18', description: 'Proposta / oferta enviada · à espera de decisão' },
  { key: 'frio',                 label: 'Frio',               accent: '#444',    description: 'Não interessado ou parou', terminal: true },
];

export const STAGE_KEYS = STAGES.map(s => s.key);
export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

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
  const callHeldAt      = o.callHeldAt    || creator.callHeldAt;
  const callBookedAt    = o.callBookedAt  || o.callAgreedAt || creator.callBookedAt;
  const repliedAt       = o.repliedAt     || creator.repliedAt;
  const dmSentAt        = o.dmSentAt      || creator.dmSentAt;
  const emailSentAt     = o.emailSentAt   || creator.emailSentAt;
  const followUpsDone   = Number(o.followUpsDone ?? creator.followUpsDone ?? 0);
  const lastFollowUpAt  = o.lastFollowUpAt || creator.lastFollowUpAt || null;

  if (notInterestedAt)              return 'frio';
  if (pitchSentAt)                  return 'apresentacao_enviada'; // Proposta
  if (callHeldAt)                   return 'reuniao_realizada';
  if (callBookedAt)                 return 'reuniao_marcada';
  if (repliedAt)                    return 'contacto_feito';       // Respondeu
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
          followUps: [], followUpsDone: 0, lastFollowUpAt: null,
          videoSentAt: null,
          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
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
          followUps: [], followUpsDone: 0, lastFollowUpAt: null,
          videoSentAt: null,
          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
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
          lastFollowUpAt: last?.at || now,
          videoSentAt: null,
          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    }
    case 'contacto_feito':
      // Replied. Preserve videoSentAt (set separately by "marcar vídeo enviado").
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
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
          callHeldAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'reuniao_realizada':
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          callBookedAt: getOutreach('callBookedAt') || getOutreach('callAgreedAt') || now,
          callHeldAt: getOutreach('callHeldAt') || now,
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
          notInterestedAt: null,
        },
        pitch: { sentAt: getPitchSent() || now },
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
      // Warmer read now: once the video is sent, the clock is the video→booking
      // gap (the warm-lead killer). Before the video, it's the reply age.
      const videoSentAt = o.videoSentAt || creator?.videoSentAt;
      if (videoSentAt) {
        const d = daysSince(videoSentAt);
        if (d > 4) return { days: d, level: 'cold', stale: true };
        if (d > 2) return { days: d, level: 'warn', stale: true };
        return { days: d, level: 'ok', stale: false };
      }
      const d = daysSince(o.repliedAt || creator?.repliedAt);
      if (d > 2) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'reuniao_marcada': {
      const booked = o.callBookedAt || o.callAgreedAt;
      const d = daysSince(booked);
      if (d > 3 && !o.callHeldAt) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'reuniao_realizada': {
      const d = daysSince(o.callHeldAt);
      if (d > 5) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'apresentacao_enviada': {
      const d = daysSince(creator?.pitch?.sentAt || o.callHeldAt);
      if (d > 10) return { days: d, level: 'cold', stale: true };
      if (d > 5)  return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'frio':
    default:
      return { days: -1, level: 'ok', stale: false };
  }
}
