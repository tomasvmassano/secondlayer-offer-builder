import skillsBundle from '../knowledge/skills-bundle.json';

/**
 * Load a skill's system prompt and all reference files from the pre-bundled JSON.
 * Works on Vercel serverless (no filesystem access needed).
 */
export function loadSkill(skillName) {
  const skill = skillsBundle[skillName];
  if (!skill) throw new Error(`Skill not found: ${skillName}`);
  return {
    systemPrompt: skill.systemPrompt,
    references: skill.references || [],
  };
}

/**
 * Load multiple skills and merge their prompts + references.
 */
export function loadSkills(skillNames) {
  const skills = skillNames.map(name => loadSkill(name));
  const systemPrompt = skills.map(s => s.systemPrompt).join('\n\n---\n\n');
  const references = skills.flatMap(s => s.references);
  return { systemPrompt, references };
}

/**
 * Format references as context for the Claude prompt.
 */
export function formatReferences(references, maxChars = 80000) {
  let total = 0;
  const parts = [];
  for (const ref of references) {
    if (total + ref.content.length > maxChars) break;
    parts.push(`## Reference: ${ref.name}\n\n${ref.content}`);
    total += ref.content.length;
  }
  return parts.join('\n\n---\n\n');
}

/**
 * List all installed skills.
 */
export function listSkills() {
  return Object.keys(skillsBundle);
}
