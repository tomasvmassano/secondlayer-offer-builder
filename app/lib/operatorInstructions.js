/**
 * Operator instruction handling for the wizard checkpoints (and any future
 * LLM route that takes a free-form "regenerate with this guidance" string).
 *
 * Background — bug discovered 2026-05-24:
 * Every wizard route (strategic-frame, core-offer, value-stack, modules,
 * sales-copy) accepted an `extraInstruction` field and stuck it at the very
 * BOTTOM of the user message, after thousands of tokens of profile + audit
 * + frame + uniqueness context. By the time the LLM read the instruction it
 * had already mentally locked into defaults — output ignored the operator's
 * direction.
 *
 * Same shape as the dm-writer "notes" bug fix (2026-05-21):
 *   1. Add a system-prompt directive explaining how to handle the block
 *   2. HOIST the instruction to the TOP of the user message with a loud
 *      header and a separator
 *   3. Add a reminder at the END of the user message — long prompts cause
 *      Claude to drift back to defaults right before generation
 *
 * Three exports, one for each role.
 */

/**
 * System-prompt block. Append this to every wizard SYSTEM_PROMPT so the
 * model knows how to treat the operator-instructions block when it sees
 * one at the top of the user message.
 *
 * Wording is intentionally explicit about override semantics — wizard
 * routes feed the model 5+ locked context layers (CP1 frame, CP2 offer,
 * Phase 1 audit, Phase 2 archetype, Phase 3 uniqueness). Without an
 * override rule the model treats those as immutable and ignores the
 * operator's regen direction.
 */
export const OPERATOR_INSTRUCTIONS_RULE = `## OPERATOR INSTRUCTIONS — HIGHEST PRIORITY

If the user message contains a "## OPERATOR INSTRUCTIONS" block at the top, treat that block as the operator's brief for THIS regeneration and apply it LITERALLY to every relevant field in the output JSON. Operator instructions override:
- Default tone, default phrasing, default scenario picks
- Default emphasis (e.g. "focus on community over courses" overrides any module-style default)
- Default product/format choices (e.g. "include in-person events, expert workshops, group classes" should reshape the modules, weekly_formats, library, value_stack, and pricing accordingly)
- Default voice calibration when the operator explicitly requests a shift

What operator instructions do NOT override:
- The output JSON schema (required fields, types, length limits)
- The defensibility chain (every module still needs linked_unique_elements)
- The locked language (don't switch from PT to EN unless the operator says so)
- Hard schema constraints (target_price still must be one of low|mid|high tiers, etc.)

Examples of operator instructions you'll see and how to interpret them:
- "make it more community-focused, with in-person events, classes with other experts, workshops" → reshape modules to lean on community_ritual + live_call formats with named in-person events. Restructure weekly_formats to feature live group sessions. Pricing positioning shifts to community-first language.
- "she's based in Brazil, use Brazilian PT not European PT" → switch the language calibration even though the default rule says European PT.
- "drop the 'Stride System Template' module — she doesn't have one yet" → remove that module from CP3 modules, leave the slot for a different uniqueness element.
- "this needs to be a higher ticket — €500/month not €67/month" → CP4 pricing reflects this, value_stack.total scales to maintain the 5-10× ratio.

NEVER silently ignore operator instructions. If something is genuinely impossible (e.g. "use 9 modules" but the schema caps at 8), pick the closest faithful interpretation and use the remaining schema slack to honor the spirit of the instruction.`;

/**
 * Hoist block — goes at the TOP of the user message, right after the
 * opening "Generate X for this creator" line and before the long context
 * blocks (profile / audit / frame / uniqueness).
 *
 * Returns an empty string when the operator didn't supply an instruction,
 * so callers can safely interpolate it unconditionally:
 *   const userMessage = `Generate X.\n\n${formatInstructionsBlock(extra)}${profile}\n...`;
 */
export function formatInstructionsBlock(instruction) {
  const trimmed = (instruction || '').trim();
  if (!trimmed) return '';
  return `## OPERATOR INSTRUCTIONS · APPLY TO EVERY FIELD
The operator wrote the following instructions for THIS regeneration. Treat them as the operator's brief — apply them literally to the output. They override default phrasing, default emphasis, and default product/format picks where they conflict. Do NOT paraphrase, do NOT skip them.

${trimmed}

---

`;
}

/**
 * Reminder — goes at the END of the user message, right before the final
 * "Return ONLY the JSON" line. Long user messages cause Claude to drift
 * back to defaults near the close; the reminder re-pings the directive
 * one last time.
 *
 * Returns empty string when no instruction was supplied (no noise added).
 */
export function formatInstructionsReminder(instruction) {
  const trimmed = (instruction || '').trim();
  if (!trimmed) return '';
  return `\n\n**Before you emit the JSON: re-read the OPERATOR INSTRUCTIONS at the top of this message. Every relevant field must reflect them. If a field still reflects defaults that contradict the instructions, REWRITE that field.**`;
}
