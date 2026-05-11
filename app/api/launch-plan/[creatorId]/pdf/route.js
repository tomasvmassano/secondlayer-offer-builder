import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { getCreator } from '../../../../lib/creators';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────────────
// Launch-Plan PDF generator
//
// Produces an 8-page Lia-style action plan for the creator. Designed to
// be sent BETWEEN calls — the asset that closes the deal when the creator
// is alone reviewing the proposal.
//
// Auto-populates from:
//   - creator.offer.parsed.community.weeklyFormats / library  (Section K of offer)
//   - creator.offer.parsed.community.primaryName, platform, tiers
//   - creator.intelligence.topPosts (audience signals → themes)
//   - creator.revenuePrice, audience estimate
//
// Falls back to sensible templated copy when offer fields are empty.
// ─────────────────────────────────────────────────────────────────

const RED = [177, 30, 47];
const GREEN = [31, 138, 76];
const TEXT_DARK = [25, 25, 25];
const TEXT_MUTED = [120, 120, 120];
const TEXT_LIGHT = [180, 180, 180];

// PT/EN copy helper.
const COPY = {
  pt: {
    title: 'Como vamos lançar o teu negócio',
    subtitle: 'Roadmap completo · do aquecimento de audiência ao lançamento da comunidade',
    fixedPlan: 'PLANO DE EXECUÇÃO · 60 DIAS',
    phasesEyebrow: 'VISÃO GERAL',
    phasesTitle: '60 dias. 3 fases.',
    phasesSubtitle: 'Cada fase tem objetivo claro, assets concretos e métricas para validar antes de avançar.',
    phaseNames: ['Topo de funil', 'Meio de funil', 'Fundo de funil'],
    phaseEyebrows: ['AQUECIMENTO', 'CAPTAÇÃO', 'CONVERSÃO'],
    phaseDays: ['DIAS 1–21', 'DIAS 22–42', 'DIAS 43–60'],
    metaLabel: 'META',
    weeklyEyebrow: 'DIAGNÓSTICO',
    weeklyTitle: 'O que vamos lançar',
    objectives: 'OBJETIVOS',
    organicContent: 'CONTEÚDO ORGÂNICO',
    emailSequence: 'SEQUÊNCIA DE EMAILS',
    launchSequence: 'SEQUÊNCIA DE LANÇAMENTO',
    paidTraffic: 'TRÁFEGO PAGO',
    assets: 'ASSETS QUE ENTREGAMOS',
    deliverablesTitle: 'Tudo o que construímos.',
    deliverablesSubtitle: 'Inventário completo dos assets que entregamos durante os 60 dias. Tudo é teu para sempre.',
    weekTitle: 'Semana a semana.',
    weekSubtitle: 'Visão concreta do que acontece em cada uma das 8 semanas.',
    weekFooter: 'Cada semana tem reunião de revisão · ajustamos com base em dados reais, não em achismos.',
    valFooter: 'Validação obrigatória entre fases · não avançamos se a anterior não bater métricas mínimas.',
    confidential: 'CONFIDENCIAL',
    library: 'BIBLIOTECA PRÉ-GRAVADA',
    weeklyContent: 'CONTEÚDO SEMANAL',
    section1: 'COPY & CONTEÚDO',
    section2: 'DESIGN & VISUAL',
    section3: 'TÉCNICO & AUTOMAÇÃO',
    section4: 'ESTRATÉGIA & SUPORTE',
    expected: 'Resultado esperado',
  },
  en: {
    title: 'How we launch your business',
    subtitle: 'Complete roadmap · from audience warm-up to community launch',
    fixedPlan: 'EXECUTION PLAN · 60 DAYS',
    phasesEyebrow: 'OVERVIEW',
    phasesTitle: '60 days. 3 phases.',
    phasesSubtitle: 'Each phase has a clear objective, concrete assets and metrics to validate before advancing.',
    phaseNames: ['Top of funnel', 'Middle of funnel', 'Bottom of funnel'],
    phaseEyebrows: ['WARM-UP', 'CAPTURE', 'CONVERSION'],
    phaseDays: ['DAYS 1–21', 'DAYS 22–42', 'DAYS 43–60'],
    metaLabel: 'GOAL',
    weeklyEyebrow: 'DIAGNOSTIC',
    weeklyTitle: 'What we will launch',
    objectives: 'OBJECTIVES',
    organicContent: 'ORGANIC CONTENT',
    emailSequence: 'EMAIL SEQUENCE',
    launchSequence: 'LAUNCH SEQUENCE',
    paidTraffic: 'PAID TRAFFIC',
    assets: 'ASSETS WE DELIVER',
    deliverablesTitle: 'Everything we build.',
    deliverablesSubtitle: 'Complete inventory of assets delivered during the 60 days. Yours forever.',
    weekTitle: 'Week by week.',
    weekSubtitle: 'Concrete view of what happens in each of the 8 weeks.',
    weekFooter: 'Each week has a review meeting · we adjust based on real data, not guesses.',
    valFooter: 'Mandatory validation between phases · we don\'t advance if previous one misses targets.',
    confidential: 'CONFIDENTIAL',
    library: 'PRE-RECORDED LIBRARY',
    weeklyContent: 'WEEKLY CONTENT',
    section1: 'COPY & CONTENT',
    section2: 'DESIGN & VISUAL',
    section3: 'TECH & AUTOMATION',
    section4: 'STRATEGY & SUPPORT',
    expected: 'Expected outcome',
  },
};

