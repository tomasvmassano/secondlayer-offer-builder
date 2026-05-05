import { NextResponse } from 'next/server';
import { loadSkills, formatReferences } from '../../lib/skills';

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { system, message, skills: requestedSkills } = body;
  if (!message) {
    return NextResponse.json(
      { error: 'Missing required field: message' },
      { status: 400 }
    );
  }

  // Compose final system prompt: skills (if requested) + caller's system text.
  // Skills are loaded server-side from the compiled bundle so they don't ship
  // in the client JS. Caller passes ['hundred-million-offers', 'money-model', ...].
  let composedSystem = system || '';
  if (Array.isArray(requestedSkills) && requestedSkills.length > 0) {
    try {
      const { systemPrompt: skillsPrompt, references } = loadSkills(requestedSkills);
      const refsBlock = references.length > 0
        ? '\n\n---\n\n## DEEPER REFERENCES\n\n' + formatReferences(references, 30000)
        : '';
      composedSystem = `${skillsPrompt}${refsBlock}\n\n---\n\n${composedSystem}`.trim();
    } catch (err) {
      return NextResponse.json({ error: `Skill load failed: ${err.message}` }, { status: 400 });
    }
  }

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
        max_tokens: 16000,
        system: composedSystem,
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || 'Anthropic API error', details: data },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to reach Anthropic API', details: err.message },
      { status: 502 }
    );
  }
}
