import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { getCreator } from '../../../../lib/creators';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

// ── Custom font loading ─────────────────────────────────────────
// We match the pitch deck's typography exactly: Geist (sans), Instrument
// Serif Italic (emphasis serif), JetBrains Mono (labels / day pills / page
// numbers). TTFs live in /public/fonts and are read once per process —
// cached in module scope so cold-start cost only hits the first request.
let FONT_CACHE = null;
function loadFonts() {
  if (FONT_CACHE) return FONT_CACHE;
  try {
    const dir = path.join(process.cwd(), 'public/fonts');
    const out = {};
    for (const f of [
      ['Geist-Regular.ttf', 'Geist', 'normal'],
      ['Geist-Bold.ttf', 'Geist', 'bold'],
      ['InstrumentSerif-Italic.ttf', 'InstrumentSerif', 'italic'],
      ['JetBrainsMono-Regular.ttf', 'JetBrainsMono', 'normal'],
      ['JetBrainsMono-Medium.ttf', 'JetBrainsMono', 'bold'],
    ]) {
      const buf = fs.readFileSync(path.join(dir, f[0]));
      out[f[0]] = { file: f[0], data: buf.toString('base64'), family: f[1], style: f[2] };
    }
    FONT_CACHE = out;
    return out;
  } catch (e) {
    return null;
  }
}