// Roughly estimate the funnel goals from the creator's audience size + price.
function deriveGoals(audience, price, lang) {
  // Conservative: 0.15-0.2% of audience becomes waitlist leads in 21 days,
  // 5-7% of waitlist converts to founding members, scaled into 300 paid by D60.
  const a = Number(audience) || 100000;
  const waitlistLeads = Math.max(500, Math.round(a * 0.0017 / 100) * 100);
  const foundingMembers = Math.max(60, Math.round(waitlistLeads * 0.065 / 10) * 10);
  const paidMembers = Math.max(150, Math.round(foundingMembers * 3.0 / 10) * 10);
  if (lang === 'en') {
    return [
      `${waitlistLeads.toLocaleString('en-US')} leads on waitlist`,
      `${foundingMembers} founding members confirmed`,
      `${paidMembers} paid members`,
    ];
  }
  return [
    `${waitlistLeads.toLocaleString('pt-PT')} leads na waitlist`,
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
    const topPosts = (creator?.intelligence?.topPosts || []).slice(0, 5);
    const audience = creator?.revenueAudience || creator?.platforms?.instagram?.followers || 100000;
    const price = Number(creator?.revenuePrice) || 19;
    const goals = deriveGoals(audience, price, lang);
    const commName = community.primaryName || creator?.name || '';

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;

    // ── Helpers ──
    const setFill = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    const setText = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    const setDraw = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

    function pageHeader(eyebrow, pageNum, totalPages) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setText(RED);
      doc.text(eyebrow, margin, 30);
      doc.setFont('helvetica', 'normal');
      setText(TEXT_MUTED);
      doc.text(`${commName}`, pageW - margin, 30, { align: 'right' });
      // Page number bottom right
      doc.setFontSize(8);
      setText(TEXT_MUTED);
      doc.text(`${String(pageNum).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`, pageW - margin, pageH - 20, { align: 'right' });
    }

    function bigTitle(text, italicPart, y) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(34);
      setText(TEXT_DARK);
      const w = doc.getTextWidth(text);
      doc.text(text, margin, y);
      if (italicPart) {
        doc.setFont('times', 'bolditalic');
        setText(RED);
        doc.text(' ' + italicPart, margin + w, y);
      }
    }

    function eyebrowText(text, y, color = RED) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setText(color);
      doc.text(text, margin, y);
    }

    function subtitleText(text, y, maxWidth) {
      doc.setFont('times', 'italic');
      doc.setFontSize(11);
      setText(TEXT_MUTED);
      const lines = doc.splitTextToSize(text, maxWidth || pageW - margin * 2);
      doc.text(lines, margin, y);
    }

    function card(x, y, w, h, opts = {}) {
      const { border = [40, 40, 40], bg = null, radius = 6 } = opts;
      if (bg) { setFill(bg); doc.roundedRect(x, y, w, h, radius, radius, 'F'); }
      setDraw(border);
      doc.setLineWidth(0.6);
      doc.roundedRect(x, y, w, h, radius, radius, 'S');
    }

    function bulletList(items, x, y, w, opts = {}) {
      const { size = 9, lineH = 13, dotColor = RED, textColor = TEXT_DARK } = opts;
      doc.setFontSize(size);
      let cy = y;
      items.forEach(item => {
        if (!item) return;
        setFill(dotColor);
        doc.circle(x + 3, cy - 3, 1.5, 'F');
        doc.setFont('helvetica', 'normal');
        setText(textColor);
        const lines = doc.splitTextToSize(String(item), w - 12);
        doc.text(lines, x + 10, cy);
        cy += lineH * lines.length;
      });
      return cy;
    }

    // ─── PAGE 1: COVER ───
    setFill([10, 10, 10]);
    doc.rect(0, 0, pageW, pageH, 'F');
    // Top tag
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setText(RED);
    doc.text(`● ${t.fixedPlan}`, margin, 50);
    // Big title — split across 2 lines
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(60);
    setText([245, 245, 245]);
    const titleY = pageH / 2 - 30;
    const title1 = lang === 'en' ? 'How we launch' : 'Como vamos';
    const title2 = lang === 'en' ? 'your business' : 'lançar o teu negócio';
    doc.text(title1, margin, titleY);
    // Italic second line
    doc.setFont('times', 'bolditalic');
    setText(RED);
    const w1 = doc.getTextWidth(lang === 'en' ? 'launch' : 'lançar');
    doc.setFont('helvetica', 'bold');
    setText([245, 245, 245]);
    doc.text(title2, margin, titleY + 64);
    // Subtitle
    doc.setFont('times', 'italic');
    doc.setFontSize(14);
    setText([180, 180, 180]);
    doc.text(t.subtitle, margin, titleY + 100);
    // Creator name bottom
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setText(TEXT_MUTED);
    doc.text((creator?.name || '').toUpperCase(), margin, pageH - 50);
    setText(RED);
    doc.text(t.confidential + ' · 001', pageW - margin, pageH - 50, { align: 'right' });

    // ─── PAGE 2: 3 PHASES OVERVIEW ───
    doc.addPage();
    pageHeader(t.phasesEyebrow, 2, 8);
    eyebrowText(t.phasesEyebrow, 60);
    bigTitle('60 ' + (lang === 'en' ? 'days.' : 'dias.'), '3 ' + (lang === 'en' ? 'phases.' : 'fases.'), 100);
    subtitleText(t.phasesSubtitle, 130, pageW - margin * 2);

    // 3 phase cards
    const phaseY = 175;
    const phaseH = 280;
    const phaseW = (pageW - margin * 2 - 24) / 3;
    for (let i = 0; i < 3; i++) {
      const x = margin + i * (phaseW + 12);
      card(x, phaseY, phaseW, phaseH, { border: [80, 30, 40] });
      // Eyebrow
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setText(RED);
      doc.text(t.phaseEyebrows[i], x + 16, phaseY + 26);
      // Phase title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      setText(TEXT_DARK);
      doc.text(t.phaseNames[i], x + 16, phaseY + 56);
      // Big italic number
      doc.setFont('times', 'italic');
      doc.setFontSize(56);
      setText([240, 210, 215]);
      doc.text(`0${i + 1}`, x + phaseW - 50, phaseY + 56);
      // Days
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setText(TEXT_MUTED);
      doc.text(t.phaseDays[i], x + 16, phaseY + 80);
      // Description
      const descriptions = lang === 'en' ? [
        'Reactivate the cold audience. Build waitlist with high-conversion lead magnet.',
        'Nurture the list with email sequence. Create desire. Validate offer with founding-member beta.',
        'Live masterclass launch. Sales page opens. Ads scale. Cart open for 5 days.',
      ] : [
        'Reactivar a audiência fria. Construir lista de espera com lead magnet de alta conversão.',
        'Nutrir a lista com sequência de emails. Criar desejo. Validar oferta com beta de founding members.',
        'Masterclass ao vivo de lançamento. Sales page aberta. Anúncios em escala. Carrinho aberto 5 dias.',
      ];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setText([60, 60, 60]);
      const dLines = doc.splitTextToSize(descriptions[i], phaseW - 32);
      doc.text(dLines, x + 16, phaseY + 110);
      // Meta box
      const metaY = phaseY + phaseH - 70;
      setFill([252, 230, 235]);
      setDraw(RED);
      doc.setLineWidth(0.8);
      doc.roundedRect(x + 16, metaY, phaseW - 32, 50, 4, 4, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setText(RED);
      doc.text(t.metaLabel, x + 24, metaY + 18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      setText(TEXT_DARK);
      const goalLines = doc.splitTextToSize(goals[i], phaseW - 48);
      doc.text(goalLines, x + 24, metaY + 34);
    }
    // Footer
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    setText(TEXT_MUTED);
    doc.text(t.valFooter, margin, pageH - 35);

    // ─── PAGE 3: O QUE VAMOS LANÇAR (weekly content + library) ───
    doc.addPage();
    pageHeader(t.weeklyEyebrow, 3, 8);
    eyebrowText(t.weeklyEyebrow, 60);
    bigTitle(lang === 'en' ? 'What' : 'O que', lang === 'en' ? 'we will launch' : 'vamos lançar', 100);
    subtitleText(
      lang === 'en'
        ? `${commName} — monthly community at €${price}/mo. The exact weekly content + pre-recorded vault we'll be shipping.`
        : `${commName} — comunidade mensal a €${price}/mês. O conteúdo semanal exato + biblioteca pré-gravada que vamos lançar.`,
      130, pageW - margin * 2
    );

    // Weekly formats grid 2x2
    const wfY = 165;
    const wfW = (pageW - margin * 2 - 14) / 2;
    const wfH = 95;
    eyebrowText(t.weeklyContent, wfY - 8);
    weeklyFormats.slice(0, 4).forEach((f, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = margin + col * (wfW + 14);
      const y = wfY + row * (wfH + 12);
      card(x, y, wfW, wfH, { border: [80, 30, 40] });
      // Day + name row
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setText(RED);
      doc.text((f.day || '').toUpperCase(), x + 14, y + 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      setText(TEXT_DARK);
      doc.text(' — ' + (f.name || ''), x + 14 + doc.getTextWidth((f.day || '').toUpperCase()), y + 22);
      // Type
      if (f.type) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        setText(TEXT_MUTED);
        doc.text(f.type, x + 14, y + 38);
      }
      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setText([60, 60, 60]);
      const lines = doc.splitTextToSize(f.desc || '', wfW - 28);
      doc.text(lines, x + 14, y + 56);
    });

    // Library grid 3x2
    const libY = wfY + 2 * (wfH + 12) + 30;
    eyebrowText(t.library, libY - 8, GREEN);
    const libW = (pageW - margin * 2 - 24) / 3;
    const libH = 60;
    library.slice(0, 6).forEach((m, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = margin + col * (libW + 12);
      const y = libY + row * (libH + 10);
      card(x, y, libW, libH, { border: [30, 100, 60] });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      setText(GREEN);
      doc.text((m.format || '').toUpperCase(), x + 12, y + 18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      setText(TEXT_DARK);
      const nameLines = doc.splitTextToSize(m.name || '', libW - 24);
      doc.text(nameLines, x + 12, y + 34);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setText([90, 90, 90]);
      const dLines = doc.splitTextToSize(m.desc || '', libW - 24);
      doc.text(dLines.slice(0, 1), x + 12, y + 50);
    });

    // ─── PAGE 4: FASE 01 · TOPO DE FUNIL ───
    doc.addPage();
    pageHeader(`FASE 01 · ${t.phaseEyebrows[0]}`, 4, 8);
    eyebrowText(`FASE 01 · ${t.phaseEyebrows[0]}`, 60);
    bigTitle(lang === 'en' ? 'Top' : 'Topo', lang === 'en' ? 'of funnel' : 'de funil', 100);
    subtitleText(
      lang === 'en'
        ? 'Reactivate audience. Capture emails. Build desire for the community before selling.'
        : 'Reativar audiência. Capturar emails. Construir desejo pela comunidade antes de a vender.',
      130, pageW - margin * 2
    );
    // Days pill top right
    const pillY = 90, pillW = 110, pillH = 32;
    setFill([252, 230, 235]); setDraw(RED); doc.setLineWidth(0.8);
    doc.roundedRect(pageW - margin - pillW, pillY, pillW, pillH, 4, 4, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setText(RED);
    doc.text(t.phaseDays[0], pageW - margin - pillW / 2, pillY + 21, { align: 'center' });

    // 3-column body
    const bodyY = 170;
    const bodyH = pageH - bodyY - 70;
    const colW = (pageW - margin * 2 - 24) / 3;
    [
      { title: t.objectives, items: lang === 'en' ? [
        `Reactivate engagement from baseline to 1.5%`,
        `Capture ${goals[0]}`,
        `Position ${creator?.name || 'creator'} as authority #1`,
      ] : [
        `Reactivar engagement da baseline para 1.5%`,
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
        'Email capture system + auto-tagging',
        'Weekly metrics dashboard',
      ] : [
        'Lead magnet (PDF + vídeos)',
        'Landing page de waitlist (copy + design + tracking)',
        'Guiões para 9 Reels + 3 carrosséis',
        'Sistema de captura de emails + tagging automático',
        'Dashboard de métricas semanais',
      ]},
    ].forEach((col, i) => {
      const x = margin + i * (colW + 12);
      card(x, bodyY, colW, bodyH, { border: [60, 60, 60] });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setText(RED);
      doc.text(col.title, x + 16, bodyY + 24);
      bulletList(col.items, x + 16, bodyY + 48, colW - 32, { size: 9.5, lineH: 14 });
    });
    // Footer
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    setText(TEXT_MUTED);
    doc.text(
      lang === 'en'
        ? `Validation to advance to Phase 2 · ${goals[0]} by end of day 21.`
        : `Validação para avançar à Fase 2 · ${goals[0]} no final do dia 21.`,
      margin, pageH - 35
    );

    // ─── PAGE 5: FASE 02 · MEIO DE FUNIL ───
    doc.addPage();
    pageHeader(`FASE 02 · ${t.phaseEyebrows[1]}`, 5, 8);
    eyebrowText(`FASE 02 · ${t.phaseEyebrows[1]}`, 60);
    bigTitle(lang === 'en' ? 'Middle' : 'Meio', lang === 'en' ? 'of funnel' : 'de funil', 100);
    subtitleText(
      lang === 'en'
        ? 'Nurture the waitlist with email sequence. Validate offer with beta. Create real urgency for launch.'
        : 'Nutrir a waitlist com sequência de emails. Validar oferta com beta. Criar urgência real para o lançamento.',
      130, pageW - margin * 2
    );
    setFill([252, 230, 235]); setDraw(RED); doc.setLineWidth(0.8);
    doc.roundedRect(pageW - margin - pillW, pillY, pillW, pillH, 4, 4, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setText(RED);
    doc.text(t.phaseDays[1], pageW - margin - pillW / 2, pillY + 21, { align: 'center' });

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
        'Community platform configured (Circle / Skool)',
        'Testimonial collection system',
      ] : [
        '7 emails completos (copy + design + automação)',
        'Página beta founding members (acesso restrito)',
        'Sistema de pagamento Stripe + checkout',
        'Onboarding sequence para os primeiros 100',
        `Plataforma da comunidade configurada (${community.platform || 'Circle / Skool'})`,
        'Sistema de recolha de testimonials',
      ]},
    ].forEach((col, i) => {
      const x = margin + i * (colW + 12);
      card(x, bodyY, colW, bodyH, { border: [60, 60, 60] });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setText(RED);
      doc.text(col.title, x + 16, bodyY + 24);
      bulletList(col.items, x + 16, bodyY + 48, colW - 32, { size: 9, lineH: 13 });
    });
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    setText(TEXT_MUTED);
    doc.text(
      lang === 'en'
        ? `Validation to advance to Phase 3 · ${goals[1]} by end of day 42.`
        : `Validação para avançar à Fase 3 · ${goals[1]} no final do dia 42.`,
      margin, pageH - 35
    );

    // ─── PAGE 6: FASE 03 · FUNDO DE FUNIL ───
    doc.addPage();
    pageHeader(`FASE 03 · ${t.phaseEyebrows[2]}`, 6, 8);
    eyebrowText(`FASE 03 · ${t.phaseEyebrows[2]}`, 60);
    bigTitle(lang === 'en' ? 'Bottom' : 'Fundo', lang === 'en' ? 'of funnel' : 'de funil', 100);
    subtitleText(
      lang === 'en'
        ? 'Public launch. Cart open 5 days. Ads scaling. Maximum conversion.'
        : 'Lançamento público. Carrinho aberto 5 dias. Anúncios em escala. Conversão máxima.',
      130, pageW - margin * 2
    );
    setFill([252, 230, 235]); setDraw(RED); doc.setLineWidth(0.8);
    doc.roundedRect(pageW - margin - pillW, pillY, pillW, pillH, 4, 4, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setText(RED);
    doc.text(t.phaseDays[2], pageW - margin - pillW / 2, pillY + 21, { align: 'center' });

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
        'Meta Ads campaigns · €50/day initial, scale to €200/day',
        'TikTok Ads campaigns · €30/day (younger audience)',
        'Retargeting sales-page visitors',
        'Lookalike audiences from founding members',
        'Creatives: 6 videos + 4 carousels',
        'Total estimated budget: €4,000-6,000',
      ] : [
        'Campanhas Meta Ads · €50/dia inicial, escala até €200/dia',
        'Campanhas TikTok Ads · €30/dia (audiência mais jovem)',
        'Retargeting visitantes da sales page',
        'Lookalike audiences a partir dos founding members',
        'Criativos: 6 vídeos + 4 carrosséis',
        'Budget total estimado: €4,000-6,000',
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
    ].forEach((col, i) => {
      const x = margin + i * (colW + 12);
      card(x, bodyY, colW, bodyH, { border: [60, 60, 60] });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setText(RED);
      doc.text(col.title, x + 16, bodyY + 24);
      bulletList(col.items, x + 16, bodyY + 48, colW - 32, { size: 9, lineH: 12 });
    });
    const expectedMRR = Math.round(price * (Number(goals[2].replace(/[^0-9]/g, '')) || 300));
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    setText(TEXT_MUTED);
    doc.text(
      lang === 'en'
        ? `${t.expected} · ${goals[2]} · €${expectedMRR.toLocaleString('en-US')} MRR by end of day 60.`
        : `${t.expected} · ${goals[2]} · €${expectedMRR.toLocaleString('pt-PT')} MRR no fim do dia 60.`,
      margin, pageH - 35
    );

    // ─── PAGE 7: TUDO O QUE CONSTRUÍMOS (deliverables 2x2 quadrants) ───
    doc.addPage();
    pageHeader(lang === 'en' ? 'DELIVERABLES' : 'ENTREGÁVEIS', 7, 8);
    eyebrowText(lang === 'en' ? 'DELIVERABLES' : 'ENTREGÁVEIS', 60);
    bigTitle(lang === 'en' ? 'Everything' : 'Tudo o que', lang === 'en' ? 'we build.' : 'construímos.', 100);
    subtitleText(t.deliverablesSubtitle, 130, pageW - margin * 2);

    const quadY = 175;
    const quadW = (pageW - margin * 2 - 16) / 2;
    const quadH = (pageH - quadY - 70 - 16) / 2;
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
      const x = margin + col * (quadW + 16);
      const y = quadY + row * (quadH + 16);
      card(x, y, quadW, quadH, { border: [60, 60, 60] });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setText(RED);
      doc.text(q.title, x + 16, y + 24);
      bulletList(q.items, x + 16, y + 44, quadW - 32, { size: 8.5, lineH: 12 });
    });

    // ─── PAGE 8: SEMANA A SEMANA ───
    doc.addPage();
    pageHeader('ROADMAP', 8, 8);
    eyebrowText('ROADMAP', 60);
    bigTitle(lang === 'en' ? 'Week' : 'Semana', lang === 'en' ? 'by week.' : 'a semana.', 100);
    subtitleText(t.weekSubtitle, 130, pageW - margin * 2);

    // Table
    const tableY = 170;
    const rowH = 36;
    const colWeek = 60, colPhase = 140, colDesc = pageW - margin * 2 - colWeek - colPhase - 32;
    const weeks = lang === 'en' ? [
      ['W1', 'WARM-UP', 'Tech setup · waitlist landing page · lead magnet finalized · active pixel'],
      ['W2', 'WARM-UP', 'Organic content starts · 3 Reels · 1 carousel · first Live'],
      ['W3', 'WARM-UP', 'Intensive content · daily stories · first 800-1000 emails on waitlist'],
      ['W4', 'CAPTURE', 'Waitlist nurturing starts · emails 1, 2 and 3 sent · community platform ready'],
      ['W5', 'CAPTURE', 'Founding members invite · €14 beta offer · first 50 members'],
      ['W6', 'CAPTURE', 'Beta close · 100 founding members · testimonials collected · offer refined'],
      ['W7', 'CONVERSION', 'Pre-launch · 3 warm-up emails · ads on in cold-traffic mode'],
      ['W8', 'CONVERSION', 'Live masterclass · cart opens · sales sequence · ad scaling'],
    ] : [
      ['S1', 'AQUECIMENTO', 'Setup técnico · landing page de waitlist · lead magnet finalizado · pixel ativo'],
      ['S2', 'AQUECIMENTO', 'Início do conteúdo orgânico · 3 Reels · 1 carrossel · primeira Live'],
      ['S3', 'AQUECIMENTO', 'Conteúdo intensivo · stories diários · primeiros 800-1000 emails na waitlist'],
      ['S4', 'CAPTAÇÃO', 'Início da nutrição da waitlist · emails 1, 2 e 3 enviados · plataforma da comunidade pronta'],
      ['S5', 'CAPTAÇÃO', 'Convite founding members · oferta beta a €14 · primeiros 50 membros'],
      ['S6', 'CAPTAÇÃO', 'Fecho do beta · 100 founding members · recolha de testimonials · refinamento da oferta'],
      ['S7', 'CONVERSÃO', 'Pré-lançamento · 3 emails de aquecimento · ads ligados em modo de tráfego frio'],
      ['S8', 'CONVERSÃO', 'Masterclass ao vivo · carrinho abre · sequência de vendas · escala de ads'],
    ];
    weeks.forEach((row, i) => {
      const y = tableY + i * rowH;
      // Alternating background
      if (i % 2 === 0) {
        setFill([248, 248, 248]);
        doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
      }
      // Phase color chip
      const phaseColor = row[1].includes('AQU') || row[1].includes('WARM') ? [120, 30, 40]
        : row[1].includes('CAPT') ? RED
        : [200, 60, 75];
      setFill(phaseColor);
      doc.roundedRect(margin + colWeek + 8, y + 6, colPhase - 16, rowH - 12, 4, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setText([255, 255, 255]);
      doc.text(row[1], margin + colWeek + colPhase / 2, y + rowH / 2 + 3, { align: 'center' });
      // Week label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      setText(TEXT_DARK);
      doc.text(row[0], margin + colWeek / 2, y + rowH / 2 + 3, { align: 'center' });
      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setText([60, 60, 60]);
      doc.text(row[2], margin + colWeek + colPhase + 16, y + rowH / 2 + 3, { maxWidth: colDesc });
    });
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    setText(TEXT_MUTED);
    doc.text(t.weekFooter, margin, pageH - 35);

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
