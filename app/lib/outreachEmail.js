// Cold outreach email — framework v2 (Sept 2026).
//
// Formula: personal observation → why it works → evidence of audience demand →
// monetization gap, incomplete on purpose → credibility → curiosity → low
// pressure 15 minutes. Diagnose before prescribing.
//
// Only the first three paragraphs (plus the subject and a short topic phrase)
// are written by the model. Everything from the credibility line down is FIXED
// copy per language, identical on every send, so the team reviews it once.
// Day 7 and Day 14 are fixed too and only take the first name and the topic.
//
// Honesty rule: the model may only use facts present in the scrape. We check
// its work here instead of trusting it — the quoted caption fragment must
// exist in the post it points at, and every number in the copy must exist in
// the data. A lead with no real demand signal gets NO email (tier 3) and goes
// to a human instead of getting a generic one.

export const EMAIL_FRAMEWORK = 'v2';
export const EMAIL_MODEL = 'claude-haiku-4-5-20251001';
export const SENDER_FIRST_NAME = 'Tomás';

// ── Fixed copy ───────────────────────────────────────────────────────────────
// 'br' is Brazilian Portuguese; the model picks pt vs br from the captions.
export const FIXED = {
  en: {
    greet: (n) => (n ? `Hey ${n},` : 'Hey,'),
    credibility: "For context, I run Second Layer. I've been doing this for 5 years, and last year we worked with 50+ clients helping turn existing audiences into new revenue streams.",
    ask: 'I already have a few ideas for what that could look like for you. Would be good to connect for 15 minutes this week, exchange some ideas and see where the conversation goes.',
    close: 'If it makes sense from there, great. If not, hopefully you leave with a couple of useful ideas.',
    signoff: 'Cheers,',
    day7: (n, topic) => `${n ? `Hey ${n},` : 'Hey,'}\n\nComing back to my note about ${topic}.\n\nThe ideas I mentioned come from what your audience is already asking you for, so they are easier to talk through than to write out.\n\nDo you have 15 minutes this week or next?\n\nCheers,`,
    day14: (n, topic) => `${n ? `Hey ${n},` : 'Hey,'}\n\nLast note from me on this. I still think there is something worth building around ${topic}.\n\nIf the timing is off, tell me and I will check back later in the year. If it is not, tell me a day that works and I will send a time.\n\nCheers,`,
  },
  pt: {
    greet: (n) => (n ? `Olá ${n},` : 'Olá,'),
    credibility: 'Para dar contexto, lidero a Second Layer. Faço isto há 5 anos e, no último ano, trabalhámos com mais de 50 clientes a transformar audiências em novas fontes de receita.',
    ask: 'Já tenho algumas ideias específicas para o teu caso. Gostava de trocar ideias contigo e perceber também como estás a pensar esta parte do teu projeto.',
    close: 'Tens 15 minutos para falarmos esta semana? Se fizer sentido, ótimo. Se não, pelo menos trocamos algumas ideias que te podem ser úteis.',
    signoff: 'Abraço,',
    day7: (n, topic) => `${n ? `Olá ${n},` : 'Olá,'}\n\nVolto ao que te escrevi sobre ${topic}.\n\nAs ideias de que falei vêm do que a tua audiência já te anda a pedir, por isso são mais fáceis de conversar do que de escrever.\n\nTens 15 minutos esta semana ou na próxima?\n\nAbraço,`,
    day14: (n, topic) => `${n ? `Olá ${n},` : 'Olá,'}\n\nÚltima nota minha sobre isto. Continuo a achar que há algo que vale a pena construir à volta de ${topic}.\n\nSe a altura não é boa, diz-me e volto a falar contigo mais para o fim do ano. Se for, diz-me um dia que te dê jeito e eu mando uma hora.\n\nAbraço,`,
  },
  br: {
    greet: (n) => (n ? `Olá ${n},` : 'Olá,'),
    credibility: 'Para dar contexto, lidero a Second Layer. Faço isso há 5 anos e, no último ano, trabalhamos com mais de 50 clientes transformando audiências em novas fontes de receita.',
    ask: 'Já tenho algumas ideias específicas para o seu caso. Gostaria de trocar ideias com você e entender também como está pensando essa parte do seu projeto.',
    close: 'Você tem 15 minutos para conversarmos esta semana? Se fizer sentido, ótimo. Se não, pelo menos trocamos algumas ideias que podem ser úteis para você.',
    signoff: 'Abraço,',
    day7: (n, topic) => `${n ? `Olá ${n},` : 'Olá,'}\n\nVolto ao que escrevi sobre ${topic}.\n\nAs ideias que mencionei vêm do que a sua audiência já está pedindo, por isso são mais fáceis de conversar do que de escrever.\n\nVocê tem 15 minutos esta semana ou na próxima?\n\nAbraço,`,
    day14: (n, topic) => `${n ? `Olá ${n},` : 'Olá,'}\n\nÚltima mensagem minha sobre isso. Continuo achando que existe algo que vale a pena construir em torno de ${topic}.\n\nSe o momento não é bom, me avise e eu volto a falar mais para o fim do ano. Se for, me diga um dia que funcione e eu mando um horário.\n\nAbraço,`,
  },
  es: {
    greet: (n) => (n ? `Hola ${n},` : 'Hola,'),
    credibility: 'Para darte contexto, dirijo Second Layer. Llevo 5 años haciendo esto y el último año trabajamos con más de 50 clientes convirtiendo audiencias en nuevas fuentes de ingresos.',
    ask: 'Ya tengo algunas ideas concretas para tu caso. Me gustaría intercambiar ideas contigo y entender también cómo estás pensando esta parte de tu proyecto.',
    close: '¿Tienes 15 minutos para hablar esta semana? Si tiene sentido, genial. Si no, al menos intercambiamos algunas ideas que te pueden servir.',
    signoff: 'Un abrazo,',
    day7: (n, topic) => `${n ? `Hola ${n},` : 'Hola,'}\n\nVuelvo a lo que te escribí sobre ${topic}.\n\nLas ideas que mencioné salen de lo que tu audiencia ya te está pidiendo, así que son más fáciles de hablar que de escribir.\n\n¿Tienes 15 minutos esta semana o la próxima?\n\nUn abrazo,`,
    day14: (n, topic) => `${n ? `Hola ${n},` : 'Hola,'}\n\nÚltimo mensaje mío sobre esto. Sigo pensando que hay algo que merece la pena construir alrededor de ${topic}.\n\nSi no es buen momento, dímelo y vuelvo a escribirte hacia final de año. Si lo es, dime un día que te venga bien y te mando una hora.\n\nUn abrazo,`,
  },
};

