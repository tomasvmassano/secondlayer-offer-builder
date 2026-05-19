"use client";

import { useState, useEffect } from "react";

// Team competition dashboard — full v2 with funnel, streak, pipeline health,
// velocity, quality breakdowns, monthly €50 tally, needs-attention,
// deltas, and revenue forecast.

const WINDOWS = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'all', label: 'Sempre' },
];

const fmtEur = (n) => '€' + Math.round(n).toLocaleString();
const fmtHours = (h) => h == null ? '—' : h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;
const fmtDelta = (d, suffix = '') => {
  if (d == null || d === 0) return null;
  const sign = d > 0 ? '+' : '';
  const color = d > 0 ? '#22c55e' : '#ef4444';
  return <span style={{ color, fontSize: 10, fontWeight: 600, marginLeft: 6 }}>{sign}{d}{suffix}</span>;
};

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

      <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 14 }}>
        <a href="/creators" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", textDecoration: "none" }}>← Voltar ao CRM</a>
        <span style={{ color: "#333", fontSize: 14 }}>|</span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888" }}>Equipa</span>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 28px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Quadro de equipa</h1>
        <p style={{ fontSize: 13, color: "#888", margin: "8px 0 24px" }}>
          Objetivo diário: <strong style={{ color: "#f5f5f5" }}>30 DMs por pessoa</strong>. Falhar = <strong style={{ color: "#B11E2F" }}>€50</strong> a cada teammate que cumpriu. Reset 23:59.
        </p>

        {/* Needs attention — top of page, always visible */}
        {data?.needsAttention?.length > 0 && (
          <div style={{ marginBottom: 28, padding: "16px 20px", background: "rgba(234,179,8,0.04)", border: "1px solid rgba(234,179,8,0.20)", borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#eab308", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>● Precisa de atenção</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.needsAttention.map((item, i) => {
                const color = item.severity === 'danger' ? '#ef4444' : item.severity === 'warn' ? '#eab308' : '#888';
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#ddd" }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    {item.text}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
                cursor: "pointer", fontFamily: "inherit",
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
            {/* Per-person cards */}
            {data.rows.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 10, color: "#555" }}>
                Sem atividade nesta janela.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.rows.length, 3)}, 1fr)`, gap: 14, marginBottom: 28 }}>
                {data.rows.map((row, i) => {
                  const sbRow = data.scoreboard?.find(s => s.userId === row.userId);
                  const streak = data.streaks?.find(s => s.userId === row.userId);
                  const pipe = data.pipeline?.find(p => p.userId === row.userId);
                  const vel = data.velocity?.find(v => v.userId === row.userId);
                  const delta = data.deltas?.find(d => d.userId === row.userId);
                  const monthly = data.monthlyTally?.find(m => m.userId === row.userId);
                  const isLeader = i === 0 && data.rows.length > 1 && row.dmsSent > 0;
                  const isLoser = !!sbRow?.missedGoal;
                  return (
                    <div key={row.userId} style={{ padding: 22, background: "#141414", border: `1px solid ${isLeader ? "rgba(34,197,94,0.40)" : isLoser ? "rgba(239,68,68,0.30)" : "rgba(255,255,255,0.06)"}`, borderRadius: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#f5f5f5" }}>{row.firstName}</h2>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {streak?.streak > 0 && (
                            <span title={`Sequência: ${streak.streak} dia${streak.streak === 1 ? '' : 's'} a cumprir o objetivo`} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: "rgba(234,179,8,0.10)", color: "#eab308", border: "1px solid rgba(234,179,8,0.30)", letterSpacing: "0.04em" }}>🔥 {streak.streak}d</span>
                          )}
                          {isLeader && <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: "rgba(34,197,94,0.10)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.30)", letterSpacing: "0.06em", textTransform: "uppercase" }}>● Líder</span>}
                          {isLoser && <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.30)", letterSpacing: "0.06em", textTransform: "uppercase" }}>✗ Falhou</span>}
                        </div>
                      </div>

                      {/* DMs sent — headline */}
                      <div style={{ padding: "16px 18px", background: "rgba(177,30,47,0.06)", borderRadius: 8, border: "1px solid rgba(177,30,47,0.20)", marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.14em", textTransform: "uppercase" }}>DMs enviadas</div>
                          {delta?.deltaDmsSent != null && fmtDelta(delta.deltaDmsSent)}
                        </div>
                        <div style={{ fontSize: 38, fontWeight: 700, color: "#f5f5f5", letterSpacing: "-0.02em", lineHeight: 1, marginTop: 4 }}>
                          {row.dmsSent}
                          {windowKey === 'today' && <span style={{ fontSize: 14, color: "#666", fontWeight: 500, marginLeft: 4 }}>/ {sbRow?.target || 30}</span>}
                        </div>
                        {windowKey === 'today' && (
                          <div style={{ marginTop: 8, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: 4, width: `${Math.min(100, ((row.dmsSent / (sbRow?.target || 30)) * 100))}%`, background: row.dmsSent >= (sbRow?.target || 30) ? "#22c55e" : "#B11E2F" }} />
                          </div>
                        )}
                      </div>

                      {/* Secondary metrics grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
                        <MiniMetric label="Criadores" value={row.creatorsAdded} />
                        <MiniMetric label="Respostas" value={row.repliesReceived} delta={delta?.deltaReplyRate != null && row.dmsSent > 0 ? null : null} />
                        <MiniMetric label="Taxa resp." value={`${row.replyRate}%`} delta={fmtDelta(delta?.deltaReplyRate, 'pp')} />
                        <MiniMetric label="Fechados" value={row.signed} delta={fmtDelta(delta?.deltaSigned)} />
                        <MiniMetric label="Follow-ups" value={row.followUpsDone} />
                        <MiniMetric label="Emails" value={row.emailsSent} />
                      </div>

                      {/* Pipeline health */}
                      {pipe && (
                        <div style={{ padding: "10px 14px", background: "#0a0a0a", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)", marginBottom: 10 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#888", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 8 }}>Pipeline</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, fontSize: 11 }}>
                            <PipeBlock label="Ativas" value={pipe.active} />
                            <PipeBlock label="A aguardar" value={pipe.awaiting} color="#3b82f6" />
                            <PipeBlock label="Paradas" value={pipe.stale} color="#eab308" />
                            <PipeBlock label="Em ofertas" value={pipe.inProgressOffer} color="#a855f7" />
                          </div>
                        </div>
                      )}

                      {/* Velocity */}
                      {vel && (vel.avgAddedToDmHours != null || vel.avgRepliedToFollowHours != null || vel.avgFirstDmToSignedDays != null) && (
                        <div style={{ padding: "10px 14px", background: "#0a0a0a", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)", marginBottom: 10 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#888", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 8 }}>Velocidade média</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#aaa" }}>
                            {vel.avgAddedToDmHours != null && <div>Adicionar → DM: <strong style={{ color: "#f5f5f5" }}>{fmtHours(vel.avgAddedToDmHours)}</strong></div>}
                            {vel.avgRepliedToFollowHours != null && <div>Resposta → Follow-up: <strong style={{ color: "#f5f5f5" }}>{fmtHours(vel.avgRepliedToFollowHours)}</strong></div>}
                            {vel.avgFirstDmToSignedDays != null && <div>1º DM → Fechado: <strong style={{ color: "#f5f5f5" }}>{vel.avgFirstDmToSignedDays}d</strong></div>}
                          </div>
                        </div>
                      )}

                      {/* Daily debt */}
                      {windowKey === 'today' && sbRow && (
                        <div style={{ marginTop: 4, padding: "10px 14px", background: sbRow.totalOwedEur > 0 ? "rgba(239,68,68,0.06)" : sbRow.totalEarnedEur > 0 ? "rgba(34,197,94,0.06)" : "transparent", borderRadius: 6, border: `1px solid ${sbRow.totalOwedEur > 0 ? "rgba(239,68,68,0.20)" : sbRow.totalEarnedEur > 0 ? "rgba(34,197,94,0.20)" : "rgba(255,255,255,0.04)"}` }}>
                          {sbRow.totalOwedEur > 0 && <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>Deve <strong>€{sbRow.totalOwedEur}</strong> à equipa hoje</div>}
                          {sbRow.totalEarnedEur > 0 && <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>Recebe <strong>€{sbRow.totalEarnedEur}</strong> da equipa hoje</div>}
                          {sbRow.totalOwedEur === 0 && sbRow.totalEarnedEur === 0 && <div style={{ fontSize: 11, color: "#666" }}>Sem débitos hoje</div>}
                        </div>
                      )}

                      {/* Monthly tally */}
                      {monthly && (
                        <div style={{ marginTop: 10, padding: "10px 14px", background: "#0a0a0a", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#888", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 6 }}>Saldo do mês</div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <span style={{ fontSize: 18, fontWeight: 700, color: monthly.netEur >= 0 ? '#22c55e' : '#ef4444' }}>
                              {monthly.netEur >= 0 ? '+' : ''}{fmtEur(monthly.netEur)}
                            </span>
                            <span style={{ fontSize: 10, color: "#666" }}>{monthly.daysHit}✓ · {monthly.daysMissed}✗</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Funnel section */}
            {data.funnels?.length > 0 && (
              <Section title="Funil de conversão (sempre)">
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.funnels.length, 3)}, 1fr)`, gap: 14 }}>
                  {data.funnels.map(f => (
                    <div key={f.userId} style={{ padding: 18, background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 12 }}>{f.firstName}</div>
                      <FunnelStep label="Adicionados" value={f.added} />
                      <FunnelArrow rate={f.addedToDmRate} />
                      <FunnelStep label="DMs enviadas" value={f.dmd} />
                      <FunnelArrow rate={f.dmToReplyRate} />
                      <FunnelStep label="Respostas" value={f.replied} />
                      <FunnelArrow rate={f.replyToSignedRate} />
                      <FunnelStep label="Fechados" value={f.signed} highlight />
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "#888" }}>
                        Taxa global: <strong style={{ color: "#f5f5f5" }}>{f.overallRate}%</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Quality breakdowns */}
            {data.quality?.length > 0 && (
              <Section title="Taxa de resposta por dimensão">
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.quality.length, 3)}, 1fr)`, gap: 14 }}>
                  {data.quality.map(q => (
                    <div key={q.userId} style={{ padding: 18, background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 14 }}>{q.firstName}</div>
                      <QualityGroup title="Template" items={q.byTemplate} />
                      <QualityGroup title="Idioma" items={q.byLanguage} />
                      <QualityGroup title="Tier de preço" items={q.byTier} />
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Revenue forecast */}
            {data.revenue?.length > 0 && (
              <Section title="Receita projetada">
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.revenue.length, 3)}, 1fr)`, gap: 14 }}>
                  {data.revenue.map(r => (
                    <div key={r.userId} style={{ padding: 18, background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 14 }}>{r.firstName}</div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#22c55e", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 4 }}>Assinados (anual)</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "#22c55e" }}>{fmtEur(r.signedAnnualEur)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#888", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 4 }}>Pipeline ponderado</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#ddd" }}>{fmtEur(r.pipelineWeightedAnnualEur)}</div>
                        <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Soma de receita anual × prob. por estágio</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "#888", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  );
}

function MiniMetric({ label, value, delta }) {
  return (
    <div style={{ padding: "10px 12px", background: "#0a0a0a", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5", display: "flex", alignItems: "baseline" }}>
        {value}
        {delta}
      </div>
    </div>
  );
}

function PipeBlock({ label, value, color = "#22c55e" }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "#666", marginBottom: 2, whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: value > 0 ? color : "#444" }}>{value}</div>
    </div>
  );
}

function FunnelStep({ label, value, highlight }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 12px", background: highlight ? "rgba(34,197,94,0.06)" : "#0a0a0a", border: `1px solid ${highlight ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.04)"}`, borderRadius: 6 }}>
      <span style={{ fontSize: 11, color: "#888" }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: highlight ? "#22c55e" : "#f5f5f5" }}>{value}</span>
    </div>
  );
}

function FunnelArrow({ rate }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px", color: "#555", fontSize: 10 }}>
      <span style={{ color: "#444" }}>↓</span>
      <span>{rate}%</span>
    </div>
  );
}

function QualityGroup({ title, items }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: "#666", letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#0a0a0a", borderRadius: 4, border: "1px solid rgba(255,255,255,0.04)", fontSize: 11 }}>
            <span style={{ color: "#aaa" }}>{it.key}</span>
            <span>
              <span style={{ color: "#666", fontSize: 10, marginRight: 8 }}>{it.replied}/{it.sent}</span>
              <strong style={{ color: it.rate >= 15 ? "#22c55e" : it.rate >= 5 ? "#eab308" : "#888" }}>{it.rate}%</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
