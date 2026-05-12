"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────
// Bulk-import page — feeds the lean-scrape pipeline from a CSV/sheet.
//
// Workflow:
//   1. Paste CSV text OR upload .csv file → client parses + normalises URLs
//   2. Pre-flight: fetches /api/creators, marks duplicates by IG handle
//   3. Shows preview table + estimated Apify + Claude cost
//   4. User confirms → sequential POST to /api/creators per row, throttled to
//      respect Anthropic's 30k tokens/minute limit (~10 reqs/min ceiling at
//      ~3K tokens/call). We pace at 7s between calls = 8.5/min, comfortable.
//   5. minDealScore=35 sent server-side → D-tier creators are scored but NOT
//      saved (no CRM clutter, no waste on obvious passes).
//   6. Live progress + per-row status. Queue state persisted to localStorage so
//      a tab reload mid-batch resumes where it left off.
// ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sl_bulkImport_v1';
const MIN_DEAL_SCORE = 35;
const THROTTLE_MS = 7000; // 7s between calls → ~8.5/min, under 30K TPM
const APIFY_COST_PER_ROW = 0.10;    // EUR — lean IG scrape
const CLAUDE_COST_PER_ROW = 0.01;   // USD — Sonnet no-tools, ~3K tokens

// ── CSV parser (handles quoted cells with commas inside) ──
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(cell.trim()); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (cell || row.length > 0) { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
        if (c === '\r' && text[i + 1] === '\n') i++;
      } else { cell += c; }
    }
  }
  if (cell || row.length > 0) { row.push(cell.trim()); rows.push(row); }
  return rows.filter(r => r.some(c => c));
}

// Map flexible header variations to canonical fields.
function normaliseHeader(h) {
  const s = String(h || '').toLowerCase().trim();
  if (/^name|nome|creator$/.test(s)) return 'name';
  if (/instagram|ig\b|insta/.test(s)) return 'instagram';
  if (/tiktok|tt\b|tok/.test(s)) return 'tiktok';
  if (/youtube|yt\b|tube/.test(s)) return 'youtube';
  return null;
}

// Normalise a URL or handle into a full platform URL. Detects mis-placed URLs
// and returns null if the value doesn't belong to this platform.
function normaliseUrl(platform, raw) {
  if (!raw) return null;
  let v = String(raw).trim();
  if (!v) return null;
  // Strip @ prefix from handles
  v = v.replace(/^@/, '');
  // Already a URL?
  if (/^https?:\/\//i.test(v)) {
    // Verify it matches the expected platform — otherwise treat as wrong column
    if (platform === 'instagram' && /instagram\.com/i.test(v)) return v;
    if (platform === 'tiktok'    && /tiktok\.com/i.test(v))    return v;
    if (platform === 'youtube'   && /(youtube\.com|youtu\.be)/i.test(v)) return v;
    return null; // wrong column
  }
  // Bare handle → build URL
  if (platform === 'instagram') return `https://instagram.com/${v}`;
  if (platform === 'tiktok')    return `https://tiktok.com/@${v.replace(/^@?/, '')}`;
  if (platform === 'youtube')   return `https://youtube.com/@${v.replace(/^@?/, '')}`;
  return null;
}

