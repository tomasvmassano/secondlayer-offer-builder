"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * /equipa/respostas — analyse the classified creator replies at scale. Leads
 * with Template (A/B) + time so the team can see how the message + offer land
 * and where the process leaks. Backed by GET /api/reply-analytics.
 */

const ACCENT = "var(--sl-primary)";
const TEXT_HI = "var(--sl-text)";
const TEXT_MID = "var(--sl-text-muted)";
const TEXT_LO = "var(--sl-text-faint)";
const GREEN = "var(--sl-success)";
const AMBER = "var(--sl-warning)";
const RED = "var(--sl-danger)";
const BORDER = "color-mix(in srgb, var(--sl-text) 6%, transparent)";
const SURFACE_0 = "var(--sl-bg)";
const SURFACE_1 = "var(--sl-surface)";

const WINDOWS = [
  { key: "week", label: "Semana" }, { key: "month", label: "Mês" },
  { key: "quarter", label: "Trimestre" }, { key: "ytd", label: "YTD" },
  { key: "90d", label: "90 dias" }, { key: "all", label: "Sempre" },
];
const BLAME_LABELS = {
  positive: "Interessado", "genuine-question": "Pergunta genuína",
  circumstances: "Circunstâncias (tempo/dinheiro)", "other-people": "Terceiros (sócio/equipa)",
  self: "Dúvida própria", disqualify: "Não qualifica", por_classificar: "Por classificar",
};
const SENT_LABELS = { positive: "Positivo", neutral: "Neutro", negative: "Negativo", por_classificar: "Por classificar" };
const SENT_COLOR = { positive: GREEN, neutral: TEXT_LO, negative: RED, por_classificar: "color-mix(in srgb, var(--sl-text) 18%, transparent)" };
const OFFER_LABELS = { liked: "Percebeu e gostou", "not-for-me": "Percebeu, não é para já", "didnt-understand": "Não percebeu", na: "N/A", por_classificar: "Por classificar" };

