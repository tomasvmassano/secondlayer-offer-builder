import { NextResponse } from 'next/server';

/**
 * Translate audience data block to a target language.
 * Used by the pitch deck to ensure audience labels match creator's primaryLanguage.
 *
 * Input:  { audience: {gender, age, location, language, interests}, targetLanguage: "pt"|"en"|"es" }
 * Output: { audience: same shape but translated }
 */
export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { audience, targetLanguage } = body;
  if (!audience || !targetLanguage) {
    return NextResponse.json({ error: 'audience and targetLanguage required' }, { status: 400 });
  }

  const targetLangFull = targetLanguage === 'pt'
    ? 'European Portuguese'
    : targetLanguage === 'es'
    ? 'Castilian Spanish (España, "tú" form)'
    : 'English';

  const prompt = `Translate the following audience data block to ${targetLangFull}. Preserve the structure exactly. Translate ALL text including country names, demographics, percentages stay as numbers but labels translate.

Examples of translation:
- "65% Female, 35% Male" → "65% Feminino, 35% Masculino" (PT) / "65% Femenino, 35% Masculino" (ES)
- "Portugal 70%, Other Portuguese speaking countries 30%" → "Portugal 70%, Outros países lusófonos 30%" (PT)
- "Spain 70%, Other Spanish speaking countries 30%" → "España 70%, Otros países hispanohablantes 30%" (ES)
- "25-34" → "25-34" (numbers stay)
- "English 80%, Portuguese 20%" → "Inglês 80%, Português 20%" (PT) / "Inglés 80%, Portugués 20%" (ES)
- "Healthy Lifestyle, Meal Prep" → "Estilo de Vida Saudável, Preparação de Refeições" (PT) / "Estilo de Vida Saludable, Preparación de Comidas" (ES)

Input audience:
${JSON.stringify(audience, null, 2)}

Respond with ONLY the translated JSON object in this exact format (no markdown, no commentary):
{
  "gender": "...",
  "age": "...",
  "location": "...",
  "language": "...",
  "interests": ["...", "..."]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Translation failed' }, { status: 500 });
    }

    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();

    // Strip code fences if Claude added them
    let jsonText = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();

    // Find first { and last } in case there's surrounding prose
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonText = jsonText.slice(firstBrace, lastBrace + 1);
    }

    let translated;
    try {
      translated = JSON.parse(jsonText);
    } catch (parseErr) {
      return NextResponse.json({
        error: 'Could not parse translation response',
        raw: text.slice(0, 500),
      }, { status: 500 });
    }

    return NextResponse.json({ audience: translated, targetLanguage });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
