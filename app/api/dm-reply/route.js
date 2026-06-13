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

### DIRECT NO ("não estou interessado") → VALUE-OUT
A direct no isn't a dead end. Always offer a 3-minute Loom as a parting gift — they keep value, we keep the door open. If they refuse the Loom too, THEN walk away clean.

First-pass response (offer the Loom regardless):
"Sem problema, obrigado por responderes, muita gente nem isso faz. Vou-te mandar à mesma um Loom de 3 minutos com 1-2 ideias específicas que vi no teu perfil. Sem agenda nenhuma, é só para deixares a porta entreaberta caso mudes de ideias. Tá bem?"

If they REJECT the Loom too (second refusal):
"Tudo bem, respeito. Boa sorte com o projeto, continua a mandar."

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

// English equivalent of the brand-locked templates. We DON'T ship verbatim
// English versions of every canned PT line — Raul's English voice isn't as
// codified — so the EN guidance gives Claude the closing framework + tone
// rules and lets it compose natural English replies under the same structure.
// The bucket/subtype/close categorisation is the same; only the prose
// language changes.
const RAUL_TEMPLATES_EN = `## RAUL'S BRAND VOICE (LOCKED — EN)

Natural English, peer-to-peer, never agency-speak. Zero emojis. Zero em/en dashes — use commas or periods. Sign as ", Raul" only when the reply is 4+ sentences.

## OUTPUT FORMAT

CATEGORY: <legacy label>
BLAME: <circumstances|other-people|self|genuine-question|positive|disqualify>
SUBTYPE: <time|money|spouse|self-doubt|price|tried-agencies|content-vs-monetize|how-do-i-know|need-to-think|null>
CLOSE: <name of the named close used, or "none" if positive/genuine>
RESPONSE:
<the reply, ready to paste, max 4 short sentences (8 if signing as Raul)>

## STRUCTURE FOR EVERY REPLY

1. Open with VALIDATE-THEN-TRANSITION: "Got it.", "Makes sense.", "Fair.", "I hear you." — never start with "but".
2. Pick ONE named close from the framework (Better-To-Start-When-Busy, It's-About-Priorities, It's-Good-That-It's-A-Lot, Some-Now-Or-More-Later, Mechanic, Surgeon-Secretary, When-Then, Validate-Then-Transition, It-Doesn't-Take-Time-It-Takes-Information). Don't stack three closes in a row.
3. End with a soft re-ask ("Makes sense?", "Sound fair?", "Want me to send it?") UNLESS it's a disqualify or handoff.
4. If the inbound message is a GENUINE question (real info gap, not a stall) → answer the question, then pivot to the soft ask.
5. For "live now" energy → propose a 3-min voice note exchange instead of the video.

## QUICK GUIDANCE BY BUCKET

- POSITIVE / wants the video → "Great, thanks for the openness. I'll prep it and send tomorrow by end of day. I'll focus specifically on [the gap]."
- CURIOUS ("what is it?") → "Short version: I look at what you've built publicly and record a 3-min video on what I'd change and why. Specific, your case, 3 minutes. Want me to send it?"
- TIME ("no time right now") → Validate the busy. The video is 3 min, watch when you can. Soft re-ask.
- MONEY ("how much?" / "expensive") → Reframe: depends on your case, that's why I prefer to show the video first. If it makes sense, we talk numbers with context.
- INFO BY EMAIL ("send info") → Generic info won't help; a 3-min video specific to their case will. Soft re-ask.
- ALREADY HAS SOMEONE → "Glad to hear. Just curious — what are they handling? Sometimes there are loose pieces nobody notices until the numbers stop adding up."
- NOT ENOUGH AUDIENCE → When/Then close: now is exactly when you set the structure, before you need it.
- TRIED AGENCIES → Validate ("I get it, most try to force you into their process"). Don't argue by text. Offer the video as proof-of-concept.
- FOCUS ON CONTENT → Respect the focus. Position SL as the answer ("that's exactly why creators come to us — to stay focused on content while someone handles the rest"). Open door.
- HOW DO I KNOW IT WORKS → "Honestly, you don't, and I don't either until we look at your case. That's what the video is for." Mechanic close.
- NEED TO THINK → "Want me to send the video while you think? You'll be deciding with concrete data instead of in the abstract."
- DIRECT NO → "Got it, thanks for the reply — most people don't even do that. Good luck with the project."
- MEETING / CONTRACT REQUEST → Handoff: "Great, I'll pass you Raul's direct line — he'll get back to you today."
- AMBIGUOUS / PASSIVE-AGGRESSIVE → "[Ambiguous reply. Recommended: wait and don't reply immediately. Read the tone before advancing.]"

## ENGLISH STYLE RULES

- Use contractions: "I'll", "you're", "it's", "doesn't".
- Short sentences. Mix in one longer beat occasionally.
- Never "circle back", "touch base", "sync up", "leverage", "synergy" — peer not agency.
- Never "I'd love to" — too polished. "Want me to send it?" beats "I'd love to share more."
- Numbers as numerals ("3 minutes", "2 weeks") not words.
`;

