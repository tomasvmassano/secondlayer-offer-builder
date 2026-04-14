"use client";
import { useState } from "react";
import CreatorSelector from '../lib/CreatorSelector';

const LOGO_B64 = "data:image/png;base64,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";

const TOUCHPOINTS = [
  { key: "day1_dm", label: "Day 1 — DM", day: 1, type: "dm", color: "#7A0E18" },
  { key: "day1_email", label: "Day 1 — Email", day: 1, type: "email", color: "#7A0E18" },
  { key: "day3_dm", label: "Day 3 — DM", day: 3, type: "dm", color: "#E2E4DF" },
  { key: "day7_email", label: "Day 7 — Email", day: 7, type: "email", color: "#E2E4DF" },
  { key: "day10_dm", label: "Day 10 — DM", day: 10, type: "dm", color: "#6b6860" },
  { key: "day14_email", label: "Day 14 — Email", day: 14, type: "email", color: "#6b6860" },
];

function parseSequence(text) {
  const steps = [];
  const patterns = [
    { key: "day1_dm", regex: /##\s*DAY 1[^\n]*DM[^\n]*/i },
    { key: "day1_email", regex: /##\s*DAY 1[^\n]*EMAIL[^\n]*/i },
    { key: "day3_dm", regex: /##\s*DAY 3[^\n]*/i },
    { key: "day7_email", regex: /##\s*DAY 7[^\n]*/i },
    { key: "day10_dm", regex: /##\s*DAY 10[^\n]*/i },
    { key: "day14_email", regex: /##\s*DAY 14[^\n]*/i },
  ];

  const positions = patterns.map(p => {
    const idx = text.search(p.regex);
    return { ...p, pos: idx };
  }).filter(p => p.pos !== -1).sort((a, b) => a.pos - b.pos);

  for (let i = 0; i < positions.length; i++) {
    const start = text.indexOf("\n", positions[i].pos) + 1;
    const end = i + 1 < positions.length ? positions[i + 1].pos : text.length;
    const content = text.slice(start, end).trim();
    if (content.length > 10) {
      steps.push({ key: positions[i].key, content });
    }
  }

  // Fallback: if parsing failed, return everything as one block
  if (steps.length === 0 && text.trim().length > 20) {
    steps.push({ key: "day1_dm", content: text.trim() });
  }
  return steps;
}

export default function DMWriter() {
  const [url, setUrl] = useState("");
  const [senderName, setSenderName] = useState("Tomas");
  const [language, setLanguage] = useState("Auto");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [selectedCreator, setSelectedCreator] = useState(null);

  const handleCreatorSelect = (creator) => {
    setSelectedCreator(creator);
    setUrl(creator.platforms?.instagram?.url || creator.tiktokUrl || creator.youtubeUrl || "");
    const ae = creator.audienceEstimate || {};
    setLanguage((ae.language || "").toLowerCase().includes("portugu") ? "Português" : "Auto");
    const notesParts = [];
    if (creator.reputation) notesParts.push(creator.reputation);
    if (creator.products?.length) notesParts.push("Products: " + creator.products.join(", "));
    if (creator.niche) notesParts.push("Niche: " + creator.niche);
    setNotes(notesParts.join("\n"));
  };

  const generate = async () => {
    if (!url.trim()) { setError("Paste a social media URL"); return; }
    setLoading(true); setError(null); setResult(null); setCopied(null);
    try {
      const r = await fetch("/api/dm-writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), senderName, language: language === "Auto" ? "" : language, notes: notes.trim() }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error || "Failed"); }
      const data = await r.json();
      setResult({ steps: parseSequence(data.dms), research: data.research });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const copyDM = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const inputStyle = {
    width: "100%", padding: "11px 14px",
    background: "#080604", border: "1px solid #1e1b17", borderRadius: 5,
    color: "#E2E4DF", fontSize: 13, fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
    outline: "none", boxSizing: "border-box", letterSpacing: "0.01em",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#010300", color: "#E2E4DF", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <style>{`@keyframes sl-spin{to{transform:rotate(360deg)}} ::placeholder{color:#3a3830!important}`}</style>

      {/* Header */}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid #141210", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <img src={LOGO_B64} alt="Second Layer" style={{ height: 16, opacity: 0.85 }} />
          </a>
          <span style={{ color: "#2a2720", fontSize: 14 }}>|</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4a4840" }}>DM Writer</span>
        </div>
        <a href="/" style={{ fontSize: 11, color: "#4a4840", textDecoration: "none" }}>Back to HQ</a>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Hero */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 300, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            <span style={{ color: "#7A0E18", fontWeight: 600 }}>DM</span> Writer
          </h1>
          <p style={{ fontSize: 13, color: "#4a4840", margin: 0, maxWidth: 460 }}>
            Seleciona um creator do CRM. Sequência de 5 touchpoints gerada automaticamente.
          </p>
        </div>

        {!selectedCreator && !result && (
          <CreatorSelector onSelect={handleCreatorSelect} selectedId={selectedCreator?.id} />
        )}

        {selectedCreator && !result && (
          <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 8, background: "#080604", border: "1px solid #141210", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#E2E4DF" }}>{selectedCreator.name}</span>
              <span style={{ fontSize: 11, color: "#4a4840", marginLeft: 10 }}>{selectedCreator.niche} · {selectedCreator.primaryPlatform}</span>
            </div>
            <button onClick={() => { setSelectedCreator(null); setUrl(""); setNotes(""); }} style={{ padding: "4px 10px", borderRadius: 3, border: "1px solid #1e1b17", background: "transparent", color: "#6b6860", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Trocar</button>
          </div>
        )}

        {/* Input */}
        {selectedCreator && <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4a4840", marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Creator URL</label>
            <input type="text" style={inputStyle} placeholder="https://instagram.com/username" value={url} onChange={e => setUrl(e.target.value)}
              onFocus={e => e.target.style.borderColor = "#7A0E18"} onBlur={e => e.target.style.borderColor = "#1e1b17"}
              onKeyDown={e => e.key === "Enter" && generate()} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4a4840", marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Your Name</label>
              <input type="text" style={inputStyle} value={senderName} onChange={e => setSenderName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4a4840", marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Language</label>
              <select style={{ ...inputStyle, cursor: "pointer", appearance: "none" }} value={language} onChange={e => setLanguage(e.target.value)}>
                <option value="Auto" style={{ background: "#080604" }}>Auto-detect</option>
                <option value="Português" style={{ background: "#080604" }}>Português</option>
                <option value="English" style={{ background: "#080604" }}>English</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4a4840", marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Personal Notes <span style={{ fontWeight: 400, color: "#2a2720" }}>(optional)</span></label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="Something specific you know or want to mention. E.g. 'Met her at a conference', 'She just launched a book'" value={notes} onChange={e => setNotes(e.target.value)}
              onFocus={e => e.target.style.borderColor = "#7A0E18"} onBlur={e => e.target.style.borderColor = "#1e1b17"} />
          </div>
        </div>}

        {selectedCreator && <button onClick={generate} disabled={loading} style={{
          padding: "12px 32px", borderRadius: 3, border: "none",
          background: loading ? "#3a1015" : "#7A0E18", color: "#E2E4DF",
          fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer",
          fontFamily: "inherit", width: "100%",
        }}>
          {loading ? "Generating outreach sequence..." : "Generate Sequence"}
        </button>}

        {loading && (
          <div style={{ marginTop: 28, textAlign: "center" }}>
            <div style={{ width: 20, height: 20, margin: "0 auto 12px", border: "2px solid #141210", borderTopColor: "#7A0E18", borderRadius: "50%", animation: "sl-spin 0.8s linear infinite" }} />
            <p style={{ fontSize: 12, color: "#4a4840" }}>Researching creator and writing sequence...</p>
            <p style={{ fontSize: 10, color: "#2a2720" }}>Takes 30-60 seconds</p>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 3, background: "#7A0E1812", border: "1px solid #7A0E1830", color: "#dc2626", fontSize: 11 }}>{error}</div>
        )}

        {result && (
          <div style={{ marginTop: 32 }}>
            {/* Timeline */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {result.steps.map((step, i) => {
                const tp = TOUCHPOINTS.find(t => t.key === step.key) || { label: "Message", day: "?", type: "dm", color: "#4a4840" };
                return (
                  <div key={i} style={{ display: "flex", gap: 16 }}>
                    {/* Timeline line */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: tp.color, flexShrink: 0, marginTop: 18 }} />
                      {i < result.steps.length - 1 && <div style={{ width: 1, flex: 1, background: "#1e1b17" }} />}
                    </div>
                    {/* Content card */}
                    <div style={{ flex: 1, padding: "18px 20px", marginBottom: 12, borderRadius: 6, background: "#080604", border: `1px solid ${i === 0 ? "#7A0E1833" : "#141210"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: tp.color }}>{tp.label}</span>
                          <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 3, background: tp.type === "email" ? "#1a1520" : "#15120a", color: tp.type === "email" ? "#9a7abf" : "#6b6860", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            {tp.type}
                          </span>
                        </div>
                        <button onClick={() => copyDM(step.content, i)} style={{
                          padding: "4px 12px", borderRadius: 3, border: "1px solid #1e1b17",
                          background: "transparent", color: copied === i ? "#22c55e" : "#6b6860",
                          fontSize: 10, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                        }}>
                          {copied === i ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <div style={{ fontSize: 13, color: "#c5c3be", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{step.content}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sequence note */}
            <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 4, background: "#7A0E1808", border: "1px solid #7A0E1815", fontSize: 11, color: "#6b6860", lineHeight: 1.6 }}>
              <strong style={{ color: "#9a9890" }}>Sequence rules:</strong> If they reply at any point, stop the sequence. Never send two messages on the same day (except Day 1). Each message adds new value, never repeats the same angle.
            </div>

            {/* Research section (collapsible) */}
            <details style={{ marginTop: 20 }}>
              <summary style={{ fontSize: 10, fontWeight: 600, color: "#4a4840", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", padding: "12px 0" }}>
                View Research Data
              </summary>
              <div style={{ padding: "16px 18px", borderRadius: 4, background: "#060503", border: "1px solid #141210", fontSize: 12, color: "#6b6860", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {result.research}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
