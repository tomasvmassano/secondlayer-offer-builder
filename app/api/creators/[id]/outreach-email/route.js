import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { getCreator, updateCreator } from '../../../../lib/creators';
import { scrapeInstagramBasic } from '../../../../lib/apify';
import { recordLlmUsage, estimateCost, logError } from '../../../../lib/obs';
import { appendSignature } from '../../../../lib/operatorSignature';
import { safeStringify } from '../../../../lib/safeJson';
import {
  EMAIL_FRAMEWORK, EMAIL_MODEL, SENDER_FIRST_NAME,
  buildSystemPrompt, buildUserMessage, buildRetryMessage, withMultiples, parseDraft, checkDraft, assemble,
} from '../../../../lib/outreachEmail';

// POST /api/creators/:id/outreach-email   body: { dryRun?, force? }
//
// Writes the framework-v2 cold email for one creator: fresh scrape (full
// captions) → Haiku writes the three custom paragraphs → code checks them
// against the data → fixed copy is assembled around them → Day 1/7/14 saved on
// dmSequence. One lead per call: scrape + LLM is ~15-30s against a 60s cap, so
// the bulk runner fans out from the client.
//
// Outcomes (always 200 unless the request itself is wrong):
//   written     email saved (or returned, on dryRun)
//   no_signal   tier 0 — not writable (dead account, brand/agency page); needs a human look
//   failed_check  the draft cited something that isn't in the data
//   skipped     already has a v2 email (pass force to redo)
export const maxDuration = 60;

// Apify bills the details scrape as one result. FREE-tier price; the bulk
// runner's spend guard adds this per call.
const APIFY_COST_USD = 0.0027;

function igUsername(creator) {
  const url = creator?.platforms?.instagram?.url || creator?.instagramUrl || '';
  const m = String(url).match(/instagram\.com\/([^/?#]+)/i);
  if (m && m[1]) return m[1].replace(/^@/, '').trim();
  const h = creator?.platforms?.instagram?.username || creator?.handle || creator?.instagramHandle || '';
  return String(h).replace(/^@/, '').trim();
}

export async function POST(request, { params }) {
  const { id } = await params;
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'team') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;
  const force = body?.force === true;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY em falta' }, { status: 500 });

  const creator = await getCreator(id);
  if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

  const cost = { llmUsd: 0, apifyUsd: 0 };
  const done = (outcome, extra = {}) => NextResponse.json({ id, name: creator.name, outcome, cost, ...extra });

  if (!force && !dryRun && creator.dmSequence?.emailMeta?.framework === EMAIL_FRAMEWORK) {
    return done('skipped', { tier: creator.dmSequence.emailMeta.tier });
  }

  const username = igUsername(creator);
  if (!username) return done('no_instagram');

  try {
    const scrape = await scrapeInstagramBasic(username, { outreach: true });
    cost.apifyUsd = APIFY_COST_USD;
    const rawPosts = (scrape?.outreachPosts || []).filter(p => String(p.caption || '').trim());
    if (rawPosts.length < 3) return done('no_signal', { reason: `only ${rawPosts.length} posts with a caption` });
    const posts = withMultiples(rawPosts);

    const rawLang = String(creator.primaryLanguage || 'en').toLowerCase();
    const language = rawLang.startsWith('pt') ? 'pt' : rawLang.startsWith('es') ? 'es' : 'en';

    const system = buildSystemPrompt(language);
    const messages = [{ role: 'user', content: buildUserMessage({ creator, scrape, posts }) }];
    let usage = null;
    // Returns the parsed draft, or a NextResponse when the call itself failed.
    const ask = async () => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        // 32s scrape + two 13s calls still lands under the 60s cap.
        signal: AbortSignal.timeout(13000),
        body: safeStringify({ model: EMAIL_MODEL, max_tokens: 900, system, messages }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429 || res.status === 529) {
        return { fail: NextResponse.json({ id, name: creator.name, outcome: 'rate_limited', cost, retryAfter: 60 }, { status: 429 }) };
      }
      if (!res.ok || !data) return { fail: done('error', { error: data?.error?.message || `anthropic ${res.status}` }) };
      if (data.usage) {
        cost.llmUsd += estimateCost(EMAIL_MODEL, data.usage);
        usage = data.usage;
        recordLlmUsage({ route: 'outreach-email', model: EMAIL_MODEL, usage: data.usage }).catch(() => {});
      }
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      const parsed = parseDraft(text);
      if (!parsed) return { fail: done('error', { error: 'model output not parseable', raw: text.slice(0, 600) }) };
      return { draft: parsed, text };
    };

    let turn = await ask();
    if (turn.fail) return turn.fail;
    let draft = turn.draft;
    let problems = draft.tier === 0 ? [] : checkDraft(draft, posts, scrape);
    let retried = false;
    if (problems.length) {
      // One corrective pass with the failed checks spelled out.
      retried = true;
      messages.push({ role: 'assistant', content: turn.text }, { role: 'user', content: buildRetryMessage(problems) });
      turn = await ask();
      if (turn.fail) return turn.fail;
      draft = turn.draft;
      problems = draft.tier === 0 ? [] : checkDraft(draft, posts, scrape);
    }
    const data = { usage };

    const meta = {
      framework: EMAIL_FRAMEWORK, generatedAt: new Date().toISOString(), language,
      tier: Number(draft.tier) || 0, reason: String(draft.reason || '').slice(0, 200), retried,
    };

    if (meta.tier === 0) {
      if (!dryRun) await updateCreator(id, { dmSequence: { ...(creator.dmSequence || {}), emailMeta: meta } }, { skipIndexIfUnchanged: true });
      return done('no_signal', { reason: meta.reason, usage: data.usage });
    }

    const post = posts[draft.post];
    const evidence = post ? {
      postUrl: post.url || null, likes: post.likes, comments: post.comments,
      xComments: post.xComments, xLikes: post.xLikes, quote: String(draft.quote || '').slice(0, 160),
      offer: draft.offer ? String(draft.offer).slice(0, 160) : null,
    } : null;

    if (problems.length) {
      if (!dryRun) await updateCreator(id, { dmSequence: { ...(creator.dmSequence || {}), emailMeta: { ...meta, failedCheck: problems } } }, { skipIndexIfUnchanged: true });
      return done('failed_check', { problems, draft, evidence, usage: data.usage });
    }

    const mail = assemble(draft, language);
    // Chat-ready copy for the WhatsApp button: the same message before the
    // email contact card goes on (a name/email/website block reads wrong there).
    const whatsapp = mail.email_day1.body;
    // Same contact card dm-writer appends to every email.
    for (const k of ['email_day1', 'email_day7', 'email_day14']) {
      mail[k].body = appendSignature(mail[k].body, SENDER_FIRST_NAME);
    }

    if (!dryRun) {
      await updateCreator(id, {
        dmSequence: {
          ...(creator.dmSequence || {}),
          email_day1: mail.email_day1, email_day7: mail.email_day7, email_day14: mail.email_day14,
          senderName: SENDER_FIRST_NAME,
          whatsapp,
          emailMeta: { ...meta, copy: mail.copyKey, evidence },
        },
      }, { skipIndexIfUnchanged: true });
    }

    return done('written', { tier: meta.tier, reason: meta.reason, evidence, email: mail.email_day1, day7: mail.email_day7.body, day14: mail.email_day14.body, usage: data.usage });
  } catch (err) {
    logError('outreach-email', err, { creatorId: id }).catch(() => {});
    return done('error', { error: err?.message || 'erro' });
  }
}
