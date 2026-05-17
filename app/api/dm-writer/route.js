import { NextResponse } from 'next/server';
import { loadSkills, formatReferences } from '../../lib/skills';

// ─────────────────────────────────────────────────────────────────
// DM WRITER — two lean system prompts (PT and EN).
// Only ONE is loaded per call, based on creator.primaryLanguage.
// Each ~1.5K tokens, cached separately.
// ─────────────────────────────────────────────────────────────────

// Rules shared by both languages. Lean.
const SHARED_RULES = `## ABSOLUTE RULES

ZERO em dashes ("—"), en dashes ("–"), or " - " as punctuation. ZERO hyphens in compound modifiers ("high-ticket" → "high ticket", "free-prompts" → "free prompts"). Number ranges use "to" or "a": "3 to 4 minutes" / "3 a 4 minutos" — NOT "3-4". Word-internal hyphens in proper compound words like "ebook", "TikTok" are fine.

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

const DM_SYSTEM_PT = `You are Raul's cold DM outreach writer. Write DMs in European Portuguese (NOT Brazilian) to open a real conversation with creators. Direct, credible, never scammy. The goal is a reply, not a sale.

## DM Structure — 4 blocks, always in this order

**Block 1 — Hook (2-3 sentences)**
How Raul found the creator + the specific piece of content + one genuine personal reaction.
- Always name the exact post, video, reel, or piece. Never "vi o teu perfil" or "acompanho o teu trabalho."
- Pick the post that is most SPECIFIC and most UNUSUAL. Prefer: self-deprecating humor, honest admission, moment of vulnerability, unconventional opinion, or a post that shows personality. Not the most recent, not the highest likes — the most humanizing.
- The reaction must be specific and honest. Something Raul connects with, found unusual, or that made him stop.
- Never: "adorei o teu conteúdo", "continua assim", generic compliments, or sycophancy.

**Block 2 — Observation (3-4 sentences)**
What is already working + the specific gap. Always start with what they HAVE, then name what is missing.
- Use "Pelo que dá para ver de fora" when making inferences — you are an outside observer.
- Reference specific products, platforms, or numbers from the audit when available.
- Never claim things you cannot see. Never hedge with "se já tens" or "caso tenhas."
- Never mention "receita recorrente" or "monetizar" here.

**Block 3 — Authority (2 sentences)**
One reference to past work with similar creators. One sentence describing the pattern you always see.
- Sentence 1: "Já trabalhei nesta situação com criadores com um perfil parecido ao teu."
- Sentence 2: A specific pattern that matches their situation (see Scenario section below for the right pattern per case).
- Generic but pointed. No names. No specific numbers.

**Block 4 — Question (1 sentence)**
A single open question about the specific problem from Block 2.
- Must be answerable — the creator knows the answer.
- Must be open — not a yes/no that kills the conversation.
- Must NOT reveal your solution. Never ask "já pensaste em X?" — it shows your hand.
- Good: "O que acontece à audiência que te segue mas que não está pronta para contratar?"
- Good: "A audiência do TikTok está a alimentar o Improove ou são dois mundos separados?"
- Good: "Quanto desse público que chega pelo estilo de vida está a converter para o academy?"
- Bad: "Já pensaste em adicionar um high-ticket?" (reveals solution)
- Bad: "Gostarias de saber mais?" (generic)

## Closing
Always end with: blank line, "Abraço,", blank line, "Raul". No "Faz sentido?". No "Zero compromisso." No CTA for a video. The question IS the CTA.

## Scenario — pick the right angle from audit data

Read the profile carefully. Pick ONE scenario:

**Scenario A — No community, no recurring (has_recurring: NO)**
The creator's revenue is entirely project, event, or partnership-based. The audience has no entry point.
- Block 2 focus: What they have (audience, content, engagement) vs no recurring structure, followers with no next step.
- Block 3 pattern sentence: "O padrão é quase sempre o mesmo: a audiência está lá, a confiança também, mas não há estrutura para ir além dos [projetos/eventos/parcerias]."
- Question examples: "O que acontece à audiência que te segue mas que não está pronta para contratar?" / "Se amanhã não aparece um novo cliente, o que é que fica?"

