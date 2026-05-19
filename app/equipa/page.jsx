"use client";

import { useState, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────
// /equipa — premium operational dashboard. Dark mode, big rounded cards,
// SVG charts (bars + rings + sparklines), brand red accent only on
// highlights. No external chart lib, no Tailwind — inline styles match
// the rest of the codebase. Hover states via CSS transitions only.
// ─────────────────────────────────────────────────────────────────────

const ACCENT = '#B11E2F';
const ACCENT_DEEP = '#7A0E18';
const SURFACE_0 = '#0a0a0a';
const SURFACE_1 = '#141414';
const SURFACE_2 = '#1a1a1a';
const BORDER = 'rgba(255,255,255,0.05)';
const BORDER_HI = 'rgba(255,255,255,0.10)';
const TEXT_HI = '#f5f5f5';
const TEXT_MID = '#aaa';
const TEXT_LO = '#666';
const TEXT_DIM = '#444';
const GREEN = '#22c55e';
const AMBER = '#eab308';
const RED = '#ef4444';

const WINDOWS = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'all', label: 'Sempre' },
];

const fmtEur = (n) => '€' + Math.round(n).toLocaleString();
const fmtHours = (h) => h == null ? '—' : h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;
const fmtNum = (n) => (n || 0).toLocaleString();
const initials = (name) => (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

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

  // Canonical user order across the entire dashboard. data.rows is already
  // sorted by dmsSent desc (leader first); we lock that order and every
  // section uses .find() against this list so the same person is always
  // in the same column. Without this, the Classificação card (sorted by
  // €50 net) and the Receita card (Map insertion order) could put the
  // same person in different positions.
  const userOrder = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.map(r => ({ userId: r.userId, firstName: r.firstName }));
  }, [data]);

  // Aggregates for the hero cards (sum across users in current window).
  // Target math: today = target × N people. Week = today × 5 weekdays.
  // Month = today × ~22 weekdays (real count via pacing). All = no target.
  const heroStats = useMemo(() => {
    if (!data?.rows) return null;
    const sumDms = data.rows.reduce((s, r) => s + (r.dmsSent || 0), 0);
    const sumReplies = data.rows.reduce((s, r) => s + (r.repliesReceived || 0), 0);
    const sumCreators = data.rows.reduce((s, r) => s + (r.creatorsAdded || 0), 0);
    const sumSigned = data.rows.reduce((s, r) => s + (r.signed || 0), 0);
    const replyRate = sumDms > 0 ? Math.round((sumReplies / sumDms) * 100) : 0;
    const people = data.rows.length || 2;
    const dailyTarget = data.target || 30;
    let totalTarget = 0;
    if (windowKey === 'today') totalTarget = dailyTarget * people;
    else if (windowKey === 'week') totalTarget = dailyTarget * people * 5;
    else if (windowKey === 'month') {
      const wd = data.pacing?.[0]?.workingDaysInMonth || 22;
      totalTarget = dailyTarget * people * wd;
    }
    const goalPct = totalTarget > 0 ? Math.min(100, Math.round((sumDms / totalTarget) * 100)) : 0;
    const projectedPipeline = (data.revenue || []).reduce((s, r) => s + (r.pipelineWeightedAnnualEur || 0), 0);
    const signedAnnual = (data.revenue || []).reduce((s, r) => s + (r.signedAnnualEur || 0), 0);
    return { sumDms, sumReplies, sumCreators, sumSigned, replyRate, totalTarget, goalPct, projectedPipeline, signedAnnual };
  }, [data, windowKey]);

  return (
    <div style={{ minHeight: "100vh", background: SURFACE_0, color: TEXT_HI, fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes pulseRing { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .eq-card { transition: transform 200ms cubic-bezier(.2,.7,.2,1), border-color 200ms; }
        .eq-card:hover { transform: translateY(-2px); border-color: ${BORDER_HI}; }
        .eq-fade { animation: fadeUp 320ms cubic-bezier(.2,.7,.2,1) both; }
      `}</style>

      {/* Sticky top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(10,10,10,0.85)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <a href="/creators" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT_LO, textDecoration: "none" }}>← Voltar</a>
          <div style={{ width: 1, height: 14, background: BORDER_HI }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 12px ${ACCENT}` }} />
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>Quadro de equipa</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {WINDOWS.map(w => (
            <button
              key={w.key}
              onClick={() => setWindowKey(w.key)}
              style={{
                padding: "6px 12px",
                background: windowKey === w.key ? "rgba(177,30,47,0.10)" : "transparent",
                border: `1px solid ${windowKey === w.key ? "rgba(177,30,47,0.40)" : BORDER}`,
                borderRadius: 8,
                color: windowKey === w.key ? ACCENT : TEXT_LO,
                fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
                cursor: "pointer", fontFamily: "inherit", transition: "all 150ms",
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "32px 32px 64px" }}>

        {loading && <div style={{ color: TEXT_DIM, fontSize: 13, padding: 40, textAlign: "center" }}>A carregar…</div>}
        {error && <div style={{ color: RED, fontSize: 13 }}>Erro: {error}</div>}

        {!loading && !error && data && heroStats && (
          <>
            {/* Needs attention strip */}
            {data.needsAttention?.length > 0 && (
              <div className="eq-fade" style={{ marginBottom: 24, padding: "14px 22px", background: "linear-gradient(135deg, rgba(234,179,8,0.06), rgba(234,179,8,0.02))", border: "1px solid rgba(234,179,8,0.20)", borderRadius: 24, display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: AMBER, animation: 'pulseRing 2s infinite' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: "0.14em", textTransform: "uppercase" }}>Precisa de atenção</span>
                </div>
                <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12, color: "#ddd" }}>
                  {data.needsAttention.map((item, i) => (
                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: item.severity === 'danger' ? RED : item.severity === 'warn' ? AMBER : TEXT_LO }} />
                      {item.text}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* HERO STRIP — 3 large cards */}
            <div className="eq-fade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 18, marginBottom: 18 }}>
              {/* DMs hero with bar chart */}
              <HeroCard
                label={windowKey === 'today' ? 'DMs hoje' : windowKey === 'week' ? 'DMs esta semana' : windowKey === 'month' ? 'DMs este mês' : 'DMs sempre'}
                value={fmtNum(heroStats.sumDms)}
                hint={heroStats.totalTarget > 0 ? `${heroStats.totalTarget} alvo (${heroStats.goalPct}%)` : null}
                accent
                progress={heroStats.totalTarget > 0 ? heroStats.goalPct : null}
              >
                <ActivityBarChart days={data.activity?.flatMap(u => u.days).reduce((acc, d) => {
                  const i = acc.findIndex(x => x.date === d.date);
                  if (i >= 0) acc[i].dms += d.dms; else acc.push({ date: d.date, dms: d.dms });
                  return acc;
                }, [])} target={heroStats.totalTarget} />
              </HeroCard>

              {/* Reply rate hero with ring */}
              <HeroCard
                label="Taxa de resposta"
                value={`${heroStats.replyRate}%`}
                hint={`${heroStats.sumReplies} de ${heroStats.sumDms} DMs`}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 10 }}>
                  <ProgressRing value={heroStats.replyRate} size={88} stroke={8} color={ACCENT} />
                </div>
              </HeroCard>

              {/* Revenue forecast hero */}
              <HeroCard label="Receita projetada" value={fmtEur(heroStats.projectedPipeline)} hint="anual · pipeline ponderado">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                  <MicroStat label="Assinados (anual)" value={fmtEur(heroStats.signedAnnual)} accent={GREEN} />
                  <MicroStat label="Criadores adicionados" value={fmtNum(heroStats.sumCreators)} />
                  <MicroStat label="Fechados" value={fmtNum(heroStats.sumSigned)} accent={GREEN} />
                  <MicroStat label="Respostas" value={fmtNum(heroStats.sumReplies)} />
                </div>
              </HeroCard>
            </div>

            {/* PEOPLE ROW — leaderboard cards with rings + sparklines */}
            <div className="eq-fade" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, Math.min(data.rows.length, 3))}, 1fr)`, gap: 18, marginBottom: 18 }}>
              {data.rows.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: "60px 20px", textAlign: "center", border: `1px dashed ${BORDER}`, borderRadius: 24, color: TEXT_DIM }}>
                  Sem atividade nesta janela
                </div>
              ) : data.rows.map((row, i) => {
                const sbRow = data.scoreboard?.find(s => s.userId === row.userId);
                const streak = data.streaks?.find(s => s.userId === row.userId);
                const pipe = data.pipeline?.find(p => p.userId === row.userId);
                const vel = data.velocity?.find(v => v.userId === row.userId);
                const delta = data.deltas?.find(d => d.userId === row.userId);
                const monthly = data.monthlyTally?.find(m => m.userId === row.userId);
                const activity = data.activity?.find(a => a.userId === row.userId);
                const isLeader = i === 0 && data.rows.length > 1 && row.dmsSent > 0;
                const isLoser = !!sbRow?.missedGoal;
                const goalPct = sbRow ? Math.min(100, Math.round((row.dmsSent / sbRow.target) * 100)) : null;
                return (
                  <PersonCard
                    key={row.userId}
                    row={row}
                    sbRow={sbRow}
                    streak={streak}
                    pipe={pipe}
                    vel={vel}
                    delta={delta}
                    monthly={monthly}
                    activity={activity}
                    isLeader={isLeader}
                    isLoser={isLoser}
                    goalPct={goalPct}
                    windowKey={windowKey}
                  />
                );
              })}
            </div>

            {/* SECONDARY ROW — Funnel + Pipeline donut */}
            <div className="eq-fade" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginBottom: 18 }}>
              <Card title="Funil de conversão" subtitle="Por pessoa · sempre">
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, data.funnels?.length || 1)}, 1fr)`, gap: 14 }}>
                  {(data.funnels || []).map(f => <FunnelChart key={f.userId} funnel={f} />)}
                </div>
              </Card>
              <Card title="Pipeline · estado atual" subtitle="Todas as conversas em curso">
                <PipelineDonut pipeline={data.pipeline} />
              </Card>
            </div>

            {/* STANDINGS — monthly leaderboard with €50 net + pacing.
                Column position locked to userOrder; #N rank is computed
                from net €50 desc and shown as a badge. */}
            {data.monthlyTally?.length > 0 && (
              <div className="eq-fade" style={{ marginBottom: 18 }}>
                <Card title="Classificação · Mês" subtitle="€50 acumulado · ritmo a 30/dia">
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, userOrder.length)}, 1fr)`, gap: 14 }}>
                    {(() => {
                      const ranked = [...data.monthlyTally].sort((a, b) => b.netEur - a.netEur).map(r => r.userId);
                      return userOrder.map(({ userId, firstName }) => {
                        const row = data.monthlyTally.find(m => m.userId === userId) || { userId, firstName, netEur: 0, daysHit: 0, daysMissed: 0 };
                        const rank = ranked.indexOf(userId);
                        const i = rank;
                        const pace = data.pacing?.find(p => p.userId === userId);
                        const isWinner = rank === 0 && data.monthlyTally.length > 1 && row.netEur > 0;
                        const onTrack = pace ? pace.pacePct >= 90 : null;
                        return (
                        <div key={row.userId} style={{
                          padding: 20,
                          background: isWinner ? `linear-gradient(135deg, rgba(34,197,94,0.08), ${SURFACE_1})` : SURFACE_1,
                          border: `1px solid ${isWinner ? "rgba(34,197,94,0.30)" : BORDER}`,
                          borderRadius: 20,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: TEXT_LO }}>#{i + 1}</span>
                              <span style={{ fontSize: 15, fontWeight: 700, color: TEXT_HI }}>{row.firstName}</span>
                            </div>
                            {isWinner && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(34,197,94,0.10)", color: GREEN, border: "1px solid rgba(34,197,94,0.30)", letterSpacing: "0.04em", textTransform: "uppercase" }}>● 1º</span>}
                          </div>
                          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: row.netEur >= 0 ? GREEN : RED, marginBottom: 4 }}>
                            {row.netEur >= 0 ? '+' : ''}{fmtEur(row.netEur)}
                          </div>
                          <div style={{ fontSize: 11, color: TEXT_LO, marginBottom: 14 }}>
                            <span style={{ color: GREEN }}>{row.daysHit}✓</span> · <span style={{ color: RED }}>{row.daysMissed}✗</span> · saldo do mês
                          </div>
                          {pace && (
                            <div style={{ padding: "10px 12px", background: SURFACE_0, borderRadius: 12, border: `1px solid ${BORDER}` }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                                <span style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.10em", textTransform: "uppercase" }}>Ritmo</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: onTrack ? GREEN : AMBER }}>{pace.pacePct}%</span>
                              </div>
                              <div style={{ fontSize: 12, color: TEXT_MID }}>
                                <strong style={{ color: TEXT_HI }}>{pace.monthSoFar}</strong> / {pace.monthGoal} DMs · projeção <strong style={{ color: TEXT_HI }}>{pace.projectedTotal}</strong>
                              </div>
                              <div style={{ marginTop: 8, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                                <div style={{ height: 4, width: `${Math.min(100, pace.pacePct)}%`, background: onTrack ? GREEN : AMBER, borderRadius: 4, transition: "width 600ms" }} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                      });
                    })()}
                  </div>
                </Card>
              </div>
            )}

            {/* REVENUE FORECAST PER PERSON — restored from v2. Column order
                locked to userOrder so the same person stays on the same side
                as the other cards. */}
            <div className="eq-fade" style={{ marginBottom: 18 }}>
              <Card title="Receita projetada · por pessoa" subtitle="Assinados + pipeline ponderado por estágio">
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, userOrder.length)}, 1fr)`, gap: 14 }}>
                  {userOrder.map(({ userId, firstName }) => {
                    const r = data.revenue?.find(x => x.userId === userId) || { userId, firstName, signedAnnualEur: 0, pipelineWeightedAnnualEur: 0 };
                    return (
                      <div key={userId} style={{ padding: 18, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_HI, marginBottom: 14 }}>{r.firstName}</div>
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: GREEN, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 4 }}>Assinados · anual</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: GREEN, letterSpacing: "-0.02em" }}>{fmtEur(r.signedAnnualEur)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 4 }}>Pipeline ponderado</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT_MID }}>{fmtEur(r.pipelineWeightedAnnualEur)}</div>
                          <div style={{ fontSize: 10, color: TEXT_DIM, marginTop: 4 }}>Soma anual × prob. estágio</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* HEATMAP + RECENT ACTIVITY side by side */}
            <div className="eq-fade" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginBottom: 18 }}>
              <Card title="Padrão de atividade" subtitle="Onde a equipa concentra DMs · últimas 4 semanas">
                <Heatmap data={data.heatmap} />
              </Card>
              <Card title="Atividade recente" subtitle={`Últimos ${data.recentActivity?.length || 0} eventos`}>
                <RecentActivityFeed events={data.recentActivity || []} />
              </Card>
            </div>

            {/* QUALITY ROW */}
            {data.quality?.some(q => q.byTemplate.length + q.byLanguage.length + q.byTier.length > 0) && (
              <div className="eq-fade" style={{ marginBottom: 18 }}>
                <Card title="Qualidade" subtitle="Taxa de resposta por dimensão">
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, data.quality.length)}, 1fr)`, gap: 18 }}>
                    {data.quality.map(q => (
                      <div key={q.userId}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_HI, marginBottom: 12 }}>{q.firstName}</div>
                        <QualityBars title="Template" items={q.byTemplate} />
                        <QualityBars title="Idioma" items={q.byLanguage} />
                        <QualityBars title="Tier" items={q.byTier} />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* SECTION HEADER — strategic sales metrics start here */}
            <div className="eq-fade" style={{ marginTop: 28, marginBottom: 14, paddingLeft: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 4 }}>Métricas estratégicas</div>
              <div style={{ fontSize: 12, color: TEXT_LO }}>Coverage, CAC, ciclo de venda · respondem a "estou em ritmo para bater a meta?"</div>
            </div>

            {/* EFFICIENCY ROW — Pipeline coverage + CAC per person */}
            <div className="eq-fade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
              <Card title="Pipeline coverage" subtitle={`Quota trimestral · ${fmtEur(data.quotaEurPerQuarter || 50000)} por pessoa`}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, userOrder.length)}, 1fr)`, gap: 14 }}>
                  {userOrder.map(({ userId, firstName }) => {
                    const c = data.coverage?.find(x => x.userId === userId);
                    if (!c) return (
                      <div key={userId} style={{ padding: 18, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 16, color: TEXT_DIM, fontSize: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_HI, marginBottom: 8 }}>{firstName}</div>
                        Sem pipeline
                      </div>
                    );
                    const statusColor = c.status === 'safe' ? GREEN : c.status === 'adequate' ? AMBER : RED;
                    const statusLabel = c.status === 'safe' ? 'Confortável' : c.status === 'adequate' ? 'Adequado' : c.status === 'thin' ? 'Insuficiente' : '—';
                    return (
                      <div key={userId} style={{ padding: 18, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_HI }}>{c.firstName}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${statusColor}1a`, color: statusColor, border: `1px solid ${statusColor}40`, letterSpacing: "0.04em", textTransform: "uppercase" }}>{statusLabel}</span>
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: statusColor, letterSpacing: "-0.025em", marginBottom: 4 }}>
                          {c.coverageRatio == null ? '—' : `${c.coverageRatio}×`}
                        </div>
                        <div style={{ fontSize: 11, color: TEXT_LO, marginBottom: 10 }}>cobertura · pipeline ÷ quota restante</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_DIM, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 3 }}>Assinado</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{fmtEur(c.signedThisQuarterEur)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_DIM, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 3 }}>Em falta</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_MID }}>{fmtEur(c.quotaRemainingEur)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card title="CAC · custo por aquisição" subtitle="Proxy de esforço · €0.50/DM, €1/email, €0.75/follow-up, €15/call">
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, userOrder.length)}, 1fr)`, gap: 14 }}>
                  {userOrder.map(({ userId, firstName }) => {
                    const c = data.cac?.find(x => x.userId === userId);
                    if (!c) return (
                      <div key={userId} style={{ padding: 18, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 16, color: TEXT_DIM, fontSize: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_HI, marginBottom: 8 }}>{firstName}</div>
                        Sem dados
                      </div>
                    );
                    return (
                      <div key={userId} style={{ padding: 18, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_HI, marginBottom: 10 }}>{c.firstName}</div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: TEXT_HI, letterSpacing: "-0.025em", marginBottom: 4 }}>
                          {c.cacEur == null ? '—' : fmtEur(c.cacEur)}
                        </div>
                        <div style={{ fontSize: 11, color: TEXT_LO, marginBottom: 10 }}>por deal assinado</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_DIM, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 3 }}>Spend</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_MID }}>{fmtEur(c.spendEur)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_DIM, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 3 }}>Payback</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: c.paybackRatio && c.paybackRatio >= 5 ? GREEN : TEXT_MID }}>
                              {c.paybackRatio == null ? '—' : `${c.paybackRatio}×`}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* SHOW-UP RATE + TOUCHPOINTS PER CLOSE side by side */}
            <div className="eq-fade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
              <Card title="Show-up rate · calls" subtitle="Marcadas vs realizadas · alvo ≥ 70%">
                <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 11, color: TEXT_LO, marginBottom: 4 }}>Equipa</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span style={{ fontSize: 40, fontWeight: 800, color: data.showUp?.teamRate == null ? TEXT_DIM : data.showUp.teamRate >= 70 ? GREEN : data.showUp.teamRate >= 50 ? AMBER : RED, letterSpacing: "-0.025em" }}>
                      {data.showUp?.teamRate == null ? '—' : `${data.showUp.teamRate}%`}
                    </span>
                    <span style={{ fontSize: 12, color: TEXT_LO }}>
                      {data.showUp?.teamHeld || 0} / {data.showUp?.teamAgreed || 0} calls
                    </span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, userOrder.length)}, 1fr)`, gap: 12 }}>
                  {userOrder.map(({ userId, firstName }) => {
                    const s = data.showUp?.rows?.find(x => x.userId === userId);
                    if (!s || s.agreed === 0) return (
                      <div key={userId} style={{ padding: 14, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 14, color: TEXT_DIM, fontSize: 11 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_MID, marginBottom: 4 }}>{firstName}</div>
                        Sem calls
                      </div>
                    );
                    const color = s.rate >= 70 ? GREEN : s.rate >= 50 ? AMBER : RED;
                    return (
                      <div key={userId} style={{ padding: 14, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_HI, marginBottom: 6 }}>{s.firstName}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{s.rate == null ? '—' : `${s.rate}%`}</div>
                        <div style={{ fontSize: 11, color: TEXT_LO, marginTop: 2 }}>{s.held}/{s.agreed} calls</div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card title="Touch points por close" subtitle={`Equipa · ${data.touchpoints?.teamAvg == null ? '—' : `${data.touchpoints.teamAvg} touches/deal`}`}>
                {(!data.touchpoints?.rows || data.touchpoints.rows.length === 0) ? (
                  <div style={{ color: TEXT_DIM, fontSize: 12, padding: 20, textAlign: "center" }}>Sem deals fechados ainda.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, userOrder.length)}, 1fr)`, gap: 12 }}>
                    {userOrder.map(({ userId, firstName }) => {
                      const t = data.touchpoints?.rows?.find(x => x.userId === userId);
                      if (!t || t.signed === 0) return (
                        <div key={userId} style={{ padding: 14, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 14, color: TEXT_DIM, fontSize: 11 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_MID, marginBottom: 4 }}>{firstName}</div>
                          Sem fechos
                        </div>
                      );
                      const teamAvg = data.touchpoints?.teamAvg || 0;
                      // Below team avg = more efficient = green; above = amber.
                      const efficient = t.avgPerClose != null && teamAvg > 0 && t.avgPerClose <= teamAvg;
                      return (
                        <div key={userId} style={{ padding: 14, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_HI, marginBottom: 6 }}>{t.firstName}</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: efficient ? GREEN : TEXT_HI, letterSpacing: "-0.02em" }}>
                            {t.avgPerClose == null ? '—' : t.avgPerClose}
                          </div>
                          <div style={{ fontSize: 11, color: TEXT_LO, marginTop: 2 }}>touches · {t.signed} fechos</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* PIPELINE VELOCITY — composite € per day */}
            <div className="eq-fade" style={{ marginBottom: 18 }}>
              <Card title="Velocidade do pipeline" subtitle="(deals × winRate × € médio) ÷ ciclo · € a fluir por dia">
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, userOrder.length)}, 1fr)`, gap: 14 }}>
                  {userOrder.map(({ userId, firstName }) => {
                    const v = data.pipelineVelocity?.find(x => x.userId === userId);
                    if (!v) return (
                      <div key={userId} style={{ padding: 18, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 16, color: TEXT_DIM, fontSize: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_HI, marginBottom: 8 }}>{firstName}</div>
                        Sem deals
                      </div>
                    );
                    return (
                      <div key={userId} style={{ padding: 18, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_HI, marginBottom: 10 }}>{v.firstName}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: TEXT_HI, letterSpacing: "-0.025em", marginBottom: 4 }}>
                          {v.velocityEurPerDay == null ? '—' : `${fmtEur(v.velocityEurPerDay)}/dia`}
                        </div>
                        <div style={{ fontSize: 11, color: TEXT_LO, marginBottom: 12 }}>velocidade</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                          <MicroStat label="Deals" value={(v.openDeals + v.signed)} />
                          <MicroStat label="Win %" value={`${v.winRatePct}%`} accent={v.winRatePct >= 20 ? GREEN : null} />
                          <MicroStat label="€ médio" value={fmtEur(v.avgDealEur)} />
                          <MicroStat label="Ciclo" value={v.avgCycleDays == null ? '—' : `${v.avgCycleDays}d`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* LOSS REASONS + FOLLOW-UP EFFECTIVENESS side by side */}
            <div className="eq-fade" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 18, marginBottom: 18 }}>
              <Card title="Razões de perda" subtitle={`${data.lossReasons?.total || 0} deals frios · porque morrem`}>
                {(!data.lossReasons?.rows || data.lossReasons.rows.length === 0) ? (
                  <div style={{ color: TEXT_DIM, fontSize: 12, padding: 20, textAlign: "center" }}>Nenhum deal marcado como frio ainda.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {data.lossReasons.rows.map(r => (
                      <div key={r.reason}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: TEXT_MID }}>{r.label}</span>
                          <span style={{ fontSize: 11, color: TEXT_LO }}>
                            <strong style={{ color: TEXT_HI }}>{r.count}</strong> · {r.pct}%
                          </span>
                        </div>
                        <div style={{ height: 8, background: SURFACE_0, borderRadius: 6, overflow: "hidden", border: `1px solid ${BORDER}` }}>
                          <div style={{
                            height: 8,
                            width: `${r.pct}%`,
                            background: `linear-gradient(90deg, ${ACCENT_DEEP}, ${ACCENT})`,
                            borderRadius: 6,
                            transition: "width 600ms cubic-bezier(.2,.7,.2,1)",
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Eficácia dos follow-ups" subtitle="Onde os replies aparecem · taxa por etapa">
                {(!data.followUpEff || data.followUpEff.every(b => b.sent === 0)) ? (
                  <div style={{ color: TEXT_DIM, fontSize: 12, padding: 20, textAlign: "center" }}>Sem dados de outreach pós-reset.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    {data.followUpEff.map(b => (
                      <div key={b.key} style={{ padding: 16, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 8 }}>{b.stage}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: b.rate >= 15 ? GREEN : b.rate >= 8 ? AMBER : TEXT_HI, letterSpacing: "-0.025em" }}>{b.rate}%</div>
                        <div style={{ fontSize: 11, color: TEXT_LO, marginTop: 4 }}>{b.replied} / {b.sent}</div>
                        <div style={{ marginTop: 10, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: 4, width: `${Math.min(100, b.rate * 3)}%`, background: ACCENT, borderRadius: 4, transition: "width 600ms" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* WIN RATE TRAJECTORY — weekly line */}
            <div className="eq-fade" style={{ marginBottom: 18 }}>
              <Card title="Tendência de win rate" subtitle="Últimas 8 semanas · assinados ÷ (assinados + frios)">
                <WinRateTrajectory data={data.winRateTrajectory || []} />
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── PRIMITIVES ───────────────────────────

function Card({ title, subtitle, children }) {
  return (
    <div className="eq-card" style={{ padding: 26, background: SURFACE_1, border: `1px solid ${BORDER}`, borderRadius: 24, boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 32px rgba(0,0,0,0.4)" }}>
      {title && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_HI }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: TEXT_LO, marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

function HeroCard({ label, value, hint, accent, progress, children }) {
  return (
    <div className="eq-card" style={{
      padding: 26,
      background: accent
        ? `radial-gradient(120% 100% at 0% 0%, rgba(177,30,47,0.18) 0%, ${SURFACE_1} 55%)`
        : `radial-gradient(120% 100% at 100% 0%, rgba(255,255,255,0.03) 0%, ${SURFACE_1} 60%)`,
      border: `1px solid ${accent ? "rgba(177,30,47,0.28)" : BORDER}`,
      borderRadius: 24,
      boxShadow: accent
        ? "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 40px rgba(177,30,47,0.12)"
        : "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.4)",
      minHeight: 200,
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: accent ? ACCENT : TEXT_LO, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>{label}</div>
      <div style={{ fontSize: 44, fontWeight: 800, color: TEXT_HI, letterSpacing: "-0.025em", lineHeight: 1, marginBottom: 6 }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: TEXT_MID, marginBottom: 4 }}>{hint}</div>}
      {progress != null && (
        <div style={{ marginTop: 8, marginBottom: 4, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ height: 6, width: `${progress}%`, background: `linear-gradient(90deg, ${ACCENT_DEEP}, ${ACCENT})`, borderRadius: 6, transition: "width 600ms cubic-bezier(.2,.7,.2,1)" }} />
        </div>
      )}
      {children && <div style={{ marginTop: "auto", paddingTop: 14 }}>{children}</div>}
    </div>
  );
}

function MicroStat({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent || TEXT_HI }}>{value}</div>
    </div>
  );
}

function PersonCard({ row, sbRow, streak, pipe, vel, delta, monthly, activity, isLeader, isLoser, goalPct, windowKey }) {
  const series = activity?.days || [];
  const replyRate = row.replyRate;
  return (
    <div className="eq-card" style={{
      padding: 26,
      background: SURFACE_1,
      border: `1px solid ${isLeader ? "rgba(34,197,94,0.30)" : isLoser ? "rgba(239,68,68,0.25)" : BORDER}`,
      borderRadius: 24,
      boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 32px rgba(0,0,0,0.4)",
    }}>
      {/* Top: avatar + name + streak/leader */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: isLeader ? `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})` : "rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700, color: isLeader ? "#fff" : TEXT_MID,
          border: `1px solid ${isLeader ? "rgba(255,255,255,0.15)" : BORDER_HI}`,
        }}>
          {initials(row.firstName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: TEXT_HI, letterSpacing: "-0.01em" }}>{row.firstName}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {streak?.streak > 0 && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(234,179,8,0.10)", color: AMBER, border: "1px solid rgba(234,179,8,0.25)" }}>🔥 {streak.streak}d</span>
            )}
            {isLeader && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(34,197,94,0.10)", color: GREEN, border: "1px solid rgba(34,197,94,0.30)" }}>Líder</span>}
            {isLoser && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(239,68,68,0.10)", color: RED, border: "1px solid rgba(239,68,68,0.30)" }}>Atrás</span>}
          </div>
        </div>
        {windowKey === 'today' && sbRow && (
          <ProgressRing value={goalPct} size={60} stroke={6} color={goalPct >= 100 ? GREEN : ACCENT} centerLabel={`${row.dmsSent}/${sbRow.target}`} />
        )}
      </div>

      {/* DMs + delta */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>DMs enviadas</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: TEXT_HI, letterSpacing: "-0.025em", lineHeight: 1 }}>{row.dmsSent}</span>
          {delta?.deltaDmsSent != null && delta.deltaDmsSent !== 0 && (
            <DeltaBadge value={delta.deltaDmsSent} />
          )}
        </div>
      </div>

      {/* 7-day sparkline */}
      {series.length > 0 && (
        <div style={{ marginBottom: 18, padding: "12px 14px", background: SURFACE_0, borderRadius: 14, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 8 }}>Últimos 7 dias</div>
          <Sparkline days={series} />
        </div>
      )}

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <StatTile label="Criadores" value={row.creatorsAdded} />
        <StatTile label="Respostas" value={row.repliesReceived} />
        <StatTile label="Taxa" value={`${replyRate}%`} accent={replyRate >= 15 ? GREEN : replyRate >= 5 ? AMBER : null} delta={delta?.deltaReplyRate} deltaSuffix="pp" />
        <StatTile label="Fechados" value={row.signed} accent={row.signed > 0 ? GREEN : null} delta={delta?.deltaSigned} />
        <StatTile label="Follow-ups" value={row.followUpsDone} />
        <StatTile label="Emails" value={row.emailsSent} />
      </div>

      {/* Pipeline mini */}
      {pipe && (pipe.active > 0 || pipe.stale > 0 || pipe.inProgressOffer > 0) && (
        <div style={{ marginBottom: 14, padding: "10px 14px", background: SURFACE_0, borderRadius: 14, border: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <PipelineTag label="Ativas" value={pipe.active} />
            <PipelineTag label="A aguardar" value={pipe.awaiting} color="#3b82f6" />
            <PipelineTag label="Paradas" value={pipe.stale} color={AMBER} />
            <PipelineTag label="Em ofertas" value={pipe.inProgressOffer} color="#a855f7" />
          </div>
        </div>
      )}

      {/* Velocity */}
      {vel && (vel.avgAddedToDmHours != null || vel.avgRepliedToFollowHours != null) && (
        <div style={{ marginBottom: 14, padding: "10px 14px", background: SURFACE_0, borderRadius: 14, border: `1px solid ${BORDER}`, fontSize: 11, color: TEXT_MID }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 6 }}>Velocidade</div>
          {vel.avgAddedToDmHours != null && <div>Add → DM <strong style={{ color: TEXT_HI, marginLeft: 6 }}>{fmtHours(vel.avgAddedToDmHours)}</strong></div>}
          {vel.avgRepliedToFollowHours != null && <div>Resp → Follow <strong style={{ color: TEXT_HI, marginLeft: 6 }}>{fmtHours(vel.avgRepliedToFollowHours)}</strong></div>}
          {vel.avgFirstDmToSignedDays != null && <div>DM → Fechado <strong style={{ color: TEXT_HI, marginLeft: 6 }}>{vel.avgFirstDmToSignedDays}d</strong></div>}
        </div>
      )}

      {/* Today debt + monthly tally combined */}
      {windowKey === 'today' && sbRow && (
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, padding: "10px 14px", background: sbRow.totalOwedEur > 0 ? "rgba(239,68,68,0.06)" : sbRow.totalEarnedEur > 0 ? "rgba(34,197,94,0.06)" : SURFACE_0, borderRadius: 14, border: `1px solid ${sbRow.totalOwedEur > 0 ? "rgba(239,68,68,0.20)" : sbRow.totalEarnedEur > 0 ? "rgba(34,197,94,0.20)" : BORDER}` }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 4 }}>Hoje</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: sbRow.totalOwedEur > 0 ? RED : sbRow.totalEarnedEur > 0 ? GREEN : TEXT_MID }}>
              {sbRow.totalOwedEur > 0 ? `-€${sbRow.totalOwedEur}` : sbRow.totalEarnedEur > 0 ? `+€${sbRow.totalEarnedEur}` : '—'}
            </div>
          </div>
          {monthly && (
            <div style={{ flex: 1, padding: "10px 14px", background: SURFACE_0, borderRadius: 14, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 4 }}>Mês</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: monthly.netEur >= 0 ? GREEN : RED }}>
                  {monthly.netEur >= 0 ? '+' : ''}{fmtEur(monthly.netEur)}
                </span>
                <span style={{ fontSize: 9, color: TEXT_LO }}>{monthly.daysHit}✓ · {monthly.daysMissed}✗</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, accent, delta, deltaSuffix = '' }) {
  return (
    <div style={{ padding: "10px 12px", background: SURFACE_0, borderRadius: 12, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: accent || TEXT_HI, letterSpacing: "-0.01em" }}>{value}</div>
        {delta != null && delta !== 0 && (
          <span style={{ fontSize: 9, fontWeight: 700, color: delta > 0 ? GREEN : RED }}>
            {delta > 0 ? '+' : ''}{delta}{deltaSuffix}
          </span>
        )}
      </div>
    </div>
  );
}

function PipelineTag({ label, value, color = GREEN }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 9, color: TEXT_LO, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: value > 0 ? color : TEXT_DIM }}>{value}</div>
    </div>
  );
}

function DeltaBadge({ value }) {
  const positive = value > 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 8px", borderRadius: 999,
      background: positive ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
      border: `1px solid ${positive ? "rgba(34,197,94,0.30)" : "rgba(239,68,68,0.30)"}`,
      color: positive ? GREEN : RED,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
    }}>
      {positive ? '↑' : '↓'} {Math.abs(value)}
    </span>
  );
}

// ─────────────────────────── CHARTS ───────────────────────────

function ProgressRing({ value, size = 80, stroke = 8, color = ACCENT, centerLabel }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - v / 100);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        {centerLabel ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: TEXT_HI, letterSpacing: "-0.01em" }}>{centerLabel}</span>
        ) : (
          <span style={{ fontSize: size / 4, fontWeight: 700, color: TEXT_HI, letterSpacing: "-0.02em" }}>{v}%</span>
        )}
      </div>
    </div>
  );
}

function ActivityBarChart({ days = [], target = 30 }) {
  if (!days?.length) return null;
  const max = Math.max(target * 0.6, ...days.map(d => d.dms), 1);
  const W = 240, H = 80, gap = 6;
  const barW = (W - gap * (days.length - 1)) / days.length;
  const dayLabel = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return ['D','S','T','Q','Q','S','S'][d.getDay()];
  };
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} preserveAspectRatio="none" style={{ width: "100%", height: 90 }}>
      <defs>
        <linearGradient id="bargrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.95} />
          <stop offset="100%" stopColor={ACCENT_DEEP} stopOpacity={0.85} />
        </linearGradient>
      </defs>
      {days.map((d, i) => {
        const h = Math.max(2, (d.dms / max) * H);
        const x = i * (barW + gap);
        const y = H - h;
        const isToday = d.date === todayStr;
        return (
          <g key={d.date}>
            <rect x={x} y={0} width={barW} height={H} rx={Math.min(barW / 2, 6)} fill="rgba(255,255,255,0.04)" />
            <rect x={x} y={y} width={barW} height={h} rx={Math.min(barW / 2, 6)} fill={isToday ? "url(#bargrad)" : "rgba(255,255,255,0.18)"} />
            <text x={x + barW / 2} y={H + 14} fontSize="9" fill={isToday ? ACCENT : TEXT_LO} textAnchor="middle" fontFamily="Inter">{dayLabel(d.date)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Sparkline({ days = [] }) {
  if (!days.length) return null;
  const max = Math.max(1, ...days.map(d => d.dms));
  const W = 200, H = 36;
  const stepX = W / (days.length - 1 || 1);
  const points = days.map((d, i) => [i * stepX, H - (d.dms / max) * H]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ');
  const areaPath = path + ` L ${W},${H} L 0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 40 }}>
      <defs>
        <linearGradient id="sparkfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.30} />
          <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkfill)" />
      <path d={path} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === points.length - 1 ? 3 : 0} fill={ACCENT} />
      ))}
    </svg>
  );
}

