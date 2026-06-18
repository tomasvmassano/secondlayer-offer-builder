/**
 * CRM Kanban — 8-stage outreach pipeline.
 *
 * Stages are DERIVED from existing creator data. Operator can ALSO drag
 * a card between columns; the drag handler maps each stage to the
 * field-set that needs to be patched to land in that stage.
 *
 * Order matches Tomás's playbook:
 *   1. Por contactar       — added, no DM/email sent yet
 *   2. Em outreach         — DM/email sent, no reply yet
 *   3. Contacto feito      — creator replied, no Loom request yet
 *   4. Pediu Loom          — creator asked for a personalised Loom
 *   5. Loom enviado        — Loom recorded + delivered
 *   6. Reunião marcada     — discovery call booked
 *   7. Apresentação enviada — pitch deck shared
 *   8. Frio                 — cold (manual or auto-aged-out)
 *
 * Signed creators jump out of this Kanban into the Delivery page (the
 * existing /pipeline view) — they're no longer in the sales funnel.
 */

export const STAGES = [
  { key: 'por_contactar',         label: 'Por contactar',         accent: '#666',    description: 'Add criado · sem outreach' },
  { key: 'em_outreach',           label: 'Em outreach',           accent: '#eab308', description: 'DM/email enviado · sem resposta' },
  // Three follow-up windows BETWEEN initial outreach and a real reply.
  // A card lands in the matching column the moment its follow-up message
  // is copied — the in-app tray records the touch. The cron email is now
  // just a per-operator reminder count; the work itself happens here.
  { key: 'followup_3',            label: 'Follow-up · dia 3',     accent: '#f59e0b', description: '1º follow-up enviado · à espera' },
  { key: 'followup_7',            label: 'Follow-up · dia 7',     accent: '#f97316', description: '2º follow-up enviado · à espera' },
  { key: 'followup_14',           label: 'Follow-up · dia 14',    accent: '#ea580c', description: 'Último toque · 7 dias até Frio' },
  { key: 'contacto_feito',        label: 'Contacto feito',        accent: '#3b82f6', description: 'Respondeu · pronto para Loom' },
  { key: 'pediu_loom',            label: 'Pediu Loom',            accent: '#a855f7', description: 'Pediu Loom personalizado' },
  // After the creator asks for a Loom, the operator needs to build the
  // actual proposal (offer wizard outputs + deck) before recording the
  // Loom around it. This stage marks "proposal is finished, ready to
  // record the Loom". Triggered by outreach.proposalReadyAt.
  { key: 'proposta_terminada',    label: 'Proposta terminada',    accent: '#8b5cf6', description: 'Oferta + deck prontos · gravar Loom' },
  { key: 'loom_enviado',          label: 'Loom enviado',          accent: '#c084fc', description: 'Loom entregue · à espera de resposta' },
  { key: 'reuniao_marcada',       label: 'Reunião marcada',       accent: '#22c55e', description: 'Call de descoberta agendada' },
  { key: 'apresentacao_enviada',  label: 'Apresentação enviada',  accent: '#7A0E18', description: 'Deck partilhado · à espera de decisão' },
  { key: 'frio',                  label: 'Frio',                  accent: '#444',    description: 'Não interessado ou parou', terminal: true },
];

export const STAGE_KEYS = STAGES.map(s => s.key);
export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

// Follow-up stage ↔ cron-milestone mapping. Single source of truth so
// the tray, the Kanban, and the cron all agree which "dia X" matches
// which template ('softNudge' / 'valueDrop' / 'lastTouch').
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
// Drives the auto-Frio rule in computeOutreachStage AND the cron buckets.
export const DAYS_FROM_DAY14_TO_FRIO = 7;

/**
 * Compute current stage from creator data. Walk LATEST signal first so a
 * pitched creator registers as 'apresentacao_enviada' even if every
 * earlier timestamp is also set.
 *
 * Returns one of STAGE_KEYS, or 'signed' (which the Kanban filters out
 * — signed creators belong to Delivery).
 */
