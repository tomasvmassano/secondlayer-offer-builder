"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SCENARIOS as SHARED_SCENARIOS, projectGrowth as sharedProjectGrowth, cumulativeRevenue as sharedCumulative, calculateSteadyMRR } from "../lib/revenue";
import { parseOutput } from "../offer-builder/lib/shared";

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

  // Scale fixed-size 1920×1080 slides to fit the current viewport.
  // PDF export resets the transform during capture so output is always 1920×1080.
  useEffect(() => {
    const setScale = () => {
      const w = Math.min(window.innerWidth, 1920);
      document.documentElement.style.setProperty('--pitch-scale', String(w / 1920));
    };
    setScale();
    window.addEventListener('resize', setScale);
    return () => window.removeEventListener('resize', setScale);
  }, []);

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

      // Reset viewport scale on every slide so we capture at native 1920×1080.
      // The on-screen scale (transform: scale(--pitch-scale)) is for fitting the
      // browser window — for PDF we want the real, unscaled stage.
      const originalTransforms = [];
      slideEls.forEach(el => {
        originalTransforms.push(el.style.transform);
        el.style.transform = 'none';
      });
      try {
        for (let i = 0; i < slideEls.length; i++) {
          const el = slideEls[i];
          const canvas = await html2canvas(el, {
            scale: 2,
            backgroundColor: '#0a0a0a',
            logging: false,
            useCORS: true,
            allowTaint: false,
            width: 1920,
            height: 1080,
            windowWidth: 1920,
            windowHeight: 1080,
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.92);
          if (i > 0) pdf.addPage([pdfWidth, pdfHeight], 'landscape');
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        }
      } finally {
        slideEls.forEach((el, i) => { el.style.transform = originalTransforms[i]; });
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
    return <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#555", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Geist', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>A carregar...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Geist', 'Helvetica Neue', Helvetica, Arial, sans-serif", paddingBottom: 80 }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

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
          .aurora, .cover-orb, .spotlight { animation: none !important; }
          .chart-line { stroke-dasharray: none !important; stroke-dashoffset: 0 !important; animation: none !important; }
          .chart-dot, .pulse-dot, .iso-pulse { animation: none !important; opacity: 1 !important; }
          .slide::after { opacity: 0.04 !important; }
        }
        [contenteditable]:hover { background: rgba(255,255,255,0.02); }
        [contenteditable]:focus { background: rgba(122,14,24,0.08); }

        /* ========= SLIDE FRAME (fixed 1920×1080, viewport-fit scale) ========= */
        .slide-frame {
          width: 100%;
          max-width: 1920px;
          margin: 0 auto;
          position: relative;
          overflow: hidden;
          /* derived from --pitch-scale set by JS on resize */
          height: calc(1080px * var(--pitch-scale, 1));
        }
        .slide {
          transform: scale(var(--pitch-scale, 1));
          transform-origin: top left;
        }

        /* ========= CINEMATIC LAYER ========= */
        /* Film-grain on every slide */
        .slide { position: relative; overflow: hidden; }
        .slide > * { position: relative; z-index: 2; }
        .slide::after {
          content: "";
          position: absolute; inset: 0;
          pointer-events: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
          opacity: 0.06;
          mix-blend-mode: overlay;
          z-index: 50;
        }

        /* Aurora orbs (drifting red/deep/green glows) */
        .aurora {
          position: absolute;
          pointer-events: none;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.5;
          z-index: 0;
          animation: sl-drift 14s ease-in-out infinite alternate;
        }
        .aurora.red   { background: radial-gradient(circle, rgba(177,30,47,0.85), rgba(177,30,47,0) 70%); }
        .aurora.deep  { background: radial-gradient(circle, rgba(120,15,30,0.9), rgba(120,15,30,0) 70%); }
        .aurora.green { background: radial-gradient(circle, rgba(31,138,76,0.6), rgba(31,138,76,0) 70%); }
        @keyframes sl-drift {
          0%   { transform: translate(0,0) scale(1); }
          50%  { transform: translate(40px,-30px) scale(1.08); }
          100% { transform: translate(-30px,40px) scale(0.95); }
        }

        /* Cover orb + concentric rings */
        .cover-orb {
          position: absolute; left: 50%; top: 50%;
          transform: translate(-50%,-50%);
          width: 1100px; height: 1100px;
          border-radius: 50%;
          background: radial-gradient(circle at 50% 50%, rgba(255,80,100,0.45), rgba(177,30,47,0.25) 35%, rgba(20,5,8,0) 65%);
          filter: blur(40px);
          z-index: 0;
          animation: sl-drift 18s ease-in-out infinite alternate;
        }
        .cover-rings {
          position: absolute; left: 50%; top: 50%;
          width: 900px; height: 900px;
          transform: translate(-50%,-50%);
          z-index: 1;
          opacity: 0.5;
          pointer-events: none;
        }

        /* Promise waveform */
        .promise-wave {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          z-index: 0; opacity: 0.45;
          pointer-events: none;
        }

        /* Spotlight (closing slide) */
        .spotlight {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 60%, rgba(177,30,47,0.35), transparent 55%);
          z-index: 0;
          pointer-events: none;
        }
        .closing-rings {
          position: absolute; left: 50%; top: 50%;
          width: 1100px; height: 1100px;
          transform: translate(-50%,-50%);
          z-index: 0; opacity: 0.4;
          pointer-events: none;
        }

        /* Hero gradient number (slide 8) — display:inline-block helps html2canvas
           apply the text-clip mask reliably; falls back to solid red if not supported. */
        .hero-num {
          display: inline-block;
          color: #B11E2F;
          background: linear-gradient(180deg, #FFFFFF 0%, #FF6478 60%, #B11E2F 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        @supports not ((-webkit-background-clip: text) or (background-clip: text)) {
          .hero-num { color: #B11E2F; -webkit-text-fill-color: #B11E2F; background: none; }
        }

        /* Audience dot grid */
        .dot-grid {
          display: grid;
          grid-template-columns: repeat(40, 1fr);
          gap: 6px;
          width: 100%;
        }
        .dot {
          width: 100%; aspect-ratio: 1;
          border-radius: 50%;
          background: #2A2A2A;
        }
        .dot.pt    { background: #B11E2F; box-shadow: 0 0 6px rgba(177,30,47,0.6); }
        .dot.br    { background: #E8B14E; }
        .dot.other { background: #5A5A5A; }
        .dot.faded { background: #1F1F1F; }

        /* Iso machine (slide 6) */
        .iso-stage {
          position: absolute; inset: 0;
          perspective: 1800px;
          pointer-events: none;
          z-index: 0;
        }
        .iso-world {
          position: absolute; left: 50%; top: 50%;
          transform: translate(-50%,-50%) rotateX(58deg) rotateZ(-32deg);
          transform-style: preserve-3d;
          width: 1200px; height: 1200px;
          opacity: 0.55;
        }
        .iso-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(177,30,47,0.10) 1px, transparent 1px),
            linear-gradient(90deg, rgba(177,30,47,0.10) 1px, transparent 1px);
          background-size: 80px 80px;
          opacity: 0.7;
        }
        .iso-panel {
          position: absolute;
          border: 1px solid rgba(177,30,47,0.5);
          background: rgba(177,30,47,0.06);
          border-radius: 6px;
          box-shadow: 0 0 30px rgba(177,30,47,0.15);
        }
        .iso-flow {
          position: absolute;
          height: 2px;
          background: linear-gradient(90deg, transparent, #B11E2F, transparent);
          box-shadow: 0 0 10px rgba(177,30,47,0.5);
        }
        .iso-pulse {
          position: absolute; width: 12px; height: 12px;
          background: #B11E2F;
          border-radius: 50%;
          box-shadow: 0 0 14px #B11E2F;
          animation: sl-iso-pulse 3s linear infinite;
        }
        @keyframes sl-iso-pulse {
          0%   { opacity: 0; transform: translateX(0); }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(360px); }
        }

        /* Iso veil to keep foreground readable */
        .iso-veil {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.15) 35%, rgba(10,10,10,0.7) 100%);
          z-index: 1;
          pointer-events: none;
        }
        /* Make the iso world more visible — was 0.55 */
        .iso-world { opacity: 0.85 !important; }

        /* Animated chart paths (slide 8) */
        .chart-line { stroke-dasharray: 2000; stroke-dashoffset: 2000; animation: sl-draw 2.5s ease-out forwards; }
        .chart-line.delay-1 { animation-delay: 0.3s; }
        .chart-line.delay-2 { animation-delay: 0.6s; }
        @keyframes sl-draw { to { stroke-dashoffset: 0; } }
        .pulse-dot { animation: sl-pulse-dot 1.6s ease-in-out infinite; }
        @keyframes sl-pulse-dot {
          0%, 100% { r: 5; opacity: 1; }
          50%      { r: 9; opacity: 0.55; }
        }

        /* Receipt graphic (slide 11) */
        .receipt {
          background: #F5F0E6;
          color: #1A1A1A;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          padding: 40px 36px;
          border-radius: 4px;
          position: relative;
          box-shadow: 0 30px 60px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.05);
          transform: rotate(-1.2deg);
        }
        .receipt::before, .receipt::after {
          content: "";
          position: absolute; left: 0; right: 0;
          height: 16px;
          background-image: radial-gradient(circle at 8px 8px, #0A0A0A 6px, transparent 6.5px);
          background-size: 16px 16px;
          background-repeat: repeat-x;
        }
        .receipt::before { top: -8px; }
        .receipt::after  { bottom: -8px; }
        .receipt .r-line { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed rgba(0,0,0,0.18); font-size: 14px; }
        .receipt .r-line.no-b { border: none; }
        .receipt .r-total { display: flex; justify-content: space-between; padding-top: 12px; font-weight: 700; font-size: 16px; }

        /* Slide enter animation */
        .anim-up { animation: sl-up-in 0.9s cubic-bezier(0.2, 0.7, 0.1, 1) both; }
        @keyframes sl-up-in { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }

        /* Cinematic top tag */
        .cin-tag {
          position: absolute; top: 30px; left: 60px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase;
          color: #8A8A8A; z-index: 5;
        }
        .cin-tag .red-dot {
          display: inline-block; width: 6px; height: 6px;
          background: #B11E2F; border-radius: 50%;
          vertical-align: middle; margin-right: 8px;
          animation: sl-blink 1.6s ease-in-out infinite;
        }
        @keyframes sl-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }

        /* Page mark (bottom) */
        .page-mark {
          position: absolute; left: 60px; bottom: 30px;
          font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
          color: #8A8A8A; font-weight: 500; z-index: 5;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
        }
        .page-mark .sl-no { color: #f5f5f5; }
        .top-mark {
          position: absolute; right: 60px; top: 30px;
          font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
          color: #8A8A8A; font-weight: 500; z-index: 5;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
        }
        .top-mark b { color: #f5f5f5; font-weight: 700; }
      `}</style>

      {/* SLIDE 1: COVER — logo + centered subtitle + cinematic orb */}
      <Slide num={1} total={15} hidePageMark decor={
        <>
          <div className="cover-orb" />
          <div className="aurora red"  style={{ left: -200, top: -200, width: 700, height: 700 }} />
          <div className="aurora deep" style={{ right: -150, bottom: -200, width: 700, height: 700 }} />
          <svg className="cover-rings" viewBox="0 0 900 900" fill="none">
            <circle cx="450" cy="450" r="180" stroke="rgba(177,30,47,0.35)" strokeWidth="1" />
            <circle cx="450" cy="450" r="280" stroke="rgba(177,30,47,0.22)" strokeWidth="1" />
            <circle cx="450" cy="450" r="380" stroke="rgba(177,30,47,0.14)" strokeWidth="1" strokeDasharray="4 8" />
            <circle cx="450" cy="450" r="440" stroke="rgba(177,30,47,0.08)" strokeWidth="1" />
          </svg>
          <div className="cin-tag"><span className="red-dot" />Confidencial · 001</div>
        </>
      }>
        <div style={{ ...slideInnerCentered, justifyContent: "space-between", paddingTop: 0, paddingBottom: 0 }}>
          {/* Top spacer for cinematic balance */}
          <div style={{ flex: 1 }} />

          {/* Centered cluster: logo, name, rule, subtitle */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img src={LOGO_B64} alt="Second Layer" style={{ height: 28, opacity: 0.95, marginBottom: 64 }} />
            <h1 style={{ fontSize: 196, fontWeight: 800, margin: 0, lineHeight: 0.96, letterSpacing: "-0.035em", textAlign: "center", color: "#f5f5f5", textShadow: "0 0 60px rgba(0,0,0,0.5)" }}>
              <Editable value={slides.cover.title} onChange={v => updateSlide('cover', 'title', v)} />
            </h1>
            <div style={{ width: 140, height: 5, background: "#B11E2F", margin: "56px auto" }} />
            <p style={{ fontSize: 60, color: "#f5f5f5", margin: 0, textAlign: "center", letterSpacing: "-0.02em", fontWeight: 500 }}>
              <StyledLastWord text={slides.cover.subtitle} italicStyle={{ color: "#B11E2F", fontSize: 72 }} />
            </p>
          </div>

          {/* Bottom mono footer */}
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", width: "100%", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13, letterSpacing: "0.22em", textTransform: "uppercase", color: "#8A8A8A", fontWeight: 500 }}>
            <div>Lisboa · PT</div>
            <div>—</div>
            <div>{new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
      </Slide>

      {/* SLIDE 2: CORE PROMISE — waveform + aurora */}
      <Slide num={2} total={15} decor={
        <>
          <div className="aurora red" style={{ right: -300, top: "30%", width: 900, height: 900 }} />
          <svg className="promise-wave" viewBox="0 0 1920 1080" preserveAspectRatio="none">
            <defs>
              <linearGradient id="wave-grad" x1="0" x2="1">
                <stop offset="0%"   stopColor="#B11E2F" stopOpacity="0" />
                <stop offset="50%"  stopColor="#E0354A" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#B11E2F" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M 0 880 Q 240 820, 480 860 T 960 880 T 1440 860 T 1920 880" fill="none" stroke="url(#wave-grad)" strokeWidth="1.2" />
            <path d="M 0 920 Q 240 880, 480 910 T 960 920 T 1440 910 T 1920 920" fill="none" stroke="url(#wave-grad)" strokeWidth="1" />
            <path d="M 0 960 Q 240 940, 480 950 T 960 960 T 1440 950 T 1920 960" fill="none" stroke="url(#wave-grad)" strokeWidth="0.8" />
          </svg>
          <div className="cin-tag"><span className="red-dot" />Promessa · 02</div>
        </>
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase", marginTop: 30 }}>
            <Editable value={slides.corePromise.eyebrow} onChange={v => updateSlide('corePromise', 'eyebrow', v)} />
          </div>
          <div style={{ height: 60 }} />
          <h1 style={{ fontSize: 124, fontWeight: 800, margin: 0, lineHeight: 0.96, letterSpacing: "-0.035em", color: "#f5f5f5", maxWidth: 1500 }}>
            <StyledKeyword
              text={slides.corePromise.headline}
              keyword={creator?.primaryLanguage === 'en' ? 'business' : 'negócio'}
              italicStyle={{ color: "#B11E2F", fontSize: 124 }}
            />
          </h1>
          <div style={{ marginTop: "auto", paddingTop: 28 }}>
            <div style={{ width: 96, height: 4, background: "#B11E2F", border: "none", marginBottom: 32 }} />
            <p style={{ ...italicSerif, fontSize: 44, color: "#B0B0B0", margin: 0, maxWidth: 1200 }}>
              <Editable value={slides.corePromise.sub} onChange={v => updateSlide('corePromise', 'sub', v)} multiline />
            </p>
          </div>
        </div>
      </Slide>

      {/* SLIDE 3: TRANSFORMATION — bigger text + aurora */}
      <Slide num={3} total={15} decor={
        <div className="aurora red" style={{ right: -200, top: "20%", width: 700, height: 700, opacity: 0.35 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            {creator?.primaryLanguage === 'en' ? 'Diagnosis' : 'Diagnóstico'}
          </div>
          <div style={{ height: 28 }} />
          <h1 style={{ fontSize: 88, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
            <StyledLastWord
              text={slides.transformation.title}
              italicStyle={{ ...italicSerif, color: "#B11E2F", fontSize: 92 }}
            />
          </h1>

          <div style={{ marginTop: 64, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, flex: 1 }}>
            <div style={{ padding: 44, background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 28 }}>
                <Editable value={slides.transformation.beforeLabel} onChange={v => updateSlide('transformation', 'beforeLabel', v)} />
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 26 }}>
                {slides.transformation.before.map((item, i) => (
                  <li key={i} style={{ display: "flex", gap: 16 }}>
                    <span style={{ color: "#8A8A8A", width: 28, flexShrink: 0, fontSize: 22, lineHeight: 1.45 }}>✕</span>
                    <span style={{ fontSize: 28, color: "#D9D9D9", lineHeight: 1.45 }}>
                      <Editable value={item} onChange={v => {
                        const next = [...slides.transformation.before]; next[i] = v;
                        updateSlide('transformation', 'before', next);
                      }} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ padding: 44, background: "linear-gradient(180deg, rgba(177,30,47,0.10), rgba(15,15,15,0.85))", border: "1px solid rgba(177,30,47,0.65)", borderRadius: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 28 }}>
                <Editable value={slides.transformation.afterLabel} onChange={v => updateSlide('transformation', 'afterLabel', v)} />
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 26 }}>
                {slides.transformation.after.map((item, i) => (
                  <li key={i} style={{ display: "flex", gap: 16 }}>
                    <span style={{ color: "#B11E2F", width: 28, flexShrink: 0, fontWeight: 700, fontSize: 22, lineHeight: 1.45 }}>→</span>
                    <span style={{ fontSize: 28, color: "#f5f5f5", lineHeight: 1.45 }}>
                      <Editable value={item} onChange={v => {
                        const next = [...slides.transformation.after]; next[i] = v;
                        updateSlide('transformation', 'after', next);
                      }} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Slide>

      {/* SLIDE 4: WHAT YOU GET — deep aurora */}
      <Slide num={4} total={15} decor={
        <div className="aurora deep" style={{ left: -200, bottom: -150, width: 700, height: 700 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            {creator?.primaryLanguage === 'en' ? 'What you get' : 'O que recebes'}
          </div>
          <div style={{ height: 28 }} />
          <h1 style={{ fontSize: 76, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5", maxWidth: 1500 }}>
            <StyledKeyword
              text={slides.whatYouGet.hero}
              keyword={creator?.primaryLanguage === 'en' ? 'real business' : 'negócio a sério'}
              italicStyle={{ ...italicSerif, color: "#B11E2F" }}
            />
          </h1>

          <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 28, flex: 1 }}>
            {slides.whatYouGet.pillars.map((pillar, i) => (
              <div key={i} style={{ padding: 44, background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 14, display: "flex", flexDirection: "column" }}>
                <div style={{ ...italicSerif, fontSize: 96, color: "#B11E2F", lineHeight: 1, marginBottom: 18 }}>0{i + 1}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
                  {i === 0 ? (creator?.primaryLanguage === 'en' ? 'Community' : 'Comunidade')
                  : i === 1 ? (creator?.primaryLanguage === 'en' ? 'System' : 'Sistema')
                            : (creator?.primaryLanguage === 'en' ? 'Team' : 'Equipa')}
                </div>
                <h3 style={{ fontSize: 38, fontWeight: 700, margin: "0 0 18px", color: "#f5f5f5", lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                  <Editable value={pillar.title} onChange={v => {
                    const next = [...slides.whatYouGet.pillars]; next[i] = { ...pillar, title: v };
                    updateSlide('whatYouGet', 'pillars', next);
                  }} />
                </h3>
                <p style={{ margin: 0, fontSize: 22, color: "#B8B8B8", lineHeight: 1.5 }}>
                  <Editable value={pillar.desc} onChange={v => {
                    const next = [...slides.whatYouGet.pillars]; next[i] = { ...pillar, desc: v };
                    updateSlide('whatYouGet', 'pillars', next);
                  }} multiline />
                </p>
              </div>
            ))}
          </div>
          <p style={{ ...italicSerif, marginTop: 32, fontSize: 24, color: "#A8A8A8" }}>
            <Editable value={slides.whatYouGet.closer} onChange={v => updateSlide('whatYouGet', 'closer', v)} multiline />
          </p>
        </div>
      </Slide>

      {/* SLIDE 5 NEW: A TUA COMUNIDADE — concrete spec */}
      <Slide num={5} total={15} decor={
        <div className="aurora red" style={{ right: -250, top: "20%", width: 700, height: 700, opacity: 0.35 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            {creator?.primaryLanguage === 'en' ? 'The community' : 'A comunidade'}
          </div>
          <div style={{ height: 18 }} />
          <h1 style={{ fontSize: 88, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
            <Editable value={slides.community.title} onChange={v => updateSlide('community', 'title', v)} />
          </h1>
          <p style={{ ...italicSerif, fontSize: 30, color: "#A8A8A8", margin: "18px 0 0", maxWidth: 1200 }}>
            <Editable value={slides.community.subtitle} onChange={v => updateSlide('community', 'subtitle', v)} />
          </p>

          {/* The big spec card */}
          <div style={{ marginTop: 40, padding: 40, background: "rgba(15,15,15,0.85)", border: "1px solid rgba(177,30,47,0.4)", borderRadius: 14, flex: 1, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 36 }}>
            {/* LEFT: name + mechanic + rhythm + bonuses + diff */}
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 6 }}>
                  {creator?.primaryLanguage === 'en' ? 'Community name' : 'Nome'}
                </div>
                <div style={{ ...italicSerif, fontSize: 56, color: "#f5f5f5", lineHeight: 1.0 }}>
                  <Editable value={slides.community.nameCandidate} onChange={v => updateSlide('community', 'nameCandidate', v)} />
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13, color: "#888", marginTop: 6 }}>
                  {creator?.primaryLanguage === 'en' ? 'Platform' : 'Plataforma'}: <Editable value={slides.community.platform} onChange={v => updateSlide('community', 'platform', v)} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 6 }}>
                  {creator?.primaryLanguage === 'en' ? 'Core mechanic' : 'O que acontece dentro'}
                </div>
                <p style={{ margin: 0, fontSize: 22, color: "#D9D9D9", lineHeight: 1.5 }}>
                  <Editable value={slides.community.mechanic} onChange={v => updateSlide('community', 'mechanic', v)} multiline />
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 8 }}>
                    {creator?.primaryLanguage === 'en' ? 'Weekly rhythm' : 'Ritmo semanal'}
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {slides.community.rhythm.map((r, i) => (
                      <li key={i} style={{ fontSize: 16, color: "#D5D5D5", display: "flex", gap: 8 }}>
                        <span style={{ color: "#B11E2F" }}>›</span>
                        <Editable value={r} onChange={v => {
                          const next = [...slides.community.rhythm]; next[i] = v;
                          updateSlide('community', 'rhythm', next);
                        }} />
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1F8A4C", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 8 }}>
                    {creator?.primaryLanguage === 'en' ? 'Bonuses unlocked' : 'Bónus desbloqueados'}
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {slides.community.bonuses.map((b, i) => (
                      <li key={i} style={{ fontSize: 16, color: "#D5D5D5", display: "flex", gap: 8 }}>
                        <span style={{ color: "#1F8A4C" }}>●</span>
                        <Editable value={b} onChange={v => {
                          const next = [...slides.community.bonuses]; next[i] = v;
                          updateSlide('community', 'bonuses', next);
                        }} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* RIGHT: tiers stack */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 4 }}>
                {creator?.primaryLanguage === 'en' ? 'Tiers + pricing' : 'Tiers + preço'}
              </div>
              {slides.community.tiers.map((tier, i) => (
                <div key={i} style={{ padding: "18px 20px", background: i === slides.community.tiers.length - 1 ? "rgba(177,30,47,0.12)" : "rgba(255,255,255,0.03)", border: i === slides.community.tiers.length - 1 ? "1px solid rgba(177,30,47,0.5)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: "#888", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                    <Editable value={tier.name} onChange={v => {
                      const next = [...slides.community.tiers]; next[i] = { ...tier, name: v };
                      updateSlide('community', 'tiers', next);
                    }} />
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#f5f5f5", letterSpacing: "-0.02em", marginTop: 4 }}>
                    <Editable value={tier.price} onChange={v => {
                      const next = [...slides.community.tiers]; next[i] = { ...tier, price: v };
                      updateSlide('community', 'tiers', next);
                    }} />
                  </div>
                  <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>
                    <Editable value={tier.note} onChange={v => {
                      const next = [...slides.community.tiers]; next[i] = { ...tier, note: v };
                      updateSlide('community', 'tiers', next);
                    }} />
                  </div>
                </div>
              ))}

              <div style={{ marginTop: "auto", padding: 18, background: "rgba(31,138,76,0.08)", border: "1px solid rgba(31,138,76,0.3)", borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#1F8A4C", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 6 }}>
                  {creator?.primaryLanguage === 'en' ? 'What makes it different' : 'O diferencial'}
                </div>
                <p style={{ margin: 0, ...italicSerif, fontSize: 20, color: "#f5f5f5", lineHeight: 1.4 }}>
                  <Editable value={slides.community.differentiator} onChange={v => updateSlide('community', 'differentiator', v)} multiline />
                </p>
              </div>
            </div>
          </div>
        </div>
      </Slide>

      {/* SLIDE 6 NEW: O SISTEMA — Unique Mechanism (acronym-style branded method) */}
      <Slide num={6} total={15} decor={
        <div className="aurora deep" style={{ right: -200, top: "30%", width: 700, height: 700, opacity: 0.4 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            {creator?.primaryLanguage === 'en' ? 'The system' : 'O sistema'}
          </div>
          <div style={{ height: 18 }} />
          <h1 style={{ fontSize: 88, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
            <Editable value={slides.system.title} onChange={v => updateSlide('system', 'title', v)} />
          </h1>
          <p style={{ ...italicSerif, fontSize: 28, color: "#A8A8A8", margin: "16px 0 0", maxWidth: 1300 }}>
            <Editable value={slides.system.subtitle} onChange={v => updateSlide('system', 'subtitle', v)} />
          </p>

          {/* Branded acronym name — hero */}
          <div style={{ marginTop: 48, padding: "44px 48px", background: "rgba(15,15,15,0.85)", border: "1px solid rgba(177,30,47,0.5)", borderRadius: 14, textAlign: "center" }}>
            <div style={{ ...italicSerif, fontSize: 88, color: "#f5f5f5", lineHeight: 1.0, letterSpacing: "-0.02em" }}>
              <Editable value={slides.system.name} onChange={v => updateSlide('system', 'name', v)} />
            </div>
          </div>

          {/* Letters grid */}
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: `repeat(${Math.min(slides.system.letters.length, 5)}, 1fr)`, gap: 20, flex: 1 }}>
            {slides.system.letters.map((l, i) => (
              <div key={i} style={{ padding: 28, background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 12, display: "flex", flexDirection: "column" }}>
                <div style={{ ...italicSerif, fontSize: 88, color: "#B11E2F", lineHeight: 1, marginBottom: 14 }}>
                  <Editable value={l.letter} onChange={v => {
                    const next = [...slides.system.letters]; next[i] = { ...l, letter: v };
                    updateSlide('system', 'letters', next);
                  }} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#f5f5f5", letterSpacing: "-0.01em", marginBottom: 10 }}>
                  <Editable value={l.word} onChange={v => {
                    const next = [...slides.system.letters]; next[i] = { ...l, word: v };
                    updateSlide('system', 'letters', next);
                  }} />
                </div>
                <p style={{ margin: 0, fontSize: 16, color: "#B8B8B8", lineHeight: 1.5 }}>
                  <Editable value={l.explanation} onChange={v => {
                    const next = [...slides.system.letters]; next[i] = { ...l, explanation: v };
                    updateSlide('system', 'letters', next);
                  }} multiline />
                </p>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 28, fontSize: 22, color: "#D5D5D5", lineHeight: 1.5, textAlign: "center", maxWidth: 1500, margin: "28px auto 0" }}>
            <Editable value={slides.system.description} onChange={v => updateSlide('system', 'description', v)} multiline />
          </p>
        </div>
      </Slide>

      {/* SLIDE 7 NEW: O VALOR — Hormozi value stack */}
      <Slide num={7} total={15} decor={
        <div className="aurora red" style={{ left: -200, top: -100, width: 700, height: 700, opacity: 0.35 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            {creator?.primaryLanguage === 'en' ? 'The value' : 'O valor'}
          </div>
          <div style={{ height: 18 }} />
          <h1 style={{ fontSize: 88, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
            <Editable value={slides.valueStack.title} onChange={v => updateSlide('valueStack', 'title', v)} />
          </h1>
          <p style={{ ...italicSerif, fontSize: 26, color: "#A8A8A8", margin: "16px 0 0", maxWidth: 1300 }}>
            <Editable value={slides.valueStack.subtitle} onChange={v => updateSlide('valueStack', 'subtitle', v)} />
          </p>

          {/* The stack table */}
          <div style={{ marginTop: 40, background: "rgba(15,15,15,0.85)", border: "1px solid #1F1F1F", borderRadius: 14, overflow: "hidden", flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(177,30,47,0.08)" }}>
                  <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.18em", textTransform: "uppercase", borderBottom: "1px solid #1F1F1F" }}>{creator?.primaryLanguage === 'en' ? 'Problem' : 'Problema'}</th>
                  <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.18em", textTransform: "uppercase", borderBottom: "1px solid #1F1F1F" }}>{creator?.primaryLanguage === 'en' ? 'Solution' : 'Solução'}</th>
                  <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.18em", textTransform: "uppercase", borderBottom: "1px solid #1F1F1F" }}>{creator?.primaryLanguage === 'en' ? 'Delivery' : 'Entrega'}</th>
                  <th style={{ padding: "16px 20px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.18em", textTransform: "uppercase", borderBottom: "1px solid #1F1F1F", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{creator?.primaryLanguage === 'en' ? 'Value' : 'Valor'}</th>
                </tr>
              </thead>
              <tbody>
                {slides.valueStack.items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: i < slides.valueStack.items.length - 1 ? "1px solid #1F1F1F" : "none" }}>
                    <td style={{ padding: "18px 20px", fontSize: 18, color: "#aaa", verticalAlign: "top" }}>
                      <Editable value={it.problem} onChange={v => {
                        const next = [...slides.valueStack.items]; next[i] = { ...it, problem: v };
                        updateSlide('valueStack', 'items', next);
                      }} />
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: 18, fontWeight: 600, color: "#f5f5f5", verticalAlign: "top" }}>
                      <Editable value={it.solution} onChange={v => {
                        const next = [...slides.valueStack.items]; next[i] = { ...it, solution: v };
                        updateSlide('valueStack', 'items', next);
                      }} />
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: 16, color: "#888", verticalAlign: "top", fontStyle: "italic" }}>
                      <Editable value={it.delivery} onChange={v => {
                        const next = [...slides.valueStack.items]; next[i] = { ...it, delivery: v };
                        updateSlide('valueStack', 'items', next);
                      }} />
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: 24, fontWeight: 700, color: "#1F8A4C", textAlign: "right", verticalAlign: "top", fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "-0.02em" }}>
                      <Editable value={it.dollarValue} onChange={v => {
                        const next = [...slides.valueStack.items]; next[i] = { ...it, dollarValue: v };
                        updateSlide('valueStack', 'items', next);
                      }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total + actual price comparison */}
          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ padding: "26px 32px", background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#888", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
                {creator?.primaryLanguage === 'en' ? 'Total stacked value' : 'Valor total empilhado'}
              </div>
              <div style={{ fontSize: 48, fontWeight: 800, color: "#1F8A4C", letterSpacing: "-0.03em", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                <Editable value={slides.valueStack.total} onChange={v => updateSlide('valueStack', 'total', v)} />
              </div>
            </div>
            <div style={{ padding: "26px 32px", background: "rgba(177,30,47,0.08)", border: "1px solid rgba(177,30,47,0.4)", borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
                {creator?.primaryLanguage === 'en' ? 'Actual price' : 'Preço real'}
              </div>
              <div style={{ ...italicSerif, fontSize: 64, color: "#f5f5f5", letterSpacing: "-0.02em", lineHeight: 1 }}>
                <Editable value={slides.valueStack.actualPrice} onChange={v => updateSlide('valueStack', 'actualPrice', v)} />
              </div>
            </div>
          </div>
        </div>
      </Slide>

      {/* SLIDE 8: AUDIENCE — aurora + dot grid */}
      <Slide num={8} total={15} decor={
        <div className="aurora red" style={{ left: -200, top: -100, width: 600, height: 600, opacity: 0.3 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          {/* Top row: eyebrow + headline LEFT, "1 ponto = 1k seguidores" RIGHT */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
                {creator?.primaryLanguage === 'en' ? 'Audit' : 'Auditoria'}
              </div>
              <div style={{ height: 18 }} />
              <h1 style={{ fontSize: 88, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
                <StyledLastWord
                  text={slides.audience.title}
                  italicStyle={{ ...italicSerif, color: "#B11E2F", fontSize: 92 }}
                />
              </h1>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 6 }}>
                {creator?.primaryLanguage === 'en' ? 'Each dot =' : 'Cada ponto ='}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 22, color: "#f5f5f5" }}>1 000 {creator?.primaryLanguage === 'en' ? 'followers' : 'seguidores'}</div>
            </div>
          </div>

          {/* Stat strip — full-width 4-card row */}
          <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
            <div style={{ padding: "28px 32px", background: "rgba(15,15,15,0.78)", border: "1px solid rgba(177,30,47,0.55)", borderRadius: 14, boxShadow: "inset 0 0 0 1px rgba(177,30,47,0.18), 0 0 80px rgba(177,30,47,0.18)" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
                {creator?.primaryLanguage === 'en' ? 'Total audience' : 'Audiência total'}
              </div>
              <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: "#f5f5f5" }}>{formatFollowers(audience)}</div>
            </div>
            <div style={{ padding: "28px 32px", background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
                {creator?.primaryLanguage === 'en' ? 'Platform' : 'Plataforma'}
              </div>
              <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1, color: "#f5f5f5" }}>{creator?.primaryPlatform || 'Instagram'}</div>
            </div>
            <div style={{ padding: "28px 32px", background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>Engagement</div>
              <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: "#f5f5f5" }}>{creator?.engagement || '—'}</div>
            </div>
            <div style={{ padding: "28px 32px", background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
                {creator?.primaryLanguage === 'en' ? 'Niche' : 'Nicho'}
              </div>
              <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, color: "#f5f5f5" }}>{creator?.niche || '—'}</div>
            </div>
          </div>

          {/* Dot grid */}
          <DotGrid audience={audience} />

          {/* Audience estimate split into 4 columns inside the card */}
          {(translatedAudience || creator?.audienceEstimate) && (() => {
            const aud = translatedAudience || creator.audienceEstimate;
            const en = creator?.primaryLanguage === 'en';
            const fields = [
              aud.age      && [en ? 'Age'      : 'Idade',       aud.age],
              aud.gender   && [en ? 'Gender'   : 'Género',      aud.gender],
              aud.location && [en ? 'Location' : 'Localização', aud.location],
              aud.language && [en ? 'Language' : 'Idioma',      aud.language],
            ].filter(Boolean);
            if (fields.length === 0) return null;
            return (
              <div style={{ marginTop: 22, padding: "28px 36px", background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 14, display: "flex", gap: 0 }}>
                {fields.map(([label, val], i) => (
                  <div key={i} style={{ flex: 1, paddingLeft: i === 0 ? 0 : 24, paddingRight: i === fields.length - 1 ? 0 : 24, borderRight: i < fields.length - 1 ? "1px solid #1F1F1F" : "none" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
                    <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", color: "#f5f5f5" }}>{val}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </Slide>

      {/* SLIDE 7: BUILD + OPERATE — iso machine backdrop */}
      <Slide num={9} total={15} decor={
        <>
          <div className="iso-stage">
            <div className="iso-world">
              <div className="iso-grid" />
              <div className="iso-panel" style={{ left: 80,  top: 180, width: 260, height: 160 }} />
              <div className="iso-panel" style={{ left: 420, top: 180, width: 260, height: 160 }} />
              <div className="iso-panel" style={{ left: 760, top: 180, width: 260, height: 160 }} />
              <div className="iso-panel" style={{ left: 250, top: 460, width: 280, height: 200, background: "rgba(177,30,47,0.12)", borderColor: "rgba(177,30,47,0.7)" }} />
              <div className="iso-panel" style={{ left: 600, top: 460, width: 280, height: 200 }} />
              <div className="iso-panel" style={{ left: 350, top: 760, width: 460, height: 140, borderColor: "rgba(31,138,76,0.6)", background: "rgba(31,138,76,0.06)" }} />
              <div className="iso-flow"  style={{ left: 80, top: 360, width: 940 }} />
              <div className="iso-pulse" style={{ left: 80, top: 354 }} />
              <div className="iso-flow"  style={{ left: 350, top: 660, width: 460 }} />
              <div className="iso-pulse" style={{ left: 350, top: 654, animationDelay: "1.2s" }} />
            </div>
          </div>
          <div className="iso-veil" />
        </>
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            {creator?.primaryLanguage === 'en' ? 'How we work' : 'Como trabalhamos'}
          </div>
          <div style={{ height: 28 }} />
          <h1 style={{ fontSize: 76, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
            {creator?.primaryLanguage === 'en' ? <>We build once. <span style={{ ...italicSerif, color: "#B11E2F", fontSize: 80 }}>We operate forever.</span></> : <>Construímos uma vez. <span style={{ ...italicSerif, color: "#B11E2F", fontSize: 80 }}>Operamos para sempre.</span></>}
          </h1>

          <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, flex: 1 }}>
            {/* Box 1: BUILD */}
            <div style={{ padding: 44, background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 14, display: "flex", flexDirection: "column" }}>
              <h2 style={{ fontSize: 34, fontWeight: 700, margin: 0, color: "#f5f5f5", letterSpacing: "-0.01em" }}>
                <Editable value={slides.buildOperate.buildTitle} onChange={v => updateSlide('buildOperate', 'buildTitle', v)} />
              </h2>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginTop: 8, marginBottom: 28 }}>
                <Editable value={slides.buildOperate.buildSub} onChange={v => updateSlide('buildOperate', 'buildSub', v)} />
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                {slides.buildOperate.build.map((item, i) => (
                  <li key={i}>
                    <div style={{ fontSize: 22, fontWeight: 600, color: "#f5f5f5" }}>
                      <Editable value={item.title} onChange={v => {
                        const next = [...slides.buildOperate.build]; next[i] = { ...item, title: v };
                        updateSlide('buildOperate', 'build', next);
                      }} />
                    </div>
                    <div style={{ fontSize: 17, color: "#888", lineHeight: 1.45, marginTop: 2 }}>
                      <Editable value={item.desc} onChange={v => {
                        const next = [...slides.buildOperate.build]; next[i] = { ...item, desc: v };
                        updateSlide('buildOperate', 'build', next);
                      }} multiline />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Box 2: OPERATE */}
            <div style={{ padding: 44, background: "rgba(15,15,15,0.78)", border: "1px solid rgba(31,138,76,0.65)", borderRadius: 14, display: "flex", flexDirection: "column" }}>
              <h2 style={{ fontSize: 34, fontWeight: 700, margin: 0, color: "#f5f5f5", letterSpacing: "-0.01em" }}>
                <Editable value={slides.buildOperate.operateTitle} onChange={v => updateSlide('buildOperate', 'operateTitle', v)} />
              </h2>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1F8A4C", letterSpacing: "0.22em", textTransform: "uppercase", marginTop: 8, marginBottom: 28 }}>
                <Editable value={slides.buildOperate.operateSub} onChange={v => updateSlide('buildOperate', 'operateSub', v)} />
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                {slides.buildOperate.operate.map((item, i) => (
                  <li key={i} style={{ display: "flex", gap: 14 }}>
                    <span style={{ color: "#1F8A4C", width: 28, flexShrink: 0 }}>●</span>
                    <span style={{ fontSize: 22, color: "#D5D5D5", lineHeight: 1.5, flex: 1 }}>
                      <Editable value={item} onChange={v => {
                        const next = [...slides.buildOperate.operate]; next[i] = v;
                        updateSlide('buildOperate', 'operate', next);
                      }} multiline />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p style={{ marginTop: 28, fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em", color: "#f5f5f5" }}>
            <StyledLastWord
              text={slides.buildOperate.closer}
              italicStyle={{ ...italicSerif, color: "#B11E2F", fontSize: 30 }}
            />
          </p>
        </div>
      </Slide>

      {/* SLIDE 8: LAUNCH — phases with assets, aurora */}
      <Slide num={10} total={15} decor={
        <div className="aurora red" style={{ left: "30%", top: -200, width: 700, height: 700, opacity: 0.3 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            {creator?.primaryLanguage === 'en' ? 'Launch plan' : 'Plano de lançamento'}
          </div>
          <div style={{ height: 28 }} />
          <h1 style={{ fontSize: 88, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
            <StyledLastWord
              text={slides.launch.title}
              italicStyle={{ ...italicSerif, color: "#B11E2F", fontSize: 92 }}
            />
          </h1>

          <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, flex: 1 }}>
            {slides.launch.phases.map((phase, i) => (
              <div key={i} style={{ padding: 44, background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 14, position: "relative", display: "flex", flexDirection: "column" }}>
                <div style={{ ...italicSerif, fontSize: 220, color: "#B11E2F", opacity: 0.25, position: "absolute", top: -40, right: 24, lineHeight: 1, pointerEvents: "none" }}>{i + 1}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14, position: "relative" }}>
                  {i === 0 ? (creator?.primaryLanguage === 'en' ? 'Validate' : 'Validar')
                  : i === 1 ? (creator?.primaryLanguage === 'en' ? 'Launch' : 'Lançar')
                            : (creator?.primaryLanguage === 'en' ? 'Scale' : 'Escalar')}
                </div>
                <h3 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 14px", color: "#f5f5f5", lineHeight: 1.15, letterSpacing: "-0.01em", position: "relative" }}>
                  <Editable value={phase.title} onChange={v => {
                    const next = [...slides.launch.phases]; next[i] = { ...phase, title: v };
                    updateSlide('launch', 'phases', next);
                  }} />
                </h3>
                <p style={{ margin: "0 0 28px", fontSize: 19, color: "#B8B8B8", lineHeight: 1.5, position: "relative" }}>
                  <Editable value={phase.desc} onChange={v => {
                    const next = [...slides.launch.phases]; next[i] = { ...phase, desc: v };
                    updateSlide('launch', 'phases', next);
                  }} multiline />
                </p>
                {phase.assets && phase.assets.length > 0 && (
                  <div style={{ marginTop: "auto", position: "relative" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 12 }}>Assets</div>
                    {phase.assets.map((asset, j) => (
                      <div key={j} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                        <span style={{ color: "#B11E2F", fontSize: 14, lineHeight: 1.5, fontWeight: 700 }}>›</span>
                        <span style={{ fontSize: 17, color: "#D5D5D5", lineHeight: 1.5, flex: 1 }}>
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
          <p style={{ ...italicSerif, marginTop: 28, fontSize: 28, color: "#A8A8A8" }}>
            <Editable value={slides.launch.closer} onChange={v => updateSlide('launch', 'closer', v)} multiline />
          </p>
        </div>
      </Slide>

      {/* SLIDE 9: NUMBERS — dual aurora */}
      <Slide num={11} total={15} decor={
        <>
          <div className="aurora red"  style={{ right: 0, top: -200, width: 800, height: 800, opacity: 0.4 }} />
          <div className="aurora deep" style={{ left: -100, bottom: -200, width: 700, height: 700 }} />
        </>
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            {creator?.primaryLanguage === 'en' ? 'Projection' : 'Projecção'}
          </div>
          <div style={{ height: 14 }} />
          <h1 style={{ fontSize: 68, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
            <StyledKeyword
              text={slides.numbers.title}
              keyword={creator?.primaryLanguage === 'en' ? 'numbers' : 'números'}
              italicStyle={{ color: "#B11E2F", fontSize: 76 }}
            />
          </h1>

          {/* Hero MRR — split layout: monthly LEFT, accumulated Year 1 RIGHT */}
          <div style={{ marginTop: 32, padding: "36px 44px", background: "rgba(122,14,24,0.08)", border: "1px solid rgba(122,14,24,0.55)", borderRadius: 14, boxShadow: "inset 0 0 0 1px rgba(177,30,47,0.18), 0 0 80px rgba(177,30,47,0.18)", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 40 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
                <Editable value={slides.numbers.heroLabel} onChange={v => updateSlide('numbers', 'heroLabel', v)} />
              </div>
              <div style={{ lineHeight: 0.9, letterSpacing: "-0.02em" }}>
                <span className="hero-num" style={{ ...italicSerif, fontSize: 124, fontWeight: 400 }}>{formatEuro(moderateSteadyMRR)}</span>
                <span style={{ fontSize: 38, color: "#8A8A8A", fontWeight: 500, marginLeft: 4 }}>/{creator?.primaryLanguage === 'en' ? 'mo' : 'mês'}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 10, whiteSpace: "nowrap" }}>
                {creator?.primaryLanguage === 'en' ? 'Cumulative · Year 1' : 'Receita acumulada · Ano 1'}
              </div>
              <div style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.01em", color: "#f5f5f5" }}>{formatEuro(moderateCumulative)}</div>
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

      {/* SLIDE 10 NEW: CASOS SIMILARES — proof slide */}
      <Slide num={12} total={15} decor={
        <div className="aurora red" style={{ left: "50%", top: -150, width: 700, height: 700, opacity: 0.3, transform: "translateX(-50%)" }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            {creator?.primaryLanguage === 'en' ? 'Proof' : 'Prova'}
          </div>
          <div style={{ height: 18 }} />
          <h1 style={{ fontSize: 88, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
            <Editable value={slides.cases.title} onChange={v => updateSlide('cases', 'title', v)} />
          </h1>
          <p style={{ ...italicSerif, fontSize: 26, color: "#A8A8A8", margin: "18px 0 0", maxWidth: 1300 }}>
            <Editable value={slides.cases.subtitle} onChange={v => updateSlide('cases', 'subtitle', v)} />
          </p>

          <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, flex: 1 }}>
            {slides.cases.items.map((c, i) => (
              <div key={i} style={{ padding: 32, background: "rgba(15,15,15,0.85)", border: "1px solid #1F1F1F", borderRadius: 14, display: "flex", flexDirection: "column" }}>
                <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: "#B11E2F", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>
                  <Editable value={c.niche} onChange={v => {
                    const next = [...slides.cases.items]; next[i] = { ...c, niche: v };
                    updateSlide('cases', 'items', next);
                  }} />
                </div>
                <h3 style={{ fontSize: 32, fontWeight: 700, margin: 0, color: "#f5f5f5", letterSpacing: "-0.02em" }}>
                  <Editable value={c.name} onChange={v => {
                    const next = [...slides.cases.items]; next[i] = { ...c, name: v };
                    updateSlide('cases', 'items', next);
                  }} />
                </h3>
                <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#666", letterSpacing: "0.16em", textTransform: "uppercase" }}>{creator?.primaryLanguage === 'en' ? 'Members' : 'Membros'}</div>
                    <div style={{ fontSize: 20, color: "#f5f5f5", fontWeight: 600 }}>
                      <Editable value={c.members} onChange={v => {
                        const next = [...slides.cases.items]; next[i] = { ...c, members: v };
                        updateSlide('cases', 'items', next);
                      }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#666", letterSpacing: "0.16em", textTransform: "uppercase" }}>{creator?.primaryLanguage === 'en' ? 'Price' : 'Preço'}</div>
                    <div style={{ fontSize: 20, color: "#f5f5f5", fontWeight: 600 }}>
                      <Editable value={c.price} onChange={v => {
                        const next = [...slides.cases.items]; next[i] = { ...c, price: v };
                        updateSlide('cases', 'items', next);
                      }} />
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(177,30,47,0.08)", border: "1px solid rgba(177,30,47,0.25)", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "#B11E2F", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600 }}>MRR</div>
                  <div style={{ fontSize: 22, color: "#f5f5f5", fontWeight: 700, letterSpacing: "-0.02em" }}>
                    <Editable value={c.mrr} onChange={v => {
                      const next = [...slides.cases.items]; next[i] = { ...c, mrr: v };
                      updateSlide('cases', 'items', next);
                    }} />
                  </div>
                </div>
                <p style={{ margin: "16px 0 0", fontSize: 14, color: "#B8B8B8", lineHeight: 1.5 }}>
                  <Editable value={c.resume} onChange={v => {
                    const next = [...slides.cases.items]; next[i] = { ...c, resume: v };
                    updateSlide('cases', 'items', next);
                  }} multiline />
                </p>
                <p style={{ margin: "auto 0 0", paddingTop: 16, fontSize: 13, color: "#1F8A4C", fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 16 }}>
                  → <Editable value={c.why} onChange={v => {
                    const next = [...slides.cases.items]; next[i] = { ...c, why: v };
                    updateSlide('cases', 'items', next);
                  }} multiline />
                </p>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 28, fontSize: 22, color: "#f5f5f5", fontWeight: 600, textAlign: "center" }}>
            <Editable value={slides.cases.closer} onChange={v => updateSlide('cases', 'closer', v)} multiline />
          </p>
        </div>
      </Slide>

      {/* SLIDE 11: PARTNERSHIP — red + green dual aurora */}
      <Slide num={13} total={15} decor={
        <>
          <div className="aurora red"   style={{ left: -200, top: "30%", width: 600, height: 600, opacity: 0.3 }} />
          <div className="aurora green" style={{ right: -200, top: "30%", width: 600, height: 600 }} />
        </>
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            {creator?.primaryLanguage === 'en' ? 'The partnership' : 'A parceria'}
          </div>
          <div style={{ height: 28 }} />
          <h1 style={{ fontSize: 88, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
            <StyledKeyword
              text={slides.partnership.title}
              keyword={creator?.primaryLanguage === 'en' ? 'works' : 'funciona'}
              italicStyle={{ ...italicSerif, color: "#B11E2F" }}
            />
          </h1>

          <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "1fr 80px 1fr", gap: 28, alignItems: "stretch", flex: 1 }}>
            <div style={{ padding: 44, background: "linear-gradient(180deg, rgba(177,30,47,0.10), rgba(15,15,15,0.85))", border: "1px solid rgba(177,30,47,0.65)", borderRadius: 14, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 28 }}>
                <Editable value={slides.partnership.youLabel} onChange={v => updateSlide('partnership', 'youLabel', v)} />
              </div>
              <p style={{ margin: 0, fontSize: 32, color: "#f5f5f5", lineHeight: 1.4, letterSpacing: "-0.01em", fontWeight: 500 }}>
                <Editable value={slides.partnership.you} onChange={v => updateSlide('partnership', 'you', v)} multiline />
              </p>
            </div>

            {/* Center connector — serif "+" */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ ...italicSerif, fontSize: 80, color: "#f5f5f5", lineHeight: 1 }}>+</div>
            </div>

            <div style={{ padding: 44, background: "linear-gradient(180deg, rgba(31,138,76,0.10), rgba(15,15,15,0.85))", border: "1px solid rgba(31,138,76,0.65)", borderRadius: 14, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1F8A4C", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 28 }}>
                <Editable value={slides.partnership.usLabel} onChange={v => updateSlide('partnership', 'usLabel', v)} />
              </div>
              <p style={{ margin: 0, fontSize: 32, color: "#f5f5f5", lineHeight: 1.4, letterSpacing: "-0.01em", fontWeight: 500 }}>
                <Editable value={slides.partnership.us} onChange={v => updateSlide('partnership', 'us', v)} multiline />
              </p>
            </div>
          </div>

          {/* Alignment banner */}
          <div style={{ marginTop: 28, padding: "32px 44px", background: "linear-gradient(90deg, rgba(31,138,76,0.08), rgba(31,138,76,0.18), rgba(31,138,76,0.08))", border: "1px solid rgba(31,138,76,0.65)", borderRadius: 14, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 38, color: "#f5f5f5", fontWeight: 600, letterSpacing: "-0.01em" }}>
              <StyledLastWord
                text={slides.partnership.alignment}
                italicStyle={{ ...italicSerif, color: "#1F8A4C" }}
              />
            </p>
          </div>
        </div>
      </Slide>

      {/* SLIDE 12: RECAP — aurora */}
      <Slide num={14} total={15} decor={
        <div className="aurora red" style={{ right: -200, top: "50%", width: 700, height: 700, opacity: 0.3 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            {creator?.primaryLanguage === 'en' ? 'The transformation' : 'A transformação'}
          </div>
          <div style={{ height: 28 }} />
          <h1 style={{ fontSize: 88, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
            {creator?.primaryLanguage === 'en' ? 'From ' : 'De '}<span style={{ color: "#B11E2F", fontWeight: 800 }}>→</span> <span style={{ ...italicSerif, color: "#f5f5f5" }}>{creator?.primaryLanguage === 'en' ? 'To.' : 'Para.'}</span>
          </h1>

          <div style={{ marginTop: 48 }}>
            {slides.recap.pairs.map((pair, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 1fr 80px 1fr", alignItems: "baseline", padding: "30px 0", borderTop: "1px solid #1F1F1F", borderBottom: i === slides.recap.pairs.length - 1 ? "1px solid #1F1F1F" : "none", gap: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.24em", textTransform: "uppercase" }}>
                  <Editable value={slides.recap.fromLabel} onChange={v => updateSlide('recap', 'fromLabel', v)} />
                </div>
                <div style={{ fontSize: 36, color: "#C9C9C9", fontWeight: 500, letterSpacing: "-0.01em" }}>
                  <Editable value={pair.from} onChange={v => {
                    const next = [...slides.recap.pairs]; next[i] = { ...pair, from: v };
                    updateSlide('recap', 'pairs', next);
                  }} />
                </div>
                <div style={{ ...italicSerif, fontSize: 44, color: "#B11E2F", textAlign: "center" }}>→</div>
                <div style={{ ...italicSerif, fontSize: 48, color: "#f5f5f5", letterSpacing: "-0.005em" }}>
                  <Editable value={pair.to} onChange={v => {
                    const next = [...slides.recap.pairs]; next[i] = { ...pair, to: v };
                    updateSlide('recap', 'pairs', next);
                  }} />
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: "auto", paddingTop: 28, fontSize: 36, color: "#f5f5f5", fontWeight: 400 }}>
            <StyledLastWord
              text={slides.recap.closer}
              italicStyle={{ ...italicSerif, color: "#B11E2F" }}
            />
          </p>
        </div>
      </Slide>

      {/* SLIDE 13 (OPTIONAL): INVESTIMENTO — aurora + receipt */}
      {showInvestimento && (
        <Slide num={15} total={15} decor={
          <>
            <div className="aurora red"  style={{ right: -200, top: -100, width: 700, height: 700, opacity: 0.35 }} />
            <div className="aurora deep" style={{ left: -200, bottom: -100, width: 700, height: 700 }} />
          </>
        }>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
              {creator?.primaryLanguage === 'en' ? 'Investment structure' : 'Estrutura de investimento'}
            </div>
            <div style={{ height: 18 }} />
            <h1 style={{ ...italicSerif, fontSize: 88, margin: 0, lineHeight: 1.0, color: "#B11E2F", marginBottom: 36 }}>
              <Editable value={slides.investment.title} onChange={v => updateSlide('investment', 'title', v)} />
            </h1>
            {/* Side-by-side: stacked pricing cards on LEFT, receipt on RIGHT */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, alignItems: "flex-start", flex: 1 }}>
              {/* LEFT — stacked pricing cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ padding: "32px 36px", background: "rgba(15,15,15,0.78)", border: "1px solid rgba(177,30,47,0.65)", borderRadius: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 12 }}>
                        <Editable value={slides.investment.setupLabel} onChange={v => updateSlide('investment', 'setupLabel', v)} />
                      </div>
                      <div style={{ fontSize: 80, fontWeight: 800, color: "#f5f5f5", lineHeight: 0.95, letterSpacing: "-0.04em" }}>
                        <Editable value={slides.investment.setupAmount} onChange={v => updateSlide('investment', 'setupAmount', v)} />
                      </div>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 14, color: "#8A8A8A", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                      <Editable value={slides.investment.setupNote} onChange={v => updateSlide('investment', 'setupNote', v)} />
                    </div>
                  </div>
                  <p style={{ margin: "18px 0 0", fontSize: 17, color: "#B8B8B8", lineHeight: 1.5 }}>
                    <Editable value={slides.investment.setupDesc} onChange={v => updateSlide('investment', 'setupDesc', v)} multiline />
                  </p>
                </div>
                <div style={{ padding: "32px 36px", background: "rgba(15,15,15,0.78)", border: "1px solid rgba(31,138,76,0.65)", borderRadius: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#1F8A4C", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 12 }}>
                        <Editable value={slides.investment.commissionLabel} onChange={v => updateSlide('investment', 'commissionLabel', v)} />
                      </div>
                      <div style={{ fontSize: 80, fontWeight: 800, color: "#f5f5f5", lineHeight: 0.95, letterSpacing: "-0.04em" }}>
                        <Editable value={slides.investment.commissionAmount} onChange={v => updateSlide('investment', 'commissionAmount', v)} />
                      </div>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 14, color: "#8A8A8A", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                      <Editable value={slides.investment.commissionNote} onChange={v => updateSlide('investment', 'commissionNote', v)} />
                    </div>
                  </div>
                  <p style={{ margin: "18px 0 0", fontSize: 17, color: "#B8B8B8", lineHeight: 1.5 }}>
                    <Editable value={slides.investment.commissionDesc} onChange={v => updateSlide('investment', 'commissionDesc', v)} multiline />
                  </p>
                </div>
              </div>

              {/* RIGHT — receipt */}
              <div style={{ padding: "16px 8px" }}>
                <div className="receipt">
                  <div style={{ textAlign: "center", marginBottom: 22 }}>
                    <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: 32, color: "#B11E2F", lineHeight: 1 }}>SecondLayer</div>
                    <div style={{ fontSize: 11, letterSpacing: "0.32em", marginTop: 8, color: "#555" }}>RECIBO DE PARCERIA · 001</div>
                  </div>
                  {slides.investment.included.map((item, i) => (
                    <div key={i} className={`r-line ${i === slides.investment.included.length - 1 ? 'no-b' : ''}`}>
                      <span>
                        <Editable value={item} onChange={v => {
                          const next = [...slides.investment.included]; next[i] = v;
                          updateSlide('investment', 'included', next);
                        }} />
                      </span>
                      <span>✓</span>
                    </div>
                  ))}
                  <div className="r-total"><span>Setup</span><span>{slides.investment.setupAmount}</span></div>
                  <div className="r-total" style={{ color: "#B11E2F" }}>
                    <span>+ Revenue share</span>
                    <span>{slides.investment.commissionAmount}</span>
                  </div>
                  <div style={{ textAlign: "center", marginTop: 22, fontSize: 11, letterSpacing: "0.32em", color: "#555" }}>— OBRIGADO —</div>
                </div>
              </div>
            </div>
            <p style={{ marginTop: 18, fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", color: "#f5f5f5" }}>
              <StyledLastWord
                text={slides.investment.closer}
                italicStyle={{ ...italicSerif, color: "#B11E2F", fontSize: 24 }}
              />
            </p>
          </div>
        </Slide>
      )}

      {/* SLIDE 12 (LAST): CLOSE — spotlight + concentric rings */}
      <Slide hidePageMark decor={
        <>
          <div className="spotlight" />
          <div className="aurora red" style={{ left: "50%", top: "50%", width: 1100, height: 1100, transform: "translate(-50%,-50%)", opacity: 0.35 }} />
          <svg className="closing-rings" viewBox="0 0 1100 1100" fill="none">
            <circle cx="550" cy="550" r="220" stroke="rgba(177,30,47,0.4)" strokeWidth="1" />
            <circle cx="550" cy="550" r="340" stroke="rgba(177,30,47,0.25)" strokeWidth="1" strokeDasharray="4 8" />
            <circle cx="550" cy="550" r="460" stroke="rgba(177,30,47,0.15)" strokeWidth="1" />
          </svg>
        </>
      }>
        <div style={slideInnerCentered}>
          <h1 style={{ fontSize: 156, fontWeight: 800, margin: 0, lineHeight: 1, letterSpacing: "-0.035em", textAlign: "center", maxWidth: 1700, color: "#f5f5f5" }}>
            <StyledLastWord
              text={slides.close.title}
              italicStyle={{ fontSize: 168, color: "#B11E2F", letterSpacing: "-0.02em" }}
            />
          </h1>
          <div style={{ marginTop: 56, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 14, letterSpacing: "0.32em", textTransform: "uppercase", color: "#8A8A8A" }}>
            SecondLayer · Lisboa · 2026
          </div>
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
  // Auto-populate from parsed offer if available — falls back to placeholders.
  // Self-heal: if creator.offer.raw exists but parsed is empty/missing key fields,
  // re-run parseOutput on the fly. Means stale parses (from older parser versions)
  // refresh themselves on the next pitch view without needing manual re-parse.
  let parsed = creator?.offer?.parsed || {};
  const raw = creator?.offer?.raw;
  const looksEmpty = !parsed.community?.tiers?.length && !parsed.uniqueMechanism?.name && !parsed.valueStack?.items?.length && !parsed.cases?.length;
  if (raw && looksEmpty) {
    try { parsed = parseOutput(raw); } catch {}
  }
  const c = parsed.community || {};
  const cases = parsed.cases || [];
  const um = parsed.uniqueMechanism || {};
  const vs = parsed.valueStack || {};
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
    // Concrete community spec — auto-populated from parsed.community when offer is generated;
    // falls back to placeholders so the deck renders even before the offer exists.
    community: {
      title: t('A Tua Comunidade', 'Your Community'),
      subtitle: t('Aqui está o que vamos construir para ti.', 'Here is what we will build for you.'),
      nameCandidate: c.primaryName || t('[Nome da Comunidade]', '[Community Name]'),
      platform: c.platform || 'Skool',
      mechanic: c.mechanic || t(
        '[1 evento ao vivo/semana + drops semanais + grupo privado para Q&A diário]',
        '[1 live event/week + weekly drops + private feed for daily Q&A]'
      ),
      // Tiers: parsed comes in [recommended, annual-prepay, anchor]; deck renders 3 cards
      // with the LAST one (anchor) highlighted. Default order matches that.
      tiers: c.tiers && c.tiers.length > 0 ? c.tiers : (lang === 'en' ? [
        { name: 'Monthly', price: '€[X]/mo', note: 'Recommended' },
        { name: 'Annual Prepay', price: '€[X]/yr', note: '2 months free' },
        { name: 'Founders Circle', price: '€[X]/mo', note: '1-on-1 + masterclasses' },
      ] : [
        { name: 'Mensal', price: '€[X]/mês', note: 'Recomendado' },
        { name: 'Anual', price: '€[X]/ano', note: '2 meses grátis' },
        { name: 'Founders Circle', price: '€[X]/mês', note: '1-on-1 + masterclasses' },
      ]),
      rhythm: c.weeklyRhythm && c.weeklyRhythm.length > 0 ? c.weeklyRhythm : (lang === 'en' ? [
        '[Mon: weekly drop]', '[Tue: live event 19h]', '[Thu: live Q&A]', '[Fri: community challenge]',
      ] : [
        '[Seg: drop semanal]', '[Ter: evento ao vivo 19h]', '[Qui: live Q&A]', '[Sex: desafio comunitário]',
      ]),
      bonuses: c.bonuses && c.bonuses.length > 0 ? c.bonuses : (lang === 'en' ? [
        '[Month 2: bonus pack]', '[Month 6: 1-on-1 deep dive]', '[Month 12: in-person dinner]',
      ] : [
        '[Mês 2: bonus pack]', '[Mês 6: 1-on-1 profundo]', '[Mês 12: jantar privado]',
      ]),
      differentiator: c.differentiator || t(
        '[O que torna isto diferente — uma frase. Algo que comunidades semelhantes não têm.]',
        '[What makes this different — one sentence. Something similar communities don\'t have.]'
      ),
    },
    // NEW: O Sistema — Unique Mechanism (acronym-style branded method).
    // Auto-populated from parsed.uniqueMechanism.
    system: {
      title: t('O Sistema', 'The System'),
      subtitle: t('O método que vais ensinar à tua comunidade.', 'The method you will teach your community.'),
      name: um.name || t('[The X.Y.Z. Method]', '[The X.Y.Z. Method]'),
      letters: um.letters && um.letters.length > 0 ? um.letters : [
        { letter: 'X', word: t('[Palavra]', '[Word]'), explanation: t('[1 frase]', '[1 sentence]') },
        { letter: 'Y', word: t('[Palavra]', '[Word]'), explanation: t('[1 frase]', '[1 sentence]') },
        { letter: 'Z', word: t('[Palavra]', '[Word]'), explanation: t('[1 frase]', '[1 sentence]') },
      ],
      description: um.description || t(
        '[1 parágrafo a explicar como o sistema funciona como um todo — o que o membro experiencia ao passar por X → Y → Z.]',
        '[1 paragraph explaining how the system works as a whole — what the member experiences moving through X → Y → Z.]'
      ),
    },
    // NEW: O Valor — Value Stack (problems → solutions → € values, Hormozi style).
    // Auto-populated from parsed.valueStack.
    valueStack: {
      title: t('O Valor', 'The Value'),
      subtitle: t('Cada coisa que recebes. Cada coisa tem um valor.', 'Every thing you get. Every thing has a value.'),
      items: vs.items && vs.items.length > 0 ? vs.items : [
        { problem: t('[Problema 1]', '[Problem 1]'), solution: t('[Solução]', '[Solution]'), delivery: t('[Entrega]', '[Delivery]'), dollarValue: '€[X]' },
        { problem: t('[Problema 2]', '[Problem 2]'), solution: t('[Solução]', '[Solution]'), delivery: t('[Entrega]', '[Delivery]'), dollarValue: '€[X]' },
        { problem: t('[Problema 3]', '[Problem 3]'), solution: t('[Solução]', '[Solution]'), delivery: t('[Entrega]', '[Delivery]'), dollarValue: '€[X]' },
        { problem: t('[Problema 4]', '[Problem 4]'), solution: t('[Solução]', '[Solution]'), delivery: t('[Entrega]', '[Delivery]'), dollarValue: '€[X]' },
        { problem: t('[Problema 5]', '[Problem 5]'), solution: t('[Solução]', '[Solution]'), delivery: t('[Entrega]', '[Delivery]'), dollarValue: '€[X]' },
      ],
      total: vs.total || '€[X total]',
      actualPrice: vs.actualPrice || '€[X]/mês',
    },
    audience: {
      title: t('A Tua Audiência', 'Your Audience'),
    },
    // Auto-populated from parsed.cases (3 real Skool/Whop communities the LLM picked from
    // the case-studies skill, niche-matched to this creator). Falls back to placeholders.
    cases: {
      title: t('Casos similares', 'Similar Cases'),
      subtitle: t('Comunidades reais no Skool/Whop com este perfil. Dados públicos.', 'Real Skool/Whop communities with this profile. Public data.'),
      items: cases.length > 0
        ? cases.slice(0, 3).map(cs => ({
            name: cs.name || '[Nome]',
            niche: cs.niche || '[Nicho]',
            members: cs.members || '[X membros]',
            price: cs.price || '€[X]/mês',
            mrr: cs.mrr || '~€[X]K MRR',
            resume: cs.resume || '[1-line resume]',
            why: cs.why || '[Why this matters for the creator]',
          }))
        : [
            { name: '[Nome]', niche: '[Nicho]', members: '[X membros]', price: '€[X]/mês', mrr: '~€[X]K MRR', resume: '[1-line resume]', why: '[Why this matters for the creator]' },
            { name: '[Nome]', niche: '[Nicho]', members: '[X membros]', price: '€[X]/mês', mrr: '~€[X]K MRR', resume: '[1-line resume]', why: '[Why this matters for the creator]' },
            { name: '[Nome]', niche: '[Nicho]', members: '[X membros]', price: '€[X]/mês', mrr: '~€[X]K MRR', resume: '[1-line resume]', why: '[Why this matters for the creator]' },
          ],
      closer: t(
        'O nosso modelo está a fazer isto acontecer noutros nichos hoje. O teu é o próximo.',
        'Our model is making this happen in other niches today. Yours is next.'
      ),
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

function Slide({ children, decor, num, total = 12, hidePageMark }) {
  // Each slide is a fixed 1920×1080 stage. The wrapper scales it to fit viewport
  // via CSS (transform: scale on the inner .slide). PDF export resets the transform
  // and captures at native 1920×1080 — no stretching, no aspect-ratio distortion.
  return (
    <div className="slide-frame">
      <div className="slide" style={{ width: 1920, height: 1080, padding: "80px 100px", display: "flex", flexDirection: "column", boxSizing: "border-box", position: "relative" }}>
        {decor}
        {children}
        {!hidePageMark && num && (
          <>
            <div className="page-mark"><span className="sl-no">{String(num).padStart(2, '0')}</span> &nbsp;/&nbsp; {total}</div>
            <div className="top-mark">Second<b>Layer</b></div>
          </>
        )}
      </div>
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

function DotGrid({ audience }) {
  // Map every ~1k followers to a colored dot. PT majority, BR minority, others.
  const total = 200;
  const k = Math.max(1, Math.round(audience / 1000));
  const ptCount = Math.min(total, Math.round(k * 0.75));
  const brCount = Math.min(total - ptCount, Math.round(k * 0.15));
  const otherCount = Math.min(total - ptCount - brCount, Math.max(0, k - ptCount - brCount));
  const fadedCount = Math.max(0, total - ptCount - brCount - otherCount);
  const cells = [
    ...Array(ptCount).fill('pt'),
    ...Array(brCount).fill('br'),
    ...Array(otherCount).fill('other'),
    ...Array(fadedCount).fill('faded'),
  ];
  // Stable shuffle (deterministic per audience size — avoids hydration mismatch)
  let seed = audience || 1;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return (
    <div style={{ marginTop: 24, padding: "26px 28px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#666", letterSpacing: "0.16em", textTransform: "uppercase" }}>{k} pontos · 1 ponto = 1 000 seguidores</div>
        <div style={{ display: "flex", gap: 18, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaa" }}>
          <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#B11E2F", borderRadius: "50%", marginRight: 6, verticalAlign: "middle" }} />PT 75%</span>
          <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#E8B14E", borderRadius: "50%", marginRight: 6, verticalAlign: "middle" }} />BR 15%</span>
          <span style={{ color: "#666" }}><span style={{ display: "inline-block", width: 8, height: 8, background: "#5A5A5A", borderRadius: "50%", marginRight: 6, verticalAlign: "middle" }} />Outros 10%</span>
        </div>
      </div>
      <div className="dot-grid">
        {cells.map((cls, i) => <div key={i} className={`dot ${cls}`} />)}
      </div>
    </div>
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
const LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAAlCAAAAAAi6fkeAAAAAmJLR0QA/4ePzL8AAAAHdElNRQfqBAUPLQic+FFWAAAMFklEQVRYw9WZa5RVxZXHf1V17u3m0djIw+ahIMjwUERNWhF1RE2MGXVgotEYkYUzLsaMOk5MUNFgcAZxEoKDS8UHiHGJ6FLBKGrQJqCiYAMqKCgSlIciCA1N87qPc6r+8+He7ttgs2Y+gGtmf7nrVu29q/5Vu/brGAAwgmOP67D3q7VA2Q9eE4ebOp7QoWu/kwcNX3zYNTcnAyMX5CQlX0354TlzNx72BSzDazZIqq9k/LRp99gjhqP9PGnl9dUDzhpbJ+lJ3BFYpeyDOHkVNkrbj4R6AJN6U/6ZCICK2jj5JdHhX8OyROE27IdxvOYIAXHcqLiukpS1Nk11oqEc/rs3dNoVwmDMR9JfjxAQY1d6/aloTobVSSfMETitv5O+ag1HCEgERl36oG2msHnrP229ncPvteBCsXS/DYeaNhaDCAIwHLgF0/jXWEwjU2ncGhOBUYdyH3VSKE7tWI3zhx2Gt+dj5nMoIJZQXNOYwLcOsgmGL3BZqTTufKDwqnPB6azKBlOYbNhcOiQTMAql/whDCaU1zQeMNSEU2GjGhEPGxif0M34hh8IR6DLguM7Ubf1snWyw7QPZTGm6VTnUgw2+w2m9KxvWv7+9cCJt0mSy1qdOH3A0AG2/CXk93uiq2lcU99VoyaYJxkGrN70kA65p9iC2ohYzWmG1o+U3Yjn3pV2SJGUXXoCNFtXtWJoqTb+zo+4RnOP4R7+RJNVN7YzF8ciOHbcYrvlUhQtyPK58ooOcroV2Vz02b/59pxWQOKgaPePV15+4uMRw4p1P/3nB/T8qYLU9fjjmDykc7W947oVri/ANlP/kifl/voo5ITxI1CIQyzg1kpeuhtsUdG7xDCzVki4izZU7m9jWV2Mdz0i/ZZKUT7KFxXru9kms65ojcXS6p+GLu3/+mnLnYsHSe0b2g3F/f/Hrer7cgIGhNXrt2otuy2v+sRw9edHGjDSXNFfslaSbcYDF/OJrP2vUmH0//VQajmsJiOU6xcrX/G7M2IfXKBf2dKfr7jg8WgTi+H3wn0aWEQrKvjz+1gc+UV47+5HiKe+vv1yJ5HcUNV2l2CcaVUJi+elGPRJBt32ag8Nww26NBBiZaCzO0nqqchcDnJHVqnYV1/5mjbLJTyx36InfNuSSJRhwnLBAS3sDl2/drYbOmBaAGCq3x37FIADKpiqr0fC0/Ja2RYbU2qBxmIHZWO8MBEjflMupNoqYqfDoJu2bNqzvMY3Hf4fyPtHIRiSWCdJESEcDYl+Ds0xVdjA2cmUr49xbRHSr1e7vETmbYmGiu4Argt9Vxe27quElhbcwOM7eqoVlRJHrnFVYgGnpjTguC7nsyUQuiiKiTT5MgqHK67Lipf6tQrYXzJf/oA3OOQeX+byugZmKM/pk0AHK7lXeJ0VZHPdJL+NMxL9Kk0kzTRpBCijbKj2E6bJG4UpSQGSmBL/KlkX3hDCPK/aeQJmrCeExnOWsPVrfGYeh214f7iRqCUjEvdKaoo9I8ap0P859FMJsLOB4IIRX4Qx5fyYpAJNmpnytZabyYcfxpJwxJSQPK+999kwsOG5RXFeFtRy1wef7wW3ys4kAy/AFD1Wa9GKFWYXri/i9QkMnWCqN6JodQoqyTQXYvbYrOR8HlpO8D4OxtGhaJ5w39FRjXeQM8HHQFMr5N/ndVRig1cagy2Fy0HslkcEh5PsxSxmNI3WANsfTihNt6miM5XSf06+IHMyWboTTEp/p09yvTlK+oVvBHzseDWFvd3pmQqbL8luIDCcmyhyHS70nTScCHJdKm8qB/yFFKT91lnKaQoqqBq/RRDguVPiqDbwbwoPp1ul0Op1Ol6U7bg+6mmeV5PscFBaMtXOVxPojzrjl8l8flYJ2Lyh/MxFvKjzTGBCsSZlBSU6/a/KOrwdtO5prpNkTa4iIGK2whIjbFe/qYgwQMT6EWQWBFoCYFNDr4lunz1vrpbymEDmeCmEhBsf0oMmY8i/ld36x/osirc/m/XieldY2+SfT9Nt6uZIkGQBXKqOJEF2zTW8OIcU5inVRqUaxvKBkX49GyfR6hVp4MsRzVneyBsvzIUzEdG2IdV9ByvC2NOrQQBjwhw/2FgLE1rqkAOQchdzfYGm7JSSDoMNOeTWnoMd5VqHm25m6pU+Dz+lOzKIQZ87+0WNb9MbF4BzTQ9jerhniHplELxUVWE5K8mESrb5QJvkHHNB6s3QeTFCc74sFLL0yyh5f0NBSHPlVRlK8ftGsCVdVvSFNIcLYFUF3UMYwhXewVG6X37+zRPV1DQ/zjPRi0wHfVd24xYiJyoTn6JcPIfvRqjn/3B2wEH0mLaCZX/gXZZpiTsQvlQ/VnB7yerXwsM+WtlZQviFoUWNS8BuFZUUNLbjff5TXupsGtAHgraApRDhuUlhpHbOCriMi+qvC5I5VHYvUqaqqS3tmSi80AVlxYePlWHNKiPU6o5QNd3cBsA4MPbI+zChZlmNmiON+RSlDbdACuDXkfTUWIu4KYQ6crVy4gwgwps0mH+4tIv/2jVRsSZIPOwG4KGUXFIAYOu8K4Qw6bA91HTCWmqAHDzaiZkBsWdfyxsOWtu5z2kNfGTN3i3XOBI+JaF/mzdamG3GBXibauqGQyFoNqfaMgx+YaMkyE8BzPqYGhkhmGQKcbjg2MfNRi3Wn5dSq4P5je5kBnyShorCQ3LY/wQh+3JGXdjhZlsEQnClS+c9GjOzRvP6zXTqd3MxqnFhFJVZZg/cCqxhBs1TeizZoS7bxwdylaOq7dKyWeRoHRlXfM8lC6G5c+BKBTXqN96m65YSiEmGNbdyRcaZzMPrCxQIi9R2YFPYjpsMwO1z8ERF4xfhTzvGRJMnp9GeeerLNAUD6aFhj2WJN71bBzGMfgYpCrIxCu6vZmXWmW4HJWF1aQVZmT8GyIn/Zhfb9X0ecWcn+V/BgGdyWz9YaO1gu5BBWqYfXY2obnEYVIolRrNDkfWJlrDc9feQiZ5LU1LSXIgvBLP6QY0dV8/G7JhDMe+8bTa2MrXMuSrgziRd80ry6sf35/hU+Xdzk6BDV1LLCBDMs2Mg5khNX9ufrdehMgzUmUrhvrGe11BoBUXLcA2bd8IzlAlH7ZaEyO09aJD06yAd3DGkX9PqqT5zeMv6hc/MOQOnePUvUq2c2OE3olfeJ1xnzzzfOtErygA0zjL+vyswMFjDhdhuftHBI8N4nR0+/0KcmH2iij8TZb04Baw38PK/dfeHoOp/ffylAekw8gRRjtF+jAWj13Oq2MFRJfQdSLqJimVb0wGJXhFCoZwyLgkby8CsjlAkvAD2XLGZD0EX811JjDKz0sc82o73ZKS8rq/qZd429f1GszJrEb/73qzAYOtYHhX3dCxZkGa9Y4S8Tb/z1jM3KalohjW/yWvMlxTe0A6rGJ6q/AGsZISXJ8zdfP3Vb7hqcMeWLley/rXenAWM2v9EKY3lIeghg0FrNOApr6OsV+hf92Iokt/gva1qVfamc3po0W0vL2+3O599f+lEhFK3WwTS1544mU2u45HplYj2HA8cM7Q9zGp2qY2xSEprmbHRAHMk++7Pb31N2+fyVkub2L9RQV2+UJOUe64YDQ+WTWUnS5hvAgOHObfrg7jte3FFzHhgc/5TJ1JricuMkLWoP3/9MkjQpIr1S0outCyf7bn3dzua0beeD9J9diOtfP96P7mslPVKISGf4vC5pcvyW6ufqJUmZN4cDjsfq659sDAP/eTvQ75KhPbWxdt6yQk1vQ8V5/VI71yzf09T16DO4a/nOD99VsUFBxyGnVe79fOGGYj+jfWv21zda67CuH7+DQW1+3Dd8/vZWbOj/i71zl1CQrTw4YzSZ/eK4gcem937+UT3Ot7+kcsvb2wDnL3rNrB+QLT3oQNXAnq3iLavWFZS1LSe3p2nalTQ3pvWNDt8d3HdwB/2aQ7UkTVMSZ0sjh6QmNdY047O8Ik1o3oe29mCBkgrnC/IBc0Djp9QsKw2U5jHWgEoMzTtqrjHsOFNkMbYUib4NqMhhVGiGGAtBNjj1/CTtB645oBXWcoPu/zpNUph3BNrQ3ylVnJhufW0mrwuOyBeO74wMfbLrNimvuf/PL8TQW1LQx8eYw/9d4LsF0nVdLt72eOf//feN/waj4NX4IhohZQAAAB50RVh0aWNjOmNvcHlyaWdodABHb29nbGUgSW5jLiAyMDE2rAszOAAAABR0RVh0aWNjOmRlc2NyaXB0aW9uAHNSR0K2kHMHAAAAAElFTkSuQmCC";

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
