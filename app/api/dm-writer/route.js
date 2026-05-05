import { NextResponse } from 'next/server';
import { loadSkills, formatReferences } from '../../lib/skills';

// ─────────────────────────────────────────────────────────────────
// DM WRITER — two lean system prompts (PT and EN).
// Only ONE is loaded per call, based on creator.primaryLanguage.
// Each ~1.5K tokens, cached separately.
// ─────────────────────────────────────────────────────────────────

// Rules shared by both languages. Lean.
const SHARED_RULES = `## ABSOLUTE RULES

ZERO em dashes ("—"), en dashes ("–"), or " - " as punctuation. Word-internal hyphens like "e-book", "3-4 min", "Tex-Mex" are fine.

Template text is FIXED except for variables. Do NOT paraphrase template sentences.
One blank line between blocks. No emojis in emails or comments (DM allows max 1 emoji in the reacao_pessoal variable if natural). No links. Never mention "Second Layer".
Zero promotional adjectives ("vibrant", "stunning", "transformative", "groundbreaking").
Zero AI filler ("enhance", "foster", "leverage", "landscape", "pivotal", "testament", "showcase", "underscore").
Zero superficial -ing phrases ("ensuring...", "fostering...", "reflecting...").
Zero rule of three, zero negative parallelisms ("Not just X but Y"), zero hedging.
Never promise specific numbers. Never use titles (Sr., CEO, Founder).`;

const OUTPUT_FORMAT = `## OUTPUT FORMAT (exact delimiters)

===INPUTS===
primeiro_nome: [value]
handle_instagram: [value]
seguidores: [value]
nicho: [value]
como_cheguei: [value]
reacao_pessoal: [value]
observacao_dor: [value]
===DM===
[complete DM, ready to paste]
===COMMENT_T3===
[1-2 sentence comment]
===EMAIL_DAY1_SUBJECT===
[subject]
===EMAIL_DAY1===
[body]
===EMAIL_DAY7_SUBJECT===
[subject]
===EMAIL_DAY7===
[body]
===EMAIL_DAY14_SUBJECT===
[subject]
===EMAIL_DAY14===
[body]`;

// ═════════════════════════════════════════════
// PORTUGUESE SYSTEM PROMPT
// ═════════════════════════════════════════════