// Style references: the three custom paragraphs of emails Tomás wrote and
// rates as good. Diana's original cited saves; Instagram doesn't expose save
// counts, so the reference uses a signal the scrape can actually see.
const EXAMPLES = {
  en: `EXAMPLE A (tier 1, caption asked people to comment a keyword)
p1: Your "BILL" post on keeping AI costs under $50 a month stood out to me. Most people teaching AI automation focus on what you can build, but you addressed what it costs to run. That's the kind of content people come back to and use.
p2: I also noticed how many people were commenting "BILL" to get the resource. That's a pretty strong signal that your audience wants something more structured than individual tutorials.
p3: I think there's an interesting opportunity to turn that demand into a scalable offer, somewhere between your free content and consulting, without adding much more to your workload.

EXAMPLE B (tier 2, one post far above the usual)
p1: I've been watching your planche progression content, and your post on work vs. skill stood out. I liked how you broke down the actual mechanics behind progression instead of just telling people to grind more reps.
p2: I also noticed the response to it, about 4 times your usual comments. That's a pretty strong signal that people want more of what you're teaching there.
p3: I think there's an opportunity to build something between free guides and 1 to 1 coaching, a structured offer that uses that demand without requiring you to trade more of your time.`,
  pt: `EXEMPLO (tier 2, um post muito acima do habitual)
p1: Gostei muito da forma como abordas o "saudável sem complicações". As receitas continuam apetitosas e acessíveis, sem parecer que é preciso mudar completamente a forma de cozinhar.
p2: Reparei também que o Bacalhau Cremoso teve cerca de 3 vezes os teus comentários habituais. Para mim, isso é um sinal bastante claro de que existe procura por algo mais estruturado à volta das tuas receitas.
p3: Acho que há uma oportunidade interessante para transformar essa procura numa oferta paga, sem depender apenas de conteúdo gratuito ou de criar muito mais trabalho para ti.`,
};

