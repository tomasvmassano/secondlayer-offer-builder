// Creator intelligence — stage 1 of the outreach pipeline.
//
//   raw creator data → VERIFIED EVIDENCE → CREATOR INTELLIGENCE → channel
//   writers → deterministic code validation → final message
//
// One scrape and one analysis per creator, stored compactly on the record as
// `outreachIntel` and reused by the Instagram DM, the email and the WhatsApp
// writers. Nobody re-scrapes or re-analyses per channel.
//
// The split that matters: CODE owns every fact that can be checked (metrics,
// multiples, quotes, where a phone number came from). The MODEL owns
// interpretation (why a signal matters, the monetization gap, the angle).
// `facts` and `read` are stored separately so a writer always knows what it may
// state as fact and what is only our reading.

import { normalizePhone } from './phone';

export const INTEL_VERSION = 1;
export const INTEL_MAX_AGE_DAYS = 30;
export const INTEL_MODEL = 'claude-haiku-4-5-20251001';

// ── small text helpers (shared with the writers) ─────────────────────────────
export const plain = (s) => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
export const fold = (s) => plain(s).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// "title url" — the domain alone often names the product (stan.store, hotmart).
export const bioLinks = (scrape) => (scrape?.igBioLinks || [])
  .map(l => (typeof l === 'string' ? l : [l?.title, l?.url].filter(Boolean).join(' ')))
  .map(x => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6);