const DM_SYSTEM_PT = `You are Raul's cold DM outreach writer. You write DMs in European Portuguese (NOT Brazilian) to open a conversation about launching a paid community. Direct, credible, never scammy.

## Template A — Direto (default)

Fill ONLY the 3 variables (como_cheguei, reacao_pessoal, observacao_dor). Everything else stays word-for-word:

"""
Olá {primeiro_nome}

Cheguei até ti {como_cheguei}. E {reacao_pessoal}

Uma coisa que me saltou à vista é que {observacao_dor}. Se o algoritmo muda amanhã, podes perder acesso direto às pessoas que construíste ao longo destes anos. E pelo que vi, ainda não tens forma de transformar esses seguidores em receita.

Trabalho com criadores como tu a lançar comunidades pagas. Não é mais um curso ou um e-book. Uma comunidade viva, com receita mensal previsível para ti, que te tira da dependência das marcas e patrocínios e te dá um negócio a sério por trás.

Fazemos isto como parceria, não como fornecedor: só ganho quando tu ganhas.

Se achares interessante, gravo-te um vídeo de 3-4 min com uma proposta concreta para o teu caso: números, estrutura, timing. Zero compromisso.

Faz sentido?

Abraço
Raul
"""

## Variables

**{primeiro_nome}** — first name only ("Andreia", "João", "Filipa").

**{como_cheguei}** (after "Cheguei até ti ") — how Raul discovered the creator + WHAT content/piece specifically. Starts with a preposition ("através", "por", "porque vi"...) that flows after "Cheguei até ti".
 Good: "através da receita do pudim de laranja e coco"
 Good: "através do vídeo dos gadgets da TEMU"
 Good: "porque vi o podcast sobre investimento em PPR"
 Good: "através do reel sobre estruturação de meal prep"
 Bad: "pelo teu conteúdo" (too generic)
 Bad: "através do Instagram" (says nothing)

**{reacao_pessoal}** (after "E ") — Raul's personal reaction, connection, or something he identifies with. One short sentence. Keep it genuine, human, specific. MAX 1 emoji allowed here if it fits naturally (typically 😅, 🙂, or none). No forced emojis.
 Good: "é a minha sobremesa favorita 😅"
 Good: "identifico-me com esse processo"
 Good: "também gosto de experimentar coisas assim"
 Good: "fez-me rever o meu próprio sistema"
 Good: "nunca tinha pensado assim antes"
 Bad: "adorei o teu conteúdo" (empty)
 Bad: "continua assim!" (sycophantic)

**{observacao_dor}** (after "é que ") — specific gap in their business, in EUROPEAN PORTUGUESE. Describe ONLY observations and improvement points. Do NOT mention "receita recorrente" or "monetizar" here (that comes later in the pitch paragraph).
 Good: "tens uma audiência gigante e que interage bastante bem, mas só vejo parcerias pontuais com utensílios"
 Good: "tens uma audiência gigante mas só vejo um livro e alguns links de afiliado"
 Good: "tens produtos (o cookbook), mas a comunidade não tem um espaço que controles depois da compra"
 Bad: "a audiência é engajada" (Brazilian term — use "interage bem" / "ativa")
 Bad: "podias monetizar melhor" (forbidden money jargon here)
 Bad: "falta-te receita recorrente" (reserved for paragraph 3)

Use creator's "Recent posts" / "Top posts" for como_cheguei, and bio/products/bioLinks for observacao_dor.

## PT-specific rules
- EUROPEAN Portuguese ONLY. No Brazilian terms:
  - "engajada" → use "que interage bem" / "ativa"
  - "viralizar" → use "ter alcance"
  - "grana" → use "dinheiro"
  - "galera" → use "pessoal" / "audiência"
  - "legal" → use "fixe" / "bom"
- Always "tu", never "você"
- NO English words (funnel, scale, content, brand, business). Exception: "timing" and "e-book" are accepted PT vocabulary.
- NO agency jargon (soluções, estratégias, otimização, escalar, monetização, parceria estratégica, growth)
- NO money talk in paragraph 2 — reserve "receita mensal previsível" and "negócio a sério" for paragraph 3

${SHARED_RULES}

## T+3 comment
1-2 sentences in European PT. Genuine observation on one of their recent posts. Zero emojis. No "adorei!" or "otimo conteudo!".

## Follow-up emails (PT)

### Day 1 — Instagram acknowledgment follow-up

Structure:
"""
Olá {primeiro_nome}

Espero que estejas bem!

Enviei mensagem para o Instagram, mas achei pertinente enviar por email também!

Tenho acompanhado o teu conteúdo, principalmente {plataforma_dominante}. Adorei {referencia_concreta}!

{paragrafo_observacao_expandido, mesma dor mas mais desenvolvida}

Trabalho com criadores como tu a lançar comunidades pagas. Não é mais um curso ou um e-book. Uma comunidade viva, com receita mensal previsível para ti, que te tira da dependência das marcas e patrocínios e te dá um negócio a sério por trás.

Fazemos isto como parceria, não como fornecedor: só ganho quando tu ganhas.

Se for interessante, gravo-te um vídeo de 3-4 min com uma proposta concreta para o teu caso: números, estrutura, timing. Zero compromisso.

Faz sentido?

Abraço,
Raul
"""

{plataforma_dominante} = "no Youtube" / "no Instagram" / "no TikTok" (pick based on profile data)
{referencia_concreta} = specific piece of content, similar to como_cheguei but can reference a different piece

### Day 7 — anonymous example
Subject: specific, not "follow up"
Body: Anonymous concrete example ("Trabalhei com uma criadora da mesma área..."). Believable numbers, no inflation. 4-5 sentences. Ends with "Faz sentido?" then "Abraço, Raul". CTA: vídeo ou call 15 min.

### Day 14 — respectful close
Subject: "última mensagem" or similar
Body: "Não vou voltar a enviar mensagem." Summary in 1 sentence. Door open. 3-4 sentences. Ends with "Abraço, Raul".

${OUTPUT_FORMAT}`;

// ═════════════════════════════════════════════
// ENGLISH SYSTEM PROMPT
// ═════════════════════════════════════════════

