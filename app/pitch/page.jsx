"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import CreatorSelector from '../lib/CreatorSelector';

const LOGO_B64 = "data:image/png;base64,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";

/* ── helpers ── */
function extractFollowers(platformsStr, platform) {
  if (!platformsStr) return 10000;
  const lower = platformsStr.toLowerCase();
  const key = (platform || "instagram").toLowerCase();
  const re = new RegExp(key + "[:\\s]*(\\d+(?:[.,]\\d+)?)\\s*([kKmM])?", "i");
  const m = lower.match(re);
  if (m) {
    let v = parseFloat(m[1].replace(",", "."));
    if (/k/i.test(m[2] || "")) v *= 1000;
    if (/m/i.test(m[2] || "")) v *= 1000000;
    return Math.round(v);
  }
  // fallback: find any number with k/m
  const fallback = platformsStr.match(/(\d+(?:[.,]\d+)?)\s*([kKmM])/);
  if (fallback) {
    let v = parseFloat(fallback[1].replace(",", "."));
    if (/k/i.test(fallback[2])) v *= 1000;
    if (/m/i.test(fallback[2])) v *= 1000000;
    return Math.round(v);
  }
  return 10000;
}

function extractOfferDetails(parsed) {
  if (!parsed || !parsed.offer) return { corePromise: "", uniqueMechanism: "", valueStack: [] };
  const text = parsed.offer;
  let corePromise = "";
  let uniqueMechanism = "";
  const valueStack = [];

  const cpMatch = text.match(/Core Promise[:\s]*([^\n]+)/i);
  if (cpMatch) corePromise = cpMatch[1].trim();

  const umMatch = text.match(/Unique Mechanism[:\s]*([^\n]+)/i);
  if (umMatch) uniqueMechanism = umMatch[1].trim();

  // Extract value stack items (lines starting with | or - after "Value Stack" header)
  const vsMatch = text.match(/Value Stack[\s\S]*?\n((?:\s*[\-\|].+\n?)+)/i);
  if (vsMatch) {
    const lines = vsMatch[1].split("\n").filter(l => l.trim().length > 2);
    lines.slice(0, 5).forEach(l => {
      const clean = l.replace(/^[\s\-\|]+/, "").replace(/\|.*$/, "").trim();
      if (clean) valueStack.push(clean);
    });
  }
  if (valueStack.length === 0) {
    // fallback: look for numbered items
    const numbered = text.match(/(?:^|\n)\s*\d+\.\s+(.+)/gm);
    if (numbered) {
      numbered.slice(0, 5).forEach(l => {
        const clean = l.replace(/^\s*\d+\.\s+/, "").trim();
        if (clean.length > 5 && clean.length < 200) valueStack.push(clean);
      });
    }
  }

  return { corePromise, uniqueMechanism, valueStack };
}

