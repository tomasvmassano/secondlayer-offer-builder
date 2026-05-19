"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────
// /creators/audit-queue — bulk ecosystem-audit for creators that
// already exist in the CRM but never had an audit run.
//
// Mirrors the audit worker on /creators/import (paced at AUDIT_PACE_MS
// to stay under Anthropic 30k TPM), but the source is the existing
// creator pool — not a CSV. Useful for:
//   - Creators imported BEFORE auto-audit shipped (~2026-05-19)
//   - Creators where the original audit failed (manual re-queue)
//   - Bulk-running the audit after a cohort upgrade
//
// We exclude pipelineStatus='cold' by default — pointless to audit
// dead deals. Operator can opt back in via the toggle.
// ─────────────────────────────────────────────────────────────────

const AUDIT_PACE_MS = 25000;        // same pacing as the import worker
const AUDIT_COST_PER_ROW = 0.12;    // USD — Sonnet + web_search, ~10K tokens

function formatFollowers(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export default function AuditQueuePage() {
  // creators carry both source data and worker-side status. status starts
  // as null (idle); transitions: null → pending → running → done | failed.
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [running, setRunning] = useState(false);
  const [includeCold, setIncludeCold] = useState(false);
  const [allCreators, setAllCreators] = useState([]); // unfiltered, for toggle
  // Selection lives outside the row records so toggling the cold filter
  // doesn't wipe the operator's picks. Set of creator IDs.
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const queueRef = useRef([]);
  const workerRunningRef = useRef(false);
  const cancelRef = useRef(false);

  // Load all creators on mount. We need the FULL record (not the summary
  // index) to check ecosystem_audit. Parallel fetch — 50 creators ≈ 1s.
  // For 200+ creators we should denormalise hasEcosystemAudit into the
  // summary index, but the current scale doesn't warrant the schema change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const summariesRes = await fetch('/api/creators');
        if (!summariesRes.ok) throw new Error('Falha a carregar creators');
        const { creators: summaries = [] } = await summariesRes.json();
        const fulls = await Promise.all(summaries.map(s =>
          fetch(`/api/creators/${s.id}`).then(r => r.ok ? r.json() : null).catch(() => null)
        ));
        if (cancelled) return;
        const rows = fulls.filter(Boolean).map(c => ({
          id: c.id,
          name: c.name,
          niche: c.niche,
          followers: c.platforms?.instagram?.followers
            || c.platforms?.tiktok?.followers
            || c.platforms?.youtube?.subscribers
            || 0,
          pipelineStatus: c.pipelineStatus || 'prospect',
          hasAudit: !!c.offer?.internal_metadata?.ecosystem_audit,
          createdAt: c.createdAt,
          status: null,
          auditCounts: null,
          auditError: null,
        }));
        setAllCreators(rows);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || 'Erro a carregar');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Filter to creators that need an audit. Cold deals excluded by default
  // (the audit informs offer-building, dead deals don't need it). Already
  // audited rows are always excluded.
  useEffect(() => {
    const filtered = allCreators
      .filter(c => !c.hasAudit)
      .filter(c => includeCold || c.pipelineStatus !== 'cold');
    setCreators(filtered);
  }, [allCreators, includeCold]);

  // Audit worker — single-flight, paced. Same logic as bulk-import,
  // updates rows by creatorId so a refetch mid-run doesn't drift.
  const startWorker = useCallback(() => {
    if (workerRunningRef.current) return;
    workerRunningRef.current = true;
    cancelRef.current = false;
    (async () => {
      while (queueRef.current.length > 0 && !cancelRef.current) {
        const creatorId = queueRef.current.shift();
        setCreators(prev => prev.map(r => r.id === creatorId ? { ...r, status: 'running' } : r));
        try {
          const r = await fetch(`/api/creators/${creatorId}/ecosystem-audit`, { method: 'POST' });
          const data = await r.json();
          if (!r.ok) {
            setCreators(prev => prev.map(row => row.id === creatorId
              ? { ...row, status: 'failed', auditError: data.error || `HTTP ${r.status}` }
              : row));
          } else {
            const products = data.ecosystem_audit?.products_found?.length || 0;
            const communities = data.ecosystem_audit?.existing_communities?.length || 0;
            setCreators(prev => prev.map(row => row.id === creatorId
              ? { ...row, status: 'done', hasAudit: true, auditCounts: { products, communities } }
              : row));
          }
        } catch (err) {
          setCreators(prev => prev.map(row => row.id === creatorId
            ? { ...row, status: 'failed', auditError: err.message || 'Network error' }
            : row));
        }
        if (queueRef.current.length > 0 && !cancelRef.current) {
          await new Promise(res => setTimeout(res, AUDIT_PACE_MS));
        }
      }
      workerRunningRef.current = false;
      setRunning(false);
    })();
  }, []);

  // Selection helpers. All operate on the currently-visible (filtered)
  // creators list, so selecting "all" while cold is excluded won't sneak
  // cold creators into the queue.
  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const visibleIds = creators.map(c => c.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some(id => selectedIds.has(id));
  const toggleAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        // All visible already selected → deselect them
        for (const id of visibleIds) next.delete(id);
      } else {
        // Select all visible
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  };
  const selectByStatus = (pipelineStatus) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const c of creators) {
        if (c.pipelineStatus === pipelineStatus) next.add(c.id);
      }
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const runAll = () => {
    // Only run selected rows that are idle or previously failed. Done rows
    // get skipped silently so re-running after a partial failure is safe.
    const ids = creators
      .filter(c => selectedIds.has(c.id))
      .filter(c => !c.status || c.status === 'failed')
      .map(c => c.id);
    if (ids.length === 0) return;
    queueRef.current = ids;
    setCreators(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: 'pending' } : r));
    setRunning(true);
    startWorker();
  };

  const stop = () => {
    cancelRef.current = true;
    queueRef.current = [];
    setRunning(false);
    // Anything still 'pending' goes back to idle so the operator can re-trigger.
    setCreators(prev => prev.map(r => r.status === 'pending' ? { ...r, status: null } : r));
  };

  // Derived stats
  const total = creators.length;
  const queued = creators.filter(c => c.status === 'pending' || c.status === 'running').length;
  const done = creators.filter(c => c.status === 'done').length;
  const failed = creators.filter(c => c.status === 'failed').length;
  const selectedCount = creators.filter(c => selectedIds.has(c.id)).length;
  // "Vou correr" = selected rows that are idle or previously failed. Done
  // rows are skipped by runAll() so we don't promise to charge for them.
  const willRun = creators.filter(c => selectedIds.has(c.id) && (!c.status || c.status === 'failed')).length;
  const estCost = (willRun * AUDIT_COST_PER_ROW).toFixed(2);
  const etaSecs = Math.ceil(willRun * AUDIT_PACE_MS / 1000);
  const etaStr = etaSecs < 60 ? `${etaSecs}s` : `${Math.floor(etaSecs / 60)}min ${etaSecs % 60}s`;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 14 }}>
        <a href="/creators" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", textDecoration: "none" }}>← Voltar ao CRM</a>
        <span style={{ color: "#333", fontSize: 14 }}>|</span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888" }}>Bulk Audit</span>
      </div>

      <div className="sl-page" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 28px" }}>
        <h1 className="sl-h1" style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Auditar creators em massa</h1>
        <p style={{ fontSize: 14, color: "#888", marginBottom: 32, maxWidth: 720, lineHeight: 1.6 }}>
          Corre o ecosystem audit em todos os creators que ainda não têm um. Cada audit usa Sonnet + web_search (~$0.12, 30-60s). Worker é paced a 25s/audit para respeitar o limite de 30K tokens/minuto da Anthropic. Deixa o tab aberto durante a corrida.
        </p>

        {loading && (
          <div style={{ padding: 60, textAlign: "center", color: "#666" }}>
            <div style={{ width: 20, height: 20, margin: "0 auto 12px", border: "2px solid #222", borderTopColor: "#7A0E18", borderRadius: "50%", animation: "sl-spin 0.8s linear infinite" }} />
            <p style={{ fontSize: 12 }}>A carregar creators...</p>
            <style>{`@keyframes sl-spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {loadError && (
          <div style={{ padding: "14px 20px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, color: "#ef4444", fontSize: 13, marginBottom: 20 }}>
            {loadError}
          </div>
        )}

        {!loading && !loadError && (
          <>
            {/* Stats */}
            <div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
              <StatCard label="Sem audit" value={total} color="#f5f5f5" />
              <StatCard label="Selecionados" value={selectedCount} color={selectedCount > 0 ? "#22c55e" : "#444"} />
              <StatCard label="Concluídos" value={done} color={done > 0 ? "#22c55e" : "#444"} />
              <StatCard label={selectedCount > 0 ? "Custo · ETA" : "Concluídos · A correr"} value={selectedCount > 0 ? `$${estCost} · ${etaStr}` : `${done} · ${queued}`} small color="#B11E2F" />
            </div>

            {/* Toggle: include cold */}
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, marginBottom: 20, cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.7 : 1 }}>
              <input
                type="checkbox"
                checked={includeCold}
                disabled={running}
                onChange={e => setIncludeCold(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#22c55e" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5" }}>Incluir creators frios</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Por defeito, deals marcados como cold ficam de fora — não há motivo para auditar uma conversa morta.</div>
              </div>
            </label>

            {/* Action bar */}
            {total === 0 ? (
              <div style={{ padding: "20px 24px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#22c55e" }}>Tudo auditado.</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Não há creators sem ecosystem audit{includeCold ? '' : ' (excluindo os cold — desliga o filtro para os ver)'}.</div>
              </div>
            ) : running ? (
              <div style={{ padding: "14px 20px", background: "rgba(177,30,47,0.08)", border: "1px solid rgba(177,30,47,0.3)", borderRadius: 10, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#B11E2F" }}>A correr audits…</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{done} concluídos · {failed} falharam · {queued} em fila · ETA {etaStr}</div>
                </div>
                <button onClick={stop} style={{ padding: "8px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#888", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Pausar</button>
              </div>
            ) : (
              <div style={{ padding: "14px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {willRun > 0 ? `${willRun} creator${willRun === 1 ? '' : 's'} selecionado${willRun === 1 ? '' : 's'} para auditar` : 'Seleciona creators para correr o audit'}
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                    {willRun > 0 ? `~${etaStr} · $${estCost} Claude · pacing de 25s/audit` : 'Usa as checkboxes na tabela ou os atalhos abaixo'}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {selectedCount > 0 && (
                    <button onClick={clearSelection} style={{ padding: "10px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#888", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Limpar seleção</button>
                  )}
                  <button onClick={runAll} disabled={willRun === 0} style={{ padding: "10px 20px", background: willRun > 0 ? "#7A0E18" : "#1a1a1a", border: "none", borderRadius: 6, color: willRun > 0 ? "#fff" : "#666", fontSize: 13, fontWeight: 600, cursor: willRun > 0 ? "pointer" : "not-allowed", fontFamily: "inherit" }}>{willRun > 0 ? `Correr ${willRun} audit${willRun === 1 ? '' : 's'}` : 'Correr audits'}</button>
                </div>
              </div>
            )}

            {/* Selection shortcuts — handy when there are many rows. */}
            {total > 0 && !running && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 4 }}>Atalhos</span>
                <button onClick={() => selectByStatus('prospect')} style={{ padding: "6px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "#888", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>+ Todos os prospects</button>
                <button onClick={() => selectByStatus('signed')} style={{ padding: "6px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "#888", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>+ Todos os signed</button>
                <button onClick={toggleAllVisible} style={{ padding: "6px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "#888", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>{allVisibleSelected ? 'Desselecionar todos' : 'Selecionar todos visíveis'}</button>
              </div>
            )}

            {/* Table */}
            {total > 0 && (
              <div className="sl-hscroll" style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "36px 50px 2fr 1.5fr 0.8fr 0.8fr 1.4fr 1.6fr", padding: "12px 16px", background: "#141414", fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", minWidth: 760, alignItems: "center" }}>
                  <div>
                    {/* Master checkbox — toggles all visible. Indeterminate
                        styling not used (browser support is uneven); we
                        just show "checked when all are checked". */}
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      disabled={running}
                      style={{ width: 14, height: 14, accentColor: "#22c55e", cursor: running ? "not-allowed" : "pointer" }}
                      title={allVisibleSelected ? "Desselecionar todos" : "Selecionar todos"}
                    />
                  </div>
                  <div>#</div><div>Nome</div><div>Nicho</div><div>Followers</div><div>Pipeline</div><div>Status</div><div>Detalhe</div>
                </div>
                {creators.map((c, i) => (
                  <Row key={c.id} idx={i} row={c} selected={selectedIds.has(c.id)} onToggle={() => toggleOne(c.id)} disabled={running} />
                ))}
              </div>
            )}
          </>
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

function Row({ idx, row, selected, onToggle, disabled }) {
  const statusColors = {
    null:    { color: '#888',    bg: 'transparent',                  label: 'À espera' },
    pending: { color: '#888',    bg: 'rgba(255,255,255,0.03)',       label: 'em fila' },
    running: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',        label: 'a correr…' },
    done:    { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',         label: null /* see counts */ },
    failed:  { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',         label: 'falhou' },
  };
  const pipeColors = {
    prospect: '#888',
    signed:   '#22c55e',
    cold:     '#ef4444',
  };
  const s = statusColors[row.status] || statusColors.null;
  const statusLabel = row.status === 'done' && row.auditCounts
    ? `✓ ${row.auditCounts.products} prod${row.auditCounts.communities ? ` · ${row.auditCounts.communities} com` : ''}`
    : (s.label || row.status);
  const detail = row.auditError || (row.status === 'done' && row.auditCounts ? `${row.auditCounts.products} produtos, ${row.auditCounts.communities} comunidades encontradas` : '');
  // Highlight selected rows so they pop visually — easier to scan a long
  // list and confirm what's about to run.
  const rowBg = selected
    ? "rgba(34,197,94,0.04)"
    : (idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "36px 50px 2fr 1.5fr 0.8fr 0.8fr 1.4fr 1.6fr", padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", background: rowBg, fontSize: 12, alignItems: "center", minWidth: 760 }}>
      <div>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={disabled}
          style={{ width: 14, height: 14, accentColor: "#22c55e", cursor: disabled ? "not-allowed" : "pointer" }}
        />
      </div>
      <div style={{ color: "#444", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{idx + 1}</div>
      <div style={{ color: "#f5f5f5", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <a href={`/creators/${row.id}`} target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "none" }}>{row.name || '—'}</a>
      </div>
      <div style={{ color: "#888", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.niche || '—'}</div>
      <div style={{ color: "#888", fontSize: 11 }}>{formatFollowers(row.followers)}</div>
      <div style={{ color: pipeColors[row.pipelineStatus] || '#666', fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>{row.pipelineStatus}</div>
      <div>
        <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>{statusLabel}</span>
      </div>
      <div style={{ color: "#666", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.auditError || ''}>{detail}</div>
    </div>
  );
}
