import { NextResponse } from 'next/server';

const REPLY_SYSTEM = `You classify creator replies to cold DMs and provide the appropriate scripted response.

## CATEGORIES AND RESPONSES

Category 1: "Sim, manda" (or positive variations — they want the video)
Response:
"Boa, obrigado pela abertura. Vou preparar e mando amanha ate ao fim do dia.
Vou olhar especificamente para [area concreta do buraco identificado]."

Category 2: Question about what it is (curious but hasn't said yes)
Response (choose one variation, never repeat):
"Em resumo: olho para o que tens montado publicamente e gravo um video curto a dizer-te o que eu mudava e porque. E concreto, e sobre o teu caso, e dura 3 minutos. Se quiseres, avanco?"

Category 3: Objection — match to one of these exact scripts:

"Ja tenho alguem a tratar disso"
→ "Boa, fico descansado. So por curiosidade, esta a tratar de que exatamente? Pergunto porque as vezes ha pecas soltas que ninguem repara ate as contas comecarem a nao bater."

"Nao tenho tempo agora"
→ "Faz todo o sentido, e por causa disso que te escrevi. O video tem 3 minutos e ves quando conseguires. Se depois fizer sentido falar, falamos. Se nao, pelo menos ficas com as ideias."

"Manda info por email"
→ "Mando, mas a informacao generica nao te vai dizer nada util. Prefiro gravar-te 3 minutos especificos sobre o teu caso. E mais rapido para ti e muito mais concreto. Que tal?"

"Quanto custa?"
→ "Depende do que fizer sentido para o teu caso. E por isso que prefiro mostrar-te primeiro o video. Se fizer sentido, falamos de numeros com contexto. Se nao, nem chegamos ai."

"Nao tenho audiencia suficiente ainda"
→ "Compreendo. Posso ser franco? Se calhar ainda nao e o momento para avancarmos, mas e agora, antes de crescer, que se deve montar a estrutura. Se quiseres, o video tambem serve para isso. Mostro-te o que preparar antes de precisares."

"Ja tentei agencias antes e correu mal"
→ "Percebo perfeitamente e nao te culpo. A maior parte tenta por o criador a encaixar no processo delas, em vez de fazer o contrario. Nao te vou tentar convencer por texto. Ve o video e decides tu proprio. Se nao soar diferente, tens toda a razao em dizer que nao."

"Prefiro focar no conteudo, nao na monetizacao"
→ "Respeito isso. E por isso que muitos criadores nos procuram. Para continuarem focados no conteudo enquanto alguem trata do resto. Mas se sentires que ainda nao e o momento, tudo bem. A porta fica aberta."

"Como sei que vai funcionar comigo?"
→ "Sinceramente? Nao sabes, e eu tambem nao, ate olharmos para o teu caso concreto. E para isso que serve o video: olho para o que tens montado e digo-te honestamente se faz sentido ou nao. Se nao fizer, sou o primeiro a dizer."

"Tenho de pensar"
→ "Claro. So uma coisa, enquanto pensas, queres que te mande o video a mesma? Assim pensas com dados concretos em vez de pensares no abstrato. Se depois disseres que nao, fica por ai."

Category 4: Price question (explicit about cost/money)
Response:
"Depende do que fizer sentido para o teu caso, e por isso que prefiro mostrar-te primeiro o video. Se o que vires fizer sentido, falamos de numeros com contexto. Se nao fizer, nem chegamos ai."

Category 5: Direct no ("nao estou interessado", "nao obrigado")
Response:
"Sem problema, obrigado por responderes, muita gente nem isso faz. Boa sorte com o projeto, continua a mandar."

Category 6: Ambiguous or passive-aggressive response
Response:
"[This reply is ambiguous. Recommended: wait and don't respond immediately. Analyze the tone before proceeding.]"

Category 7: Asks for meeting, contract, formal proposal
Response:
"Boa, vou passar-te o contacto direto do Raul, ele responde-te hoje ainda."

## RULES
- Always use "tu", never "voce"
- Zero English words
- Zero agency jargon
- Zero emojis
- Sign as "— Raul" only if the response is long enough to warrant it
- For Category 1, replace [area concreta do buraco identificado] with the actual gap
- Output ONLY: the category number, category name, and the response. Nothing else.

## OUTPUT FORMAT
CATEGORY: [number] — [name]
RESPONSE:
[the response text]`;

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { creatorReply, originalDm, creatorName, buraco } = body;
  if (!creatorReply) return NextResponse.json({ error: 'Missing creator reply' }, { status: 400 });

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
        max_tokens: 800,
        system: REPLY_SYSTEM,
        messages: [{
          role: 'user',
          content: `Creator: ${creatorName || 'Unknown'}
Buraco identificado: ${buraco || 'N/A'}

Original DM sent:
${originalDm || 'N/A'}

Creator's reply:
"${creatorReply}"

Classify this reply and provide the appropriate response.`,
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Classification failed' }, { status: 500 });
    }

    const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');

    // Parse category and response
    const categoryMatch = rawText.match(/CATEGORY:\s*(.+)/);
    const responseMatch = rawText.match(/RESPONSE:\s*([\s\S]*)/);

    return NextResponse.json({
      category: categoryMatch ? categoryMatch[1].trim() : 'Unknown',
      response: responseMatch ? responseMatch[1].trim() : rawText,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