const LANG_NAME = {
  en: 'English',
  pt: 'Portuguese. Match the variety of the captions: European Portuguese ("tu", "a fazer") or Brazilian Portuguese ("você", "fazendo")',
  es: 'Spanish, informal "tú"',
};

export function buildSystemPrompt(language) {
  const lang = LANG_NAME[language] ? language : 'en';
  const example = EXAMPLES[lang] || `${EXAMPLES.en}\n\n(The examples are in English for structure and tone only. Write in the target language.)`;
  return `You write the three custom paragraphs of a cold email from Tomás, who runs Second Layer, to a creator he has never spoken to. Second Layer helps creators turn an audience they already have into a new paid offer. Everything after your paragraphs (who we are, the ask, the sign off) is fixed copy added by code. Never write a greeting, an introduction of who we are, a call to action or a sign off.

The email must feel like it came from someone who understands their business, noticed an opportunity and might be worth knowing. Diagnose, never prescribe.

You get the creator's bio and recent posts with real numbers. Use ONLY facts present in that data. Never invent a post, a number, a comment, a product or an audience reaction. Instagram does not show save counts, so never mention saves.

STEP 1. Find the demand signal. This decides the tier.
Tier 1: a caption asks people to take an action to get something (comment a keyword, DM a word, grab a guide or template, join a list, link in bio for a resource) AND that post has real comment volume: at least 20 comments and not below the creator's usual. A call to action that few people answered is not a signal, so look at the other posts instead. People taking an action to receive something is the strongest signal there is.
Tier 2: no such caption, but a post line is marked as x2 or more above this creator's usual and it teaches, explains or answers something. The signal is that this topic pulled far more response than usual.
Tier 3: neither. Return tier 3 with a short reason and nothing else. Do not force it. A generic email is worse than no email.

STEP 2. Write three short paragraphs in ${LANG_NAME[lang]}.
p1, observation then interpretation, 2 to 3 sentences. Name the specific post or recurring angle, then say why it works or what it does differently from others in the niche. Frame it as YOUR reaction ("stood out to me", "I liked how"), never as a verdict about them ("You clearly", "Your content is"). Test: if the sentence could be sent to 20 other creators, rewrite it.
p2, demand evidence, 2 sentences. "I also noticed" plus the signal with its real number or multiple, then what it tells you: people want something more structured, or more of this than single posts give them. A count is the number of comments on the post, so write "that post got 384 comments", never "384 people commented the keyword". You may say people were commenting the keyword to get the resource only when that post is marked x3 or more usual comments. Never claim that people sent messages or what else they wrote unless it is shown under "comments seen". You may round a big number ("nearly 14,000 comments").
p3, the opportunity, 2 sentences at most, starting with "I think". No list of three. Mention a service or product they already have only if it appears in the bio or links. Be specific about the gap (for example between the free content and the 1 to 1 work, or beyond a product they already sell) and incomplete about the solution. Never name a format, a price, a module count or a platform. Make it feel incremental: they already have the audience, the knowledge and the demand, so it should not mean much more work for them.

VOICE
Plain words, like a person typing to a peer. The sophistication is in the thinking, not the vocabulary. Short, uneven sentences. No hype and no copywriter phrases (unlock, maximize, scale your brand, monetization potential, turn followers into customers, game changer, leverage, next level). No flattery such as "great content" or "amazing". One observation only, never a stack of compliments. Every sentence must add relevance, understanding, demand or curiosity, otherwise cut it.
Punctuation: no em dashes, no en dashes, no hyphen used as punctuation, no colons, no semicolons, no parentheses, no emojis, no exclamation marks. Write "1 to 1", never "1:1". Put a post title or keyword in straight double quotes.
Numbers: only numbers that appear in the data. A multiple such as "3 times your usual comments" only if that post's line shows it, rounded down.

${example}

OUTPUT
Plain text, one field per line, exactly these labels in this order and nothing else. No JSON, no markdown. For tier 3 return only TIER and REASON.
TIER: 1, 2 or 3
REASON: why this tier, 12 words at most
POST: index of the post you built the email on
QUOTE: a short fragment copied EXACTLY from that post's caption, the part you are referring to
FIRST_NAME: the person's first name if this is clearly a person and the name is evident from the name or bio, else none
VARIANT: pt or br for Portuguese, else none
SUBJECT: 2 to 6 words, lowercase, a noun phrase that NAMES the post or angle and starts with your / o teu / a tua / tu, like your "BILL" post. Never words like demand, opportunity, idea or question
P1: ...
P2: ...
P3: ...`;
}

