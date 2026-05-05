import { NextResponse } from 'next/server';
import { loadSkills, formatReferences } from '../../lib/skills';

/**
 * /api/dm-reply
 *
 * Classifies an inbound creator reply using the closing skill's 4 BLAME BUCKETS
 * (Circumstances / Other People / Self / Genuine question) and produces a
 * Validate-then-Transition reply using the named close that matches the bucket.
 *
 * Also pulls in lead-nurture for the 5-outcome decision tree (the "is now a
 * terrible time?" pull-forward script and the BAMFAM ask).
 *
 * Output:
 *   {
 *     category: "<legacy human-readable label>",  // back-compat with the existing UI
 *     detectedBlame: "circumstances|other-people|self|genuine-question|positive|disqualify",
 *     subType: "time|money|spouse|self-doubt|...",  // null if not applicable
 *     closeUsed: "<named close from the closing skill>",
 *     response: "<the validate-then-transition reply, ready to paste>",
 *     reAsk: "<the calendar/payment/video ask appended>",
 *     starGapsToFix: [...]    // anything STAR pre-qualification flagged
 *   }
 */

// Brand-locked Raul templates — Hormozi closes adapted to European Portuguese,
// no em dashes, no English jargon. The system prompt below is the SOURCE OF
// TRUTH for tone; the loaded `closing` + `lead-nurture` skills are layered above.
const RAUL_TEMPLATES = `## RAUL'S BRAND VOICE (LOCKED)

European Portuguese (NOT Brazilian). Always "tu", never "você". Zero English jargon. Zero emojis. Zero em/en dashes — use commas. Sign as ", Raul" only when the reply is 4+ sentences.

## OUTPUT FORMAT

CATEGORY: <legacy label>
BLAME: <circumstances|other-people|self|genuine-question|positive|disqualify>
SUBTYPE: <time|money|spouse|self-doubt|price|tried-agencies|content-vs-monetize|how-do-i-know|need-to-think|null>
CLOSE: <name of the named close used, or "none" if positive/genuine>
RESPONSE:
<the reply, ready to paste, max 4 short sentences (8 if signing as Raul)>

## CANONICAL REPLIES (the "named closes" already adapted to Raul's voice — use these as the basis when the bucket fits)

### POSITIVE (Cat 1) — they want the video
"Boa, obrigado pela abertura. Vou preparar e mando amanhã até ao fim do dia. Vou olhar especificamente para [área concreta do buraco identificado]."

### CURIOUS (Cat 2) — what is it?
"Em resumo, olho para o que tens montado publicamente e gravo um vídeo curto a dizer-te o que eu mudava e porquê. É concreto, é sobre o teu caso, dura 3 minutos. Se quiseres, avanço?"

### CIRCUMSTANCES — TIME ("não tenho tempo agora")
Use Hormozi's "Better To Start When You're Busy" + "It's About Priorities" closes.
"Faz todo o sentido, é por causa disso que te escrevi. O vídeo tem 3 minutos e vês quando conseguires. Se depois fizer sentido falar, falamos. Se não, pelo menos ficas com as ideias."

### CIRCUMSTANCES — MONEY ("quanto custa?" / "está caro")
Use "It's Good That It's A Lot" + "Some Now Or More Later".
"Depende do que fizer sentido para o teu caso, é por isso que prefiro mostrar-te primeiro o vídeo. Se o que vires fizer sentido, falamos de números com contexto. Se não, nem chegamos aí."

### CIRCUMSTANCES — INFO BY EMAIL ("manda info")
"Mando, mas a informação genérica não te vai dizer nada útil. Prefiro gravar-te 3 minutos específicos sobre o teu caso. É mais rápido para ti e muito mais concreto. Que tal?"

### OTHER PEOPLE — ALREADY HAS SOMEONE ("já tenho alguém a tratar disso")
Use "What's Your Main Concern?" angle.
"Boa, fico descansado. Só por curiosidade, está a tratar de quê exatamente? Pergunto porque às vezes há peças soltas que ninguém repara até as contas começarem a não bater."

### SELF — NOT ENOUGH AUDIENCE ("não tenho audiência suficiente")
Use "When/Then" close.
"Compreendo. Posso ser franco? Se calhar ainda não é o momento para avançarmos, mas é agora, antes de crescer, que se deve montar a estrutura. Se quiseres, o vídeo também serve para isso. Mostro-te o que preparar antes de precisares."

### SELF — TRIED AGENCIES BEFORE
Use "Validate-then-transition" + "Mechanic Close".
"Percebo perfeitamente e não te culpo. A maior parte tenta pôr o criador a encaixar no processo delas, em vez de fazer o contrário. Não te vou tentar convencer por texto. Vê o vídeo e decides tu próprio. Se não soar diferente, tens toda a razão em dizer que não."

### SELF — PREFER FOCUS ON CONTENT (not monetization)
"Respeito isso. É por isso que muitos criadores nos procuram, para continuarem focados no conteúdo enquanto alguém trata do resto. Mas se sentires que ainda não é o momento, tudo bem. A porta fica aberta."

### SELF — HOW DO I KNOW IT WILL WORK?
Use "Mechanic Close" + "Surgeon Secretary".
"Sinceramente, não sabes, e eu também não, até olharmos para o teu caso concreto. É para isso que serve o vídeo, olho para o que tens montado e digo-te honestamente se faz sentido ou não. Se não fizer, sou o primeiro a dizer."

### SELF — NEED TO THINK
Use "It Doesn't Take Time, It Takes Information".
"Claro. Só uma coisa, enquanto pensas, queres que te mande o vídeo à mesma? Assim pensas com dados concretos em vez de pensares no abstrato. Se depois disseres que não, fica por aí."

### DIRECT NO ("não estou interessado") → DISQUALIFY
"Sem problema, obrigado por responderes, muita gente nem isso faz. Boa sorte com o projeto, continua a mandar."

### MEETING / CONTRACT REQUEST → HANDOFF
"Boa, vou passar-te o contacto direto do Raul, ele responde-te hoje ainda."

### AMBIGUOUS / PASSIVE-AGGRESSIVE → DON'T REPLY YET
"[Esta resposta é ambígua. Recomendado: esperar e não responder de imediato. Analisar o tom antes de avançar.]"

## RULES

1. ALWAYS open with validate-then-transition ("Boa", "Compreendo", "Faz todo o sentido", "Percebo perfeitamente"). Never lead with "mas" — use "e" or restart.
2. Pick ONE named close. Don't stack 3 closes in a row.
3. ALWAYS end the response with a soft re-ask ("Faz sentido?" / "Que tal?" / "avanço?") UNLESS it's a disqualify or handoff.
4. If the inbound message asks a GENUINE question (legitimate info gap, not a stall) → answer the question, then pivot to the soft ask. Don't deploy a close on a real question.
5. Use the bilingual variant matching the inbound message's language. Default = European Portuguese.
6. The 5-outcome decision tree from lead-nurture also applies: if the message reads as "live now" → propose to skip the video and just have a 3-min voice note exchange.
`;

