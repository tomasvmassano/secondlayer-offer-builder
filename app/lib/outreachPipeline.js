// Outreach pipeline orchestration (server only).
//
//   ensureIntel()      scrape once → facts (code) → analysis (model) → verify
//                      (code) → stored on creator.outreachIntel, reused for 30d
//   writeEmailAndWhatsApp()
//                      intel → channel writer (model) → checkCopy (code) →
//                      assemble fixed copy (code)
//
// Each model call gets one corrective retry with the failed checks spelled out.

import { scrapeInstagramBasic, scrapeInstagramComments } from './apify';
import { recordLlmUsage, estimateCost } from './obs';
import { safeStringify } from './safeJson';
import {
  INTEL_MODEL, isFresh, withMultiples, pickCommentPosts, buildFacts, buildAnalysisPrompt, buildAnalysisInput,
  parseAnalysis, verifyAnalysis, toIntel, buildAnalysisRetry, verifyPhoneSource, classifyEmail,
} from './creatorIntel';
import { EMAIL_MODEL, buildWriterPrompt, buildWriterInput, parseCopy, checkCopy, buildRetryMessage, assemble } from './outreachEmail';

// Apify bills the details scrape as one result, and each comment as one
// result (FREE-tier price).
export const APIFY_COST_USD = 0.0027;
export const APIFY_COMMENT_USD = 0.0027;

export class PipelineStop extends Error {
  constructor(outcome, extra = {}) { super(outcome); this.outcome = outcome; this.extra = extra; }
}

export function igUsername(creator) {
  const url = creator?.platforms?.instagram?.url || creator?.instagramUrl || '';
  const m = String(url).match(/instagram\.com\/([^/?#]+)/i);
  if (m && m[1]) return m[1].replace(/^@/, '').trim();
  const h = creator?.platforms?.instagram?.username || creator?.handle || creator?.instagramHandle || '';
  return String(h).replace(/^@/, '').trim();
}

async function callModel({ apiKey, model, system, messages, maxTokens, route, cost }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    // Scrape (≤32s) plus up to four short calls has to fit the 60s function cap.
    signal: AbortSignal.timeout(11000),
    body: safeStringify({ model, max_tokens: maxTokens, system, messages }),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 429 || res.status === 529) throw new PipelineStop('rate_limited');
  if (!res.ok || !data) throw new PipelineStop('error', { error: data?.error?.message || `anthropic ${res.status}` });
  if (data.usage) {
    cost.llmUsd += estimateCost(model, data.usage);
    recordLlmUsage({ route, model, usage: data.usage }).catch(() => {});
  }
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

// Stage 1. Returns { intel, fresh } — `fresh: false` means a stored object was reused.
export async function ensureIntel(creator, { apiKey, cost, force = false } = {}) {
  const stored = creator.outreachIntel;
  if (!force && isFresh(stored)) {
    // Contact details can change after the analysis (an import adds a phone).
    // Re-verify provenance against the facts we kept; no scrape, no model.
    const probe = { bio: stored.facts.bio, igBioLinks: stored.facts.links, externalUrl: '' };
    const hints = { email: creator.contactEmail, language: creator.primaryLanguage };
    const contact = {
      email: stored.facts.contact?.email?.value === String(creator.contactEmail || '').toLowerCase() ? stored.facts.contact.email : classifyEmail(creator.contactEmail, probe),
      phone: creator.contactPhone
        ? (stored.facts.contact?.phone?.value === creator.contactPhone ? stored.facts.contact.phone : { value: creator.contactPhone, ...verifyPhoneSource(creator.contactPhone, probe, hints, creator) })
        : null,
    };
    return { intel: { ...stored, facts: { ...stored.facts, contact } }, fresh: false };
  }

  const username = igUsername(creator);
  if (!username) throw new PipelineStop('no_instagram');
  const scrape = await scrapeInstagramBasic(username, { outreach: true });
  cost.apifyUsd += APIFY_COST_USD;
  const rawPosts = (scrape?.outreachPosts || []).filter(p => String(p.caption || '').trim());
  if (rawPosts.length < 3) {
    const facts = buildFacts({ creator, scrape, posts: [] });
    return { intel: toIntel({ analysis: { tier: 0, language: null, firstName: null, reason: `only ${rawPosts.length} posts with a caption`, read: null }, facts }), fresh: true };
  }
  const posts = withMultiples(rawPosts);
  // Comments only where a post can carry a signal (≤2 posts, one Apify run).
  // Non-fatal: a timeout means the analysis runs on captions alone.
  const targets = pickCommentPosts(posts);
  if (targets.length) {
    try {
      const { byPost = {}, billed = 0 } = await scrapeInstagramComments(targets.map(p => p.url));
      cost.apifyUsd += billed * APIFY_COMMENT_USD;
      for (const p of posts) {
        const got = byPost[String(p.url || '').replace(/\/+$/, '').toLowerCase()];
        if (got?.length) p.sampleComments = got.map(c => c.text);
      }
    } catch { /* captions only */ }
  }
  const facts = buildFacts({ creator, scrape, posts });

  const system = buildAnalysisPrompt();
  const messages = [{ role: 'user', content: buildAnalysisInput({ creator, facts }) }];
  let text = await callModel({ apiKey, model: INTEL_MODEL, system, messages, maxTokens: 700, route: 'outreach-intel', cost });
  let analysis = parseAnalysis(text);
  let problems = analysis ? verifyAnalysis(analysis, facts) : ['output not parseable'];
  if (problems.length) {
    messages.push({ role: 'assistant', content: text }, { role: 'user', content: buildAnalysisRetry(problems) });
    text = await callModel({ apiKey, model: INTEL_MODEL, system, messages, maxTokens: 700, route: 'outreach-intel', cost });
    analysis = parseAnalysis(text);
    problems = analysis ? verifyAnalysis(analysis, facts) : ['output not parseable'];
  }
  if (problems.length) throw new PipelineStop('failed_check', { stage: 'analysis', problems });
  // The record's language is a fallback only; the evidence decides.
  if (!analysis.language) {
    const raw = String(creator.primaryLanguage || 'en').toLowerCase();
    analysis.language = raw.startsWith('pt') ? 'pt' : raw.startsWith('es') ? 'es' : 'en';
  }
  return { intel: toIntel({ analysis, facts }), fresh: true };
}

// Stage 2 for email + WhatsApp. One call covers both channels; the analysis is
// not redone, only the delivery differs.
export async function writeEmailAndWhatsApp(intel, creator, { apiKey, cost, sender } = {}) {
  const agency = intel.facts.contact?.email?.kind === 'agency';
  const system = buildWriterPrompt(intel.language, { agency });
  const messages = [{ role: 'user', content: buildWriterInput(intel, creator) }];
  let text = await callModel({ apiKey, model: EMAIL_MODEL, system, messages, maxTokens: 800, route: 'outreach-email', cost });
  let draft = parseCopy(text);
  let problems = draft ? checkCopy(draft, intel) : ['output not parseable'];
  let retried = false;
  if (problems.length) {
    retried = true;
    messages.push({ role: 'assistant', content: text }, { role: 'user', content: buildRetryMessage(problems) });
    text = await callModel({ apiKey, model: EMAIL_MODEL, system, messages, maxTokens: 800, route: 'outreach-email', cost });
    draft = parseCopy(text);
    problems = draft ? checkCopy(draft, intel) : ['output not parseable'];
  }
  if (problems.length) throw new PipelineStop('failed_check', { stage: 'writer', problems, draft });
  return { mail: assemble(draft, intel, creator, { sender }), retried };
}