// Extract IG handle for duplicate detection. Returns lowercased username only.
function igHandleOf(url) {
  if (!url) return null;
  const m = String(url).match(/instagram\.com\/([^/?#]+)/i);
  return m ? m[1].toLowerCase().replace(/^@/, '') : null;
}

export default function BulkImportPage() {
  const [csvText, setCsvText] = useState('');
  const [parseError, setParseError] = useState('');
  const [parsedRows, setParsedRows] = useState([]);    // [{ name, instagram, tiktok, youtube, status, result, error }]
  const [existingHandles, setExistingHandles] = useState(new Set());
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const fileRef = useRef(null);
  const cancelRef = useRef(false);

  // Resume from localStorage if a batch was running and the tab reloaded.
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (stored?.parsedRows?.length) {
        setParsedRows(stored.parsedRows);
        setCsvText(stored.csvText || '');
      }
    } catch {}
    // Fetch existing creators for duplicate detection
    fetch('/api/creators').then(r => r.json()).then(d => {
      const handles = new Set();
      for (const c of (d.creators || [])) {
        const h = igHandleOf(c.platforms?.instagram?.url || c.platforms?.instagram?.URL);
        if (h) handles.add(h);
        // Also store by name as a soft check
      }
      setExistingHandles(handles);
    }).catch(() => {});
  }, []);

  // Persist state during a run.
  useEffect(() => {
    if (parsedRows.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ parsedRows, csvText }));
  }, [parsedRows, csvText]);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(String(ev.target.result || ''));
    reader.readAsText(f);
  }

  function parseAndPreview() {
    setParseError('');
    setCurrentIdx(-1);
    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      setParseError('CSV vazio ou sem dados (precisa de header + pelo menos 1 linha).');
      setParsedRows([]);
      return;
    }
    const headerMap = rows[0].map(normaliseHeader);
    if (!headerMap.includes('name')) {
      setParseError('Falta a coluna "Name". Cabeçalhos detectados: ' + rows[0].join(' · '));
      return;
    }
    if (!headerMap.includes('instagram') && !headerMap.includes('tiktok') && !headerMap.includes('youtube')) {
      setParseError('Precisas pelo menos de uma coluna de plataforma (Instagram, TikTok, ou YouTube).');
      return;
    }

    const parsed = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const data = { name: '', instagram: null, tiktok: null, youtube: null };
      for (let j = 0; j < headerMap.length; j++) {
        const field = headerMap[j];
        const val = row[j] || '';
        if (!field) continue;
        if (field === 'name') data.name = val.trim();
        else data[field] = normaliseUrl(field, val);
      }
      // Skip totally empty rows
      if (!data.name && !data.instagram && !data.tiktok && !data.youtube) continue;

      // Determine status
      const igHandle = igHandleOf(data.instagram);
      let status = 'pending';
      let reason = '';
      if (!data.name) {
        status = 'invalid'; reason = 'Sem nome';
      } else if (!data.instagram) {
        status = 'invalid'; reason = 'Sem URL de Instagram';
      } else if (igHandle && existingHandles.has(igHandle)) {
        status = 'duplicate'; reason = 'Já existe no CRM';
      }
      parsed.push({ ...data, igHandle, status, reason, score: null, grade: null, error: null });
    }
    setParsedRows(parsed);
  }

  // ── Run sequential import ──
  const runImport = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setPaused(false);
    cancelRef.current = false;

    const startIdx = parsedRows.findIndex(r => r.status === 'pending');
    if (startIdx === -1) { setRunning(false); return; }

    for (let i = startIdx; i < parsedRows.length; i++) {
      if (cancelRef.current) break;
      const row = parsedRows[i];
      if (row.status !== 'pending') continue;
      setCurrentIdx(i);

      // Mark scraping
      setParsedRows(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'scraping' };
        return next;
      });

      try {
        const r = await fetch('/api/creators', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: row.name,
            instagramUrl: row.instagram,
            tiktokUrl: row.tiktok,
            youtubeUrl: row.youtube,
            minDealScore: MIN_DEAL_SCORE,
          }),
        });
        const data = await r.json();
        setParsedRows(prev => {
          const next = [...prev];
          if (!r.ok) {
            next[i] = { ...next[i], status: 'error', error: data.error || `HTTP ${r.status}` };
          } else if (data.rejected) {
            next[i] = { ...next[i], status: 'rejected', score: data.score, grade: data.grade, reason: `Score ${data.score} (${data.grade}) abaixo do mínimo ${MIN_DEAL_SCORE}` };
          } else if (data.creator) {
            // Compute display score from creator (server doesn't return it when saved)
            next[i] = { ...next[i], status: 'saved', creatorId: data.id };
          } else {
            next[i] = { ...next[i], status: 'error', error: 'Resposta inválida do servidor' };
          }
          return next;
        });
      } catch (err) {
        setParsedRows(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'error', error: err.message || 'Network error' };
          return next;
        });
      }

      // Throttle — 7s before the next call. Skip on the very last row.
      if (i < parsedRows.length - 1 && !cancelRef.current) {
        await new Promise(res => {
          let elapsed = 0;
          const tick = setInterval(() => {
            elapsed += 100;
            if (cancelRef.current || elapsed >= THROTTLE_MS) { clearInterval(tick); res(); }
          }, 100);
        });
      }
    }

    setCurrentIdx(-1);
    setRunning(false);
    setPaused(false);
  }, [parsedRows, running]);

  function stopImport() {
    cancelRef.current = true;
    setPaused(true);
  }

  function resetAll() {
    if (running) return;
    if (!window.confirm('Limpar a lista? Os creators já importados ficam no CRM.')) return;
    setParsedRows([]);
    setCsvText('');
    setCurrentIdx(-1);
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── Derived stats ──
  const total = parsedRows.length;
  const pending = parsedRows.filter(r => r.status === 'pending').length;
  const saved = parsedRows.filter(r => r.status === 'saved').length;
  const rejected = parsedRows.filter(r => r.status === 'rejected').length;
  const duplicates = parsedRows.filter(r => r.status === 'duplicate').length;
  const invalid = parsedRows.filter(r => r.status === 'invalid').length;
  const errors = parsedRows.filter(r => r.status === 'error').length;
  const scrapable = pending; // will hit the scrape; duplicates/invalid don't
  const estApifyCost = (scrapable * APIFY_COST_PER_ROW).toFixed(2);
  const estClaudeCost = (scrapable * CLAUDE_COST_PER_ROW).toFixed(2);
  const etaSecs = Math.ceil(scrapable * THROTTLE_MS / 1000);
  const etaStr = etaSecs < 60 ? `${etaSecs}s` : `${Math.floor(etaSecs / 60)}min ${etaSecs % 60}s`;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 14 }}>
        <a href="/creators" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", textDecoration: "none" }}>← Voltar ao CRM</a>
        <span style={{ color: "#333", fontSize: 14 }}>|</span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888" }}>Bulk Import</span>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 28px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Importar creators em massa</h1>
        <p style={{ fontSize: 14, color: "#888", marginBottom: 32, maxWidth: 720, lineHeight: 1.6 }}>
          Cola um CSV com colunas <code style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 3, color: "#B11E2F" }}>Name, Instagram, TikTok, YouTube</code> ou faz upload de um ficheiro <code style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 3 }}>.csv</code>.
          Cada linha corre lean scrape (~€0.10 + ~$0.01). Creators com Deal Score &lt; {MIN_DEAL_SCORE} são automaticamente filtrados. Throttle de 7s entre chamadas para respeitar o limite de 30K tokens/minuto.
        </p>

        {/* Step 1 — Input */}
        {parsedRows.length === 0 && (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <label style={{ flex: 1, padding: "14px 20px", background: "transparent", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 10, color: "#888", fontSize: 13, cursor: "pointer", textAlign: "center", fontFamily: "inherit" }}>
                ↑ Upload .csv
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: "none" }} />
              </label>
              <span style={{ alignSelf: "center", fontSize: 11, color: "#444" }}>ou cola abaixo</span>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'Name,Instagram,TikTok,YouTube\nTomás Estarreja,https://instagram.com/tomas_estarreja,https://tiktok.com/@tomas_estarreja,https://youtube.com/@tomasestarreja\nLia Faria,https://instagram.com/lia_faria,,...'}
              style={{ width: "100%", minHeight: 240, padding: "16px 18px", background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: "#f5f5f5", fontSize: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace", outline: "none", resize: "vertical", lineHeight: 1.5 }}
            />
            {parseError && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{parseError}</p>}
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button onClick={parseAndPreview} disabled={!csvText.trim()} style={{ padding: "12px 24px", background: csvText.trim() ? "#7A0E18" : "#1a1a1a", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 600, cursor: csvText.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>Pré-visualizar</button>
            </div>
          </div>
        )}

        {/* Step 2 — Preview + Stats + Action */}
        {parsedRows.length > 0 && (
          <div>
            {/* Stats bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
              <StatCard label="Total" value={total} color="#f5f5f5" />
              <StatCard label="Para scrape" value={scrapable} color="#22c55e" />
              <StatCard label="Skip (dup / inválido)" value={duplicates + invalid} color="#888" />
              <StatCard label="Custo estimado" value={`€${estApifyCost} + $${estClaudeCost}`} small color="#B11E2F" />
            </div>

            {/* Progress + actions */}
            {running ? (
              <div style={{ padding: "14px 20px", background: "rgba(177,30,47,0.08)", border: "1px solid rgba(177,30,47,0.3)", borderRadius: 10, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#B11E2F" }}>A scrapear {currentIdx + 1} de {total}{currentIdx >= 0 && parsedRows[currentIdx]?.name ? ` · ${parsedRows[currentIdx].name}` : ''}…</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{saved} guardados · {rejected} rejeitados · {errors} erros · ETA restante ~{Math.ceil((pending - 0) * THROTTLE_MS / 1000 / 60)}min</div>
                </div>
                <button onClick={stopImport} style={{ padding: "8px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#888", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Pausar</button>
              </div>
            ) : pending > 0 ? (
              <div style={{ padding: "14px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{pending} creator{pending === 1 ? '' : 's'} pronto{pending === 1 ? '' : 's'} para scrape</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>~{etaStr} · €{estApifyCost} Apify + ${estClaudeCost} Claude · throttle de 7s/call</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={resetAll} style={{ padding: "10px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#888", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Limpar</button>
                  <button onClick={runImport} style={{ padding: "10px 20px", background: "#7A0E18", border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{paused ? "Retomar" : "Iniciar import"}</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "14px 20px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#22c55e" }}>Import concluído</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{saved} guardados · {rejected} rejeitados (D-tier) · {duplicates} duplicados · {invalid} inválidos · {errors} erros</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={resetAll} style={{ padding: "10px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#888", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Nova importação</button>
                  <a href="/creators" style={{ padding: "10px 20px", background: "#7A0E18", border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>Ver CRM</a>
                </div>
              </div>
            )}

            {/* Preview table */}
            <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "50px 1.5fr 2fr 0.6fr 0.6fr 1fr 1.5fr", padding: "12px 16px", background: "#141414", fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                <div>#</div><div>Nome</div><div>Instagram</div><div>TT</div><div>YT</div><div>Status</div><div>Detalhe</div>
              </div>
              {parsedRows.map((r, i) => (
                <RowItem key={i} idx={i} row={r} isCurrent={i === currentIdx} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, small }) {
  return (
    <div style={{ padding: "14px 16px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: small ? 16 : 22, fontWeight: 700, color: color || "#f5f5f5" }}>{value}</div>
    </div>
  );
}

function RowItem({ idx, row, isCurrent }) {
  const statusColors = {
    pending:   { color: '#888',     bg: 'transparent',                  label: 'À espera' },
    scraping:  { color: '#3b82f6',  bg: 'rgba(59,130,246,0.08)',        label: 'A scrapear…' },
    saved:     { color: '#22c55e',  bg: 'rgba(34,197,94,0.08)',         label: '✓ Guardado' },
    rejected:  { color: '#eab308',  bg: 'rgba(234,179,8,0.08)',         label: '⊝ Rejeitado' },
    duplicate: { color: '#888',     bg: 'rgba(255,255,255,0.03)',       label: '⊝ Duplicado' },
    invalid:   { color: '#ef4444',  bg: 'rgba(239,68,68,0.06)',         label: '✗ Inválido' },
    error:     { color: '#ef4444',  bg: 'rgba(239,68,68,0.08)',         label: '✗ Erro' },
  };
  const s = statusColors[row.status] || statusColors.pending;
  const detail = row.error || row.reason || (row.score ? `${row.score} (${row.grade})` : '');
  return (
    <div style={{ display: "grid", gridTemplateColumns: "50px 1.5fr 2fr 0.6fr 0.6fr 1fr 1.5fr", padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", background: isCurrent ? "rgba(59,130,246,0.05)" : (idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"), fontSize: 12, alignItems: "center" }}>
      <div style={{ color: "#444", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{idx + 1}</div>
      <div style={{ color: row.creatorId ? "#22c55e" : "#f5f5f5", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {row.creatorId ? <a href={`/creators/${row.creatorId}`} target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "none" }}>{row.name || '—'}</a> : (row.name || '—')}
      </div>
      <div style={{ color: "#666", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.igHandle ? `@${row.igHandle}` : '—'}</div>
      <div style={{ color: row.tiktok ? "#888" : "#333", fontSize: 10 }}>{row.tiktok ? '✓' : '—'}</div>
      <div style={{ color: row.youtube ? "#888" : "#333", fontSize: 10 }}>{row.youtube ? '✓' : '—'}</div>
      <div>
        <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>{s.label}</span>
      </div>
      <div style={{ color: "#666", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</div>
    </div>
  );
}
