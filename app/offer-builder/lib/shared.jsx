"use client";
import React from "react";

export function Badge({ status }) {
  const c = { GREEN: "#22c55e", YELLOW: "#eab308", RED: "#dc2626" }[status] || "#eab308";
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", background: c + "14", color: c, border: "1px solid " + c + "33", textTransform: "uppercase" }}>{status}</span>;
}

export function parseOutput(text) {
  const s = { offer: "", blindspots: "", objections: "" };
  // Match OUTPUT 1/2/3 in any language, any # level, with any title after
  const o1 = /#{1,4}\s*(?:OUTPUT|SA[IÍ]DA|RESULTADO)\s*1[^\n]*/i;
  const o2 = /#{1,4}\s*(?:OUTPUT|SA[IÍ]DA|RESULTADO)\s*2[^\n]*/i;
  const o3 = /#{1,4}\s*(?:OUTPUT|SA[IÍ]DA|RESULTADO)\s*3[^\n]*/i;
  const m1 = text.search(o1);
  const m2 = text.search(o2);
  const m3 = text.search(o3);
  if (m1 !== -1) {
    const start = text.indexOf("\n", m1) + 1;
    const end = m2 !== -1 ? m2 : text.length;
    s.offer = text.slice(start, end).trim();
  }
  if (m2 !== -1) {
    const start = text.indexOf("\n", m2) + 1;
    const end = m3 !== -1 ? m3 : text.length;
    s.blindspots = text.slice(start, end).trim();
  }
  if (m3 !== -1) {
    const start = text.indexOf("\n", m3) + 1;
    s.objections = text.slice(start).trim();
  }
  if (!s.offer && !s.blindspots && !s.objections) s.offer = text;
  return s;
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