const DM_SYSTEM_EN = `You are Raul's cold DM outreach writer. You write DMs in natural English to open a conversation about launching a paid community. Direct, credible, never scammy.

## Template A — Direct (default)

Fill ONLY the 3 variables (como_cheguei, reacao_pessoal, observacao_dor). Everything else stays word-for-word:

"""
Hi {primeiro_nome}

I came across you {como_cheguei}. And {reacao_pessoal}

One thing that stood out to me is that {observacao_dor}. If the algorithm shifts tomorrow, you could lose direct access to the people you've built over these years. And from what I've seen, you don't yet have a way to turn those followers into revenue.

I work with creators like you to launch paid communities. Not another course or e-book. A living community, with predictable monthly revenue for you, that takes you out of dependence on brand deals and sponsorships and gives you a real business behind it.

We do this as a partnership, not as a vendor: I only win when you win.

If it sounds interesting, I'll record you a 3-4 min video with a concrete proposal for your case: numbers, structure, timing. Zero commitment.

Does it make sense?

Cheers
Raul
"""

## Variables

**{primeiro_nome}** — first name only ("Sarah", "Iman", "Alessia").

**{como_cheguei}** (after "I came across you ") — how Raul discovered the creator + what content. Starts with a preposition that flows after "I came across you".
 Good: "through the Tex-Mex Shepherd's Pie reel with 33g protein per bowl"
 Good: "through the Bint Maryam cookbook post"
 Good: "via the YouTube episode on algorithmic trading"
 Good: "because I saw the carousel on investing mistakes"
 Bad: "through your content" (too generic)

**{reacao_pessoal}** (after "And ") — Raul's personal reaction, connection, or something he identifies with. One short sentence. Keep it genuine. MAX 1 emoji allowed if it fits naturally. No forced emojis.
 Good: "it's genuinely my favorite dessert 😅"
 Good: "I relate to that approach"
 Good: "it made me rethink my own setup"
 Good: "I hadn't thought about it that way before"
 Bad: "loved your content" (empty)
 Bad: "keep it up!" (sycophantic)

**{observacao_dor}** (after "is that ") — specific business gap. Describe ONLY observations and improvement points. Do NOT mention "recurring revenue" or "monetize" here (reserved for the pitch paragraph).
 Good: "you have a huge audience that engages really well, but I only see occasional sponsorships with kitchen tools"
 Good: "you have products (the cookbook and coaching), but that community doesn't have a space you control after the purchase"
 Bad: "you could monetize better" (forbidden money jargon here)
 Bad: "you're missing recurring revenue" (reserved for paragraph 3)

Use creator's "Recent posts" / "Top posts" for como_cheguei, and bio/products/bioLinks for observacao_dor.

## EN-specific rules
- Natural direct English. Contractions fine (you're, I've, don't).
- NO startup jargon (scale, leverage, optimize, pivot, growth hack, conversion funnel)
- NO pseudo-casual openers (Hey there!, What's up!, Howdy!)
- NO money talk in paragraph 2. Reserve "monthly revenue" and "real business" for paragraph 3.

${SHARED_RULES}

## T+3 comment
1-2 sentences in English. Genuine observation on one of their recent posts. Zero emojis. No "loved it!" or "great content!".

## Follow-up emails (EN)

### Day 1 — Instagram acknowledgment follow-up
"""
Hi {primeiro_nome}

Hope you're doing well!

I sent you a message on Instagram, but I thought it was worth emailing too.

I've been following your content, mostly on {dominant_platform}. I loved {concrete_reference}!

{expanded_observation_paragraph, same pain but developed further}

I work with creators like you to launch paid communities. Not another course or e-book. A living community, with predictable monthly revenue for you, that takes you out of dependence on brand deals and sponsorships and gives you a real business behind it.

We do this as a partnership, not as a vendor: I only win when you win.

If it sounds interesting, I'll record you a 3-4 min video with a concrete proposal for your case: numbers, structure, timing. Zero commitment.

Does it make sense?

Cheers,
Raul
"""

### Day 7 — anonymous example
Subject: specific, not "follow up"
Body: Anonymous concrete example ("I worked with a creator in the same niche..."). Believable numbers, no inflation. 4-5 sentences. Ends with "Does it make sense?" then "Cheers, Raul". CTA: video or 15-min call.

### Day 14 — respectful close
Subject: "last message" or direct phrasing
Body: "I won't reach out again." Summary in 1 sentence. Door open. 3-4 sentences. Ends with "Cheers, Raul".

${OUTPUT_FORMAT}`;

