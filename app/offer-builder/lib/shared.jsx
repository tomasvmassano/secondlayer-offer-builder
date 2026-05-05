"use client";
import React from "react";

export function Badge({ status }) {
  const c = { GREEN: "#22c55e", YELLOW: "#eab308", RED: "#dc2626" }[status] || "#eab308";
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", background: c + "14", color: c, border: "1px solid " + c + "33", textTransform: "uppercase" }}>{status}</span>;
}

// ─────────────────────────────────────────────────────────────────
// OFFER PARSER — extracts all 6 outputs of the new Offer Builder
// into structured fields the pitch deck reads from.
//
// Resilient to: minor LLM formatting variance, missing sections,
// language switches (PT/EN). Falls back to raw text if a section
// is missing — never throws.
// ─────────────────────────────────────────────────────────────────

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

// Extract the value of `**Field Name:** value` (single line). Case-insensitive.
function extractField(block, label) {
  const re = new RegExp(`\\*\\*${escapeRegex(label)}\\*\\*\\s*[:\\-]?\\s*([^\\n]+)`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

// Extract a bullet list following `**Label:**` until the next `**` or blank line.
function extractList(block, label) {
  const re = new RegExp(`\\*\\*${escapeRegex(label)}\\*\\*\\s*[:\\-]?\\s*\\n((?:\\s*[-•]\\s*[^\\n]+\\n?)+)`, 'i');
  const m = block.match(re);
  if (!m) return [];
  return m[1].split('\n').map(l => l.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean);
}

// Extract a sub-block: contents of a `**Tier 1 — Recommended:**` header until the next `**Tier` or `**`.
function extractSubBlock(block, label) {
  const re = new RegExp(`\\*\\*${escapeRegex(label)}\\*\\*\\s*[:\\-]?\\s*\\n([\\s\\S]*?)(?=\\n\\s*\\*\\*|$)`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Parse a tier sub-block ("- Name: X\n- Price: €Y/mês\n- Note: Z") into {name, price, note}.
function parseTier(subBlock) {
  if (!subBlock) return null;
  const grab = (key) => {
    const m = subBlock.match(new RegExp(`-\\s*${key}\\s*:\\s*([^\\n]+)`, 'i'));
    return m ? m[1].trim() : '';
  };
  return { name: grab('Name'), price: grab('Price'), note: grab('Note') };
}

// ─── Output 1: COMMUNITY ───
function parseCommunity(block) {
  if (!block) return null;
  return {
    primaryName: extractField(block, 'Community Name (Primary)') || extractField(block, 'Primary Name'),
    nameCandidates: extractList(block, 'Community Name (Candidates)') || extractList(block, 'Name Candidates'),
    platform: extractField(block, 'Platform'),
    mechanic: extractField(block, 'Core Mechanic'),
    tiers: [
      parseTier(extractSubBlock(block, 'Tier 1 — Recommended')) || parseTier(extractSubBlock(block, 'Tier 1')),
      parseTier(extractSubBlock(block, 'Tier 2 — Annual Prepay')) || parseTier(extractSubBlock(block, 'Tier 2')),
      parseTier(extractSubBlock(block, 'Tier 3 — Anchor (Ultra-High-Ticket)')) || parseTier(extractSubBlock(block, 'Tier 3')),
    ].filter(Boolean),
    weeklyRhythm: extractList(block, 'Weekly Rhythm') || extractList(block, 'Ritmo Semanal'),
    bonuses: extractList(block, 'Bonuses Unlocked Over Time') || extractList(block, 'Bonuses') || extractList(block, 'Bonus Stack'),
    differentiator: extractField(block, 'Differentiator') || extractField(block, 'Diferencial'),
  };
}

// ─── Output 2: CASES ───
function parseCases(block) {
  if (!block) return [];
  const cases = [];
  // Match "**Case 1:**" through "**Case 3:**"
  for (let i = 1; i <= 5; i++) {
    const re = new RegExp(`\\*\\*Case\\s*${i}\\s*[:\\-]?\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\s*\\*\\*Case\\s*${i + 1}|$)`, 'i');
    const m = block.match(re);
    if (!m) break;
    const sub = m[1];
    const grab = (key) => {
      const fm = sub.match(new RegExp(`-\\s*${key}\\s*:\\s*([^\\n]+)`, 'i'));
      return fm ? fm[1].trim() : '';
    };
    cases.push({
      name: grab('Name'),
      niche: grab('Niche'),
      members: grab('Members'),
      price: grab('Price'),
      mrr: grab('MRR'),
      resume: grab('Resume') || grab('Resumo'),
      why: grab('Why this matters') || grab('Why'),
    });
  }
  return cases;
}

// ─── Output 4: GRAND SLAM (Unique Mechanism + Value Stack) ───
function parseUniqueMechanism(block) {
  if (!block) return null;
  const name = extractField(block, 'Unique Mechanism Name');
  const description = extractField(block, 'Unique Mechanism Description');
  const lettersListRaw = extractList(block, 'Unique Mechanism Letters');
  const letters = lettersListRaw.map(line => {
    // Format: "X — Word: 1 sentence what this step does"
    const m = line.match(/^([A-Z])\s*[—\-:]\s*([^:]+?)\s*[:\-]\s*(.+)$/);
    if (m) return { letter: m[1].trim(), word: m[2].trim(), explanation: m[3].trim() };
    // Fallback: "X — Word — explanation"
    const m2 = line.match(/^([A-Z])\s*[—\-]\s*([^—\-]+)\s*[—\-]\s*(.+)$/);
    if (m2) return { letter: m2[1].trim(), word: m2[2].trim(), explanation: m2[3].trim() };
    return { letter: '', word: line, explanation: '' };
  });
  if (!name && letters.length === 0 && !description) return null;
  return { name, letters, description };
}

function parseValueStack(block) {
  if (!block) return null;
  // Find the Value Stack section
  const stackMatch = block.match(/\*\*Value Stack[:\*]*\*\*\s*\n([\s\S]*?)(?=\n\s*\*\*Value Stack Total|\n\s*\*\*[A-Z]|\*\*F\.\s|$)/i);
  if (!stackMatch) return null;
  const tableText = stackMatch[1];
  const items = [];
  // Parse markdown table rows: | # | Problem | Solution | Delivery | Perceived value |
  const rowMatches = [...tableText.matchAll(/^\s*\|\s*(\d+)\s*\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|/gm)];
  for (const m of rowMatches) {
    items.push({
      problem: m[2].trim(),
      solution: m[3].trim(),
      delivery: m[4].trim(),
      dollarValue: m[5].trim(),
    });
  }
  const total = extractField(block, 'Value Stack Total');
  const actualPrice = extractField(block, 'Value Stack Actual Price');
  if (items.length === 0 && !total) return null;
  return { items, total, actualPrice };
}

// ─── Main parser ───
export function parseOutput(text) {
  if (!text) return { raw: text, offer: '', blindspots: '', objections: '' };

  const [outCommunity, outCases, outMath, outGrandSlam, outBlindSpots, outObjections] = splitByOutputs(text);

  // Backward-compat fields (offer/blindspots/objections used by existing UI tabs).
  const result = {
    offer:       outCommunity || outGrandSlam || text,
    blindspots:  outBlindSpots,
    objections:  outObjections,
    // New structured fields the pitch deck reads.
    community:        parseCommunity(outCommunity),
    cases:            parseCases(outCases),
    math:             outMath,                              // raw markdown for now (Slide 9 already has its own math UI)
    uniqueMechanism:  parseUniqueMechanism(outGrandSlam),
    valueStack:       parseValueStack(outGrandSlam),
    grandSlamRaw:     outGrandSlam,
  };
  return result;
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
