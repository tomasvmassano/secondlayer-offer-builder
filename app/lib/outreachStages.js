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
  { key: 'contacto_feito',        label: 'Contacto feito',        accent: '#3b82f6', description: 'Respondeu · pronto para Loom' },
  { key: 'pediu_loom',            label: 'Pediu Loom',            accent: '#a855f7', description: 'Pediu Loom personalizado' },
  { key: 'loom_enviado',          label: 'Loom enviado',          accent: '#c084fc', description: 'Loom entregue · à espera de resposta' },
  { key: 'reuniao_marcada',       label: 'Reunião marcada',       accent: '#22c55e', description: 'Call de descoberta agendada' },
  { key: 'apresentacao_enviada',  label: 'Apresentação enviada',  accent: '#7A0E18', description: 'Deck partilhado · à espera de decisão' },
  { key: 'frio',                  label: 'Frio',                  accent: '#444',    description: 'Não interessado ou parou', terminal: true },
];

export const STAGE_KEYS = STAGES.map(s => s.key);
export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

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
  const loomRequestedAt = o.loomRequestedAt || creator.loomRequestedAt;
  const repliedAt       = o.repliedAt     || creator.repliedAt;
  const dmSentAt        = o.dmSentAt      || creator.dmSentAt;
  const emailSentAt     = o.emailSentAt   || creator.emailSentAt;

  if (notInterestedAt)              return 'frio';
  if (pitchSentAt)                  return 'apresentacao_enviada';
  if (callHeldAt)                   return 'apresentacao_enviada';
  if (callBookedAt)                 return 'reuniao_marcada';
  if (loomSentAt)                   return 'loom_enviado';
  if (loomRequestedAt)              return 'pediu_loom';
  if (repliedAt)                    return 'contacto_feito';
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
          loomRequestedAt: null, loomSentAt: null,
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
          loomRequestedAt: null, loomSentAt: null,
          callBookedAt: null, callAgreedAt: null, callHeldAt: null,
          notInterestedAt: null,
        },
        pitch: { sentAt: null },
      };
    case 'contacto_feito':
      return {
        pipelineStatus: 'prospect',
        outreach: {
          dmSentAt: getOutreach('dmSentAt') || now,
          repliedAt: getOutreach('repliedAt') || now,
          loomRequestedAt: null, loomSentAt: null,
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