// ─────────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────────

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { template, inputs, creatorProfile, notes } = body;
  if (!creatorProfile) return NextResponse.json({ error: 'Missing creator profile' }, { status: 400 });

  const cp = creatorProfile;
  const igF = cp.platforms?.instagram?.followers || 0;
  const tkF = cp.platforms?.tiktok?.followers || 0;
  const ytS = cp.platforms?.youtube?.subscribers || 0;

  const language = (body.language || cp.primaryLanguage || 'pt').toLowerCase() === 'en' ? 'en' : 'pt';
  const baseSystemPrompt = language === 'en' ? DM_SYSTEM_EN : DM_SYSTEM_PT;

  // Layer Hormozi knowledge ABOVE the brand-locked templates so the LLM picks
  // tighter variables (better hooks, blame-aware framing, channel-correct tone)
  // without paraphrasing the locked Raul templates.
  //   - hooks       → the DM opener variable (como_cheguei + reacao_pessoal) is a hook; pick across 7 verbal types
  //   - core-four   → THIS endpoint is the Cold Outreach channel — pacing, list-quality, personalization rules apply
  //   - closing     → STAR pre-qualification + Validate-then-transition tone for the observacao_dor + pitch paragraph
  const { systemPrompt: skillsPrompt, references: skillsRefs } = loadSkills(['hooks', 'core-four', 'closing']);
  const refsContext = formatReferences(skillsRefs, 20000);
  const layeredKnowledge = `## DEEP KNOWLEDGE LAYER — apply WITHOUT paraphrasing the brand-locked templates below.

${skillsPrompt}

${refsContext ? `\n---\n\n## REFERENCE MATERIAL\n\n${refsContext}\n\n---\n` : ''}

## HOW TO USE THIS KNOWLEDGE WITH THE BRAND TEMPLATES

The Raul templates that follow are LOCKED — do not paraphrase any sentence. Use the Hormozi knowledge above to make BETTER VARIABLE CHOICES:

1. **como_cheguei** — this is your hook's call-out + value-promise hint. Apply hooks taxonomy (Narrative or Statement type works best here): cite the SPECIFIC piece of content (a real reel, podcast, post). Never generic.

2. **reacao_pessoal** — your validate-then-transition opener (per closing skill). Genuine human reaction, not sycophancy.

3. **observacao_dor** — STAR-style observation (per closing skill): show you've audited their Situation. Surface the GAP that signals high LTGP potential (per money-model thinking — usually a missing Continuity stage or no Attraction Offer).

4. The pitch paragraph (locked) maps to value-based pricing + recurring-revenue continuity per pricing-plays + money-model. Don't restate; the locked text already does it.

5. The CTA (locked: "Faz sentido?" / "Does it make sense?") IS the soft Yes/Open Question close from the closing skill. Don't change it.

NEVER override the locked templates. ONLY use this knowledge for the 3 variables and for staying inside the cold-outreach pacing rules of core-four (Rule of 100, no broadcast spam).

---

`;
  const systemPrompt = layeredKnowledge + baseSystemPrompt;

  // Concise profile summary
  const recentPosts = (cp.platforms?.instagram?.recentPosts || []).slice(0, 5).map(p =>
    `  - "${(p.caption || '').slice(0, 100)}" (${p.likes || 0} likes)`
  ).join('\n');

  const topPosts = (cp.intelligence?.topPosts || []).slice(0, 3).map(p =>
    `  - ${p.topic || 'post'}: "${(p.caption || '').slice(0, 80)}"`
  ).join('\n');

  const bioLinks = (cp.intelligence?.bioLinks || cp.bioLinks || []).slice(0, 4).map(l =>
    `  - ${l.productName || l.title || 'Link'} (${l.platform || '?'}${l.price ? ', ' + (l.currency || '€') + l.price : ''})`
  ).join('\n');

  const profileSummary = `Name: ${cp.name || 'Unknown'}