/* ── default slides data ── */
function buildDefaultSlides(creatorName, form, parsed) {
  const followers = extractFollowers(form?.platforms, form?.primary_platform);
  const { corePromise, uniqueMechanism, valueStack } = extractOfferDetails(parsed);
  const wtp = 39;
  const activeClients = Math.round(followers * 0.00675);
  const mrr = activeClients * wtp;

  const conClients = Math.round(followers * 0.003);
  const modClients = Math.round(followers * 0.00675);
  const aggClients = Math.round(followers * 0.02);
  const conservativeMRR = conClients * wtp;
  const moderateMRR = modClients * wtp;
  const aggressiveMRR = aggClients * wtp;

  return [
    {
      id: "cover",
      title: "Cover",
      fields: {
        creatorName: creatorName || "Nome do Creator",
        subtitle: "Partnership Proposal",
      },
    },
    {
      id: "problem",
      title: "The Problem",
      fields: {
        heading: "O que est\u00e1s a deixar na mesa",
        bullets: [
          "Conte\u00fado gratuito que gera milh\u00f5es de views mas zero receita recorrente",
          "Depend\u00eancia total de brand deals que flutuam e cancelam",
          "Sem sistema escal\u00e1vel para monetizar a audi\u00eancia fiel",
          "Know-how de produto digital, mas zero infraestrutura para executar",
        ],
      },
    },
    {
      id: "audience",
      title: "Your Audience",
      fields: {
        heading: "A tua audi\u00eancia",
        platforms: form?.platforms || "Instagram 100k, YouTube 50k, TikTok 200k",
        engagement: form?.engagement || "3.5%",
        primaryPlatform: form?.primary_platform || "Instagram",
        niche: form?.niche || "Fitness",
      },
    },
    {
      id: "offer",
      title: "The Offer",
      fields: {
        heading: "O que vamos construir",
        offerName: uniqueMechanism || "Comunidade Premium + Programa de Transforma\u00e7\u00e3o",
        corePromise: corePromise || "Transformar seguidores em membros pagantes com um sistema completo de monetiza\u00e7\u00e3o",
        valueStack: valueStack.length > 0 ? valueStack : [
          "Comunidade exclusiva com conte\u00fado premium",
          "Programa de 8 semanas com acompanhamento",
          "Lives semanais Q&A com o creator",
          "Templates e recursos exclusivos",
          "Acesso a rede de networking premium",
        ],
      },
    },
    {
      id: "revenue",
      title: "The Opportunity",
      fields: {
        heading: "O potencial de receita",
        heroMRR: "\u20AC" + moderateMRR.toLocaleString("pt-PT"),
        heroLabel: "/mes",
        followers: followers.toLocaleString("pt-PT"),
        conClients: conClients.toLocaleString("pt-PT"),
        conPct: followers > 0 ? ((conClients / followers) * 100).toFixed(2) + "%" : "0.30%",
        conMonthly: "\u20AC" + conservativeMRR.toLocaleString("pt-PT"),
        conYear: "\u20AC" + (conservativeMRR * 12).toLocaleString("pt-PT"),
        conLtv: "\u20AC" + (wtp > 0 ? Math.round(wtp / 0.10) : 0).toLocaleString("pt-PT"),
        modClients: modClients.toLocaleString("pt-PT"),
        modPct: followers > 0 ? ((modClients / followers) * 100).toFixed(2) + "%" : "0.67%",
        modMonthly: "\u20AC" + moderateMRR.toLocaleString("pt-PT"),
        modYear: "\u20AC" + (moderateMRR * 12).toLocaleString("pt-PT"),
        modLtv: "\u20AC" + (wtp > 0 ? Math.round(wtp / 0.08) : 0).toLocaleString("pt-PT"),
        aggClients: aggClients.toLocaleString("pt-PT"),
        aggPct: followers > 0 ? ((aggClients / followers) * 100).toFixed(2) + "%" : "2.00%",
        aggMonthly: "\u20AC" + aggressiveMRR.toLocaleString("pt-PT"),
        aggYear: "\u20AC" + (aggressiveMRR * 12).toLocaleString("pt-PT"),
        aggLtv: "\u20AC" + (wtp > 0 ? Math.round(wtp / 0.06) : 0).toLocaleString("pt-PT"),
        note: "Baseado em benchmarks reais do mercado",
      },
    },
    {
      id: "deliverables",
      title: "What We Build",
      fields: {
        heading: "O que a Second Layer constr\u00f3i",
        items: [
          "Plataforma de comunidade (Skool ou equivalente)",
          "P\u00e1gina de vendas",
          "Funil de convers\u00e3o completo",
          "Sequ\u00eancias de email automatizadas",
          "Gest\u00e3o de an\u00fancios pagos",
          "Assets de marketing e conte\u00fado",
          "Suporte e opera\u00e7\u00f5es cont\u00ednuas",
        ],
      },
    },
    {
      id: "timeline",
      title: "How It Works",
      fields: {
        heading: "Como funciona",
        weeks: [
          { week: "Semana 1-2", task: "Estrat\u00e9gia, branding e setup da plataforma" },
          { week: "Semana 3-4", task: "P\u00e1gina de vendas, funil e sequ\u00eancias de email" },
          { week: "Semana 5", task: "Conte\u00fado de lan\u00e7amento e prepara\u00e7\u00e3o" },
          { week: "Semana 6", task: "Lan\u00e7amento oficial" },
        ],
        youDo: [
          "Aprova\u00e7\u00f5es",
          "2h/semana de envolvimento",
          "Presen\u00e7a em lives",
        ],
        weDo: [
          "Literalmente tudo o resto",
        ],
      },
    },
    {
      id: "investment",
      title: "The Investment",
      fields: {
        heading: "Investimento",
        setupFee: "\u20AC6,000",
        setupLabel: "Setup fee (one-time)",
        commission: "30% da receita",
        includes: [
          "Plataforma completa",
          "P\u00e1gina de vendas",
          "Funil + emails",
          "Gest\u00e3o de ads",
          "Suporte cont\u00ednuo",
        ],
        alignment: "O nosso sucesso est\u00e1 diretamente ligado ao teu",
      },
    },
    {
      id: "nextsteps",
      title: "Next Steps",
      fields: {
        heading: "Pr\u00f3ximos passos",
        steps: [
          { num: "1", text: "Alinhamento final" },
          { num: "2", text: "Assinatura do contrato" },
          { num: "3", text: "In\u00edcio do setup" },
        ],
        contact: "Tomas -- Second Layer / secondlayerhq.com",
      },
    },
  ];
}