const SYSTEM_HEADER = `You are Raul's reply writer. You handle inbound creator replies to cold outreach DMs using the Hormozi Closing Playbook (validate-then-transition + 4 blame buckets + named closes) and Lead Nurture (5-outcome script). Your output is the EXACT text Raul will paste back to the creator — short, brand-correct, never scammy.`;

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { creatorReply, originalDm, creatorName, buraco, language } = body;
  if (!creatorReply) return NextResponse.json({ error: 'Missing creator reply' }, { status: 400 });

  // Layer the deep knowledge (closing + lead-nurture) above the brand templates.
  const { systemPrompt: skillsPrompt, references: skillsRefs } = loadSkills(['closing', 'lead-nurture']);
  const refsContext = formatReferences(skillsRefs, 15000);

  const fullSystem = `${SYSTEM_HEADER}

## DEEP KNOWLEDGE (apply, but never paraphrase the brand-locked templates below)

${skillsPrompt}

${refsContext ? `\n---\n\n## REFERENCE MATERIAL\n\n${refsContext}\n\n---\n` : ''}

---

${RAUL_TEMPLATES}`;

  const userMessage = `Inbound creator reply to classify and answer.

Creator: ${creatorName || 'Unknown'}
Language preference: ${language || 'pt'}
Original observation about their gap: ${buraco || 'N/A'}

Original DM Raul sent:
${originalDm || 'N/A'}

Creator's reply (verbatim):
"${creatorReply}"

Instructions:
1. Classify into one of the BLAME buckets (or positive/disqualify/genuine-question).
2. Identify the subtype (time/money/spouse/self-doubt/...) if applicable.
3. Pick the named close that matches.
4. Compose the reply using Raul's brand voice — start with validate-then-transition, end with soft re-ask.
5. Output exactly per the OUTPUT FORMAT spec.`;

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
        max_tokens: 1500,
        system: [
          { type: 'text', text: fullSystem, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Classification failed' }, { status: 500 });
    }

    const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');

    // Parse the structured output.
    const grab = (label, until) => {
      const re = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n(?:${until.join('|')})\\s*:|$)`);
      const m = rawText.match(re);
      return m ? m[1].trim() : '';
    };

    const category = grab('CATEGORY', ['BLAME', 'SUBTYPE', 'CLOSE', 'RESPONSE']);
    const blame = grab('BLAME', ['SUBTYPE', 'CLOSE', 'RESPONSE']);
    const subtype = grab('SUBTYPE', ['CLOSE', 'RESPONSE']);
    const close = grab('CLOSE', ['RESPONSE']);
    const responseText = grab('RESPONSE', []);

    // Em-dash safety net (Raul brand rule).
    const stripDashes = (text) => (text || '')
      .replace(/[ \t]*[—–][ \t]*/g, ', ')
      .replace(/[ \t]+-[ \t]+/g, ', ')
      .replace(/,\s*,/g, ',')
      .replace(/,\s*\./g, '.')
      .trim();

    return NextResponse.json({
      category: category || 'Unknown',
      detectedBlame: blame || null,
      subType: subtype && subtype !== 'null' ? subtype : null,
      closeUsed: close && close !== 'none' ? close : null,
      response: stripDashes(responseText) || stripDashes(rawText),
      raw: rawText,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