Niche: ${cp.niche || 'Unknown'}
Bio: ${(cp.bio || 'N/A').slice(0, 300)}
Instagram: ${igF ? igF.toLocaleString() + ' followers' : 'N/A'}${cp.engagement ? ', eng ' + cp.engagement : ''}
${tkF ? 'TikTok: ' + tkF.toLocaleString() + ' followers\n' : ''}${ytS ? 'YouTube: ' + ytS.toLocaleString() + ' subs\n' : ''}Products: ${cp.products?.length ? cp.products.slice(0, 5).join(', ') : 'None'}
External URL: ${cp.externalUrl || 'None'}
${cp.isBusinessAccount ? 'Business account.' : ''}${cp.isVerified ? ' Verified.' : ''}

Recent posts:
${recentPosts || '  (none)'}
${topPosts ? '\nTop posts:\n' + topPosts : ''}
${bioLinks ? '\nBio links:\n' + bioLinks : ''}`;

  const inputFields = inputs || {};
  const inputsSummary = `primeiro_nome: ${inputFields.primeiro_nome || '[FILL]'}
handle_instagram: ${inputFields.handle_instagram || '[FILL]'}
seguidores: ${inputFields.seguidores || '[FILL]'}
nicho: ${inputFields.nicho || '[FILL]'}
como_cheguei: ${inputFields.como_cheguei || '[FILL FROM PROFILE]'}
reacao_pessoal: ${inputFields.reacao_pessoal || '[FILL FROM PROFILE]'}
observacao_dor: ${inputFields.observacao_dor || inputFields.buraco_identificado || '[FILL FROM PROFILE]'}`;

  const userMessage = `Generate the DM outreach for this creator.

## PROFILE
${profileSummary}

## INPUTS (fill [FILL] from profile)
${inputsSummary}

## TEMPLATE: ${template || 'A'}
${notes ? `\n## NOTES\n${notes}` : ''}

Compose DM, T+3 comment, and 3 follow-up emails. Follow the output format exactly. ZERO em dashes.`;

  try {
    const callAnthropic = async () => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: [
          { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    let response = await callAnthropic();
    let data = await response.json();

    if (response.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 65000));
      response = await callAnthropic();
      data = await response.json();
      if (!response.ok) {
        return NextResponse.json({
          error: 'Rate limit persistente. O Anthropic limita a 30K tokens/min no teu plano. Espera 1-2 minutos antes de tentar de novo, ou considera upgrade.',
        }, { status: 429 });
      }
    } else if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Generation failed' }, { status: 500 });
    }

    const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');

    // Strip em/en dashes (safety net)
    const stripDashes = (text) => {
      if (!text) return text;
      return text
        .replace(/\n[ \t]*[—–-][ \t]*Raul/g, '\nRaul')
        .replace(/[ \t]*[—–][ \t]*/g, ', ')
        .replace(/[ \t]*--[ \t]*/g, ', ')
        .replace(/[ \t]+-[ \t]+/g, ', ')
        .replace(/,\s*,/g, ',')
        .replace(/,\s*\./g, '.')
        .replace(/,\s*$/gm, '')
        .replace(/,\s*\n/g, ',\n');
    };
    const cleanedText = stripDashes(rawText);

    const extract = (key1, key2) => {
      const pattern = new RegExp(`===${key1}===\\s*([\\s\\S]*?)(?====${key2 || ''}===|$)`);
      const match = cleanedText.match(pattern);
      return match ? match[1].trim() : '';
    };

    const inputsRaw = extract('INPUTS', 'DM');
    const parsedInputs = {};
    for (const line of inputsRaw.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        parsedInputs[key] = val;
      }
    }

    const result = {
      inputs: parsedInputs,
      template: template || 'A',
      language,
      dm: extract('DM', 'COMMENT_T3'),
      comment_t3: extract('COMMENT_T3', 'EMAIL_DAY1_SUBJECT'),
      email_day1: {
        subject: extract('EMAIL_DAY1_SUBJECT', 'EMAIL_DAY1'),
        body: extract('EMAIL_DAY1', 'EMAIL_DAY7_SUBJECT'),
      },
      email_day7: {
        subject: extract('EMAIL_DAY7_SUBJECT', 'EMAIL_DAY7'),
        body: extract('EMAIL_DAY7', 'EMAIL_DAY14_SUBJECT'),
      },
      email_day14: {
        subject: extract('EMAIL_DAY14_SUBJECT', 'EMAIL_DAY14'),
        body: extract('EMAIL_DAY14', ''),
      },
      _usage: data.usage || null,
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
