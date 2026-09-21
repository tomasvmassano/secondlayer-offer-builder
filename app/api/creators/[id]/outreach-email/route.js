import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { logError } from '../../../../lib/obs';
import { appendSignature } from '../../../../lib/operatorSignature';
import { EMAIL_FRAMEWORK, resolveSender } from '../../../../lib/outreachEmail';
import { ensureIntel, writeEmailAndWhatsApp, PipelineStop } from '../../../../lib/outreachPipeline';

// POST /api/creators/:id/outreach-email   body: { dryRun?, force?, reanalyze?, sender? }
//
// First-message writer for EMAIL and WHATSAPP, on top of the shared creator
// intelligence:
//   raw data → verified evidence → creator intelligence (stored, reused) →
//   channel writer → code validation → fixed copy assembled → saved
// The intelligence is analysed once and kept on creator.outreachIntel; the DM
// writer reads the same object. `reanalyze` forces a fresh scrape + analysis,
// `force` only rewrites the copy from the stored intelligence.
//
// Outcomes (200 unless the request itself is wrong):
//   written       saved (or returned, on dryRun)
//   no_signal     tier 0: dead account or a brand / agency page. Not sent.
//   failed_check  analysis or copy cited something the facts don't support
//   skipped       already written (pass force to redo)
export const maxDuration = 60;

export async function POST(request, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'team') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;
  const force = body?.force === true;

  // Never write in the name of someone whose credibility line isn't approved.
  const sender = resolveSender(body?.sender);
  if (!sender) return NextResponse.json({ error: 'sender_not_approved', hint: 'Só o Tomás tem linha de credibilidade aprovada para email e WhatsApp.' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY em falta' }, { status: 500 });

  const creator = await getCreator(id);
  if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

  const cost = { llmUsd: 0, apifyUsd: 0 };
  const done = (outcome, extra = {}, status = 200) => NextResponse.json({ id, name: creator.name, outcome, cost, ...extra }, { status });

  // Skip only when a message really exists. A lead whose last attempt failed a
  // check carries meta but no copy, and must be retried on the next run.
  const prev = creator.dmSequence?.emailMeta;
  if (!force && !dryRun && !body?.reanalyze && prev?.framework === EMAIL_FRAMEWORK && !prev.failedCheck && (prev.tier === 0 || creator.dmSequence?.whatsapp)) {
    return done('skipped', { tier: prev.tier, whatsapp: creator.dmSequence.whatsapp || null });
  }

  const meta = { framework: EMAIL_FRAMEWORK, pipeline: 'intel-1', generatedAt: new Date().toISOString() };
  try {
    const { intel, fresh } = await ensureIntel(creator, { apiKey, cost, force: body?.reanalyze === true });
    // Keep the analysis even if the writer stage fails or times out.
    if (fresh && !dryRun) await updateCreator(id, { outreachIntel: intel }, { skipIndexIfUnchanged: true });
    Object.assign(meta, { language: intel.language, tier: intel.tier, reason: intel.reason });

    if (intel.tier === 0) {
      if (!dryRun) await updateCreator(id, { dmSequence: { ...(creator.dmSequence || {}), emailMeta: meta } }, { skipIndexIfUnchanged: true });
      return done('no_signal', { reason: intel.reason, intelReused: !fresh });
    }

    const { mail, retried } = await writeEmailAndWhatsApp(intel, creator, { apiKey, cost, sender: sender.firstName });
    const whatsapp = mail.whatsapp; // no contact card on a chat message
    for (const k of ['email_day1', 'email_day7', 'email_day14']) mail[k].body = appendSignature(mail[k].body, sender.firstName);

    const post = intel.facts.evidence.find(e => e.ref === 'post');
    const evidence = post ? {
      postUrl: post.source, metric: post.metric, comments: post.value, xComments: post.multiple,
      likes: post.likes, xLikes: post.likesMultiple, quote: post.quote,
      offer: intel.facts.evidence.find(e => e.ref === 'bio_or_links')?.quote || null,
    } : null;
    Object.assign(meta, { retried, copy: mail.copyKey, recipient: mail.recipient, whatsappSource: mail.whatsappSource, evidence });

    if (!dryRun) {
      await updateCreator(id, {
        dmSequence: {
          ...(creator.dmSequence || {}),
          email_day1: mail.email_day1, email_day7: mail.email_day7, email_day14: mail.email_day14,
          senderName: sender.firstName, whatsapp, emailMeta: meta,
        },
      }, { skipIndexIfUnchanged: true });
    }
    return done('written', {
      tier: intel.tier, reason: intel.reason, intelReused: !fresh, recipient: mail.recipient, evidence,
      whatsapp, whatsappSource: mail.whatsappSource, email: mail.email_day1, day7: mail.email_day7.body, day14: mail.email_day14.body,
      ...(dryRun ? { intel } : {}),
    });
  } catch (err) {
    if (err instanceof PipelineStop) {
      if (err.outcome === 'rate_limited') return done('rate_limited', { retryAfter: 60 }, 429);
      if (err.outcome === 'failed_check' && !dryRun) {
        await updateCreator(id, { dmSequence: { ...(creator.dmSequence || {}), emailMeta: { ...meta, failedCheck: err.extra.problems, failedStage: err.extra.stage } } }, { skipIndexIfUnchanged: true }).catch(() => {});
      }
      return done(err.outcome, err.extra);
    }
    logError('outreach-email', err, { creatorId: id }).catch(() => {});
    return done('error', { error: err?.message || 'erro' });
  }
}
