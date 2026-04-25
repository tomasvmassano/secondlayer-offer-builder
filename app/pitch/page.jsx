"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SCENARIOS as SHARED_SCENARIOS, projectGrowth as sharedProjectGrowth, cumulativeRevenue as sharedCumulative, calculateSteadyMRR } from "../lib/revenue";

// ─────────────────────────────────────────────────────────────────
// PITCH DECK — 10 slides + optional slide 11 (Investimento)
// Dream-led structure. Pure SVG growth chart (PDF-crisp).
// ─────────────────────────────────────────────────────────────────

const NICHE_PRICING = {
  imobiliario: { low: 49, mid: 97, high: 297 },
  investimento: { low: 49, mid: 97, high: 297 },
  fitness: { low: 19, mid: 39, high: 79 },
  empreendedorismo: { low: 49, mid: 97, high: 247 },
  business: { low: 49, mid: 97, high: 247 },
  nutricao: { low: 19, mid: 37, high: 69 },
  dietetica: { low: 19, mid: 37, high: 69 },
  financas: { low: 29, mid: 59, high: 149 },
  educacao: { low: 19, mid: 39, high: 97 },
  desenvolvimento: { low: 19, mid: 39, high: 97 },
  culinaria: { low: 9, mid: 24, high: 49 },
  gastronomia: { low: 9, mid: 24, high: 49 },
};

const NICHE_ALIASES = {
  'real estate': 'imobiliario', property: 'imobiliario',
  investing: 'investimento', investment: 'investimento',
  gym: 'fitness', workout: 'fitness', training: 'fitness', coaching: 'fitness',
  entrepreneur: 'empreendedorismo', entrepreneurship: 'empreendedorismo', startup: 'empreendedorismo',
  marketing: 'business', 'creator economy': 'business',
  nutrition: 'nutricao', diet: 'dietetica', 'healthy eating': 'nutricao',
  finance: 'financas', 'personal finance': 'financas', money: 'financas',
  education: 'educacao', teaching: 'educacao', learning: 'educacao',
  'personal development': 'desenvolvimento', mindset: 'desenvolvimento',
  food: 'culinaria', cooking: 'culinaria', baking: 'culinaria', culinary: 'culinaria',
};

function detectNichePricing(nicheString) {
  if (!nicheString) return NICHE_PRICING.fitness;
  const lower = nicheString.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const key of Object.keys(NICHE_PRICING)) {
    if (lower.includes(key)) return NICHE_PRICING[key];
  }
  for (const [alias, key] of Object.entries(NICHE_ALIASES)) {
    if (lower.includes(alias)) return NICHE_PRICING[key];
  }
  return NICHE_PRICING.fitness;
}

// ─────────────────────────────────────────────────────────────────
// GROWTH MATH — uses /app/lib/revenue.js as single source of truth.
// Local DEFAULT_SCENARIOS just adapts the shared SCENARIOS shape for
// the existing UI (tracks activeShare + churn so users can tweak live).
// ─────────────────────────────────────────────────────────────────

// Mirror of the shared scenarios — used as initial state so the user can
// tweak per-pitch (audience/price/engagement saved back to creator record).
const DEFAULT_SCENARIOS = {
  conservador: { ...SHARED_SCENARIOS.conservador },
  moderado:    { ...SHARED_SCENARIOS.moderado },
  agressivo:   { ...SHARED_SCENARIOS.agressivo },
};

// Local wrappers — keep the existing call sites unchanged
function projectGrowth(opts) {
  return sharedProjectGrowth(opts);
}
function cumulativeRevenue(months) {
  return sharedCumulative(months);
}

function formatEuro(n) {
  if (!n && n !== 0) return "€0";
  return "€" + Math.round(n).toLocaleString("pt-PT");
}