/* ── styles ── */
const colors = {
  bg: "#0a0a0a",
  card: "#141414",
  border: "rgba(255,255,255,0.04)",
  primary: "#f5f5f5",
  secondary: "#888",
  muted: "#555",
  accent: "#7A0E18",
};

const slideCardStyle = {
  background: colors.card,
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  padding: 0,
  overflow: "hidden",
  marginBottom: 32,
};

const slideInnerStyle = {
  background: colors.bg,
  margin: 16,
  borderRadius: 12,
  padding: "40px 48px",
  minHeight: 320,
  position: "relative",
};

const editableStyle = {
  outline: "none",
  border: "1px solid transparent",
  borderRadius: 4,
  padding: "2px 6px",
  margin: "-2px -6px",
  transition: "border-color 0.2s, background 0.2s",
  cursor: "text",
  color: "inherit",
  font: "inherit",
  display: "inline-block",
};

const editableFocusCSS = `
  [contenteditable]:focus {
    border-color: rgba(122,14,24,0.4) !important;
    background: rgba(122,14,24,0.06) !important;
  }
  [contenteditable]:hover {
    border-color: rgba(255,255,255,0.08) !important;
  }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  * { font-family: 'Inter', sans-serif; }
  body { background: ${colors.bg}; margin: 0; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #222; border-radius: 3px; }
`;

/* ── Editable component ── */
function Editable({ value, onChange, style, tag }) {
  const ref = useRef(null);
  const Tag = tag || "span";

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value;
    }
  }, [value]);

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.innerText)}
      style={{ ...editableStyle, ...style }}
    />
  );
}