const median = (arr) => {
  const a = arr.filter(n => Number.isFinite(n) && n > 0).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

// Every multiple is computed HERE, against the median of the creator's OTHER
// posts, before any model sees it. The model interprets "x9 usual comments";
// it never calculates it.
export function withMultiples(posts) {
  return posts.map((p, i) => {
    const others = posts.filter((_, j) => j !== i);
    const mc = median(others.map(o => o.comments));
    const ml = median(others.map(o => o.likes));
    const xComments = mc > 0 && p.comments > 0 ? Math.floor((p.comments / mc) * 10) / 10 : null;
    const xLikes = ml > 0 && p.likes > 0 ? Math.floor((p.likes / ml) * 10) / 10 : null;
    // A post can carry a demand signal only if people actually responded to it.
    const usable = !(p.comments < 20 || (xComments != null && xComments < 1));
    return { ...p, xComments, xLikes, usable };
  });
}

// Posts worth pulling comments for: a caption that asks for an action, or a
// usable post well above the creator's usual. At most two, biggest first.
const CTA = /\b(comment|comenta|comentem|comment[ae]|escreve|escribe|manda|env[ií]a|m[aá]ndame|dm|link (in|na|en) (the )?bio|link na bio|link en bio)\b/i;
// Giveaways pull comments without meaning demand; don't pay to read them.
const NOISE = /\b(giveaway|sorteio|sorteo|passatempo|concurso|contest|tag (a|um|una|dos|2|3) (friend|amig[oa]s?)|marca (um|uma|dois|duas) amig)/i;
export function pickCommentPosts(posts, max = 2) {
  return posts
    .filter(p => p.usable && p.url && !NOISE.test(p.caption || '') && (CTA.test(p.caption || '') || (p.xComments || 0) >= 2))
    .sort((a, b) => (b.comments || 0) - (a.comments || 0))
    .slice(0, max);
}

const headTail = (s, n = 820) => (s.length > n ? `${s.slice(0, n / 2 - 10)} [...] ${s.slice(-(n / 2 - 10))}` : s);

// ── contact provenance ───────────────────────────────────────────────────────
// WhatsApp is a personal channel, so where the number came from decides how the
// message may open. We can only VERIFY against what the creator publishes
// themselves; anything else (imports, enrichment tools) stays "unknown" and the
// message never claims a source.
const FREEMAIL = /@(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|proton|protonmail|sapo|aol)\./i;
const AGENCY_DOMAIN = /(talent|agency|agencia|agência|agence|mgmt|management|manage|represent|artists|creators|influenc|booking|\bpr\b|media)/i;

export function verifyPhoneSource(phone, scrape, hints = {}, creator = null) {
  const n = normalizePhone(phone, hints);
  if (!n.ok) return { status: 'unknown', verified: false, detail: 'number could not be normalised' };
  // Match on the national part too: bio links often carry the number without "+".
  const needles = [n.wa, n.wa.slice(String(n.country || '').length)].filter(x => x && x.length >= 7);
  const has = (text) => { const d = String(text || '').replace(/\D/g, ''); return needles.some(x => d.includes(x)); };

  // Instagram's own bio links: this scrape, plus the ones a fuller scrape already
  // put on the record (the light scrape doesn't always return all five).
  for (const l of [...(scrape?.igBioLinks || []), ...(creator?.platforms?.instagram?.bioLinks || [])]) {
    const url = typeof l === 'string' ? l : (l?.url || '');
    const title = typeof l === 'string' ? '' : (l?.title || '');
    if (has(url) || has(title)) {
      const isWa = /wa\.me|whatsapp/i.test(url);
      return {
        status: isWa ? 'public_business' : 'social_profile', verified: true,
        detail: `${isWa ? 'WhatsApp link' : 'link'} in the creator's Instagram bio links${title ? ` ("${plain(title)}")` : ''}`,
        url,
      };
    }
  }
  // The creator's own website / link-in-bio page, scraped earlier and kept on
  // the record (creator.intelligence.bioLinks). Still their own publication.
  for (const l of [...(creator?.intelligence?.bioLinks || []), ...(creator?.bioLinks || [])]) {
    const url = typeof l === 'string' ? l : (l?.url || l?.href || '');
    const title = typeof l === 'string' ? '' : (l?.title || l?.productName || '');
    if (has(url) || has(title)) {
      return { status: 'public_website', verified: true, detail: `${/wa\.me|whatsapp/i.test(url) ? 'WhatsApp link' : 'link'} on the creator's own website or link page${title ? ` ("${plain(title)}")` : ''}`, url };
    }
  }
  if (has(scrape?.bio)) return { status: 'social_profile', verified: true, detail: "written in the creator's Instagram bio" };
  if (has(scrape?.externalUrl)) return { status: 'public_business', verified: true, detail: "in the creator's Instagram website link", url: scrape.externalUrl };
  return { status: 'unknown', verified: false, detail: 'not found on the creator\'s own profile; source not recorded at import' };
}

export function classifyEmail(email, scrape) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  const domain = e.split('@')[1] || '';
  let source = { verified: false, detail: 'source not recorded at import' };
  if ([scrape?.publicEmail, scrape?.businessEmail].some(x => String(x || '').toLowerCase() === e)) source = { verified: true, detail: "the contact email on the creator's Instagram profile" };
  else if (String(scrape?.bio || '').toLowerCase().includes(e)) source = { verified: true, detail: "written in the creator's Instagram bio" };

  // Whose inbox is it? An agency address means a manager reads it, not the creator.
  const siteDomains = [scrape?.externalUrl, ...(scrape?.igBioLinks || []).map(l => (typeof l === 'string' ? l : l?.url))]
    .map(u => { try { return new URL(String(u).startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, ''); } catch { return ''; } })
    .filter(Boolean);
  let kind = 'unknown';
  if (FREEMAIL.test(e) || siteDomains.some(d => d && (domain === d || domain.endsWith(`.${d}`) || d.endsWith(domain)))) kind = 'creator';
  else if (AGENCY_DOMAIN.test(domain)) kind = 'agency';
  return { value: e, kind, ...source };
}

// ── facts (code) ─────────────────────────────────────────────────────────────
export function buildFacts({ creator, scrape, posts }) {
  const hints = { email: creator?.contactEmail, language: creator?.primaryLanguage };
  return {
    followers: scrape?.followers || 0,
    bio: plain(scrape?.bio || creator?.bio).slice(0, 500),
    links: bioLinks(scrape),
    posts: posts.map((p, i) => ({
      i, url: p.url || null, type: p.type, likes: p.likes, comments: p.comments,
      xComments: p.xComments, xLikes: p.xLikes, usable: p.usable,
      caption: headTail(plain(p.caption)), sampleComments: p.sampleComments || [],
    })),
    contact: {
      email: classifyEmail(creator?.contactEmail, scrape),
      phone: creator?.contactPhone ? { value: creator.contactPhone, ...verifyPhoneSource(creator.contactPhone, scrape, hints, creator) } : null,
    },
  };
}

