// Channel writers for EMAIL and WHATSAPP — stage 2 of the outreach pipeline.
//
// Input is the stored creator intelligence (lib/creatorIntel.js), never the raw
// scrape: the writer can only state what code already verified, and it is told
// which lines are facts and which are our reading. The Instagram DM keeps its
// own approved writer (api/dm-writer) and receives the same intelligence.
//
// FIXED SALES MECHANICS, VARIABLE PERSONALIZATION. The model writes the creator
// specific insight and opportunity (subject, p1 to p3, wa1, wa2). Credibility,
// the ask, the close, the follow-ups, the manager variant and the WhatsApp
// source line are fixed copy per language, reviewed once, identical every send.
//
// Prompt instructions are not enforcement: checkCopy() re-verifies every number,
// multiple and banned claim in code before anything is saved.

import { plain, fold, postKind } from './creatorIntel';

export const EMAIL_FRAMEWORK = 'v2';
export const EMAIL_MODEL = 'claude-haiku-4-5-20251001';

// ── Sender ───────────────────────────────────────────────────────────────────
// The credibility line below says "I run Second Layer", which is only true for
// Tomás. Another sender needs their own APPROVED line before the writer will
// produce anything in their name; we never generate a statement that is false
// for the person sending it.
const SENDERS = { tomas: { firstName: 'Tomás', approved: true } };
const senderKey = (n) => String(n || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
export function resolveSender(name) {
  const s = SENDERS[senderKey(name || 'Tomás')];
  return s && s.approved ? s : null;
}
export const SENDER_FIRST_NAME = 'Tomás';

// ── Fixed copy ───────────────────────────────────────────────────────────────
// 'br' is Brazilian Portuguese. The analysis stage decides pt vs br; the two
// are never mixed.
export const FIXED = {
  en: {
    greet: (n) => (n ? `Hey ${n},` : 'Hey,'),
    credibility: "For context, I run Second Layer. I've been doing this for 5 years, and last year we worked with 50+ clients helping turn existing audiences into new revenue streams.",
    ask: 'I already have a few ideas for what that could look like for you. Would be good to connect for 15 minutes this week, exchange some ideas and see where the conversation goes.',
    close: 'If it makes sense from there, great. If not, hopefully you leave with a couple of useful ideas.',
    signoff: 'Cheers,',
    day7: (n, topic) => `${n ? `Hey ${n},` : 'Hey,'}\n\nComing back to my note about ${topic}.\n\nThe ideas I mentioned come from what your audience is already asking you for, so they are easier to talk through than to write out.\n\nDo you have 15 minutes this week or next?\n\nCheers,`,
    day14: (n, topic) => `${n ? `Hey ${n},` : 'Hey,'}\n\nLast note from me about ${topic}. I still think there is something worth building there.\n\nIf the timing is off, tell me and I will check back later in the year. If it is not, tell me a day that works and I will send a time.\n\nCheers,`,
  },
  pt: {
    greet: (n) => (n ? `Olá ${n},` : 'Olá,'),
    credibility: 'Para dar contexto, lidero a Second Layer. Faço isto há 5 anos e, no último ano, trabalhámos com mais de 50 clientes a transformar audiências em novas fontes de receita.',
    ask: 'Já tenho algumas ideias específicas para o teu caso. Gostava de trocar ideias contigo e perceber também como estás a pensar esta parte do teu projeto.',
    close: 'Tens 15 minutos para falarmos esta semana? Se fizer sentido, ótimo. Se não, pelo menos trocamos algumas ideias que te podem ser úteis.',
    signoff: 'Abraço,',
    day7: (n, topic) => `${n ? `Olá ${n},` : 'Olá,'}\n\nVolto ao que te escrevi sobre ${topic}.\n\nAs ideias de que falei vêm do que a tua audiência já te anda a pedir, por isso são mais fáceis de conversar do que de escrever.\n\nTens 15 minutos esta semana ou na próxima?\n\nAbraço,`,
    day14: (n, topic) => `${n ? `Olá ${n},` : 'Olá,'}\n\nÚltima nota minha sobre ${topic}. Continuo a achar que há ali algo que vale a pena construir.\n\nSe a altura não é boa, diz-me e volto a falar contigo mais para o fim do ano. Se for, diz-me um dia que te dê jeito e eu mando uma hora.\n\nAbraço,`,
  },
  br: {
    greet: (n) => (n ? `Olá ${n},` : 'Olá,'),
    credibility: 'Para dar contexto, lidero a Second Layer. Faço isso há 5 anos e, no último ano, trabalhamos com mais de 50 clientes transformando audiências em novas fontes de receita.',
    ask: 'Já tenho algumas ideias específicas para o seu caso. Gostaria de trocar ideias com você e entender também como está pensando essa parte do seu projeto.',
    close: 'Você tem 15 minutos para conversarmos esta semana? Se fizer sentido, ótimo. Se não, pelo menos trocamos algumas ideias que podem ser úteis para você.',
    signoff: 'Abraço,',
    day7: (n, topic) => `${n ? `Olá ${n},` : 'Olá,'}\n\nVolto ao que escrevi sobre ${topic}.\n\nAs ideias que mencionei vêm do que a sua audiência já está pedindo, por isso são mais fáceis de conversar do que de escrever.\n\nVocê tem 15 minutos esta semana ou na próxima?\n\nAbraço,`,
    day14: (n, topic) => `${n ? `Olá ${n},` : 'Olá,'}\n\nÚltima mensagem minha sobre ${topic}. Continuo achando que existe ali algo que vale a pena construir.\n\nSe o momento não é bom, me avise e eu volto a falar mais para o fim do ano. Se for, me diga um dia que funcione e eu mando um horário.\n\nAbraço,`,
  },
  es: {
    greet: (n) => (n ? `Hola ${n},` : 'Hola,'),
    credibility: 'Para darte contexto, dirijo Second Layer. Llevo 5 años haciendo esto y el último año trabajamos con más de 50 clientes convirtiendo audiencias en nuevas fuentes de ingresos.',
    ask: 'Ya tengo algunas ideas concretas para tu caso. Me gustaría intercambiar ideas contigo y entender también cómo estás pensando esta parte de tu proyecto.',
    close: '¿Tienes 15 minutos para hablar esta semana? Si tiene sentido, genial. Si no, al menos intercambiamos algunas ideas que te pueden servir.',
    signoff: 'Un abrazo,',
    day7: (n, topic) => `${n ? `Hola ${n},` : 'Hola,'}\n\nVuelvo a lo que te escribí sobre ${topic}.\n\nLas ideas que mencioné salen de lo que tu audiencia ya te está pidiendo, así que son más fáciles de hablar que de escribir.\n\n¿Tienes 15 minutos esta semana o la próxima?\n\nUn abrazo,`,
    day14: (n, topic) => `${n ? `Hola ${n},` : 'Hola,'}\n\nÚltimo mensaje mío sobre ${topic}. Sigo pensando que ahí hay algo que merece la pena construir.\n\nSi no es buen momento, dímelo y vuelvo a escribirte hacia final de año. Si lo es, dime un día que te venga bien y te mando una hora.\n\nUn abrazo,`,
  },
};

// Tier 4 — no demand evidence in the data, so the email ASKS instead of claiming.
// Diagnose before prescribing, taken literally. p1 stays specific to the lead.
export const ASK_BLOCK = {
  en: [
    "What I can't see from the outside is what happens after the posts. Whether people ask you for more, a plan, a guide, a way to work with you, and where you send them when they do.",
    "I think that's usually where the opportunity sits for an audience like yours, and it rarely takes much more work than what you already do.",
  ],
  pt: [
    'O que não consigo ver de fora é o que acontece depois dos posts. Se as pessoas te pedem mais, um plano, um guia, uma forma de trabalhar contigo, e para onde as mandas quando pedem.',
    'Acho que é normalmente aí que está a oportunidade para uma audiência como a tua, e raramente exige muito mais trabalho do que o que já fazes.',
  ],
  br: [
    'O que eu não consigo ver de fora é o que acontece depois dos posts. Se as pessoas pedem mais, um plano, um guia, uma forma de trabalhar com você, e para onde você manda quando pedem.',
    'Acho que normalmente é aí que está a oportunidade para uma audiência como a sua, e raramente exige muito mais trabalho do que você já faz.',
  ],
  es: [
    'Lo que no puedo ver desde fuera es qué pasa después de los posts. Si la gente te pide más, un plan, una guía, una forma de trabajar contigo, y a dónde la mandas cuando lo hace.',
    'Creo que ahí suele estar la oportunidad para una audiencia como la tuya, y rara vez exige mucho más trabajo del que ya haces.',
  ],
};

// WhatsApp first message — the same diagnosis at roughly half the length. A
// cold WhatsApp lands on a personal phone from an unknown number, so it says
// who is writing in the first line and asks one thing. wa1/wa2 come from the
// model (tier 4 uses the fixed ask for wa2); the rest is fixed.
export const WHATSAPP = {
  en: {
    greet: (n) => (n ? `Hey ${n}, Tomás here.` : 'Hey, Tomás here.'),
    ask4: "What I can't see from the outside is whether people ask you for more than the posts. I think that's usually where the opportunity sits.",
    close: "I run Second Layer. I've been doing this for 5 years and worked with 50+ clients last year, and I already have a few ideas for you.\n\nGot 15 minutes this week to exchange some ideas?",
  },
  pt: {
    greet: (n) => (n ? `Olá ${n}, é o Tomás.` : 'Olá, é o Tomás.'),
    ask4: 'O que não consigo ver de fora é se as pessoas te pedem mais do que os posts. Acho que é normalmente aí que está a oportunidade.',
    close: 'Lidero a Second Layer. Faço isto há 5 anos, no último ano trabalhámos com mais de 50 clientes, e já tenho algumas ideias para o teu caso.\n\nTens 15 minutos esta semana para trocarmos ideias?',
  },
  br: {
    greet: (n) => (n ? `Olá ${n}, aqui é o Tomás.` : 'Olá, aqui é o Tomás.'),
    ask4: 'O que eu não consigo ver de fora é se as pessoas pedem mais do que os posts. Acho que normalmente é aí que está a oportunidade.',
    close: 'Lidero a Second Layer. Faço isso há 5 anos, no último ano trabalhamos com mais de 50 clientes, e já tenho algumas ideias para o seu caso.\n\nVocê tem 15 minutos esta semana para trocarmos ideias?',
  },
  es: {
    greet: (n) => (n ? `Hola ${n}, soy Tomás.` : 'Hola, soy Tomás.'),
    ask4: 'Lo que no puedo ver desde fuera es si la gente te pide más que los posts. Creo que ahí suele estar la oportunidad.',
    close: 'Dirijo Second Layer. Llevo 5 años haciendo esto, el último año trabajamos con más de 50 clientes, y ya tengo algunas ideas para tu caso.\n\n¿Tienes 15 minutos esta semana para intercambiar ideas?',
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

// Manager / talent agency inbox. The reader is NOT the creator, so the email is
// written to that person ABOUT the creator, and the ask is a conversation or
// being pointed to whoever handles this.
export const AGENCY = {
  en: {
    greet: 'Hi,',
    intro: (full) => `I'm writing about ${full}, who I understand you work with.`,
    ask: 'I already have a few ideas for what that could look like. Would be good to connect for 15 minutes with you or whoever handles this side of things, exchange some ideas and see where the conversation goes.',
    close: 'If it makes sense from there, great. If not, hopefully you leave with a couple of useful ideas.',
    day7: (full, first, topic) => `Hi,\n\nComing back to my note about ${full} and ${topic}.\n\nThe ideas I mentioned come from what ${first}'s audience is already asking for, so they are easier to talk through than to write out.\n\nDo you have 15 minutes this week or next, or is there someone better placed to speak with?\n\nCheers,`,
    day14: (full, first, topic) => `Hi,\n\nLast note from me about ${topic}. I still think there is something worth building there.\n\nIf the timing is off, tell me and I will check back later in the year. If someone else handles this for ${first}, point me to them and I will take it from there.\n\nCheers,`,
  },
  pt: {
    greet: 'Olá,',
    intro: (full) => `Escrevo a propósito de ${full}, com quem penso que trabalham.`,
    ask: 'Já tenho algumas ideias para o que isto poderia ser. Gostava de falar 15 minutos convosco, ou com quem trate desta parte, para trocarmos ideias e ver onde a conversa nos leva.',
    close: 'Se fizer sentido, ótimo. Se não, pelo menos trocamos algumas ideias que podem ser úteis.',
    day7: (full, first, topic) => `Olá,\n\nVolto ao que escrevi sobre ${full} e ${topic}.\n\nAs ideias de que falei vêm do que a audiência de ${first} já anda a pedir, por isso são mais fáceis de conversar do que de escrever.\n\nTêm 15 minutos esta semana ou na próxima, ou há alguém mais indicado com quem falar?\n\nAbraço,`,
    day14: (full, first, topic) => `Olá,\n\nÚltima nota minha sobre ${topic}. Continuo a achar que há ali algo que vale a pena construir.\n\nSe a altura não é boa, digam-me e volto a falar mais para o fim do ano. Se for outra pessoa a tratar disto para ${first}, indiquem-me quem e eu sigo por aí.\n\nAbraço,`,
  },
  br: {
    greet: 'Olá,',
    intro: (full) => `Escrevo a respeito de ${full}, com quem acredito que vocês trabalham.`,
    ask: 'Já tenho algumas ideias do que isso poderia ser. Gostaria de conversar 15 minutos com vocês, ou com quem cuida dessa parte, para trocarmos ideias e ver aonde a conversa nos leva.',
    close: 'Se fizer sentido, ótimo. Se não, pelo menos trocamos algumas ideias que podem ser úteis.',
    day7: (full, first, topic) => `Olá,\n\nVolto ao que escrevi sobre ${full} e ${topic}.\n\nAs ideias que mencionei vêm do que a audiência de ${first} já está pedindo, por isso são mais fáceis de conversar do que de escrever.\n\nVocês têm 15 minutos esta semana ou na próxima, ou existe alguém mais indicado para falar?\n\nAbraço,`,
    day14: (full, first, topic) => `Olá,\n\nÚltima mensagem minha sobre ${topic}. Continuo achando que existe ali algo que vale a pena construir.\n\nSe o momento não é bom, me avisem e eu volto a falar mais para o fim do ano. Se outra pessoa cuida disso para ${first}, me indiquem quem e eu sigo por aí.\n\nAbraço,`,
  },
  es: {
    greet: 'Hola,',
    intro: (full) => `Escribo por ${full}, con quien entiendo que trabajan.`,
    ask: 'Ya tengo algunas ideas de cómo podría ser. Me gustaría hablar 15 minutos con ustedes, o con quien lleve esta parte, intercambiar ideas y ver a dónde nos lleva la conversación.',
    close: 'Si tiene sentido, genial. Si no, al menos intercambiamos algunas ideas que pueden servir.',
    day7: (full, first, topic) => `Hola,\n\nVuelvo a lo que escribí sobre ${full} y ${topic}.\n\nLas ideas que mencioné salen de lo que la audiencia de ${first} ya está pidiendo, así que son más fáciles de hablar que de escribir.\n\n¿Tienen 15 minutos esta semana o la próxima, o hay alguien más indicado con quien hablar?\n\nUn abrazo,`,
    day14: (full, first, topic) => `Hola,\n\nÚltimo mensaje mío sobre ${topic}. Sigo pensando que ahí hay algo que merece la pena construir.\n\nSi no es buen momento, díganmelo y vuelvo a escribir hacia final de año. Si otra persona lleva esto para ${first}, indíquenme quién y sigo por ahí.\n\nUn abrazo,`,
  },
};

// WhatsApp source line. Used ONLY when code verified where the number is
// published (lib/creatorIntel verifyPhoneSource). Neutral, never apologetic.
// Unknown source → no line at all; we never invent an explanation.
export const WA_SOURCE = {
  en: { link: "Found your WhatsApp link on your Instagram profile and thought I'd reach out here.", number: "Found your number on your Instagram profile and thought I'd reach out here.", website: "Found your number on your website and thought I'd reach out here." },
  pt: { link: 'Encontrei o teu link de WhatsApp no teu perfil de Instagram e decidi falar contigo por aqui.', number: 'Encontrei o teu número no teu perfil de Instagram e decidi falar contigo por aqui.', website: 'Encontrei o teu número no teu site e decidi falar contigo por aqui.' },
  br: { link: 'Encontrei seu link de WhatsApp no seu perfil do Instagram e resolvi falar com você por aqui.', number: 'Encontrei seu número no seu perfil do Instagram e resolvi falar com você por aqui.', website: 'Encontrei seu número no seu site e resolvi falar com você por aqui.' },
  es: { link: 'Encontré tu enlace de WhatsApp en tu perfil de Instagram y pensé en escribirte por aquí.', number: 'Encontré tu número en tu perfil de Instagram y pensé en escribirte por aquí.', website: 'Encontré tu número en tu web y pensé en escribirte por aquí.' },
};

const LANG_NAME = {
  en: 'English',
  pt: 'European Portuguese ("tu", "a fazer"). Never Brazilian forms',
  br: 'Brazilian Portuguese ("você", "fazendo"). Never European forms',
  es: 'Spanish, informal "tú"',
};

// In-language phrasing examples. English examples pulled the model into English
// for Spanish and Portuguese leads, most of all in the manager variant.
const PHRASES = {
  en: { subject: 'your "BILL" post', agencySubject: 'laura\'s "tupper" post', third: '"Laura\'s post on...", "her audience", "I think there is an opportunity for Laura..."', think: 'I think' },
  pt: { subject: 'o teu post "BILL"', agencySubject: 'o post "tupper" da laura', third: '"O post da Laura sobre...", "a audiência dela", "Acho que há uma oportunidade para a Laura..."', think: 'Acho que' },
  br: { subject: 'seu post "BILL"', agencySubject: 'o post "tupper" da laura', third: '"O post da Laura sobre...", "a audiência dela", "Acho que existe uma oportunidade para a Laura..."', think: 'Acho que' },
  es: { subject: 'tu post "BILL"', agencySubject: 'el post "tupper" de laura', third: '"El post de Laura sobre...", "su audiencia", "Creo que hay una oportunidad para Laura..."', think: 'Creo que' },
};

// ── Writer prompt ────────────────────────────────────────────────────────────
export function buildWriterPrompt(language, { agency = false } = {}) {
  const lang = LANG_NAME[language] ? language : 'en';
  const ph = PHRASES[lang];
  const example = EXAMPLES[lang === 'br' ? 'pt' : lang] || `${EXAMPLES.en}\n\n(The examples are in English for structure and tone only. Write in the target language.)`;
  return `You write the creator specific part of a first outreach from Tomás, who runs Second Layer, for two channels: EMAIL and WHATSAPP. Second Layer helps creators turn an audience they already have into a new paid offer. Everything after your paragraphs (who we are, the ask, the sign off) is fixed copy added by code. Never write a greeting, an introduction of who we are, a call to action or a sign off.

You receive a creator intelligence object prepared earlier. It has two parts and the difference is the whole job:
VERIFIED FACTS were checked by code. You may state them, with numbers exactly as written. Never calculate or restate a number differently.
OUR READING is interpretation. Use it to decide what to say, and phrase it as your view ("I think", "that tells me"), never as a fact about them. The line marked INTERNAL is never revealed.
State nothing that is not in VERIFIED FACTS. Instagram does not show save counts, so never mention saves.

The goal is that the creator thinks: this person looked at what I do, noticed something commercially interesting about my audience, and might have ideas worth discussing. Diagnose, never prescribe. Be specific about the gap and incomplete about the solution: never name a format, a price, a module count or a platform, and never describe the fix itself ("a smaller first step", "something free that..."). Say the gap exists and that you have ideas, nothing more. Make it feel incremental, building on the audience, knowledge and demand they already have.
${agency ? `
THE READER IS NOT THE CREATOR. This address belongs to their manager or agency. Write ABOUT the creator in the third person, using their first name, in ${LANG_NAME[lang]}: ${ph.third}. Never address the creator directly. The subject names the creator and the post.
` : ''}
EMAIL, three short paragraphs in ${LANG_NAME[lang]}. Email can carry a little more context because the reader does not know who is writing.
p1, observation then interpretation, 2 to 3 sentences. Name the specific post or angle from the facts, then why it works or what it does differently. Your reaction ("stood out to me", "I liked how"), never a verdict ("You clearly", "Your content is"). If the sentence could be sent to 20 other creators, rewrite it.
p2, demand evidence, 2 sentences. "I also noticed" plus the signal with its real number or multiple, then what it tells you. A count is the number of comments on the post: write "that post got 384 comments", never "384 people commented the keyword". When the post is marked x3 or more usual comments you may tie the count to the ask ("nearly 1,100 comments after you asked people to comment QUIERO"). Never describe what people wrote unless it appears under comments seen; when it does, quoting one or two of them exactly, in straight double quotes, is the strongest evidence you have ("people asking how long in the oven", "comments like \"Quero a receita\""). You may round a big number.
   Tier 3: p2 is "I also noticed you already have" plus the offer exactly as quoted, then what it tells you: one product or service rarely captures everyone in an audience who wants help. State only that it exists, never how it sells.
p3, the opportunity, 2 sentences at most, starting with "${ph.think}". Use the gap from our reading. No list of three. Mention an existing offer only if it is in the facts.
   Tier 4: write p1 only and leave P2 and P3 empty. Code adds an honest question about demand.

WHATSAPP, the same insight, much shorter and more conversational, for a personal channel. wa1 is the observation in ONE sentence of 24 words at most. wa2 is the signal and the opportunity in one or two short sentences, 34 words at most. Tier 4: leave WA2 empty.

VOICE
Plain words, like a person typing to a peer. The sophistication is in the thinking, not the vocabulary. Short, uneven sentences. No hype and no agency phrases (unlock, maximize, scale your brand, monetization potential, monetization ecosystem, high converting funnel, turn followers into customers, game changer, leverage, next level). No flattery such as "great content". No business filler either (momentum, synergy, complementary offers, take it to the next stage). Do not say you have ideas: the fixed copy right after your paragraphs already says it. One observation only. Every sentence must add relevance, understanding, demand or curiosity, otherwise cut it.
Punctuation: never use a hyphen or a dash as punctuation (no "word - word", no em or en dashes). Hyphens that belong to a word or a name stay. Colons are fine when grammar needs one, but keep it conversational, not formatted. No parentheses, no emojis, no exclamation marks. Write "1 to 1". Put a post title or keyword in straight double quotes.

${example}

OUTPUT: plain text, one field per line, exactly these labels (the labels stay as written, the content is in ${LANG_NAME[lang]}), nothing else.
SUBJECT: 2 to 6 words, lowercase, a noun phrase that NAMES the post or angle${agency ? ` and the creator, like: ${ph.agencySubject}` : `, like: ${ph.subject}`}. Never words like demand, opportunity, idea or question
P1: ...
P2: ...
P3: ...
WA1: ...
WA2: ...`;
}

const TIER_NAME = { 1: 'caption offered something for an action and people answered', 2: 'one post far above their usual', 3: 'they already offer something', 4: 'no demand evidence, observation only' };

export function buildWriterInput(intel, creator) {
  const ev = intel.facts.evidence.find(e => e.ref === 'post');
  const offer = intel.facts.evidence.find(e => e.ref === 'bio_or_links');
  const r = intel.read || {};
  const facts = [];
  if (ev) {
    const marks = [];
    const isSignal = intel.tier === 1 || intel.tier === 2;
    if (isSignal && ev.multiple && ev.multiple >= 2) marks.push(`x${ev.multiple} usual comments`);
    if (isSignal && ev.likesMultiple && ev.likesMultiple >= 2) marks.push(`x${ev.likesMultiple} usual likes`);
    // Tier 3 and 4: the post is what we OBSERVED, not proof of demand, so its
    // numbers are withheld and may not be cited.
    facts.push(isSignal
      ? `post: a ${postKind(ev.postType)} (the format, not a title), comments=${ev.value}${ev.likes > 0 ? `, likes=${ev.likes}` : ''}${marks.length ? ` (${marks.join(', ')})` : ''}`
      : `post: a ${postKind(ev.postType)} (the format, not a title). Its engagement is NOT a demand signal, so cite no numbers or multiples for it`);
    facts.push(`caption: ${JSON.stringify(ev.caption)}`);
    if (ev.quote) facts.push(`the part we are pointing at: ${JSON.stringify(ev.quote)}`);
    if (ev.comments?.length) facts.push(`comments seen on that post, the newest ${ev.comments.length}, real and quotable: ${ev.comments.map(c => JSON.stringify(c)).join(' | ')}`);
  }
  if (offer) facts.push(`already offers, as written on their profile: ${JSON.stringify(offer.quote)}`);
  facts.push(`bio: ${JSON.stringify(intel.facts.bio)}`);
  if (intel.facts.links.length) facts.push(`links in bio: ${intel.facts.links.join(' | ')}`);
  facts.push(`followers: ${intel.facts.followers}`);
  const reading = [
    r.niche && `niche: ${r.niche}`, r.audience && `audience: ${r.audience}`, r.expertise && `expertise: ${r.expertise}`,
    `monetization seen: free = ${r.free || 'none found'}; paid = ${r.paid || 'none found'}; needs their time = ${r.timeBound || 'none found'}`,
    r.postGist && `what the post does: ${r.postGist}`, r.signal && `signal: ${r.signal}`, r.why && `why it matters: ${r.why}`,
    r.gap && `gap: ${r.gap}`, r.angle && `angle: ${r.angle}`, r.assumptions && `we are assuming: ${r.assumptions}`,
    r.direction && `INTERNAL, never reveal: ${r.direction}`,
  ].filter(Boolean);
  const isAgency = intel.facts.contact?.email?.kind === 'agency';
  return `WRITE EVERY FIELD IN: ${LANG_NAME[intel.language] || 'English'}. The notes below are in English only because they are internal; your output is not.
${isAgency ? `READER: the creator's manager or agency, NOT the creator. Third person only ("${intel.firstName || 'the creator'}'s post", "her audience"), never "you" or "your" for the creator.\n` : ''}CREATOR: ${plain(creator?.name)}${intel.firstName ? ` (first name ${intel.firstName})` : ''}
TIER: ${intel.tier}, ${TIER_NAME[intel.tier] || ''}

VERIFIED FACTS
- ${facts.join('\n- ')}

OUR READING
- ${reading.join('\n- ')}`;
}

// ── Checking the writer's work (code, not prompt) ────────────────────────────
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
  /\bunlock/i, /\bmaximi[sz]e/i, /monetization potential/i, /monetization ecosystem/i, /high converting/i, /game.?changer/i, /\bleverage\b/i, /next level/i,
  /discovery call/i, /strategy session/i, /book a demo/i, /sales call/i,
  /\bis gold\b/i, /\bé ouro\b/i, /\bes oro\b/i, /\bmomentum\b/i,
  // agency jargon, in any of the four languages
  /\bfunnel\b/i, /\bembudo\b/i, /\bfunil\b/i, /\bconversi[oó]n\b/i, /\bconversão\b/i, /\bconversion\b/i, /\bfricci[oó]n\b/i, /\bfricção\b/i, /\bfriction\b/i,
];

// Stylistic dashes become commas. Grammatical hyphens (diz-me, Gómez-Chao) have
// no spaces around them and are left alone. Colons are allowed.
export function cleanPunctuation(text) {
  return String(text || '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\b1:1\b/g, '1 to 1')
    .replace(/[ \t]*[—–][ \t]*/g, ', ')
    .replace(/[ \t]+-[ \t]+/g, ', ')
    .replace(/[()]/g, '')
    .replace(/[!¡]/g, (c) => (c === '!' ? '.' : ''))
    .replace(/,\s*,/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function checkCopy(draft, intel) {
  const problems = [];
  const ev = intel.facts.evidence.find(e => e.ref === 'post');
  if (!ev) return ['intel has no post evidence'];
  const offer = intel.facts.evidence.find(e => e.ref === 'bio_or_links');
  const parts = intel.tier === 4 ? ['p1'] : ['p1', 'p2', 'p3'];
  const waParts = intel.tier === 4 ? ['wa1'] : ['wa1', 'wa2'];
  const body = [...parts, ...waParts].map(k => draft[k]).join(' ');

  // Every number in the copy must exist in the verified facts.
  const allowed = new Set(['1']);
  const addNums = (s) => (String(s || '').match(/\d+(?:[.,]\d+)*/g) || []).forEach(n => allowed.add(n.replace(/[.,]/g, '')));
  addNums(ev.caption); addNums(intel.facts.bio); addNums(offer?.quote); addNums(intel.facts.links.join(' '));
  [ev.value, ev.likes, intel.facts.followers].forEach(v => allowed.add(String(v)));
  // Follower counts are written "173K" or "1.2M" as often as in full.
  const fol = Number(intel.facts.followers) || 0;
  if (fol >= 1000) [Math.floor(fol / 1000), Math.round(fol / 1000)].forEach(v => allowed.add(String(v)));
  if (fol >= 1e6) [Math.floor(fol / 1e5) / 10, Math.round(fol / 1e5) / 10, Math.floor(fol / 1e6)].forEach(v => allowed.add(String(v).replace('.', '')));
  const maxX = Math.floor(Math.max(ev.multiple || 0, ev.likesMultiple || 0));
  for (let k = 2; k <= maxX; k += 1) allowed.add(String(k));
  for (const x of [ev.multiple, ev.likesMultiple]) if (x) allowed.add(String(x).replace(/[.,]/g, ''));
  const real = [...allowed].map(Number).filter(v => Number.isFinite(v) && v >= 100);
  for (const n of (body.match(/\d+(?:[.,]\d+)*/g) || [])) {
    const v = n.replace(/[.,]/g, '');
    if (allowed.has(v)) continue;
    const num = Number(v);
    if (num >= 100 && real.some(r => Math.abs(r - num) / r <= 0.05)) continue; // "nearly 14,000" for 13,994
    problems.push(`number not in the facts: ${n}`);
  }

  // A claimed multiple must belong to the metric the sentence names.
  for (const sentence of body.split(/(?<=[.?!])\s+/)) {
    const claims = [];
    for (const [re, x] of MULTIPLE_WORDS) if (re.test(sentence)) claims.push(x);
    for (const m of sentence.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:times|x\b|vezes|veces)/gi)) claims.push(parseFloat(m[1].replace(',', '.')));
    if (!claims.length) continue;
    const onComments = /comment|coment/i.test(sentence);
    const onLikes = /\blikes?\b|gostos|me gusta/i.test(sentence);
    const have = onComments && !onLikes ? (ev.multiple || 0) : onLikes && !onComments ? (ev.likesMultiple || 0) : Math.max(ev.multiple || 0, ev.likesMultiple || 0);
    const claimed = Math.max(...claims);
    if (claimed > have + 0.5) problems.push(`claims x${claimed} ${onComments ? 'comments' : onLikes ? 'likes' : 'response'}, facts show x${have}`);
  }

  if (intel.tier >= 3 && /\d\s*(comments|comentarios|comentários|likes)|(times|veces|vezes)\b.{0,25}(usual|habitual)/i.test(body)) {
    problems.push('cites engagement numbers, but this tier has no demand signal');
  }
  // Wrong language: the reading handed to the writer is in English, and the
  // model sometimes answers in it. Cheap stop-word count, only for non-English.
  if (intel.language !== 'en') {
    const hits = (body.match(/\b(the|and|your|you|that|with|this|there|their|what|from)\b/gi) || []).length;
    if (hits >= 6) problems.push(`written in English, must be ${LANG_NAME[intel.language] || intel.language}`);
    // The prompt's English scaffolding ("I also noticed", "I think") leaks into
    // the first words of a paragraph even when the rest is in the right language.
    if (/\b(I also noticed|I think|I liked|stood out to me|I noticed)\b/i.test(body)) problems.push(`English phrase inside ${LANG_NAME[intel.language] || intel.language} copy`);
  }
  // Counting commenters is the model doing arithmetic on the sample we showed
  // it. A count is only ever the post's comment total.
  if (/\b\d+\s+(people|persons|commenters|pessoas|personas|comentaristas)\b/i.test(body)) problems.push('counts people from the comments seen; only the post total is a number');
  // A manager reads this inbox: the creator is "she / Laura", never "you".
  if (intel.facts.contact?.email?.kind === 'agency') {
    const local = { es: /\b(tú|tu|tus|te|ti|contigo)\b/i, pt: /\b(tu|teu|tua|teus|tuas|te|ti|contigo)\b/i, br: /\b(você|vocês)\b/i }[intel.language];
    const you = { test: (t) => /\b(you|your|yours)\b/i.test(t) || (local ? local.test(t) : false) };
    for (const k of parts) if (you.test(String(draft[k] || ''))) { problems.push(`${k} addresses the creator directly, but the reader is their manager: write in the third person`); break; }
  }
  // Anything in straight quotes must exist somewhere in the facts: the caption,
  // the bio, the links, the offer, or a comment we actually saw.
  {
    const hay = [ev.caption, ev.quote, offer?.quote, intel.facts.bio, intel.facts.links.join(' '), ...(ev.comments || [])].map(fold).join(' \n ');
    for (const m of body.matchAll(/"([^"]{3,120})"/g)) {
      const q = fold(m[1]);
      if (!q) continue;
      const words = q.split(' ').filter(w => w.length > 2);
      const ok = hay.includes(q) || (words.length > 0 && words.filter(w => hay.includes(w)).length / words.length >= 0.8);
      if (!ok) problems.push(`quoted text not in the facts: "${m[1]}"`);
    }
  }
  for (const re of BANNED) if (re.test(`${body} ${draft.subject}`)) problems.push(`banned phrase: ${re.source}`);
  for (const k of parts) {
    const w = String(draft[k] || '').trim().split(/\s+/).filter(Boolean).length;
    if (w < 8) problems.push(`${k} too short`);
    if (w > 75) problems.push(`${k} too long (${w} words)`);
  }
  for (const k of waParts) {
    const w = String(draft[k] || '').trim().split(/\s+/).filter(Boolean).length;
    if (w < 5) problems.push(`${k} missing`);
    if (w > 45) problems.push(`${k} too long for WhatsApp (${w} words)`);
  }
  const subj = String(draft.subject || '').trim();
  if (!subj) problems.push('no subject');
  else {
    // The subject names the post. It never sells or editorialises.
    if (subj.split(/\s+/).length > 8) problems.push('subject too long, 2 to 6 words');
    const names = { en: /^your\b/i, pt: /^(o teu|a tua|os teus|as tuas)\b/i, br: /^(o seu|a sua|os seus|as suas|seu|sua|seus|suas)\b/i, es: /^(tu|tus)\b/i }[intel.language];
    if (names && intel.facts.contact?.email?.kind !== 'agency' && !names.test(subj)) problems.push('subject must be a noun phrase that names the post and starts with the possessive (your / o teu, a tua / seu, sua / tu), because the follow-ups say "my note about <subject>"');
    if (/\b(demand|opportunity|idea|ideas|question|procura|oportunidade|ideia|ideias|demanda|oportunidad|pergunta|pregunta)\b/i.test(subj)) problems.push('subject must only name the post or angle, no words like demand, opportunity or idea');
  }
  return problems;
}

const W_FIELDS = ['SUBJECT', 'P1', 'P2', 'P3', 'WA1', 'WA2'];

export function parseCopy(text) {
  const raw = String(text || '');
  const re = new RegExp(`^[ \\t>*#-]*(${W_FIELDS.join('|')})[ \\t]*:[ \\t]*`, 'gim');
  const marks = [];
  let m;
  while ((m = re.exec(raw))) marks.push({ key: m[1].toUpperCase(), at: m.index, from: re.lastIndex });
  if (!marks.length) return null;
  const v = {};
  marks.forEach((k, i) => { if (!(k.key in v)) v[k.key] = raw.slice(k.from, i + 1 < marks.length ? marks[i + 1].at : raw.length).trim(); });
  const unwrap = (x) => (/^"[^"]*"$/.test(x || '') ? x.slice(1, -1).trim() : (x || ''));
  if (!v.P1) return null;
  return { subject: unwrap(v.SUBJECT), p1: v.P1 || '', p2: v.P2 || '', p3: v.P3 || '', wa1: v.WA1 || '', wa2: v.WA2 || '' };
}

export function buildRetryMessage(problems) {
  return `Your draft failed these checks:\n- ${problems.join('\n- ')}\n\nFix it in the same output format, using only the VERIFIED FACTS. If a claim cannot be supported, drop the claim rather than soften the number.`;
}

// ── Assembly (code adds every fixed part) ────────────────────────────────────
export function assemble(draft, intel, creator, { sender = SENDER_FIRST_NAME } = {}) {
  const key = FIXED[intel.language] ? intel.language : 'en';
  const f = FIXED[key];
  const name = plain(intel.firstName || '') || null;
  const full = plain(creator?.name) || name || '';
  const subject = cleanPunctuation(draft.subject || '').replace(/[.,]+$/, '');
  const topic = subject;
  const sign = `${f.signoff}\n${sender}`;
  const [p2, p3] = intel.tier === 4 ? ASK_BLOCK[key] : [cleanPunctuation(draft.p2), cleanPunctuation(draft.p3)];
  const isAgency = intel.facts.contact?.email?.kind === 'agency';

  let day1; let day7; let day14;
  if (isAgency) {
    const a = AGENCY[key];
    day1 = [a.greet, a.intro(full), cleanPunctuation(draft.p1), p2, p3, f.credibility, a.ask, a.close, sign].join('\n\n');
    day7 = `${a.day7(full, name || full, topic)}\n${sender}`;
    day14 = `${a.day14(full, name || full, topic)}\n${sender}`;
  } else {
    day1 = [f.greet(name), cleanPunctuation(draft.p1), p2, p3, f.credibility, f.ask, f.close, sign].join('\n\n');
    day7 = `${f.day7(name, topic)}\n${sender}`;
    day14 = `${f.day14(name, topic)}\n${sender}`;
  }

  // WhatsApp: provenance aware. The source line appears only when code verified
  // where the creator publishes the number; otherwise nothing is claimed.
  const w = WHATSAPP[key];
  const phone = intel.facts.contact?.phone;
  const sourceLine = !phone?.verified ? null
    : phone.status === 'public_website' ? WA_SOURCE[key].website
    : /whatsapp link/i.test(phone.detail || '') ? WA_SOURCE[key].link : WA_SOURCE[key].number;
  const whatsapp = [w.greet(name), sourceLine, cleanPunctuation(draft.wa1), intel.tier === 4 ? w.ask4 : cleanPunctuation(draft.wa2), w.close].filter(Boolean).join('\n\n');

  return {
    copyKey: key, recipient: isAgency ? 'agency' : 'creator',
    whatsapp, whatsappSource: phone ? { status: phone.status, verified: !!phone.verified, detail: phone.detail, disclosed: !!sourceLine } : null,
    email_day1: { subject, body: day1 },
    email_day7: { subject, body: day7 },
    email_day14: { subject, body: day14 },
  };
}