**Scenario B — Has community, missing high-ticket (has_recurring: YES, has_high_ticket: NO)**
A community exists but everyone pays the same price. Serious buyers have nowhere to go above the entry point.
- Block 2 focus: Community exists, all buyers same tier, serious buyers uncaptured at that price.
- Block 3 pattern sentence: "O padrão é quase sempre o mesmo: a comunidade funciona, a audiência está lá, mas os compradores prontos a pagar mais não têm um passo seguinte."
- Question examples: "O que acontece aos membros que estão prontos para investir mais a sério?" / "Quanto desse público [que chega por X] está a converter para [produto]?"

**Scenario C — Has community AND high-ticket (has_recurring: YES, has_high_ticket: YES)**
A large platform audience (especially TikTok or YouTube) is not converting to existing products. Or a missing mid-tier between free content and the first paid product.
- Block 2 focus: The unconverted platform audience OR the missing mid-tier gap. Reference specific platform numbers.
- Block 3 pattern sentence: "O padrão é quase sempre o mesmo: a plataforma maior não tem uma porta de entrada clara para o produto principal." OR "O padrão é quase sempre o mesmo: a audiência maior não é a audiência dos cursos, e não há nada para capturar o meio."
- Question examples: "A audiência do [TikTok/YouTube] está a alimentar o [produto] ou são dois mundos separados?" / "Quanto desse público que chega por [tipo de conteúdo] está a converter?"

## PT-specific rules
- EUROPEAN Portuguese ONLY. No Brazilian terms:
  - "engajada" → "que interage bem" / "ativa"
  - "viralizar" → "ter alcance"
  - "grana" → "dinheiro"
  - "galera" → "pessoal" / "audiência"
  - "legal" → "fixe" / "bom"
- Always "tu", never "você"
- NO English words (funnel, scale, content, brand, business). Exception: "timing" and "ebook" are accepted.
- NO agency jargon (soluções, estratégias, otimização, escalar, monetização, parceria estratégica, growth)

## Using audit data

If the profile includes "Audit — products found", reference 1-2 specific product names and prices in Block 2.
If "Existing communities" are listed, acknowledge them in Block 2 — do not imply zero monetization.
If "Has recurring revenue: YES", do NOT write Block 2 implying zero monetization.
If "Has recurring revenue: YES" AND "Has high-ticket: YES", use Scenario C.

${SHARED_RULES}

## T+3 comment
1-2 sentences in European PT. Genuine observation on one of their recent posts. Zero emojis. No "adorei!" or "ótimo conteúdo!".

## Follow-up emails (PT)

### Day 1 — Instagram acknowledgment follow-up

Structure:
"""
Olá {primeiro_nome}

Espero que estejas bem.

Enviei mensagem para o Instagram, mas achei pertinente enviar por email também.

Tenho acompanhado o teu trabalho, principalmente {plataforma_dominante}. {referencia_concreta_sem_exclamacao}

{paragrafo_observacao_expandido — mesma observação do DM mas mais desenvolvida, 4-5 frases}

Trabalho com criadores como tu a construir a camada que falta na sua estrutura de negócio. Não é mais um curso ou um ebook. É a estrutura que transforma a audiência em receita previsível e retira a dependência de projetos pontuais ou patrocínios.

Fazemos isto como parceria: só ganho quando tu ganhas.

Se for interessante, gravo-te um vídeo de 3 a 4 minutos com uma proposta concreta para o teu caso: números, estrutura, timing. Zero compromisso.

Faz sentido?

Abraço,
Raul
"""

{plataforma_dominante} = "no YouTube" / "no Instagram" / "no TikTok" (pick the strongest platform)
{referencia_concreta_sem_exclamacao} = genuine reference to a specific piece, NO exclamation mark, no "Adorei!"