function formatFollowers(n) {
  if (!n && n !== 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function firstName(fullName) {
  if (!fullName) return "";
  return fullName.split(/\s+/)[0];
}

// ─────────────────────────────────────────────────────────────────
// SVG GROWTH CHART — pure vector, crisp in PDF
// ─────────────────────────────────────────────────────────────────

function GrowthChart({ scenarios, height = 320 }) {
  const width = 720;
  const padding = { top: 28, right: 30, bottom: 46, left: 78 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allMRR = Object.values(scenarios).flatMap(s => s.months.map(m => m.mrr));
  const maxMRR = Math.max(...allMRR, 1);
  const niceMax = Math.ceil(maxMRR / 1000) * 1000 || 1000;

  const xScale = (month) => padding.left + ((month - 1) / 11) * chartWidth;
  const yScale = (mrr) => padding.top + chartHeight - (mrr / niceMax) * chartHeight;

  const buildPath = (months) =>
    months.map((m, i) =>
      `${i === 0 ? 'M' : 'L'} ${xScale(m.month).toFixed(1)} ${yScale(m.mrr).toFixed(1)}`
    ).join(' ');

  const yTicks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", maxWidth: width, display: "block", margin: "0 auto" }}
      preserveAspectRatio="xMidYMid meet"
    >
      {yTicks.map((v, i) => (
        <g key={`y-${i}`}>
          <line
            x1={padding.left} y1={yScale(v)}
            x2={padding.left + chartWidth} y2={yScale(v)}
            stroke="rgba(255,255,255,0.06)" strokeWidth="1"
          />
          <text
            x={padding.left - 10} y={yScale(v) + 4}
            fill="#666" fontSize="11" textAnchor="end"
            fontFamily="Inter, sans-serif"
          >
            €{v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "K" : v}
          </text>
        </g>
      ))}

      {[1, 3, 6, 9, 12].map(m => (
        <text key={`x-${m}`}
          x={xScale(m)} y={padding.top + chartHeight + 22}
          fill="#666" fontSize="11" textAnchor="middle"
          fontFamily="Inter, sans-serif"
        >
          Mês {m}
        </text>
      ))}

      <line
        x1={padding.left} y1={padding.top + chartHeight}
        x2={padding.left + chartWidth} y2={padding.top + chartHeight}
        stroke="rgba(255,255,255,0.15)" strokeWidth="1"
      />
      <line
        x1={padding.left} y1={padding.top}
        x2={padding.left} y2={padding.top + chartHeight}
        stroke="rgba(255,255,255,0.15)" strokeWidth="1"
      />

      {['conservador', 'agressivo', 'moderado'].map(key => {
        const s = scenarios[key];
        if (!s) return null;
        return (
          <g key={key}>
            <path
              d={buildPath(s.months)}
              fill="none"
              stroke={s.color}
              strokeWidth={key === 'moderado' ? 3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={key === 'moderado' ? 1 : 0.55}
            />
            <circle
              cx={xScale(12)}
              cy={yScale(s.months[11].mrr)}
              r={key === 'moderado' ? 5 : 3}
              fill={s.color}
            />
          </g>
        );
      })}

      <g transform={`translate(${padding.left + 14}, ${padding.top + 10})`}>
        {['agressivo', 'moderado', 'conservador'].map((key, idx) => {
          const s = scenarios[key];
          if (!s) return null;
          return (
            <g key={key} transform={`translate(0, ${idx * 18})`}>
              <line x1="0" y1="0" x2="18" y2="0" stroke={s.color} strokeWidth={key === 'moderado' ? 3 : 2} />
              <text x="24" y="4" fill="#aaa" fontSize="11" fontFamily="Inter, sans-serif">{s.label}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// FONT MIXING — Instrument Serif italic for emphasis,
// Helvetica Neue for body. Editorial mix used by secondlayerhq.com.
// ─────────────────────────────────────────────────────────────────

const italicSerif = {
  fontFamily: "'Instrument Serif', Georgia, serif",
  fontStyle: "italic",
  fontWeight: 400,
  // Slight letter-spacing tightening; Instrument Serif italic looks better tight.
  letterSpacing: "-0.01em",
};

/**
 * Render text with the LAST WORD wrapped in Instrument Serif italic.
 * Used for headlines like "Construímos isto juntos?" → italicizes "juntos?".
 */
function StyledLastWord({ text, italicStyle, ...rest }) {
  const safe = (text || "").trim();
  if (!safe) return null;
  const lastSpace = safe.lastIndexOf(" ");
  if (lastSpace < 0) {
    return <span style={{ ...italicSerif, ...italicStyle }} {...rest}>{safe}</span>;
  }
  const head = safe.slice(0, lastSpace);
  const tail = safe.slice(lastSpace + 1);
  return (
    <>
      {head + " "}
      <span style={{ ...italicSerif, ...italicStyle }} {...rest}>{tail}</span>
    </>
  );
}

/**
 * Wrap a specific keyword inside text with Instrument Serif italic.
 * Case-insensitive, matches first occurrence only.
 */
function StyledKeyword({ text, keyword, italicStyle }) {
  if (!text || !keyword) return text;
  const lowerText = text.toLowerCase();
  const idx = lowerText.indexOf(keyword.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ ...italicSerif, ...italicStyle }}>{text.slice(idx, idx + keyword.length)}</span>
      {text.slice(idx + keyword.length)}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// INLINE EDITABLE FIELD
// ─────────────────────────────────────────────────────────────────

function Editable({ value, onChange, style, multiline = false }) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent)}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      style={{
        outline: "none",
        display: "inline-block",
        minHeight: "1em",
        padding: "2px 4px",
        borderRadius: 4,
        cursor: "text",
        ...style,
      }}
    >
      {value}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN CONTENT
// ─────────────────────────────────────────────────────────────────

function PitchPageContent() {
  const searchParams = useSearchParams();
  const creatorId = searchParams.get('creatorId');

  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvestimento, setShowInvestimento] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [audience, setAudience] = useState(100000);
  const [price, setPrice] = useState(39);
  const [engagement, setEngagement] = useState(2.0);
  const [scenarios, setScenarios] = useState(DEFAULT_SCENARIOS);
  const [slides, setSlides] = useState(null);
  const [translatedAudience, setTranslatedAudience] = useState(null);
  const [translatingAudience, setTranslatingAudience] = useState(false);

  useEffect(() => {
    if (!creatorId) {
      setSlides(buildDefaultSlides({ name: 'Creator', niche: '' }));
      setLoading(false);
      return;
    }

    fetch(`/api/creators/${creatorId}`)
      .then(r => r.json())
      .then(data => {
        setCreator(data);
        const ig = data.platforms?.instagram?.followers || 0;
        const tk = data.platforms?.tiktok?.followers || 0;
        const yt = data.platforms?.youtube?.subscribers || 0;
        // Revenue baseline — read from creator if saved, else fall back to scrape/nicho defaults.
        // This is the single source of truth shared with the Creator page Revenue Projector.
        const scrapedAudience = ig || tk || yt || 100000;
        const nicheDefault = detectNichePricing(data.niche).mid;
        const rawEng = data.engagement || data.platforms?.instagram?.engagementRate || "";
        const scrapedEng = parseFloat(String(rawEng).replace(/[^0-9.]/g, "")) || 2.0;
        setAudience(data.revenueAudience ?? scrapedAudience);
        setPrice(data.revenuePrice ?? nicheDefault);
        setEngagement(data.revenueEngagement ?? scrapedEng);
        setSlides(buildDefaultSlides(data));
      })
      .catch(() => setSlides(buildDefaultSlides({ name: 'Creator', niche: '' })))
      .finally(() => setLoading(false));
  }, [creatorId]);

  // Debounced PATCH to creator when user edits any revenue input.
  // Saves to creator.revenueAudience / revenuePrice / revenueEngagement so the
  // Creator page Revenue Projector reads the SAME numbers on next load.
  useEffect(() => {
    if (!creatorId || loading) return;
    const handle = setTimeout(() => {
      fetch(`/api/creators/${creatorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revenueAudience: audience,
          revenuePrice: price,
          revenueEngagement: engagement,
        }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(handle);
  }, [creatorId, loading, audience, price, engagement]);

  // Translate audience block to creator's primary language if needed.
  // Calls /api/translate-audience and caches the result.
  useEffect(() => {
    if (!creator?.audienceEstimate || !creator?.primaryLanguage) return;
    const targetLang = creator.primaryLanguage;
    const audienceData = creator.audienceEstimate;

    // Quick heuristic: detect if data looks like target language already.
    // Sample text to check
    const sample = [audienceData.gender, audienceData.location, audienceData.language]
      .filter(Boolean).join(' ').toLowerCase();
    const isPT = /\b(feminino|masculino|portuguesa?|espanhola?|outros?|países|portugues|português)\b/.test(sample);
    const isEN = /\b(female|male|portuguese|spanish|other|countries|english)\b/.test(sample);

    const needsTranslation =
      (targetLang === 'pt' && isEN && !isPT) ||
      (targetLang === 'en' && isPT && !isEN);

    if (!needsTranslation) {
      setTranslatedAudience(audienceData);
      return;
    }

    setTranslatingAudience(true);
    fetch('/api/translate-audience', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audience: audienceData, targetLanguage: targetLang }),
    })
      .then(r => r.json())
      .then(data => {
        if (data?.audience) {
          setTranslatedAudience(data.audience);
          // Persist back to the creator record so we don't re-translate next time
          fetch(`/api/creators/${creatorId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audienceEstimate: data.audience }),
          }).catch(() => {});
        } else {
          setTranslatedAudience(audienceData);
        }
      })
      .catch(() => setTranslatedAudience(audienceData))
      .finally(() => setTranslatingAudience(false));
  }, [creator, creatorId]);

  const projections = useMemo(() => {
    const result = {};
    for (const [key, s] of Object.entries(scenarios)) {
      const months = projectGrowth({
        audience, price, engagementRate: engagement, scenario: s,
      });
      result[key] = { ...s, months };
    }
    return result;
  }, [audience, price, engagement, scenarios]);

  // STEADY-STATE MRR — same Hormozi formula as the Creator page Revenue Projector.
  // Both pages now produce IDENTICAL numbers when given the same inputs
  // (audience + price + engagement saved to creator record).
  const moderateSteady = useMemo(
    () => calculateSteadyMRR({ audience, price, engagementRate: engagement, scenario: scenarios.moderado }),
    [audience, price, engagement, scenarios.moderado]
  );
  const moderateSteadyMRR = moderateSteady.monthlyRevenue;
  // Cumulative across the actual ramp-up Year 1 (sum of all 12 monthly MRR values from growth)
  const moderateCumulative = projections.moderado ? cumulativeRevenue(projections.moderado.months) : 0;

  const updateSlide = (slideKey, field, value) => {
    setSlides(prev => ({ ...prev, [slideKey]: { ...prev[slideKey], [field]: value } }));
  };

  const updateScenarioParam = (scenarioKey, param, value) => {
    setScenarios(prev => ({
      ...prev,
      [scenarioKey]: { ...prev[scenarioKey], [param]: value },
    }));
  };

  const exportPptx = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/export-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides, projections, audience, price,
          moderateYear12MRR: moderateSteadyMRR, moderateCumulative,
          creator: creator ? {
            name: creator.name, niche: creator.niche, engagement: creator.engagement,
            primaryPlatform: creator.primaryPlatform,
            platforms: creator.platforms, audienceEstimate: creator.audienceEstimate,
          } : null,
          showInvestimento,
        }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(creator?.name || 'Pitch').replace(/\s+/g, '_')}_pitch.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro a exportar: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Digital PDF export — captures each slide as a high-DPI image and assembles
  // a 16:9 landscape PDF. No browser print dialog, no headers/footers, no page
  // numbers, no print-cost garbage. Just the slides.
  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Lazy-load PDF libs (heavy, client-only)
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const slideEls = document.querySelectorAll('.slide');
      if (slideEls.length === 0) throw new Error('No slides found');

      // 16:9 landscape, ~Full HD for crisp output
      const pdfWidth = 1920;
      const pdfHeight = 1080;

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [pdfWidth, pdfHeight],
        compress: true,
        hotfixes: ['px_scaling'],
      });

      for (let i = 0; i < slideEls.length; i++) {
        const el = slideEls[i];
        // 2x scale for sharp text and chart rendering on HD displays
        const canvas = await html2canvas(el, {
          scale: 2,
          backgroundColor: '#0a0a0a',
          logging: false,
          useCORS: true,
          allowTaint: false,
          windowWidth: el.scrollWidth,
          windowHeight: el.scrollHeight,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        if (i > 0) pdf.addPage([pdfWidth, pdfHeight], 'landscape');
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      }

      const filename = `${(creator?.name || 'Pitch').replace(/\s+/g, '_')}_pitch.pdf`;
      pdf.save(filename);
    } catch (err) {
      alert('Erro a exportar PDF: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading || !slides) {
    return <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#555", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>A carregar...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", paddingBottom: 80 }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />

      {/* Toolbar */}
      <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "12px 24px", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href={creatorId ? `/creators/${creatorId}` : "/creators"} style={{ fontSize: 11, color: "#888", textDecoration: "none" }}>← Voltar</a>
          <span style={{ fontSize: 11, color: "#444" }}>|</span>
          <span style={{ fontSize: 11, color: "#aaa" }}>Pitch: <strong style={{ color: "#f5f5f5" }}>{creator?.name || 'Creator'}</strong></span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#aaa", cursor: "pointer" }}>
            <input type="checkbox" checked={showInvestimento} onChange={(e) => setShowInvestimento(e.target.checked)} />
            Incluir Investimento
          </label>
          <button onClick={exportPdf} style={btnSecondary}>Export PDF</button>
          <button onClick={exportPptx} disabled={exporting} style={btnPrimary}>{exporting ? "A exportar..." : "Export PPTX"}</button>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .slide { page-break-after: always; min-height: auto !important; }
          body { background: #0a0a0a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        [contenteditable]:hover { background: rgba(255,255,255,0.02); }
        [contenteditable]:focus { background: rgba(122,14,24,0.08); }
      `}</style>

      {/* SLIDE 1: COVER — logo + centered subtitle */}
      <Slide>
        <div style={slideInnerCentered}>
          <img src={LOGO_B64} alt="Second Layer" style={{ height: 32, opacity: 0.95, marginBottom: 56 }} />
          <h1 style={{ fontSize: 92, fontWeight: 800, margin: 0, lineHeight: 1.05, letterSpacing: "-0.03em", textAlign: "center" }}>
            <Editable value={slides.cover.title} onChange={v => updateSlide('cover', 'title', v)} />
          </h1>
          <div style={{ width: 80, height: 3, background: "#7A0E18", margin: "44px auto" }} />
          <p style={{ fontSize: 28, color: "#aaa", margin: 0, textAlign: "center" }}>
            <StyledLastWord text={slides.cover.subtitle} italicStyle={{ color: "#f5f5f5", fontSize: 36 }} />
          </p>
        </div>
      </Slide>

      {/* SLIDE 2: CORE PROMISE — new */}
      <Slide>
        <div style={slideInnerCentered}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 36 }}>
            <Editable value={slides.corePromise.eyebrow} onChange={v => updateSlide('corePromise', 'eyebrow', v)} />
          </div>
          <h1 style={{ fontSize: 68, fontWeight: 700, margin: 0, lineHeight: 1.15, letterSpacing: "-0.03em", maxWidth: 1300, textAlign: "center" }}>
            <StyledKeyword
              text={slides.corePromise.headline}
              keyword={creator?.primaryLanguage === 'en' ? 'business' : 'negócio'}
              italicStyle={{ color: "#7A0E18", fontSize: 84 }}
            />
          </h1>
          <div style={{ width: 60, height: 2, background: "rgba(122,14,24,0.5)", margin: "48px auto" }} />
          <p style={{ ...italicSerif, fontSize: 30, color: "#aaa", margin: 0, maxWidth: 900, textAlign: "center", letterSpacing: "0.005em" }}>
            <Editable value={slides.corePromise.sub} onChange={v => updateSlide('corePromise', 'sub', v)} multiline />
          </p>
        </div>
      </Slide>

      {/* SLIDE 3: TRANSFORMATION — bigger text */}
      <Slide>
        <div style={{ ...slideInnerCentered, alignItems: "stretch" }}>
          <h1 style={{ fontSize: 44, fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em", textAlign: "center", marginBottom: 56 }}>
            <Editable value={slides.transformation.title} onChange={v => updateSlide('transformation', 'title', v)} />
          </h1>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
            <div style={{ padding: "44px 36px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 32, textAlign: "center" }}>
                <Editable value={slides.transformation.beforeLabel} onChange={v => updateSlide('transformation', 'beforeLabel', v)} />
              </div>
              {slides.transformation.before.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 16, marginBottom: 22, alignItems: "flex-start" }}>
                  <span style={{ color: "#666", fontSize: 26, lineHeight: 1 }}>×</span>
                  <p style={{ margin: 0, fontSize: 22, color: "#888", lineHeight: 1.45 }}>
                    <Editable value={item} onChange={v => {
                      const next = [...slides.transformation.before]; next[i] = v;
                      updateSlide('transformation', 'before', next);
                    }} />
                  </p>
                </div>
              ))}
            </div>
            <div style={{ padding: "44px 36px", background: "rgba(122,14,24,0.05)", border: "1px solid rgba(122,14,24,0.2)", borderRadius: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 32, textAlign: "center" }}>
                <Editable value={slides.transformation.afterLabel} onChange={v => updateSlide('transformation', 'afterLabel', v)} />
              </div>
              {slides.transformation.after.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 16, marginBottom: 22, alignItems: "flex-start" }}>
                  <span style={{ color: "#7A0E18", fontSize: 26, lineHeight: 1 }}>→</span>
                  <p style={{ margin: 0, fontSize: 22, color: "#f5f5f5", lineHeight: 1.45 }}>
                    <Editable value={item} onChange={v => {
                      const next = [...slides.transformation.after]; next[i] = v;
                      updateSlide('transformation', 'after', next);
                    }} />
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Slide>

      {/* SLIDE 4: WHAT YOU GET — centered */}
      <Slide>
        <div style={{ ...slideInnerCentered, alignItems: "stretch" }}>
          <h1 style={{ fontSize: 48, fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em", color: "#f5f5f5", textAlign: "center", marginBottom: 56 }}>
            <Editable value={slides.whatYouGet.hero} onChange={v => updateSlide('whatYouGet', 'hero', v)} multiline />
          </h1>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
            {slides.whatYouGet.pillars.map((pillar, i) => (
              <div key={i} style={{ padding: "36px 28px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, textAlign: "center" }}>
                <div style={{ fontSize: 38, fontWeight: 800, color: "#7A0E18", marginBottom: 18 }}>0{i + 1}</div>
                <h3 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 14px", color: "#f5f5f5" }}>
                  <Editable value={pillar.title} onChange={v => {
                    const next = [...slides.whatYouGet.pillars]; next[i] = { ...pillar, title: v };
                    updateSlide('whatYouGet', 'pillars', next);
                  }} />
                </h3>
                <p style={{ margin: 0, fontSize: 16, color: "#aaa", lineHeight: 1.6 }}>
                  <Editable value={pillar.desc} onChange={v => {
                    const next = [...slides.whatYouGet.pillars]; next[i] = { ...pillar, desc: v };
                    updateSlide('whatYouGet', 'pillars', next);
                  }} multiline />
                </p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 48, fontSize: 18, color: "#888", fontStyle: "italic", textAlign: "center" }}>
            <Editable value={slides.whatYouGet.closer} onChange={v => updateSlide('whatYouGet', 'closer', v)} multiline />
          </p>
        </div>
      </Slide>

      {/* SLIDE 5: AUDIENCE — translated, no closer line */}
      <Slide>
        <div style={{ ...slideInnerCentered, alignItems: "stretch" }}>
          <h1 style={{ fontSize: 44, fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em", textAlign: "center", marginBottom: 48 }}>
            <Editable value={slides.audience.title} onChange={v => updateSlide('audience', 'title', v)} />
          </h1>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
            <MetricCard label={creator?.primaryLanguage === 'en' ? 'Total Audience' : 'Audiência Total'} value={formatFollowers(audience)} accent />
            <MetricCard label={creator?.primaryLanguage === 'en' ? 'Primary Platform' : 'Plataforma Principal'} value={creator?.primaryPlatform || 'Instagram'} />
            <MetricCard label="Engagement" value={creator?.engagement || 'N/A'} />
            <MetricCard label={creator?.primaryLanguage === 'en' ? 'Niche' : 'Nicho'} value={creator?.niche || 'N/A'} />
          </div>
          {(translatedAudience || creator?.audienceEstimate) && (() => {
            const aud = translatedAudience || creator.audienceEstimate;
            const en = creator?.primaryLanguage === 'en';
            return (
              <div style={{ marginTop: 36, padding: "32px 36px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#666", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 24, textAlign: "center" }}>
                  {en ? 'Estimated Audience' : 'Audiência Estimada'}
                  {translatingAudience && <span style={{ marginLeft: 10, color: "#444", textTransform: "none", letterSpacing: 0 }}>(a traduzir...)</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 28 }}>
                  {aud.age && <div style={{ textAlign: "center" }}><div style={{ fontSize: 12, color: "#555", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>{en ? 'Age' : 'Idade'}</div><div style={{ fontSize: 18, color: "#ddd" }}>{aud.age}</div></div>}
                  {aud.gender && <div style={{ textAlign: "center" }}><div style={{ fontSize: 12, color: "#555", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>{en ? 'Gender' : 'Género'}</div><div style={{ fontSize: 18, color: "#ddd" }}>{aud.gender}</div></div>}
                  {aud.location && <div style={{ textAlign: "center" }}><div style={{ fontSize: 12, color: "#555", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>{en ? 'Location' : 'Localização'}</div><div style={{ fontSize: 18, color: "#ddd" }}>{aud.location}</div></div>}
                  {aud.language && <div style={{ textAlign: "center" }}><div style={{ fontSize: 12, color: "#555", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>{en ? 'Language' : 'Idioma'}</div><div style={{ fontSize: 18, color: "#ddd" }}>{aud.language}</div></div>}
                </div>
              </div>
            );
          })()}
        </div>
      </Slide>

      {/* SLIDE 6: BUILD + OPERATE — two SEPARATE boxes with own titles */}
      <Slide>
        <div style={{ ...slideInnerCentered, alignItems: "stretch" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            {/* Box 1: BUILD */}
            <div style={{ padding: "44px 36px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16 }}>
              <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px", color: "#f5f5f5", textAlign: "center", letterSpacing: "-0.02em" }}>
                <Editable value={slides.buildOperate.buildTitle} onChange={v => updateSlide('buildOperate', 'buildTitle', v)} />
              </h2>
              <div style={{ fontSize: 13, color: "#7A0E18", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 28, textAlign: "center", fontWeight: 600 }}>
                <Editable value={slides.buildOperate.buildSub} onChange={v => updateSlide('buildOperate', 'buildSub', v)} />
              </div>
              {slides.buildOperate.build.map((item, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <p style={{ margin: 0, fontSize: 16, color: "#ddd", lineHeight: 1.5 }}>
                    <strong style={{ color: "#f5f5f5", fontWeight: 700 }}>
                      <Editable value={item.title} onChange={v => {
                        const next = [...slides.buildOperate.build]; next[i] = { ...item, title: v };
                        updateSlide('buildOperate', 'build', next);
                      }} />
                    </strong>
                    <span style={{ color: "#999" }}>{": "}
                    <Editable value={item.desc} onChange={v => {
                      const next = [...slides.buildOperate.build]; next[i] = { ...item, desc: v };
                      updateSlide('buildOperate', 'build', next);
                    }} multiline />
                    </span>
                  </p>
                </div>
              ))}
            </div>

            {/* Box 2: OPERATE */}
            <div style={{ padding: "44px 36px", background: "rgba(122,14,24,0.05)", border: "1px solid rgba(122,14,24,0.2)", borderRadius: 16 }}>
              <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px", color: "#f5f5f5", textAlign: "center", letterSpacing: "-0.02em" }}>
                <Editable value={slides.buildOperate.operateTitle} onChange={v => updateSlide('buildOperate', 'operateTitle', v)} />
              </h2>
              <div style={{ fontSize: 13, color: "#22c55e", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 28, textAlign: "center", fontWeight: 600 }}>
                <Editable value={slides.buildOperate.operateSub} onChange={v => updateSlide('buildOperate', 'operateSub', v)} />
              </div>
              {slides.buildOperate.operate.map((item, i) => (
                <div key={i} style={{ marginBottom: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ color: "#22c55e", fontSize: 16, lineHeight: 1.5 }}>•</span>
                  <p style={{ margin: 0, fontSize: 16, color: "#ddd", lineHeight: 1.5, flex: 1 }}>
                    <Editable value={item} onChange={v => {
                      const next = [...slides.buildOperate.operate]; next[i] = v;
                      updateSlide('buildOperate', 'operate', next);
                    }} multiline />
                  </p>
                </div>
              ))}
            </div>
          </div>
          <p style={{ marginTop: 36, fontSize: 18, color: "#f5f5f5", fontWeight: 600, textAlign: "center" }}>
            <Editable value={slides.buildOperate.closer} onChange={v => updateSlide('buildOperate', 'closer', v)} multiline />
          </p>
        </div>
      </Slide>

      {/* SLIDE 7: LAUNCH — phases with assets, centered */}
      <Slide>
        <div style={{ ...slideInnerCentered, alignItems: "stretch" }}>
          <h1 style={{ fontSize: 44, fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em", textAlign: "center", marginBottom: 56 }}>
            <Editable value={slides.launch.title} onChange={v => updateSlide('launch', 'title', v)} />
          </h1>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
            {slides.launch.phases.map((phase, i) => (
              <div key={i} style={{ padding: "36px 28px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, position: "relative", textAlign: "center" }}>
                <div style={{ fontSize: 64, fontWeight: 800, color: "#7A0E18", opacity: 0.25, position: "absolute", top: 12, right: 18, lineHeight: 1 }}>{i + 1}</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 14px", color: "#f5f5f5", position: "relative" }}>
                  <Editable value={phase.title} onChange={v => {
                    const next = [...slides.launch.phases]; next[i] = { ...phase, title: v };
                    updateSlide('launch', 'phases', next);
                  }} />
                </h3>
                <p style={{ margin: "0 0 18px", fontSize: 14, color: "#aaa", lineHeight: 1.6, textAlign: "left" }}>
                  <Editable value={phase.desc} onChange={v => {
                    const next = [...slides.launch.phases]; next[i] = { ...phase, desc: v };
                    updateSlide('launch', 'phases', next);
                  }} multiline />
                </p>
                {phase.assets && phase.assets.length > 0 && (
                  <div style={{ paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "left" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Assets</div>
                    {phase.assets.map((asset, j) => (
                      <div key={j} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                        <span style={{ color: "#7A0E18", fontSize: 12, lineHeight: 1.4 }}>›</span>
                        <span style={{ fontSize: 13, color: "#ccc", lineHeight: 1.4, flex: 1 }}>
                          <Editable value={asset} onChange={v => {
                            const nextAssets = [...phase.assets]; nextAssets[j] = v;
                            const next = [...slides.launch.phases]; next[i] = { ...phase, assets: nextAssets };
                            updateSlide('launch', 'phases', next);
                          }} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p style={{ marginTop: 48, fontSize: 16, color: "#888", fontStyle: "italic", textAlign: "center" }}>
            <Editable value={slides.launch.closer} onChange={v => updateSlide('launch', 'closer', v)} multiline />
          </p>
        </div>
      </Slide>

      {/* SLIDE 8: NUMBERS — split layout: chart on one side, formula+inputs on the other */}
      <Slide>
        <div style={{ ...slideInnerCentered, alignItems: "stretch" }}>
          <h1 style={{ fontSize: 44, fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em", textAlign: "center", marginBottom: 16 }}>
            <Editable value={slides.numbers.title} onChange={v => updateSlide('numbers', 'title', v)} />
          </h1>

          {/* Hero MRR — full width above split */}
          <div style={{ marginTop: 18, padding: "26px 32px", background: "rgba(122,14,24,0.08)", border: "1px solid rgba(122,14,24,0.25)", borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
              <Editable value={slides.numbers.heroLabel} onChange={v => updateSlide('numbers', 'heroLabel', v)} />
            </div>
            <div style={{ lineHeight: 1, letterSpacing: "-0.03em" }}>
              <span style={{ ...italicSerif, fontSize: 96, color: "#f5f5f5", fontWeight: 400 }}>{formatEuro(moderateSteadyMRR)}</span>
              <span style={{ fontSize: 24, color: "#888", fontWeight: 400, marginLeft: 4 }}>/{creator?.primaryLanguage === 'en' ? 'mo' : 'mês'}</span>
            </div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
              <Editable value={slides.numbers.cumulativeLabel} onChange={v => updateSlide('numbers', 'cumulativeLabel', v)} />: <strong style={{ color: "#f5f5f5" }}>{formatEuro(moderateCumulative)}</strong>
            </div>
          </div>

          {/* Split: chart left, formula+inputs right */}
          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 22 }}>
            <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, display: "flex", alignItems: "center" }}>
              <GrowthChart scenarios={projections} height={340} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Formula */}
              <div style={{ padding: "18px 22px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#666", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                  <Editable value={slides.numbers.formulaTitle} onChange={v => updateSlide('numbers', 'formulaTitle', v)} />
                </div>
                <div style={{ fontSize: 13, color: "#ddd", lineHeight: 1.7, fontFamily: "ui-monospace, monospace" }}>
                  {creator?.primaryLanguage === 'en' ? (
                    <>
                      <div><span style={{ color: "#7A0E18" }}>New members</span> = audience × conversion %</div>
                      <div><span style={{ color: "#7A0E18" }}>MRR (month N)</span> = (members × (1 − churn) + new) × price</div>
                      <div style={{ marginTop: 10, fontSize: 12, color: "#888" }}>Launch month uses a higher conversion rate (waitlist effect).</div>
                    </>
                  ) : (
                    <>
                      <div><span style={{ color: "#7A0E18" }}>Membros novos</span> = audiência × taxa conv. %</div>
                      <div><span style={{ color: "#7A0E18" }}>MRR (mês N)</span> = (membros × (1 − churn) + novos) × preço</div>
                      <div style={{ marginTop: 10, fontSize: 12, color: "#888" }}>Mês de lançamento usa taxa de conversão maior (efeito da waitlist).</div>
                    </>
                  )}
                </div>
              </div>

              {/* Inputs (live editable, hidden in print) */}
              <div className="no-print" style={{ padding: "16px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                  <Editable value={slides.numbers.assumptionsTitle} onChange={v => updateSlide('numbers', 'assumptionsTitle', v)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <LabelInput label={creator?.primaryLanguage === 'en' ? 'Audience' : 'Audiência'} value={audience} onChange={setAudience} type="number" />
                  <LabelInput label={creator?.primaryLanguage === 'en' ? 'Price (€/mo)' : 'Preço (€/mês)'} value={price} onChange={setPrice} type="number" />
                  <LabelInput label={creator?.primaryLanguage === 'en' ? 'Engagement rate' : 'Taxa de engagement'} value={engagement} onChange={setEngagement} type="number" step="0.1" suffix="%" />
                  <LabelInput label={creator?.primaryLanguage === 'en' ? 'Monthly churn' : 'Saídas mensais'} value={scenarios.moderado.churn * 100} onChange={v => updateScenarioParam('moderado', 'churn', v / 100)} type="number" step="0.5" suffix="%" />
                </div>
              </div>
            </div>
          </div>

          <p style={{ marginTop: 22, fontSize: 16, color: "#f5f5f5", fontWeight: 700, textAlign: "center" }}>
            <Editable value={slides.numbers.closer} onChange={v => updateSlide('numbers', 'closer', v)} multiline />
          </p>
        </div>
      </Slide>

      {/* SLIDE 9: PARTNERSHIP — centered */}
      <Slide>
        <div style={{ ...slideInnerCentered, alignItems: "stretch" }}>
          <h1 style={{ fontSize: 44, fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em", textAlign: "center", marginBottom: 56 }}>
            <Editable value={slides.partnership.title} onChange={v => updateSlide('partnership', 'title', v)} />
          </h1>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            <div style={{ padding: "44px 36px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 24 }}>
                <Editable value={slides.partnership.youLabel} onChange={v => updateSlide('partnership', 'youLabel', v)} />
              </div>
              <p style={{ margin: 0, fontSize: 20, color: "#f5f5f5", lineHeight: 1.6, textAlign: "left" }}>
                <Editable value={slides.partnership.you} onChange={v => updateSlide('partnership', 'you', v)} multiline />
              </p>
            </div>
            <div style={{ padding: "44px 36px", background: "rgba(122,14,24,0.05)", border: "1px solid rgba(122,14,24,0.2)", borderRadius: 14, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 24 }}>
                <Editable value={slides.partnership.usLabel} onChange={v => updateSlide('partnership', 'usLabel', v)} />
              </div>
              <p style={{ margin: 0, fontSize: 20, color: "#f5f5f5", lineHeight: 1.6, textAlign: "left" }}>
                <Editable value={slides.partnership.us} onChange={v => updateSlide('partnership', 'us', v)} multiline />
              </p>
            </div>
          </div>
          <div style={{ marginTop: 44, padding: "26px 36px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 22, color: "#f5f5f5", fontWeight: 700 }}>
              <Editable value={slides.partnership.alignment} onChange={v => updateSlide('partnership', 'alignment', v)} />
            </p>
          </div>
        </div>
      </Slide>

      {/* SLIDE 10: RECAP — centered */}
      <Slide>
        <div style={{ ...slideInnerCentered, alignItems: "stretch" }}>
          <h1 style={{ fontSize: 44, fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em", textAlign: "center", marginBottom: 48 }}>
            <Editable value={slides.recap.title} onChange={v => updateSlide('recap', 'title', v)} />
          </h1>
          <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>
            {slides.recap.pairs.map((pair, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 32, alignItems: "center", padding: "26px 0", borderBottom: i < slides.recap.pairs.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    <Editable value={slides.recap.fromLabel} onChange={v => updateSlide('recap', 'fromLabel', v)} />
                  </div>
                  <div style={{ fontSize: 22, color: "#888" }}>
                    <Editable value={pair.from} onChange={v => {
                      const next = [...slides.recap.pairs]; next[i] = { ...pair, from: v };
                      updateSlide('recap', 'pairs', next);
                    }} />
                  </div>
                </div>
                <div style={{ fontSize: 32, color: "#7A0E18", fontWeight: 700 }}>→</div>
                <div>
                  <div style={{ fontSize: 12, color: "#7A0E18", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    <Editable value={slides.recap.toLabel} onChange={v => updateSlide('recap', 'toLabel', v)} />
                  </div>
                  <div style={{ ...italicSerif, fontSize: 32, color: "#f5f5f5", fontWeight: 400, lineHeight: 1.2 }}>
                    <Editable value={pair.to} onChange={v => {
                      const next = [...slides.recap.pairs]; next[i] = { ...pair, to: v };
                      updateSlide('recap', 'pairs', next);
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 48, fontSize: 20, color: "#f5f5f5", fontWeight: 600, textAlign: "center", fontStyle: "italic" }}>
            <Editable value={slides.recap.closer} onChange={v => updateSlide('recap', 'closer', v)} multiline />
          </p>
        </div>
      </Slide>

      {/* SLIDE 11 (OPTIONAL): INVESTIMENTO — moved up, before close */}
      {showInvestimento && (
        <Slide>
          <div style={{ ...slideInnerCentered, alignItems: "stretch" }}>
            <h1 style={{ fontSize: 44, fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em", textAlign: "center", marginBottom: 48 }}>
              <Editable value={slides.investment.title} onChange={v => updateSlide('investment', 'title', v)} />
            </h1>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
              <div style={{ padding: "36px 32px", background: "rgba(122,14,24,0.05)", border: "1px solid rgba(122,14,24,0.2)", borderRadius: 14, textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
                  <Editable value={slides.investment.setupLabel} onChange={v => updateSlide('investment', 'setupLabel', v)} />
                </div>
                <div style={{ fontSize: 56, fontWeight: 800, color: "#f5f5f5", lineHeight: 1, marginBottom: 10 }}>
                  <Editable value={slides.investment.setupAmount} onChange={v => updateSlide('investment', 'setupAmount', v)} />
                </div>
                <div style={{ fontSize: 13, color: "#888", marginBottom: 18 }}>
                  <Editable value={slides.investment.setupNote} onChange={v => updateSlide('investment', 'setupNote', v)} />
                </div>
                <p style={{ margin: 0, fontSize: 15, color: "#aaa", lineHeight: 1.6, textAlign: "left" }}>
                  <Editable value={slides.investment.setupDesc} onChange={v => updateSlide('investment', 'setupDesc', v)} multiline />
                </p>
              </div>
              <div style={{ padding: "36px 32px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 14, textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
                  <Editable value={slides.investment.commissionLabel} onChange={v => updateSlide('investment', 'commissionLabel', v)} />
                </div>
                <div style={{ fontSize: 56, fontWeight: 800, color: "#f5f5f5", lineHeight: 1, marginBottom: 10 }}>
                  <Editable value={slides.investment.commissionAmount} onChange={v => updateSlide('investment', 'commissionAmount', v)} />
                </div>
                <div style={{ fontSize: 13, color: "#888", marginBottom: 18 }}>
                  <Editable value={slides.investment.commissionNote} onChange={v => updateSlide('investment', 'commissionNote', v)} />
                </div>
                <p style={{ margin: 0, fontSize: 15, color: "#aaa", lineHeight: 1.6, textAlign: "left" }}>
                  <Editable value={slides.investment.commissionDesc} onChange={v => updateSlide('investment', 'commissionDesc', v)} multiline />
                </p>
              </div>
            </div>
            <div style={{ marginTop: 28, padding: "26px 32px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#888", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 18, textAlign: "center" }}>
                <Editable value={slides.investment.includedTitle} onChange={v => updateSlide('investment', 'includedTitle', v)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {slides.investment.included.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ color: "#22c55e", fontSize: 16 }}>✓</span>
                    <span style={{ fontSize: 14, color: "#ccc" }}>
                      <Editable value={item} onChange={v => {
                        const next = [...slides.investment.included]; next[i] = v;
                        updateSlide('investment', 'included', next);
                      }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ marginTop: 32, fontSize: 18, color: "#f5f5f5", fontWeight: 600, textAlign: "center", fontStyle: "italic" }}>
              <Editable value={slides.investment.closer} onChange={v => updateSlide('investment', 'closer', v)} multiline />
            </p>
          </div>
        </Slide>
      )}

      {/* SLIDE 12 (LAST): CLOSE — single big centered question */}
      <Slide>
        <div style={slideInnerCentered}>
          <h1 style={{ fontSize: 88, fontWeight: 700, margin: 0, lineHeight: 1.15, letterSpacing: "-0.03em", textAlign: "center", maxWidth: 1400 }}>
            <StyledLastWord
              text={slides.close.title}
              italicStyle={{ fontSize: 112, color: "#7A0E18", letterSpacing: "-0.02em" }}
            />
          </h1>
        </div>
      </Slide>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DEFAULT SLIDES
// ─────────────────────────────────────────────────────────────────

function buildDefaultSlides(creator) {
  const name = firstName(creator?.name || 'Creator');
  const lang = creator?.primaryLanguage === 'en' ? 'en' : 'pt';
  const t = (pt, en) => lang === 'en' ? en : pt;
  return {
    cover: {
      title: creator?.name || 'Creator',
      subtitle: t('Proposta de Parceria', 'Partnership Proposal'),
    },
    corePromise: {
      eyebrow: t('A nossa promessa', 'Our promise'),
      headline: t(
        'Construímos e operamos o negócio por trás do teu conteúdo.',
        'We build and operate the business behind your content.'
      ),
      sub: t(
        'Tu continuas a ser a cara. Nós tratamos do resto.',
        'You stay the face. We handle the rest.'
      ),
    },
    transformation: {
      title: t('Onde estás. Onde podes estar.', 'Where you are. Where you can be.'),
      beforeLabel: t('Hoje', 'Today'),
      afterLabel: t('Com a Second Layer', 'With Second Layer'),
      before: lang === 'en' ? [
        'Dependent on the algorithm',
        'Unpredictable sponsorship income',
        'Audience you don\'t control',
        'You do everything alone',
      ] : [
        'Dependente do algoritmo',
        'Receita imprevisível de patrocínios',
        'Audiência que não controlas',
        'Fazes tudo sozinho',
      ],
      after: lang === 'en' ? [
        'A real business that\'s yours',
        'Predictable, recurring revenue',
        'A community you control',
        'You stay the face. A team runs the machine.',
      ] : [
        'Negócio próprio que é teu',
        'Receita recorrente, previsível',
        'Comunidade que controlas',
        'Tu és a cara. Equipa opera a máquina.',
      ],
    },
    whatYouGet: {
      hero: t(
        'Vais ter um negócio a sério por trás do teu conteúdo.',
        'You\'ll have a real business behind your content.'
      ),
      pillars: lang === 'en' ? [
        { title: 'A paid community', desc: 'Where your members pay monthly to access you and what you teach. It\'s yours. You control who joins, how much they pay, how it grows.' },
        { title: 'A system that brings and keeps members', desc: 'Ads, sales, emails, onboarding. All built and connected, bringing new members every month.' },
        { title: 'A dedicated team running it', desc: 'We operate everything behind the scenes. You stay in what you do best: create, show up, lead your audience.' },
      ] : [
        { title: 'Uma comunidade paga', desc: 'Onde os teus membros pagam mensalmente para ter acesso a ti e ao que ensinas. É tua. Controlas quem entra, quanto paga, como cresce.' },
        { title: 'Um sistema que traz e mantém membros', desc: 'Publicidade, vendas, emails, onboarding. Tudo construído e ligado, a trazer membros novos todos os meses.' },
        { title: 'Uma equipa dedicada a operar', desc: 'Nós operamos tudo o que está por trás. Tu mantens-te no que fazes melhor: criar, aparecer, liderar a tua audiência.' },
      ],
      closer: t(
        'No fim, ficas com receita mensal previsível, uma comunidade que é tua, e uma equipa a operar o teu negócio.',
        'In the end, you have predictable monthly revenue, a community that\'s yours, and a team running your business.'
      ),
    },
    audience: {
      title: t('A Tua Audiência', 'Your Audience'),
    },
    buildOperate: {
      buildTitle: t('O Que Construímos', 'What We Build'),
      operateTitle: t('O Que Operamos', 'What We Operate'),
      buildSub: t('uma vez, no início', 'one time, at setup'),
      operateSub: t('todos os meses', 'every month'),
      build: lang === 'en' ? [
        { title: 'Paid community', desc: 'the platform where members pay monthly to access you' },
        { title: 'Sales page', desc: 'where people learn about the offer and pay' },
        { title: 'Automated email system', desc: 'messages at the right moment (welcome, sales, re-engagement)' },
        { title: 'Paid ads infrastructure', desc: 'Instagram, Facebook, and TikTok bringing in new members' },
        { title: 'Performance dashboard', desc: 'see in real time how many members, how much you earned, what works' },
        { title: 'Member onboarding playbook', desc: 'ensures every new member starts strong and stays' },
      ] : [
        { title: 'Comunidade paga', desc: 'a plataforma onde os membros pagam mensalmente para ter acesso a ti' },
        { title: 'Página de vendas', desc: 'onde as pessoas conhecem a oferta e pagam' },
        { title: 'Sistema de emails automático', desc: 'mensagens no momento certo (boas-vindas, vendas, reengagement)' },
        { title: 'Anúncios pagos', desc: 'Instagram, Facebook e TikTok a trazer membros novos' },
        { title: 'Painel com os teus números', desc: 'vês em tempo real quantos membros tens, quanto ganhaste, o que funciona' },
        { title: 'Playbook de boas-vindas', desc: 'garante que cada novo membro entra bem e fica' },
      ],
      operate: lang === 'en' ? [
        'We manage and optimize ads to bring in new members at the best cost',
        'We analyze email performance and adjust what isn\'t converting',
        'We keep the community alive (engagement, questions, activities)',
        'We identify members about to leave and bring them back',
        'Monthly call with you to align strategy and next steps',
        'Monthly report with all the numbers and what we\'ll do next',
        'We onboard every new member personally',
        'We turn your public content into a steady stream of new members',
      ] : [
        'Gerimos e otimizamos os anúncios para trazer novos membros ao melhor custo',
        'Analisamos os emails e ajustamos o que não está a vender',
        'Mantemos a comunidade viva (interação, dúvidas, atividades)',
        'Identificamos membros prestes a sair e trazemos de volta',
        'Call mensal contigo para alinhar estratégia e próximos passos',
        'Relatório mensal com todos os números e o que vamos fazer a seguir',
        'Fazemos o onboarding de cada novo membro',
        'Transformamos o teu conteúdo público num fluxo constante de novos membros',
      ],
      closer: t(
        'Não construímos e vamos embora. A máquina fica ligada e a crescer, todos os meses.',
        'We don\'t build and disappear. The machine stays running and growing, every month.'
      ),
    },
    launch: {
      title: t('Como Lançamos', 'How We Launch'),
      phases: lang === 'en' ? [
        {
          title: 'We validate before spending',
          desc: 'We open a waitlist and welcome the first founding members with a special price. Validates the message before investing in ads.',
          assets: ['Waitlist landing page', 'Founding members offer', 'Pre-launch email sequence', 'Soft-launch campaign'],
        },
        {
          title: 'We turn the growth machine on',
          desc: 'Ads on the right platforms. Emails on autopilot. Public content feeding the funnel. Live launch event.',
          assets: ['Meta + TikTok ad campaigns', 'Sales page + checkout', 'Live launch webinar', 'Launch email sequence (5+ emails)'],
        },
        {
          title: 'We optimize continuously',
          desc: 'Every month we test new angles, emails, formats. What works scales. What doesn\'t, we cut.',
          assets: ['Monthly creative refresh', 'A/B testing on emails + ads', 'Retention campaigns', 'New tier / pricing experiments'],
        },
      ] : [
        {
          title: 'Validamos antes de gastar',
          desc: 'Abrimos uma lista de espera e acolhemos os primeiros membros fundadores com preço especial. Serve para validar a mensagem antes de investir em anúncios.',
          assets: ['Landing page de waitlist', 'Oferta de membros fundadores', 'Sequência de emails pre-launch', 'Campanha de soft-launch'],
        },
        {
          title: 'Ligamos a máquina de crescimento',
          desc: 'Anúncios ligados nas plataformas certas. Emails em automático. Conteúdo público a alimentar o funil. Evento ao vivo de lançamento.',
          assets: ['Campanhas de anúncios Meta + TikTok', 'Sales page + checkout', 'Webinar de lançamento ao vivo', 'Sequência de emails de lançamento (5+ emails)'],
        },
        {
          title: 'Otimizamos continuamente',
          desc: 'Todos os meses testamos novos ângulos, emails, formatos. O que funciona escala. O que não funciona, corta-se.',
          assets: ['Refresh mensal de criativos', 'A/B testing em emails + anúncios', 'Campanhas de retenção', 'Novos tiers / experiências de preço'],
        },
      ],
      closer: t(
        'Usamos o mesmo método que temos testado e afinado. Ajustamos ao teu caso.',
        'We use the same method we\'ve tested and refined. Adjusted to your case.'
      ),
    },
    numbers: {
      title: t('Como os Números Crescem', 'How the Numbers Grow'),
      heroLabel: t('Receita Mensal Estabilizada · Cenário Moderado', 'Stable Monthly Revenue · Moderate Scenario'),
      cumulativeLabel: t('Receita acumulada Ano 1 (com crescimento)', 'Cumulative Year 1 Revenue (with ramp-up)'),
      formulaTitle: t('Como calculamos', 'How we calculate it'),
      assumptionsTitle: t('Premissas (ajustáveis ao vivo)', 'Assumptions (live editable)'),
      closer: t(
        'Mês 1 não é Mês 12. O lançamento traz o primeiro impulso. A máquina cresce todos os meses a partir daí.',
        'Month 1 is not Month 12. The launch brings the first surge. The machine grows every month from there.'
      ),
    },
    partnership: {
      title: t('Como Funciona a Parceria', 'How the Partnership Works'),
      youLabel: t('Tu', 'You'),
      usLabel: t('Nós', 'Us'),
      you: lang === 'en'
        ? `${name}, you create content. You show up in the community. You do lives and events. You\'re the voice, the face, the magnetic one. You stay doing what you already do well.`
        : `${name}, crias conteúdo. Apareces na comunidade. Fazes lives e eventos. És a voz, a cara, o magnético. Mantens-te a fazer o que já fazes bem.`,
      us: t(
        'Construímos a operação. Operamos tudo mensalmente. Trackeamos performance. Ajustamos ao longo do tempo. A máquina fica connosco.',
        'We build the operation. We run everything monthly. We track performance. We adjust over time. The machine stays with us.'
      ),
      alignment: t(
        'Só ganhamos quando tu ganhas. Estamos alinhados.',
        'We only earn when you earn. We\'re aligned.'
      ),
    },
    recap: {
      title: t('De → Para', 'From → To'),
      fromLabel: t('De', 'From'),
      toLabel: t('Para', 'To'),
      pairs: lang === 'en' ? [
        { from: 'Dependent on the algorithm', to: 'A real business' },
        { from: 'You do everything', to: 'You\'re the face, we operate' },
        { from: 'Unpredictable income', to: 'Recurring revenue' },
        { from: 'Brands controlling you', to: 'A community that\'s yours' },
      ] : [
        { from: 'Dependência do algoritmo', to: 'Negócio próprio' },
        { from: 'Tu fazes tudo', to: 'Tu és a cara, nós operamos' },
        { from: 'Receita imprevisível', to: 'Receita recorrente' },
        { from: 'Marcas a mandar em ti', to: 'Comunidade que é tua' },
      ],
      closer: t(
        'Vais continuar a ser criador. Mas com um negócio a sério por trás.',
        'You\'ll keep being a creator. But with a real business behind you.'
      ),
    },
    close: {
      title: t('Construímos isto juntos?', 'Shall we build this together?'),
    },
    investment: {
      title: t('Investimento', 'Investment'),
      setupLabel: t('Setup', 'Setup'),
      setupNote: t('Investimento único', 'One-time investment'),
      commissionLabel: t('Parceria', 'Partnership'),
      commissionNote: t('Revenue share mensal', 'Monthly revenue share'),
      includedTitle: t('O que está incluído', 'What\'s included'),
      setupAmount: '€6,000',
      setupDesc: t(
        'Cobre toda a construção do negócio: comunidade, funil, sales page, sistema de emails, infraestrutura de anúncios, dashboard e playbooks. Investimento único.',
        'Covers the full business build: community, funnel, sales page, email system, ad infrastructure, dashboard, and playbooks. One-time investment.'
      ),
      commissionAmount: '30%',
      commissionDesc: t(
        'Revenue share mensal sobre a receita que a máquina gera. Só pagas quando ganhas. Estamos alinhados.',
        'Monthly revenue share on what the machine generates. You only pay when you earn. We\'re aligned.'
      ),
      included: lang === 'en' ? [
        'Full paid community build',
        'Sales page + conversion funnel',
        'Automated email system',
        'Ad infrastructure (Meta + TikTok)',
        'Performance dashboard',
        'Monthly ad management',
        'Continuous email optimization',
        'Member engagement and onboarding',
        'Churn prevention + win-back campaigns',
        'Monthly strategy call',
        'Monthly performance report',
      ] : [
        'Construção completa da comunidade paga',
        'Sales page + funil de conversão',
        'Sistema de emails automático',
        'Infraestrutura de anúncios (Meta + TikTok)',
        'Dashboard de performance',
        'Gestão mensal de anúncios',
        'Otimização contínua de emails',
        'Engagement e onboarding de membros',
        'Prevenção de saídas + campanhas de recuperação',
        'Call mensal de estratégia',
        'Relatório mensal de performance',
      ],
      closer: t(
        'A nossa aposta é em ti. Por isso só ganhamos quando tu ganhas.',
        'Our bet is on you. That\'s why we only earn when you earn.'
      ),
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// SHARED
// ─────────────────────────────────────────────────────────────────

function Slide({ children }) {
  return (
    <div className="slide" style={{ minHeight: "100vh", padding: "80px 60px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      {children}
    </div>
  );
}

function SlideTitle({ value, onChange }) {
  return (
    <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em", color: "#f5f5f5" }}>
      <Editable value={value} onChange={onChange} />
    </h1>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <div style={{ padding: "22px 20px", background: accent ? "rgba(122,14,24,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${accent ? "rgba(122,14,24,0.25)" : "rgba(255,255,255,0.05)"}`, borderRadius: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#f5f5f5", lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function LabelInput({ label, value, onChange, type, step, suffix }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 600, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type={type || "text"}
          value={value}
          step={step}
          onChange={(e) => {
            const v = type === "number" ? parseFloat(e.target.value) || 0 : e.target.value;
            onChange(v);
          }}
          style={{ width: "100%", padding: "8px 10px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#f5f5f5", fontSize: 13, fontFamily: "inherit", outline: "none" }}
        />
        {suffix && <span style={{ fontSize: 11, color: "#666" }}>{suffix}</span>}
      </div>
    </div>
  );
}

const slideInner = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  maxWidth: 1400,
  margin: "0 auto",
  width: "100%",
};

const slideInnerCentered = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  maxWidth: 1400,
  margin: "0 auto",
  width: "100%",
  justifyContent: "center",
  alignItems: "center",
  textAlign: "center",
};

// Second Layer wordmark (reused from homepage). Inline base64 keeps it portable.
const LOGO_B64 = "data:image/png;base64,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";

const btnPrimary = {
  padding: "8px 16px",
  background: "#7A0E18",
  border: "none",
  borderRadius: 6,
  color: "#fff",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnSecondary = {
  padding: "8px 16px",
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  color: "#888",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

export default function PitchPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#555", display: "flex", alignItems: "center", justifyContent: "center" }}>A carregar...</div>}>
      <PitchPageContent />
    </Suspense>
  );
}
