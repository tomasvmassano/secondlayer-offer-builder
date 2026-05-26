"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SCENARIOS as SHARED_SCENARIOS, projectGrowth as sharedProjectGrowth, cumulativeRevenue as sharedCumulative, calculateSteadyMRR, calculateOfferRevenue, projectEcosystemRevenue } from "../lib/revenue";
import { parseOutput } from "../lib/offerParser";
import { readClientFacing, legacyParsedToOfferState } from "../lib/offerSchema";
import { pickCases } from "../lib/casesDb";

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

// Translates common PT money-language tokens to EN. Runs at render time over
// LLM-generated price strings so cached PT offers don't bleed into the pitch
// deck when the creator's language is English. Idempotent — calling it on
// already-EN text is a no-op.
//
// Why string-level: the wizard already takes the creator's language as input
// and SHOULD emit the correct currency + units, but legacy offer data
// generated before that prompt fix still lives in Redis. Regenerating CP3/CP4
// for every existing creator is expensive; this hot-fixes the render path.
function localizePriceString(s, lang) {
  if (typeof s !== 'string') return s;
  // PT or unknown → leave PT-formatted source alone.
  if (lang !== 'en' && lang !== 'es') return s;
  let out = s;
  if (lang === 'en') {
    // Currency symbol first — every € becomes $ for an EN creator.
    out = out.replace(/€/g, '$');
    // Unit labels.
    out = out.replace(/\/mês/g, '/mo').replace(/\/m[êe]s/g, '/mo');
    out = out.replace(/\/ano/g, '/yr');
    // Common PT tier names.
    out = out.replace(/\bMensal\b/g, 'Monthly');
    out = out.replace(/\bAnual\b/g, 'Annual');
    out = out.replace(/\bRecomendado\b/g, 'Recommended');
    out = out.replace(/2 meses grátis/gi, '2 months free');
    out = out.replace(/(\d+)\s*meses?\s*gr[áa]tis/gi, '$1 months free');
    out = out.replace(/(\d+)\s*membros?\b/gi, '$1 members');
    // Number formatting: PT uses "." as thousands separator (2.970). Swap to ","
    // for EN. Only inside currency-adjacent numbers to avoid touching counts.
    out = out.replace(/\$(\d{1,3}(?:\.\d{3})+)(?!\d)/g, (m, num) => '$' + num.replace(/\./g, ','));
    return out;
  }
  // lang === 'es' — keep € symbol (Spain uses euros), translate units + tier
  // names from PT to ES. Spain shares "." as thousands separator with PT so
  // no number-format swap is needed.
  out = out.replace(/\/mês/g, '/mes').replace(/\/m[êe]s/g, '/mes');
  out = out.replace(/\/ano/g, '/año');
  out = out.replace(/\bMensal\b/g, 'Mensual');
  out = out.replace(/\bAnual\b/g, 'Anual');
  out = out.replace(/\bRecomendado\b/g, 'Recomendado');
  out = out.replace(/2 meses grátis/gi, '2 meses gratis');
  out = out.replace(/(\d+)\s*meses?\s*gr[áa]tis/gi, '$1 meses gratis');
  out = out.replace(/(\d+)\s*membros?\b/gi, '$1 miembros');
  return out;
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

// EditableLabel — wraps any label/header/eyebrow text in inline editing.
//
// Designed for the dozens of strings that used to be hardcoded via
// pitchLang(en, pt, es) directly inside JSX. Those strings had no operator
// override path — to change "O Método" to "A Receita Lia Faria™" the
// operator had to ask an engineer to update the source code. Now: click
// the text, retype, blur. Persists into creator.pitch.labelOverrides
// keyed by a stable slot ID.
//
// Props:
//   slot     — unique key, e.g. "slide5.title". Stable across creators so
//              the same override doesn't bleed between two creators (it
//              doesn't — every creator has their own pitch state).
//   default  — fallback text shown when no override exists. Usually a
//              pitchLang() call so the language default still works.
//   overrides — the labelOverrides object from slides state. Optional;
//              omitting it shows the default and disables editing.
//   onChange — (slot, newValue) => void. Wired to updateLabel().
//   as       — HTML element to render. Defaults to span so it stays inline.
//              Pass "div", "h1", etc. when the semantic structure matters.
//   style    — inline style merged on top of the editing baseline.
//   multiline — when true, Enter inserts a newline instead of blurring.
//   placeholder — shown grayed when both default and override are empty.
function EditableLabel({
  slot,
  default: defaultValue,
  overrides,
  onChange,
  as = 'span',
  style = {},
  multiline = false,
  placeholder = '',
}) {
  const Tag = as;
  const overrideValue = overrides && overrides[slot] !== undefined ? overrides[slot] : null;
  const display = overrideValue !== null ? overrideValue : (defaultValue || '');
  const isPlaceholder = !display && placeholder;
  const editable = typeof onChange === 'function';
  const handleBlur = (e) => {
    if (!editable) return;
    const next = e.currentTarget.textContent;
    // Trim trailing whitespace only; preserve interior newlines for multiline.
    const trimmed = next.replace(/\s+$/, '');
    // Don't bother persisting when the value matches the default — keeps
    // labelOverrides small + lets a future language switch flip back to
    // the (new-language) default cleanly.
    if (trimmed === (defaultValue || '')) {
      onChange(slot, undefined); // sentinel — clears the override
    } else {
      onChange(slot, trimmed);
    }
  };
  return (
    <Tag
      contentEditable={editable}
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      style={{
        outline: 'none',
        cursor: editable ? 'text' : 'default',
        ...style,
        ...(isPlaceholder ? { color: '#555' } : {}),
      }}
    >
      {display || placeholder}
    </Tag>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN CONTENT
// ─────────────────────────────────────────────────────────────────

function PitchPageContent() {
  const searchParams = useSearchParams();
  const creatorId = searchParams.get('creatorId');

  const [creator, setCreator] = useState(null);
  // pitchLang(en, pt, es) — 3-way string picker. Defaults to EN when ES is
  // missing so Spanish creators get an English deck rather than a Portuguese
  // one (consistent with the rest of the app's ES-fallback strategy).
  // Hoisted alongside the component state so all the slide JSX below can
  // reach it without prop-drilling.
  const pitchLang = (en, pt, es) => {
    const lang = (creator?.primaryLanguage || '').toLowerCase();
    if (lang === 'pt') return pt;
    if (lang === 'es') return es ?? en;
    return en;
  };
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
    const isPT = /\b(feminino|masculino|portuguesa?|outros?|países|portugues|português)\b/.test(sample);
    const isEN = /\b(female|male|portuguese|spanish|other|countries|english)\b/.test(sample);
    // ES heuristic — Castilian audience labels. "Femenino" (no -i-) and
    // "Masculino" plus country/lang variants. "Países" matches PT and ES so
    // we anchor on "hispano" / "España" / "Inglés/Portugués" to disambiguate.
    const isES = /\b(femenino|masculino|inglés|portugués|hispano|hispanohablantes|españa|espa[ñn]oles?)\b/.test(sample);

    const needsTranslation =
      (targetLang === 'pt' && (isEN || isES) && !isPT) ||
      (targetLang === 'en' && (isPT || isES) && !isEN) ||
      (targetLang === 'es' && (isPT || isEN) && !isES);

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

  // ── Offer-aware projection for slide 9 ──
  // Detects the offer's pricing_model (monthly / annual / one_time / hybrid)
  // and dispatches to the right formula. For one-time and hybrid offers the
  // hero swaps from MRR to annual cohort revenue. For all modes the
  // ecosystem comparison band below shows status quo vs with-new-offer.
  const offerForPitch = useMemo(() => {
    const cfo = creator?.offer?.client_facing_output || {};
    return {
      ...cfo,
      target_price: cfo.target_price || (price ? `€${price}/mo` : ''),
      launches_per_year: creator?.revenueLaunches ?? cfo.launches_per_year,
      payment_plan_available: creator?.revenuePaymentPlan ?? cfo.payment_plan_available,
    };
  }, [creator, price]);
  const offerProjection = useMemo(
    () => calculateOfferRevenue({ offer: offerForPitch, creator, scenarioKey: 'moderado', audienceOverride: audience, priceOverride: price ? `€${price}` : undefined }),
    [offerForPitch, creator, audience, price]
  );
  const ecosystemProjection = useMemo(() => {
    const audit = creator?.offer?.internal_metadata?.ecosystem_audit;
    const frame = creator?.offer?.internal_metadata?.strategic_frame;
    if (!audit) return null;
    const existingProducts = [
      ...(audit.ecosystem_map?.products_found || []),
      ...(audit.ecosystem_map?.existing_communities || []).map(c => ({ ...c, tier: c.tier || 'recurring' })),
    ].filter(p => p && p.tier && p.tier !== 'lead_magnet');
    return projectEcosystemRevenue({
      creator: { ...creator, engagement: String(engagement) },
      offer: offerForPitch,
      existingProducts,
      scenarioKey: 'moderado',
      confirmedRole: frame?.confirmed_role,
    });
  }, [creator, offerForPitch, engagement]);

  const updateSlide = (slideKey, field, value) => {
    setSlides(prev => ({ ...prev, [slideKey]: { ...prev[slideKey], [field]: value } }));
  };

  // Edit any label/header/eyebrow text. Persists to creator.pitch via the
  // existing slides state shape (autosaves to the creator record on blur,
  // same as updateSlide). Pass undefined as value to CLEAR an override —
  // the label then falls back to its localised default again. Used by
  // EditableLabel.handleBlur to keep the overrides map small when the
  // operator types the default back in.
  const updateLabel = (slot, value) => {
    setSlides(prev => {
      const current = prev?.labelOverrides || {};
      const next = { ...current };
      if (value === undefined || value === null) {
        delete next[slot];
      } else {
        next[slot] = value;
      }
      return { ...prev, labelOverrides: next };
    });
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
      <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "12px 24px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, minWidth: 0 }}>
          <a href={creatorId ? `/creators/${creatorId}` : "/creators"} style={{ fontSize: 11, color: "#888", textDecoration: "none" }}>← Voltar</a>
          <span style={{ fontSize: 11, color: "#444" }}>|</span>
          <span style={{ fontSize: 11, color: "#aaa", overflow: "hidden", textOverflow: "ellipsis" }}>Pitch: <strong style={{ color: "#f5f5f5" }}>{creator?.name || 'Creator'}</strong></span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#aaa", cursor: "pointer" }}>
            <input type="checkbox" checked={showInvestimento} onChange={(e) => setShowInvestimento(e.target.checked)} />
            Incluir Investimento
          </label>
          {creatorId && (
            <a
              href={`/api/launch-plan/${creatorId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              title="Generate the 8-page Lia-style 60-day launch plan PDF. Send this between calls — auto-populates from Conteúdo Semanal + Biblioteca."
              style={btnLaunchPlan}
            >Plano de Lançamento</a>
          )}
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
        .receipt .r-line { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed rgba(0,0,0,0.45); font-size: 14px; }
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
      <Slide num={1} total={11} hidePageMark decor={
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
            <h1 style={{ fontSize: 140, fontWeight: 800, margin: 0, lineHeight: 0.96, letterSpacing: "-0.035em", textAlign: "center", color: "#f5f5f5", textShadow: "0 0 60px rgba(0,0,0,0.5)" }}>
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
            <div>{new Date().toLocaleDateString(pitchLang('en-US', 'pt-PT', 'es-ES'), { month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
      </Slide>

      {/* SLIDE 2: CORE PROMISE — waveform + aurora */}
      <Slide num={2} total={11} decor={
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
              keyword={pitchLang('business', 'negócio', 'negocio')}
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

      {/* ════════════ SLIDE 3 · MAPA DO ECOSSISTEMA — two variants ════════════
          User asked for 2 fresh designs matching the slide 1/2 aesthetic
          (sparse, big serif, breathing room). Pick a winner, delete the
          other in a follow-up commit.
            3A · O Trio          — Frontend / Novo / Backend triptych
            3B · Lista + Citação — Slim tier list left + big impact quote right
          Both pull from CP1.ecosystem_impact (first bullet → quote) and
          slides.businessContext.products. Prices are <Editable> so the
          operator can correct any misread the audit produced. */}

      {/* SLIDE 3 · MAPA DO ECOSSISTEMA — Lista + Citação (slim tier list + big impact quote) */}
      <Slide num={3} total={11} decor={
        <div className="aurora red" style={{ left: -200, top: "30%", width: 700, height: 700, opacity: 0.28 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            <EditableLabel slot="slide3.eyebrow" default={pitchLang('Ecosystem', 'Ecossistema', 'Ecosistema')} overrides={slides.labelOverrides} onChange={updateLabel} />
          </div>
          <div style={{ height: 18 }} />
          <h1 style={{ fontSize: 72, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
            <StyledLastWord
              text={pitchLang('How this fits', 'Onde isto encaixa', 'Dónde encaja esto')}
              italicStyle={{ ...italicSerif, color: "#B11E2F", fontSize: 76 }}
            />
          </h1>

          <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "0.55fr 1.45fr", gap: 56, flex: 1, alignItems: "center" }}>
            {/* LEFT · slim tier list, sorted by ascending price, NEW highlighted */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {(() => {
                const en = creator?.primaryLanguage === 'en';
                const es = creator?.primaryLanguage === 'es';
                // Build all rungs with a numeric price, then sort ascending so
                // the cascade reads bottom-of-funnel → top-of-ladder. Lead
                // magnets land at the top (price 0). The NEW slots into its
                // real price position, not its tier position — €297 sits
                // between €95 and €4850, not after the high-ticket products.
                const parsePrice = (s) => {
                  if (typeof s === 'number') return s;
                  if (!s) return 0;
                  const m = String(s).match(/(\d[\d.,]*)/);
                  if (!m) return 0;
                  return parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || 0;
                };
                const allRungs = [];
                slides.businessContext.products.forEach((p, ix) => {
                  // Lead magnets always at top (price 0). Non-lead-magnet
                  // items with no parseable price (e.g. "Custom AI Consulting"
                  // service with no listed rate) drop to the BOTTOM via
                  // Infinity — they're not free, the price is just unknown.
                  let priceNum;
                  if (p.tier === 'lead_magnet') {
                    priceNum = 0;
                  } else {
                    const raw = p.price_eur || parsePrice(p.price);
                    priceNum = raw > 0 ? raw : Number.POSITIVE_INFINITY;
                  }
                  allRungs.push({ kind: 'existing', product: p, ix, priceNum });
                });
                const newPriceNum = parsePrice(slides.businessContext.newOfferPrice);
                allRungs.push({ kind: 'new', priceNum: newPriceNum > 0 ? newPriceNum : Number.POSITIVE_INFINITY });
                allRungs.sort((a, b) => a.priceNum - b.priceNum);
                return allRungs.map((r, i) => {
                  if (r.kind === 'new') {
                    return (
                      <div key={`new-${i}`} style={{
                        padding: "16px 20px",
                        background: "linear-gradient(90deg, rgba(177,30,47,0.18), rgba(177,30,47,0.04))",
                        border: "1px solid rgba(177,30,47,0.55)",
                        borderRadius: 10,
                        boxShadow: "0 0 24px rgba(177,30,47,0.15)",
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 6 }}>
                          {en ? '● New' : es ? '● Nuevo' : '● Novo'}
                        </div>
                        <div style={{ ...italicSerif, fontSize: 30, color: "#f5f5f5", lineHeight: 1.05, marginBottom: 6 }}>{slides.businessContext.newOfferName}</div>
                        <div style={{ fontSize: 22, color: "#B11E2F", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700 }}>
                          <Editable
                            value={localizePriceString(slides.businessContext.newOfferPrice, creator?.primaryLanguage)}
                            onChange={v => updateSlide('businessContext', 'newOfferPrice', v)}
                          />
                        </div>
                      </div>
                    );
                  }
                  const p = r.product;
                  const tierLbl = (PITCH_TIER_LABELS[p.tier] || { pt: p.tier, en: p.tier, es: p.tier });
                  const tierTxt = en ? tierLbl.en : es ? (tierLbl.es || tierLbl.en) : tierLbl.pt;
                  const isLeadMagnet = p.tier === 'lead_magnet';
                  // ES uses € (Spain). EN uses $. PT uses €.
                  const cur = en ? '$' : '€';
                  const priceDisplay = isLeadMagnet
                    ? (en ? 'Free' : es ? 'Gratis' : 'Grátis')
                    : (p.price_eur ? cur + p.price_eur : localizePriceString(p.price, creator?.primaryLanguage) || '—');
                  return (
                    <div key={`p-${i}`} style={{ opacity: 0.55 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#8A8A8A", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 4, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                        {tierTxt}
                      </div>
                      <div style={{ ...italicSerif, fontSize: 22, color: "#D9D9D9", lineHeight: 1.1, marginBottom: 4 }}>{p.name}</div>
                      <div style={{ fontSize: 14, color: "#888", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                        <Editable
                          value={priceDisplay}
                          onChange={v => {
                            const next = [...slides.businessContext.products];
                            next[r.ix] = { ...next[r.ix], price: v, price_eur: null };
                            updateSlide('businessContext', 'products', next);
                          }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            {/* RIGHT · big italic-serif quote — visceral impact */}
            <div>
              <p style={{ ...italicSerif, fontSize: 36, color: "#f5f5f5", lineHeight: 1.35, margin: 0 }}>
                "{slides.businessContext.ecosystemImpact[0] || slides.businessContext.roleExplanation}"
              </p>
              {slides.businessContext.ecosystemImpact.length > 1 && (
                <p style={{ ...italicSerif, fontSize: 18, color: "#888", lineHeight: 1.5, margin: "28px 0 0" }}>
                  {slides.businessContext.ecosystemImpact[1]}
                </p>
              )}
            </div>
          </div>
        </div>
      </Slide>

      {/* ════════════ SLIDE 4 · A TUA COMUNIDADE — two variants ════════════
          User direction: "calendar on top slightly bigger, pricing all the
          way right as it was bigger, remove skool badge, community name
          differently, remove yellow and stars, add more serif".
            4A · Calendar Hero    — name top + big calendar + 2-col below
            4B · Asymmetric       — name+mechanic left, pricing right, calendar bottom */}

      {/* SLIDE 4 · A TUA COMUNIDADE — Asymmetric (name+mechanic left, pricing right, calendar bottom) */}
      <Slide num={4} total={11} decor={
        <div className="aurora red" style={{ right: -250, top: "20%", width: 700, height: 700, opacity: 0.28 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            <EditableLabel slot="slide4.eyebrow" default={pitchLang('The community', 'A comunidade', 'La comunidad')} overrides={slides.labelOverrides} onChange={updateLabel} />
          </div>
          <div style={{ height: 22 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 36, alignItems: "start" }}>
            <div>
              <h1 style={{ ...italicSerif, fontSize: 72, fontWeight: 400, margin: 0, lineHeight: 1.0, letterSpacing: "-0.02em", color: "#f5f5f5" }}>
                <Editable value={slides.community.nameCandidate} onChange={v => updateSlide('community', 'nameCandidate', v)} />
              </h1>
              <p style={{ fontSize: 18, color: "#9E9E9E", lineHeight: 1.55, margin: "18px 0 0", maxWidth: 660 }}>
                <Editable value={slides.community.mechanic} onChange={v => updateSlide('community', 'mechanic', v)} multiline />
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(slides.community.tiers || []).slice(0, 3).map((t, i) => (
                <div key={i} style={{ padding: "18px 22px", background: i === 0 ? "linear-gradient(90deg, rgba(177,30,47,0.12), rgba(15,15,15,0.85))" : "rgba(15,15,15,0.6)", border: `1px solid ${i === 0 ? "rgba(177,30,47,0.55)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>{localizePriceString(t.name, creator?.primaryLanguage)}</div>
                  <div style={{ ...italicSerif, fontSize: 32, color: "#f5f5f5", lineHeight: 1, marginBottom: 6 }}>{localizePriceString(t.price, creator?.primaryLanguage)}</div>
                  {t.note && <div style={{ fontSize: 11.5, color: "#888", lineHeight: 1.4 }}>{localizePriceString(t.note, creator?.primaryLanguage)}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Calendar — full-width bottom, slightly smaller */}
          {(() => {
            const en = creator?.primaryLanguage === 'en';
            const es = creator?.primaryLanguage === 'es';
            const days = en
              ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
              : es
              ? ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
              : ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
            const dayBuckets = days.map(d => ({
              day: d,
              events: (slides.system.weeklyFormats || []).filter(w => String(w.day || '').toUpperCase().includes(d.replace('Á', 'A').slice(0, 3))),
            }));
            return (
              <div style={{ marginTop: 38, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, height: 200, flex: 1 }}>
                {dayBuckets.map((bucket, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 12px", background: bucket.events.length > 0 ? "rgba(177,30,47,0.06)" : "rgba(15,15,15,0.5)", border: `1px solid ${bucket.events.length > 0 ? "rgba(177,30,47,0.3)" : "rgba(255,255,255,0.04)"}`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: bucket.events.length > 0 ? "#B11E2F" : "#444", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", textAlign: "center", paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      {bucket.day}
                    </div>
                    {bucket.events.length > 0 ? bucket.events.slice(0, 2).map((ev, j) => (
                      <div key={j}>
                        <div style={{ fontSize: 8, fontWeight: 700, color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 3 }}>{ev.type}</div>
                        <div style={{ ...italicSerif, fontSize: 14, color: "#f5f5f5", lineHeight: 1.2 }}>{ev.name}</div>
                      </div>
                    )) : (
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 12 }}>—</div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </Slide>

      {/* ════════════ SLIDE 5 · O SISTEMA — two variants ════════════
          User: "lacks contrast". Two redesigns trying different heroes.
            5A · Mechanism Hero   — huge acronym center, letter cards below
            5B · Library Hero     — mechanism small as eyebrow, library cards big */}

      {/* SLIDE 5 · O SISTEMA — Mechanism Hero */}
      <Slide num={5} total={11} decor={
        <div className="aurora deep" style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 900, height: 900, opacity: 0.35 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            <EditableLabel slot="slide5.eyebrow" default={pitchLang('The method', 'O método', 'El método')} overrides={slides.labelOverrides} onChange={updateLabel} />
          </div>
          <div style={{ height: 14 }} />
          <h2 style={{ fontSize: 24, fontWeight: 500, color: "#9E9E9E", margin: 0, letterSpacing: "0.02em" }}>
            <EditableLabel slot="slide5.subtitle" default={pitchLang('The method we built for you', 'O método que construímos para ti', 'El método que construimos para ti')} overrides={slides.labelOverrides} onChange={updateLabel} />
          </h2>

          {/* Huge mechanism acronym — center hero */}
          <div style={{ marginTop: 36, textAlign: "center", padding: "20px 0" }}>
            <div style={{ ...italicSerif, fontSize: 140, color: "#f5f5f5", lineHeight: 1, letterSpacing: "-0.01em" }}>
              <Editable value={slides.system.name} onChange={v => updateSlide('system', 'name', v)} />
            </div>
            {slides.system.description && (
              <p style={{ ...italicSerif, fontSize: 22, color: "#888", margin: "20px auto 0", lineHeight: 1.45, maxWidth: 900 }}>
                {slides.system.description}
              </p>
            )}
          </div>

          {/* Per-letter breakdown — clean grid, minimal */}
          {Array.isArray(slides.system.letters) && slides.system.letters.length > 0 && (
            <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: `repeat(${slides.system.letters.length}, 1fr)`, gap: 16, flex: 1, alignItems: "start" }}>
              {slides.system.letters.map((l, i) => (
                <div key={i} style={{ textAlign: "center", padding: "18px 12px", borderTop: "1px solid rgba(177,30,47,0.25)" }}>
                  <div style={{ ...italicSerif, fontSize: 48, color: "#B11E2F", lineHeight: 1, marginBottom: 12 }}>{l.letter}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{l.word}</div>
                  <div style={{ fontSize: 11, color: "#9E9E9E", lineHeight: 1.5 }}>{l.explanation}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Slide>

      {/* SLIDE 6: O VALOR — Hormozi value stack */}
      <Slide num={6} total={11} decor={
        <div className="aurora red" style={{ left: -200, top: -100, width: 700, height: 700, opacity: 0.35 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            <EditableLabel slot="slide6.eyebrow" default={pitchLang('The value', 'O valor', 'El valor')} overrides={slides.labelOverrides} onChange={updateLabel} />
          </div>
          <div style={{ height: 18 }} />
          <h1 style={{ fontSize: 88, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
            <Editable value={slides.valueStack.title} onChange={v => updateSlide('valueStack', 'title', v)} />
          </h1>
          <p style={{ ...italicSerif, fontSize: 26, color: "#A8A8A8", margin: "16px 0 0", maxWidth: 1300 }}>
            <Editable value={slides.valueStack.subtitle} onChange={v => updateSlide('valueStack', 'subtitle', v)} />
          </p>

          {/* The stack table — row padding + font sizes scale down when the
              stack has more than 5 items so the actualPrice block below
              stays visible. Schema caps at 6 items via valueStack validator
              + CP4 prompt, but render is defensive in case legacy data has
              more. */}
          {(() => {
            const items = slides.valueStack.items || [];
            const dense = items.length >= 6;
            const tdBase = {
              padding: dense ? "10px 18px" : "18px 20px",
              verticalAlign: "top",
            };
            const fsProblem  = dense ? 14 : 18;
            const fsSolution = dense ? 14 : 18;
            const fsDelivery = dense ? 13 : 16;
            const fsValue    = dense ? 19 : 24;
            return (
              <div style={{ marginTop: 32, background: "rgba(15,15,15,0.85)", border: "1px solid #1F1F1F", borderRadius: 14, overflow: "hidden", flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(177,30,47,0.08)" }}>
                      <th style={{ padding: "14px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.18em", textTransform: "uppercase", borderBottom: "1px solid #1F1F1F" }}><EditableLabel slot="slide6.col.problem" default={pitchLang('Problem', 'Problema', 'Problema')} overrides={slides.labelOverrides} onChange={updateLabel} /></th>
                      <th style={{ padding: "14px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.18em", textTransform: "uppercase", borderBottom: "1px solid #1F1F1F" }}><EditableLabel slot="slide6.col.solution" default={pitchLang('Solution', 'Solução', 'Solución')} overrides={slides.labelOverrides} onChange={updateLabel} /></th>
                      <th style={{ padding: "14px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.18em", textTransform: "uppercase", borderBottom: "1px solid #1F1F1F" }}><EditableLabel slot="slide6.col.delivery" default={pitchLang('Delivery', 'Entrega', 'Entrega')} overrides={slides.labelOverrides} onChange={updateLabel} /></th>
                      <th style={{ padding: "14px 18px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.18em", textTransform: "uppercase", borderBottom: "1px solid #1F1F1F", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}><EditableLabel slot="slide6.col.value" default={pitchLang('Value', 'Valor', 'Valor')} overrides={slides.labelOverrides} onChange={updateLabel} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} style={{ borderBottom: i < items.length - 1 ? "1px solid #1F1F1F" : "none" }}>
                        <td style={{ ...tdBase, fontSize: fsProblem, color: "#aaa" }}>
                          <Editable value={it.problem} onChange={v => {
                            const next = [...slides.valueStack.items]; next[i] = { ...it, problem: v };
                            updateSlide('valueStack', 'items', next);
                          }} />
                        </td>
                        <td style={{ ...tdBase, fontSize: fsSolution, fontWeight: 600, color: "#f5f5f5" }}>
                          <Editable value={it.solution} onChange={v => {
                            const next = [...slides.valueStack.items]; next[i] = { ...it, solution: v };
                            updateSlide('valueStack', 'items', next);
                          }} />
                        </td>
                        <td style={{ ...tdBase, fontSize: fsDelivery, color: "#888", fontStyle: "italic" }}>
                          <Editable value={it.delivery} onChange={v => {
                            const next = [...slides.valueStack.items]; next[i] = { ...it, delivery: v };
                            updateSlide('valueStack', 'items', next);
                          }} />
                        </td>
                        <td style={{ ...tdBase, fontSize: fsValue, fontWeight: 700, color: "#1F8A4C", textAlign: "right", fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "-0.02em" }}>
                          <Editable value={localizePriceString(it.dollarValue, creator?.primaryLanguage)} onChange={v => {
                            const next = [...slides.valueStack.items]; next[i] = { ...it, dollarValue: v };
                            updateSlide('valueStack', 'items', next);
                          }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Total + actual price comparison */}
          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ padding: "26px 32px", background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#888", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
                <EditableLabel slot="slide6.totalLabel" default={pitchLang('Total stacked value', 'Valor total empilhado', 'Valor total apilado')} overrides={slides.labelOverrides} onChange={updateLabel} />
              </div>
              <div style={{ fontSize: 48, fontWeight: 800, color: "#1F8A4C", letterSpacing: "-0.03em", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                <Editable value={localizePriceString(slides.valueStack.total, creator?.primaryLanguage)} onChange={v => updateSlide('valueStack', 'total', v)} />
              </div>
            </div>
            <div style={{ padding: "26px 32px", background: "rgba(177,30,47,0.08)", border: "1px solid rgba(177,30,47,0.4)", borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
                <EditableLabel slot="slide6.priceLabel" default={pitchLang('Actual price', 'Preço real', 'Precio real')} overrides={slides.labelOverrides} onChange={updateLabel} />
              </div>
              <div style={{ ...italicSerif, fontSize: 64, color: "#f5f5f5", letterSpacing: "-0.02em", lineHeight: 1 }}>
                <Editable value={localizePriceString(slides.valueStack.actualPrice, creator?.primaryLanguage)} onChange={v => updateSlide('valueStack', 'actualPrice', v)} />
              </div>
            </div>
          </div>
        </div>
      </Slide>

      {/* SLIDE 7: AUDIENCE — aurora + dot grid */}
      <Slide num={7} total={11} decor={
        <div className="aurora red" style={{ left: -200, top: -100, width: 600, height: 600, opacity: 0.3 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          {/* Eyebrow + headline */}
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
              <EditableLabel slot="slide7.eyebrow" default={pitchLang('Audit', 'Auditoria', 'Auditoría')} overrides={slides.labelOverrides} onChange={updateLabel} />
            </div>
            <div style={{ height: 18 }} />
            <h1 style={{ fontSize: 78, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
              <StyledLastWord
                text={slides.audience.title}
                italicStyle={{ ...italicSerif, color: "#B11E2F", fontSize: 82 }}
              />
            </h1>
          </div>

          {/* CP1 segment description — strategic header line above the stats.
              Only renders when the wizard's strategic_frame has produced it. */}
          {slides.audience.segmentDescription && (
            <div style={{ marginTop: 20, fontSize: 20, color: "#D9D9D9", lineHeight: 1.5, maxWidth: 920 }}>
              {slides.audience.segmentDescription}
            </div>
          )}

          {/* Stat strip — full-width 4-card row */}
          <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
            <div style={{ padding: "28px 32px", background: "rgba(15,15,15,0.78)", border: "1px solid rgba(177,30,47,0.55)", borderRadius: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
                <EditableLabel slot="slide7.totalAudienceLabel" default={pitchLang('Total audience', 'Audiência total', 'Audiencia total')} overrides={slides.labelOverrides} onChange={updateLabel} />
              </div>
              <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: "#f5f5f5" }}>{formatFollowers(audience)}</div>
            </div>
            <div style={{ padding: "28px 32px", background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
                <EditableLabel slot="slide7.platformLabel" default={pitchLang('Platform', 'Plataforma', 'Plataforma')} overrides={slides.labelOverrides} onChange={updateLabel} />
              </div>
              <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1, color: "#f5f5f5" }}>{creator?.primaryPlatform || 'Instagram'}</div>
            </div>
            <div style={{ padding: "28px 32px", background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>Engagement</div>
              <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: "#f5f5f5" }}>{creator?.engagement || '—'}</div>
            </div>
            <div style={{ padding: "28px 32px", background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
                <EditableLabel slot="slide7.nicheLabel" default={pitchLang('Niche', 'Nicho', 'Nicho')} overrides={slides.labelOverrides} onChange={updateLabel} />
              </div>
              <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, color: "#f5f5f5" }}>{creator?.niche || '—'}</div>
            </div>
          </div>

          {/* Demographics row (age/gender/location/language) removed —
              CP1's audience_segment description above already cites these
              signals in a more strategic frame. Slide was too dense. */}

          {/* Top-performing themes strip — signals "we actually read your feed" */}
          {(() => {
            const posts = creator?.intelligence?.topPosts;
            if (!posts || posts.length === 0) return null;
            // Pick top 3 by engagement rate (parsed as number; falls back to original order).
            const ranked = [...posts]
              .map(p => ({ ...p, _er: parseFloat(String(p.engagementRate || '0').replace(/[^0-9.]/g, '')) || 0 }))
              .sort((a, b) => b._er - a._er)
              .slice(0, 3)
              .filter(p => p.topic);
            if (ranked.length === 0) return null;
            return (
              <div style={{ marginTop: 22, padding: "26px 36px", background: "rgba(15,15,15,0.78)", border: "1px solid rgba(177,30,47,0.4)", borderRadius: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 16 }}>
                  <EditableLabel slot="slide7.themesEyebrow" default={pitchLang('Themes that resonate most', 'Temas que mais ressoam', 'Temas que más resuenan')} overrides={slides.labelOverrides} onChange={updateLabel} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${ranked.length}, 1fr)`, gap: 18 }}>
                  {ranked.map((p, i) => (
                    <div key={i} style={{ padding: "16px 18px", background: "rgba(177,30,47,0.06)", border: "1px solid rgba(177,30,47,0.25)", borderRadius: 10 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                        <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: "#8A8A8A", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                          {p.format || 'Post'}
                        </div>
                        {p._er > 0 && (
                          <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: "#B11E2F", fontWeight: 700 }}>
                            {p._er.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 19, fontWeight: 600, color: "#f5f5f5", lineHeight: 1.3, letterSpacing: "-0.005em" }}>{p.topic}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* CP2 audience_fit — who this is exactly FOR / NOT FOR.
              Renders only when the wizard has produced at least one column.
              Two-column block; preserved-language. */}
          {(slides.audience.audienceForList.length > 0 || slides.audience.audienceNotForList.length > 0) && (
            <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              {slides.audience.audienceForList.length > 0 && (
                <div style={{ padding: "26px 30px", background: "rgba(15,15,15,0.78)", border: "1px solid rgba(177,30,47,0.45)", borderRadius: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
                    <EditableLabel slot="slide7.forLabel" default={pitchLang('For', 'Para quem é', 'Para quién es')} overrides={slides.labelOverrides} onChange={updateLabel} />
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    {slides.audience.audienceForList.map((s, i) => (
                      <li key={i} style={{ display: "flex", gap: 12, fontSize: 17, color: "#D9D9D9", lineHeight: 1.45 }}>
                        <span style={{ color: "#B11E2F", flexShrink: 0, fontWeight: 700 }}>→</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {slides.audience.audienceNotForList.length > 0 && (
                <div style={{ padding: "26px 30px", background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
                    <EditableLabel slot="slide7.notForLabel" default={pitchLang('Not for', 'Não é para', 'No es para')} overrides={slides.labelOverrides} onChange={updateLabel} />
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    {slides.audience.audienceNotForList.map((s, i) => (
                      <li key={i} style={{ display: "flex", gap: 12, fontSize: 17, color: "#9E9E9E", lineHeight: 1.45 }}>
                        <span style={{ color: "#666", flexShrink: 0 }}>✕</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Slide>

      {/* SLIDE 8: LAUNCH — phases with assets, aurora */}
      <Slide num={8} total={11} decor={
        <div className="aurora red" style={{ left: "30%", top: -200, width: 700, height: 700, opacity: 0.3 }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            <EditableLabel slot="slide8.eyebrow" default={pitchLang('Launch plan', 'Plano de lançamento', 'Plan de lanzamiento')} overrides={slides.labelOverrides} onChange={updateLabel} />
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
              <div key={i} style={{ padding: 44, background: "rgba(15,15,15,0.78)", border: "1px solid #1F1F1F", borderRadius: 14, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ ...italicSerif, fontSize: 180, color: "#B11E2F", opacity: 0.22, position: "absolute", top: 12, right: 28, lineHeight: 1, pointerEvents: "none" }}>{i + 1}</div>

                {/* Top row: phase label LEFT + days pill RIGHT (Lia-style) */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, position: "relative", gap: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase" }}>
                    {i === 0 ? <EditableLabel slot="slide8.phase1" default={pitchLang('Validate', 'Validar', 'Validar')} overrides={slides.labelOverrides} onChange={updateLabel} />
                    : i === 1 ? <EditableLabel slot="slide8.phase2" default={pitchLang('Launch', 'Lançar', 'Lanzar')} overrides={slides.labelOverrides} onChange={updateLabel} />
                              : <EditableLabel slot="slide8.phase3" default={pitchLang('Scale', 'Escalar', 'Escalar')} overrides={slides.labelOverrides} onChange={updateLabel} />}
                  </div>
                  {phase.days && (
                    <div style={{ padding: "6px 12px", border: "1px solid rgba(177,30,47,0.6)", background: "rgba(177,30,47,0.10)", borderRadius: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, fontWeight: 700, color: "#f5f5f5", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
                      <Editable value={phase.days} onChange={v => {
                        const next = [...slides.launch.phases]; next[i] = { ...phase, days: v };
                        updateSlide('launch', 'phases', next);
                      }} />
                    </div>
                  )}
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
                  <div style={{ position: "relative", marginBottom: phase.goal ? 18 : 0 }}>
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

                {/* Goal/Meta box at bottom — Lia-style */}
                {phase.goal && (
                  <div style={{ marginTop: "auto", padding: "14px 18px", border: "1px solid rgba(177,30,47,0.55)", background: "rgba(177,30,47,0.08)", borderRadius: 10, position: "relative" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 4 }}>
                      <EditableLabel slot="slide8.goalLabel" default={pitchLang('Goal', 'Meta', 'Meta')} overrides={slides.labelOverrides} onChange={updateLabel} />
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: "#f5f5f5", lineHeight: 1.35 }}>
                      <Editable value={phase.goal} onChange={v => {
                        const next = [...slides.launch.phases]; next[i] = { ...phase, goal: v };
                        updateSlide('launch', 'phases', next);
                      }} />
                    </div>
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
      <Slide num={9} total={11} decor={
        <>
          <div className="aurora red"  style={{ right: 0, top: -200, width: 800, height: 800, opacity: 0.4 }} />
          <div className="aurora deep" style={{ left: -100, bottom: -200, width: 700, height: 700 }} />
        </>
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            <EditableLabel slot="slide9.eyebrow" default={pitchLang('Projection', 'Projecção', 'Proyección')} overrides={slides.labelOverrides} onChange={updateLabel} />
          </div>
          <div style={{ height: 14 }} />
          <h1 style={{ fontSize: 68, fontWeight: 800, margin: 0, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#f5f5f5" }}>
            <StyledKeyword
              text={slides.numbers.title}
              keyword={pitchLang('numbers', 'números', 'números')}
              italicStyle={{ color: "#B11E2F", fontSize: 76 }}
            />
          </h1>

          {/* Hero — mode-aware. Monthly/annual offers show MRR + Year-1
              cumulative. One-time and hybrid offers swap to per-launch
              cohort + annual cohort revenue, since MRR is a meaningless
              metric for a launch-cohort business. */}
          {(() => {
            const mode = offerProjection?.mode || 'recurring';
            if (mode === 'one_time' || mode === 'hybrid') {
              const perLaunch = (offerProjection.firstLaunchBuyers || 0) * (offerProjection.priceNumeric || 0);
              const annual = offerProjection.annualRevenue || 0;
              return (
                <div style={{ marginTop: 32, padding: "36px 44px", background: "rgba(122,14,24,0.08)", border: "1px solid rgba(122,14,24,0.55)", borderRadius: 14, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 40 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
                      <EditableLabel slot="slide9.annualRevenueLabel" default={pitchLang('Annual revenue · moderate', 'Receita anual · cenário moderado', 'Ingresos anuales · escenario moderado')} overrides={slides.labelOverrides} onChange={updateLabel} />
                    </div>
                    <div style={{ lineHeight: 0.9, letterSpacing: "-0.02em" }}>
                      <span style={{ ...italicSerif, fontSize: 124, fontWeight: 400, color: "#B11E2F" }}>{formatEuro(annual)}</span>
                      <span style={{ fontSize: 38, color: "#8A8A8A", fontWeight: 500, marginLeft: 4 }}>/<EditableLabel slot="slide9.yrUnit" default={pitchLang('yr', 'ano', 'año')} overrides={slides.labelOverrides} onChange={updateLabel} /></span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 10, whiteSpace: "nowrap" }}>
                      <EditableLabel slot="slide9.perLaunchLabel" default={pitchLang(`Per launch × ${offerProjection.launchesPerYear}/yr`, `Por lançamento × ${offerProjection.launchesPerYear}/ano`, `Por lanzamiento × ${offerProjection.launchesPerYear}/año`)} overrides={slides.labelOverrides} onChange={updateLabel} />
                    </div>
                    <div style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.01em", color: "#f5f5f5" }}>{formatEuro(perLaunch)}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{offerProjection.firstLaunchBuyers} <EditableLabel slot="slide9.buyersLabel" default={pitchLang('buyers/launch', 'compradores/lançamento', 'compradores/lanzamiento')} overrides={slides.labelOverrides} onChange={updateLabel} /></div>
                  </div>
                </div>
              );
            }
            return (
              <div style={{ marginTop: 32, padding: "36px 44px", background: "rgba(122,14,24,0.08)", border: "1px solid rgba(122,14,24,0.55)", borderRadius: 14, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 40 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 14 }}>
                    <Editable value={slides.numbers.heroLabel} onChange={v => updateSlide('numbers', 'heroLabel', v)} />
                  </div>
                  <div style={{ lineHeight: 0.9, letterSpacing: "-0.02em" }}>
                    <span style={{ ...italicSerif, fontSize: 124, fontWeight: 400, color: "#B11E2F" }}>{formatEuro(moderateSteadyMRR)}</span>
                    <span style={{ fontSize: 38, color: "#8A8A8A", fontWeight: 500, marginLeft: 4 }}>/<EditableLabel slot="slide9.moUnit" default={pitchLang('mo', 'mês', 'mes')} overrides={slides.labelOverrides} onChange={updateLabel} /></span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 10, whiteSpace: "nowrap" }}>
                    <EditableLabel slot="slide9.cumulativeLabel" default={pitchLang('Cumulative · Year 1', 'Receita acumulada · Ano 1', 'Ingresos acumulados · Año 1')} overrides={slides.labelOverrides} onChange={updateLabel} />
                  </div>
                  <div style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.01em", color: "#f5f5f5" }}>{formatEuro(moderateCumulative)}</div>
                </div>
              </div>
            );
          })()}

          {/* Ecosystem comparison band — only renders when audit data exists.
              Pitches the creator on the FULL ecosystem upside, not just the
              new offer in isolation. Shows status quo vs with-new-offer at
              the moderate scenario, both annualised. */}
          {ecosystemProjection && ecosystemProjection.headline.statusQuoAnnual > 0 && (() => {
            const eco = ecosystemProjection;
            return (
              <div style={{ marginTop: 14, padding: "20px 28px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.30)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 28, flex: 1 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#888", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>
                      <EditableLabel slot="slide9.ecosystemTodayLabel" default={pitchLang('Ecosystem today (annual)', 'Ecossistema hoje (anual)', 'Ecosistema hoy (anual)')} overrides={slides.labelOverrides} onChange={updateLabel} />
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: "#888", letterSpacing: "-0.01em" }}>{formatEuro(eco.headline.statusQuoAnnual)}</div>
                  </div>
                  <div style={{ fontSize: 32, color: "#444", fontWeight: 300 }}>→</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#22c55e", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>
                      <EditableLabel slot="slide9.withNewOfferLabel" default={pitchLang('With new offer', 'Com nova oferta', 'Con nueva oferta')} overrides={slides.labelOverrides} onChange={updateLabel} />
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 700, color: "#22c55e", letterSpacing: "-0.01em" }}>{formatEuro(eco.headline.withNewOfferAnnual)}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#22c55e", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>
                    Δ
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: "#22c55e", letterSpacing: "-0.01em" }}>
                    +{formatEuro(eco.headline.deltaAnnual)}
                  </div>
                </div>
              </div>
            );
          })()}

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
                  ) : creator?.primaryLanguage === 'es' ? (
                    <>
                      <div><span style={{ color: "#7A0E18" }}>Nuevos miembros</span> = audiencia × tasa conv. %</div>
                      <div><span style={{ color: "#7A0E18" }}>MRR (mes N)</span> = (miembros × (1 − churn) + nuevos) × precio</div>
                      <div style={{ marginTop: 10, fontSize: 12, color: "#888" }}>El mes de lanzamiento usa una tasa de conversión mayor (efecto waitlist).</div>
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
                  <LabelInput label={<EditableLabel slot="slide9.audienceLabel" default={pitchLang('Audience', 'Audiência', 'Audiencia')} overrides={slides.labelOverrides} onChange={updateLabel} />} value={audience} onChange={setAudience} type="number" />
                  <LabelInput label={<EditableLabel slot="slide9.inputPriceLabel" default={pitchLang('Price (€/mo)', 'Preço (€/mês)', 'Precio (€/mes)')} overrides={slides.labelOverrides} onChange={updateLabel} />} value={price} onChange={setPrice} type="number" />
                  <LabelInput label={<EditableLabel slot="slide9.engagementLabel" default={pitchLang('Engagement rate', 'Taxa de engagement', 'Tasa de engagement')} overrides={slides.labelOverrides} onChange={updateLabel} />} value={engagement} onChange={setEngagement} type="number" step="0.1" suffix="%" />
                  <LabelInput label={<EditableLabel slot="slide9.churnLabel" default={pitchLang('Monthly churn', 'Saídas mensais', 'Churn mensual')} overrides={slides.labelOverrides} onChange={updateLabel} />} value={scenarios.moderado.churn * 100} onChange={v => updateScenarioParam('moderado', 'churn', v / 100)} type="number" step="0.5" suffix="%" />
                </div>
              </div>
            </div>
          </div>

          <p style={{ marginTop: 22, fontSize: 16, color: "#f5f5f5", fontWeight: 700, textAlign: "center" }}>
            <Editable value={slides.numbers.closer} onChange={v => updateSlide('numbers', 'closer', v)} multiline />
          </p>
        </div>
      </Slide>

      {/* SLIDE 10: CASOS SIMILARES — proof slide */}
      <Slide num={10} total={11} decor={
        <div className="aurora red" style={{ left: "50%", top: -150, width: 700, height: 700, opacity: 0.3, transform: "translateX(-50%)" }} />
      }>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
            <EditableLabel slot="slide10.eyebrow" default={pitchLang('Proof', 'Prova', 'Prueba')} overrides={slides.labelOverrides} onChange={updateLabel} />
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
                <h3 style={{ fontSize: 32, fontWeight: 700, margin: 0, color: "#f5f5f5", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1 }}>
                    <Editable value={c.name} onChange={v => {
                      const next = [...slides.cases.items]; next[i] = { ...c, name: v };
                      updateSlide('cases', 'items', next);
                    }} />
                  </span>
                  {/* External link — curated DB ships verifiable URLs to the creator/community's
                      main brand page. Operator can click during the live pitch to demonstrate proof. */}
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 18, color: "#B11E2F", textDecoration: "none", padding: "4px 9px", borderRadius: 6, border: "1px solid rgba(177,30,47,0.4)", background: "rgba(177,30,47,0.06)", lineHeight: 1, flexShrink: 0 }}
                      title={c.url}
                    >
                      ↗
                    </a>
                  )}
                </h3>
                <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#666", letterSpacing: "0.16em", textTransform: "uppercase" }}><EditableLabel slot="slide10.membersLabel" default={pitchLang('Members', 'Membros', 'Miembros')} overrides={slides.labelOverrides} onChange={updateLabel} /></div>
                    <div style={{ fontSize: 20, color: "#f5f5f5", fontWeight: 600 }}>
                      <Editable value={localizePriceString(c.members, creator?.primaryLanguage)} onChange={v => {
                        const next = [...slides.cases.items]; next[i] = { ...c, members: v };
                        updateSlide('cases', 'items', next);
                      }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#666", letterSpacing: "0.16em", textTransform: "uppercase" }}><EditableLabel slot="slide10.priceLabel" default={pitchLang('Price', 'Preço', 'Precio')} overrides={slides.labelOverrides} onChange={updateLabel} /></div>
                    <div style={{ fontSize: 20, color: "#f5f5f5", fontWeight: 600 }}>
                      <Editable value={localizePriceString(c.price, creator?.primaryLanguage)} onChange={v => {
                        const next = [...slides.cases.items]; next[i] = { ...c, price: v };
                        updateSlide('cases', 'items', next);
                      }} />
                    </div>
                  </div>
                </div>
                {/* Revenue block — label adapts to revenue_type so we don't
                    show "MRR" for one-time offers. Falls back to "MRR" if
                    revenue_label is missing (legacy slide state). */}
                <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(177,30,47,0.08)", border: "1px solid rgba(177,30,47,0.25)", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "#B11E2F", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600 }}>
                    {c.revenue_label || 'MRR'}
                  </div>
                  <div style={{ fontSize: 22, color: "#f5f5f5", fontWeight: 700, letterSpacing: "-0.02em" }}>
                    <Editable value={c.revenue_value || c.mrr || '—'} onChange={v => {
                      const next = [...slides.cases.items]; next[i] = { ...c, revenue_value: v };
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

      {/* SLIDE 11 (OPTIONAL): INVESTIMENTO — aurora + receipt */}
      {showInvestimento && (
        <Slide num={11} total={11} decor={
          <>
            <div className="aurora red"  style={{ right: -200, top: -100, width: 700, height: 700, opacity: 0.35 }} />
            <div className="aurora deep" style={{ left: -200, bottom: -100, width: 700, height: 700 }} />
          </>
        }>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#B11E2F", letterSpacing: "0.28em", textTransform: "uppercase" }}>
              <EditableLabel slot="slide11.eyebrow" default={pitchLang('Investment structure', 'Estrutura de investimento', 'Estructura de inversión')} overrides={slides.labelOverrides} onChange={updateLabel} />
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
// PHASE 4 · pitch-deck-only helpers for the Business Context slide
// ─────────────────────────────────────────────────────────────────

// Where does the NEW community sit in the tier ladder? Drives the "slotted-in"
// highlight on the funnel diagram. Falls back to 'recurring' (the default
// shape of a paid community) when neither CP1.confirmed_role nor Phase 1's
// suggested role is present.
function guessNewOfferTier(role, pricingModel) {
  if (role === 'entry_point') return 'low_ticket';
  if (role === 'premium_upsell') return 'high_ticket';
  if (role === 'standalone') return pricingModel === 'one_time' ? 'mid_ticket' : 'recurring';
  // continuity or unknown
  return 'recurring';
}

// Tier rendering — order top-of-funnel to bottom, bilingual labels.
// Anything not in this list falls back to its raw key (defensive).
export const PITCH_TIER_ORDER = ['lead_magnet', 'low_ticket', 'mid_ticket', 'recurring', 'high_ticket', 'service', 'physical_product'];
export const PITCH_TIER_LABELS = {
  lead_magnet:      { pt: 'Lead Magnet · Grátis',    en: 'Lead Magnet · Free',    es: 'Lead Magnet · Gratis' },
  low_ticket:       { pt: 'Low Ticket',              en: 'Low Ticket',            es: 'Low Ticket' },
  mid_ticket:       { pt: 'Mid Ticket',              en: 'Mid Ticket',            es: 'Mid Ticket' },
  recurring:        { pt: 'Recorrente · Mensal',     en: 'Recurring · Monthly',   es: 'Recurrente · Mensual' },
  high_ticket:      { pt: 'High Ticket',             en: 'High Ticket',           es: 'High Ticket' },
  service:          { pt: 'Serviço 1-on-1',          en: '1-on-1 Service',        es: 'Servicio 1-on-1' },
  physical_product: { pt: 'Produto Físico',          en: 'Physical Product',      es: 'Producto Físico' },
};

// Plain-language strategic-role prose. Reuses the high-ticket product name
// + the new community name + price so the slide reads as creator-specific,
// not template-y. Falls back to generic if we don't have enough data.
function buildRoleExplanation({ role, products, communityName, targetPrice, lang }) {
  const en = lang === 'en';
  const cn = communityName || (en ? 'the new community' : 'a nova comunidade');
  // Identify a relevant anchor product for the prose (highest-ticket non-lead-magnet).
  const ordered = [...(products || [])].sort((a, b) => {
    const ai = PITCH_TIER_ORDER.indexOf(a.tier);
    const bi = PITCH_TIER_ORDER.indexOf(b.tier);
    return bi - ai;
  });
  const anchor = ordered.find(p => p.tier !== 'lead_magnet') || ordered[0] || null;
  const leadMagnet = (products || []).find(p => p.tier === 'lead_magnet');

  if (role === 'entry_point') {
    if (en) return `${cn} is the entry point — the cheapest way into your funnel${anchor ? ` and the warm-up that leads buyers to ${anchor.name}` : ''}.`;
    return `${cn} é o ponto de entrada — a porta de acesso mais acessível ao teu funil${anchor ? `, e o aquecimento que conduz compradores até ${anchor.name}` : ''}.`;
  }
  if (role === 'premium_upsell') {
    if (en) return `${cn} is the premium upsell — your highest-ticket offer${anchor ? `, sitting above ${anchor.name} for graduates ready to go deeper` : ''}.`;
    return `${cn} é o upsell premium — a tua oferta mais alta${anchor ? `, acima de ${anchor.name} para graduates prontos para ir mais fundo` : ''}.`;
  }
  if (role === 'standalone') {
    if (en) return `${cn} is a standalone offer — it doesn't sit inside your current funnel, it runs alongside it as its own product line.`;
    return `${cn} é uma oferta autónoma — não encaixa no teu funil atual, opera ao lado dele como linha de produto própria.`;
  }
  // continuity (default)
  if (anchor && leadMagnet) {
    if (en) return `${cn} is the continuity layer — it retains the audience between your free ${leadMagnet.name} and your ${anchor.name}${anchor.price ? ` (${anchor.price})` : ''}, turning one-time buyers into recurring revenue.`;
    return `${cn} é a camada de continuidade — retém a audiência entre o teu ${leadMagnet.name} gratuito e o ${anchor.name}${anchor.price ? ` (${anchor.price})` : ''}, transformando compradores únicos em receita recorrente.`;
  }
  if (anchor) {
    if (en) return `${cn} is the continuity layer that retains buyers between your free content and your ${anchor.name}${anchor.price ? ` (${anchor.price})` : ''}, turning attention into recurring revenue.`;
    return `${cn} é a camada de continuidade que retém compradores entre o teu conteúdo gratuito e o ${anchor.name}${anchor.price ? ` (${anchor.price})` : ''}, transformando atenção em receita recorrente.`;
  }
  if (en) return `${cn} is the continuity layer — recurring revenue that compounds while you keep posting${targetPrice ? ` (${targetPrice})` : ''}.`;
  return `${cn} é a camada de continuidade — receita recorrente que compõe enquanto continuas a publicar${targetPrice ? ` (${targetPrice})` : ''}.`;
}

// Auto-derive weekly_formats from the modules array when CP3 didn't ship them
// (legacy outputs generated before the schema bump). Walks modules in order,
// picks the ones whose format ∈ {live_call, community_ritual} and maps them
// into the day-of-week shape the slide expects. delivery_cadence is parsed
// for day hints if present ("Weekly Tuesday 18:00" → TUE/TER).
function deriveWeeklyFormatsFromModules(modules, lang) {
  if (!Array.isArray(modules) || modules.length === 0) return [];
  const DAY_TOKENS_EN = { mon: 'MON', tue: 'TUE', wed: 'WED', thu: 'THU', fri: 'FRI', sat: 'SAT', sun: 'SUN' };
  const DAY_TOKENS_PT = { mon: 'SEG', tue: 'TER', wed: 'QUA', thu: 'QUI', fri: 'SEX', sat: 'SÁB', sun: 'DOM' };
  const dayMap = lang === 'en' ? DAY_TOKENS_EN : DAY_TOKENS_PT;
  const guessDay = (cadence, idx) => {
    const c = String(cadence || '').toLowerCase();
    for (const [eng, label] of Object.entries(dayMap)) {
      // English (mon/tue/...) AND Portuguese (seg/ter/...) word triggers
      if (c.includes(eng)) return label;
    }
    const ptHints = lang === 'en'
      ? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
      : ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    return Object.values(dayMap)[idx % 7];
  };
  const typeFor = (m) => {
    if (m.format === 'live_call') return lang === 'en' ? 'Live' : 'Live';
    if (m.format === 'community_ritual') return lang === 'en' ? 'Ritual' : 'Ritual';
    return lang === 'en' ? 'Live' : 'Live';
  };
  return modules
    .filter(m => m.format === 'live_call' || m.format === 'community_ritual')
    .slice(0, 5)
    .map((m, i) => ({
      day: guessDay(m.delivery_cadence, i),
      name: m.name,
      type: typeFor(m),
      desc: m.transformation_delivered || m.description || '',
    }));
}

// Auto-derive a credible value_stack from CP3 modules when CP4 (value-stack
// checkpoint) hasn't been run yet. Without this, the pitch slide renders
// literal `[Problema 1]/[Solução]/[Entrega]/€[X]` placeholders that ship to
// the creator in the PDF — looks broken on a creator-facing deck.
//
// Mapping per module:
//   problem      → "Sem X" framing of the module's transformation_delivered
//   solution     → module.name
//   delivery     → friendly label for module.format
//   dollarValue  → a chunk of the total Hormozi 5-10× budget split across
//                  modules. Total budget = recPrice * 8 (mid of the 5-10×
//                  band the CP4 prompt enforces). Each module gets a roughly
//                  equal share, rounded to a clean euro amount.
//
// Returns empty array when modules is empty so the calling code can fall
// through to its own placeholder set (we'd rather show literal placeholders
// than zero rows).
function deriveValueStackFromModules(modules, recPrice, cur, lang) {
  if (!Array.isArray(modules) || modules.length === 0) return [];
  const FORMAT_LABELS_EN = {
    live_call:        'Live coaching',
    recorded_module:  'Recorded module',
    doc:              'Playbook',
    template:         'Template pack',
    community_ritual: 'Community ritual',
  };
  const FORMAT_LABELS_PT = {
    live_call:        'Coaching ao vivo',
    recorded_module:  'Módulo gravado',
    doc:              'Playbook',
    template:         'Pack de templates',
    community_ritual: 'Ritual de comunidade',
  };
  const FORMAT_LABELS_ES = {
    live_call:        'Coaching en vivo',
    recorded_module:  'Módulo grabado',
    doc:              'Playbook',
    template:         'Pack de plantillas',
    community_ritual: 'Ritual de comunidad',
  };
  const labels = lang === 'en' ? FORMAT_LABELS_EN : lang === 'es' ? FORMAT_LABELS_ES : FORMAT_LABELS_PT;
  // Total Hormozi budget. Use 8× actualPrice as a midpoint of the 5-10× band
  // that CP4 enforces. Falls back to a sensible default when recPrice is
  // missing so we never render `€NaN` cells.
  const priceNum = Number(recPrice);
  const totalBudget = Number.isFinite(priceNum) && priceNum > 0 ? priceNum * 8 : 800;
  const items = modules.slice(0, 5);
  // Roughly-equal split, rounded down to the nearest 5 so the values read as
  // intentional ("€95") not algorithmic ("€97.20"). Remainder lands on the
  // last item so the total adds up.
  const baseShare = Math.max(20, Math.floor(totalBudget / items.length / 5) * 5);
  const lastShare = Math.max(baseShare, totalBudget - baseShare * (items.length - 1));
  return items.map((m, i) => {
    const transformation = (m.transformation_delivered || m.description || '').trim();
    // "Sem X" / "Without X" / "Sin X" — frame the problem as the absence of
    // the transformation. Short, declarative, no AI-tells.
    const problemPrefix = lang === 'en' ? 'Without' : lang === 'es' ? 'Sin' : 'Sem';
    const problem = transformation
      ? `${problemPrefix} ${transformation.slice(0, 110).replace(/\.$/, '')}`
      : (lang === 'en' ? 'Missing structure' : lang === 'es' ? 'Falta estructura' : 'Sem estrutura');
    const solution = m.name || (lang === 'en' ? '[Module]' : '[Módulo]');
    const delivery = labels[m.format] || m.format || '';
    const share = i === items.length - 1 ? lastShare : baseShare;
    return {
      problem,
      solution,
      delivery,
      dollarValue: `${cur}${share}`,
    };
  });
}

// Auto-derive library from modules whose format ∈ {recorded_module, doc, template}.
// Same fallback rationale as deriveWeeklyFormatsFromModules.
function deriveLibraryFromModules(modules, lang) {
  if (!Array.isArray(modules) || modules.length === 0) return [];
  const FORMAT_LABELS_EN = { recorded_module: 'Masterclass', doc: 'Playbook', template: 'Template Pack' };
  const FORMAT_LABELS_PT = { recorded_module: 'Masterclass', doc: 'Playbook', template: 'Pack Templates' };
  const labels = lang === 'en' ? FORMAT_LABELS_EN : FORMAT_LABELS_PT;
  return modules
    .filter(m => m.format === 'recorded_module' || m.format === 'doc' || m.format === 'template')
    .slice(0, 6)
    .map(m => ({
      name: m.name,
      format: labels[m.format] || m.format,
      desc: m.transformation_delivered || m.description || '',
    }));
}

// ─────────────────────────────────────────────────────────────────
// DEFAULT SLIDES
// ─────────────────────────────────────────────────────────────────

function buildDefaultSlides(creator) {
  const name = firstName(creator?.name || 'Creator');
  // Build-time language code — 3-way. Helper signature is `t(pt, en, es)` for
  // forward-compatibility. ES strings that aren't supplied fall back to EN so
  // we don't ship empty defaults for Spanish creators.
  const rawLang = (creator?.primaryLanguage || '').toLowerCase();
  const lang = rawLang === 'en' ? 'en' : rawLang === 'es' ? 'es' : 'pt';
  const t = (pt, en, es) => lang === 'en' ? en : lang === 'es' ? (es ?? en) : pt;

  // ── Canonical accessor: every consumer reads from `client_facing_output` ──
  // For legacy creators that only have `offer.parsed` (pre-wizard markdown), the
  // helper derives a client_facing_output on the fly. Self-heal: if the raw
  // markdown exists but the legacy parse is empty/stale, re-parse first then
  // map. This keeps both old + new offer shapes rendering correctly during the
  // transition, and lets `buildDefaultSlides` stay shape-agnostic.
  let parsed = creator?.offer?.parsed || {};
  const raw = creator?.offer?.raw;
  const looksEmpty = !parsed.community?.tiers?.length && !parsed.uniqueMechanism?.name && !parsed.valueStack?.items?.length && !parsed.cases?.length;
  if (raw && looksEmpty) {
    try { parsed = parseOutput(raw); } catch {}
  }
  // Prefer a wizard-written client_facing_output; otherwise derive from parsed.
  const cfo = creator?.offer?.client_facing_output
    || legacyParsedToOfferState(parsed).client_facing_output;

  // Locals kept under their historical names so the rest of the slide builder
  // (200+ lines below) doesn't need to change. They now point at the new
  // canonical fields. Phase 4 will refactor the builder to consume cfo directly.
  const c = {
    primaryName:    cfo.community_name,
    nameCandidates: cfo.name_candidates,
    platform:       cfo.platform,
    mechanic:       cfo.core_mechanic,
    weeklyRhythm:   cfo.weekly_rhythm,
    weeklyFormats:  cfo.weekly_formats,
    library:        cfo.library,
    tiers:          cfo.pricing_tiers,
    bonuses:        cfo.unlocked_bonuses,
    differentiator: cfo.differentiator_section,
  };
  const cases = cfo.cases || [];
  const um = cfo.mechanism || {};
  const vs = cfo.value_stack || {};

  // ── Phase 1-3 + CP1 internal data — the pitch deck draws sparingly from
  // internal_metadata to demonstrate strategic understanding of the creator's
  // existing business. Used by the new Business Context slide (slide 3) and
  // by the audience slide (slide 7). Treat these as operator-curated
  // insertions, not "render everything internal".
  const internalMeta = creator?.offer?.internal_metadata || {};
  const ecosystemMap = internalMeta.ecosystem_audit?.ecosystem_map || null;
  const ecosystemRole = internalMeta.ecosystem_audit?.strategic_role || null;
  const products = Array.isArray(ecosystemMap?.products_found) ? ecosystemMap.products_found : [];
  const hasProducts = products.length > 0;
  const frame = internalMeta.strategic_frame || null;
  const newOfferTier = guessNewOfferTier(frame?.confirmed_role || ecosystemRole, cfo.pricing_model);

  // Plain-language explanations of the strategic role. Drives the prose
  // block on the Business Context slide. We expand role-only generic strings
  // with creator-specific fragments (high-ticket product name, free entry,
  // etc.) so the pitch reads "we know your funnel".
  const roleExplanation = buildRoleExplanation({
    role: frame?.confirmed_role || ecosystemRole,
    products,
    communityName: cfo.community_name,
    targetPrice: cfo.target_price,
    lang,
  });

  // When parsed tiers are missing, derive sensible defaults from the offer's
  // recommended monthly price (extracted by the offer-generation pipeline).
  //   T1 monthly:           €P/mês
  //   T2 annual prepay:     €(P × 10)/ano  (= 2 months free vs 12 × P)
  //   T3 anchor (premium):  €(P × 5)/mês   (1-on-1 + masterclasses)
  // Currency: EN creators get $ + USD; PT creators get € + EUR.
  const cur = lang === 'en' ? '$' : '€';
  const recPrice = Number(creator?.revenuePrice) || null;
  const fallbackTiers = recPrice
    ? (lang === 'en' ? [
        { name: 'Monthly',         price: `${cur}${recPrice}/mo`,         note: 'Recommended' },
        { name: 'Annual Prepay',   price: `${cur}${recPrice * 10}/yr`,    note: '2 months free' },
        { name: 'Founders Circle', price: `${cur}${recPrice * 5}/mo`,     note: '1-on-1 + masterclasses' },
      ] : [
        { name: 'Mensal',          price: `${cur}${recPrice}/mês`,        note: 'Recomendado' },
        { name: 'Anual',           price: `${cur}${recPrice * 10}/ano`,   note: '2 meses grátis' },
        { name: 'Founders Circle', price: `${cur}${recPrice * 5}/mês`,    note: '1-on-1 + masterclasses' },
      ])
    : (lang === 'en' ? [
        { name: 'Monthly',         price: `${cur}[X]/mo`,  note: 'Recommended' },
        { name: 'Annual Prepay',   price: `${cur}[X]/yr`,  note: '2 months free' },
        { name: 'Founders Circle', price: `${cur}[X]/mo`,  note: '1-on-1 + masterclasses' },
      ] : [
        { name: 'Mensal',          price: `${cur}[X]/mês`, note: 'Recomendado' },
        { name: 'Anual',           price: `${cur}[X]/ano`, note: '2 meses grátis' },
        { name: 'Founders Circle', price: `${cur}[X]/mês`, note: '1-on-1 + masterclasses' },
      ]);

  return {
    // labelOverrides — operator-typed overrides for any label/header/eyebrow
    // that defaults to a pitchLang() value. Keyed by slot ID (e.g.
    // "slide5.title"). EditableLabel reads from here; updateLabel() writes.
    // Stays empty by default so the first render uses language defaults.
    labelOverrides: {},
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
    // Slide 3 — Business Context. Replaces the old generic diagnosis slide.
    // Two render variants based on whether the creator has an existing
    // product ecosystem (Phase 1 has products_found or not):
    //   - WARM: existing funnel mapped + the new community slotted in
    //   - COLD: projected funnel with the new community as anchor
    // Driven by Phase 1 ecosystem_audit + CP1 strategic_frame + CP2 pricing.
    businessContext: {
      eyebrow: hasProducts
        ? t('Onde isto encaixa', 'Where this fits')
        : t('Onde isto começa', 'Where this starts'),
      title: hasProducts
        ? t('O Teu Negócio · Hoje', 'Your Business · Today')
        : t('O Teu Negócio · A Construir', 'Your Business · The Foundation'),
      hasProducts,
      products,
      newOfferTier,
      newOfferName: cfo.community_name || (lang === 'en' ? 'New Community' : 'Nova Comunidade'),
      newOfferPrice: cfo.target_price || '—',
      roleExplanation,
      // CP1 ecosystem_impact — 3-5 money-anchored bullets on what the new
      // offer DOES to the creator's existing business. Drives the right
      // column of slide 3 (Mapa do Ecossistema). Empty array if CP1 hasn't
      // run or pre-dates this field (the fallback prose below will fire).
      ecosystemImpact: Array.isArray(frame?.ecosystem_impact) ? frame.ecosystem_impact : [],
      // CP1 differentiation_from_existing — only fires when cannibalization
      // risk was present (an existing community exists at a compatible tier
      // and CP1 had to differentiate). Shown as a separate "Diferenciação"
      // block on slide 3.
      differentiationFromExisting: frame?.differentiation_from_existing || null,
      // Cold-creator framing: a single sentence that ties the new offer to
      // future ecosystem growth. Only used when hasProducts === false.
      coldFraming: lang === 'en'
        ? `You have an audience but nothing for them to buy. The community is the foundation — recurring revenue you can build everything else around.`
        : `Tens audiência mas ainda nada para venderem. A comunidade é o alicerce — receita recorrente em torno da qual vamos construir tudo o resto.`,
    },
    // Old generic transformation slide preserved as a defensive fallback. Not
    // rendered in the current JSX (slide 3 is now businessContext) but the
    // key stays so any external consumer that imported it doesn't explode.
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
      // with the LAST one (anchor) highlighted. When the parser couldn't extract
      // tiers from the offer, `fallbackTiers` synthesises them from creator.revenuePrice.
      tiers: c.tiers && c.tiers.length > 0 ? c.tiers : fallbackTiers,
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
    // O Sistema · Conteúdo Semanal — branded mechanism name + weekly named formats
    // + pre-recorded library. Auto-populated from parsed.community.weeklyFormats
    // and parsed.community.library (the LLM names them from creator niche + top
    // IG posts). Legacy `letters` / `description` fields kept for back-compat.
    system: {
      title: t('O Sistema · Conteúdo Semanal', 'The System · Weekly Content'),
      subtitle: t('O método que a tua comunidade consome todas as semanas.', 'The method your community consumes every week.'),
      // Mechanism name comes from CP4 (value-stack wizard). If CP4 hasn't
      // been run yet, fall back to the community_name so the slide reads
      // "O método que construímos para ti · Lia's Transformation Circle"
      // instead of literal placeholder. Operator can still inline-edit.
      name: um.name || c.primaryName || t('[The X.Y.Z. Method™]', '[The X.Y.Z. Method™]'),
      // Source priority: explicit CP3 weekly_formats/library → derived from
      // CP3 modules (for stale outputs that pre-date the schema bump) →
      // placeholder rows. The derive helpers walk the modules array and pick
      // entries by format. Operator can still edit any row via <Editable>.
      weeklyFormats: (() => {
        if (c.weeklyFormats && c.weeklyFormats.length > 0) return c.weeklyFormats;
        const derived = deriveWeeklyFormatsFromModules(cfo.modules, lang);
        if (derived.length > 0) return derived;
        return lang === 'en' ? [
          { day: 'MON', name: '[Format Name™]', type: 'Post',     desc: '[1-line description of what happens]' },
          { day: 'WED', name: '[Format Name™]', type: 'Live 30m', desc: '[1-line description]' },
          { day: 'SAT', name: '[Format Name™]', type: 'Video',    desc: '[1-line description]' },
          { day: 'SUN', name: '[Format Name™]', type: 'Community',desc: '[1-line description]' },
        ] : [
          { day: 'SEG', name: '[Nome do Formato™]', type: 'Post',         desc: '[1 linha sobre o que acontece]' },
          { day: 'QUA', name: '[Nome do Formato™]', type: 'Live 30min',   desc: '[1 linha]' },
          { day: 'SÁB', name: '[Nome do Formato™]', type: 'Vídeo',        desc: '[1 linha]' },
          { day: 'DOM', name: '[Nome do Formato™]', type: 'Comunidade',   desc: '[1 linha]' },
        ];
      })(),
      library: (() => {
        if (c.library && c.library.length > 0) return c.library;
        const derived = deriveLibraryFromModules(cfo.modules, lang);
        if (derived.length > 0) return derived;
        return lang === 'en' ? [
          { name: '[Module Name™]', format: 'Masterclass',    desc: '[Theme drawn from top post]' },
          { name: '[Module Name™]', format: 'Mini-course',    desc: '[Theme]' },
          { name: '[Module Name™]', format: 'PDF',            desc: '[Theme]' },
          { name: '[Module Name™]', format: 'Calculator',     desc: '[Theme]' },
          { name: '[Module Name™]', format: 'Template Pack',  desc: '[Theme]' },
          { name: '[Module Name™]', format: 'Audio Program',  desc: '[Theme]' },
        ] : [
          { name: '[Nome do Módulo™]', format: 'Masterclass',     desc: '[Tema vindo de um post de topo]' },
          { name: '[Nome do Módulo™]', format: 'Mini-curso',      desc: '[Tema]' },
          { name: '[Nome do Módulo™]', format: 'PDF',             desc: '[Tema]' },
          { name: '[Nome do Módulo™]', format: 'Calculadora',     desc: '[Tema]' },
          { name: '[Nome do Módulo™]', format: 'Pack Templates',  desc: '[Tema]' },
          { name: '[Nome do Módulo™]', format: 'Programa Áudio',  desc: '[Tema]' },
        ];
      })(),
      // Legacy fields — preserved so older offers still render if loaded into the new slide.
      letters: um.letters && um.letters.length > 0 ? um.letters : [],
      description: um.description || '',
    },
    // NEW: O Valor — Value Stack (problems → solutions → € values, Hormozi style).
    // Source priority:
    //   1. CP4 value_stack.items (the wizard's authoritative output)
    //   2. Derived from CP3 modules (so the slide isn't literal placeholders
    //      before CP4 runs — derive a credible stack from the modules that
    //      already exist)
    //   3. Hard-coded placeholder rows (only when CP3 also empty)
    // Same fallback ladder applies to .total.
    valueStack: (() => {
      const derived = deriveValueStackFromModules(cfo.modules, recPrice, cur, lang);
      const items = vs.items && vs.items.length > 0
        ? vs.items
        : derived.length > 0
          ? derived
          : [
              { problem: t('[Problema 1]', '[Problem 1]'), solution: t('[Solução]', '[Solution]'), delivery: t('[Entrega]', '[Delivery]'), dollarValue: `${cur}[X]` },
              { problem: t('[Problema 2]', '[Problem 2]'), solution: t('[Solução]', '[Solution]'), delivery: t('[Entrega]', '[Delivery]'), dollarValue: `${cur}[X]` },
              { problem: t('[Problema 3]', '[Problem 3]'), solution: t('[Solução]', '[Solution]'), delivery: t('[Entrega]', '[Delivery]'), dollarValue: `${cur}[X]` },
              { problem: t('[Problema 4]', '[Problem 4]'), solution: t('[Solução]', '[Solution]'), delivery: t('[Entrega]', '[Delivery]'), dollarValue: `${cur}[X]` },
              { problem: t('[Problema 5]', '[Problem 5]'), solution: t('[Solução]', '[Solution]'), delivery: t('[Entrega]', '[Delivery]'), dollarValue: `${cur}[X]` },
            ];
      // total: prefer CP4's value, else sum up the derived items, else placeholder.
      let total = vs.total;
      if (!total && derived.length > 0) {
        const sum = derived.reduce((acc, it) => {
          const n = parseFloat(String(it.dollarValue || '').replace(/[^0-9.]/g, ''));
          return acc + (Number.isFinite(n) ? n : 0);
        }, 0);
        if (sum > 0) total = `${cur}${sum.toLocaleString(lang === 'en' ? 'en-US' : 'pt-PT')}`;
      }
      if (!total) total = `${cur}[X ${t('total', 'total')}]`;
      // Preço Real follows the offer page: creator.revenuePrice is the single
      // source of truth set on the offer tab. Falls back to the LLM-parsed
      // value then to a placeholder.
      const actualPrice = recPrice
        ? (lang === 'en' ? `${cur}${recPrice}/mo` : `${cur}${recPrice}/mês`)
        : (vs.actualPrice || (lang === 'en' ? `${cur}[X]/mo` : `${cur}[X]/mês`));
      return {
        title: t('O Valor', 'The Value'),
        subtitle: t('Cada coisa que recebes. Cada coisa tem um valor.', 'Every thing you get. Every thing has a value.'),
        items,
        total,
        actualPrice,
      };
    })(),
    // Slide 7 — Audience. The existing rendering kept (stat strip + theme
    // strip), and now augmented with the wizard's audience-fit data when
    // available: CP1 audience_segment (description + demographics_anchor)
    // and CP2 audience_fit ({ for: [...], not_for: [...] }).
    audience: {
      title: t('A Tua Audiência', 'Your Audience'),
      // The 1-sentence "who exactly this is for" line from CP1. Renders as
      // a strategic header above the existing stat strip when present.
      segmentDescription: frame?.audience_segment?.description || null,
      // 3-6 for / 2-5 not_for from CP2. Rendered as two-column block under
      // the existing stat strip. Hidden when both arrays empty.
      audienceForList:    Array.isArray(cfo.audience_fit?.for) ? cfo.audience_fit.for : [],
      audienceNotForList: Array.isArray(cfo.audience_fit?.not_for) ? cfo.audience_fit.not_for : [],
    },
    // Source priority for the 3 case-study cards on slide 10:
    //   1. Legacy parsed.cases (LLM-generated, real Skool/Whop names) — when present.
    //   2. Curated DB picker (app/lib/casesDb.js) — niche/archetype-keyed,
    //      always returns 3 real-world communities in creator's language.
    //   3. Placeholder rows — never reached now that we have (2).
    cases: {
      title: t('Casos similares', 'Similar Cases'),
      subtitle: t('Comunidades reais no Skool/Whop com este perfil. Dados públicos.', 'Real Skool/Whop communities with this profile. Public data.'),
      items: (() => {
        if (cases.length > 0) {
          // Legacy cases (LLM-generated, no revenue_type field) — assume MRR
          // for back-compat. The slide rendering falls back to "MRR" label
          // when revenue_label is empty.
          return cases.slice(0, 3).map(cs => ({
            name: cs.name || t('[Nome]', '[Name]'),
            niche: cs.niche || t('[Nicho]', '[Niche]'),
            members: cs.members || t('[X membros]', '[X members]'),
            price: cs.price || (lang === 'en' ? `${cur}[X]/mo` : `${cur}[X]/mês`),
            revenue_type: cs.revenue_type || 'mrr',
            revenue_value: cs.revenue_value || cs.mrr || '—',
            revenue_label: lang === 'en' ? 'MRR' : 'MRR',
            resume: cs.resume || t('[Resumo de 1 linha]', '[1-line resume]'),
            why: cs.why || t('[Porque é relevante para o criador]', '[Why this matters for the creator]'),
            url: cs.url || '',
          }));
        }
        return pickCases(creator, lang);
      })(),
      closer: t(
        'O nosso modelo está a fazer isto acontecer noutros nichos hoje. O teu é o próximo.',
        'Our model is making this happen in other niches today. Yours is next.'
      ),
    },
    launch: {
      title: t('Como Lançamos', 'How We Launch'),
      phases: lang === 'en' ? [
        {
          days: 'DAYS 1 — 21',
          title: 'We validate before spending',
          desc: 'We open a waitlist and welcome the first founding members with a special price. Validates the message before investing in ads.',
          assets: ['Waitlist landing page', 'Founding members offer', 'Pre-launch email sequence', 'Soft-launch campaign'],
          goal: '1,500 leads on waitlist',
        },
        {
          days: 'DAYS 22 — 42',
          title: 'We turn the growth machine on',
          desc: 'Ads on the right platforms. Emails on autopilot. Public content feeding the funnel. Live launch event.',
          assets: ['Meta + TikTok ad campaigns', 'Sales page + checkout', 'Live launch webinar', 'Launch email sequence (5+ emails)'],
          goal: '100 founding members confirmed',
        },
        {
          days: 'DAYS 43 — 60',
          title: 'We optimize continuously',
          desc: 'Every month we test new angles, emails, formats. What works scales. What doesn\'t, we cut.',
          assets: ['Monthly creative refresh', 'A/B testing on emails + ads', 'Retention campaigns', 'New tier / pricing experiments'],
          goal: '300 paid members',
        },
      ] : [
        {
          days: 'DIAS 1 — 21',
          title: 'Validamos antes de gastar',
          desc: 'Abrimos uma lista de espera e acolhemos os primeiros membros fundadores com preço especial. Serve para validar a mensagem antes de investir em anúncios.',
          assets: ['Landing page de waitlist', 'Oferta de membros fundadores', 'Sequência de emails pre-launch', 'Campanha de soft-launch'],
          goal: '1.500 leads na waitlist',
        },
        {
          days: 'DIAS 22 — 42',
          title: 'Ligamos a máquina de crescimento',
          desc: 'Anúncios ligados nas plataformas certas. Emails em automático. Conteúdo público a alimentar o funil. Evento ao vivo de lançamento.',
          assets: ['Campanhas de anúncios Meta + TikTok', 'Sales page + checkout', 'Webinar de lançamento ao vivo', 'Sequência de emails de lançamento (5+ emails)'],
          goal: '100 founding members confirmados',
        },
        {
          days: 'DIAS 43 — 60',
          title: 'Otimizamos continuamente',
          desc: 'Todos os meses testamos novos ângulos, emails, formatos. O que funciona escala. O que não funciona, corta-se.',
          assets: ['Refresh mensal de criativos', 'A/B testing em emails + anúncios', 'Campanhas de retenção', 'Novos tiers / experiências de preço'],
          goal: '300 membros pagos',
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

// Launch-plan trigger — red-accent variant of btnSecondary. Same shape as the
// other toolbar buttons but tinted so it reads as a "share this asset" CTA,
// not a generic export. Matches the pitch deck's red/cream language.
const btnLaunchPlan = {
  padding: "8px 16px",
  background: "rgba(177,30,47,0.08)",
  border: "1px solid rgba(177,30,47,0.45)",
  borderRadius: 6,
  color: "#B11E2F",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

export default function PitchPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#555", display: "flex", alignItems: "center", justifyContent: "center" }}>A carregar...</div>}>
      <PitchPageContent />
    </Suspense>
  );
}