// ── Lead data → user message ─────────────────────────────────────────────────
const median = (arr) => {
  const a = arr.filter(n => Number.isFinite(n) && n > 0).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

// Each post's multiple is measured against the median of the OTHER posts, so a
// single viral post can't inflate its own baseline.
export function withMultiples(posts) {
  return posts.map((p, i) => {
    const others = posts.filter((_, j) => j !== i);
    const mc = median(others.map(o => o.comments));
    const ml = median(others.map(o => o.likes));
    return {
      ...p,
      xComments: mc > 0 && p.comments > 0 ? Math.floor((p.comments / mc) * 10) / 10 : null,
      xLikes: ml > 0 && p.likes > 0 ? Math.floor((p.likes / ml) * 10) / 10 : null,
    };
  });
}

// Fancy-unicode display names ("𝐀𝐧𝐝𝐫𝐞́") fold to plain letters.
const plain = (s) => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();

export function buildUserMessage({ creator, scrape, posts }) {
  const lines = posts.map((p, i) => {
    const marks = [];
    if (p.xComments && p.xComments >= 2) marks.push(`x${p.xComments} usual comments`);
    if (p.xLikes && p.xLikes >= 2) marks.push(`x${p.xLikes} usual likes`);
    if (p.comments < 20 || (p.xComments != null && p.xComments < 1)) marks.push('below usual, NOT usable as the signal');
    const likes = p.likes > 0 ? `likes=${p.likes}` : 'likes=hidden';
    const sample = p.sampleComments?.length ? `\n    comments seen: ${p.sampleComments.map(c => JSON.stringify(plain(c))).join(' | ')}` : '';
    const cap = plain(p.caption);
    const shown = cap.length > 820 ? `${cap.slice(0, 400)} [...] ${cap.slice(-400)}` : cap;
    return `[${i}] ${p.type} ${likes} comments=${p.comments}${marks.length ? ` (${marks.join(', ')})` : ''}\n    caption: ${JSON.stringify(shown)}${sample}`;
  });
  const links = (scrape?.igBioLinks || []).map(l => plain(l?.title || l?.url || l)).filter(Boolean).slice(0, 6);
  return `CREATOR
name: ${plain(creator?.name || scrape?.name)}
niche: ${plain(creator?.niche) || 'unknown'}
followers: ${scrape?.followers || 0}
bio: ${JSON.stringify(plain(scrape?.bio || creator?.bio).slice(0, 400))}
links in bio: ${links.length ? links.join(' | ') : 'none'}

RECENT POSTS, newest first
${lines.join('\n')}`;
}

// ── Checking the model's work ────────────────────────────────────────────────
const fold = (s) => plain(s).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Words that claim a multiple → the multiple they claim.
const MULTIPLE_WORDS = [
  [/\b(twice|double|dobro|doble)\b/i, 2],
  [/\b(triple|triplo|three times|tres veces|três vezes)\b/i, 3],
  [/\b(four times|quatro vezes|cuatro veces|quadruple|quádruplo)\b/i, 4],
  [/\b(five times|cinco vezes|cinco veces)\b/i, 5],
];

const BANNED = [
  /\bsaves?\b/i, /\bsaved\b/i, /\bguardad[oa]s?\b/i, /\bsalv[oa]s?\b/i, /\bguardaram\b/i,
  /no pitch/i, /sem pitch/i, /sin pitch/i,
  /\bunlock/i, /\bmaximi[sz]e/i, /monetization potential/i, /game.?changer/i, /\bleverage\b/i, /next level/i,
  /discovery call/i, /strategy session/i,
];

// Dashes and colons are fixed rather than failed: the sentence survives a
// comma, and it's the one mistake the model makes most.
export function cleanPunctuation(text) {
  return String(text || '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\b1:1\b/g, '1 to 1')
    .replace(/[ \t]*[—–][ \t]*/g, ', ')
    .replace(/[ \t]+-[ \t]+/g, ', ')
    .replace(/[ \t]*[:;][ \t]+/g, ', ')
    .replace(/[()]/g, '')
    .replace(/!/g, '.')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function checkDraft(draft, posts, scrape) {
  const problems = [];
  const post = posts[draft.post];
  if (!post) return ['post index out of range'];

  // 1. The quoted fragment must really be in that caption.
  const cap = fold(post.caption);
  const q = fold(draft.quote);
  if (!q) problems.push('no quote');
  else if (!cap.includes(q)) {
    const words = q.split(' ').filter(w => w.length > 2);
    const hit = words.filter(w => cap.includes(w)).length;
    if (!words.length || hit / words.length < 0.8) problems.push('quote not found in caption');
  }

  // 2. Every number in the copy must exist in the data.
  const body = [draft.p1, draft.p2, draft.p3].join(' ');
  const allowed = new Set();
  const addNums = (s) => (String(s || '').match(/\d+(?:[.,]\d+)*/g) || []).forEach(n => allowed.add(n.replace(/[.,]/g, '')));
  posts.forEach(p => { addNums(p.caption); allowed.add(String(p.likes)); allowed.add(String(p.comments)); (p.sampleComments || []).forEach(addNums); });
  addNums(scrape?.bio); allowed.add(String(scrape?.followers || ''));
  const maxX = Math.floor(Math.max(post.xComments || 0, post.xLikes || 0));
  for (let k = 2; k <= maxX; k += 1) allowed.add(String(k));
  allowed.add('1'); // "1 to 1"
  // A rounded figure ("nearly 14,000" for 13,994) is how a person writes it.
  const real = [...allowed].map(Number).filter(v => Number.isFinite(v) && v >= 100);
  for (const n of (body.match(/\d+(?:[.,]\d+)*/g) || [])) {
    const v = n.replace(/[.,]/g, '');
    if (allowed.has(v)) continue;
    const num = Number(v);
    if (num >= 100 && real.some(r => Math.abs(r - num) / r <= 0.05)) continue;
    problems.push(`number not in data: ${n}`);
  }
  for (const [re, x] of MULTIPLE_WORDS) {
    if (re.test(body) && maxX < x) problems.push(`claims x${x}, post shows x${maxX}`);
  }

  // 3. The signal has to be real. Tier 2 only on a post the code marked as an
  // outlier; tier 1 only where people actually answered the call to action.
  if (draft.tier === 2 && maxX < 2) problems.push('tier 2 on a post that is not above usual');
  if (draft.tier === 1 && (post.comments < 20 || (post.xComments != null && post.xComments < 1))) {
    problems.push(`weak tier 1: ${post.comments} comments, x${post.xComments} usual`);
  }

  // 4. Voice.
  for (const re of BANNED) if (re.test(`${body} ${draft.subject}`)) problems.push(`banned phrase: ${re.source}`);
  for (const k of ['p1', 'p2', 'p3']) {
    const w = String(draft[k] || '').trim().split(/\s+/).filter(Boolean).length;
    if (w < 8) problems.push(`${k} too short`);
    if (w > 75) problems.push(`${k} too long (${w} words)`);
  }
  if (!String(draft.subject || '').trim()) problems.push('no subject');
  return problems;
}

const FIELDS = ['TIER', 'REASON', 'POST', 'QUOTE', 'FIRST_NAME', 'VARIANT', 'SUBJECT', 'P1', 'P2', 'P3'];

export function parseDraft(text) {
  const raw = String(text || '');
  const re = new RegExp(`^[ \\t>*#-]*(${FIELDS.join('|')})[ \\t]*:[ \\t]*`, 'gim');
  const marks = [];
  let m;
  while ((m = re.exec(raw))) marks.push({ key: m[1].toUpperCase(), at: m.index, from: re.lastIndex });
  if (!marks.length) return null;
  const v = {};
  marks.forEach((k, i) => { if (!(k.key in v)) v[k.key] = raw.slice(k.from, i + 1 < marks.length ? marks[i + 1].at : raw.length).trim(); });
  const none = (x) => (!x || /^(none|null|n\/a|-)$/i.test(x) ? null : x);
  const unq = (x) => String(x || '').replace(/^["“”'`]+|["“”'`]+$/g, '').trim();
  const tier = parseInt(v.TIER, 10);
  if (![1, 2, 3].includes(tier)) return null;
  return {
    tier, reason: v.REASON || '', post: parseInt(v.POST, 10),
    quote: unq(v.QUOTE), first_name: none(unq(v.FIRST_NAME)), variant: none(unq(v.VARIANT)),
    // A subject is often a quoted title: strip only a quote pair that wraps the WHOLE value.
    subject: /^"[^"]*"$/.test(v.SUBJECT || '') ? unq(v.SUBJECT) : (v.SUBJECT || ''),
    p1: v.P1 || '', p2: v.P2 || '', p3: v.P3 || '',
  };
}

// ── Assembly ─────────────────────────────────────────────────────────────────
export function assemble(draft, language) {
  const key = language === 'pt' && draft.variant === 'br' ? 'br' : (FIXED[language] ? language : 'en');
  const f = FIXED[key];
  const name = plain(draft.first_name || '') || null;
  const subject = cleanPunctuation(draft.subject || '').replace(/[.,]+$/, '');
  const topic = subject;
  const sign = `${f.signoff}\n${SENDER_FIRST_NAME}`;
  const day1 = [
    f.greet(name),
    cleanPunctuation(draft.p1), cleanPunctuation(draft.p2), cleanPunctuation(draft.p3),
    f.credibility, f.ask, f.close, sign,
  ].join('\n\n');
  return {
    copyKey: key,
    email_day1: { subject, body: day1 },
    email_day7: { subject, body: `${f.day7(name, topic)}\n${SENDER_FIRST_NAME}` },
    email_day14: { subject, body: `${f.day14(name, topic)}\n${SENDER_FIRST_NAME}` },
  };
}


// One corrective pass: the model sees exactly what failed and either fixes it
// or concedes tier 3. Cheaper than a human sorting out a bad draft.
export function buildRetryMessage(problems) {
  return `Your draft failed these checks:\n- ${problems.join('\n- ')}\n\nFix it using only the data above, in the same output format. If the only way to pass is to invent something or to lean on a post marked NOT usable, return tier 3.`;
}