function FunnelChart({ funnel }) {
  const steps = [
    { label: 'Adicionados', value: funnel.added },
    { label: 'DMs', value: funnel.dmd, rate: funnel.addedToDmRate },
    { label: 'Respostas', value: funnel.replied, rate: funnel.dmToReplyRate },
    { label: 'Calls agendadas', value: funnel.callAgreed || 0, rate: funnel.replyToCallRate },
    { label: 'Calls realizadas', value: funnel.callHeld || 0, rate: funnel.showUpRate },
    { label: 'Fechados', value: funnel.signed, rate: funnel.callToSignedRate, highlight: true },
  ];
  const max = Math.max(1, funnel.added);
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_HI, marginBottom: 10 }}>{funnel.firstName}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {steps.map((s, i) => {
          const w = (s.value / max) * 100;
          return (
            <div key={i}>
              {s.rate != null && (
                <div style={{ fontSize: 9, color: TEXT_DIM, marginLeft: 6, marginBottom: 2 }}>↓ {s.rate}%</div>
              )}
              <div style={{ position: "relative", height: 30, borderRadius: 12, overflow: "hidden", background: SURFACE_0, border: `1px solid ${BORDER}` }}>
                <div style={{
                  height: "100%",
                  width: `${Math.max(8, w)}%`,
                  background: s.highlight
                    ? `linear-gradient(90deg, ${ACCENT_DEEP}, ${ACCENT})`
                    : `linear-gradient(90deg, rgba(177,30,47,0.20), rgba(177,30,47,0.10))`,
                  borderRadius: 12,
                  transition: "width 600ms cubic-bezier(.2,.7,.2,1)",
                }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px" }}>
                  <span style={{ fontSize: 11, color: TEXT_MID }}>{s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_HI }}>{s.value}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}`, fontSize: 11, color: TEXT_LO, display: "flex", justifyContent: "space-between" }}>
        <span>Taxa global</span>
        <strong style={{ color: TEXT_HI }}>{funnel.overallRate}%</strong>
      </div>
    </div>
  );
}

function PipelineDonut({ pipeline = [] }) {
  // Sum across all users for the team-wide donut.
  const total = pipeline.reduce((acc, p) => ({
    active: acc.active + p.active,
    awaiting: acc.awaiting + p.awaiting,
    stale: acc.stale + p.stale,
    inProgressOffer: acc.inProgressOffer + p.inProgressOffer,
  }), { active: 0, awaiting: 0, stale: 0, inProgressOffer: 0 });

  const segments = [
    { label: 'Ativas', value: total.active, color: GREEN },
    { label: 'A aguardar', value: total.awaiting, color: '#3b82f6' },
    { label: 'Paradas', value: total.stale, color: AMBER },
    { label: 'Em ofertas', value: total.inProgressOffer, color: '#a855f7' },
  ];
  const sum = segments.reduce((s, x) => s + x.value, 0) || 1;

  // SVG donut.
  const size = 160, stroke = 22, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
          {segments.map((s, i) => {
            const frac = s.value / sum;
            const dash = frac * c;
            const offset = -acc * c;
            acc += frac;
            return s.value > 0 ? (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={offset} style={{ transition: "stroke-dasharray 600ms" }} />
            ) : null;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: TEXT_HI, letterSpacing: "-0.025em" }}>{sum === 1 && segments.every(s => s.value === 0) ? 0 : sum}</span>
          <span style={{ fontSize: 10, color: TEXT_LO, letterSpacing: "0.12em", textTransform: "uppercase" }}>Total</span>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: SURFACE_0, borderRadius: 10, border: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
              <span style={{ fontSize: 12, color: TEXT_MID }}>{s.label}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: TEXT_HI }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Heatmap({ data }) {
  if (!data?.grid) return <div style={{ color: TEXT_DIM, fontSize: 12 }}>Sem dados.</div>;
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const buckets = ['Manhã', 'Almoço', 'Tarde', 'Noite'];
  // Find max across non-weekend for scaling — weekends often empty.
  const allVals = data.grid.flat();
  const max = Math.max(1, ...allVals);
  const colorAt = (v) => {
    if (v === 0) return 'rgba(255,255,255,0.03)';
    const intensity = Math.min(1, v / max);
    // Interpolate from deep red base to bright accent.
    const alpha = 0.10 + intensity * 0.65;
    return `rgba(177,30,47,${alpha.toFixed(2)})`;
  };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "44px repeat(4, 1fr)", gap: 4, marginBottom: 4 }}>
        <div />
        {buckets.map(b => (
          <div key={b} style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center", padding: "4px 0" }}>{b}</div>
        ))}
      </div>
      {days.map((dayLabel, dow) => (
        <div key={dow} style={{ display: "grid", gridTemplateColumns: "44px repeat(4, 1fr)", gap: 4, marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: dow >= 5 ? TEXT_DIM : TEXT_MID, padding: "8px 0", textAlign: "right" }}>{dayLabel}</div>
          {data.grid[dow].map((v, b) => (
            <div key={b} title={`${dayLabel} · ${buckets[b]}: ${v} DM${v === 1 ? '' : 's'}`}
              style={{
                height: 36,
                background: colorAt(v),
                borderRadius: 8,
                border: `1px solid ${v > 0 ? 'rgba(177,30,47,0.18)' : BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "transform 150ms",
                cursor: "default",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: v === 0 ? TEXT_DIM : TEXT_HI }}>{v}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: TEXT_LO }}>
        <span>Menos</span>
        <div style={{ display: "flex", gap: 2 }}>
          {[0.05, 0.20, 0.40, 0.60, 0.80].map((a, i) => (
            <div key={i} style={{ width: 14, height: 8, background: a === 0.05 ? 'rgba(255,255,255,0.03)' : `rgba(177,30,47,${a})`, borderRadius: 2 }} />
          ))}
        </div>
        <span>Mais</span>
      </div>
    </div>
  );
}

