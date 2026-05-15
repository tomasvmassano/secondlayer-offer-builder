"use client";
import React from "react";

export function Badge({ status }) {
  const c = { GREEN: "#22c55e", YELLOW: "#eab308", RED: "#dc2626" }[status] || "#eab308";
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", background: c + "14", color: c, border: "1px solid " + c + "33", textTransform: "uppercase" }}>{status}</span>;
}

// ─────────────────────────────────────────────────────────────────
// OFFER PARSER — extracts the new A-O Hormozi format (15 sections)
// into structured fields the pitch deck reads from.
//
// New format (v3.0): sections A-O with "## A. AVALIAÇÃO DE MERCADO" headers.
// Old format (v2.0): sections "## OUTPUT 1" through "## OUTPUT 6".
// Both are detected — keeps existing offers in Redis backward-compatible.
//
// Resilient to: minor LLM formatting variance, missing sections,
// language switches (PT/EN). Falls back to raw text if a section
// is missing — never throws.
// ─────────────────────────────────────────────────────────────────

// Old format: 6 numbered outputs.
const OUTPUT_HEADERS = [
  /#{1,4}\s*(?:OUTPUT|SA[IÍ]DA|RESULTADO)\s*1[^\n]*/i,  // 0 — Community
  /#{1,4}\s*(?:OUTPUT|SA[IÍ]DA|RESULTADO)\s*2[^\n]*/i,  // 1 — Cases
  /#{1,4}\s*(?:OUTPUT|SA[IÍ]DA|RESULTADO)\s*3[^\n]*/i,  // 2 — Math
  /#{1,4}\s*(?:OUTPUT|SA[IÍ]DA|RESULTADO)\s*4[^\n]*/i,  // 3 — Grand Slam (Mechanism + Value Stack)
  /#{1,4}\s*(?:OUTPUT|SA[IÍ]DA|RESULTADO)\s*5[^\n]*/i,  // 4 — Blind Spots
  /#{1,4}\s*(?:OUTPUT|SA[IÍ]DA|RESULTADO)\s*6[^\n]*/i,  // 5 — Objections
];

function splitByOutputs(text) {
  const positions = OUTPUT_HEADERS.map(re => text.search(re));
  const sections = ['', '', '', '', '', ''];
  for (let i = 0; i < 6; i++) {
    if (positions[i] === -1) continue;
    const startBody = text.indexOf('\n', positions[i]) + 1;
    let end = text.length;
    for (let j = i + 1; j < 6; j++) {
      if (positions[j] !== -1) { end = positions[j]; break; }
    }
    sections[i] = text.slice(startBody, end).trim();
  }
  return sections;
}

// New format: detect "## <LETTER>." section headers (## A. ... through ## O.).
// Tolerant to: ##, ###, optional bold markers, optional whitespace.
function sectionHeaderRe(letter) {
  return new RegExp(`(?:^|\\n)\\s*#{1,4}\\s*\\**\\s*${letter}\\.\\s+`, 'i');
}

// Extract one section by letter. Returns the body between the section header
// and the start of the next section letter (or end of document).
function extractSection(text, letter) {
  if (!text) return '';
  const startRe = sectionHeaderRe(letter);
  const startMatch = text.match(startRe);
  if (!startMatch) return '';
  const headerEnd = text.indexOf('\n', startMatch.index + startMatch[0].length);
  const startIdx = headerEnd === -1 ? text.length : headerEnd + 1;
  // Find next letter A-Z header after this one.
  const code = letter.toUpperCase().charCodeAt(0);
  let endIdx = text.length;
  for (let i = code + 1; i <= 'Z'.charCodeAt(0); i++) {
    const next = String.fromCharCode(i);
    const m = text.slice(startIdx).match(sectionHeaderRe(next));
    if (m) { endIdx = startIdx + m.index; break; }
  }
  return text.slice(startIdx, endIdx).trim();
}