function registerFonts(doc, fonts) {
  if (!fonts) return false;
  for (const k of Object.keys(fonts)) {
    const f = fonts[k];
    doc.addFileToVFS(f.file, f.data);
    doc.addFont(f.file, f.family, f.style);
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────
// Launch-Plan PDF generator
//
// 8-page Lia-style action plan. Sent BETWEEN calls — the asset that
// closes the deal when the creator is alone reviewing the proposal.
//
// Visual language MATCHES the pitch deck: black canvas, white type,
// red (#B11E2F) accents, italic serif emphasis on key words,
// monospace eyebrows + day pills, dark cards with thin colored borders.
//
// Auto-populates from creator.offer.parsed.community + intelligence.topPosts;
// falls back to sensible templated copy when offer fields are empty.
// ─────────────────────────────────────────────────────────────────

// ─── Pitch-deck colour palette (RGB) ───
const BG_DARK     = [10, 10, 10];      // page background
const BG_CARD     = [18, 18, 18];      // card fill
const BG_CARD_R   = [28, 14, 18];      // red-tinted card fill (subtle wash)
const BG_CARD_G   = [12, 22, 16];      // green-tinted card fill
const BORDER_DIM  = [40, 40, 40];      // subtle card border
const BORDER_RED  = [120, 30, 45];     // accented card border
const BORDER_GREEN= [30, 95, 60];      // accent for library / aligned
const TEXT_WHITE  = [245, 245, 245];
const TEXT_GRAY   = [180, 180, 180];
const TEXT_MUTED  = [120, 120, 120];
const TEXT_FAINT  = [80, 80, 80];
const RED         = [177, 30, 47];     // #B11E2F
const RED_DEEP    = [120, 15, 30];
const GREEN       = [31, 138, 76];     // #1F8A4C

// PT/EN copy.
const COPY = {
  pt: {
    coverTag: 'PLANO DE LANÇAMENTO · 001',
    coverTopRight: 'SECONDLAYER',
    coverTitleA: 'Plano de',
    coverTitleB: 'Lançamento',
    coverSub: 'Roadmap completo · do aquecimento de audiência ao lançamento da comunidade',
    phasesEyebrow: 'VISÃO GERAL',
    phasesTitleA: '60 dias.',
    phasesTitleB: '3 fases.',
    phasesSub: 'Cada fase tem objetivo claro, assets concretos e métricas para validar antes de avançar.',
    phaseNames: ['Topo de funil', 'Meio de funil', 'Fundo de funil'],
    phaseEyebrows: ['AQUECIMENTO', 'CAPTAÇÃO', 'CONVERSÃO'],
    phaseDays: ['DIAS 1–21', 'DIAS 22–42', 'DIAS 43–60'],
    metaLabel: 'META',
    weeklyEyebrow: 'DIAGNÓSTICO',
    weeklyTitleA: 'O que vamos',
    weeklyTitleB: 'lançar',
    weeklyContent: 'CONTEÚDO SEMANAL',
    libraryLabel: 'BIBLIOTECA PRÉ-GRAVADA',
    objectives: 'OBJETIVOS',
    organicContent: 'CONTEÚDO ORGÂNICO',
    emailSequence: 'SEQUÊNCIA DE EMAILS',
    launchSequence: 'SEQUÊNCIA DE LANÇAMENTO',
    paidTraffic: 'TRÁFEGO PAGO',
    assets: 'ASSETS QUE ENTREGAMOS',
    phaseSubs: [
      'Reativar audiência. Capturar emails. Construir desejo pela comunidade antes de a vender.',
      'Nutrir a waitlist com sequência de emails. Validar oferta com beta. Criar urgência real para o lançamento.',
      'Lançamento público. Carrinho aberto 5 dias. Anúncios em escala. Conversão máxima.',
    ],
    deliverablesEyebrow: 'ENTREGÁVEIS',
    deliverablesTitleA: 'Tudo o que',
    deliverablesTitleB: 'construímos.',
    deliverablesSub: 'Inventário completo dos assets que entregamos durante os 60 dias. Tudo é teu para sempre.',
    weekEyebrow: 'ROADMAP',
    weekTitleA: 'Semana',
    weekTitleB: 'a semana.',
    weekSub: 'Visão concreta do que acontece em cada uma das 8 semanas.',
    weekFooter: 'Cada semana tem reunião de revisão · ajustamos com base em dados reais, não em achismos.',
    valFooter: 'Validação obrigatória entre fases · não avançamos se a anterior não bater métricas mínimas.',
    advance: (n, goal) => `Validação para avançar à Fase ${n} · ${goal} no final do prazo.`,
    expected: 'Resultado esperado',
    section1: 'COPY & CONTEÚDO',
    section2: 'DESIGN & VISUAL',
    section3: 'TÉCNICO & AUTOMAÇÃO',
    section4: 'ESTRATÉGIA & SUPORTE',
  },
  en: {
    coverTag: 'LAUNCH PLAN · 001',
    coverTopRight: 'SECONDLAYER',
    coverTitleA: 'Launch',
    coverTitleB: 'Plan',
    coverSub: 'Complete roadmap · from audience warm-up to community launch',
    phasesEyebrow: 'OVERVIEW',
    phasesTitleA: '60 days.',
    phasesTitleB: '3 phases.',
    phasesSub: 'Each phase has a clear objective, concrete assets and metrics to validate before advancing.',
    phaseNames: ['Top of funnel', 'Middle of funnel', 'Bottom of funnel'],
    phaseEyebrows: ['WARM-UP', 'CAPTURE', 'CONVERSION'],
    phaseDays: ['DAYS 1–21', 'DAYS 22–42', 'DAYS 43–60'],
    metaLabel: 'GOAL',
    weeklyEyebrow: 'DIAGNOSTIC',
    weeklyTitleA: 'What we',
    weeklyTitleB: 'will launch',
    weeklyContent: 'WEEKLY CONTENT',
    libraryLabel: 'PRE-RECORDED LIBRARY',
    objectives: 'OBJECTIVES',
    organicContent: 'ORGANIC CONTENT',
    emailSequence: 'EMAIL SEQUENCE',
    launchSequence: 'LAUNCH SEQUENCE',
    paidTraffic: 'PAID TRAFFIC',
    assets: 'ASSETS WE DELIVER',
    phaseSubs: [
      'Reactivate audience. Capture emails. Build desire for the community before selling.',
      'Nurture the waitlist with email sequence. Validate offer with beta. Create real urgency for launch.',
      'Public launch. Cart open 5 days. Ads scaling. Maximum conversion.',
    ],
    deliverablesEyebrow: 'DELIVERABLES',
    deliverablesTitleA: 'Everything',
    deliverablesTitleB: 'we build.',
    deliverablesSub: 'Complete inventory of assets delivered during the 60 days. Yours forever.',
    weekEyebrow: 'ROADMAP',
    weekTitleA: 'Week',
    weekTitleB: 'by week.',
    weekSub: 'Concrete view of what happens in each of the 8 weeks.',
    weekFooter: 'Each week has a review meeting · we adjust based on real data, not guesses.',
    valFooter: 'Mandatory validation between phases · we don\'t advance if previous one misses targets.',
    advance: (n, goal) => `Validation to advance to Phase ${n} · ${goal} by end of period.`,
    expected: 'Expected outcome',
    section1: 'COPY & CONTENT',
    section2: 'DESIGN & VISUAL',
    section3: 'TECH & AUTOMATION',
    section4: 'STRATEGY & SUPPORT',
  },
};

// Derive realistic phase goals from the creator's audience size.
function deriveGoals(audience, lang) {
  const a = Number(audience) || 100000;
  const waitlistLeads = Math.max(500, Math.round(a * 0.0017 / 100) * 100);
  const foundingMembers = Math.max(60, Math.round(waitlistLeads * 0.065 / 10) * 10);
  const paidMembers = Math.max(150, Math.round(foundingMembers * 3.0 / 10) * 10);
  const fmt = (n) => n.toLocaleString(lang === 'en' ? 'en-US' : 'pt-PT');
  if (lang === 'en') {
    return [
      `${fmt(waitlistLeads)} leads on waitlist`,
      `${foundingMembers} founding members confirmed`,
      `${paidMembers} paid members`,
    ];
  }
  return [
    `${fmt(waitlistLeads)} leads na waitlist`,
    `${foundingMembers} founding members confirmados`,
    `${paidMembers} membros pagos`,
  ];
}

export async function GET(request, { params }) {
  try {
    const { creatorId } = await params;
    const creator = await getCreator(creatorId);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    const lang = (creator?.primaryLanguage || '').toLowerCase().includes('en') ? 'en' : 'pt';
    const t = COPY[lang];
    const community = creator?.offer?.parsed?.community || {};
    const weeklyFormats = (community.weeklyFormats || []).slice(0, 4);
    const library = (community.library || []).slice(0, 6);
    const audience = creator?.revenueAudience || creator?.platforms?.instagram?.followers || 100000;
    const price = Number(creator?.revenuePrice) || 19;
    const goals = deriveGoals(audience, lang);
    const commName = community.primaryName || creator?.name || '';
    const creatorName = (creator?.name || '').toUpperCase();
    const niche = creator?.niche || '';

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 56;

    // Register the pitch-deck typeface trio. If any TTF is missing we fall
    // back to the closest built-in jsPDF font so the route still renders.
    const fontsLoaded = registerFonts(doc, loadFonts());
    const SANS  = fontsLoaded ? 'Geist' : 'helvetica';
    const SERIF = fontsLoaded ? 'InstrumentSerif' : 'times';
    const MONO  = fontsLoaded ? 'JetBrainsMono' : 'courier';
    // Instrument Serif only ships an italic cut → all serif emphasis uses 'italic'.
    const SERIF_STYLE = fontsLoaded ? 'italic' : 'bolditalic';

    // ── Style helpers ──
    const setFill = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    const setText = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    const setDraw = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

    // Paint the page black, then a soft radial-style red glow in a corner.
    // jsPDF doesn't support radial gradients natively, so we stack 10 concentric
    // translucent ellipses with a smooth cubic-falloff alpha curve. Result reads
    // visually identical to the pitch deck's CSS aurora glow.
    function paintBackground(glowCorner = 'tr', tint = RED_DEEP) {
      setFill(BG_DARK);
      doc.rect(0, 0, pageW, pageH, 'F');
      try {
        const corners = {
          tr: [pageW + 40, -30],
          br: [pageW + 40, pageH + 30],
          tl: [-40, -30],
          bl: [-40, pageH + 30],
          tc: [pageW / 2, -80],
          bc: [pageW / 2, pageH + 80],
        };
        const [cx, cy] = corners[glowCorner] || corners.tr;
        // Cubic falloff from center peak → 0 at outer radius.
        const TIERS = 10;
        const PEAK_ALPHA = 0.42;
        const OUTER_R = 480;
        for (let i = TIERS - 1; i >= 0; i--) {
          const t = i / (TIERS - 1);                 // 1 at outer, 0 at center
          const r = OUTER_R * (0.15 + 0.85 * t);
          const alpha = PEAK_ALPHA * Math.pow(1 - t, 1.6);
          if (alpha < 0.01) continue;
          doc.setGState(new doc.GState({ opacity: alpha }));
          setFill(tint);
          doc.ellipse(cx, cy, r, r, 'F');
        }
        doc.setGState(new doc.GState({ opacity: 1 }));
      } catch (e) { /* skip glow on older jsPDF */ }
    }

    // Linear vertical gradient overlay — used on "red wash" cards (matches the
    // deck's `linear-gradient(180deg, rgba(177,30,47,0.10), rgba(15,15,15,0.85))`).
    // Stepped via 14 narrow horizontal slabs with decreasing alpha. Should be called
    // AFTER the card's base fill and BEFORE the border so the stroke sits on top.
    function gradientWash(x, y, w, h, color = RED, topAlpha = 0.18, bottomAlpha = 0.0) {
      try {
        const steps = 14;
        for (let i = 0; i < steps; i++) {
          const sy = y + (h / steps) * i;
          const sh = h / steps + 0.5;               // tiny overlap to avoid seams
          const t = i / (steps - 1);
          const a = topAlpha + (bottomAlpha - topAlpha) * t;
          if (a < 0.005) continue;
          doc.setGState(new doc.GState({ opacity: a }));
          setFill(color);
          doc.rect(x, sy, w, sh, 'F');
        }
        doc.setGState(new doc.GState({ opacity: 1 }));
      } catch (e) {}
    }

    // Letter-spaced uppercase eyebrow (red bullet + small mono caps). Matches the
    // deck's eyebrow rhythm: 10pt mono with 1.8 charSpace + bullet at x-radius 2.
    function eyebrow(text, x, y, opts = {}) {
      const { color = RED, withBullet = true, withCharSpace = 1.8, size = 9 } = opts;
      if (withBullet) {
        setFill(color);
        doc.circle(x + 3, y - 3, 2, 'F');
      }
      doc.setFont(MONO, 'bold');
      doc.setFontSize(size);
      setText(color);
      try { doc.setCharSpace(withCharSpace); } catch (e) {}
      doc.text(String(text).toUpperCase(), x + (withBullet ? 16 : 0), y);
      try { doc.setCharSpace(0); } catch (e) {}
    }

    // Big editorial title: Geist bold word(s) followed by red Instrument Serif italic keyword.
    // Tight letter-spacing (-0.03em equivalent via charSpace -0.3) to match the deck headlines.
    function title(plainText, italicText, x, y, opts = {}) {
      const { size = 56, italicColor = RED, plainColor = TEXT_WHITE, italicBoost = 4 } = opts;
      doc.setFont(SANS, 'bold');
      doc.setFontSize(size);
      setText(plainColor);
      try { doc.setCharSpace(-0.4); } catch (e) {}
      doc.text(plainText, x, y);
      const plainW = doc.getTextWidth(plainText);
      try { doc.setCharSpace(0); } catch (e) {}
      if (italicText) {
        // Italic-serif keyword runs a touch larger than the sans — pitch deck does
        // the same (e.g. headline 88 / italic 92).
        doc.setFont(SERIF, SERIF_STYLE);
        doc.setFontSize(size + italicBoost);
        setText(italicColor);
        doc.text(' ' + italicText, x + plainW, y);
      }
    }

    // Instrument Serif italic gray subtitle (matches `italicSerif` style on the deck).
    function subtitle(text, x, y, maxW = pageW - margin * 2) {
      doc.setFont(SERIF, SERIF_STYLE);
      doc.setFontSize(15);
      setText(TEXT_GRAY);
      const lines = doc.splitTextToSize(text, maxW);
      doc.text(lines, x, y);
      return y + lines.length * 19;
    }

    // Mono uppercase pill (e.g. "DIAS 1–21"). Red border + red wash + white text —
    // identical treatment to the Como Lançamos slide's day pills.
    function monoPill(text, cx, cy, opts = {}) {
      const { padX = 14, padY = 7, size = 10 } = opts;
      doc.setFont(MONO, 'bold');
      doc.setFontSize(size);
      const w = doc.getTextWidth(text) + padX * 2;
      const h = size + padY * 2;
      const x = cx - w / 2;
      const y = cy - h / 2;
      setFill([28, 14, 18]); setDraw(RED); doc.setLineWidth(0.8);
      doc.roundedRect(x, y, w, h, 6, 6, 'FD');
      setText(TEXT_WHITE);
      try { doc.setCharSpace(1.2); } catch (e) {}
      doc.text(text, cx, cy + size / 3, { align: 'center' });
      try { doc.setCharSpace(0); } catch (e) {}
      return { x, y, w, h };
    }

    // Dark card with thin colored border. Optional gradient wash + huge italic-serif numeral decor.
    // The gradient wash is CLIPPED to the rounded-rect shape so it never bleeds past the
    // corners — matches the deck's CSS `linear-gradient` inside a `border-radius: 14`.
    function card(x, y, w, h, opts = {}) {
      const {
        border = BORDER_DIM,
        fill = BG_CARD,
        radius = 12,
        decorNum = null,
        gradient = null,
      } = opts;
      setFill(fill);
      doc.roundedRect(x, y, w, h, radius, radius, 'F');
      if (gradient) {
        try {
          doc.saveGraphicsState();
          doc.roundedRect(x, y, w, h, radius, radius);
          doc.clip();
          doc.discardPath();
          gradientWash(x, y, w, h, gradient.color || RED, gradient.topAlpha ?? 0.16, gradient.bottomAlpha ?? 0);
          doc.restoreGraphicsState();
        } catch (e) {
          // Older jsPDF: paint without clipping (very low alpha → bleed is invisible).
          gradientWash(x, y, w, h, gradient.color || RED, gradient.topAlpha ?? 0.16, gradient.bottomAlpha ?? 0);
        }
      }
      setDraw(border);
      doc.setLineWidth(0.8);
      doc.roundedRect(x, y, w, h, radius, radius, 'S');
      if (decorNum != null) {
        try {
          doc.saveGraphicsState();
          doc.roundedRect(x, y, w, h, radius, radius);
          doc.clip();
          doc.discardPath();
          try { doc.setGState(new doc.GState({ opacity: 0.22 })); } catch (e) {}
          doc.setFont(SERIF, SERIF_STYLE);
          doc.setFontSize(170);
          setText(RED);
          doc.text(String(decorNum), x + w - 30, y + h - 18, { align: 'right' });
          try { doc.setGState(new doc.GState({ opacity: 1 })); } catch (e) {}
          doc.restoreGraphicsState();
        } catch (e) { /* skip */ }
      }
    }

    // Red-dot bullet list. Returns the y after the last line.
    function bulletList(items, x, y, w, opts = {}) {
      const { size = 9.5, lineH = 14, dotColor = RED, textColor = TEXT_WHITE } = opts;
      let cy = y;
      for (const item of items) {
        if (!item) continue;
        setFill(dotColor);
        doc.circle(x + 3, cy - 3, 1.6, 'F');
        doc.setFont(SANS, 'normal');
        doc.setFontSize(size);
        setText(textColor);
        const lines = doc.splitTextToSize(String(item), w - 14);
        doc.text(lines, x + 12, cy);
        cy += lineH * lines.length + 1;
      }
      return cy;
    }

    // Page footer: italic gray text on left, mono page number on right.
    function pageFooter(footerText, pageNum, totalPages) {
      if (footerText) {
        doc.setFont(SERIF, SERIF_STYLE);
        doc.setFontSize(9);
        setText(TEXT_MUTED);
        const lines = doc.splitTextToSize(footerText, pageW - margin * 2 - 80);
        doc.text(lines, margin, pageH - 28);
      }
      doc.setFont(MONO, 'normal');
      doc.setFontSize(8);
      setText(TEXT_MUTED);
      doc.text(`${String(pageNum).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`,
               pageW - margin, pageH - 28, { align: 'right' });
    }

    // Header tag in top-right (small mono uppercase, used on inner pages).
    function topRightTag(text) {
      doc.setFont(MONO, 'normal');
      doc.setFontSize(8);
      setText(TEXT_FAINT);
      try { doc.setCharSpace(1.4); } catch (e) {}
      doc.text(text.toUpperCase(), pageW - margin, 30, { align: 'right' });
      try { doc.setCharSpace(0); } catch (e) {}
    }

    const TOTAL = 8;

    // ═══════════════════════════════════════════════════════════════
    // PAGE 1 · COVER
    // Mirrors the pitch-deck cover: black canvas with a single soft red
    // aurora bottom-right, mono tag top-left, wordmark top-right, BIG
    // centered Geist creator name, thin red rule, sans/italic-serif
    // subtitle, mono niche · dash · date footer.
    // ═══════════════════════════════════════════════════════════════
    paintBackground('br');
    eyebrow(t.coverTag, margin, 50, { size: 9 });
    // Top-right wordmark — italic-serif "Layer" inside SECOND·LAYER like the deck
    doc.setFont(MONO, 'normal');
    doc.setFontSize(9);
    setText(TEXT_GRAY);
    try { doc.setCharSpace(1.6); } catch (e) {}
    doc.text(t.coverTopRight, pageW - margin, 50, { align: 'right' });
    try { doc.setCharSpace(0); } catch (e) {}

    // Big centered creator name — Geist bold, scaled to feel as commanding
    // as "Yomi Denzel" on the deck cover. Letter-spacing pulled tight.
    const coverCenterY = pageH / 2;
    doc.setFont(SANS, 'bold');
    doc.setFontSize(80);
    setText(TEXT_WHITE);
    try { doc.setCharSpace(-0.6); } catch (e) {}
    doc.text(creator?.name || 'Creator', pageW / 2, coverCenterY - 18, { align: 'center' });
    try { doc.setCharSpace(0); } catch (e) {}

    // Thin red rule under the name
    setDraw(RED); doc.setLineWidth(1.4);
    doc.line(pageW / 2 - 36, coverCenterY + 18, pageW / 2 + 36, coverCenterY + 18);

    // Subtitle "Plano de" (Geist normal) + italic-serif "Lançamento" (red).
    // Compute combined width manually so the line is truly centered.
    const subSize = 36;
    doc.setFont(SANS, 'normal');
    doc.setFontSize(subSize);
    const wA = doc.getTextWidth(t.coverTitleA);
    doc.setFont(SERIF, SERIF_STYLE);
    doc.setFontSize(subSize + 4);
    const wB = doc.getTextWidth(' ' + t.coverTitleB);
    const totalW = wA + wB;
    const startX = pageW / 2 - totalW / 2;
    doc.setFont(SANS, 'normal');
    doc.setFontSize(subSize);
    setText(TEXT_WHITE);
    doc.text(t.coverTitleA, startX, coverCenterY + 64);
    doc.setFont(SERIF, SERIF_STYLE);
    doc.setFontSize(subSize + 4);
    setText(RED);
    doc.text(' ' + t.coverTitleB, startX + wA, coverCenterY + 64);

    // Italic sub-subtitle below (one-liner from copy.coverSub).
    doc.setFont(SERIF, SERIF_STYLE);
    doc.setFontSize(16);
    setText(TEXT_GRAY);
    doc.text(t.coverSub, pageW / 2, coverCenterY + 100, { align: 'center', maxWidth: pageW - margin * 4 });

    // Bottom footer row (3 cols: niche · dash · today)
    const today = new Date();
    const monthNames = lang === 'en'
      ? ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
      : ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
    const dateStr = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
    doc.setFont(MONO, 'normal');
    doc.setFontSize(8.5);
    setText(TEXT_FAINT);
    try { doc.setCharSpace(1.8); } catch (e) {}
    doc.text((niche || '—').toUpperCase(), margin, pageH - 44);
    doc.text('—', pageW / 2, pageH - 44, { align: 'center' });
    doc.text(dateStr, pageW - margin, pageH - 44, { align: 'right' });
    try { doc.setCharSpace(0); } catch (e) {}

    // ═══════════════════════════════════════════════════════════════
    // PAGE 2 · VISÃO GERAL — 60 DIAS · 3 FASES
    // ═══════════════════════════════════════════════════════════════
    doc.addPage();
    paintBackground('tr');
    topRightTag('SECONDLAYER');
    eyebrow(t.phasesEyebrow, margin, 78);
    title(t.phasesTitleA, t.phasesTitleB, margin, 144);
    let y = subtitle(t.phasesSub, margin, 188, 820);

    const phaseY = 244;
    const phaseH = pageH - phaseY - 90;
    const phaseW = (pageW - margin * 2 - 40) / 3;
    for (let i = 0; i < 3; i++) {
      const x = margin + i * (phaseW + 20);
      const isCenter = i === 1;
      card(x, phaseY, phaseW, phaseH, {
        border: BORDER_RED,
        fill: BG_CARD,
        decorNum: i + 1,
        // Center "Captação" card gets a soft red wash from top — matches the
        // deck's highlighted-card treatment (linear-gradient red→dark).
        gradient: isCenter ? { color: RED, topAlpha: 0.14, bottomAlpha: 0 } : null,
      });
      eyebrow(t.phaseEyebrows[i], x + 28, phaseY + 42);
      // Phase name
      doc.setFont(SANS, 'bold');
      doc.setFontSize(30);
      setText(TEXT_WHITE);
      try { doc.setCharSpace(-0.3); } catch (e) {}
      doc.text(t.phaseNames[i], x + 28, phaseY + 88);
      try { doc.setCharSpace(0); } catch (e) {}
      // Days pill below
      doc.setFont(MONO, 'bold');
      doc.setFontSize(10);
      const pillTextWidth = doc.getTextWidth(t.phaseDays[i]);
      monoPill(t.phaseDays[i], x + 28 + pillTextWidth / 2 + 14, phaseY + 118, { size: 10 });
      // Description
      doc.setFont(SANS, 'normal');
      doc.setFontSize(12);
      setText(TEXT_GRAY);
      const dLines = doc.splitTextToSize(t.phaseSubs[i], phaseW - 56);
      doc.text(dLines, x + 28, phaseY + 160);
      // META box at bottom — red border + red wash gradient (clipped to rounded shape).
      const metaY = phaseY + phaseH - 82;
      const metaH = 60;
      const metaX = x + 28;
      const metaW = phaseW - 56;
      setFill([28, 14, 18]);
      doc.roundedRect(metaX, metaY, metaW, metaH, 8, 8, 'F');
      try {
        doc.saveGraphicsState();
        doc.roundedRect(metaX, metaY, metaW, metaH, 8, 8);
        doc.clip();
        doc.discardPath();
        gradientWash(metaX, metaY, metaW, metaH, RED, 0.22, 0.06);
        doc.restoreGraphicsState();
      } catch (e) { gradientWash(metaX, metaY, metaW, metaH, RED, 0.18, 0.04); }
      setDraw(RED); doc.setLineWidth(1);
      doc.roundedRect(metaX, metaY, metaW, metaH, 8, 8, 'S');
      // META label (no bullet)
      doc.setFont(MONO, 'bold');
      doc.setFontSize(8);
      setText(RED);
      try { doc.setCharSpace(1.8); } catch (e) {}
      doc.text(t.metaLabel, metaX + 16, metaY + 22);
      try { doc.setCharSpace(0); } catch (e) {}
      // Goal value
      doc.setFont(SANS, 'bold');
      doc.setFontSize(14);
      setText(TEXT_WHITE);
      const gLines = doc.splitTextToSize(goals[i], metaW - 32);
      doc.text(gLines, metaX + 16, metaY + 44);
    }
    pageFooter(t.valFooter, 2, TOTAL);

    // ═══════════════════════════════════════════════════════════════
    // PAGE 3 · O QUE VAMOS LANÇAR  (weekly content + library)
    // ═══════════════════════════════════════════════════════════════
    doc.addPage();
    paintBackground('bl');
    topRightTag('SECONDLAYER');
    eyebrow(t.weeklyEyebrow, margin, 78);
    title(t.weeklyTitleA, t.weeklyTitleB, margin, 144);
    subtitle(
      lang === 'en'
        ? `${commName} — monthly community at €${price}/mo. The exact weekly content + pre-recorded vault we'll ship.`
        : `${commName} — comunidade mensal a €${price}/mês. O conteúdo semanal exato + a biblioteca pré-gravada que vamos lançar.`,
      margin, 162, 800
    );

    // ── Weekly content row eyebrow + 2x2 grid ──
    eyebrow(t.weeklyContent, margin, 240);
    const wfY = 258;
    const wfCols = 2;
    const wfW = (pageW - margin * 2 - 16) / wfCols;
    const wfH = 92;
    const wfList = (weeklyFormats.length ? weeklyFormats : Array(4).fill({})).slice(0, 4);
    for (let i = 0; i < wfList.length; i++) {
      const f = wfList[i];
      const col = i % wfCols;
      const row = Math.floor(i / wfCols);
      const x = margin + col * (wfW + 16);
      const y = wfY + row * (wfH + 12);
      card(x, y, wfW, wfH, { border: BORDER_RED, fill: BG_CARD });
      // Day pill — top-left of card
      if (f.day) monoPill(String(f.day).toUpperCase(), x + 36, y + 22, { size: 8.5, padX: 10, padY: 4 });
      // Format name italic serif
      doc.setFont(SERIF, SERIF_STYLE);
      doc.setFontSize(19);
      setText(TEXT_WHITE);
      doc.text(f.name || '[—]', x + 78, y + 26);
      // Type mono label
      if (f.type) {
        doc.setFont(MONO, 'normal');
        doc.setFontSize(8);
        setText(TEXT_MUTED);
        try { doc.setCharSpace(1.2); } catch (e) {}
        doc.text(String(f.type).toUpperCase(), x + 78, y + 42);
        try { doc.setCharSpace(0); } catch (e) {}
      }
      // Description
      doc.setFont(SANS, 'normal');
      doc.setFontSize(10);
      setText(TEXT_GRAY);
      const dLines = doc.splitTextToSize(f.desc || '', wfW - 32);
      doc.text(dLines.slice(0, 2), x + 16, y + 64);
    }

    // ── Library row eyebrow + 3x2 grid (green-accented) ──
    const libEyeY = wfY + 2 * (wfH + 12) + 24;
    eyebrow(t.libraryLabel, margin, libEyeY, { color: GREEN });
    const libY = libEyeY + 16;
    const libCols = 3;
    const libW = (pageW - margin * 2 - 24) / libCols;
    const libH = 58;
    const libList = (library.length ? library : Array(6).fill({})).slice(0, 6);
    for (let i = 0; i < libList.length; i++) {
      const m = libList[i];
      const col = i % libCols;
      const row = Math.floor(i / libCols);
      const x = margin + col * (libW + 12);
      const y = libY + row * (libH + 10);
      card(x, y, libW, libH, { border: BORDER_GREEN, fill: BG_CARD_G, radius: 6 });
      if (m.format) {
        doc.setFont(MONO, 'bold');
        doc.setFontSize(7.5);
        setText(GREEN);
        try { doc.setCharSpace(1.4); } catch (e) {}
        doc.text(String(m.format).toUpperCase(), x + 14, y + 18);
        try { doc.setCharSpace(0); } catch (e) {}
      }
      doc.setFont(SERIF, SERIF_STYLE);
      doc.setFontSize(14);
      setText(TEXT_WHITE);
      const nLines = doc.splitTextToSize(m.name || '[—]', libW - 28);
      doc.text(nLines.slice(0, 1), x + 14, y + 34);
      doc.setFont(SANS, 'normal');
      doc.setFontSize(8.5);
      setText(TEXT_GRAY);
      const dLines = doc.splitTextToSize(m.desc || '', libW - 28);
      doc.text(dLines.slice(0, 1), x + 14, y + 49);
    }
    pageFooter('', 3, TOTAL);

    // ═══════════════════════════════════════════════════════════════
    // Helper for the 3 phase-detail pages — identical chrome,
    // varying eyebrows + column content.
    // ═══════════════════════════════════════════════════════════════
    function phaseDetailPage(pageNum, idx, titleA, titleB, columns, footerText) {
      doc.addPage();
      paintBackground(idx === 0 ? 'tr' : idx === 1 ? 'tl' : 'br');
      topRightTag(`FASE 0${idx + 1} · ${t.phaseEyebrows[idx]}`);
      eyebrow(`FASE 0${idx + 1} · ${t.phaseEyebrows[idx]}`, margin, 70);
      title(titleA, titleB, margin, 144);
      subtitle(t.phaseSubs[idx], margin, 188, pageW - margin * 2 - 180);
      // Days pill top-right
      monoPill(t.phaseDays[idx], pageW - margin - 64, 140, { size: 11, padX: 16, padY: 8 });

      const bodyY = 244;
      const bodyH = pageH - bodyY - 80;
      const colW = (pageW - margin * 2 - 32) / 3;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const x = margin + i * (colW + 16);
        card(x, bodyY, colW, bodyH, { border: BORDER_DIM, fill: BG_CARD });
        eyebrow(col.title, x + 22, bodyY + 32);
        bulletList(col.items, x + 22, bodyY + 60, colW - 44, { size: 9.5, lineH: 14 });
      }
      pageFooter(footerText, pageNum, TOTAL);
    }

    // ── PAGE 4 · FASE 01 ──
    phaseDetailPage(4, 0,
      lang === 'en' ? 'Top' : 'Topo',
      lang === 'en' ? 'of funnel' : 'de funil',
      [
        { title: t.objectives, items: lang === 'en' ? [
          'Reactivate engagement from baseline to 1.5%',
          `Capture ${goals[0]}`,
          `Position ${creator?.name || 'creator'} as authority #1`,
        ] : [
          'Reactivar engagement da baseline para 1.5%',
          `Capturar ${goals[0]}`,
          `Posicionar ${creator?.name || 'criador'} como autoridade nº1`,
        ]},
        { title: t.organicContent, items: lang === 'en' ? [
          '9 Reels (3/week): contrarian hooks on your niche',
          '3 carousels: personal story + vision',
          '21 stories (1/day): behind-the-scenes, polls, testimonials',
          '1 weekly Live 30min: niche Q&A with waitlist hook',
        ] : [
          '9 Reels (3/semana): hooks contrarian sobre o teu nicho',
          '3 carrosséis storytelling: percurso pessoal e visão',
          '21 stories (1/dia): bastidores, polls, testimonials',
          '1 Live semanal 30min: Q&A com gancho para waitlist',
        ]},
        { title: t.assets, items: lang === 'en' ? [
          'Lead magnet (PDF + videos)',
          'Waitlist landing page (copy + design + tracking)',
          'Scripts for 9 Reels + 3 carousels',
          'Email capture + auto-tagging system',
          'Weekly metrics dashboard',
        ] : [
          'Lead magnet (PDF + vídeos)',
          'Landing page de waitlist (copy + design + tracking)',
          'Guiões para 9 Reels + 3 carrosséis',
          'Sistema de captura de emails + tagging automático',
          'Dashboard de métricas semanais',
        ]},
      ],
      t.advance(2, goals[0])
    );

    // ── PAGE 5 · FASE 02 ──
    phaseDetailPage(5, 1,
      lang === 'en' ? 'Middle' : 'Meio',
      lang === 'en' ? 'of funnel' : 'de funil',
      [
        { title: t.objectives, items: lang === 'en' ? [
          'Warm waitlist with 7 storytelling emails',
          'Beta-test offer with 100 founding members (€14/mo lifetime)',
          'Collect 20+ testimonials and cases for launch',
          'Refine messaging based on real responses',
        ] : [
          'Aquecer waitlist com 7 emails de storytelling',
          'Beta-test oferta com 100 founding members (€14/mês vitalício)',
          'Recolher 20+ testimonials e cases para usar no lançamento',
          'Refinar mensagem com base em respostas reais',
        ]},
        { title: t.emailSequence, items: lang === 'en' ? [
          'Email 1 · Story: how I got here',
          'Email 2 · The method',
          'Email 3 · Waitlist-exclusive content',
          'Email 4 · Transformation case',
          'Email 5 · The problem with generic online courses',
          'Email 6 · Founding-member invite (limited spots)',
          'Email 7 · Final 24h beta call',
        ] : [
          'Email 1 · História: como cheguei aqui',
          'Email 2 · O método',
          'Email 3 · Conteúdo exclusivo da waitlist',
          'Email 4 · Caso de transformação',
          'Email 5 · O problema com cursos online genéricos',
          'Email 6 · Convite founding members (vagas limitadas)',
          'Email 7 · Última chamada beta · 24h',
        ]},
        { title: t.assets, items: lang === 'en' ? [
          '7 complete emails (copy + design + automation)',
          'Beta founding-members page (restricted access)',
          'Stripe payment + checkout system',
          'Onboarding sequence for the first 100',
          `Community platform configured (${community.platform || 'Circle / Skool'})`,
          'Testimonial collection system',
        ] : [
          '7 emails completos (copy + design + automação)',
          'Página beta founding members (acesso restrito)',
          'Sistema de pagamento Stripe + checkout',
          'Onboarding sequence para os primeiros 100',
          `Plataforma da comunidade configurada (${community.platform || 'Circle / Skool'})`,
          'Sistema de recolha de testimonials',
        ]},
      ],
      t.advance(3, goals[1])
    );

    // ── PAGE 6 · FASE 03 ──
    const paidMembersNum = Number(String(goals[2]).replace(/[^0-9]/g, '')) || 300;
    const expectedMRR = Math.round(price * paidMembersNum);
    const mrrFmt = expectedMRR.toLocaleString(lang === 'en' ? 'en-US' : 'pt-PT');
    phaseDetailPage(6, 2,
      lang === 'en' ? 'Bottom' : 'Fundo',
      lang === 'en' ? 'of funnel' : 'de funil',
      [
        { title: t.launchSequence, items: lang === 'en' ? [
          'Day 43-49 · Pre-launch: 3 emails + public content',
          'Day 51 · Cart opens · email + posts',
          'Day 52-54 · Sales sequence (3 emails)',
          'Day 55 · 24h final notice + Live Q&A',
          'Day 56 · Cart closes at midnight',
        ] : [
          'Dia 43-49 · Pré-lançamento: 3 emails + conteúdo público',
          'Dia 51 · Carrinho abre · email + posts',
          'Dia 52-54 · Sequência de vendas (3 emails)',
          'Dia 55 · 24h aviso final + Live de Q&A',
          'Dia 56 · Carrinho fecha à meia-noite',
        ]},
        { title: t.paidTraffic, items: lang === 'en' ? [
          'Meta Ads · €50/day initial, scale to €200/day',
          'TikTok Ads · €30/day (younger audience)',
          'Retargeting sales-page visitors',
          'Lookalike audiences from founding members',
          'Creatives: 6 videos + 4 carousels',
          'Total estimated budget: €4,000–6,000',
        ] : [
          'Meta Ads · €50/dia inicial, escala até €200/dia',
          'TikTok Ads · €30/dia (audiência mais jovem)',
          'Retargeting visitantes da sales page',
          'Lookalike audiences a partir dos founding members',
          'Criativos: 6 vídeos + 4 carrosséis',
          'Budget total estimado: €4,000–6,000',
        ]},
        { title: t.assets, items: lang === 'en' ? [
          'Complete sales page (long-form, with video)',
          'Masterclass page + registration system',
          '5 launch emails (copy + design)',
          '10 ad creatives (6 videos + 4 carousels)',
          'Full Meta + TikTok campaign setup',
          'Optimized checkout + €47 upsell',
          'Live conversion tracking dashboard',
        ] : [
          'Sales page completa (long-form, com vídeo)',
          'Página da masterclass + sistema de inscrição',
          '5 emails de lançamento (copy + design)',
          '10 criativos de ads (6 vídeos + 4 carrosséis)',
          'Setup completo de campanhas Meta + TikTok',
          'Página de checkout otimizada + upsell €47',
          'Live tracking de conversões em tempo real',
        ]},
      ],
      lang === 'en'
        ? `${t.expected} · ${goals[2]} · €${mrrFmt} MRR by end of day 60.`
        : `${t.expected} · ${goals[2]} · €${mrrFmt} MRR no fim do dia 60.`
    );

    // ═══════════════════════════════════════════════════════════════
    // PAGE 7 · ENTREGÁVEIS — 2x2 quadrants
    // ═══════════════════════════════════════════════════════════════
    doc.addPage();
    paintBackground('br');
    topRightTag('SECONDLAYER');
    eyebrow(t.deliverablesEyebrow, margin, 78);
    title(t.deliverablesTitleA, t.deliverablesTitleB, margin, 144);
    subtitle(t.deliverablesSub, margin, 188, 880);

    const quadY = 244;
    const quadW = (pageW - margin * 2 - 18) / 2;
    const quadH = (pageH - quadY - 70 - 18) / 2;
    const quadrants = [
      { title: t.section1, items: lang === 'en' ? [
        '1 complete lead magnet (PDF + videos)',
        '12 Reel scripts',
        '3 Instagram carousels',
        '21 pre-written stories',
        '12 nurture + launch emails',
        'Long-form sales page',
        'All ad copy (Meta + TikTok)',
      ] : [
        '1 Lead magnet completo (PDF + vídeos)',
        '12 guiões de Reels',
        '3 carrosséis de Instagram',
        '21 stories pré-escritas',
        '12 emails de nurture e lançamento',
        'Sales page long-form',
        'Copy de todos os ads (Meta + TikTok)',
      ]},
      { title: t.section2, items: lang === 'en' ? [
        'Lead magnet professionally designed',
        'Waitlist landing page',
        'Masterclass page',
        'Sales page with embedded video',
        'Checkout + upsell pages',
        '10 ad creatives (6 videos + 4 carousels)',
        'Community visual identity',
      ] : [
        'Lead magnet maquetado profissionalmente',
        'Landing page de waitlist',
        'Página da masterclass',
        'Sales page com vídeo embutido',
        'Páginas de checkout e upsell',
        '10 criativos de ads (6 vídeos + 4 carrosséis)',
        'Identidade visual da comunidade',
      ]},
      { title: t.section3, items: lang === 'en' ? [
        'Community platform configured',
        'Email marketing system (sequences + tags)',
        'Stripe + optimized checkout',
        'Pixel + tracking + UTMs',
        'Meta + TikTok campaign setup',
        'Automatic onboarding for new members',
        'Real-time metrics dashboard',
      ] : [
        'Plataforma da comunidade configurada',
        'Sistema de email marketing (sequências e tags)',
        'Stripe + checkout otimizado',
        'Pixel + tracking + UTMs',
        'Setup de campanhas Meta + TikTok',
        'Onboarding automático de novos membros',
        'Dashboard de métricas em tempo real',
      ]},
      { title: t.section4, items: lang === 'en' ? [
        'Complete 60-day editorial calendar',
        'Week-by-week roadmap',
        'Weekly 60min review meetings',
        'Direct WhatsApp access during business hours',
        'Metrics analysis and adjustments',
        'Post-launch retention plan',
        'Scale roadmap from month 3+',
      ] : [
        'Calendário editorial completo de 60 dias',
        'Roteiro semana a semana',
        'Reuniões semanais de revisão (60min)',
        'Acesso direto via WhatsApp em horário útil',
        'Análise de métricas e ajustes',
        'Plano de retenção pós-lançamento',
        'Roadmap de escala mês 3+',
      ]},
    ];
    quadrants.forEach((q, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = margin + col * (quadW + 18);
      const yy = quadY + row * (quadH + 18);
      card(x, yy, quadW, quadH, { border: BORDER_DIM, fill: BG_CARD });
      eyebrow(q.title, x + 22, yy + 32);
      bulletList(q.items, x + 22, yy + 56, quadW - 44, { size: 9.5, lineH: 13 });
    });
    pageFooter('', 7, TOTAL);

    // ═══════════════════════════════════════════════════════════════
    // PAGE 8 · SEMANA A SEMANA — full-width editorial table
    // ═══════════════════════════════════════════════════════════════
    doc.addPage();
    paintBackground('tr');
    topRightTag('SECONDLAYER');
    eyebrow(t.weekEyebrow, margin, 78);
    title(t.weekTitleA, t.weekTitleB, margin, 144);
    subtitle(t.weekSub, margin, 188, 880);

    const tableY = 232;
    const rowH = 38;
    const colWeek = 64, colPhase = 150;
    const colDescX = margin + colWeek + colPhase + 20;
    const colDescW = pageW - margin - colDescX;

    const weeks = lang === 'en' ? [
      ['W1', 'WARM-UP',    'Tech setup · waitlist landing page · lead magnet finalized · active pixel'],
      ['W2', 'WARM-UP',    'Organic content starts · 3 Reels · 1 carousel · first Live'],
      ['W3', 'WARM-UP',    'Intensive content · daily stories · first 800-1000 emails on waitlist'],
      ['W4', 'CAPTURE',    'Waitlist nurturing starts · emails 1, 2 and 3 sent · community platform ready'],
      ['W5', 'CAPTURE',    'Founding members invite · €14 beta offer · first 50 members'],
      ['W6', 'CAPTURE',    'Beta close · 100 founding members · testimonials collected · offer refined'],
      ['W7', 'CONVERSION', 'Pre-launch · 3 warm-up emails · ads on in cold-traffic mode'],
      ['W8', 'CONVERSION', 'Live masterclass · cart opens · sales sequence · ad scaling'],
    ] : [
      ['S1', 'AQUECIMENTO','Setup técnico · landing page de waitlist · lead magnet finalizado · pixel ativo'],
      ['S2', 'AQUECIMENTO','Início do conteúdo orgânico · 3 Reels · 1 carrossel · primeira Live'],
      ['S3', 'AQUECIMENTO','Conteúdo intensivo · stories diários · primeiros 800-1000 emails na waitlist'],
      ['S4', 'CAPTAÇÃO',   'Início da nutrição da waitlist · emails 1, 2 e 3 enviados · plataforma da comunidade pronta'],
      ['S5', 'CAPTAÇÃO',   'Convite founding members · oferta beta a €14 · primeiros 50 membros'],
      ['S6', 'CAPTAÇÃO',   'Fecho do beta · 100 founding members · recolha de testimonials · refinamento da oferta'],
      ['S7', 'CONVERSÃO',  'Pré-lançamento · 3 emails de aquecimento · ads ligados em modo de tráfego frio'],
      ['S8', 'CONVERSÃO',  'Masterclass ao vivo · carrinho abre · sequência de vendas · escala de ads'],
    ];
    weeks.forEach((row, i) => {
      const yy = tableY + i * rowH;
      // Subtle row band — alternates between two dark shades.
      setFill(i % 2 === 0 ? BG_CARD : BG_DARK);
      doc.rect(margin, yy, pageW - margin * 2, rowH, 'F');
      // Bottom divider
      setDraw(BORDER_DIM); doc.setLineWidth(0.4);
      doc.line(margin, yy + rowH, pageW - margin, yy + rowH);
      // Week label — italic serif
      doc.setFont(SERIF, SERIF_STYLE);
      doc.setFontSize(20);
      setText(TEXT_WHITE);
      doc.text(row[0], margin + colWeek / 2, yy + rowH / 2 + 6, { align: 'center' });
      // Phase chip
      const phase = row[1];
      const chipShade = phase.includes('AQU') || phase.includes('WARM') ? [60, 18, 24]
        : phase.includes('CAPT') ? [85, 22, 30]
        : RED_DEEP;
      setFill(chipShade); setDraw(RED); doc.setLineWidth(0.5);
      doc.roundedRect(margin + colWeek + 8, yy + 9, colPhase - 16, rowH - 18, 4, 4, 'FD');
      doc.setFont(MONO, 'bold');
      doc.setFontSize(8.5);
      setText(TEXT_WHITE);
      try { doc.setCharSpace(1.2); } catch (e) {}
      doc.text(phase, margin + colWeek + colPhase / 2, yy + rowH / 2 + 3, { align: 'center' });
      try { doc.setCharSpace(0); } catch (e) {}
      // Description
      doc.setFont(SANS, 'normal');
      doc.setFontSize(9.5);
      setText(TEXT_GRAY);
      doc.text(row[2], colDescX, yy + rowH / 2 + 3, { maxWidth: colDescW });
    });
    pageFooter(t.weekFooter, 8, TOTAL);

    // ─── Output ───
    const buffer = Buffer.from(doc.output('arraybuffer'));
    const safeName = (commName || creator?.name || 'launch-plan').replace(/[^a-z0-9]+/gi, '-');
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeName}-launch-plan.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to generate launch plan', details: err.message }, { status: 500 });
  }
}
