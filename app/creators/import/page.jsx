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
// Audit pacing — ecosystem audit uses Sonnet + web_search (~10K tokens
// per call). At 25s/audit we sit at ~2.4 audits/min ≈ 24K TPM, leaving
// headroom for the import's lean scrapes (~17K TPM at 8.5/min). The
// audit route has its own 429 backoff so the rare spike still recovers.
const AUDIT_PACE_MS = 25000;
const AUDIT_COST_PER_ROW = 0.12;    // USD — Sonnet + web_search, ~10K tokens

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
  const [parsedRows, setParsedRows] = useState([]);    // [{ name, instagram, tiktok, youtube, status, result, error, auditStatus?, auditCounts? }]
  const [existingHandles, setExistingHandles] = useState(new Set());
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const fileRef = useRef(null);
  const cancelRef = useRef(false);

  // Auto-audit: after each successful import the creator gets enqueued for
  // ecosystem audit (Sonnet + web_search). Worker drains the queue at
  // AUDIT_PACE_MS so we stay under the Anthropic TPM ceiling. Default ON
  // because the operator otherwise has to manually click "Audit" on 50
  // creators after import — the whole point of bulk import.
  const [autoAudit, setAutoAudit] = useState(true);
  const auditQueueRef = useRef([]);          // [creatorId] — FIFO of pending audits
  const auditWorkerRunningRef = useRef(false);
  const auditCancelRef = useRef(false);

  // ── Audit worker ──
  // Drains auditQueueRef one creator at a time, paced at AUDIT_PACE_MS.
  // Single-flight (re-entry guarded by auditWorkerRunningRef) so multiple
  // enqueues from the import loop don't spawn parallel workers. Row updates
  // use creatorId-based matching (not index) so a refresh or mid-run row
  // reorder doesn't write to the wrong row. Declared at the TOP of the
  // component (before any useEffect that might call enqueueAudit) so the
  // dep arrays don't trip the temporal dead zone.
  const startAuditWorker = useCallback(() => {
    if (auditWorkerRunningRef.current) return;
    auditWorkerRunningRef.current = true;
    auditCancelRef.current = false;
    (async () => {
      while (auditQueueRef.current.length > 0 && !auditCancelRef.current) {
        const creatorId = auditQueueRef.current.shift();
        setParsedRows(prev => prev.map(r => r.creatorId === creatorId ? { ...r, auditStatus: 'running' } : r));
        try {
          const r = await fetch(`/api/creators/${creatorId}/ecosystem-audit`, { method: 'POST' });
          const data = await r.json();
          if (!r.ok) {
            setParsedRows(prev => prev.map(row => row.creatorId === creatorId
              ? { ...row, auditStatus: 'failed', auditError: data.error || `HTTP ${r.status}` }
              : row));
          } else {
            // products live under ecosystem_map (nested), not at the top
            // level. Old code read the wrong path and always showed 0
            // even when the audit succeeded. Defensive fallback to the
            // flat path in case the response shape ever changes.
            const products = data.ecosystem_audit?.ecosystem_map?.products_found?.length
              ?? data.ecosystem_audit?.products_found?.length ?? 0;
            const communities = data.ecosystem_audit?.ecosystem_map?.existing_communities?.length
              ?? data.ecosystem_audit?.existing_communities?.length ?? 0;
            const urlsInspected = data._diagnostics?.final_urls_inspected || 0;
            setParsedRows(prev => prev.map(row => row.creatorId === creatorId
              ? { ...row, auditStatus: 'done', auditCounts: { products, communities, urlsInspected } }
              : row));
          }
        } catch (err) {
          setParsedRows(prev => prev.map(row => row.creatorId === creatorId
            ? { ...row, auditStatus: 'failed', auditError: err.message || 'Network error' }
            : row));
        }
        // Pace next audit (unless this was the last one or we were cancelled).
        if (auditQueueRef.current.length > 0 && !auditCancelRef.current) {
          await new Promise(res => setTimeout(res, AUDIT_PACE_MS));
        }
      }
      auditWorkerRunningRef.current = false;
    })();
  }, []);

  const enqueueAudit = useCallback((creatorId) => {
    if (!creatorId) return;
    // Mark the row as pending so the UI surfaces "audit a aguardar" right
    // away, even before the worker picks it up.
    setParsedRows(prev => prev.map(r => r.creatorId === creatorId && !r.auditStatus
      ? { ...r, auditStatus: 'pending' }
      : r));
    auditQueueRef.current.push(creatorId);
    startAuditWorker();
  }, [startAuditWorker]);

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

  // After parsedRows loads from localStorage on mount, resume any audits
  // that didn't finish before the tab was closed. We look for saved rows
  // with no terminal auditStatus and push them back onto the worker queue.
  // Guarded with a ref so this only fires once per page-load, not on every
  // parsedRows update (which would re-enqueue mid-run).
  const auditResumeFiredRef = useRef(false);
  useEffect(() => {
    if (auditResumeFiredRef.current) return;
    if (parsedRows.length === 0) return;
    auditResumeFiredRef.current = true;
    if (!autoAudit) return;
    const toResume = parsedRows
      .filter(r => r.status === 'saved' && r.creatorId && (!r.auditStatus || r.auditStatus === 'pending' || r.auditStatus === 'running'))
      .map(r => r.creatorId);
    for (const id of toResume) enqueueAudit(id);
  }, [parsedRows, autoAudit, enqueueAudit]);

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

      // One attempt = one POST + parse of the response. Returns { r, data }.
      // Extracted so we can call it twice cleanly for the auto-retry path.
      const attempt = async () => {
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
        // Read text first, then try JSON. When Apify scrape + Sonnet
        // analysis pushes past Vercel's 60s Hobby cap, the platform
        // returns a plain-text "An error occurred with your deployment"
        // page — res.json() throws "Unexpected token 'A'..." and the
        // operator sees an inscrutable parse error instead of the real
        // cause. Same fix pattern as the CP1 strategic-frame client.
        const rawText = await r.text();
        let data = null;
        try { data = rawText ? JSON.parse(rawText) : null; } catch { data = null; }
        return { r, data };
      };

      try {
        let { r, data } = await attempt();

        // Auto-retry on transient Vercel timeout. Apify Instagram scrape
        // variance means some profiles (larger accounts, more posts, rate
        // limiting) push the route past the 60s Hobby cap. Second attempt
        // usually succeeds because the Vercel function is warm and Apify's
        // slow moment has passed. If it STILL fails after retry, we
        // surface the error normally.
        const isTransient = !r.ok && (r.status === 504 || r.status === 500 || !data);
        if (isTransient) {
          setParsedRows(prev => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'retrying' };
            return next;
          });
          await new Promise(res => setTimeout(res, 3000));
          if (cancelRef.current) return;
          ({ r, data } = await attempt());
        }

        setParsedRows(prev => {
          const next = [...prev];
          if (!r.ok || !data) {
            const hint = r.status === 504 || r.status === 500
              ? ' (timeout — tenta de novo)'
              : '';
            const errMsg = (data && data.error) || `HTTP ${r.status}${hint}`;
            next[i] = { ...next[i], status: 'error', error: errMsg };
          } else if (data.rejected) {
            next[i] = { ...next[i], status: 'rejected', score: data.score, grade: data.grade, reason: `Score ${data.score} (${data.grade}) abaixo do mínimo ${MIN_DEAL_SCORE}` };
          } else if (data.duplicate) {
            // Server-side dedupe found this IG handle already in the CRM. Mark
            // as duplicate (not 'saved'), surface the existing creator's status
            // so the operator can find them in the right tab.
            const existingStatus = data.creator?.pipelineStatus || 'prospect';
            next[i] = { ...next[i], status: 'duplicate', creatorId: data.id, reason: `Já existe (status: ${existingStatus})` };
          } else if (data.creator) {
            // Compute display score from creator (server doesn't return it when saved)
            next[i] = { ...next[i], status: 'saved', creatorId: data.id };
            // Auto-fire ecosystem audit for this creator. The worker paces
            // itself (AUDIT_PACE_MS) so even 50 fires in quick succession
            // won't 429. Setting state outside this map call would conflict
            // with React batching — defer with queueMicrotask.
            if (autoAudit) {
              queueMicrotask(() => enqueueAudit(data.id));
            }
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
  }, [parsedRows, running, autoAudit, enqueueAudit]);

  function stopImport() {
    cancelRef.current = true;
    setPaused(true);
    // Also halt the audit worker — operator pressed pause for a reason.
    auditCancelRef.current = true;
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
  const estClaudeCost = (scrapable * (CLAUDE_COST_PER_ROW + (autoAudit ? AUDIT_COST_PER_ROW : 0))).toFixed(2);
  // ETA: import + audits run in parallel (worker starts on first save) but
  // audits drain slower than imports, so audit-pace dominates total time
  // when autoAudit is on. Take the max so we don't under-promise.
  const importSecs = scrapable * THROTTLE_MS / 1000;
  const auditSecs = autoAudit ? scrapable * AUDIT_PACE_MS / 1000 : 0;
  const etaSecs = Math.ceil(Math.max(importSecs, auditSecs));
  const etaStr = etaSecs < 60 ? `${etaSecs}s` : `${Math.floor(etaSecs / 60)}min ${etaSecs % 60}s`;
  // Audit progress for the live banner.
  const auditPending = parsedRows.filter(r => r.auditStatus === 'pending').length;
  const auditRunning = parsedRows.filter(r => r.auditStatus === 'running').length;
  const auditDone = parsedRows.filter(r => r.auditStatus === 'done').length;
  const auditFailed = parsedRows.filter(r => r.auditStatus === 'failed').length;
  const auditTotal = auditPending + auditRunning + auditDone + auditFailed;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 14 }}>
        <a href="/creators" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", textDecoration: "none" }}>← Voltar ao CRM</a>
        <span style={{ color: "#333", fontSize: 14 }}>|</span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888" }}>Bulk Import</span>
      </div>

      <div className="sl-page" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 28px" }}>
        <h1 className="sl-h1" style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Importar creators em massa</h1>
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
            <div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
              <StatCard label="Total" value={total} color="#f5f5f5" />
              <StatCard label="Para scrape" value={scrapable} color="#22c55e" />
              <StatCard label="Skip (dup / inválido)" value={duplicates + invalid} color="#888" />
              <StatCard label="Custo estimado" value={`€${estApifyCost} + $${estClaudeCost}`} small color="#B11E2F" />
            </div>

            {/* Auto-audit toggle — sits between stats and action banner so the
                cost estimate above reacts to it in real time. Disabled while
                a run is in progress so we don't strand half the queue. */}
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#141414", border: `1px solid ${autoAudit ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, marginBottom: 20, cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.7 : 1 }}>
              <input
                type="checkbox"
                checked={autoAudit}
                disabled={running}
                onChange={e => setAutoAudit(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#22c55e" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5" }}>Correr ecosystem audit automaticamente</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Após cada import, audit dispara em fila com pacing de 25s/audit. +${AUDIT_COST_PER_ROW.toFixed(2)} Claude por creator.</div>
              </div>
              {auditTotal > 0 && (
                <span style={{ fontSize: 10, color: "#888", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace" }}>
                  {auditDone}/{auditTotal} ✓ {auditFailed > 0 ? `· ${auditFailed} ✗` : ''} {(auditPending + auditRunning) > 0 ? `· ${auditPending + auditRunning} a correr` : ''}
                </span>
              )}
            </label>

            {/* Progress + actions */}
            {running ? (
              <div style={{ padding: "14px 20px", background: "rgba(177,30,47,0.08)", border: "1px solid rgba(177,30,47,0.3)", borderRadius: 10, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#B11E2F" }}>A scrapear {currentIdx + 1} de {total}{currentIdx >= 0 && parsedRows[currentIdx]?.name ? ` · ${parsedRows[currentIdx].name}` : ''}…</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{saved} guardados · {rejected} rejeitados · {errors} erros · ETA restante ~{Math.ceil((pending - 0) * THROTTLE_MS / 1000 / 60)}min</div>
                </div>
                <button onClick={stopImport} style={{ padding: "8px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#888", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Pausar</button>
              </div>
            ) : pending > 0 ? (
              <div style={{ padding: "14px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
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
              <div style={{ padding: "14px 20px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#22c55e" }}>Import concluído</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{saved} guardados · {rejected} rejeitados (D-tier) · {duplicates} duplicados · {invalid} inválidos · {errors} erros</div>
                  {(auditPending + auditRunning) > 0 && (
                    <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 6 }}>
                      Audits em curso: {auditDone}/{auditTotal} · {auditPending + auditRunning} a aguardar. Deixa esta página aberta — fecha o tab e os audits param.
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={resetAll} style={{ padding: "10px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#888", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Nova importação</button>
                  <a href="/creators" style={{ padding: "10px 20px", background: "#7A0E18", border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>Ver CRM</a>
                </div>
              </div>
            )}

            {/* Preview table */}
            <div className="sl-hscroll" style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "50px 1.5fr 2fr 0.6fr 0.6fr 1.6fr 1.4fr", padding: "12px 16px", background: "#141414", fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", minWidth: 680 }}>
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
    retrying:  { color: '#eab308',  bg: 'rgba(234,179,8,0.08)',         label: '↻ A repetir…' },
    saved:     { color: '#22c55e',  bg: 'rgba(34,197,94,0.08)',         label: '✓ Guardado' },
    rejected:  { color: '#eab308',  bg: 'rgba(234,179,8,0.08)',         label: '⊝ Rejeitado' },
    duplicate: { color: '#888',     bg: 'rgba(255,255,255,0.03)',       label: '⊝ Duplicado' },
    invalid:   { color: '#ef4444',  bg: 'rgba(239,68,68,0.06)',         label: '✗ Inválido' },
    error:     { color: '#ef4444',  bg: 'rgba(239,68,68,0.08)',         label: '✗ Erro' },
  };
  // Audit status renders as a second pill so the operator can scan both
  // states at a glance. Only shown for rows that actually have an audit
  // attached (saved/duplicate creators).
  const auditColors = {
    pending: { color: '#888',    bg: 'rgba(255,255,255,0.03)',    label: 'audit pendente' },
    running: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',     label: 'audit a correr…' },
    done:    { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',      label: null /* see counts below */ },
    failed:  { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',      label: 'audit falhou' },
  };
  const s = statusColors[row.status] || statusColors.pending;
  const a = row.auditStatus ? auditColors[row.auditStatus] : null;
  const auditLabel = row.auditStatus === 'done' && row.auditCounts
    ? (row.auditCounts.products === 0
        ? `audit · 0 prod (${row.auditCounts.urlsInspected || 0} URLs)`
        : `✓ audit · ${row.auditCounts.products} prod${row.auditCounts.communities ? ` · ${row.auditCounts.communities} com` : ''}`)
    : (a?.label || null);
  const detail = row.error || row.auditError || row.reason || (row.score ? `${row.score} (${row.grade})` : '');
  return (
    <div style={{ display: "grid", gridTemplateColumns: "50px 1.5fr 2fr 0.6fr 0.6fr 1.6fr 1.4fr", padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", background: isCurrent ? "rgba(59,130,246,0.05)" : (idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"), fontSize: 12, alignItems: "center", minWidth: 680 }}>
      <div style={{ color: "#444", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{idx + 1}</div>
      <div style={{ color: row.creatorId ? "#22c55e" : "#f5f5f5", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {row.creatorId ? <a href={`/creators/${row.creatorId}`} target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "none" }}>{row.name || '—'}</a> : (row.name || '—')}
      </div>
      <div style={{ color: "#666", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.igHandle ? `@${row.igHandle}` : '—'}</div>
      <div style={{ color: row.tiktok ? "#888" : "#333", fontSize: 10 }}>{row.tiktok ? '✓' : '—'}</div>
      <div style={{ color: row.youtube ? "#888" : "#333", fontSize: 10 }}>{row.youtube ? '✓' : '—'}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>{s.label}</span>
        {a && auditLabel && (
          <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: a.bg, color: a.color, border: `1px solid ${a.color}33` }} title={row.auditError || ''}>{auditLabel}</span>
        )}
      </div>
      <div style={{ color: "#666", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</div>
    </div>
  );
}
