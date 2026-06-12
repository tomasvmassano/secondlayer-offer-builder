/**
 * Outreach pipeline stage computation.
 *
 * Stages are DERIVED from existing creator data — never stored as a manual
 * field. Operator moves a creator forward by doing the work (recording a
 * Loom, sending the deck, etc.), not by dragging cards between columns.
 *
 * Source signals:
 *   creator.pipelineStatus       — prospect | cold | signed (manual)
 *   creator.offer?.internal_metadata?.ecosystem_audit  — audit done
 *   creator.dmSequence           — DM drafted
 *   creator.outreach.dmSentAt    — first DM sent
 *   creator.outreach.repliedAt   — creator engaged
 *   creator.outreach.loomSentAt  — personalised Loom sent
 *   creator.outreach.bumpSentAt  — Loom-no-reply bump sent
 *   creator.outreach.callAgreedAt — call booked (reusing existing field)
 *   creator.outreach.callHeldAt   — discovery call happened
 *   creator.pitch?.sentAt         — pitch deck shared
 *   creator.outreach.notInterestedAt — explicit reject
 *
 * Pipeline mapped from Tomás's playbook:
 *   1. Researcher adds creator → audit runs
 *   2. Operator drafts + sends DM
 *   3. Follow-up sequence
 *   5. If reply: record Loom → DM the Loom link
 *   6. Wait 5 days
 *   7. If still no reply: bump message
 *   8. If reply: Call booked
 *   9. Call booked → discovery call happens
 *  10. Post-call: send pitch deck
 *  11. Not interested / Cold
 */

export const STAGES = [
  { key: 'sourced',         label: 'Sourced',           accent: '#666',    description: 'Added to CRM, audit not run' },
  { key: 'outreach_ready',  label: 'Outreach ready',    accent: '#888',    description: 'Audit done, DM not sent' },
  { key: 'dm_out',          label: 'DM out',            accent: '#eab308', description: 'DM sent, awaiting reply' },
  { key: 'in_conversation', label: 'In conversation',   accent: '#3b82f6', description: 'Replied, no Loom yet' },
  { key: 'loom_sent',       label: 'Loom sent',         accent: '#a855f7', description: 'Loom delivered, awaiting reply' },
  { key: 'call_booked',     label: 'Call booked',       accent: '#22c55e', description: 'Discovery call scheduled' },
  { key: 'pitch_sent',      label: 'Pitch sent',        accent: '#7A0E18', description: 'Deck shared, awaiting decision' },
  { key: 'cold',            label: 'Cold / Not interested', accent: '#444', description: 'Aged out or rejected', terminal: true },
];

export const STAGE_KEYS = STAGES.map(s => s.key);
export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/**
 * Compute the current pipeline stage from creator data.
 *
 * Order matters: we walk LATEST signals first so a creator who's been
 * signed registers as 'signed' even if earlier fields are also set.
 * Returns one of STAGE_KEYS (or 'signed' for closed creators — which the
 * Kanban skips, sending them to the delivery phase).
 */
export function computeOutreachStage(creator) {
  if (!creator) return 'sourced';

  // Terminal: signed creators are out of the outreach pipeline.
  if (creator.pipelineStatus === 'signed') return 'signed';

  // Terminal: explicitly cold or not interested.
  if (creator.pipelineStatus === 'cold') return 'cold';
  if (creator.outreach?.notInterestedAt) return 'cold';

  // Walk back from the latest signal. The "furthest" stage wins.
  if (creator.pitch?.sentAt)              return 'pitch_sent';
  if (creator.outreach?.callHeldAt)       return 'pitch_sent'; // call done, send deck next — render in same column
  if (creator.outreach?.callAgreedAt || creator.outreach?.callBookedAt) return 'call_booked';
  if (creator.outreach?.loomSentAt)       return 'loom_sent';
  if (creator.outreach?.repliedAt)        return 'in_conversation';
  if (creator.outreach?.dmSentAt || creator.outreach?.emailSentAt) return 'dm_out';
  // Audit done? Look for any meta on the offer.
  const hasAudit = !!(creator.offer?.internal_metadata?.ecosystem_audit
    || creator.hasAudit
    || creator.offer?.raw);
  if (hasAudit && creator.dmSequence)     return 'outreach_ready';
  if (hasAudit)                           return 'outreach_ready';
  return 'sourced';
}

/**
 * Group an array of creators by computed stage. Returns an object keyed by
 * STAGE_KEYS, each entry an array of creators. Empty stages still get an
 * empty array so the Kanban can render every column.
 */