function RecentActivityFeed({ events }) {
  if (!events.length) return <div style={{ color: TEXT_DIM, fontSize: 12 }}>Sem atividade recente.</div>;
  const typeLabel = {
    added: { label: 'adicionou', color: TEXT_MID },
    dm_sent: { label: 'enviou DM a', color: ACCENT },
    replied: { label: 'recebeu resposta de', color: '#3b82f6' },
    signed: { label: 'fechou', color: GREEN },
  };
  const ago = (iso) => {
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
    return `${Math.floor(sec / 86400)}d`;
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {events.map((e, i) => {
        const cfg = typeLabel[e.type] || { label: e.type, color: TEXT_MID };
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 12, color: TEXT_MID, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <strong style={{ color: TEXT_HI }}>{e.firstName || '—'}</strong>
              <span style={{ color: TEXT_LO, margin: "0 4px" }}>{cfg.label}</span>
              <a href={`/creators/${e.creatorId}`} style={{ color: TEXT_HI, textDecoration: 'none' }}>{e.creator || 'criador'}</a>
            </div>
            <span style={{ fontSize: 10, color: TEXT_LO, flexShrink: 0 }}>{ago(e.at)}</span>
          </div>
        );
      })}
    </div>
  );
}

function QualityBars({ title, items }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((it, i) => {
          const color = it.rate >= 15 ? GREEN : it.rate >= 5 ? AMBER : TEXT_LO;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: TEXT_MID, width: 60 }}>{it.key}</span>
              <div style={{ flex: 1, height: 6, background: SURFACE_0, borderRadius: 6, overflow: "hidden", border: `1px solid ${BORDER}` }}>
                <div style={{ height: "100%", width: `${Math.min(100, it.rate * 2)}%`, background: color, borderRadius: 6, transition: "width 600ms" }} />
              </div>
              <span style={{ fontSize: 11, color: TEXT_LO, width: 50, textAlign: "right" }}>{it.replied}/{it.sent}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: TEXT_HI, width: 36, textAlign: "right" }}>{it.rate}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Weekly line chart of win rate. Empty buckets (no terminal events that week)