/* ── Slide renderers ── */
function SlideCover({ fields, onChange }) {
  return (
    <div style={{ ...slideInnerStyle, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <img src={LOGO_B64} alt="Second Layer" style={{ height: 36, marginBottom: 48, opacity: 0.9 }} />
      <Editable
        value={fields.creatorName}
        onChange={(v) => onChange("creatorName", v)}
        style={{ fontSize: 48, fontWeight: 800, color: colors.primary, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 16, width: "100%" }}
        tag="div"
      />
      <Editable
        value={fields.subtitle}
        onChange={(v) => onChange("subtitle", v)}
        style={{ fontSize: 20, fontWeight: 400, color: colors.secondary, letterSpacing: "0.02em" }}
        tag="div"
      />
      <div style={{ marginTop: 48, width: 60, height: 3, background: colors.accent, borderRadius: 2 }} />
    </div>
  );
}

function SlideProblem({ fields, onChange }) {
  return (
    <div style={slideInnerStyle}>
      <Editable value={fields.heading} onChange={(v) => onChange("heading", v)} style={{ fontSize: 28, fontWeight: 700, color: colors.primary, display: "block", marginBottom: 32 }} tag="div" />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {fields.bullets.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.accent, marginTop: 7, flexShrink: 0 }} />
            <Editable
              value={b}
              onChange={(v) => {
                const updated = [...fields.bullets];
                updated[i] = v;
                onChange("bullets", updated);
              }}
              style={{ fontSize: 16, color: colors.secondary, lineHeight: 1.6 }}
              tag="div"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideAudience({ fields, onChange }) {
  const metricStyle = { background: "rgba(122,14,24,0.08)", borderRadius: 12, padding: "20px 24px", flex: 1, textAlign: "center" };
  const labelStyle = { fontSize: 10, fontWeight: 600, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 };
  const valStyle = { fontSize: 20, fontWeight: 600, color: colors.primary };

  return (
    <div style={slideInnerStyle}>
      <Editable value={fields.heading} onChange={(v) => onChange("heading", v)} style={{ fontSize: 28, fontWeight: 700, color: colors.primary, display: "block", marginBottom: 32 }} tag="div" />
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div style={metricStyle}>
          <div style={labelStyle}>Plataforma principal</div>
          <Editable value={fields.primaryPlatform} onChange={(v) => onChange("primaryPlatform", v)} style={valStyle} tag="div" />
        </div>
        <div style={metricStyle}>
          <div style={labelStyle}>Engagement</div>
          <Editable value={fields.engagement} onChange={(v) => onChange("engagement", v)} style={valStyle} tag="div" />
        </div>
        <div style={metricStyle}>
          <div style={labelStyle}>Nicho</div>
          <Editable value={fields.niche} onChange={(v) => onChange("niche", v)} style={valStyle} tag="div" />
        </div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: "20px 24px" }}>
        <div style={labelStyle}>Plataformas &amp; Seguidores</div>
        <Editable value={fields.platforms} onChange={(v) => onChange("platforms", v)} style={{ fontSize: 16, color: colors.primary, lineHeight: 1.8 }} tag="div" />
      </div>
    </div>
  );
}

function SlideOffer({ fields, onChange }) {
  return (
    <div style={slideInnerStyle}>
      <Editable value={fields.heading} onChange={(v) => onChange("heading", v)} style={{ fontSize: 28, fontWeight: 700, color: colors.primary, display: "block", marginBottom: 12 }} tag="div" />
      <Editable value={fields.offerName} onChange={(v) => onChange("offerName", v)} style={{ fontSize: 22, fontWeight: 600, color: colors.accent, display: "block", marginBottom: 8 }} tag="div" />
      <Editable value={fields.corePromise} onChange={(v) => onChange("corePromise", v)} style={{ fontSize: 14, color: colors.secondary, display: "block", marginBottom: 28, lineHeight: 1.6 }} tag="div" />
      <div style={{ fontSize: 10, fontWeight: 600, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Value Stack</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {fields.valueStack.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(122,14,24,0.06)", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: colors.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
            <Editable
              value={item}
              onChange={(v) => {
                const updated = [...fields.valueStack];
                updated[i] = v;
                onChange("valueStack", updated);
              }}
              style={{ fontSize: 14, color: colors.primary }}
              tag="div"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideRevenue({ fields, onChange }) {
  const row = (label, value, key, bold) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <span style={{ fontSize: 12, color: colors.muted }}>{label}</span>
      <Editable value={value} onChange={(v) => onChange(key, v)} style={{ fontSize: 13, fontWeight: bold ? 600 : 400, color: bold ? colors.primary : colors.secondary }} />
    </div>
  );

  return (
    <div style={slideInnerStyle}>
      <Editable value={fields.heading} onChange={(v) => onChange("heading", v)} style={{ fontSize: 28, fontWeight: 700, color: colors.primary, display: "block", marginBottom: 28 }} tag="div" />
      {/* Hero MRR */}
      <div style={{ textAlign: "center", marginBottom: 28, padding: "28px 0", background: "rgba(122,14,24,0.06)", borderRadius: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: colors.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Receita Mensal Estimada</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center" }}>
          <Editable value={fields.heroMRR} onChange={(v) => onChange("heroMRR", v)} style={{ fontSize: 44, fontWeight: 300, color: colors.accent, letterSpacing: "-0.02em" }} />
          <span style={{ fontSize: 16, color: colors.muted, marginLeft: 4 }}>/mes</span>
        </div>
        <div style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>
          <Editable value={fields.modClients} onChange={(v) => onChange("modClients", v)} style={{ color: colors.secondary, fontSize: 12 }} /> clientes ativos &middot; <Editable value={fields.followers} onChange={(v) => onChange("followers", v)} style={{ color: colors.secondary, fontSize: 12 }} /> seguidores
        </div>
      </div>
      {/* 3 scenario cards */}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { label: "Conservador", prefix: "con", color: colors.muted, border: "transparent" },
          { label: "Moderado", prefix: "mod", color: colors.accent, border: colors.accent + "33" },
          { label: "Agressivo", prefix: "agg", color: colors.accent, border: "transparent" },
        ].map((s) => (
          <div key={s.prefix} style={{ flex: 1, background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "16px 18px", border: `1px solid ${s.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>{s.label}</div>
            {row("Active clients", fields[s.prefix + "Clients"], s.prefix + "Clients", true)}
            {row("% of followers", fields[s.prefix + "Pct"], s.prefix + "Pct", false)}
            <div style={{ height: 8 }} />
            {row("Monthly", fields[s.prefix + "Monthly"], s.prefix + "Monthly", true)}
            {row("Year 1", fields[s.prefix + "Year"], s.prefix + "Year", true)}
            {row("LTV/client", fields[s.prefix + "Ltv"], s.prefix + "Ltv", false)}
          </div>
        ))}
      </div>
      <Editable value={fields.note} onChange={(v) => onChange("note", v)} style={{ fontSize: 11, color: colors.muted, display: "block", textAlign: "center", marginTop: 16, fontStyle: "italic" }} tag="div" />
    </div>
  );
}

function SlideDeliverables({ fields, onChange }) {
  return (
    <div style={slideInnerStyle}>
      <Editable value={fields.heading} onChange={(v) => onChange("heading", v)} style={{ fontSize: 28, fontWeight: 700, color: colors.primary, display: "block", marginBottom: 28 }} tag="div" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {fields.items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ color: colors.accent, fontSize: 16, flexShrink: 0 }}>&#10003;</div>
            <Editable
              value={item}
              onChange={(v) => {
                const updated = [...fields.items];
                updated[i] = v;
                onChange("items", updated);
              }}
              style={{ fontSize: 14, color: colors.primary }}
              tag="div"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideTimeline({ fields, onChange }) {
  return (
    <div style={slideInnerStyle}>
      <Editable value={fields.heading} onChange={(v) => onChange("heading", v)} style={{ fontSize: 28, fontWeight: 700, color: colors.primary, display: "block", marginBottom: 28 }} tag="div" />
      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        {fields.weeks.map((w, i) => (
          <div key={i} style={{ flex: 1, background: "rgba(122,14,24,0.06)", borderRadius: 10, padding: "16px 18px", borderLeft: `3px solid ${colors.accent}` }}>
            <Editable value={w.week} onChange={(v) => {
              const updated = [...fields.weeks];
              updated[i] = { ...updated[i], week: v };
              onChange("weeks", updated);
            }} style={{ fontSize: 12, fontWeight: 700, color: colors.accent, display: "block", marginBottom: 6 }} tag="div" />
            <Editable value={w.task} onChange={(v) => {
              const updated = [...fields.weeks];
              updated[i] = { ...updated[i], task: v };
              onChange("weeks", updated);
            }} style={{ fontSize: 13, color: colors.secondary, lineHeight: 1.5 }} tag="div" />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Tu fazes</div>
          {fields.youDo.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: colors.secondary, flexShrink: 0 }} />
              <Editable value={item} onChange={(v) => {
                const updated = [...fields.youDo];
                updated[i] = v;
                onChange("youDo", updated);
              }} style={{ fontSize: 14, color: colors.secondary }} tag="div" />
            </div>
          ))}
        </div>
        <div style={{ flex: 1, background: "rgba(122,14,24,0.06)", borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: colors.accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Nos fazemos</div>
          {fields.weDo.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: colors.accent, flexShrink: 0 }} />
              <Editable value={item} onChange={(v) => {
                const updated = [...fields.weDo];
                updated[i] = v;
                onChange("weDo", updated);
              }} style={{ fontSize: 14, color: colors.primary, fontWeight: 600 }} tag="div" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlideInvestment({ fields, onChange }) {
  return (
    <div style={slideInnerStyle}>
      <Editable value={fields.heading} onChange={(v) => onChange("heading", v)} style={{ fontSize: 28, fontWeight: 700, color: colors.primary, display: "block", marginBottom: 32 }} tag="div" />
      <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
        <div style={{ flex: 1, background: "rgba(122,14,24,0.08)", borderRadius: 12, padding: "28px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Setup Fee (one-time)</div>
          <Editable value={fields.setupFee} onChange={(v) => onChange("setupFee", v)} style={{ fontSize: 36, fontWeight: 700, color: colors.accent }} tag="div" />
        </div>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "28px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Commission</div>
          <Editable value={fields.commission} onChange={(v) => onChange("commission", v)} style={{ fontSize: 36, fontWeight: 700, color: colors.primary }} tag="div" />
        </div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Incluido no setup</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
        {fields.includes.map((item, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 16px" }}>
            <Editable value={item} onChange={(v) => {
              const updated = [...fields.includes];
              updated[i] = v;
              onChange("includes", updated);
            }} style={{ fontSize: 13, color: colors.secondary }} tag="span" />
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", padding: "20px 0", borderTop: `1px solid ${colors.border}` }}>
        <Editable value={fields.alignment} onChange={(v) => onChange("alignment", v)} style={{ fontSize: 16, color: colors.secondary, fontStyle: "italic" }} tag="div" />
      </div>
    </div>
  );
}

function SlideNextSteps({ fields, onChange }) {
  return (
    <div style={{ ...slideInnerStyle, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <Editable value={fields.heading} onChange={(v) => onChange("heading", v)} style={{ fontSize: 28, fontWeight: 700, color: colors.primary, display: "block", marginBottom: 40 }} tag="div" />
      <div style={{ display: "flex", gap: 24, marginBottom: 48 }}>
        {fields.steps.map((s, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, minWidth: 160 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: colors.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>{s.num}</div>
            <Editable value={s.text} onChange={(v) => {
              const updated = [...fields.steps];
              updated[i] = { ...updated[i], text: v };
              onChange("steps", updated);
            }} style={{ fontSize: 15, color: colors.primary, fontWeight: 500 }} tag="div" />
          </div>
        ))}
      </div>
      <Editable value={fields.contact} onChange={(v) => onChange("contact", v)} style={{ fontSize: 14, color: colors.secondary, marginBottom: 32 }} tag="div" />
      <img src={LOGO_B64} alt="Second Layer" style={{ height: 28, opacity: 0.5 }} />
    </div>
  );
}

const SLIDE_RENDERERS = {
  cover: SlideCover,
  problem: SlideProblem,
  audience: SlideAudience,
  offer: SlideOffer,
  revenue: SlideRevenue,
  deliverables: SlideDeliverables,
  timeline: SlideTimeline,
  investment: SlideInvestment,
  nextsteps: SlideNextSteps,
};

/* ── Export functions ── */
async function exportPptx(slides) {
  const res = await fetch("/api/export-pptx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slides }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Export failed" }));
    throw new Error(err.error || "Export failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Second_Layer_Pitch_${slides[0]?.fields?.creatorName || "Creator"}.pptx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportPdf() {
  window.print();
}

/* ── Main component ── */
export default function PitchPage() {
  const [creatorName, setCreatorName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState(buildDefaultSlides());
  const [exporting, setExporting] = useState(null);

  const formatPlatforms = (platforms) => {
    const parts = [];
    if (platforms?.instagram?.followers) parts.push(`Instagram ${platforms.instagram.followers.toLocaleString()}`);
    if (platforms?.tiktok?.followers) parts.push(`TikTok ${platforms.tiktok.followers.toLocaleString()}`);
    if (platforms?.youtube?.subscribers) parts.push(`YouTube ${platforms.youtube.subscribers.toLocaleString()}`);
    return parts.join(", ");
  };

  // Auto-load creator from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const creatorId = params.get("creatorId");
    if (!creatorId) { setLoading(false); return; }

    fetch(`/api/creators/${creatorId}`)
      .then(r => r.ok ? r.json() : null)
      .then(creator => {
        if (!creator) { setLoading(false); return; }
        setCreatorName(creator.name);
        const form = {
          creator_name: creator.name,
          niche: creator.niche || "",
          platforms: formatPlatforms(creator.platforms),
          engagement: creator.engagement || "",
          primary_platform: creator.primaryPlatform || "Instagram",
        };
        // Use saved offer if available
        const offer = creator.offer;
        if (offer) {
          setSlides(buildDefaultSlides(creator.name, form, offer.parsed || {}));
        } else {
          setSlides(buildDefaultSlides(creator.name, form, {}));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const updateSlideField = useCallback((slideIdx, fieldKey, value) => {
    setSlides((prev) => {
      const updated = [...prev];
      updated[slideIdx] = {
        ...updated[slideIdx],
        fields: { ...updated[slideIdx].fields, [fieldKey]: value },
      };
      return updated;
    });
  }, []);

  const handleExportPptx = async () => {
    setExporting("pptx");
    try { await exportPptx(slides); } catch (e) { console.error(e); alert("Export failed: " + e.message); }
    finally { setExporting(null); }
  };

  const handleExportPdf = async () => {
    setExporting("pdf");
    try { await exportPdf(); } catch (e) { console.error(e); alert("Export failed: " + e.message); }
    finally { setExporting(null); }
  };

  const selectStyle = {
    background: "#141414",
    color: colors.primary,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
    outline: "none",
    cursor: "pointer",
    minWidth: 280,
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 36,
  };

  const btnBase = {
    padding: "12px 28px",
    borderRadius: 8,
    border: "none",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "Inter, sans-serif",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    transition: "opacity 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.primary, fontFamily: "Inter, sans-serif" }}>
      <style>{editableFocusCSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src={LOGO_B64} alt="Second Layer" style={{ height: 24 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: colors.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>| CREATOR PITCH</span>
        </div>
        <a href="/" style={{ fontSize: 13, color: colors.secondary, textDecoration: "none", fontWeight: 500, transition: "color 0.2s" }}
          onMouseEnter={(e) => (e.target.style.color = colors.primary)}
          onMouseLeave={(e) => (e.target.style.color = colors.secondary)}
        >
          Back to HQ
        </a>
      </div>

      <div style={{ padding: "32px 32px 0", maxWidth: 900, margin: "0 auto" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40, fontSize: 13, color: colors.secondary }}>A carregar dados do creator...</div>
        )}

        {/* Slides */}
        <div style={{ paddingBottom: 120 }}>
          {slides.map((sl, idx) => {
            const Renderer = SLIDE_RENDERERS[sl.id];
            if (!Renderer) return null;
            return (
              <div key={sl.id} style={slideCardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${colors.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: colors.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{idx + 1}</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.secondary, letterSpacing: "0.04em" }}>{sl.title}</span>
                  </div>
                  <span style={{ fontSize: 10, color: colors.muted }}>16:9</span>
                </div>
                <Renderer
                  fields={sl.fields}
                  onChange={(fieldKey, value) => updateSlideField(idx, fieldKey, value)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom export bar */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(12px)",
        borderTop: `1px solid ${colors.border}`,
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        zIndex: 100,
      }}>
        <button
          onClick={handleExportPptx}
          disabled={exporting === "pptx"}
          style={{
            ...btnBase,
            background: colors.accent,
            color: "#fff",
            opacity: exporting === "pptx" ? 0.6 : 1,
          }}
        >
          {exporting === "pptx" ? "Exporting..." : "Export .pptx"}
        </button>
        <button
          onClick={handleExportPdf}
          disabled={exporting === "pdf"}
          style={{
            ...btnBase,
            background: "rgba(255,255,255,0.06)",
            color: colors.primary,
            border: `1px solid ${colors.border}`,
            opacity: exporting === "pdf" ? 0.6 : 1,
          }}
        >
          {exporting === "pdf" ? "Exporting..." : "Export PDF"}
        </button>
      </div>
    </div>
  );
}
