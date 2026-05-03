"use client";

import { useState, useCallback } from "react";
import { calculateDealScore } from "../../../lib/dealScore";
import { renderMd } from "../../../offer-builder/lib/shared";
import KickoffSection from "./KickoffSection";

// ─── Constants ───
const LAUNCH_PHASES = [
  { phase: "Brand & Messaging", assets: [
    { key: "salesPageCopy", label: "Sales Page Copy", desc: "Copy completo para a pagina de vendas" },
    { key: "communityActivation", label: "Community Activation", desc: "Estrategia de ativacao e viralidade" },
    { key: "leadMagnet", label: "Lead Magnet", desc: "Design do lead magnet" },
  ]},
  { phase: "Acquisition", assets: [
    { key: "adCreative", label: "Ad Creative", desc: "Copy e direccao visual para Meta + TikTok ads" },
    { key: "emailSequence", label: "Email Sequence", desc: "Sequencia de emails: pre-launch + launch + onboarding" },
    { key: "socialContent", label: "Social Content", desc: "Calendario de conteudo de 30 dias" },
  ]},
  { phase: "Retention", assets: [
    { key: "onboardingFlow", label: "Onboarding Flow", desc: "Fluxo de onboarding + habit loop design" },
    { key: "churnPrevention", label: "Churn Prevention", desc: "Sistema anti-churn + win-back campaigns" },
    { key: "launchTimeline", label: "Launch Timeline", desc: "Plano semana a semana para o lancamento" },
  ]},
];

const ALL_ASSETS = LAUNCH_PHASES.flatMap(p => p.assets);

const TIMELINE_PHASES = [
  { key: "strategy", label: "Strategy", weeks: [1, 2] },
  { key: "build", label: "Build", weeks: [3, 4, 5] },
  { key: "prelaunch", label: "Pre-Launch", weeks: [6, 7] },
  { key: "launch", label: "Launch", weeks: [8, 9] },
  { key: "optimize", label: "Optimize", weeks: [10, 11, 12] },
  { key: "operate", label: "Operate", weeks: [13] },
];

const SIDEBAR_TABS = [
  { key: "overview", label: "Overview", icon: "◻" },
  { key: "kickoff", label: "Kickoff", icon: "✦" },
  { key: "strategy", label: "Strategy", icon: "◈" },
  { key: "brand", label: "Brand", icon: "◉" },
  { key: "build", label: "Build", icon: "▤" },
  { key: "analytics", label: "Analytics", icon: "▥" },
];

const STATUS_COLORS = {
  draft: { bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.25)", color: "#eab308", label: "Draft" },
  reviewed: { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.25)", color: "#3b82f6", label: "Em Revisao" },
  approved: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", color: "#22c55e", label: "Aprovado" },
  live: { bg: "rgba(122,14,24,0.15)", border: "rgba(122,14,24,0.3)", color: "#7A0E18", label: "Live" },
};