export function computeOutreachStage(creator) {
  if (!creator) return 'por_contactar';

  if (creator.pipelineStatus === 'signed') return 'signed';
  if (creator.pipelineStatus === 'cold')   return 'frio';

  // Tolerant of both shapes: the full creator record stores fields under
  // creator.outreach.*, but the /api/creators list summary flattens them
  // to the top level for cheap CRM-list reads. Read both so the Kanban
  // works against either source.
  const o = creator.outreach || {};
  const notInterestedAt = o.notInterestedAt || creator.notInterestedAt;
  const pitchSentAt     = creator.pitch?.sentAt || creator.pitchSentAt;
  const callHeldAt      = o.callHeldAt    || creator.callHeldAt;
  const callBookedAt    = o.callBookedAt  || o.callAgreedAt || creator.callBookedAt;
  const loomSentAt      = o.loomSentAt    || creator.loomSentAt;
  const proposalReadyAt = o.proposalReadyAt || creator.proposalReadyAt;
  const loomRequestedAt = o.loomRequestedAt || creator.loomRequestedAt;
  const repliedAt       = o.repliedAt     || creator.repliedAt;
  const dmSentAt        = o.dmSentAt      || creator.dmSentAt;
  const emailSentAt     = o.emailSentAt   || creator.emailSentAt;
  // Follow-up counter — tolerant of both shapes (summary flattens it,
  // full record keeps it nested under outreach). Defaults to 0 so
  // pre-follow-up records keep landing in em_outreach.
  const followUpsDone   = Number(o.followUpsDone ?? creator.followUpsDone ?? 0);
  const lastFollowUpAt  = o.lastFollowUpAt || creator.lastFollowUpAt || null;

  if (notInterestedAt)              return 'frio';
  if (pitchSentAt)                  return 'apresentacao_enviada';
  if (callHeldAt)                   return 'apresentacao_enviada';
  if (callBookedAt)                 return 'reuniao_marcada';
  if (loomSentAt)                   return 'loom_enviado';
  // proposalReadyAt sits between pediu_loom and loom_enviado: the
  // proposal is finished and the operator is about to record the Loom.
  // Checked AFTER loomSentAt so once the Loom ships, the card advances
  // past this stage even if proposalReadyAt is still set.
  if (proposalReadyAt)              return 'proposta_terminada';
  if (loomRequestedAt)              return 'pediu_loom';
  if (repliedAt)                    return 'contacto_feito';
  // Day-14 follow-up was sent and N days passed with no reply → Frio.
  // This is the "silent move" the operator asked for: no manual action
  // needed, the creator just slips into Frio after the cooling period.
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
 * Inverse mapping for drag-and-drop. When the operator drops a card on a
 * specific column, we patch the creator with this field-set so the next
 * render places the card in the right stage. Each entry must produce a
 * stage match when fed back through computeOutreachStage().
 *
 * Forward moves stamp timestamps to "now". Backward moves clear later
 * fields so the card lands in the destination stage (e.g. dragging from
 * "Loom enviado" back to "Contacto feito" clears loomSentAt + loomRequestedAt).
 *
 * Returns a partial creator patch ready to PATCH /api/creators/:id.
 */
export function stagePatch(creator, targetStage) {
  const now = new Date().toISOString();
  // Tolerant of summary shape (flattened fields) AND full creator shape
  // (nested outreach). Source-of-truth lookups for "keep existing":
  const getOutreach = (key) => creator?.outreach?.[key] ?? creator?.[key] ?? null;
  const getPitchSent = () => creator?.pitch?.sentAt ?? creator?.pitchSentAt ?? null;
  // SPARSE patches — only include the fields that need to CHANGE for this
  // transition. The server's deep-merge on creator.outreach preserves
  // everything we don't send. Null values explicitly clear a field.
  // Forward transitions stamp `now` only when the timestamp isn't already set.
  switch (targetStage) {
    case 'por_contactar':
      // Clear EVERYTHING outreach-related — card needs to land back at start.
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: null, emailSentAt: null,
          repliedAt: null, repliedChannel: null,
          followUps: [], followUpsDone: 0, lastFollowUpAt: null,
          loomRequestedAt: null, proposalReadyAt: null, loomSentAt: null,
          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'em_outreach':
      // Keep dmSentAt (set it if missing); clear everything from reply onwards.
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: null, repliedChannel: null,
          // Drag back from any follow-up column → zero out follow-ups so
          // computeOutreachStage classifies the card as em_outreach again.
          followUps: [], followUpsDone: 0, lastFollowUpAt: null,
          loomRequestedAt: null, proposalReadyAt: null, loomSentAt: null,
          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'followup_3':
    case 'followup_7':
    case 'followup_14': {
      // Land the card with exactly the right follow-up count so the
      // derivation in computeOutreachStage matches the target column.
      // Drag forwards: append synthetic entries (channel='unknown').
      // Drag backwards: truncate.
      const targetLen = targetStage === 'followup_3' ? 1
                       : targetStage === 'followup_7' ? 2 : 3;
      const existing = Array.isArray(getOutreach('followUps')) ? getOutreach('followUps') : [];
      const trimmed = existing.slice(0, targetLen);
      const milestoneFor = ['softNudge', 'valueDrop', 'lastTouch'];
      while (trimmed.length < targetLen) {
        trimmed.push({
          channel: 'unknown',
          at: now,
          by: null,
          milestone: milestoneFor[trimmed.length],
          source: 'drag',
        });
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
          loomRequestedAt: null, proposalReadyAt: null, loomSentAt: null,
          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    }
    case 'contacto_feito':
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          loomRequestedAt: null, proposalReadyAt: null, loomSentAt: null,
          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'pediu_loom':
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          loomRequestedAt: getOutreach('loomRequestedAt') || now,
          // Clear proposalReadyAt + loomSentAt — backward drag from a
          // later stage should land here, not in proposta_terminada.
          proposalReadyAt: null, loomSentAt: null,
          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'proposta_terminada':
      // Operator marked the proposal/deck as ready. Stamp
      // proposalReadyAt and stash loomRequestedAt if absent (the
      // proposal usually exists because the creator asked for a Loom).
      // Forward field is loomSentAt — must be null to stay in this stage.
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          loomRequestedAt: getOutreach('loomRequestedAt') || now,
          proposalReadyAt: getOutreach('proposalReadyAt') || now,
          loomSentAt: null,
          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'loom_enviado':
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          loomRequestedAt: getOutreach('loomRequestedAt') || now,
          // Preserve proposalReadyAt — the proposal IS still ready;
          // we just shipped the Loom on top of it.
          proposalReadyAt: getOutreach('proposalReadyAt') || null,
          loomSentAt: getOutreach('loomSentAt') || now,
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
          // Preserve any loom/proposal history — they don't go back to null
          // just because the call got booked.
          loomRequestedAt: getOutreach('loomRequestedAt') || null,
          proposalReadyAt: getOutreach('proposalReadyAt') || null,
          loomSentAt: getOutreach('loomSentAt') || null,
          callBookedAt: getOutreach('callBookedAt') || getOutreach('callAgreedAt') || now,
          callHeldAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'apresentacao_enviada':
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          loomRequestedAt: getOutreach('loomRequestedAt') || null,
          proposalReadyAt: getOutreach('proposalReadyAt') || null,
          loomSentAt: getOutreach('loomSentAt') || null,
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
 * Group an array of creators by computed stage. Empty stages still get
 * an empty array so the Kanban can render every column.
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
      const d = daysSince(o.repliedAt || creator?.repliedAt);
      if (d > 5) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'pediu_loom': {
      const d = daysSince(o.loomRequestedAt);
      if (d > 3) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'loom_enviado': {
      const d = daysSince(o.loomSentAt);
      if (d > 14) return { days: d, level: 'cold', stale: true };
      if (d > 5)  return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'reuniao_marcada': {
      const booked = o.callBookedAt || o.callAgreedAt;
      const d = daysSince(booked);
      if (d > 3 && !o.callHeldAt) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'apresentacao_enviada': {
      const d = daysSince(creator?.pitch?.sentAt || o.callHeldAt);
      if (d > 10) return { days: d, level: 'cold', stale: true };
      if (d > 5)  return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'frio':
      return { days: daysSince(o.notInterestedAt), level: 'ok', stale: false };
    default:
      return { days: -1, level: 'ok', stale: false };
  }
}
