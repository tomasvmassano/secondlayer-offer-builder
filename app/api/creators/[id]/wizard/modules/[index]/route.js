import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../../../lib/creators';
import { validateModule, VALID_FORMATS } from '../../../../../../lib/schemas/modules';
import { readCheckpointProgress } from '../../../../../../lib/offerSchema';
import { MODULES_SYSTEM_PROMPT } from '../route';

// ~$0.01-0.02 per call. Smaller output (one module) so max_tokens is reduced.
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────
// POST /api/creators/[id]/wizard/modules/[index]
//
// Single-module regeneration. Replaces ONLY the module at [index] in
// client_facing_output.modules — preserves everything else. This is the
// operator's escape hatch from regenerating the whole set when one module
// is wrong (the wrong format, weak transformation_delivered, generic name).
//
// Body (optional):
//   {
//     "instruction": "make this a live ritual instead of a recorded module"
//   }
//
// The instruction is appended to the prompt so the operator can steer the
// regen without re-running the whole batch.
//
// Pre-conditions:
//   - CP3 must NOT be locked (operator must unlock to regen)
//   - CP1 + CP2 must be locked (consistent with batch endpoint)
//   - [index] must be a valid integer in range
// ─────────────────────────────────────────────────────────────────

export async function POST(request, { params }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { id, index } = await params;
    const ix = parseInt(index, 10);
    if (!Number.isInteger(ix) || ix < 0) {
      return NextResponse.json({ error: 'Invalid module index (must be a non-negative integer)' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const instruction = typeof body.instruction === 'string' ? body.instruction.slice(0, 600) : null;

    const creator = await getCreator(id);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    const meta = creator.offer?.internal_metadata || {};
    const client = creator.offer?.client_facing_output || {};
    const progress = readCheckpointProgress(meta);
    if (!progress.locked[1] || !progress.locked[2]) {
      return NextResponse.json({ error: 'CP1 + CP2 must be locked before regenerating a module.' }, { status: 412 });
    }
    if (progress.locked[3]) {
      return NextResponse.json({ error: 'CP3 is locked — unlock it before regenerating modules.' }, { status: 412 });
    }

    const existingModules = Array.isArray(client.modules) ? client.modules : [];
    if (ix >= existingModules.length) {
      return NextResponse.json({ error: `Module index ${ix} out of range (only ${existingModules.length} modules)` }, { status: 400 });
    }

    const result = await runSingleModuleRegen(apiKey, creator, ix, instruction);
    if (result.error) {
      return NextResponse.json({ error: result.error, errors: result.errors, raw: result.raw }, { status: 502 });
    }

    // Splice the new module into place
    const newModules = existingModules.slice();
    newModules[ix] = result.data;

    await updateCreator(id, {
      offer: {
        ...creator.offer,
        client_facing_output: {
          ...client,
          modules: newModules,
        },
        internal_metadata: {
          ...meta,
          generation_timestamps: {
            ...(meta.generation_timestamps || {}),
            [`modules[${ix}]`]: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      index: ix,
      module: result.data,
      _diagnostics: { retries: result.retries },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Single-module regen failed' }, { status: 500 });
  }
}

async function runSingleModuleRegen(apiKey, creator, index, instruction, retryCount = 0) {
  const meta = creator.offer?.internal_metadata || {};
  const client = creator.offer?.client_facing_output || {};
  const frame = meta.strategic_frame || null;
  const uniqueness = meta.uniqueness_extraction || null;
  const elements = uniqueness?.unique_elements || [];
  const usableCount = elements.length;

  const elementsBlock = elements.map((e, i) =>
    `  [${i}] (${e.category} · ${e.monetization_potential}$${e.usable_in_modules ? ' · MOD' : ''}) ${e.element}`
  ).join('\n');

  const existingModule = (client.modules || [])[index];
  const otherModules = (client.modules || []).filter((_, i) => i !== index).map((m, i) => `  ${i + 1}. ${m.name} (${m.format}) → ${m.transformation_delivered}`).join('\n');

  const userMessage = `Regenerate ONLY the module at index ${index}. Preserve everything else.

## CONTEXT
Community: ${client.community_name}
Transformation: From "${client.transformation?.from}" → "${client.transformation?.to}" in ${client.transformation?.timeframe}
Core mechanic: ${client.core_mechanic}
Pricing: ${client.target_price}

## CP1 FRAME
Role: ${frame?.confirmed_role}
Tension: ${frame?.positioning_tension}

## OTHER MODULES (already in the set — DO NOT duplicate their angles)
${otherModules || '  (none)'}

## MODULE BEING REPLACED (for reference — feel free to change format, name, focus)
${existingModule ? JSON.stringify(existingModule, null, 2) : '(empty slot)'}

## PHASE 3 ELEMENTS — index by [N]
${elementsBlock || '(none)'}

CREATOR VOICE: ${uniqueness?.creator_voice_summary || '(none)'}

${instruction ? `## OPERATOR INSTRUCTION FOR THIS REGEN\n${instruction}\n\n` : ''}Return ONLY a JSON object for the SINGLE module (NOT wrapped in { "modules": [...] }):

{
  "name": "...",
  "description": "...",
  "transformation_delivered": "...",
  "format": "...",
  "linked_unique_elements": [...],
  "delivery_cadence": "..."
}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: MODULES_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    return { error: data.error?.message || `Anthropic ${resp.status}`, errors: [], raw: null, retries: retryCount };
  }

  const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const parsed = tryParseJson(rawText);
  if (!parsed) {
    if (retryCount < 1) return runSingleModuleRegen(apiKey, creator, index, (instruction || '') + '\nReturn ONLY a JSON object — no prose, no markdown fences.', retryCount + 1);
    return { error: 'Model returned non-JSON output after retry', raw: rawText, errors: [], retries: retryCount };
  }

  // If the model wrapped it in { modules: [...] } anyway, unwrap.
  const moduleObj = parsed.modules && Array.isArray(parsed.modules) && parsed.modules[0] ? parsed.modules[0] : parsed;

  const errors = validateModule(moduleObj, usableCount, 'module');
  if (errors.length > 0) {
    if (retryCount < 1) {
      const retryResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: MODULES_SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: userMessage },
            { role: 'assistant', content: rawText },
            { role: 'user', content: `Your output failed schema validation. Fix and resend ONLY the single-module JSON object.\n\nErrors:\n${errors.map(e => '- ' + e).join('\n')}` },
          ],
        }),
      });
      const retryData = await retryResp.json();
      if (retryResp.ok) {
        const retryText = (retryData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
        const retryParsed = tryParseJson(retryText);
        if (retryParsed) {
          const retryModuleObj = retryParsed.modules && Array.isArray(retryParsed.modules) && retryParsed.modules[0] ? retryParsed.modules[0] : retryParsed;
          const retryErrors = validateModule(retryModuleObj, usableCount, 'module');
          if (retryErrors.length === 0) return { data: retryModuleObj, retries: retryCount + 1 };
          return { error: 'Schema validation failed twice', errors: retryErrors, raw: retryText, retries: retryCount + 1 };
        }
      }
    }
    return { error: 'Schema validation failed', errors, raw: rawText, retries: retryCount };
  }

  return { data: moduleObj, retries: retryCount };
}

function tryParseJson(text) {
  if (!text) return null;
  let s = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(s.slice(start, i + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
}