// ── analysis prompt (model: interpretation only) ─────────────────────────────
export function buildAnalysisPrompt() {
  return `You are the analysis stage for Second Layer, which helps creators turn an audience they already have into a new paid offer. You do NOT write outreach. You read the evidence once and produce a compact commercial reading that three channel writers will reuse.

Think in this order: specific evidence, audience behaviour, commercial interpretation, monetization gap, possible direction, best conversation angle. Look for intent, not vanity metrics: 500 people commenting a keyword to get a guide beats 10,000 likes, and a post at 9 times the usual comments beats a bigger post that is normal for them.

All numbers and multiples in the data were calculated by code. Never calculate, estimate or restate a number differently. Instagram does not show save counts, so never mention saves. Never invent a post, a comment, a product, a price or an audience reaction. Lines marked "comments seen" are real comments on that post, the newest few only: you may quote them exactly in SIGNAL and WHY, and they are the only source for what people wrote or asked.

TIER, take the strongest one the data honestly supports:
1  a caption OFFERS something in return for an action (comment a keyword, DM a word, grab a guide or template, join a list, link in bio for a resource) and that post is marked usable.
2  no such caption, but a usable post is marked x2 or more above their usual and it teaches, explains or answers something.
3  neither, but the bio or links name something they already offer (product, course, ebook, consultations, coaching, newsletter, free guide, community, shop).
4  none of the above, but one specific post or recurring angle is worth a real observation.
0  not writable, ONLY if there are fewer than three real posts or the account is a brand, agency, shop or fan page rather than a person.
Never a signal whatever the numbers: giveaways, contests, tag a friend posts, birthdays, personal announcements, brand collaborations, questions to the audience ("where are you from?"). Posts marked NOT usable can never carry tier 1 or 2.

MONETIZATION, from the bio and links only. Say what appears to be free, what appears to be paid, and what needs the creator's own time (1 to 1, consulting, services). Write "none found" when the data does not show it. Not finding something is not proof it does not exist.

Keep FACT and INTERPRETATION apart. SIGNAL is a fact and must be supported by the data as written. WHY, GAP, DIRECTION and ANGLE are your reading, phrased as a reasonable hypothesis, never as certainty ("the audience will pay for a course" is not allowed).

OUTPUT: plain text, one field per line, exactly these labels, nothing else. Fill EVERY field for tiers 1 to 4, including POST_GIST, WHY, GAP and ANGLE in tier 3 and 4 (a lead with no demand spike still has a post worth describing and a gap worth a hypothesis). For tier 0 return LANGUAGE, TIER and REASON only.
LANGUAGE: en, pt (European Portuguese), br (Brazilian Portuguese) or es, judged from how the creator writes captions and bio
FIRST_NAME: the person's first name if evident from the name or bio, else none
NICHE: 6 words at most
AUDIENCE: who follows them, 12 words at most
EXPERTISE: what they know, 12 words at most
FREE: what they give away, 15 words at most, or none found
PAID: what appears paid, only if the bio or links name it, 15 words at most, or none found
TIME_BOUND: what needs their own time, or none found
TIER: 1, 2, 3, 4 or 0
REASON: why this tier, 12 words at most
POST: index of the post the outreach should be built on
QUOTE: a short fragment copied EXACTLY from that post's caption
OFFER: tier 3 only, the fragment of the bio or links naming what they offer, copied EXACTLY, else none
POST_GIST: what that post actually says or teaches, 1 to 2 sentences, only from its caption
SIGNAL: the demand fact in one plain sentence, using the numbers exactly as given
WHY: what the audience seems to want (information, implementation, accountability, access, community, tools, transformation) and why this response suggests it, 2 sentences at most
GAP: the monetization gap as a hypothesis, 1 sentence
DIRECTION: one or two directions Second Layer could explore. Internal only, never shown to the creator
ANGLE: the single best conversation angle, 1 sentence
ASSUMPTIONS: what you are assuming or cannot see, 20 words at most`;
}