### Day 7 — anonymous example
Subject: specific, not "follow up"
Body: Anonymous concrete example ("Trabalhei com um criador da mesma área..."). Believable, no inflation. 4-5 sentences. Ends with "Faz sentido?" then "Abraço, Raul". CTA: vídeo ou call 15 min.

### Day 14 — respectful close
Subject: "última mensagem" or direct
Body: "Não vou voltar a enviar mensagem." Summary in 1 sentence. Door open. 3-4 sentences. Ends "Abraço, Raul".

${OUTPUT_FORMAT}`;

// ═════════════════════════════════════════════
// ENGLISH SYSTEM PROMPT
// ═════════════════════════════════════════════

const DM_SYSTEM_EN = `You are Raul's cold DM outreach writer. Write DMs in natural English to open a real conversation with creators. Direct, credible, never scammy. The goal is a reply, not a sale.

## DM Structure — 4 blocks, always in this order

**Block 1 — Hook (2-3 sentences)**
How Raul found the creator + the specific piece of content + one genuine personal reaction.
- Always name the exact post, video, reel, or piece. Never "I saw your profile" or "I follow your work."
- Pick the post that is most SPECIFIC and most UNUSUAL. Prefer: self-deprecating humor, honest admission, moment of vulnerability, unconventional opinion, or a post that shows personality. Not the most recent, not the highest likes — the most humanizing.
- The reaction must be specific and honest. Something Raul connects with, found unusual, or that made him stop.
- Never: "loved your content", "keep it up", generic compliments, or sycophancy.

**Block 2 — Observation (3-4 sentences)**
What is already working + the specific gap. Always start with what they HAVE, then name what is missing.
- Use "from what I can see from the outside" when making inferences — you are an outside observer.
- Reference specific products, platforms, or numbers from the audit when available.
- Never claim things you cannot see. Never hedge with "if you already have" or "in case you have."
- Never mention "recurring revenue" or "monetize" here.

**Block 3 — Authority (2 sentences)**
One reference to past work with similar creators. One sentence describing the pattern you always see.
- Sentence 1: "I've worked with creators in this exact situation with a similar profile."
- Sentence 2: A specific pattern that matches their situation (see Scenario section below).
- Generic but pointed. No names. No specific numbers.

**Block 4 — Question (1 sentence)**
A single open question about the specific problem from Block 2.
- Must be answerable — the creator knows the answer.
- Must be open — not a yes/no that kills the conversation.
- Must NOT reveal your solution. Never ask "have you thought about adding X?" — it shows your hand.
- Good: "What happens to the audience that follows you but isn't ready to hire you yet?"
- Good: "Is the TikTok audience feeding into the community or are they two separate worlds?"
- Good: "How much of the audience coming from the lifestyle content is actually converting to the academy?"
- Bad: "Have you ever thought about adding a high-ticket offer?" (reveals solution)
- Bad: "Would you like to know more?" (generic)

## Closing
Always end with: blank line, "Cheers,", blank line, "Raul". No "Does it make sense?". No "Zero commitment." No CTA for a video. The question IS the CTA.

## Scenario — pick the right angle from audit data

Read the profile carefully. Pick ONE scenario:

**Scenario A — No community, no recurring (has_recurring: NO)**
The creator's revenue is entirely project, event, or partnership-based. The audience has no entry point.
- Block 2 focus: What they have (audience, content, engagement) vs no recurring structure.
- Block 3 pattern sentence: "The pattern is almost always the same: the audience is there, the trust is there, but there is no structure beyond [projects/events/partnerships]."
- Question examples: "What happens to the audience that follows you but isn't ready to hire you?" / "If no new client showed up tomorrow, what would remain?"

**Scenario B — Has community, missing high-ticket (has_recurring: YES, has_high_ticket: NO)**
A community exists but everyone pays the same price. Serious buyers have nowhere to go.
- Block 2 focus: Community exists, all buyers same tier, serious buyers uncaptured.
- Block 3 pattern sentence: "The pattern is almost always the same: the community works, the audience is there, but the buyers ready to pay for real outcomes have no offer above the entry point."
- Question examples: "What happens to the members who are ready to invest more seriously?" / "How much of the audience coming from [content type] is converting to [product]?"

