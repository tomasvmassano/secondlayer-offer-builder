#!/usr/bin/env node
/**
 * Compile app/knowledge/skills/<name>/SKILL.md + references/*.md
 * into a single app/knowledge/skills-bundle.json that the runtime imports.
 *
 * Why a bundle: the Vercel serverless runtime has no filesystem read of
 * arbitrary files at runtime. The bundle is a JS-importable JSON that
 * resolves at build time.
 *
 * Output shape:
 *   {
 *     "<skill-name>": {
 *       "systemPrompt": "<contents of SKILL.md>",
 *       "references": [{ "name": "<basename without .md>", "content": "..." }]
 *     }
 *   }
 *
 * Run: `npm run build:skills` (chained automatically by `npm run build`).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const skillsDir = path.join(root, 'app', 'knowledge', 'skills');
const outFile = path.join(root, 'app', 'knowledge', 'skills-bundle.json');

async function listDirs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => e.name);
}

async function safeReadDir(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function build() {
  const skills = await listDirs(skillsDir);
  skills.sort();

  const bundle = {};

  for (const name of skills) {
    const skillPath = path.join(skillsDir, name);
    const skillFile = path.join(skillPath, 'SKILL.md');

    let systemPrompt;
    try {
      systemPrompt = await fs.readFile(skillFile, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.warn(`[build-skills] ${name}: no SKILL.md, skipping`);
        continue;
      }
      throw e;
    }

    const referencesDir = path.join(skillPath, 'references');
    const refEntries = await safeReadDir(referencesDir);
    const references = [];
    for (const entry of refEntries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const content = await fs.readFile(path.join(referencesDir, entry.name), 'utf8');
      const refName = entry.name.replace(/\.md$/, '');
      references.push({ name: refName, content });
    }
    references.sort((a, b) => a.name.localeCompare(b.name));

    bundle[name] = { systemPrompt, references };
  }

  await fs.writeFile(outFile, JSON.stringify(bundle, null, 2) + '\n', 'utf8');

  const skillCount = Object.keys(bundle).length;
  const refCount = Object.values(bundle).reduce((n, s) => n + s.references.length, 0);
  console.log(`[build-skills] wrote ${skillCount} skills (${refCount} references) to ${path.relative(root, outFile)}`);
}

build().catch(err => {
  console.error('[build-skills] failed:', err);
  process.exit(1);
});