export function buildAnalysisInput({ creator, facts }) {
  const lines = facts.posts.map((p) => {
    const marks = [];
    if (p.xComments && p.xComments >= 2) marks.push(`x${p.xComments} usual comments`);
    if (p.xLikes && p.xLikes >= 2) marks.push(`x${p.xLikes} usual likes`);
    if (!p.usable) marks.push('NOT usable as the signal');
    const likes = p.likes > 0 ? `likes=${p.likes}` : 'likes=hidden';
    const seen = p.sampleComments?.length ? `\n    comments seen (newest ${p.sampleComments.length}): ${p.sampleComments.map(c => JSON.stringify(plain(typeof c === 'string' ? c : c?.text))).join(' | ')}` : '';
    return `[${p.i}] ${p.type} ${likes} comments=${p.comments}${marks.length ? ` (${marks.join(', ')})` : ''}\n    caption: ${JSON.stringify(p.caption)}${seen}`;
  });
  return `CREATOR
name: ${plain(creator?.name)}
niche on file: ${plain(creator?.niche) || 'unknown'}
followers: ${facts.followers}
bio: ${JSON.stringify(facts.bio)}
links in bio: ${facts.links.length ? facts.links.join(' | ') : 'none'}

RECENT POSTS, newest first
${lines.join('\n')}`;
}

const A_FIELDS = ['LANGUAGE', 'FIRST_NAME', 'NICHE', 'AUDIENCE', 'EXPERTISE', 'FREE', 'PAID', 'TIME_BOUND', 'TIER', 'REASON', 'POST', 'QUOTE', 'OFFER', 'POST_GIST', 'SIGNAL', 'WHY', 'GAP', 'DIRECTION', 'ANGLE', 'ASSUMPTIONS'];

export function parseTagged(text, fields) {
  const raw = String(text || '');
  const re = new RegExp(`^[ \\t>*#-]*(${fields.join('|')})[ \\t]*:[ \\t]*`, 'gim');
  const marks = [];
  let m;
  while ((m = re.exec(raw))) marks.push({ key: m[1].toUpperCase(), at: m.index, from: re.lastIndex });
  const v = {};
  marks.forEach((k, i) => { if (!(k.key in v)) v[k.key] = raw.slice(k.from, i + 1 < marks.length ? marks[i + 1].at : raw.length).trim(); });
  return v;
}

