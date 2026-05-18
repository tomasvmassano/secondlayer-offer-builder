"use client";

import { useState, useEffect } from "react";

// Team competition dashboard. Everyone sees everyone's numbers — that's the
// point. Daily DM goal: 30 per person. Miss = €50 to each teammate that hit it.

const WINDOWS = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'all', label: 'Sempre' },
];

const METRIC_DEFS = [
  { key: 'dmsSent',         label: 'DMs enviadas',     accent: '#B11E2F' },
  { key: 'creatorsAdded',   label: 'Criadores',        accent: '#888' },
  { key: 'repliesReceived', label: 'Respostas',        accent: '#3b82f6' },
  { key: 'replyRate',       label: 'Taxa de resposta', accent: '#3b82f6', isPercent: true },
  { key: 'signed',          label: 'Fechados',         accent: '#22c55e' },
  { key: 'followUpsDone',   label: 'Follow-ups',       accent: '#888' },
  { key: 'emailsSent',      label: 'Emails',           accent: '#888' },
];

export default function EquipaPage() {
  const [windowKey, setWindowKey] = useState('today');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/team-stats?window=${windowKey}&target=30`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [windowKey]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 14 }}>
        <a href="/creators" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", textDecoration: "none" }}>← Voltar ao CRM</a>
        <span style={{ color: "#333", fontSize: 14 }}>|</span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888" }}>Equipa</span>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Quadro de equipa</h1>
        <p style={{ fontSize: 13, color: "#888", margin: "8px 0 24px" }}>
          Objetivo diário: <strong style={{ color: "#f5f5f5" }}>30 DMs por pessoa</strong>. Quem falhar paga <strong style={{ color: "#B11E2F" }}>€50</strong> a cada um que cumpriu. Reset todos os dias às 23:59.
        </p>

        {/* Time window tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {WINDOWS.map(w => (
            <button
              key={w.key}
              onClick={() => setWindowKey(w.key)}
              style={{
                padding: "10px 18px",
                background: "transparent",
                border: "none",
                borderBottom: windowKey === w.key ? "2px solid #f5f5f5" : "2px solid transparent",
                color: windowKey === w.key ? "#f5f5f5" : "#666",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {w.label}
            </button>
          ))}
        </div>

        {loading && <div style={{ color: "#555", fontSize: 13 }}>A carregar...</div>}
        {error && <div style={{ color: "#ef4444", fontSize: 13 }}>Erro: {error}</div>}

        {!loading && !error && data && (
          <>
            {/* Scoreboard cards — one per person */}
            {data.rows.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 10, color: "#555" }}>
                Sem atividade nesta janela.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.rows.length, 3)}, 1fr)`, gap: 14 }}>
                {data.rows.map((row, i) => {
                  const sbRow = data.scoreboard?.find(s => s.userId === row.userId);
                  const isLeader = i === 0 && data.rows.length > 1;
                  const isLoser = !!sbRow?.missedGoal;
                  return (
                    <div
                      key={row.userId}
                      style={{
                        padding: 22,
                        background: "#141414",
                        border: `1px solid ${isLeader ? "rgba(34,197,94,0.40)" : isLoser ? "rgba(239,68,68,0.30)" : "rgba(255,255,255,0.06)"}`,
                        borderRadius: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
                        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#f5f5f5" }}>{row.firstName}</h2>
                        {isLeader && <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: "rgba(34,197,94,0.10)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.30)", letterSpacing: "0.06em", textTransform: "uppercase" }}>● Líder</span>}
                        {isLoser && <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.30)", letterSpacing: "0.06em", textTransform: "uppercase" }}>✗ Falhou {sbRow?.target}</span>}
                      </div>

                      {/* Highlight DMs sent — the headline metric */}
                      <div style={{ padding: "16px 18px", background: "rgba(177,30,47,0.06)", borderRadius: 8, border: "1px solid rgba(177,30,47,0.20)", marginBottom: 14 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>DMs enviadas</div>
                        <div style={{ fontSize: 38, fontWeight: 700, color: "#f5f5f5", letterSpacing: "-0.02em", lineHeight: 1 }}>
                          {row.dmsSent}
                          {windowKey === 'today' && (
                            <span style={{ fontSize: 14, color: "#666", fontWeight: 500, marginLeft: 4 }}>/ {sbRow?.target || 30}</span>
                          )}
                        </div>
                        {windowKey === 'today' && (
                          <div style={{ marginTop: 8, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: 4, width: `${Math.min(100, ((row.dmsSent / (sbRow?.target || 30)) * 100))}%`, background: row.dmsSent >= (sbRow?.target || 30) ? "#22c55e" : "#B11E2F", transition: "width 0.3s" }} />
                          </div>
                        )}
                      </div>

                      {/* Secondary metrics — grid of 3×2 */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {METRIC_DEFS.filter(m => m.key !== 'dmsSent').map(m => (
                          <div key={m.key} style={{ padding: "10px 12px", background: "#0a0a0a", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)" }}>
                            <div style={{ fontSize: 9, fontWeight: 600, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5" }}>
                              {row[m.key] || 0}{m.isPercent ? '%' : ''}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* €50 debt summary (today only) */}
                      {windowKey === 'today' && sbRow && (
                        <div style={{ marginTop: 14, padding: "10px 14px", background: sbRow.totalOwedEur > 0 ? "rgba(239,68,68,0.06)" : sbRow.totalEarnedEur > 0 ? "rgba(34,197,94,0.06)" : "transparent", borderRadius: 6, border: `1px solid ${sbRow.totalOwedEur > 0 ? "rgba(239,68,68,0.20)" : sbRow.totalEarnedEur > 0 ? "rgba(34,197,94,0.20)" : "rgba(255,255,255,0.04)"}` }}>
                          {sbRow.totalOwedEur > 0 && (
                            <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>
                              Deve <strong>€{sbRow.totalOwedEur}</strong> à equipa hoje
                            </div>
                          )}
                          {sbRow.totalEarnedEur > 0 && (
                            <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>
                              Recebe <strong>€{sbRow.totalEarnedEur}</strong> da equipa hoje
                            </div>
                          )}
                          {sbRow.totalOwedEur === 0 && sbRow.totalEarnedEur === 0 && (
                            <div style={{ fontSize: 11, color: "#666" }}>
                              Sem débitos hoje (todos cumpriram ou todos falharam)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