function formatFollowers(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function getWeeksSinceSigned(signedAt) {
  if (!signedAt) return 0;
  const diff = Date.now() - new Date(signedAt).getTime();
  return Math.max(1, Math.ceil(diff / (7 * 24 * 60 * 60 * 1000)));
}

function getCurrentPhase(creator) {
  const la = creator.launch || {};
  const assetCount = Object.keys(la).length;
  const approvedCount = Object.values(la).filter(v => v?.status === 'approved' || v?.status === 'live').length;
  if (!creator.offer) return "strategy";
  if (assetCount < 5) return "build";
  if (approvedCount < 5) return "build";
  if (approvedCount >= 5 && approvedCount < ALL_ASSETS.length) return "prelaunch";
  return "launch";
}

function getNextActions(creator) {
  const actions = [];
  if (!creator.offer) {
    actions.push({ text: "Construir oferta (Hormozi framework)", tab: "strategy", priority: "high" });
  }
  if (!creator.dmSequence) {
    actions.push({ text: "Gerar sequencia de DMs", tab: "strategy", priority: "medium" });
  }
  if (!creator.brand?.primaryColor) {
    actions.push({ text: "Configurar design system do creator", tab: "brand", priority: "high" });
  }
  const la = creator.launch || {};
  // Find assets not yet generated
  const missing = ALL_ASSETS.filter(a => !la[a.key]);
  if (missing.length > 0 && creator.offer) {
    actions.push({ text: `Gerar ${missing[0].label}`, tab: "build", priority: "high" });
    if (missing.length > 1) actions.push({ text: `Gerar ${missing[1].label}`, tab: "build", priority: "medium" });
  }
  // Find assets in draft needing review
  const drafts = ALL_ASSETS.filter(a => la[a.key] && (!la[a.key].status || la[a.key].status === 'draft'));
  if (drafts.length > 0) {
    actions.push({ text: `Revisar e aprovar ${drafts[0].label}`, tab: "build", priority: "high" });
  }
  // Analytics setup
  if (!creator.integrations?.stripe) {
    actions.push({ text: "Configurar integracao Stripe", tab: "analytics", priority: "low" });
  }
  return actions.slice(0, 5);
}

// ─── Component ───
export default function WorkspaceDashboard({ creator, params, patchCreator, saving, generateLaunchAsset, launchGenerating, launchError, launchStreamText, launchExpanded, setLaunchExpanded, launchEditing, setLaunchEditing, launchEditContent, setLaunchEditContent }) {
  const [wsTab, setWsTab] = useState("overview");

  let dealScore = null;
  try { dealScore = calculateDealScore(creator); } catch {}

  const followers = (creator.platforms?.instagram?.followers || 0) + (creator.platforms?.tiktok?.followers || 0) + (creator.platforms?.youtube?.subscribers || 0);
  const weeksSigned = getWeeksSinceSigned(creator.signedAt);
  const currentPhase = getCurrentPhase(creator);
  const nextActions = getNextActions(creator);
  const launchAssets = creator.launch || {};
  const assetsDone = Object.keys(launchAssets).length;
  const assetsApproved = Object.values(launchAssets).filter(v => v?.status === 'approved' || v?.status === 'live').length;
  const priceMatch = creator.offer?.raw?.match(/RECOMMENDED MONTHLY PRICE:\s*€?\s*(\d+)/i);
  const price = priceMatch ? `€${priceMatch[1]}` : dealScore?.nicheData ? `€${dealScore.nicheData.mid}` : "—";
  const metrics = creator.metrics || {};

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif", display: "flex" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes sl-spin{to{transform:rotate(360deg)}}
        @keyframes sl-pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        [data-tip]{position:relative}
        [data-tip]:hover::after{content:attr(data-tip);position:absolute;left:0;top:100%;margin-top:4px;padding:8px 12px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:6px;font-size:11px;color:#ccc;white-space:pre-line;line-height:1.5;z-index:100;min-width:200px;max-width:320px;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.4)}
      `}</style>

      {/* ═══════ SIDEBAR ═══════ */}
      <div style={{ width: 220, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0, background: "#0d0d0d", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>

        {/* Creator info */}
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {creator.profilePicUrl ? (
              <img src={`/api/proxy-image?url=${encodeURIComponent(creator.profilePicUrl)}`} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.06)" }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#555" }}>{(creator.name || "?")[0].toUpperCase()}</div>
            )}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", lineHeight: 1.2 }}>{creator.name}</div>
              <div style={{ fontSize: 10, color: "#555" }}>{creator.niche}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Signed</span>
            {dealScore && <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: dealScore.colors.bg, color: dealScore.colors.color, border: `1px solid ${dealScore.colors.border}` }}>Score {dealScore.grade}</span>}
            <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: "rgba(255,255,255,0.03)", color: "#666" }}>{formatFollowers(followers)}</span>
          </div>
        </div>

        {/* Navigation */}
        <div style={{ padding: "12px 10px", flex: 1, display: "flex", flexDirection: "column" }}>
          {SIDEBAR_TABS.map(t => (
            <button key={t.key} onClick={() => setWsTab(t.key)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "10px 12px", borderRadius: 8, border: "none",
              background: wsTab === t.key ? "rgba(122,14,24,0.12)" : "transparent",
              color: wsTab === t.key ? "#f5f5f5" : "#666",
              fontSize: 13, fontWeight: wsTab === t.key ? 600 : 400,
              cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              transition: "all 0.15s", marginBottom: 2,
            }}>
              <span style={{ fontSize: 14, opacity: 0.7, width: 20, textAlign: "center" }}>{t.icon}</span>
              {t.label}
              {t.key === "build" && assetsDone > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 9, color: "#888", fontWeight: 600 }}>{assetsDone}/{ALL_ASSETS.length}</span>
              )}
            </button>
          ))}

          {/* CRM tools — pre-signing assets stay reachable after signing */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#444", letterSpacing: "0.14em", textTransform: "uppercase", padding: "0 12px 8px" }}>CRM Tools</div>
            {[
              { key: "perfil", label: "Perfil", icon: "◐", desc: "Audience, deal score, intelligence" },
              { key: "dm",     label: "DM Writer", icon: "✉", desc: "Sequência de DMs e emails", filled: !!creator?.dmSequence },
              { key: "oferta", label: "Oferta + Revenue", icon: "€", desc: "Hormozi offer + Revenue Projector", filled: !!creator?.offer },
              { key: "launch", label: "Launch Assets", icon: "▤", desc: "Pre-signing launch assets" },
              { key: "pitch",  label: "Pitch Deck", icon: "▦", desc: "Pitch deck (read/edit)" },
            ].map(t => (
              <a key={t.key} href={`/creators/${params?.id}?view=crm&tab=${t.key}`} title={t.desc} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "10px 12px", borderRadius: 8, textDecoration: "none",
                color: "#666", fontSize: 13, fontWeight: 400,
                fontFamily: "inherit", marginBottom: 2,
              }}>
                <span style={{ fontSize: 14, opacity: 0.7, width: 20, textAlign: "center" }}>{t.icon}</span>
                {t.label}
                {t.filled && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", marginLeft: "auto" }} />}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom links */}
        <div style={{ padding: "16px 14px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {saving && <div style={{ fontSize: 10, color: saving.includes("Erro") ? "#ef4444" : "#22c55e", marginBottom: 8, padding: "0 6px" }}>{saving}</div>}
          <a href="/pipeline" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 6, textDecoration: "none", color: "#555", fontSize: 12, transition: "color 0.15s" }}>
            &larr; Pipeline
          </a>
        </div>
      </div>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <div style={{ flex: 1, minHeight: "100vh", overflowY: "auto" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 36px 80px" }}>

          {/* ════════════ OVERVIEW TAB ════════════ */}
          {wsTab === "overview" && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Overview</h2>
              <p style={{ fontSize: 12, color: "#555", margin: "0 0 28px" }}>Semana {weeksSigned} desde a assinatura</p>

              {/* Phase timeline */}
              <div style={{ marginBottom: 32, padding: "20px 24px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Launch Timeline</span>
                  <span style={{ fontSize: 11, color: "#555" }}>Fase atual: <span style={{ color: "#f5f5f5", fontWeight: 600 }}>{TIMELINE_PHASES.find(p => p.key === currentPhase)?.label || currentPhase}</span></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                  {TIMELINE_PHASES.map((phase, i) => {
                    const isActive = phase.key === currentPhase;
                    const isPast = TIMELINE_PHASES.findIndex(p => p.key === currentPhase) > i;
                    return (
                      <div key={phase.key} style={{ flex: phase.weeks.length, display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: "100%", height: 6, borderRadius: i === 0 ? "3px 0 0 3px" : i === TIMELINE_PHASES.length - 1 ? "0 3px 3px 0" : 0, background: isPast ? "#22c55e" : isActive ? "#7A0E18" : "rgba(255,255,255,0.06)", transition: "background 0.3s" }} />
                        <span style={{ fontSize: 9, color: isActive ? "#f5f5f5" : isPast ? "#22c55e" : "#444", fontWeight: isActive ? 700 : 400, marginTop: 6 }}>{phase.label}</span>
                        <span style={{ fontSize: 8, color: "#333" }}>W{phase.weeks[0]}{phase.weeks.length > 1 ? `-${phase.weeks[phase.weeks.length - 1]}` : "+"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
                {[
                  { label: "MRR", value: metrics.mrr ? `€${metrics.mrr.toLocaleString()}` : "€0", sub: "revenue mensal", color: "#f5f5f5" },
                  { label: "Members", value: metrics.members || "0", sub: "membros ativos", color: "#f5f5f5" },
                  { label: "Preco", value: price, sub: "/mes", color: "#eab308" },
                  { label: "Churn", value: metrics.churnRate ? `${metrics.churnRate}%` : "—", sub: "mensal", color: metrics.churnRate > 8 ? "#ef4444" : "#22c55e" },
                ].map((kpi, i) => (
                  <div key={i} style={{ padding: "18px 20px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{kpi.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                    <div style={{ fontSize: 10, color: "#333", marginTop: 2 }}>{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Two columns: Progress + Next Actions */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>

                {/* Phase Progress */}
                <div style={{ padding: "20px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 16px", color: "#f5f5f5" }}>Progresso</h3>
                  {[
                    { label: "Strategy", done: (creator.offer ? 1 : 0) + (creator.dmSequence ? 1 : 0), total: 2, color: "#a855f7" },
                    { label: "Brand", done: creator.brand?.primaryColor ? 1 : 0, total: 1, color: "#f97316" },
                    { label: "Build", done: assetsDone, total: ALL_ASSETS.length, color: "#3b82f6" },
                    { label: "Approved", done: assetsApproved, total: ALL_ASSETS.length, color: "#22c55e" },
                  ].map((bar, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "#888" }}>{bar.label}</span>
                        <span style={{ fontSize: 11, color: "#666", fontWeight: 600 }}>{bar.done}/{bar.total}</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: 6, borderRadius: 3, background: bar.color, width: (bar.total > 0 ? (bar.done / bar.total) * 100 : 0) + "%", transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Next Actions */}
                <div style={{ padding: "20px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 16px", color: "#f5f5f5" }}>Proximas Acoes</h3>
                  {nextActions.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#444" }}>Tudo em dia!</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {nextActions.map((action, i) => (
                        <button key={i} onClick={() => setWsTab(action.tab)} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
                          borderRadius: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "inherit",
                          transition: "border-color 0.15s",
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: action.priority === "high" ? "#7A0E18" : action.priority === "medium" ? "#eab308" : "#555", flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "#ccc" }}>{action.text}</span>
                          <span style={{ marginLeft: "auto", fontSize: 9, color: "#444" }}>&rarr;</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Asset status grid */}
              <div style={{ padding: "20px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "#f5f5f5" }}>Launch Assets</h3>
                  <button onClick={() => setWsTab("build")} style={{ fontSize: 10, color: "#7A0E18", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Ver todos &rarr;</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {ALL_ASSETS.map(a => {
                    const la = launchAssets[a.key];
                    const st = la?.status || (la ? 'draft' : null);
                    const sc = st ? STATUS_COLORS[st] : null;
                    return (
                      <div key={a.key} style={{ padding: "10px 14px", background: sc ? sc.bg : "rgba(255,255,255,0.02)", border: `1px solid ${sc ? sc.border : "rgba(255,255,255,0.04)"}`, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#ccc", marginBottom: 3 }}>{a.label}</div>
                        <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: sc ? sc.color : "#444" }}>{sc ? sc.label : "Pendente"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ════════════ STRATEGY TAB ════════════ */}
          {wsTab === "strategy" && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Strategy</h2>
              <p style={{ fontSize: 12, color: "#555", margin: "0 0 28px" }}>Oferta, DMs, meeting notes e pitch</p>

              {/* Quick status */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 28 }}>
                {[
                  { label: "Oferta", done: !!creator.offer, date: creator.offer?.generatedAt },
                  { label: "DMs", done: !!creator.dmSequence, date: creator.dmSequence?.generatedAt },
                  { label: "Pitch", done: !!creator.offer, href: creator.offer ? `/pitch?creatorId=${params?.id}` : null },
                ].map((item, i) => (
                  <div key={i} style={{ padding: "16px 18px", background: "#141414", border: `1px solid ${item.done ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)"}`, borderRadius: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5" }}>{item.label}</span>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.done ? "#22c55e" : "rgba(255,255,255,0.1)" }} />
                    </div>
                    {item.date && <div style={{ fontSize: 10, color: "#444" }}>{new Date(item.date).toLocaleDateString("pt-PT")}</div>}
                    {item.href && <a href={item.href} style={{ fontSize: 10, color: "#7A0E18", textDecoration: "none" }}>Abrir &rarr;</a>}
                  </div>
                ))}
              </div>

              {/* Offer content */}
              {creator.offer ? (
                <div style={{ padding: "20px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12, marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>Grand Slam Offer</h3>
                  <div style={{ padding: 16, background: "#0a0a0a", borderRadius: 8, fontSize: 13, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 400, overflowY: "auto" }}>
                    {renderMd(creator.offer.parsed?.offer || creator.offer.raw?.slice(0, 3000))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: "40px 20px", textAlign: "center", background: "#141414", borderRadius: 12, border: "1px solid rgba(255,255,255,0.04)" }}>
                  <p style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>Oferta ainda nao foi gerada</p>
                  <p style={{ fontSize: 11, color: "#444" }}>Vai ao perfil do creator para gerar a oferta usando o framework Hormozi</p>
                </div>
              )}

              {/* DM Sequence */}
              {creator.dmSequence && (
                <div style={{ padding: "20px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12, marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>DM Sequence</h3>
                  <div style={{ padding: 16, background: "#0a0a0a", borderRadius: 8, fontSize: 13, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 300, overflowY: "auto" }}>
                    {renderMd(creator.dmSequence.raw?.slice(0, 2000))}
                  </div>
                </div>
              )}

              {/* Meeting notes */}
              <div style={{ padding: "20px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>Meeting Notes</h3>
                {Object.entries(creator.meeting || {}).filter(([, v]) => v?.trim()).length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Object.entries(creator.meeting || {}).filter(([, v]) => v?.trim()).map(([k, v]) => (
                      <div key={k} style={{ padding: "10px 14px", background: "#0a0a0a", borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{k}</div>
                        <div style={{ fontSize: 12, color: "#ccc" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "#444", margin: 0 }}>Nenhuma nota de reuniao guardada</p>
                )}
              </div>
            </div>
          )}

          {/* ════════════ BRAND TAB ════════════ */}
          {wsTab === "brand" && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Brand System</h2>
              <p style={{ fontSize: 12, color: "#555", margin: "0 0 28px" }}>Design system do creator. Cores, fontes, logo e estilo visual para todos os assets.</p>

              {/* Color palette */}
              <div style={{ padding: "24px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12, marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 16px" }}>Cores</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { key: "primaryColor", label: "Primary", defaultVal: "#7A0E18" },
                    { key: "secondaryColor", label: "Secondary", defaultVal: "#1a1a1a" },
                    { key: "accentColor", label: "Accent", defaultVal: "#eab308" },
                  ].map(c => {
                    const val = creator.brand?.[c.key] || c.defaultVal;
                    return (
                      <div key={c.key}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{c.label}</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="color" value={val}
                            onChange={e => patchCreator({ brand: { ...creator.brand, [c.key]: e.target.value } })}
                            style={{ width: 40, height: 40, border: "2px solid rgba(255,255,255,0.06)", borderRadius: 8, cursor: "pointer", background: "transparent", padding: 0 }} />
                          <input type="text" value={val}
                            onChange={e => patchCreator({ brand: { ...creator.brand, [c.key]: e.target.value } })}
                            style={{ flex: 1, padding: "8px 10px", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, color: "#f5f5f5", fontSize: 12, fontFamily: "monospace", outline: "none" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Preview */}
                <div style={{ marginTop: 20, padding: 20, borderRadius: 10, background: creator.brand?.secondaryColor || "#1a1a1a", border: `2px solid ${creator.brand?.primaryColor || "#7A0E18"}` }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: creator.brand?.primaryColor || "#7A0E18", marginBottom: 6 }}>{creator.name}</div>
                  <div style={{ fontSize: 12, color: "#ccc", marginBottom: 12 }}>Exemplo de como as cores ficam juntas</div>
                  <button style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: creator.brand?.accentColor || "#eab308", color: "#000", fontSize: 12, fontWeight: 700, cursor: "default" }}>CTA Button</button>
                </div>
              </div>

              {/* Fonts */}
              <div style={{ padding: "24px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12, marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 16px" }}>Tipografia</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { key: "headingFont", label: "Heading Font", placeholder: "Inter, Montserrat, Playfair..." },
                    { key: "bodyFont", label: "Body Font", placeholder: "Inter, Open Sans, Lato..." },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{f.label}</label>
                      <input type="text" defaultValue={creator.brand?.[f.key] || ""}
                        placeholder={f.placeholder}
                        onBlur={e => { if (e.target.value !== (creator.brand?.[f.key] || "")) patchCreator({ brand: { ...creator.brand, [f.key]: e.target.value } }); }}
                        style={{ width: "100%", padding: "10px 12px", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, color: "#f5f5f5", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Logo URL */}
              <div style={{ padding: "24px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12, marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 16px" }}>Logo</h3>
                <label style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Logo URL</label>
                <input type="text" defaultValue={creator.brand?.logoUrl || ""}
                  placeholder="https://example.com/logo.png"
                  onBlur={e => { if (e.target.value !== (creator.brand?.logoUrl || "")) patchCreator({ brand: { ...creator.brand, logoUrl: e.target.value } }); }}
                  style={{ width: "100%", padding: "10px 12px", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, color: "#f5f5f5", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
                {creator.brand?.logoUrl && (
                  <div style={{ padding: 20, background: "#0a0a0a", borderRadius: 8, textAlign: "center" }}>
                    <img src={creator.brand.logoUrl} alt="Logo" style={{ maxHeight: 80, maxWidth: "100%", objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
                  </div>
                )}
              </div>

              {/* Brand voice */}
              <div style={{ padding: "24px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 16px" }}>Brand Voice</h3>
                <textarea defaultValue={creator.brand?.voiceNotes || ""}
                  placeholder="Tom de voz do creator. Ex: casual mas autoritario, usa humor, fala em primeira pessoa, usa gira portuguesa..."
                  onBlur={e => { if (e.target.value !== (creator.brand?.voiceNotes || "")) patchCreator({ brand: { ...creator.brand, voiceNotes: e.target.value } }); }}
                  style={{ width: "100%", minHeight: 100, padding: "12px 14px", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, color: "#f5f5f5", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </div>
            </div>
          )}

          {/* ════════════ BUILD TAB ════════════ */}
          {wsTab === "build" && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Build</h2>
              <p style={{ fontSize: 12, color: "#555", margin: "0 0 28px" }}>Todos os launch assets. Gerar, editar, aprovar.</p>

              {/* Progress bar */}
              <div style={{ marginBottom: 24, padding: "14px 18px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", display: "flex" }}>
                    <div style={{ height: 6, background: "#22c55e", width: (assetsApproved / ALL_ASSETS.length * 100) + "%", transition: "width 0.3s" }} />
                    <div style={{ height: 6, background: "#eab308", width: ((assetsDone - assetsApproved) / ALL_ASSETS.length * 100) + "%", transition: "width 0.3s" }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "#888", whiteSpace: "nowrap" }}>{assetsDone}/{ALL_ASSETS.length} gerados &middot; {assetsApproved} aprovados</span>
              </div>

              {launchError && <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 11, marginBottom: 16 }}>{launchError}</div>}

              {LAUNCH_PHASES.map(phase => (
                <div key={phase.phase} style={{ marginBottom: 28 }}>
                  <h3 style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>{phase.phase}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {phase.assets.map(asset => {
                      const saved = launchAssets[asset.key];
                      const isGenerating = launchGenerating === asset.key;
                      const isExpanded = launchExpanded === asset.key;
                      const isEditMode = launchEditing === asset.key;
                      const status = saved?.status || (saved ? 'draft' : null);
                      const sc = STATUS_COLORS[status] || {};

                      return (
                        <div key={asset.key} style={{ background: "#141414", border: `1px solid ${saved ? sc.border || "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)"}`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: saved ? "pointer" : "default" }}
                            onClick={() => saved && !isEditMode && setLaunchExpanded(isExpanded ? null : asset.key)}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5" }}>{asset.label}</span>
                                {status && <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 4, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>}
                              </div>
                              <span style={{ fontSize: 11, color: "#555", marginTop: 2, display: "block" }}>{asset.desc}</span>
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              {isGenerating && <div style={{ width: 16, height: 16, border: "2px solid #222", borderTopColor: "#7A0E18", borderRadius: "50%", animation: "sl-spin 0.8s linear infinite" }} />}
                              {!isGenerating && (
                                <button onClick={e => { e.stopPropagation(); generateLaunchAsset(asset.key); }}
                                  style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: saved ? "transparent" : "#7A0E18", color: saved ? "#888" : "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", ...(saved ? { border: "1px solid rgba(255,255,255,0.06)" } : {}) }}>
                                  {saved ? "Regenerar" : "Gerar"}
                                </button>
                              )}
                              {saved && <span style={{ fontSize: 18, color: "#444", cursor: "pointer" }}>{isExpanded ? "−" : "+"}</span>}
                            </div>
                          </div>

                          {/* Streaming */}
                          {isGenerating && launchStreamText && isExpanded && (
                            <div style={{ padding: "0 18px 18px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                              <div style={{ fontSize: 10, color: "#7A0E18", margin: "10px 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#7A0E18", animation: "sl-pulse 1.5s ease-in-out infinite" }} /> A gerar...
                              </div>
                              <div style={{ padding: 16, background: "#0a0a0a", borderRadius: 8, fontSize: 13, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 500, overflowY: "auto" }}>{renderMd(launchStreamText)}</div>
                            </div>
                          )}

                          {/* Saved content */}
                          {saved && isExpanded && !isGenerating && (
                            <div style={{ padding: "0 18px 18px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 12px" }}>
                                <span style={{ fontSize: 10, color: "#444" }}>Gerado: {new Date(saved.generatedAt).toLocaleString("pt-PT")}</span>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button onClick={() => navigator.clipboard.writeText(saved.content)} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#666", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>Copiar</button>
                                  <button onClick={() => { if (isEditMode) setLaunchEditing(null); else { setLaunchEditing(asset.key); setLaunchEditContent(saved.content); }}}
                                    style={{ padding: "4px 10px", borderRadius: 4, border: `1px solid ${isEditMode ? "rgba(122,14,24,0.3)" : "rgba(255,255,255,0.06)"}`, background: isEditMode ? "rgba(122,14,24,0.1)" : "transparent", color: isEditMode ? "#7A0E18" : "#666", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>
                                    {isEditMode ? "Cancelar" : "Editar"}
                                  </button>
                                  {['draft', 'reviewed', 'approved', 'live'].map(s => {
                                    const c = STATUS_COLORS[s];
                                    return (
                                      <button key={s} onClick={() => patchCreator({ launch: { [asset.key]: { ...saved, status: s } } })}
                                        style={{ padding: "4px 8px", borderRadius: 4, border: `1px solid ${status === s ? c.border : "rgba(255,255,255,0.04)"}`, background: status === s ? c.bg : "transparent", color: status === s ? c.color : "#444", fontSize: 8, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                        {c.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              {isEditMode ? (
                                <div>
                                  <textarea value={launchEditContent} onChange={e => setLaunchEditContent(e.target.value)}
                                    style={{ width: "100%", minHeight: 400, padding: 16, background: "#0a0a0a", border: "1px solid rgba(122,14,24,0.2)", borderRadius: 8, fontSize: 13, color: "#ccc", lineHeight: 1.7, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                                    <button onClick={() => setLaunchEditContent(saved.content)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#888", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Reset</button>
                                    <button onClick={async () => { await patchCreator({ launch: { [asset.key]: { ...saved, content: launchEditContent, editedAt: new Date().toISOString() } } }); setLaunchEditing(null); }}
                                      style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#7A0E18", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Guardar</button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ padding: 16, background: "#0a0a0a", borderRadius: 8, fontSize: 13, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 500, overflowY: "auto" }}>{renderMd(saved.content)}</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ════════════ KICKOFF TAB ════════════ */}
          {wsTab === "kickoff" && (
            <KickoffSection creator={creator} params={params} patchCreator={patchCreator} />
          )}

          {/* ════════════ ANALYTICS TAB ════════════ */}
          {wsTab === "analytics" && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Analytics</h2>
              <p style={{ fontSize: 12, color: "#555", margin: "0 0 28px" }}>Metricas de performance. Atualizar manualmente por agora — integracoes em breve.</p>

              {/* Manual metric inputs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>

                {/* Revenue */}
                <div style={{ padding: "24px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 16px" }}>Revenue</h3>
                  {[
                    { key: "mrr", label: "MRR (€)", placeholder: "0" },
                    { key: "members", label: "Membros Ativos", placeholder: "0" },
                    { key: "churnRate", label: "Churn Rate (%)", placeholder: "0" },
                    { key: "ltv", label: "LTV (€)", placeholder: "0" },
                  ].map(m => (
                    <div key={m.key} style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{m.label}</label>
                      <input type="number" defaultValue={metrics[m.key] || ""}
                        placeholder={m.placeholder}
                        onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== (metrics[m.key] || 0)) patchCreator({ metrics: { ...metrics, [m.key]: v } }); }}
                        style={{ width: "100%", padding: "10px 12px", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, color: "#f5f5f5", fontSize: 14, fontWeight: 600, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>

                {/* Acquisition */}
                <div style={{ padding: "24px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 16px" }}>Acquisition</h3>
                  {[
                    { key: "adSpend", label: "Ad Spend Mensal (€)", placeholder: "0" },
                    { key: "cpa", label: "CPA (€)", placeholder: "0" },
                    { key: "roas", label: "ROAS", placeholder: "0" },
                    { key: "pageViews", label: "Page Views / Mes", placeholder: "0" },
                    { key: "conversionRate", label: "Conversion Rate (%)", placeholder: "0" },
                  ].map(m => (
                    <div key={m.key} style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{m.label}</label>
                      <input type="number" defaultValue={metrics[m.key] || ""} step="0.1"
                        placeholder={m.placeholder}
                        onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== (metrics[m.key] || 0)) patchCreator({ metrics: { ...metrics, [m.key]: v } }); }}
                        style={{ width: "100%", padding: "10px 12px", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, color: "#f5f5f5", fontSize: 14, fontWeight: 600, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Email + Community */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ padding: "24px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 16px" }}>Email</h3>
                  {[
                    { key: "emailSubscribers", label: "Subscribers", placeholder: "0" },
                    { key: "emailOpenRate", label: "Open Rate (%)", placeholder: "0" },
                    { key: "emailClickRate", label: "Click Rate (%)", placeholder: "0" },
                  ].map(m => (
                    <div key={m.key} style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{m.label}</label>
                      <input type="number" defaultValue={metrics[m.key] || ""} step="0.1"
                        placeholder={m.placeholder}
                        onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== (metrics[m.key] || 0)) patchCreator({ metrics: { ...metrics, [m.key]: v } }); }}
                        style={{ width: "100%", padding: "10px 12px", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, color: "#f5f5f5", fontSize: 14, fontWeight: 600, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>

                <div style={{ padding: "24px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 16px" }}>Community</h3>
                  {[
                    { key: "communityMembers", label: "Membros Skool", placeholder: "0" },
                    { key: "communityPosts", label: "Posts / Semana", placeholder: "0" },
                    { key: "communityEngagement", label: "Engagement Rate (%)", placeholder: "0" },
                  ].map(m => (
                    <div key={m.key} style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{m.label}</label>
                      <input type="number" defaultValue={metrics[m.key] || ""} step="0.1"
                        placeholder={m.placeholder}
                        onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== (metrics[m.key] || 0)) patchCreator({ metrics: { ...metrics, [m.key]: v } }); }}
                        style={{ width: "100%", padding: "10px 12px", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, color: "#f5f5f5", fontSize: 14, fontWeight: 600, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Integrations setup (future) */}
              <div style={{ marginTop: 28, padding: "20px 22px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>Integracoes</h3>
                <p style={{ fontSize: 12, color: "#555", margin: "0 0 16px" }}>Conectar APIs para atualizar metricas automaticamente.</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {[
                    { name: "Stripe", status: "soon", color: "#635bff" },
                    { name: "Skool", status: "soon", color: "#22c55e" },
                    { name: "Meta Ads", status: "soon", color: "#1877f2" },
                    { name: "Resend", status: "soon", color: "#f5f5f5" },
                  ].map(i => (
                    <div key={i.name} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8, textAlign: "center", opacity: 0.5 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: i.color, marginBottom: 4 }}>{i.name}</div>
                      <span style={{ fontSize: 8, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>{i.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
