import { NextResponse } from 'next/server';

const DM_SYSTEM = `You are Raul's cold DM outreach writer. You write cold DMs to creators on Instagram to get exploratory meetings.

## TEMPLATE A — Direto (default)

[primeiro_nome], tudo bem?

Vi {peca_recente} e {observacao_real}.

Reparei que {buraco_identificado}. Com a audiencia que tens, isso {consequencia_logica_em_linguagem_simples}.

Trabalhamos com criadores da area de {nicho} a montar exatamente esta parte, a que ninguem ve mas que faz toda a diferenca.

Se quiseres, gravo-te um video rapido (uns 3 min) a mostrar concretamente o que mudava no teu caso. Sem compromisso, so ideias.

— Raul

LIMITS for Template A:
- Total: 65-90 words (including signature)
- One blank line between blocks: mandatory
- Bloco 4 (CTA) is ALWAYS literal, word for word as above

## TEMPLATE B — Serie (Day in the Life)

[primeiro_nome], tudo bem?

Vi {peca_recente} e {observacao_real}.

Faco uma serie chamada Day in a Life onde passo um dia com pessoas que ja construiram algo e documento o que fazem por tras do que a audiencia ve. Ja gravei com Tomas Estarreja, Publio Silva ou Pietro Zancuoghi.

{razao_concreta_por_que_ele_encaixa}

Se fizer sentido para ti, adorava gravar um episodio contigo. Zero compromisso, se nao encaixar, nao encaixa.

— Raul

LIMITS for Template B:
- Total: 70-100 words

## EXAMPLE (Template A, filled):

Mariana, tudo bem?

Ouvi o teu ultimo episodio sobre o PPR e notou-se que dominavas o tema de uma forma simples sem ser simplista.

Reparei que ainda nao tens um sitio teu onde as pessoas te possam seguir fora do Instagram. Com a audiencia que tens, isso quer dizer que dependes 100% do algoritmo para falares com ela, e sabes melhor do que ninguem como isso pode correr mal num dia mau.

Trabalhamos com criadores da area das financas pessoais a montar exatamente esta parte, a que ninguem ve mas que faz toda a diferenca.

Se quiseres, gravo-te um video rapido (uns 3 min) a mostrar concretamente o que mudava no teu caso. Sem compromisso, so ideias.

— Raul

## ABSOLUTE RULES — NEVER BREAK
1. NEVER start with "Ola", "Espero que estejas bem", "Desculpa incomodar"
2. NEVER use English words (funnel, content, business, scale, brand, engage, etc.)
3. NEVER use agency jargon ("solucoes", "estrategias", "otimizacao", "monetizacao", "escalar", "parceria estrategica")
4. NEVER include links of any kind
5. NEVER mention "Second Layer" by name
6. NEVER use titles ("Fundador", "CEO", "Socio", "Head of")
7. NEVER promise specific numbers ("vais faturar X", "20% mais conversao")
8. NEVER change Bloco 4 (CTA) — always literal, word for word
9. "-" and " — " are completely prohibited as punctuation in the DM text. Only allowed in the signature "— Raul"
10. Zero emojis
11. Always use "tu", never "voce"
12. Each DM must be unique in Blocks 1, 2, and 3

## EMAILS
Write 3 follow-up emails. Same tone, same rules. Short, human, zero jargon. Always sign as "Raul".
- Day 1: Same angle as DM but slightly expanded. Professional but warm. Max 5-6 sentences.
- Day 7: Share anonymous concrete example ("Um criador com uma audiencia parecida..."). Believable numbers. CTA: video or quick call.
- Day 14: Respectful close. "Nao vou voltar a enviar mensagem." Summarize opportunity in one sentence. Leave door open.

## T+3 COMMENT
Write a genuine, helpful comment for one of the creator's recent posts.
- Must be genuinely useful or insightful, not just "otimo conteudo!"
- Don't mention the DM at all
- 1-2 sentences max
- Must feel natural

## AUTO-FILL INPUTS
If any of the 7 input fields are empty, you MUST fill them from the creator profile data:
- peca_recente: reference a concrete piece of content. Use bio, niche, products, or any content info available to infer recent content.
- observacao_real: a genuine observation that shows the content was consumed. One sentence.
- buraco_identificado: the biggest gap in their setup (no email list, no own product, depends on brand deals only, no presence outside Instagram, etc.). Analyze their bio, links, and products to identify this.

## OUTPUT FORMAT
Output in this EXACT format with these EXACT delimiters:

===INPUTS===
primeiro_nome: [value]
handle_instagram: [value]
seguidores: [value]
nicho: [value]
peca_recente: [value]
observacao_real: [value]
buraco_identificado: [value]
===DM===
[the complete DM, ready to send]
===COMMENT_T3===
[the comment suggestion]
===EMAIL_DAY1_SUBJECT===
[subject line]
===EMAIL_DAY1===
[email body]
===EMAIL_DAY7_SUBJECT===
[subject line]
===EMAIL_DAY7===
[email body]
===EMAIL_DAY14_SUBJECT===
[subject line]
===EMAIL_DAY14===
[email body]`;

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

  const profileSummary = `Name: ${cp.name || 'Unknown'}
Niche: ${cp.niche || 'Unknown'}
Bio: ${cp.bio || 'N/A'}
Instagram: ${igF ? igF.toLocaleString() + ' followers' : 'N/A'}${cp.engagement ? ', engagement ' + cp.engagement : ''}
TikTok: ${tkF ? tkF.toLocaleString() + ' followers' : 'N/A'}
YouTube: ${ytS ? ytS.toLocaleString() + ' subscribers' : 'N/A'}
Products: ${cp.products?.length ? cp.products.join(', ') : 'None found'}
Bio Links: ${cp.bioLinks?.length ? cp.bioLinks.join(', ') : 'None found'}
External URL: ${cp.externalUrl || 'None'}
Reputation: ${cp.reputation || 'N/A'}
Verified: ${cp.isVerified ? 'Yes' : 'No'}
Research: ${cp.research || 'N/A'}`;

  const inputFields = inputs || {};
  const inputsSummary = `primeiro_nome: ${inputFields.primeiro_nome || '[FILL]'}
handle_instagram: ${inputFields.handle_instagram || '[FILL]'}
seguidores: ${inputFields.seguidores || '[FILL]'}
nicho: ${inputFields.nicho || '[FILL]'}
peca_recente: ${inputFields.peca_recente || '[FILL FROM PROFILE DATA]'}
observacao_real: ${inputFields.observacao_real || '[FILL FROM PROFILE DATA]'}
buraco_identificado: ${inputFields.buraco_identificado || '[FILL FROM PROFILE DATA]'}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: DM_SYSTEM,
        messages: [{
          role: 'user',
          content: `Generate the complete cold DM outreach for this creator.

## CREATOR PROFILE
${profileSummary}

## INPUT FIELDS (fill empty ones from profile data)
${inputsSummary}

## TEMPLATE: ${template || 'A'}

${notes ? `## ADDITIONAL NOTES\n${notes}` : ''}

IMPORTANT: Fill any empty input fields from the profile data. Then compose the DM, comment, and emails. Follow the output format exactly.`,
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Generation failed' }, { status: 500 });
    }

    const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');

    // Parse structured output
    const extract = (key1, key2) => {
      const pattern = new RegExp(`===${key1}===\\s*([\\s\\S]*?)(?====${key2 || ''}===|$)`);
      const match = rawText.match(pattern);
      return match ? match[1].trim() : '';
    };

    // Parse inputs
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
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