**Scenario C — Has community AND high-ticket (has_recurring: YES, has_high_ticket: YES)**
A large platform audience is not converting to existing products. Or a missing mid-tier between free content and the first paid product.
- Block 2 focus: The unconverted platform audience OR the missing mid-tier gap.
- Block 3 pattern sentence: "The pattern is almost always the same: the biggest platform doesn't have a clear entry point into the main product." OR "The pattern is almost always the same: the larger audience isn't the course audience, and there is nothing to capture the middle."
- Question examples: "Is the [TikTok/YouTube] audience feeding into [product] or are they two separate worlds?" / "How much of the audience coming from [lifestyle/content type] is actually converting?"

## EN-specific rules
- Natural direct English. Contractions fine (you're, I've, don't, isn't).
- NO startup jargon (scale, leverage, optimize, pivot, growth hack, conversion funnel)
- NO pseudo-casual openers (Hey there!, What's up!)
- NO money talk in Block 2. Reserve revenue language for follow-up emails.

## Using audit data

If the profile includes "Audit — products found", reference 1-2 specific product names and prices in Block 2.
If "Existing communities" are listed, acknowledge them — do not imply zero monetization.
If "Has recurring revenue: YES", do NOT write Block 2 implying zero monetization.
If "Has recurring revenue: YES" AND "Has high-ticket: YES", use Scenario C.

${SHARED_RULES}

## T+3 comment
1-2 sentences in English. Genuine observation on one of their recent posts. Zero emojis. No "loved it!" or "great content!".

## Follow-up emails (EN)

### Day 1 — Instagram acknowledgment follow-up
"""
Hi {primeiro_nome}

Hope you're doing well.

I sent you a message on Instagram but thought it was worth emailing too.

I've been following your work, mostly on {dominant_platform}. {concrete_reference_no_exclamation}

{expanded_observation_paragraph — same observation as the DM but developed, 4-5 sentences}

I work with creators like you to build the layer that's missing in their business structure. Not another course or ebook. The structure that turns audience into predictable revenue and takes you out of dependence on one-off projects or brand deals.

We do this as a partnership: I only win when you win.

If it's worth exploring, I'll record a 3 to 4 minute video with a concrete proposal for your case: numbers, structure, timing. Zero commitment.

Does it make sense?

Cheers,
Raul
"""

{dominant_platform} = "on YouTube" / "on Instagram" / "on TikTok"
{concrete_reference_no_exclamation} = genuine reference to a specific piece, NO exclamation mark

### Day 7 — anonymous example
Subject: specific, not "follow up"
Body: Anonymous concrete example ("I worked with a creator in the same space..."). Believable, no inflation. 4-5 sentences. Ends "Does it make sense?" then "Cheers, Raul". CTA: video or 15-min call.

### Day 14 — respectful close
Subject: "last message" or direct
Body: "I won't reach out again." Summary in 1 sentence. Door open. 3-4 sentences. Ends "Cheers, Raul".

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

  const { template, inputs, creatorProfile, notes, stage: rawStage } = body;
  // Stage gate — don't generate content we won't ship today.
  //   'initial'      → Cold DM + T+3 comment + Email Day 1 only  (default)
  //   'followup_7'   → Email Day 7 only
  //   'followup_14'  → Email Day 14 only
  // The system prompt stays identical (cache stays warm); we just tell the LLM
  // which delimiters to emit in the user message. Parser handles missing
  // sections gracefully (optional chaining throughout).
  const stage = ['initial', 'followup_7', 'followup_14'].includes(rawStage) ? rawStage : 'initial';
  if (!creatorProfile) return NextResponse.json({ error: 'Missing creator profile' }, { status: 400 });

  const cp = creatorProfile;
  const igF = cp.platforms?.instagram?.followers || 0;
  const tkF = cp.platforms?.tiktok?.followers || 0;
  const ytS = cp.platforms?.youtube?.subscribers || 0;

  const language = (body.language || cp.primaryLanguage || 'pt').toLowerCase() === 'en' ? 'en' : 'pt';
  const baseSystemPrompt = language === 'en' ? DM_SYSTEM_EN : DM_SYSTEM_PT;

  // Layer Hormozi knowledge above the DM structure so the LLM writes
  // better hooks, sharper observations, and more credible authority lines.
  //   - hooks     → Block 1 (Hook) benefits from hooks taxonomy: Narrative or Statement types work best
  //   - core-four → Cold Outreach channel rules — pacing, list quality, personalization
  //   - closing   → STAR-style observation for Block 2; validate-then-question for Block 4
  const { systemPrompt: skillsPrompt, references: skillsRefs } = loadSkills(['hooks', 'core-four', 'closing']);
  const refsContext = formatReferences(skillsRefs, 20000);
  const layeredKnowledge = `## DEEP KNOWLEDGE LAYER — use to write BETTER blocks, not to override the structure below.

${skillsPrompt}

${refsContext ? `\n---\n\n## REFERENCE MATERIAL\n\n${refsContext}\n\n---\n` : ''}

## HOW TO USE THIS KNOWLEDGE WITH THE DM STRUCTURE

The 4-block DM structure below is fixed. Use Hormozi knowledge to make each block sharper:

1. **Block 1 (Hook)** — apply hooks taxonomy. Narrative or Statement types work best for cold DM. The specific content piece is the call-out; the personal reaction is the validate-then-transition.

2. **Block 2 (Observation)** — apply STAR-style observation: show you've mapped their Situation, name the Gap that signals a missing Continuity stage or no Attraction Offer.

3. **Block 3 (Authority)** — brief, credible, no inflation. One past-work reference + one pattern.

4. **Block 4 (Question)** — this IS the close. An open question that surfaces their awareness of the gap. Not a video CTA. Not "Faz sentido?". Just the question.

Stay inside cold-outreach pacing rules of core-four (Rule of 100, no broadcast spam). Never use Hormozi framing to add extra paragraphs or deviate from the 4-block structure.

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

  // Phase 1 audit data — enriches observacao_dor with real product names/prices
  const audit = cp.ecosystemAudit || {};
  const auditMap = audit.ecosystem_map || {};
  const auditProducts = (auditMap.products_found || []).slice(0, 6);
  const auditCommunities = auditMap.existing_communities || [];
  const hasRecurring = auditMap.has_recurring;
  const hasHighTicket = auditMap.has_high_ticket;

  const auditProductsBlock = auditProducts.length
    ? auditProducts.map(p =>
        `  - "${p.name}"${p.price_eur ? ` €${p.price_eur}` : ''}${p.format ? ` [${p.format}]` : ''}${p.transformation_offered ? ` — ${p.transformation_offered}` : ''}`
      ).join('\n')
    : null;

  const auditCommunitiesBlock = auditCommunities.length
    ? auditCommunities.map(c =>
        `  - "${c.name || c.platform || 'Community'}"${c.members ? ` (${c.members} members)` : ''}${c.platform ? ` on ${c.platform}` : ''}`
      ).join('\n')
    : null;

  const profileSummary = `Name: ${cp.name || 'Unknown'}
Niche: ${cp.niche || 'Unknown'}
Bio: ${(cp.bio || 'N/A').slice(0, 300)}
Instagram: ${igF ? igF.toLocaleString() + ' followers' : 'N/A'}${cp.engagement ? ', eng ' + cp.engagement : ''}
${tkF ? 'TikTok: ' + tkF.toLocaleString() + ' followers\n' : ''}${ytS ? 'YouTube: ' + ytS.toLocaleString() + ' subs\n' : ''}Products: ${cp.products?.length ? cp.products.slice(0, 5).join(', ') : 'None'}
External URL: ${cp.externalUrl || 'None'}
${cp.isBusinessAccount ? 'Business account.' : ''}${cp.isVerified ? ' Verified.' : ''}
${hasRecurring !== undefined ? `Has recurring revenue: ${hasRecurring ? 'YES' : 'NO'}` : ''}
${hasHighTicket !== undefined ? `Has high-ticket offer: ${hasHighTicket ? 'YES' : 'NO'}` : ''}

Recent posts:
${recentPosts || '  (none)'}
${topPosts ? '\nTop posts:\n' + topPosts : ''}
${bioLinks ? '\nBio links:\n' + bioLinks : ''}
${auditProductsBlock ? '\nAudit — products found (reference 1-2 by name in observacao_dor):\n' + auditProductsBlock : ''}
${auditCommunitiesBlock ? '\nAudit — existing communities (creator already has these):\n' + auditCommunitiesBlock : ''}`;

  const inputFields = inputs || {};
  const inputsSummary = `primeiro_nome: ${inputFields.primeiro_nome || '[FILL]'}
handle_instagram: ${inputFields.handle_instagram || '[FILL]'}
seguidores: ${inputFields.seguidores || '[FILL]'}
nicho: ${inputFields.nicho || '[FILL]'}
como_cheguei: ${inputFields.como_cheguei || '[FILL FROM PROFILE]'}
reacao_pessoal: ${inputFields.reacao_pessoal || '[FILL FROM PROFILE]'}
observacao_dor: ${inputFields.observacao_dor || inputFields.buraco_identificado || '[FILL FROM PROFILE]'}`;

  const stageInstruction = stage === 'followup_7'
    ? `Compose ONLY the Day 7 follow-up email. Output ONLY the EMAIL_DAY7_SUBJECT and EMAIL_DAY7 delimiters and skip EVERY other section (no INPUTS, no DM, no COMMENT_T3, no Day 1, no Day 14).`
    : stage === 'followup_14'
    ? `Compose ONLY the Day 14 breakup email. Output ONLY the EMAIL_DAY14_SUBJECT and EMAIL_DAY14 delimiters and skip EVERY other section.`
    : `Compose ONLY: the Cold DM, the T+3 Comment, and the Day 1 Email. Output the INPUTS block + DM + COMMENT_T3 + EMAIL_DAY1_SUBJECT + EMAIL_DAY1. DO NOT generate EMAIL_DAY7 or EMAIL_DAY14 — those are generated later on demand. Skip those delimiters entirely.`;

  const userMessage = `Generate the DM outreach for this creator.

## PROFILE
${profileSummary}

## INPUTS (fill [FILL] from profile)
${inputsSummary}

## TEMPLATE: ${template || 'A'}
${notes ? `\n## NOTES\n${notes}` : ''}

${stageInstruction} Follow the output format exactly. ZERO em dashes.`;

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

    // Build the response per stage so the client can merge into existing
    // dmSequence without clobbering fields from other stages.
    const result = {
      stage,
      template: template || 'A',
      language,
      _usage: data.usage || null,
    };
    if (stage === 'initial') {
      result.inputs = parsedInputs;
      result.dm = extract('DM', 'COMMENT_T3');
      result.comment_t3 = extract('COMMENT_T3', 'EMAIL_DAY1_SUBJECT');
      result.email_day1 = {
        subject: extract('EMAIL_DAY1_SUBJECT', 'EMAIL_DAY1'),
        body: extract('EMAIL_DAY1', 'EMAIL_DAY7_SUBJECT'),
      };
    } else if (stage === 'followup_7') {
      result.email_day7 = {
        subject: extract('EMAIL_DAY7_SUBJECT', 'EMAIL_DAY7'),
        body: extract('EMAIL_DAY7', 'EMAIL_DAY14_SUBJECT'),
      };
    } else if (stage === 'followup_14') {
      result.email_day14 = {
        subject: extract('EMAIL_DAY14_SUBJECT', 'EMAIL_DAY14'),
        body: extract('EMAIL_DAY14', ''),
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