// render as gaps in the line so a string of zero-volume weeks doesn't pull
// the trend visually down. Hover-free; data labels render under each point.
function WinRateTrajectory({ data }) {
  const validPoints = data.filter(d => d.total > 0);
  if (validPoints.length === 0) {
    return <div style={{ color: TEXT_DIM, fontSize: 12, padding: 20, textAlign: "center" }}>Sem deals fechados ou perdidos no horizonte.</div>;
  }
  const W = 720, H = 220, pad = { l: 36, r: 16, t: 20, b: 36 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const n = data.length;
  const xAt = (i) => pad.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (pct) => pad.t + innerH - (pct / 100) * innerH;

  // Build path string, breaking on null winRatePct so gaps stay gaps.
  let pathD = '';
  let prevValid = false;
  data.forEach((d, i) => {
    if (d.winRatePct == null) { prevValid = false; return; }
    const cmd = prevValid ? 'L' : 'M';
    pathD += `${cmd}${xAt(i)},${yAt(d.winRatePct)} `;
    prevValid = true;
  });

  // Trend marker — first vs last valid points.
  const firstValid = validPoints[0];
  const lastValid = validPoints[validPoints.length - 1];
  const trendDelta = lastValid.winRatePct - firstValid.winRatePct;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: TEXT_LO }}>Atual <strong style={{ color: TEXT_HI }}>{lastValid.winRatePct}%</strong> · há {validPoints.length} sem. <strong style={{ color: TEXT_HI }}>{firstValid.winRatePct}%</strong></div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: trendDelta > 0 ? "rgba(34,197,94,0.10)" : trendDelta < 0 ? "rgba(239,68,68,0.10)" : "rgba(255,255,255,0.05)", color: trendDelta > 0 ? GREEN : trendDelta < 0 ? RED : TEXT_MID, border: `1px solid ${trendDelta > 0 ? "rgba(34,197,94,0.25)" : trendDelta < 0 ? "rgba(239,68,68,0.25)" : BORDER_HI}` }}>
          {trendDelta > 0 ? '↑' : trendDelta < 0 ? '↓' : '→'} {Math.abs(trendDelta)} pp
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 240, display: "block" }}>
        {/* Gridlines at 0/25/50/75/100% */}
        {[0, 25, 50, 75, 100].map(pct => (
          <g key={pct}>
            <line x1={pad.l} x2={W - pad.r} y1={yAt(pct)} y2={yAt(pct)} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            <text x={pad.l - 8} y={yAt(pct) + 4} fontSize={10} fill={TEXT_DIM} textAnchor="end">{pct}%</text>
          </g>
        ))}
        {/* Line */}
        <path d={pathD} stroke={ACCENT} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Points + labels */}
        {data.map((d, i) => {
          if (d.winRatePct == null) {
            return (
              <text key={i} x={xAt(i)} y={H - pad.b + 18} fontSize={9} fill={TEXT_DIM} textAnchor="middle">{d.label}</text>
            );
          }
          return (
            <g key={i}>
              <circle cx={xAt(i)} cy={yAt(d.winRatePct)} r={4} fill={SURFACE_0} stroke={ACCENT} strokeWidth={2} />
              <text x={xAt(i)} y={yAt(d.winRatePct) - 10} fontSize={10} fill={TEXT_MID} textAnchor="middle" fontWeight={600}>{d.winRatePct}%</text>
              <text x={xAt(i)} y={H - pad.b + 18} fontSize={9} fill={TEXT_LO} textAnchor="middle">{d.label}</text>
              <text x={xAt(i)} y={H - pad.b + 30} fontSize={8} fill={TEXT_DIM} textAnchor="middle">{d.signed}✓ {d.lost}✗</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