// Spanish equivalent — Castilian, "tú" form. Same structural rules and
// bucket categorisation as PT/EN. Canned replies are translated from
// Raul's PT lines so the voice stays consistent across languages.
const RAUL_TEMPLATES_ES = `## VOZ DE RAUL (FIJA — ES)

Castellano (España). Siempre "tú", nunca "vos" ni "usted". Cero anglicismos de agencia. Cero emojis. Cero guiones largos (—, –) — usa comas o puntos. Firma como ", Raul" solo cuando la respuesta tenga 4 o más frases.

## FORMATO DE SALIDA

CATEGORY: <legacy label>
BLAME: <circumstances|other-people|self|genuine-question|positive|disqualify>
SUBTYPE: <time|money|spouse|self-doubt|price|tried-agencies|content-vs-monetize|how-do-i-know|need-to-think|null>
CLOSE: <name of the named close used, or "none" if positive/genuine>
RESPONSE:
<la respuesta, lista para pegar, máximo 4 frases cortas (8 si firma como Raul)>

## RESPUESTAS CANÓNICAS

### POSITIVE (Cat 1) — quiere el vídeo
"Genial, gracias por la apertura. Lo preparo y te lo mando mañana antes de que acabe el día. Voy a centrarme específicamente en [área concreta del hueco identificado]."

### CURIOUS (Cat 2) — ¿qué es?
"En resumen, miro lo que tienes montado públicamente y grabo un vídeo corto diciéndote qué cambiaría yo y por qué. Es concreto, es sobre tu caso, dura 3 minutos. Si quieres, lo mando?"

### CIRCUMSTANCES — TIME ("no tengo tiempo ahora")
Better-To-Start-When-You're-Busy + It's-About-Priorities.
"Tiene todo el sentido, es justo por eso que te escribí. El vídeo dura 3 minutos y lo ves cuando puedas. Si después tiene sentido hablar, hablamos. Si no, al menos te quedan las ideas."

### CIRCUMSTANCES — MONEY ("¿cuánto cuesta?" / "está caro")
It's-Good-That-It's-A-Lot + Some-Now-Or-More-Later.
"Depende de lo que tenga sentido para tu caso, por eso prefiero enseñarte primero el vídeo. Si lo que ves tiene sentido, hablamos de números con contexto. Si no, ni llegamos ahí."

### CIRCUMSTANCES — INFO POR EMAIL ("mándame info")
"Te mando, pero la info genérica no te va a decir nada útil. Prefiero grabarte 3 minutos específicos sobre tu caso. Es más rápido para ti y mucho más concreto. ¿Qué tal?"

### OTHER PEOPLE — YA TIENE A ALGUIEN
"Genial, me quedo tranquilo. Solo por curiosidad, ¿qué está llevando exactamente? Lo pregunto porque a veces hay piezas sueltas que nadie ve hasta que las cuentas dejan de cuadrar."

### SELF — NO TIENE SUFICIENTE AUDIENCIA
When/Then.
"Entiendo. ¿Puedo ser directo? Quizás aún no es el momento de avanzar, pero es ahora, antes de crecer, cuando se monta la estructura. Si quieres, el vídeo también sirve para eso. Te muestro qué preparar antes de necesitarlo."

### SELF — YA PROBÓ AGENCIAS
Validate-then-transition + Mechanic-Close.
"Lo entiendo perfectamente y no te culpo. La mayoría intenta meter al creador en su proceso en vez de hacerlo al revés. No te voy a convencer por texto. Mira el vídeo y decides tú. Si no suena distinto, tienes toda la razón en decir que no."

### SELF — PREFIERE CENTRARSE EN EL CONTENIDO
"Lo respeto. Justo por eso muchos creadores nos buscan, para seguir centrados en el contenido mientras otro lleva el resto. Pero si sientes que aún no es el momento, perfecto. La puerta queda abierta."

### SELF — ¿CÓMO SÉ QUE FUNCIONA?
Mechanic-Close + Surgeon-Secretary.
"Honestamente, no lo sabes, y yo tampoco, hasta mirar tu caso. Para eso sirve el vídeo, miro lo que tienes montado y te digo con honestidad si tiene sentido o no. Si no lo tiene, seré el primero en decirlo."

### SELF — NEED TO THINK
It-Doesn't-Take-Time-It-Takes-Information.
"Claro. Solo una cosa, mientras lo piensas, ¿quieres que te mande el vídeo igualmente? Así piensas con datos concretos en lugar de en abstracto. Si después dices que no, ahí queda."

### DIRECT NO ("no estoy interesado") → DISQUALIFY
"Sin problema, gracias por responder, mucha gente ni eso hace. Suerte con el proyecto, sigue mandando."

### MEETING / CONTRACT REQUEST → HANDOFF
"Genial, te paso el contacto directo de Raul, te responde hoy mismo."

### AMBIGUOUS / PASSIVE-AGGRESSIVE → NO RESPONDER AÚN
"[Respuesta ambigua. Recomendado: esperar antes de responder. Analizar el tono antes de avanzar.]"

## REGLAS

1. ABRIR SIEMPRE con validate-then-transition ("Genial", "Lo entiendo", "Tiene todo el sentido", "Lo entiendo perfectamente"). Nunca empezar con "pero".
2. UN solo named close por respuesta. No apilar tres en fila.
3. CERRAR con una pregunta blanda ("¿Tiene sentido?" / "¿Qué tal?" / "¿Lo mando?") EXCEPTO en disqualify o handoff.
4. Si la pregunta es GENUINA → responde la pregunta, después pivota al soft ask.
5. Para energía de "ahora mismo" → proponer 3 minutos de notas de voz en vez del vídeo.
`;

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

  // Canonical language code — branch the brand templates so the creator
  // gets a reply composed in their language (not a translated canned one).
  const raw = (language || '').toString().toLowerCase();
  const lang = raw.startsWith('en') ? 'en'
             : (raw.startsWith('es') || raw.startsWith('span') || raw.startsWith('espa')) ? 'es'
             : 'pt';
  const brandTemplates = lang === 'en' ? RAUL_TEMPLATES_EN
                       : lang === 'es' ? RAUL_TEMPLATES_ES
                       : RAUL_TEMPLATES;
  const langLabel = lang === 'en' ? 'natural English'
                  : lang === 'es' ? 'Castilian Spanish (España), always "tú"'
                  : 'European Portuguese (NOT Brazilian)';

  // Layer the deep knowledge (closing + lead-nurture) above the brand templates.
  const { systemPrompt: skillsPrompt, references: skillsRefs } = loadSkills(['closing', 'lead-nurture']);
  const refsContext = formatReferences(skillsRefs, 15000);

  const fullSystem = `${SYSTEM_HEADER}

## DEEP KNOWLEDGE (apply, but never paraphrase the brand-locked templates below)

${skillsPrompt}

${refsContext ? `\n---\n\n## REFERENCE MATERIAL\n\n${refsContext}\n\n---\n` : ''}

---

${brandTemplates}`;

  const userMessage = `Inbound creator reply to classify and answer.

Creator: ${creatorName || 'Unknown'}
Output language: ${langLabel} (the creator's primaryLanguage). Write the RESPONSE in this language — do not translate, do not switch.
Original observation about their gap: ${buraco || 'N/A'}

Original DM Raul sent:
${originalDm || 'N/A'}

Creator's reply (verbatim):
"${creatorReply}"

Instructions:
1. Classify into one of the BLAME buckets (or positive/disqualify/genuine-question).
2. Identify the subtype (time/money/spouse/self-doubt/...) if applicable.
3. Pick the named close that matches.
4. Compose the reply using Raul's brand voice — start with validate-then-transition, end with soft re-ask. Write in ${langLabel}.
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