// Detect whether text is in the new A-O format.
function isNewFormat(text) {
  // Look for at least 3 of the canonical section letters (A, D, E, K) — the ones
  // the pitch deck depends on. 3+ matches → confidently new format.
  const probes = ['A', 'D', 'E', 'K', 'L'];
  let hits = 0;
  for (const l of probes) if (sectionHeaderRe(l).test(text)) hits++;
  return hits >= 3;
}

// ─── Tolerant matchers ─────────────────────────────────────────
// Handles all of these LLM output variations:
//   **Field Name:** value
//   Field Name: value
//   **Nome do Campo:** valor       (PT translation, with markers)
//   Nome do Campo: valor           (PT translation, no markers)
// Bullets: -  *  •  ■  →  any of these counts as a bullet.

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(s) {
  // Lowercase + strip diacritics for label matching.
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const BULLET = '[-*•■]';   // any single-char bullet
const FIELD_PREFIX = '\\**';  // optional ** before label

function tryLabels(labels) {
  // Build alternation of all label variants, escaped.
  return labels.map(l => escapeRegex(l)).join('|');
}

// Extract the value of `Label: value` (single line). Accepts PT/EN aliases.
// Tolerant to: optional leading bullet ([-*•■]), optional **bold**, label (with diacritics), optional **bold** after, : or -, value.
function extractField(block, ...labels) {
  if (!block) return '';
  const alt = tryLabels(labels);
  const re = new RegExp(`(?:^|\\n)\\s*${BULLET}?\\s*${FIELD_PREFIX}\\s*(?:${alt})\\s*${FIELD_PREFIX}\\s*[:\\-]\\s*([^\\n]+)`, 'i');
  const m = block.match(re);
  return m ? m[1].trim().replace(/\*\*/g, '').replace(/^["']|["']$/g, '') : '';
}

// Extract a bullet list following `Label:`. Tolerant to:
//   - trailing text on the label line (e.g. `**Weekly Content Formats:** (NAMED...)`),
//   - blank lines OR paragraphs of explanatory prose between the label and the first bullet,
//   - bullets using any of - * • ■.
// Stops at the next field marker (`**...:**`), section header (`## ...`), or numbered
// section letter (`A.`, `B.`, ...). Used for both flat lists (Weekly Rhythm) and
// rich lists (Weekly Content Formats / Pre-recorded Library).
function extractList(block, ...labels) {
  if (!block) return [];
  const alt = tryLabels(labels);
  // Match the label (allow any trailing text on the same line — stops at newline).
  const labelRe = new RegExp(
    `(?:^|\\n)\\s*${BULLET}?\\s*${FIELD_PREFIX}\\s*(?:${alt})\\s*${FIELD_PREFIX}\\s*[:\\-][^\\n]*`,
    'i'
  );
  const m = block.match(labelRe);
  if (!m) return [];
  const after = block.slice(m.index + m[0].length);
  const lines = after.split('\n');
  const out = [];
  let started = false;
  const bulletStartRe = new RegExp(`^\\s*${BULLET}\\s+(.+)$`);
  for (const line of lines) {
    if (!line.trim()) {
      if (started) break;    // collected items and hit a paragraph break → done
      continue;              // pre-list blank line → keep scanning
    }
    const bm = line.match(bulletStartRe);
    if (bm) {
      out.push(bm[1].trim());
      started = true;
      continue;
    }
    // Non-blank, non-bullet line.
    if (started) break;      // a paragraph after the list → done
    // Before any bullet found: stop if this is clearly the start of another
    // field / section / sub-block; otherwise treat as explanatory prose and
    // keep scanning for the first bullet.
    if (/^\s*\*\*[^*]+:\*\*/.test(line)) break;   // **Next Field:**
    if (/^#{1,4}\s/.test(line)) break;             // ## Section
    if (/^\s*[A-Z]\.\s/.test(line)) break;         // A. SECTION
  }
  return out;
}

// Extract a sub-block (e.g., everything under "Tier 1 — Recommended:" until the next sub-block boundary).
// Tolerant to leading bullets on the label line.
function extractSubBlock(block, ...labels) {
  if (!block) return '';
  const alt = tryLabels(labels);
  const re = new RegExp(`(?:^|\\n)\\s*${BULLET}?\\s*${FIELD_PREFIX}\\s*(?:${alt})\\s*${FIELD_PREFIX}\\s*[:\\-]?\\s*\\n([\\s\\S]*?)(?=\\n\\s*\\*\\*|\\n\\s*[A-Z][^\\n]{0,40}:\\s*\\n|$)`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

// Parse a tier sub-block (lines like "- Name: X" or "Nome: X") into {name, price, note}.
// Tolerant to any bullet prefix and EN/PT field labels.
function parseTier(subBlock) {
  if (!subBlock) return null;
  const grab = (...keys) => {
    for (const key of keys) {
      const re = new RegExp(`(?:^|\\n)\\s*${BULLET}?\\s*${escapeRegex(key)}\\s*[:\\-]\\s*([^\\n]+)`, 'i');
      const m = subBlock.match(re);
      if (m) return m[1].trim().replace(/\*\*/g, '');
    }
    return '';
  };
  const name  = grab('Name', 'Nome');
  const price = grab('Price', 'Preço', 'Preco');
  const note  = grab('Note', 'Nota', 'Inclui');
  if (!name && !price && !note) return null;
  return { name, price, note };
}

// Parse a weekly-format bullet into {day, name, type, desc}. Designed to swallow
// almost any separator pattern an LLM might emit, since the same intent shows up
// in wildly different syntaxes:
//
//   - Seg · "Carta da Semana™": Post — Rui partilha o menu da semana
//   - Seg — Carta da Semana™ — Post — Rui partilha...
//   - Seg: Name™ (Post) — desc
//   - **Seg** · Name™ | Type | desc
//   - Segunda · "Name™": Live 30min — desc
//
// Strategy: a 4-step tokenizer instead of one giant regex.
function parseWeeklyFormatLine(line) {
  if (!line) return null;
  // Strip leading bullet, bold markers, and any wrapping brackets/asterisks.
  let s = String(line).replace(/^\s*[-*•■]\s*/, '').replace(/\*\*/g, '').trim();

  // STEP 1 — day token (short word, accented chars allowed).
  const dayMatch = s.match(/^([A-Za-zÁÉÍÓÚÂÊÔÃÕáéíóúâêôãõ]{2,12})\.?/);
  if (!dayMatch) return null;
  const day = dayMatch[1];
  s = s.slice(dayMatch[0].length).trim();

  // STEP 2 — eat day→name separator (any combination of · . : - — / | space).
  s = s.replace(/^[\s·•.:—\-–/|]+/, '').trim();

  // STEP 3 — extract name. Either wrapped in quotes (any quote style) or read up
  // to the next structural separator. Trailing ™ is normalized.
  let name = '';
  const QUOTE = `["'""'„«»]`;
  const quoteRe = new RegExp(`^${QUOTE}([^${QUOTE.slice(1, -1)}\n]+?)${QUOTE}`);
  const qm = s.match(quoteRe);
  if (qm) {
    name = qm[1].trim();
    s = s.slice(qm[0].length).trim();
  } else {
    // No quotes — name runs until the next : — - · | ( or end of line.
    const nm = s.match(/^([^:—\-·|()\n,]+?)(?=\s*[:—\-·|(,]|$)/);
    if (nm) {
      name = nm[1].trim();
      s = s.slice(nm[0].length).trim();
    }
  }
  if (!name) return null;
  // Strip a trailing ™ if present, then always re-append so every name has it.
  name = name.replace(/[™\s]+$/, '').trim();
  if (name) name = name + '™';

  // STEP 4 — eat name→type separator. May be `:`, `—`, `·`, `|`, `,` or `(`.
  let typeInParen = false;
  s = s.replace(/^[\s·•.:—\-–/|,]+/, '').trim();
  if (s.startsWith('(')) { s = s.slice(1).trim(); typeInParen = true; }

  // STEP 5 — type + description. Type is a short label (≤ 32 chars) followed by
  // a separator. If no separator is found inside the cap, treat everything as desc.
  let type = '';
  let desc = '';
  if (typeInParen) {
    const m = s.match(/^([^)\n]{1,40}?)\)\s*[\s·•.:—\-–/|,]*\s*(.*)$/);
    if (m) { type = m[1].trim(); desc = m[2].trim(); }
    else { desc = s.replace(/^[^)\n]*\)?\s*/, '').trim(); }
  } else {
    const m = s.match(/^([^:—\-·|()\n,]{1,32}?)\s*[:—\-–·|,]\s*(.+)$/);
    if (m) { type = m[1].trim(); desc = m[2].trim(); }
    else { desc = s; }
  }

  return { day, name, type, desc };
}

// Parse a '"Name" — Format — description' library line.
function parseLibraryLine(line) {
  const cleaned = line.replace(/\*\*/g, '').trim();
  // Format: "Name" — Format — description
  const m = cleaned.match(/^["'""]?([^"'""\n—\-]+?)["'""™]*?\s*[—\-:]\s*([^—\-:\n]+?)\s*[—\-:]\s*(.+)$/);
  if (m) return { name: m[1].trim().replace(/™$/, '') + '™', format: m[2].trim(), desc: m[3].trim() };
  // Looser fallback: just "Name — description" (skipping format)
  const m2 = cleaned.match(/^["'""]?([^"'""\n—\-]+?)["'""™]*?\s*[—\-:]\s*(.+)$/);
  if (m2) return { name: m2[1].trim().replace(/™$/, '') + '™', format: '', desc: m2[2].trim() };
  return null;
}

// ─── Output 1: COMMUNITY ───
function parseCommunity(block) {
  if (!block) return null;
  const weeklyFormatsRaw = extractList(block, 'Weekly Content Formats', 'Formatos Semanais', 'Formatos de Conteúdo', 'Formatos de Conteudo');
  const libraryRaw       = extractList(block, 'Pre-recorded Library', 'Biblioteca Pré-Gravada', 'Biblioteca Pre-Gravada', 'Biblioteca');
  const c = {
    primaryName: extractField(block, 'Community Name (Primary)', 'Nome da Comunidade (Principal)', 'Nome (Principal)', 'Primary Name'),
    nameCandidates: extractList(block, 'Community Name (Candidates)', 'Nomes da Comunidade (Candidatos)', 'Candidatos', 'Name Candidates'),
    platform: extractField(block, 'Platform', 'Plataforma'),
    mechanic: extractField(block, 'Core Mechanic', 'Mecânica Central', 'Mecanica Central', 'Mecânica'),
    tiers: [
      parseTier(extractSubBlock(block, 'Tier 1 — Recommended', 'Tier 1 — Recomendado', 'Tier 1 - Recomendado', 'Tier 1')),
      parseTier(extractSubBlock(block, 'Tier 2 — Annual Prepay', 'Tier 2 — Pagamento Anual', 'Tier 2 - Pagamento Anual', 'Tier 2 — Anual', 'Tier 2')),
      parseTier(extractSubBlock(block, 'Tier 3 — Anchor (Ultra-High-Ticket)', 'Tier 3 — Âncora (Ultra-Premium)', 'Tier 3 - Âncora (Ultra-Premium)', 'Tier 3 — Âncora', 'Tier 3')),
    ].filter(Boolean),
    weeklyRhythm: extractList(block, 'Weekly Rhythm', 'Ritmo Semanal', 'Ritmo'),
    weeklyFormats: weeklyFormatsRaw.map(parseWeeklyFormatLine).filter(Boolean),
    library: libraryRaw.map(parseLibraryLine).filter(Boolean),
    bonuses: extractList(block, 'Bonuses Unlocked Over Time', 'Bónus Desbloqueados ao Longo do Tempo', 'Bonus Desbloqueados', 'Bónus', 'Bonuses'),
    differentiator: extractField(block, 'Differentiator', 'Diferenciador', 'Diferencial', 'O que torna isto diferente'),
  };
  return c;
}

// ─── Output 2: CASES ───
function parseCases(block) {
  if (!block) return [];
  const cases = [];
  for (let i = 1; i <= 5; i++) {
    // Tolerant to **Case N:**, Caso N:, Case N -, etc.
    const re = new RegExp(`${FIELD_PREFIX}\\s*(?:Case|Caso)\\s*${i}\\s*[:\\-]?\\s*${FIELD_PREFIX}\\s*\\n([\\s\\S]*?)(?=\\n\\s*${FIELD_PREFIX}\\s*(?:Case|Caso)\\s*${i + 1}|\\n\\s*\\*\\*[A-ZÁÉÍÓÚ]|$)`, 'i');
    const m = block.match(re);
    if (!m) break;
    const sub = m[1];
    const grab = (...keys) => {
      for (const key of keys) {
        const fm = sub.match(new RegExp(`(?:^|\\n)\\s*${BULLET}?\\s*${escapeRegex(key)}\\s*[:\\-]\\s*([^\\n]+)`, 'i'));
        if (fm) return fm[1].trim().replace(/\*\*/g, '');
      }
      return '';
    };
    cases.push({
      name:    grab('Name', 'Nome'),
      niche:   grab('Niche', 'Nicho'),
      members: grab('Members', 'Membros'),
      price:   grab('Price', 'Preço', 'Preco'),
      mrr:     grab('MRR'),
      resume:  grab('Resume', 'Resumo', 'Descrição', 'Descricao'),
      why:     grab('Why this matters', 'Why', 'Porque importa', 'Porque é importante'),
    });
  }
  return cases;
}

// ─── Output 4: GRAND SLAM (Unique Mechanism + Value Stack) ───
function parseUniqueMechanism(block) {
  if (!block) return null;
  // First try the explicit field markers we ask for.
  let name = extractField(block, 'Unique Mechanism Name', 'Nome do Mecanismo Único', 'Nome do Mecanismo Unico', 'Nome do Mecanismo', 'Mecanismo Único', 'Mecanismo Unico', 'Mechanism Name');
  // Fallback: find a "D. MECANISMO ÚNICO" / "D. UNIQUE MECHANISM" sub-section and look for "Nome:" inside it.
  if (!name) {
    const sectionRe = /(?:^|\n)\s*\**\s*(?:D\.?\s*)?(?:MECANISMO ÚNICO|MECANISMO UNICO|UNIQUE MECHANISM)\s*\**\s*\n([\s\S]*?)(?=\n\s*(?:[A-Z]\.|E\.|F\.|G\.|H\.|I\.|J\.|K\.|##|---|$))/i;
    const sm = block.match(sectionRe);
    if (sm) {
      // Inside that section, find "Nome:" or "Name:"
      const nameRe = /(?:^|\n)\s*[-*•■]?\s*\**\s*(?:Nome|Name)\s*\**\s*[:\-]\s*([^\n]+)/i;
      const nm = sm[1].match(nameRe);
      if (nm) name = nm[1].trim().replace(/\*\*/g, '').replace(/^["']|["']$/g, '');
    }
  }
  let description = extractField(block, 'Unique Mechanism Description', 'Descrição do Mecanismo Único', 'Descricao do Mecanismo Unico', 'Descrição do Mecanismo', 'Descricao do Mecanismo', 'Mechanism Description', 'Explicação', 'Explicacao');
  const lettersListRaw = extractList(block, 'Unique Mechanism Letters', 'Letras do Mecanismo Único', 'Letras do Mecanismo', 'Mechanism Letters', 'Letras', 'Steps', 'Passos', 'Phases', 'Fases');
  const letters = lettersListRaw.map(line => {
    const cleaned = line.replace(/\*\*/g, '').trim();
    // Phase-style: "Phase N — Word: 1 sentence" or "Fase N — Palavra: 1 frase".
    // Display the number as the "letter" so it renders as a big 1/2/3 in the pitch deck.
    let m = cleaned.match(/^(?:Phase|Fase|Step|Passo|Stage|Etapa)\s+(\d+)\s*[—\-]\s*([^:—\-]+?)\s*[:\-]\s*(.+)$/i);
    if (m) return { letter: m[1].trim(), word: m[2].trim(), explanation: m[3].trim() };
    // Acronym style: "X — Word: 1 sentence" OR "X - Word: 1 sentence"
    m = cleaned.match(/^([A-Za-zÁÉÍÓÚ])\s*[—\-:]\s*([^:]+?)\s*[:\-]\s*(.+)$/);
    if (m) return { letter: m[1].trim(), word: m[2].trim(), explanation: m[3].trim() };
    // Fallback: "X — Word — explanation"
    m = cleaned.match(/^([A-Za-zÁÉÍÓÚ])\s*[—\-]\s*([^—\-]+)\s*[—\-]\s*(.+)$/);
    if (m) return { letter: m[1].trim(), word: m[2].trim(), explanation: m[3].trim() };
    return { letter: '', word: cleaned, explanation: '' };
  });
  if (!name && letters.length === 0 && !description) return null;
  return { name, letters, description };
}

function parseValueStack(block) {
  if (!block) return null;
  // Find the Value Stack section header (multilang, with or without bold)
  const headerRe = new RegExp(`${FIELD_PREFIX}\\s*(?:Value Stack|Stack de Valor|Value Stack Problema-Solução|Value Stack Problema-Solucao)\\s*[:]?${FIELD_PREFIX}\\s*\\n`, 'i');
  const hMatch = block.match(headerRe);
  if (!hMatch) return null;
  const startIdx = hMatch.index + hMatch[0].length;
  // Stop at "Value Stack Total" (or PT variant) or next major bold heading.
  const stopRe = new RegExp(`\\n\\s*${FIELD_PREFIX}\\s*(?:Value Stack Total|Total do Stack|Total Empilhado|Valor Total|F\\.|G\\.|H\\.)`, 'i');
  const stopMatch = block.slice(startIdx).match(stopRe);
  const endIdx = stopMatch ? startIdx + stopMatch.index : block.length;
  const tableText = block.slice(startIdx, endIdx);

  const items = [];
  // Markdown table rows: | # | Problem | Solution | (optional Sexy Name) | Delivery | Value |
  // Be flexible — count pipes per row, take last col as price, second-to-last as delivery.
  const rows = tableText.split('\n').filter(l => /^\s*\|/.test(l));
  for (const row of rows) {
    const cells = row.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1 || (i > 0 && arr[arr.length - 1] !== ''));
    // Skip header / separator rows
    if (cells.length < 3) continue;
    if (cells.every(c => /^[-:\s]+$/.test(c))) continue;
    if (cells[0].toLowerCase().match(/^(#|problem|problema|solu|delivery|entrega|value|valor)/)) continue;
    // Strip leading number column if present.
    if (/^\d+$/.test(cells[0])) cells.shift();
    if (cells.length < 3) continue;
    const dollarValue = cells[cells.length - 1];
    const delivery = cells[cells.length - 2];
    const problem = cells[0];
    // If 4 remaining cols (problem, solution, sexy-name, delivery, value), merge solution+sexy-name with " — ".
    let solution;
    if (cells.length >= 5) {
      solution = `${cells[1]} (${cells[2]})`;  // solution (sexy name)
    } else {
      solution = cells[1];
    }
    items.push({ problem, solution, delivery, dollarValue });
  }
  const total = extractField(block, 'Value Stack Total', 'Total do Stack', 'Valor Total', 'Total Empilhado');
  const actualPrice = extractField(block, 'Value Stack Actual Price', 'Preço Real', 'Preco Real', 'Preço Mensal Recomendado', 'Preço');
  if (items.length === 0 && !total) return null;
  return { items, total, actualPrice };
}

// ─── Main parser ───
//
// Returns:
//   offer       — markdown shown on the "Grand Slam Offer" tab (engineering
//                 layer + community + cases; excludes math).
//   math        — markdown used by the projection/revenue tools.
//   (blindspots + objections — the "Blind Spot Audit" + "Objection Playbook"
//   tabs were removed. The system prompt no longer generates sections N + O,
//   so these fields will be empty on new offers. Parser still extracts them
//   from legacy offers for back-compat; they don't render anywhere.)
//   community   — structured spec for pitch slide "A Tua Comunidade".
//   cases       — array for pitch slide "Casos Similares".
//   uniqueMechanism — for pitch slide "O Sistema".
//   valueStack  — for pitch slide "O Valor".
export function parseOutput(text) {
  if (!text) return { raw: text, offer: '', blindspots: '', objections: '' };

  // ─── New format (v3.0): A-O sections ───
  if (isNewFormat(text)) {
    const secD = extractSection(text, 'D');
    const secE = extractSection(text, 'E');
    const secK = extractSection(text, 'K');
    const secL = extractSection(text, 'L');
    const secM = extractSection(text, 'M');
    const secN = extractSection(text, 'N');
    const secO = extractSection(text, 'O');

    // The "Grand Slam Offer" tab shows everything from A through L (engineering
    // + community + cases). M/N/O have their own tabs. If we can find the M
    // header, slice up to it; otherwise fall back to the full text.
    const mHeader = text.match(sectionHeaderRe('M'));
    const offerView = mHeader ? text.slice(0, mHeader.index).trim() : text;

    // Parsers below scan whole text — they look for explicit field markers
    // wherever they appear, so they're tolerant if a section is mis-lettered.
    return {
      offer:           offerView,
      blindspots:      secN,
      objections:      secO,
      community:       parseCommunity(secK || text),
      cases:           parseCases(secL || text),
      math:            secM,
      uniqueMechanism: parseUniqueMechanism(secD || text),
      valueStack:      parseValueStack(secE || text),
      grandSlamRaw:    text,
    };
  }

  // ─── Old format (v2.0): OUTPUT 1-6 ───
  const [outCommunity, outCases, outMath, outGrandSlam, outBlindSpots, outObjections] = splitByOutputs(text);
  return {
    offer:           outCommunity || outGrandSlam || text,
    blindspots:      outBlindSpots,
    objections:      outObjections,
    community:       parseCommunity(outCommunity),
    cases:           parseCases(outCases),
    math:            outMath,
    uniqueMechanism: parseUniqueMechanism(outGrandSlam),
    valueStack:      parseValueStack(outGrandSlam),
    grandSlamRaw:    outGrandSlam,
  };
}

export function renderInline(t) {
  if (typeof t !== "string") return t;
  const p = []; let r = t, k = 0;
  while (r.length > 0) {
    const m = r.match(/\*\*(.+?)\*\*/);
    if (m) { if (m.index > 0) p.push(<span key={k++}>{r.slice(0, m.index)}</span>); p.push(<strong key={k++} style={{ color: "#E2E4DF", fontWeight: 600 }}>{m[1]}</strong>); r = r.slice(m.index + m[0].length); }
    else { p.push(<span key={k++}>{r}</span>); break; }
  }
  return p;
}

export function renderMd(md) {
  if (!md) return null;
  const lines = md.split("\n"), el = [];
  let tRows = [], inT = false, tK = 0;
  const flushT = () => {
    if (tRows.length > 0) {
      const h = tRows[0], d = tRows.slice(1);
      el.push(<div key={"t" + tK++} style={{ overflowX: "auto", margin: "14px 0", borderRadius: 4, border: "1px solid #1e1b17" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "#7A0E1808" }}>{h.map((c, i) => <th key={i} style={{ padding: "9px 12px", textAlign: "left", borderBottom: "1px solid #1e1b17", color: "#6b6860", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>{c}</th>)}</tr></thead>
          <tbody>{d.map((row, ri) => <tr key={ri} style={{ borderBottom: "1px solid #0f0d0a" }}>{row.map((cell, ci) => {
            const st = /\b(GREEN|YELLOW|RED)\b/.test(cell);
            return <td key={ci} style={{ padding: "9px 12px", color: "#c5c3be", verticalAlign: "top", fontSize: 12 }}>{st ? <><Badge status={cell.match(/\b(GREEN|YELLOW|RED)\b/)[1]} /> {cell.replace(/\b(GREEN|YELLOW|RED)\b/, "").trim()}</> : renderInline(cell)}</td>;
          })}</tr>)}</tbody>
        </table></div>);
      tRows = [];
    }
    inT = false;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim().startsWith("|") && l.trim().endsWith("|")) {
      const cells = l.split("|").slice(1, -1).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) continue;
      tRows.push(cells); inT = true; continue;
    }
    if (inT) flushT();
    if (/^####\s/.test(l)) el.push(<h4 key={i} style={{ fontSize: 13, fontWeight: 700, color: "#E2E4DF", margin: "16px 0 5px" }}>{renderInline(l.replace(/^####\s*/, ""))}</h4>);
    else if (/^###\s/.test(l)) el.push(<h3 key={i} style={{ fontSize: 14, fontWeight: 700, color: "#7A0E18", margin: "22px 0 7px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{renderInline(l.replace(/^###\s*/, ""))}</h3>);
    else if (/^##\s/.test(l)) el.push(<h2 key={i} style={{ fontSize: 16, fontWeight: 700, color: "#E2E4DF", margin: "26px 0 9px" }}>{renderInline(l.replace(/^##\s*/, ""))}</h2>);
    else if (/^---+$/.test(l.trim())) el.push(<hr key={i} style={{ border: "none", borderTop: "1px solid #1e1b17", margin: "18px 0" }} />);
    else if (/^\d+\.\s/.test(l)) {
      const c = l.replace(/^\d+\.\s*/, ""), sm = c.match(/^\*\*(GREEN|YELLOW|RED)\*\*/);
      el.push(<div key={i} style={{ padding: "7px 0 7px 12px", borderLeft: "2px solid #1e1b17", marginLeft: 4, marginBottom: 2 }}>{sm && <><Badge status={sm[1]} />{" "}</>}<span style={{ color: "#c5c3be", fontSize: 13, lineHeight: 1.6 }}>{renderInline(sm ? c.replace(/^\*\*(GREEN|YELLOW|RED)\*\*\s*[-:]?\s*/, "") : c)}</span></div>);
    }
    else if (/^[-*]\s/.test(l.trim())) el.push(<div key={i} style={{ padding: "2px 0 2px 16px", color: "#c5c3be", fontSize: 13 }}><span style={{ color: "#7A0E18", marginRight: 8, fontSize: 7 }}>&#9632;</span>{renderInline(l.trim().replace(/^[-*]\s*/, ""))}</div>);
    else if (l.trim() === "") el.push(<div key={i} style={{ height: 5 }} />);
    else el.push(<p key={i} style={{ margin: "3px 0", color: "#9a9890", fontSize: 13, lineHeight: 1.65 }}>{renderInline(l)}</p>);
  }
  if (inT) flushT();
  return el;
}

export function extractAudience(platforms) {
  if (!platforms) return 0;
  const nums = platforms.match(/(\d+(?:[.,]\d+)?)\s*[kKmM]?/g) || [];
  let total = 0;
  nums.forEach(n => {
    let v = parseFloat(n.replace(",", "."));
    if (/k/i.test(n)) v *= 1000;
    if (/m/i.test(n)) v *= 1000000;
    total += v;
  });
  return Math.round(total);
}