const none = (x) => (!x || /^(none|null|n\/a|-|none found)\.?$/i.test(String(x).trim()) ? null : String(x).trim());
const unq = (x) => String(x || '').replace(/^["“”'`]+|["“”'`]+$/g, '').trim();

export function parseAnalysis(text) {
  const v = parseTagged(text, A_FIELDS);
  const tier = parseInt(v.TIER, 10);
  if (![0, 1, 2, 3, 4].includes(tier)) return null;
  const language = ['en', 'pt', 'br', 'es'].includes(String(v.LANGUAGE || '').trim().toLowerCase()) ? v.LANGUAGE.trim().toLowerCase() : null;
  return {
    tier, language, reason: v.REASON || '', post: parseInt(v.POST, 10),
    quote: none(unq(v.QUOTE)), offer: none(unq(v.OFFER)), firstName: none(unq(v.FIRST_NAME)),
    read: {
      niche: none(v.NICHE), audience: none(v.AUDIENCE), expertise: none(v.EXPERTISE),
      free: none(v.FREE), paid: none(v.PAID), timeBound: none(v.TIME_BOUND),
      postGist: none(v.POST_GIST), signal: none(v.SIGNAL), why: none(v.WHY), gap: none(v.GAP),
      direction: none(v.DIRECTION), angle: none(v.ANGLE), assumptions: none(v.ASSUMPTIONS),
    },
  };
}

const inText = (needle, hay) => {
  const q = fold(needle); const h = fold(hay);
  if (!q) return false;
  if (h.includes(q)) return true;
  const words = q.split(' ').filter(w => w.length > 2);
  return words.length > 0 && words.filter(w => h.includes(w)).length / words.length >= 0.8;
};

// Code decides whether the model's reading stands on real evidence.
export function verifyAnalysis(a, facts) {
  if (a.tier === 0) return [];
  const problems = [];
  // The model sometimes drops the index but quotes the caption: recover it.
  if (!facts.posts[a.post] && a.quote) {
    const hit = facts.posts.find(p => inText(a.quote, p.caption));
    if (hit) a.post = hit.i;
  }
  const post = facts.posts[a.post];
  if (!post) return ['post index out of range'];
  if (a.quote) { if (!inText(a.quote, post.caption)) problems.push('quote not found in that caption'); }
  else if (a.tier !== 3) problems.push('no quote');
  if (a.tier === 1 && !post.usable) problems.push(`weak tier 1: ${post.comments} comments, x${post.xComments} usual`);
  if (a.tier === 2 && (!post.usable || Math.max(post.xComments || 0, post.xLikes || 0) < 2)) problems.push('tier 2 on a post that is not above usual');
  if (a.tier === 3) {
    if (!a.offer) problems.push('tier 3 without an offer quote');
    else if (!inText(a.offer, `${facts.bio} ${facts.links.join(' ')}`)) problems.push('offer not found in bio or links');
  }
  // The reading is what every channel writer works from. An empty one means the
  // writers improvise, which is exactly what this layer exists to prevent.
  for (const k of ['postGist', 'why', 'gap', 'angle']) if (!a.read?.[k]) problems.push(`${k.replace(/[A-Z]/g, c => `_${c}`).toUpperCase()} is empty: every tier from 1 to 4 needs it`);
  if (/\bsaves?\b|\bsaved\b|guardad|guardaram/i.test(`${a.read.signal || ''} ${a.read.why || ''}`)) problems.push('mentions saves');
  // The signal sentence is a FACT: its numbers must be the post's numbers.
  // Any post's real numbers are fair: the reading often compares the chosen
  // post with the others ("75 comments against a usual 16").
  const allowed = new Set([String(facts.followers)]);
  for (const p of facts.posts) {
    allowed.add(String(p.likes)); allowed.add(String(p.comments));
    for (const x of [p.xComments, p.xLikes]) if (x) { allowed.add(String(x).replace(/[.,]/g, '')); for (let k = 2; k <= Math.floor(x); k += 1) allowed.add(String(k)); }
  }
  (post.caption.match(/\d+(?:[.,]\d+)*/g) || []).forEach(n => allowed.add(n.replace(/[.,]/g, '')));
  for (const n of (String(a.read.signal || '').match(/\d+(?:[.,]\d+)*/g) || [])) {
    const v = n.replace(/[.,]/g, '');
    const num = Number(v);
    if (allowed.has(v) || num < 13) continue; // post indexes, ordinals, small counts
    if (num >= 100 && [...allowed].map(Number).some(r => r >= 100 && Math.abs(r - num) / r <= 0.05)) continue;
    problems.push(`signal number not in data: ${n}`);
  }
  return problems;
}

// The compact object stored on the creator and handed to every channel writer.
export function toIntel({ analysis, facts }) {
  const post = analysis.tier === 0 ? null : facts.posts[analysis.post];
  const evidence = [];
  if (post) {
    evidence.push({
      ref: 'post', source: post.url, postType: post.type,
      metric: 'comments', value: post.comments, multiple: post.xComments,
      likes: post.likes, likesMultiple: post.xLikes,
      quote: analysis.quote || null, caption: post.caption,
      comments: (post.sampleComments || []).map(c => (typeof c === 'string' ? c : c?.text)).filter(Boolean).slice(0, 15),
    });
  }
  if (analysis.tier === 3 && analysis.offer) evidence.push({ ref: 'bio_or_links', source: 'instagram profile', quote: analysis.offer });
  return {
    v: INTEL_VERSION, at: new Date().toISOString(),
    language: analysis.language, firstName: analysis.firstName,
    tier: analysis.tier, reason: String(analysis.reason || '').slice(0, 200),
    facts: { followers: facts.followers, bio: facts.bio, links: facts.links, evidence, contact: facts.contact },
    read: analysis.tier === 0 ? null : analysis.read,
  };
}

export function isFresh(intel) {
  if (!intel || intel.v !== INTEL_VERSION || !intel.at) return false;
  return (Date.now() - new Date(intel.at).getTime()) < INTEL_MAX_AGE_DAYS * 86400000;
}

export function buildAnalysisRetry(problems) {
  return `Your reading failed these checks:\n- ${problems.join('\n- ')}\n\nRedo it in the same format using only the data above. If the tier you chose cannot pass, step down to the tier the data honestly supports.`;
}
