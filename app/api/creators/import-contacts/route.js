import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
import { listCreators, getCreator, updateCreator } from '../../../lib/creators';
import { computeOutreachStage, stagePatch } from '../../../lib/outreachStages';

// Bulk contact import — POST { rows: [{ name, email, phone }], dryRun, stageMode }
//
// Attaches emails / phones found outside the hub (enrichment sheets) to the
// matching creator. Match is by NAME only, because those sheets carry no IG
// handle: accent/punctuation-insensitive exact match against the index. A name
// that hits zero or 2+ creators is reported and never written, unless exactly
// one of the candidates already holds the row's email.
//
// Writes are additive: contactEmail / contactPhone are only filled when empty.
// A creator that already has a DIFFERENT email is reported as a conflict.
//
// stageMode — what to do with a matched creator that isn't in "Por contactar":
//   'none'  (default) leave the stage alone
//   'safe'  revive never-contacted cold leads (frio with no DM, email, reply or
//           loss reason) back to prospect. Nothing with history is touched.
//   'force' 'safe' plus: reset cold leads WITH history to Por contactar. Wipes
//           dmSentAt, follow-ups, reminder stamps and the loss reason, which
//           also lowers past team stats. Only ever touches Frio — live deals
//           (em outreach, reunião, R1/R2, proposta) are reported, never reset.
//
// dryRun defaults to TRUE. The caller batches rows (~40 per apply call) to stay
// inside the 60s function cap.
export const maxDuration = 60;

// NFKD, not NFD — IG display names in "𝐛𝐨𝐥𝐝" math letters fold to plain ASCII.
const norm = (s) => String(s || '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const cleanEmail = (s) => {
  const e = String(s || '').trim().toLowerCase();
  return /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(e) ? e : null;
};

const neverContacted = (c) => {
  const o = c.outreach || {};
  return !o.dmSentAt && !o.emailSentAt && !o.repliedAt && !o.notInterestedAt
    && !(Array.isArray(o.coldCalls) && o.coldCalls.length);
};

async function inChunks(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  }
  return out;
}

export async function POST(request) {
  const u = await getCurrentUser(request);
  if (!u || u.role !== 'team') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const rows = Array.isArray(body?.rows) ? body.rows.slice(0, 1000) : [];
  const dryRun = body?.dryRun !== false;
  const stageMode = ['none', 'safe', 'force'].includes(body?.stageMode) ? body.stageMode : 'none';
  if (!rows.length) return NextResponse.json({ error: 'rows[] required' }, { status: 400 });

  try {
    const byName = new Map();
    for (const s of await listCreators()) {
      const k = norm(s.name);
      if (!k) continue;
      if (!byName.has(k)) byName.set(k, []);
      // The index can hold the same creator twice — that's one hit, not two.
      if (!byName.get(k).some(h => h.id === s.id)) byName.get(k).push(s);
    }

    const report = {
      dryRun, stageMode, rows: rows.length,
      matched: 0, unmatched: [], ambiguous: [], invalidEmail: [],
      emailSet: 0, emailAlready: 0, emailConflict: [],
      phoneSet: 0, phoneAlready: 0,
      stageBefore: {}, revived: 0, reset: 0, needsDecision: [], errors: [],
    };

    const work = [];
    const seen = new Set();
    for (const row of rows) {
      const name = String(row?.name || '').trim();
      let hits = byName.get(norm(name)) || [];
      if (!hits.length) { report.unmatched.push(name); continue; }
      if (hits.length > 1 && row?.email) {
        // First-name-only rows ("Alba" ×3): the candidate that already holds
        // this exact email is the one the sheet row was exported from.
        const want = cleanEmail(row.email);
        const full = await Promise.all(hits.map(h => getCreator(h.id)));
        const same = hits.filter((h, i) => want && cleanEmail(full[i]?.contactEmail) === want);
        if (same.length === 1) hits = same;
      }
      if (hits.length > 1) { report.ambiguous.push({ name, ids: hits.map(h => h.id) }); continue; }
      // Same creator listed twice in the sheet — first row wins.
      if (seen.has(hits[0].id)) continue;
      seen.add(hits[0].id);
      const email = row?.email ? cleanEmail(row.email) : null;
      if (row?.email && !email) report.invalidEmail.push({ name, email: row.email });
      work.push({ name, id: hits[0].id, email, phone: String(row?.phone || '').trim() || null });
    }
    report.matched = work.length;

    await inChunks(work, dryRun ? 15 : 5, async (w) => {
      try {
        const c = await getCreator(w.id, { fresh: !dryRun });
        if (!c) { report.errors.push({ name: w.name, error: 'record missing' }); return; }
        const stage = computeOutreachStage(c);
        report.stageBefore[stage] = (report.stageBefore[stage] || 0) + 1;

        const patch = {};
        const have = cleanEmail(c.contactEmail);
        if (w.email) {
          if (!have) { patch.contactEmail = w.email; report.emailSet += 1; }
          else if (have === w.email) report.emailAlready += 1;
          else report.emailConflict.push({ name: w.name, id: w.id, current: have, sheet: w.email });
        }
        if (w.phone) {
          if (!String(c.contactPhone || '').trim()) { patch.contactPhone = w.phone; report.phoneSet += 1; }
          else report.phoneAlready += 1;
        }

        if (stage !== 'por_contactar' && stage !== 'signed' && stageMode !== 'none') {
          if (stage === 'frio' && neverContacted(c) && !c.lostReason) {
            patch.pipelineStatus = 'prospect';
            report.revived += 1;
          } else if (stage === 'frio' && stageMode === 'force') {
            const sp = stagePatch(c, 'por_contactar');
            // stagePatch clears the timestamps; a clean restart also needs the
            // actor stamps, the cron's reminder dedup (or day 3/7/14 never
            // fire again for this lead) and the loss detail gone.
            const rs = Object.fromEntries(Object.keys(c.outreach?.remindersSent || {}).map(k => [k, null]));
            Object.assign(patch, sp, {
              outreach: { ...sp.outreach, dmSentBy: null, emailSentBy: null, lastFollowUpBy: null, remindersSent: rs },
              lostReason: null, lostAt: null, lostStage: null, objection: null,
            });
            report.reset += 1;
          } else {
            report.needsDecision.push({ name: w.name, id: w.id, stage });
          }
        } else if (stage !== 'por_contactar') {
          report.needsDecision.push({ name: w.name, id: w.id, stage });
        }

        if (!dryRun && Object.keys(patch).length) {
          await updateCreator(w.id, patch, { skipIndexIfUnchanged: true });
        }
      } catch (err) {
        report.errors.push({ name: w.name, error: err?.message || 'erro' });
      }
    });

    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'erro no import' }, { status: 500 });
  }
}
