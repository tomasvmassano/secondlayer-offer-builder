"use client";

import { useState, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────
// /equipa — operational dashboard, Linear/Vercel aesthetic on dark.
//
// Design system (rewritten 2026-06-18):
//   - Hairline section blocks instead of card containers for everything
//     except the two hero cards. 1px borders, no shadows, no big radii.
//   - Tabular monospace for every number (counts, percentages, deltas).
//     Mono uses the system stack so we don't load another font.
//   - Tighter type scale: hero values 36px, labels 9-10px uppercase,
//     body 12px. Hierarchy comes from weight + color, not scale.
//   - Per-operator leaderboard is a bordered TABLE with column headers
//     instead of a grid of vertical cards. Same data, side-by-side at
//     a glance — built for morning-standup reading.
//   - One accent (brand red #B11E2F) for highlights; status uses
//     green/amber/red only when a value crosses a threshold.
//   - Motion intentionally restrained: fade-up on initial mount, no
//     hover-lift on non-interactive surfaces.
// ─────────────────────────────────────────────────────────────────────

const ACCENT = '#B11E2F';
const ACCENT_DEEP = '#7A0E18';
const SURFACE_0 = '#0a0a0a';
const SURFACE_1 = '#0f0f0f';   // section blocks (subtly elevated)
const SURFACE_2 = '#161616';   // nested rows / inputs
const BORDER = 'rgba(255,255,255,0.05)';
const BORDER_HI = 'rgba(255,255,255,0.10)';
const TEXT_HI = '#f5f5f5';
const TEXT_MID = '#aaa';
const TEXT_LO = '#666';
const TEXT_DIM = '#444';
const GREEN = '#22c55e';
const AMBER = '#eab308';
const RED = '#ef4444';

// Tabular-mono stack for every number on the page. Uses the system
// monospace (no extra font load) and forces equal-width digits so
// numbers stack into a clean grid.
const MONO_STACK = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const monoNum = {
  fontFamily: MONO_STACK,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum"',
};

const WINDOWS = [
  { key: 'today',     label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: 'week',      label: 'Semana' },
  { key: 'month',     label: 'Mês' },
  { key: 'all',       label: 'Sempre' },
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
  // Strategic block (CAC, show-up, touchpoints, pipeline velocity, loss
  // reasons, follow-up effectiveness, win rate trajectory) is hidden by
  // default — operators reach for it occasionally, not every visit.
  // Tapping the section header expands it. State is page-local; not
  // worth persisting to localStorage for now.
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
    const sumEmails = data.rows.reduce((s, r) => s + (r.emailsSent || 0), 0);
    const sumTouches = data.rows.reduce((s, r) => s + (r.touchesSent || 0), 0);
    const sumReplies = data.rows.reduce((s, r) => s + (r.repliesReceived || 0), 0);
    const sumRepliesDm = data.rows.reduce((s, r) => s + (r.repliesViaDm || 0), 0);
    const sumRepliesEmail = data.rows.reduce((s, r) => s + (r.repliesViaEmail || 0), 0);
    const sumCreators = data.rows.reduce((s, r) => s + (r.creatorsAdded || 0), 0);
    const sumSigned = data.rows.reduce((s, r) => s + (r.signed || 0), 0);
    // Combined reply rate now uses touches (the activity unit). DM/email
    // per-channel rates ship alongside.
    const replyRate = sumTouches > 0 ? Math.round((sumReplies / sumTouches) * 100) : 0;
    const dmReplyRate = sumDms > 0 ? Math.round((sumRepliesDm / sumDms) * 100) : 0;
    const emailReplyRate = sumEmails > 0 ? Math.round((sumRepliesEmail / sumEmails) * 100) : 0;
    const people = data.rows.length || 2;
    const dailyTarget = data.target || 30;
    let totalTarget = 0;
    if (windowKey === 'today') totalTarget = dailyTarget * people;
    else if (windowKey === 'week') totalTarget = dailyTarget * people * 5;
    else if (windowKey === 'month') {
      const wd = data.pacing?.[0]?.workingDaysInMonth || 22;
      totalTarget = dailyTarget * people * wd;
    }
    // Goal % now gates on touches (the new daily-rule unit) instead of DMs.
    const goalPct = totalTarget > 0 ? Math.min(100, Math.round((sumTouches / totalTarget) * 100)) : 0;
    return { sumDms, sumEmails, sumTouches, sumReplies, sumRepliesDm, sumRepliesEmail, sumCreators, sumSigned, replyRate, dmReplyRate, emailReplyRate, totalTarget, goalPct };
  }, [data, windowKey]);

  // Yesterday totals — only populated when windowKey === 'today' AND the
  // server shipped a vsYesterday block. Used to render "↑3 vs ontem" delta
  // chips next to each hero number. Same reduce shape as heroStats so the
  // numbers are directly comparable.
  const yesterdayTotals = useMemo(() => {
    const yRows = data?.vsYesterday?.rows;
    if (!Array.isArray(yRows) || windowKey !== 'today') return null;
    const sumDms = yRows.reduce((s, r) => s + (r.dmsSent || 0), 0);
    const sumEmails = yRows.reduce((s, r) => s + (r.emailsSent || 0), 0);
    const sumTouches = yRows.reduce((s, r) => s + (r.touchesSent || 0), 0);
    const sumReplies = yRows.reduce((s, r) => s + (r.repliesReceived || 0), 0);
    const sumRepliesDm = yRows.reduce((s, r) => s + (r.repliesViaDm || 0), 0);
    const sumRepliesEmail = yRows.reduce((s, r) => s + (r.repliesViaEmail || 0), 0);
    const sumCreators = yRows.reduce((s, r) => s + (r.creatorsAdded || 0), 0);
    const sumSigned = yRows.reduce((s, r) => s + (r.signed || 0), 0);
    const replyRate = sumTouches > 0 ? Math.round((sumReplies / sumTouches) * 100) : 0;
    const dmReplyRate = sumDms > 0 ? Math.round((sumRepliesDm / sumDms) * 100) : 0;
    const emailReplyRate = sumEmails > 0 ? Math.round((sumRepliesEmail / sumEmails) * 100) : 0;
    return { sumDms, sumEmails, sumTouches, sumReplies, sumRepliesDm, sumRepliesEmail, sumCreators, sumSigned, replyRate, dmReplyRate, emailReplyRate };
  }, [data, windowKey]);

  // Map yesterday rows by userId for per-person delta lookups in the
  // leaderboard cards.
  const yesterdayByUser = useMemo(() => {
    const yRows = data?.vsYesterday?.rows;
    if (!Array.isArray(yRows) || windowKey !== 'today') return null;
    return Object.fromEntries(yRows.map(r => [r.userId, r]));
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

      {/* Sticky top bar — slimmer, hairline border, smaller window chips. */}
      <div className="sl-tabs" style={{ position: "sticky", top: 0, zIndex: 10, padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "rgba(10,10,10,0.78)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a href="/creators" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: TEXT_LO, textDecoration: "none" }}>← Voltar</a>
          <div className="sl-hide-mobile" style={{ width: 1, height: 12, background: BORDER_HI }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT }} />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", color: TEXT_HI }}>Quadro de equipa</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          {WINDOWS.map(w => (
            <button
              key={w.key}
              onClick={() => setWindowKey(w.key)}
              data-sl-compact
              style={{
                padding: "5px 10px",
                background: windowKey === w.key ? "rgba(177,30,47,0.12)" : "transparent",
                border: `1px solid ${windowKey === w.key ? "rgba(177,30,47,0.35)" : "transparent"}`,
                borderRadius: 6,
                color: windowKey === w.key ? ACCENT : TEXT_LO,
                fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                cursor: "pointer", fontFamily: "inherit", transition: "color 120ms, background 120ms, border-color 120ms",
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sl-page" style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 28px 80px" }}>

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

            {/* HERO STRIP — 2 wide cards (Outreach + Taxa de resposta).
                Dropped from 3 to 2 (2026-06-18) after removing the
                "Receita projetada" forecast. Wider cards = bigger
                headline numbers, less micro-stat clutter. */}
            <div className="eq-fade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
              {/* Outreach touches hero — primary metric. DM+Email same
                  creator = 1 touch. Sub-stats show the channel split. */}
              <HeroCard
                label={
                  windowKey === 'today'     ? 'Outreach hoje'      :
                  windowKey === 'yesterday' ? 'Outreach ontem'     :
                  windowKey === 'week'      ? 'Outreach esta semana' :
                  windowKey === 'month'     ? 'Outreach este mês'  : 'Outreach sempre'
                }
                value={fmtNum(heroStats.sumTouches)}
                hint={heroStats.totalTarget > 0 ? `${heroStats.totalTarget} alvo (${heroStats.goalPct}%) · DM+Email = 1 toque` : 'DM+Email mesmo creator = 1 toque'}
                accent
                progress={heroStats.totalTarget > 0 ? heroStats.goalPct : null}
                deltaChip={yesterdayTotals && <VsYesterdayChip current={heroStats.sumTouches} previous={yesterdayTotals.sumTouches} />}
              >
                <ActivityBarChart days={data.activity?.flatMap(u => u.days).reduce((acc, d) => {
                  const i = acc.findIndex(x => x.date === d.date);
                  // Bar chart now plots TOUCHES (touches per day across team)
                  // since that's the metric the 30/day rule gates on.
                  if (i >= 0) acc[i].dms += (d.touches || d.dms); else acc.push({ date: d.date, dms: (d.touches || d.dms) });
                  return acc;
                }, [])} target={heroStats.totalTarget} />
                <div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                  <MicroStat label="DMs enviadas" value={fmtNum(heroStats.sumDms)} />
                  <MicroStat label="Emails enviados" value={fmtNum(heroStats.sumEmails)} />
                </div>
              </HeroCard>

              {/* Reply rate hero with channel split. Headline = combined
                  rate (replies / touches). Channel breakdown sits below. */}
              <HeroCard
                label="Taxa de resposta"
                value={`${heroStats.replyRate}%`}
                hint={`${heroStats.sumReplies} respostas · ${heroStats.sumRepliesDm} via DM · ${heroStats.sumRepliesEmail} via Email`}
                deltaChip={yesterdayTotals && <VsYesterdayChip current={heroStats.replyRate} previous={yesterdayTotals.replyRate} suffix="pp" />}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 10 }}>
                  <ProgressRing value={heroStats.replyRate} size={88} stroke={8} color={ACCENT} />
                </div>
                <div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                  <MicroStat label="DM reply rate" value={heroStats.sumDms > 0 ? `${heroStats.dmReplyRate}%` : '—'} accent={heroStats.dmReplyRate >= heroStats.emailReplyRate ? GREEN : null} />
                  <MicroStat label="Email reply rate" value={heroStats.sumEmails > 0 ? `${heroStats.emailReplyRate}%` : '—'} accent={heroStats.emailReplyRate > heroStats.dmReplyRate ? GREEN : null} />
                </div>
              </HeroCard>
            </div>

            {/* OPERADORES TABLE — horizontal-row leaderboard.
                Replaces the previous grid of vertical PersonCard cells
                (2026-06-18). Each operator is now one row across every
                metric so a morning glance answers "who did how much"
                without column-scanning. */}
            <div className="eq-fade" style={{ marginBottom: 22 }}>
              <div style={{
                border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", background: SURFACE_1,
              }}>
                {/* Header */}
                <div style={{
                  padding: "12px 20px",
                  borderBottom: `1px solid ${BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  background: "rgba(255,255,255,0.012)",
                }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_HI, letterSpacing: "0.16em", textTransform: "uppercase" }}>Operadores</div>
                    <div style={{ fontSize: 11, color: TEXT_LO, marginTop: 3 }}>
                      {windowKey === 'today' ? 'Hoje · vs ontem' :
                       windowKey === 'yesterday' ? 'Ontem · fechado' :
                       windowKey === 'week' ? 'Esta semana' :
                       windowKey === 'month' ? 'Este mês' : 'Histórico completo'}
                    </div>
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_DIM, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    {data.rows.length} {data.rows.length === 1 ? 'operador' : 'operadores'}
                  </div>
                </div>
                {/* Rows */}
                {data.rows.length === 0 ? (
                  <div style={{ padding: "60px 20px", textAlign: "center", color: TEXT_DIM, fontSize: 12 }}>
                    Sem atividade nesta janela
                  </div>
                ) : data.rows.map((row, i) => {
                  const sbRow = data.scoreboard?.find(s => s.userId === row.userId);
                  const streak = data.streaks?.find(s => s.userId === row.userId);
                  const delta = data.deltas?.find(d => d.userId === row.userId);
                  const activity = data.activity?.find(a => a.userId === row.userId);
                  const isLeader = i === 0 && data.rows.length > 1 && row.dmsSent > 0;
                  const isLoser = !!sbRow?.missedGoal;
                  const goalPct = sbRow ? Math.min(100, Math.round((row.dmsSent / sbRow.target) * 100)) : null;
                  const yRow = yesterdayByUser?.[row.userId] || null;
                  return (
                    <PersonRow
                      key={row.userId}
                      row={row}
                      sbRow={sbRow}
                      streak={streak}
                      delta={delta}
                      yesterdayRow={yRow}
                      activity={activity}
                      isLeader={isLeader}
                      isLoser={isLoser}
                      goalPct={goalPct}
                      windowKey={windowKey}
                      last={i === data.rows.length - 1}
                    />
                  );
                })}
              </div>
            </div>

            {/* Funil — hairline section block (Pipeline donut removed 2026-06-18) */}
            <div style={{ marginBottom: 18 }}>
              <SectionBlock title="Funil de conversão" subtitle="Por pessoa · sempre">
                <div className="sl-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, data.funnels?.length || 1)}, 1fr)`, gap: 18 }}>
                  {(data.funnels || []).map(f => <FunnelChart key={f.userId} funnel={f} />)}
                </div>
              </SectionBlock>
            </div>

            {/* HEATMAP + RECENT ACTIVITY side by side */}
            <div className="eq-fade sl-grid-2" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginBottom: 18 }}>
              <SectionBlock title="Padrão de atividade" subtitle="Onde a equipa concentra DMs · últimas 4 semanas">
                <Heatmap data={data.heatmap} />
              </SectionBlock>
              <SectionBlock title="Atividade recente" subtitle={`Últimos ${data.recentActivity?.length || 0} eventos`}>
                <RecentActivityFeed events={data.recentActivity || []} />
              </SectionBlock>
            </div>

            {/* QUALITY ROW */}
            {data.quality?.some(q => q.byTemplate.length + q.byLanguage.length + q.byTier.length > 0) && (
              <div style={{ marginBottom: 18 }}>
                <SectionBlock title="Qualidade" subtitle="Taxa de resposta por dimensão">
                  <div className="sl-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, data.quality.length)}, 1fr)`, gap: 22 }}>
                    {data.quality.map(q => (
                      <div key={q.userId}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_HI, marginBottom: 14, letterSpacing: "-0.005em" }}>{q.firstName}</div>
                        <QualityBars title="Template" items={q.byTemplate} />
                        <QualityBars title="Idioma" items={q.byLanguage} />
                        <QualityBars title="Tier" items={q.byTier} />
                      </div>
                    ))}
                  </div>
                </SectionBlock>
              </div>
            )}

            {/* COLLAPSIBLE STRATEGIC BLOCK — header acts as toggle.
                Hidden by default; click to expand. */}
            <button
              type="button"
              onClick={() => setAdvancedOpen(o => !o)}
              className="eq-fade"
              style={{
                width: "100%",
                marginTop: 28, marginBottom: advancedOpen ? 14 : 28,
                padding: "16px 22px",
                background: advancedOpen ? "rgba(177,30,47,0.06)" : SURFACE_1,
                border: `1px solid ${advancedOpen ? "rgba(177,30,47,0.22)" : BORDER}`,
                borderRadius: 16,
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                transition: "background 200ms, border-color 200ms",
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 4 }}>Métricas avançadas</div>
                <div style={{ fontSize: 12, color: TEXT_LO }}>CAC, show-up, ciclo de venda · respondem a "estou em ritmo para bater a meta?"</div>
              </div>
              <span style={{
                fontSize: 18, color: TEXT_MID,
                transform: advancedOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 200ms cubic-bezier(.2,.7,.2,1)",
                lineHeight: 1, marginRight: 4,
              }}>⌃</span>
            </button>

            {advancedOpen && (<>

            {/* EFFICIENCY ROW — CAC per person (Pipeline coverage removed 2026-06-18) */}
            <div className="eq-fade" style={{ marginBottom: 18 }}>
              <Card title="CAC · custo por aquisição" subtitle="Proxy de esforço · €0.50/DM, €1/email, €0.75/follow-up, €15/call">
                <div className="sl-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, userOrder.length)}, 1fr)`, gap: 14 }}>
                  {userOrder.map(({ userId, firstName }) => {
                    const c = data.cac?.find(x => x.userId === userId);
                    if (!c) return (
                      <div key={userId} style={{ padding: 18, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 16, color: TEXT_DIM, fontSize: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_HI, marginBottom: 8 }}>{firstName}</div>
                        Sem dados
                      </div>
                    );
                    return (
                      <div key={userId} style={{ padding: 16, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_HI, marginBottom: 12 }}>{c.firstName}</div>
                        <div style={{ ...monoNum, fontSize: 26, fontWeight: 600, color: TEXT_HI, letterSpacing: "-0.02em", marginBottom: 4, lineHeight: 1 }}>
                          {c.cacEur == null ? '—' : fmtEur(c.cacEur)}
                        </div>
                        <div style={{ fontSize: 11, color: TEXT_LO, marginBottom: 12 }}>por deal assinado</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_DIM, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Spend</div>
                            <div style={{ ...monoNum, fontSize: 13, fontWeight: 600, color: TEXT_MID }}>{fmtEur(c.spendEur)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_DIM, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Payback</div>
                            <div style={{ ...monoNum, fontSize: 13, fontWeight: 600, color: c.paybackRatio && c.paybackRatio >= 5 ? GREEN : TEXT_MID }}>
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
            <div className="eq-fade sl-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
              <Card title="Show-up rate · calls" subtitle="Marcadas vs realizadas · alvo ≥ 70%">
                <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 11, color: TEXT_LO, marginBottom: 4 }}>Equipa</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span style={{ ...monoNum, fontSize: 28, fontWeight: 600, color: data.showUp?.teamRate == null ? TEXT_DIM : data.showUp.teamRate >= 70 ? GREEN : data.showUp.teamRate >= 50 ? AMBER : RED, letterSpacing: "-0.02em" }}>
                      {data.showUp?.teamRate == null ? '—' : `${data.showUp.teamRate}%`}
                    </span>
                    <span style={{ fontSize: 12, color: TEXT_LO }}>
                      {data.showUp?.teamHeld || 0} / {data.showUp?.teamAgreed || 0} calls
                    </span>
                  </div>
                </div>
                <div className="sl-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, userOrder.length)}, 1fr)`, gap: 12 }}>
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
                  <div className="sl-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, userOrder.length)}, 1fr)`, gap: 12 }}>
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
                <div className="sl-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, userOrder.length)}, 1fr)`, gap: 14 }}>
                  {userOrder.map(({ userId, firstName }) => {
                    const v = data.pipelineVelocity?.find(x => x.userId === userId);
                    if (!v) return (
                      <div key={userId} style={{ padding: 18, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 16, color: TEXT_DIM, fontSize: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_HI, marginBottom: 8 }}>{firstName}</div>
                        Sem deals
                      </div>
                    );
                    return (
                      <div key={userId} style={{ padding: 16, background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_HI, marginBottom: 12 }}>{v.firstName}</div>
                        <div style={{ ...monoNum, fontSize: 22, fontWeight: 600, color: TEXT_HI, letterSpacing: "-0.02em", marginBottom: 4, lineHeight: 1 }}>
                          {v.velocityEurPerDay == null ? '—' : `${fmtEur(v.velocityEurPerDay)}/dia`}
                        </div>
                        <div style={{ fontSize: 11, color: TEXT_LO, marginBottom: 12 }}>velocidade</div>
                        <div className="sl-grid-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
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
            <div className="eq-fade sl-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 18, marginBottom: 18 }}>
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
                  <div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
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

            </>)}
            {/* end advancedOpen block */}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── PRIMITIVES ───────────────────────────

// Standard card — used as fallback for sections that still benefit from
// elevation (e.g. inside the collapsed Avançadas block). Tightened from
// 26px/24r/8px-shadow to 20px/12r/no-shadow. Most secondary sections
// have moved to <SectionBlock> (below) and skip Card entirely.
function Card({ title, subtitle, children }) {
  return (
    <div className="eq-card sl-card" style={{
      padding: 20,
      background: SURFACE_1,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
    }}>
      {title && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_HI, letterSpacing: "-0.005em" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: TEXT_LO, marginTop: 3, lineHeight: 1.5 }}>{subtitle}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// Hairline section block — the new default for non-hero surfaces.
// Replaces Card for everything except heroes + nested elevation. Uses
// a 1px border + the section's own typography hierarchy instead of a
// shadow + bigger radius. Lets adjacent sections breathe via gap
// instead of card-stacking.
function SectionBlock({ title, subtitle, action, children, padded = true }) {
  return (
    <div className="eq-fade" style={{
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      overflow: "hidden",
      background: SURFACE_1,
    }}>
      {(title || action) && (
        <div style={{
          padding: "14px 18px",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "rgba(255,255,255,0.012)",
        }}>
          <div>
            {title && <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_HI, letterSpacing: "0.14em", textTransform: "uppercase" }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 11, color: TEXT_LO, marginTop: 4, lineHeight: 1.5 }}>{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: padded ? "18px" : 0 }}>
        {children}
      </div>
    </div>
  );
}

function HeroCard({ label, value, hint, accent, progress, deltaChip, children }) {
  return (
    <div className="eq-card" style={{
      padding: 22,
      background: SURFACE_1,
      // Hairline-only borders for the new design; the accent card gets a
      // slightly warmer red-tinted edge instead of the old big shadow.
      border: `1px solid ${accent ? "rgba(177,30,47,0.22)" : BORDER}`,
      borderRadius: 12,
      minHeight: 200,
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        fontSize: 9, fontWeight: 600,
        color: accent ? ACCENT : TEXT_LO,
        letterSpacing: "0.16em", textTransform: "uppercase",
        marginBottom: 18,
      }}>{label}</div>
      {/* Value + vs-yesterday chip on the same row so the comparison
          reads as a sentence ("47 ↑3 vs ontem") instead of stacked.
          Hero numbers now render in tabular mono so they sit on a digit
          grid — Linear/Vercel/Grafana convention. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{
          ...monoNum,
          fontSize: 36, fontWeight: 600,
          color: TEXT_HI, letterSpacing: "-0.02em", lineHeight: 1,
        }}>{value}</div>
        {deltaChip && <div style={{ display: "inline-flex", alignSelf: "center" }}>{deltaChip}</div>}
      </div>
      {hint && <div style={{ fontSize: 11, color: TEXT_MID, marginBottom: 4, lineHeight: 1.5 }}>{hint}</div>}
      {progress != null && (
        <div style={{ marginTop: 10, marginBottom: 4, height: 3, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: 3, width: `${progress}%`, background: ACCENT, borderRadius: 2, transition: "width 600ms cubic-bezier(.2,.7,.2,1)" }} />
        </div>
      )}
      {children && <div style={{ marginTop: "auto", paddingTop: 16 }}>{children}</div>}
    </div>
  );
}

function MicroStat({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ ...monoNum, fontSize: 16, fontWeight: 600, color: accent || TEXT_HI, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}

function PersonCard({ row, sbRow, streak, pipe, vel, delta, yesterdayRow, monthly, activity, isLeader, isLoser, goalPct, windowKey }) {
  const series = activity?.days || [];
  const replyRate = row.replyRate;
  // Only render the vs-ontem chip on the Hoje view and only when we have
  // a matched yesterday row for this operator. Touches is the headline
  // (DM+Email = 1 toque) so that's the most meaningful comparison.
  const showVsYesterday = windowKey === 'today' && yesterdayRow;
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

      {/* DMs + delta. On the Hoje view we also surface a "vs ontem"
          chip below — same operator, comparing today's count to their
          own yesterday. The week/month deltaDmsSent chip stays as-is for
          longer windows where vs-ontem doesn't apply. */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>DMs enviadas</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: TEXT_HI, letterSpacing: "-0.025em", lineHeight: 1 }}>{row.dmsSent}</span>
          {delta?.deltaDmsSent != null && delta.deltaDmsSent !== 0 && (
            <DeltaBadge value={delta.deltaDmsSent} />
          )}
          {showVsYesterday && (
            <VsYesterdayChip current={row.dmsSent} previous={yesterdayRow.dmsSent || 0} />
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

// ─────────────────────────────────────────────────────────────────
// PersonRow — horizontal table-row leaderboard cell.
//
// Replaces the old vertical PersonCard grid. Each operator becomes one
// row across columns: Operador · Touches · Reply% · Respostas · Fechados
// · Follow-ups · 7-day sparkline · Streak · Goal-ring (Hoje only).
//
// Rationale: a morning-standup view should answer "who did how much
// today" at a single glance. Tables make side-by-side comparison
// instant; cards force the eye to scan column-by-column. Each number
// renders in tabular monospace so columns align as a digit grid.
//
// Grid columns ordered by importance (most-scanned on the left).
// Mobile fallback handled via CSS in the parent (PersonRowTable) — at
// < 900px the row flips to a vertical stack.
// ─────────────────────────────────────────────────────────────────
const PERSON_ROW_COLS = "200px 1fr 100px 110px 90px 90px 100px 120px 60px";
function PersonRow({ row, sbRow, streak, delta, yesterdayRow, activity, isLeader, isLoser, goalPct, windowKey, last }) {
  const series = activity?.days || [];
  const replyRate = row.replyRate;
  const showVsYesterday = windowKey === 'today' && yesterdayRow;
  const signedAccent = row.signed > 0 ? GREEN : TEXT_HI;
  const replyAccent = replyRate >= 15 ? GREEN : replyRate >= 5 ? AMBER : TEXT_HI;
  return (
    <div className="eq-person-row" style={{
      display: "grid",
      gridTemplateColumns: PERSON_ROW_COLS,
      alignItems: "center",
      gap: 16,
      padding: "16px 20px",
      borderBottom: last ? "none" : `1px solid ${BORDER}`,
      background: isLeader ? "rgba(34,197,94,0.025)" : "transparent",
      transition: "background 150ms",
    }}>
      {/* Operador — avatar + name + leader/atrás chip */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: isLeader ? `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})` : "rgba(255,255,255,0.04)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 600, color: isLeader ? "#fff" : TEXT_MID,
          border: `1px solid ${BORDER_HI}`,
          flexShrink: 0,
        }}>
          {initials(row.firstName)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_HI, letterSpacing: "-0.005em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.firstName}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
            {isLeader && <span style={{ fontSize: 8, fontWeight: 600, color: GREEN, letterSpacing: "0.10em", textTransform: "uppercase" }}>Líder</span>}
            {isLoser  && <span style={{ fontSize: 8, fontWeight: 600, color: RED,   letterSpacing: "0.10em", textTransform: "uppercase" }}>Atrás</span>}
            {!isLeader && !isLoser && <span style={{ fontSize: 8, fontWeight: 600, color: TEXT_DIM, letterSpacing: "0.10em", textTransform: "uppercase" }}>Operador</span>}
          </div>
        </div>
      </div>

      {/* Streak — text-only, no emoji. Active days under 30 only mention
          when there's a real streak; renders dimly otherwise so the
          column still aligns. */}
      <div style={{ textAlign: "left" }}>
        {streak?.streak > 0 ? (
          <div>
            <div style={{ ...monoNum, fontSize: 15, fontWeight: 600, color: AMBER, lineHeight: 1 }}>{streak.streak}d</div>
            <div style={{ fontSize: 9, color: TEXT_LO, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3 }}>Streak</div>
          </div>
        ) : (
          <div style={{ fontSize: 9, color: TEXT_DIM, letterSpacing: "0.12em", textTransform: "uppercase" }}>Sem streak</div>
        )}
      </div>

      {/* Touches — primary metric */}
      <PersonRowCell label="Touches" value={row.touchesSent} accent={TEXT_HI} delta={showVsYesterday ? (row.touchesSent - (yesterdayRow.touchesSent || 0)) : null} />

      {/* Reply % — color-coded */}
      <PersonRowCell label="Reply %" value={`${replyRate}%`} accent={replyAccent} delta={showVsYesterday ? (replyRate - (yesterdayRow.replyRate || 0)) : null} deltaSuffix="pp" />

      {/* Respostas absolutas */}
      <PersonRowCell label="Respostas" value={row.repliesReceived} accent={TEXT_HI} delta={showVsYesterday ? (row.repliesReceived - (yesterdayRow.repliesReceived || 0)) : null} />

      {/* Fechados */}
      <PersonRowCell label="Fechados" value={row.signed} accent={signedAccent} delta={delta?.deltaSigned} />

      {/* Follow-ups */}
      <PersonRowCell label="F-up" value={row.followUpsDone} accent={TEXT_MID} />

      {/* 7-day sparkline */}
      <div style={{ alignSelf: "center" }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>7 dias</div>
        {series.length > 0 ? <Sparkline days={series} /> : <div style={{ fontSize: 10, color: TEXT_DIM }}>—</div>}
      </div>

      {/* Goal ring — only on Hoje view, shows DMs/target progress */}
      <div style={{ alignSelf: "center", justifySelf: "end" }}>
        {windowKey === 'today' && sbRow ? (
          <ProgressRing value={goalPct} size={44} stroke={4} color={goalPct >= 100 ? GREEN : ACCENT} centerLabel={`${row.dmsSent}/${sbRow.target}`} />
        ) : null}
      </div>
    </div>
  );
}

function PersonRowCell({ label, value, accent, delta, deltaSuffix = '' }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <div style={{ ...monoNum, fontSize: 18, fontWeight: 600, color: accent || TEXT_HI, lineHeight: 1, letterSpacing: "-0.01em" }}>{value}</div>
        {delta != null && delta !== 0 && (
          <span style={{ ...monoNum, fontSize: 10, fontWeight: 600, color: delta > 0 ? GREEN : RED }}>
            {delta > 0 ? '+' : ''}{delta}{deltaSuffix}
          </span>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, accent, delta, deltaSuffix = '' }) {
  return (
    <div style={{ padding: "8px 10px", background: SURFACE_0, borderRadius: 8, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, ...monoNum }}>
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
      ...monoNum,
      display: "inline-flex", alignItems: "center", gap: 2,
      padding: "1px 6px", borderRadius: 4,
      background: positive ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
      color: positive ? GREEN : RED,
      fontSize: 10, fontWeight: 600,
    }}>
      {positive ? '+' : '−'}{Math.abs(value)}
    </span>
  );
}

// "+3 vs ontem" — minimal mono chip, less rounded than the old pill.
// Reads as a single line of telemetry rather than a bubbly badge.
function VsYesterdayChip({ current, previous, suffix = '', invertColor = false }) {
  if (typeof previous !== 'number') return null;
  const diff = (current || 0) - previous;
  if (diff === 0) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        padding: "1px 6px", borderRadius: 4,
        background: "rgba(255,255,255,0.025)",
        color: TEXT_LO, fontSize: 10, fontWeight: 500,
      }}>
        <span style={{ ...monoNum, marginRight: 5 }}>=</span>
        <span style={{ fontWeight: 500, letterSpacing: "0.04em" }}>ontem</span>
      </span>
    );
  }
  const positive = invertColor ? diff < 0 : diff > 0;
  const sign = diff > 0 ? '+' : '−';
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "1px 6px", borderRadius: 4,
      background: positive ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
      color: positive ? GREEN : RED,
      fontSize: 10, fontWeight: 600,
    }}>
      <span style={monoNum}>{sign}{Math.abs(diff)}{suffix}</span>
      <span style={{ opacity: 0.7, fontWeight: 500, letterSpacing: "0.04em" }}>vs ontem</span>
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

// ActivityBarChart — 7-day touches/day. Rebuilt as HTML/CSS divs
// (2026-06-18) after the previous SVG version with
// `preserveAspectRatio="none"` exploded vertically when the parent
// card got wider in the 2-up hero strip. Divs always honor their
// parent's box; SVG with that prop stretches both axes independently
// and turns text + tracks into giant pills.
//
// Empty state: when every day is 0, render a single muted row + a
// "Sem atividade ainda" caption instead of seven full-height empty
// tracks (which read as a row of placeholders, not as "zero").
function ActivityBarChart({ days = [], target = 30 }) {
  if (!days?.length) return null;
  const maxVal = Math.max(...days.map(d => d.dms), 0);
  const isEmpty = maxVal === 0;
  // Scale floor: target * 0.6 keeps bars proportional to the goal so
  // a 5-DM day doesn't look like a peak just because the week was slow.
  const max = Math.max(target * 0.6, maxVal, 1);
  const dayLabel = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return ['D','S','T','Q','Q','S','S'][d.getDay()];
  };
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());

  if (isEmpty) {
    return (
      <div style={{
        height: 70, display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px dashed ${BORDER}`, borderRadius: 8,
        fontSize: 11, color: TEXT_DIM, letterSpacing: "0.04em",
      }}>
        Sem atividade ainda esta semana
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 6, height: 70 }}>
      {days.map(d => {
        const pct = Math.min(100, (d.dms / max) * 100);
        const isToday = d.date === todayStr;
        return (
          <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", minWidth: 0 }}>
            <div style={{
              position: "relative", flex: 1,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 4, overflow: "hidden",
            }}>
              {/* Filled portion grows from the bottom up. Today's bar
                  gets the brand red accent; other days are neutral
                  white so today stands out at a glance. */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: `${Math.max(2, pct)}%`,
                background: isToday
                  ? `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`
                  : "rgba(255,255,255,0.20)",
                borderRadius: 4,
                transition: "height 600ms cubic-bezier(.2,.7,.2,1)",
              }} />
            </div>
            <div style={{
              fontSize: 9, fontWeight: 600, marginTop: 6, textAlign: "center",
              color: isToday ? ACCENT : TEXT_LO, letterSpacing: "0.08em",
            }}>
              {dayLabel(d.date)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Sparkline — 7-day mini line chart. Stays as SVG (curves need it),
// but with two fixes that make it container-independent:
//   - `display: block` on the SVG so it can't pick up inline-default
//     whitespace from the parent flex/grid cell
//   - `vectorEffect="non-scaling-stroke"` on every stroked path so
//     lines stay 2px regardless of how the viewBox stretches. Without
//     this, the line gets fatter when the cell is wide and thinner
//     when narrow, which was visible after the people row became a
//     table with variable column widths.
function Sparkline({ days = [] }) {
  if (!days.length) return null;
  const allZero = days.every(d => (d.dms || 0) === 0);
  if (allZero) {
    return (
      <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: TEXT_DIM }}>
        —
      </div>
    );
  }
  const max = Math.max(1, ...days.map(d => d.dms));
  const W = 200, H = 36;
  const stepX = W / (days.length - 1 || 1);
  const points = days.map((d, i) => [i * stepX, H - (d.dms / max) * H]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ');
  const areaPath = path + ` L ${W},${H} L 0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 28, display: "block" }}>
      <defs>
        <linearGradient id="sparkfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.30} />
          <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkfill)" />
      <path d={path} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {points.length > 0 && (
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2.5} fill={ACCENT} vectorEffect="non-scaling-stroke" />
      )}
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

// Human labels for the template-letter quality breakdown. Keeps the
// dashboard readable when more than 2 templates are in play. Update when
// new templates are added in app/api/dm-writer/route.js.
const TEMPLATE_LABELS = {
  A: 'A · SL consultivo',
  B: 'B · SL parceria',
  C: 'C · Day in the Life',
};

function QualityBars({ title, items }) {
  if (!items?.length) return null;
  const isTemplate = title === 'Template';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((it, i) => {
          const color = it.rate >= 15 ? GREEN : it.rate >= 5 ? AMBER : TEXT_LO;
          const label = isTemplate ? (TEMPLATE_LABELS[it.key] || it.key) : it.key;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: TEXT_MID, width: isTemplate ? 130 : 60 }}>{label}</span>
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