const fmtDay = (iso) => { const [, m, d] = (iso || "").split("-"); return d ? `${d}/${m}` : ""; };
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default function RespostasPage() {
  const [windowKey, setWindowKey] = useState("all");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backfill, setBackfill] = useState(null); // null | { running, done, total, finished, error }

  const load = (fresh) => fetch(`/api/reply-analytics?window=${windowKey}${fresh ? "&fresh=1" : ""}`)
    .then(r => r.json())
    .then(d => { if (d.error) setError(d.error); else setData(d); })
    .catch(e => setError(e.message));

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    fetch(`/api/reply-analytics?window=${windowKey}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { if (d.error) setError(d.error); else setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [windowKey]);

  // Backfill — classify old, untagged replies (client-driven loop, one creator
  // per call, like Bulk Audit) then refresh with a cache-bypass.
  const runBackfill = async () => {
    if (backfill?.running) return;
    setBackfill({ running: true, done: 0, total: 0 });
    try {
      const list = await fetch("/api/reply-analytics/backfill").then(r => r.json());
      const creators = list.creators || [];
      const total = list.total || 0;
      setBackfill({ running: true, done: 0, total });
      let done = 0;
      for (const c of creators) {
        try {
          const d = await fetch("/api/reply-analytics/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creatorId: c.id }) }).then(r => r.json());
          done += (d.classified || 0);
        } catch { /* skip a failed creator, keep going */ }
        setBackfill({ running: true, done, total });
      }
      await load(true);
      setBackfill({ running: false, finished: true, done, total });
    } catch (e) {
      setBackfill({ running: false, error: e.message });
    }
  };

  const trendMax = useMemo(() => Math.max(1, ...(data?.trend || []).map(t => t.total)), [data]);

  return (
    <div style={{ minHeight: "100dvh", background: SURFACE_0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 28px", borderBottom: `1px solid ${BORDER}`, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/equipa" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: TEXT_LO, textDecoration: "none" }}>← Equipa</a>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_HI }}>Respostas dos criadores</span>
        </div>
        <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {WINDOWS.map(w => (
            <button key={w.key} onClick={() => setWindowKey(w.key)} style={{
              padding: "5px 10px", background: windowKey === w.key ? "color-mix(in srgb, var(--sl-primary) 12%, transparent)" : "transparent",
              border: `1px solid ${windowKey === w.key ? "color-mix(in srgb, var(--sl-primary) 35%, transparent)" : "transparent"}`,
              borderRadius: 6, color: windowKey === w.key ? ACCENT : TEXT_LO, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em",
              textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
            }}>{w.label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 80px" }}>
        {error && <div style={{ color: RED, fontSize: 13, padding: 40, textAlign: "center" }}>Erro: {error}</div>}
        {loading && !data && <div style={{ color: TEXT_LO, fontSize: 13, padding: 40, textAlign: "center" }}>A carregar…</div>}

        {data && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: TEXT_HI, letterSpacing: "-0.02em" }}>{data.total}</span>
              <span style={{ fontSize: 13, color: TEXT_MID }}>respostas analisadas</span>
              {data.untagged > 0 && <span style={{ fontSize: 12, color: TEXT_LO }}>· {data.untagged} por classificar</span>}
              {(data.untagged > 0 || backfill) && (
                <button
                  onClick={runBackfill}
                  disabled={backfill?.running}
                  className="sl-btn-primary"
                  data-sl-compact
                  style={{ padding: "6px 12px", fontSize: 12, opacity: backfill?.running ? 0.7 : 1, cursor: backfill?.running ? "wait" : "pointer" }}
                >
                  {backfill?.running
                    ? `A classificar… ${backfill.done}${backfill.total ? `/${backfill.total}` : ""}`
                    : backfill?.finished
                      ? `Classificadas ${backfill.done} ✓`
                      : "Classificar respostas antigas"}
                </button>
              )}
              {backfill?.error && <span style={{ fontSize: 12, color: RED }}>Erro: {backfill.error}</span>}
            </div>

            {data.total === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 20px", color: TEXT_LO, fontSize: 13 }}>
                Sem respostas neste período. Aparecem aqui à medida que a equipa cola as respostas dos criadores no separador DM Writer.
              </div>
            ) : (
              <>
                {/* ── LEAD: Template A vs B ── */}
                <SectionTitle>Template A vs B</SectionTitle>
                <div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 26 }}>
                  {["A", "B"].map(k => <TemplateCard key={k} label={k} t={data.byTemplate?.[k]} />)}
                </div>

                {/* ── Tendência (sentiment over time) ── */}
                <SectionTitle>Tendência de sentimento</SectionTitle>
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE_1, padding: "18px 20px", marginBottom: 26 }}>
                  {(!data.trend || data.trend.length === 0) ? (
                    <div style={{ fontSize: 12, color: TEXT_LO }}>Sem histórico suficiente.</div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, overflowX: "auto" }}>
                      {data.trend.map((wk, i) => (
                        <div key={i} title={`${fmtDay(wk.period)} · ${wk.total} respostas`} style={{ flex: "1 0 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 22 }}>
                          <div style={{ width: "100%", maxWidth: 34, height: 92, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                            {["negative", "neutral", "positive"].map(s => {
                              const h = (wk[s] / trendMax) * 92;
                              return h > 0 ? <div key={s} style={{ height: `${h}px`, background: SENT_COLOR[s], opacity: 0.9 }} /> : null;
                            })}
                          </div>
                          <span style={{ fontSize: 12, color: TEXT_LO, whiteSpace: "nowrap" }}>{fmtDay(wk.period)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Legend items={[["positive", "Positivo"], ["neutral", "Neutro"], ["negative", "Negativo"]]} />
                </div>

                {/* ── Objeções ── */}
                <SectionTitle>Objeções (o que faz recuar)</SectionTitle>
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE_1, padding: "18px 20px", marginBottom: 26 }}>
                  <BarList rows={data.byBlame} total={data.total} labels={BLAME_LABELS} />
                </div>

                {/* ── Sentimento + Reação à oferta ── */}
                <div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 26 }}>
                  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE_1, padding: "18px 20px" }}>
                    <SubTitle>Sentimento geral</SubTitle>
                    <BarList rows={entriesOf(data.bySentiment)} total={data.total} labels={SENT_LABELS} colorByKey={SENT_COLOR} />
                  </div>
                  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE_1, padding: "18px 20px" }}>
                    <SubTitle>Reação à oferta</SubTitle>
                    <BarList rows={entriesOf(data.byOfferReaction)} total={data.total} labels={OFFER_LABELS} />
                  </div>
                </div>

                {/* ── Conversão por objeção ── */}
                <SectionTitle>Conversão por objeção</SectionTitle>
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE_1, padding: "10px 20px 16px", marginBottom: 26, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: TEXT_LO, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        <th style={{ textAlign: "left", padding: "10px 8px" }}>Objeção (última resposta)</th>
                        <th style={{ textAlign: "right", padding: "10px 8px" }}>Criadores</th>
                        <th style={{ textAlign: "right", padding: "10px 8px" }}>Reunião</th>
                        <th style={{ textAlign: "right", padding: "10px 8px" }}>Fechado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.conversionByBlame.map(r => (
                        <tr key={r.key} style={{ borderTop: `1px solid ${BORDER}` }}>
                          <td style={{ padding: "10px 8px", color: TEXT_HI }}>{BLAME_LABELS[r.key] || r.key}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: TEXT_MID, fontVariantNumeric: "tabular-nums" }}>{r.creators}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: TEXT_HI, fontVariantNumeric: "tabular-nums" }}>{pct(r.meeting, r.creators)}%</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: r.signed > 0 ? GREEN : TEXT_MID, fontVariantNumeric: "tabular-nums" }}>{pct(r.signed, r.creators)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Citações ── */}
                <SectionTitle>Citações (a voz real, por objeção)</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {data.byBlame.slice(0, 5).map(b => {
                    const qs = data.quotes?.[b.key] || [];
                    if (!qs.length) return null;
                    return (
                      <div key={b.key}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_LO, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                          {BLAME_LABELS[b.key] || b.key} <span style={{ color: TEXT_LO, fontWeight: 400 }}>· {b.count}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {qs.map((q, i) => (
                            <a key={i} href={`/creators/${q.creatorId}`} style={{ display: "block", padding: "10px 14px", background: SURFACE_1, border: `1px solid ${BORDER}`, borderRadius: 10, textDecoration: "none" }}>
                              <div style={{ fontSize: 13, color: TEXT_MID, lineHeight: 1.5, fontStyle: "italic" }}>“{q.text}”</div>
                              <div style={{ fontSize: 12, color: TEXT_LO, marginTop: 4 }}>
                                {q.creatorName} · Template {q.template}{q.sentiment ? ` · ${SENT_LABELS[q.sentiment] || q.sentiment}` : ""}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function entriesOf(obj) {
  return Object.entries(obj || {}).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 12px" }}>{children}</div>;
}
function SubTitle({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_LO, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>{children}</div>;
}
function Legend({ items }) {
  return (
    <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
      {items.map(([k, label]) => (
        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: TEXT_LO }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: SENT_COLOR[k] }} /> {label}
        </span>
      ))}
    </div>
  );
}

function BarList({ rows, total, labels, colorByKey }) {
  if (!rows?.length) return <div style={{ fontSize: 12, color: TEXT_LO }}>Sem dados.</div>;
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {rows.map(r => (
        <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: TEXT_MID, width: 190, flexShrink: 0 }}>{(labels && labels[r.key]) || r.key}</span>
          <div style={{ flex: 1, height: 22, background: SURFACE_0, borderRadius: 6, border: `1px solid ${BORDER}`, overflow: "hidden", position: "relative" }}>
            <div style={{ height: "100%", width: `${(r.count / max) * 100}%`, background: (colorByKey && colorByKey[r.key]) || "color-mix(in srgb, var(--sl-primary) 30%, transparent)", borderRadius: 6, transition: "width 500ms" }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_HI, width: 78, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
            {r.count} <span style={{ color: TEXT_LO, fontWeight: 400 }}>· {pct(r.count, total)}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function TemplateCard({ label, t }) {
  if (!t || !t.total) {
    return (
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE_1, padding: "18px 20px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_HI }}>Template {label}</div>
        <div style={{ fontSize: 12, color: TEXT_LO, marginTop: 8 }}>Sem respostas neste período.</div>
      </div>
    );
  }
  const sent = t.sentiment || {};
  const order = ["positive", "neutral", "negative", "por_classificar"];
  const topBlame = (t.blame || [])[0];
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE_1, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_HI }}>Template {label}</div>
        <div style={{ fontSize: 12, color: TEXT_LO }}>{t.total} respostas · {t.creators} criadores</div>
      </div>
      {/* Sentiment stacked bar */}
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginTop: 14, border: `1px solid ${BORDER}` }}>
        {order.map(s => { const w = pct(sent[s] || 0, t.total); return w > 0 ? <div key={s} title={`${SENT_LABELS[s]} ${w}%`} style={{ width: `${w}%`, background: SENT_COLOR[s] }} /> : null; })}
      </div>
      <div style={{ fontSize: 12, color: TEXT_LO, marginTop: 6 }}>
        {pct(sent.positive || 0, t.total)}% positivo · {pct(sent.negative || 0, t.total)}% negativo
      </div>
      {topBlame && (
        <div style={{ fontSize: 12, color: TEXT_MID, marginTop: 10 }}>
          Objeção nº1: <strong style={{ color: TEXT_HI }}>{BLAME_LABELS[topBlame.key] || topBlame.key}</strong> ({topBlame.count})
        </div>
      )}
      {/* Conversion */}
      <div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        {[["Reunião", t.converted.meeting], ["Fechado", t.converted.signed]].map(([lab, n]) => (
          <div key={lab} style={{ padding: "8px 10px", background: SURFACE_0, border: `1px solid ${BORDER}`, borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: lab === "Fechado" && n > 0 ? GREEN : TEXT_HI, fontVariantNumeric: "tabular-nums" }}>{pct(n, t.creators)}%</div>
            <div style={{ fontSize: 12, color: TEXT_LO, marginTop: 2 }}>{lab}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