export function groupByStage(creators) {
  const grouped = Object.fromEntries(STAGE_KEYS.map(k => [k, []]));
  for (const c of creators || []) {
    const stage = computeOutreachStage(c);
    if (stage === 'signed') continue;        // signed → delivery phase
    if (!grouped[stage]) grouped[stage] = []; // defensive
    grouped[stage].push(c);
  }
  return grouped;
}

/**
 * "Days since" — null-safe. Returns -1 when timestamp is falsy.
 */
function daysSince(iso) {
  if (!iso) return -1;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return -1;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/**
 * Per-stage staleness rules. Returns { stale: bool, days: number, level: 'ok'|'warn'|'cold' }.
 * Used to render the red age-chip + the "Send bump" / "Mark cold" CTAs.
 */
export function stageStaleness(creator) {
  const stage = computeOutreachStage(creator);
  const o = creator?.outreach || {};

  switch (stage) {
    case 'sourced':
      return { days: daysSince(creator?.createdAt), level: 'ok', stale: false };
    case 'outreach_ready':
      return { days: daysSince(o.auditedAt || creator?.createdAt), level: 'ok', stale: false };
    case 'dm_out': {
      const d = daysSince(o.dmSentAt || o.emailSentAt);
      if (d > 14) return { days: d, level: 'cold', stale: true };
      if (d > 7)  return { days: d, level: 'warn', stale: false };
      return { days: d, level: 'ok', stale: false };
    }
    case 'in_conversation': {
      const d = daysSince(o.repliedAt);
      if (d > 7) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'loom_sent': {
      const d = daysSince(o.loomSentAt);
      // Bump suggested at day 5; cold at day 14.
      if (d > 14) return { days: d, level: 'cold', stale: true };
      if (d > 5)  return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'call_booked': {
      // If call date passed and not held yet, that's a no-show warning.
      const booked = o.callBookedAt || o.callAgreedAt;
      const d = daysSince(booked);
      if (d > 3 && !o.callHeldAt) return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'pitch_sent': {
      const d = daysSince(creator?.pitch?.sentAt || o.callHeldAt);
      if (d > 10) return { days: d, level: 'cold', stale: true };
      if (d > 5)  return { days: d, level: 'warn', stale: true };
      return { days: d, level: 'ok', stale: false };
    }
    case 'cold':
      return { days: daysSince(o.notInterestedAt), level: 'ok', stale: false };
    default:
      return { days: -1, level: 'ok', stale: false };
  }
}

/**
 * Single "next action" CTA per stage. Drives the primary button on every
 * card so the operator never has to think "what now."
 */
export function nextAction(creator) {
  const stage = computeOutreachStage(creator);
  switch (stage) {
    case 'sourced':         return { label: 'Run audit',      href: c => `/creators/${c.id}?tab=audit` };
    case 'outreach_ready':  return { label: 'Draft DM',       href: c => `/creators/${c.id}?tab=dm` };
    case 'dm_out':          return { label: 'Send follow-up', href: c => `/creators/${c.id}?tab=dm` };
    case 'in_conversation': return { label: 'Record Loom',    href: c => `/creators/${c.id}?tab=outreach&record=loom` };
    case 'loom_sent':       return { label: 'Send bump',      href: c => `/creators/${c.id}?tab=outreach&action=bump` };
    case 'call_booked':     return { label: 'Mark call done', href: c => `/creators/${c.id}?tab=outreach&action=callDone` };
    case 'pitch_sent':      return { label: 'Mark signed',    href: c => `/creators/${c.id}?tab=outreach&action=sign` };
    default:                return null;
  }
}

/**
 * Auto-suggest pills shown on a card when its staleness crosses a threshold.
 * Returns an array of { label, kind } where kind drives UI color.
 */
export function suggestedActions(creator) {
  const stage = computeOutreachStage(creator);
  const s = stageStaleness(creator);
  const out = [];
  if (stage === 'loom_sent' && s.days > 5 && !creator?.outreach?.bumpSentAt) {
    out.push({ label: `Send bump · Loom out ${s.days}d`, kind: 'warn' });
  }
  if (stage === 'dm_out' && s.days > 14) {
    out.push({ label: `Mark cold · ${s.days}d no reply`, kind: 'cold' });
  }
  if (stage === 'pitch_sent' && s.days > 10) {
    out.push({ label: `Follow up · pitch out ${s.days}d`, kind: 'warn' });
  }
  if (stage === 'call_booked' && s.days > 3 && !creator?.outreach?.callHeldAt) {
    out.push({ label: `No-show check · call ${s.days}d ago`, kind: 'warn' });
  }
  return out;
}
