import PptxGenJS from "pptxgenjs";

// ─────────────────────────────────────────────────────────────────
// PPTX EXPORT — 10 slides + optional slide 11 (Investimento)
// Dark theme (#0a0a0a), accent red #7A0E18, "Inter" font.
// Uses native pptxgenjs line chart for slide 7 (editable, vector).
// ─────────────────────────────────────────────────────────────────

const COLORS = {
  bg: "0a0a0a",
  surface: "141414",
  surfaceAlt: "1a1a1a",
  accent: "7A0E18",
  accentLight: "C94553",
  success: "22C55E",
  text: "F5F5F5",
  textMuted: "AAAAAA",
  textDim: "666666",
  textSubdim: "888888",
  border: "222222",
};

const FONT = "Inter";

const fmtEuro = (n) => "€" + Math.round(n || 0).toLocaleString("pt-PT");
const fmtNum = (n) => Math.round(n || 0).toLocaleString("pt-PT");

export async function POST(request) {
  try {
    const body = await request.json();
    const { slides, projections, audience, price, moderateYear12MRR, moderateCumulative, creator, showInvestimento } = body;

    if (!slides) {
      return new Response(JSON.stringify({ error: "Missing slides data" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // Compatibility shims — fill missing fields so the existing render code
    // (which references old field names) doesn't crash on the new shape.
    const lang = creator?.primaryLanguage === 'en' ? 'en' : 'pt';
    const labels = {
      today: lang === 'en' ? 'Today' : 'Hoje',
      withSL: lang === 'en' ? 'With Second Layer' : 'Com a Second Layer',
      build: lang === 'en' ? 'We Build (one time)' : 'Construímos (uma vez)',
      operate: lang === 'en' ? 'We Operate (every month)' : 'Operamos (todos os meses)',
      audience: lang === 'en' ? 'Estimated Audience' : 'Audiência Estimada',
      from: lang === 'en' ? 'FROM' : 'DE',
      to: lang === 'en' ? 'TO' : 'PARA',
      assumptions: lang === 'en' ? 'Assumptions (live editable)' : 'Premissas (ajustáveis ao vivo)',
      youKey: lang === 'en' ? 'You' : 'Tu',
      usKey: lang === 'en' ? 'Us' : 'Nós',
      setupNote: lang === 'en' ? 'One-time investment' : 'Investimento único',
      commissionNote: lang === 'en' ? 'Monthly revenue share' : 'Revenue share mensal',
      includedTitle: lang === 'en' ? 'What\'s included' : 'O que está incluído',
    };
    // Fill safe defaults for fields removed/renamed in the new design
    if (slides.audience && slides.audience.closer === undefined) slides.audience.closer = '';
    if (slides.close) {
      slides.close.body1 = slides.close.body1 || '';
      slides.close.body2 = slides.close.body2 || '';
      slides.close.cta = slides.close.cta || '';
      slides.close.bottom = slides.close.bottom || '';
    }
    if (slides.buildOperate && !slides.buildOperate.title) {
      slides.buildOperate.title = lang === 'en' ? 'What We Build & Operate' : 'O Que Construímos + O Que Operamos';
    }

    const pres = new PptxGenJS();
    pres.layout = "LAYOUT_WIDE"; // 16:9, 13.33 x 7.5 inches
    pres.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });

    const W = 13.33, H = 7.5;

    // Helper to apply dark background
    const newSlide = () => {
      const s = pres.addSlide();
      s.background = { color: COLORS.bg };
      return s;
    };

    // ═══════════════════════════════════════════════
    // SLIDE 1: COVER
    // ═══════════════════════════════════════════════
    {
      const s = newSlide();
      s.addText(`Second Layer × ${creator?.name || slides.cover.title}`, {
        x: 0.5, y: 0.6, w: W - 1, h: 0.4,
        fontFace: FONT, fontSize: 12, color: COLORS.accent, bold: true,
        align: "center", charSpacing: 5,
      });
      s.addText(slides.cover.title, {
        x: 0.5, y: H / 2 - 1.2, w: W - 1, h: 1.6,
        fontFace: FONT, fontSize: 72, color: COLORS.text, bold: true,
        align: "center", valign: "middle",
      });
      s.addShape(pres.ShapeType.rect, {
        x: W / 2 - 0.4, y: H / 2 + 0.6, w: 0.8, h: 0.04,
        fill: { color: COLORS.accent }, line: { type: "none" },
      });
      s.addText(slides.cover.subtitle, {
        x: 0.5, y: H / 2 + 0.9, w: W - 1, h: 0.5,
        fontFace: FONT, fontSize: 18, color: COLORS.textSubdim,
        align: "center",
      });
    }

    // ═══════════════════════════════════════════════
    // SLIDE 2: CORE PROMISE (NEW)
    // ═══════════════════════════════════════════════
    if (slides.corePromise) {
      const s = newSlide();
      s.addText(slides.corePromise.eyebrow || '', {
        x: 0.5, y: 1.8, w: W - 1, h: 0.5,
        fontFace: FONT, fontSize: 14, color: COLORS.accent, bold: true,
        align: "center", charSpacing: 7,
      });
      s.addText(slides.corePromise.headline || '', {
        x: 1, y: 2.6, w: W - 2, h: 2.4,
        fontFace: FONT, fontSize: 48, color: COLORS.text, bold: true,
        align: "center", valign: "middle",
      });
      s.addShape(pres.ShapeType.rect, {
        x: W / 2 - 0.3, y: 5.2, w: 0.6, h: 0.03,
        fill: { color: COLORS.accent }, line: { type: "none" },
      });
      s.addText(slides.corePromise.sub || '', {
        x: 1, y: 5.5, w: W - 2, h: 0.8,
        fontFace: FONT, fontSize: 22, color: COLORS.textMuted, italic: true,
        align: "center",
      });
    }

    // ═══════════════════════════════════════════════
    // SLIDE 3: TRANSFORMATION
    // ═══════════════════════════════════════════════
    {
      const s = newSlide();
      s.addText(slides.transformation.title, {
        x: 0.8, y: 0.6, w: W - 1.6, h: 0.9,
        fontFace: FONT, fontSize: 32, color: COLORS.text, bold: true,
      });

      // Before column
      s.addShape(pres.ShapeType.roundRect, {
        x: 0.8, y: 2, w: 5.7, h: 4.5, rectRadius: 0.15,
        fill: { color: COLORS.surface }, line: { color: COLORS.border, width: 0.5 },
      });
      s.addText("Hoje", {
        x: 1.1, y: 2.25, w: 5.1, h: 0.4,
        fontFace: FONT, fontSize: 11, color: COLORS.textDim, bold: true, charSpacing: 5,
      });
      slides.transformation.before.forEach((item, i) => {
        s.addText("×", {
          x: 1.1, y: 2.85 + i * 0.55, w: 0.3, h: 0.4,
          fontFace: FONT, fontSize: 18, color: COLORS.textDim,
        });
        s.addText(item, {
          x: 1.5, y: 2.85 + i * 0.55, w: 4.7, h: 0.4,
          fontFace: FONT, fontSize: 15, color: COLORS.textSubdim,
        });
      });

      // After column
      s.addShape(pres.ShapeType.roundRect, {
        x: 6.8, y: 2, w: 5.7, h: 4.5, rectRadius: 0.15,
        fill: { color: "1a0a0d" }, line: { color: COLORS.accent, width: 0.5, transparency: 60 },
      });
      s.addText("Com a Second Layer", {
        x: 7.1, y: 2.25, w: 5.1, h: 0.4,
        fontFace: FONT, fontSize: 11, color: COLORS.accent, bold: true, charSpacing: 5,
      });
      slides.transformation.after.forEach((item, i) => {
        s.addText("→", {
          x: 7.1, y: 2.85 + i * 0.55, w: 0.3, h: 0.4,
          fontFace: FONT, fontSize: 18, color: COLORS.accent,
        });
        s.addText(item, {
          x: 7.5, y: 2.85 + i * 0.55, w: 4.7, h: 0.4,
          fontFace: FONT, fontSize: 15, color: COLORS.text,
        });
      });
    }

    // ═══════════════════════════════════════════════
    // SLIDE 3: WHAT YOU GET
    // ═══════════════════════════════════════════════
    {
      const s = newSlide();
      s.addText(slides.whatYouGet.hero, {
        x: 0.8, y: 0.6, w: W - 1.6, h: 1.5,
        fontFace: FONT, fontSize: 40, color: COLORS.text, bold: true,
      });

      const pillars = slides.whatYouGet.pillars || [];
      const pillarW = 3.9, pillarH = 3.5, gap = 0.2;
      const startX = (W - (pillarW * 3 + gap * 2)) / 2;

      pillars.forEach((pillar, i) => {
        const x = startX + i * (pillarW + gap);
        s.addShape(pres.ShapeType.roundRect, {
          x, y: 2.6, w: pillarW, h: pillarH, rectRadius: 0.15,
          fill: { color: COLORS.surface }, line: { color: COLORS.border, width: 0.5 },
        });
        s.addText(`0${i + 1}`, {
          x: x + 0.3, y: 2.8, w: 1.5, h: 0.7,
          fontFace: FONT, fontSize: 32, color: COLORS.accent, bold: true,
        });
        s.addText(pillar.title, {
          x: x + 0.3, y: 3.7, w: pillarW - 0.6, h: 0.6,
          fontFace: FONT, fontSize: 18, color: COLORS.text, bold: true,
        });
        s.addText(pillar.desc, {
          x: x + 0.3, y: 4.4, w: pillarW - 0.6, h: 1.5,
          fontFace: FONT, fontSize: 12, color: COLORS.textMuted,
          valign: "top",
        });
      });

      if (slides.whatYouGet.closer) {
        s.addText(slides.whatYouGet.closer, {
          x: 1.5, y: 6.4, w: W - 3, h: 0.6,
          fontFace: FONT, fontSize: 13, color: COLORS.textSubdim, italic: true, align: "center",
        });
      }
    }

    // ═══════════════════════════════════════════════
    // SLIDE 4: AUDIENCE
    // ═══════════════════════════════════════════════
    {
      const s = newSlide();
      s.addText(slides.audience.title, {
        x: 0.8, y: 0.6, w: W - 1.6, h: 0.8,
        fontFace: FONT, fontSize: 32, color: COLORS.text, bold: true,
      });

      const metrics = [
        { label: "Audiência Total", value: formatFollowers(audience), accent: true },
        { label: "Plataforma", value: creator?.primaryPlatform || 'Instagram' },
        { label: "Engagement", value: creator?.engagement || 'N/A' },
        { label: "Nicho", value: creator?.niche || 'N/A' },
      ];

      const mW = 2.85, mH = 1.5, mGap = 0.2;
      const mStart = (W - (mW * 4 + mGap * 3)) / 2;
      metrics.forEach((m, i) => {
        const x = mStart + i * (mW + mGap);
        s.addShape(pres.ShapeType.roundRect, {
          x, y: 2, w: mW, h: mH, rectRadius: 0.12,
          fill: { color: m.accent ? "1a0a0d" : COLORS.surface },
          line: { color: m.accent ? COLORS.accent : COLORS.border, width: 0.5, transparency: m.accent ? 60 : 0 },
        });
        s.addText(m.label, {
          x: x + 0.25, y: 2.2, w: mW - 0.5, h: 0.3,
          fontFace: FONT, fontSize: 10, color: COLORS.textDim, bold: true, charSpacing: 5,
        });
        s.addText(m.value, {
          x: x + 0.25, y: 2.6, w: mW - 0.5, h: 0.8,
          fontFace: FONT, fontSize: 26, color: COLORS.text, bold: true,
        });
      });

      if (creator?.audienceEstimate) {
        const ae = creator.audienceEstimate;
        s.addShape(pres.ShapeType.roundRect, {
          x: 0.8, y: 4.1, w: W - 1.6, h: 1.8, rectRadius: 0.12,
          fill: { color: COLORS.surface }, line: { color: COLORS.border, width: 0.5 },
        });
        s.addText("Audiência Estimada", {
          x: 1.1, y: 4.3, w: 4, h: 0.3,
          fontFace: FONT, fontSize: 10, color: COLORS.textDim, bold: true, charSpacing: 5,
        });
        const items = [
          { label: "Idade", val: ae.age },
          { label: "Género", val: ae.gender },
          { label: "Localização", val: ae.location },
          { label: "Idioma", val: ae.language },
        ].filter(i => i.val);
        const iw = (W - 1.6) / items.length;
        items.forEach((it, idx) => {
          const ix = 0.8 + idx * iw + 0.3;
          s.addText(it.label, {
            x: ix, y: 4.9, w: iw - 0.3, h: 0.25,
            fontFace: FONT, fontSize: 10, color: COLORS.textDim,
          });
          s.addText(it.val, {
            x: ix, y: 5.15, w: iw - 0.3, h: 0.5,
            fontFace: FONT, fontSize: 13, color: COLORS.textMuted,
          });
        });
      }

      if (slides.audience.closer) {
        s.addText(slides.audience.closer, {
          x: 1.5, y: 6.4, w: W - 3, h: 0.6,
          fontFace: FONT, fontSize: 16, color: COLORS.text, bold: true, align: "center",
        });
      }
    }

    // ═══════════════════════════════════════════════
    // SLIDE 5: BUILD + OPERATE
    // ═══════════════════════════════════════════════
    {
      const s = newSlide();
      s.addText(slides.buildOperate.title, {
        x: 0.8, y: 0.5, w: W - 1.6, h: 0.8,
        fontFace: FONT, fontSize: 30, color: COLORS.text, bold: true,
      });

      // Build column
      s.addShape(pres.ShapeType.roundRect, {
        x: 0.8, y: 1.6, w: 5.9, h: 5.2, rectRadius: 0.15,
        fill: { color: COLORS.surface }, line: { color: COLORS.border, width: 0.5 },
      });
      s.addText("Construímos (uma vez)", {
        x: 1.1, y: 1.8, w: 5.3, h: 0.4,
        fontFace: FONT, fontSize: 11, color: COLORS.accent, bold: true, charSpacing: 5,
      });
      slides.buildOperate.build.forEach((item, i) => {
        s.addText([
          { text: item.title, options: { bold: true, color: COLORS.text, fontSize: 12 } },
          { text: ": " + item.desc, options: { color: COLORS.textMuted, fontSize: 12 } },
        ], {
          x: 1.1, y: 2.4 + i * 0.7, w: 5.3, h: 0.65,
          fontFace: FONT, valign: "top",
        });
      });

      // Operate column
      s.addShape(pres.ShapeType.roundRect, {
        x: 6.9, y: 1.6, w: 5.6, h: 5.2, rectRadius: 0.15,
        fill: { color: "0d1410" }, line: { color: COLORS.success, width: 0.5, transparency: 70 },
      });
      s.addText("Operamos (todos os meses)", {
        x: 7.2, y: 1.8, w: 5.0, h: 0.4,
        fontFace: FONT, fontSize: 11, color: COLORS.success, bold: true, charSpacing: 5,
      });
      slides.buildOperate.operate.slice(0, 8).forEach((item, i) => {
        s.addText(item, {
          x: 7.2, y: 2.4 + i * 0.55, w: 5.0, h: 0.5,
          fontFace: FONT, fontSize: 12, color: COLORS.textMuted, valign: "top",
        });
      });

      if (slides.buildOperate.closer) {
        s.addText(slides.buildOperate.closer, {
          x: 1.5, y: 7.0, w: W - 3, h: 0.4,
          fontFace: FONT, fontSize: 13, color: COLORS.text, bold: true, align: "center",
        });
      }
    }

    // ═══════════════════════════════════════════════
    // SLIDE 6: LAUNCH
    // ═══════════════════════════════════════════════
    {
      const s = newSlide();
      s.addText(slides.launch.title, {
        x: 0.8, y: 0.6, w: W - 1.6, h: 0.8,
        fontFace: FONT, fontSize: 32, color: COLORS.text, bold: true,
      });

      const phases = slides.launch.phases || [];
      const pW = 3.9, pH = 4, gap = 0.2;
      const pStart = (W - (pW * 3 + gap * 2)) / 2;

      phases.forEach((phase, i) => {
        const x = pStart + i * (pW + gap);
        s.addShape(pres.ShapeType.roundRect, {
          x, y: 2, w: pW, h: pH, rectRadius: 0.15,
          fill: { color: COLORS.surface }, line: { color: COLORS.border, width: 0.5 },
        });
        s.addText(String(i + 1), {
          x: x + pW - 1, y: 2.1, w: 0.8, h: 0.8,
          fontFace: FONT, fontSize: 46, color: COLORS.accent, bold: true, align: "right",
          transparency: 70,
        });
        s.addText(phase.title, {
          x: x + 0.3, y: 2.4, w: pW - 0.6, h: 0.6,
          fontFace: FONT, fontSize: 16, color: COLORS.text, bold: true,
        });
        s.addText(phase.desc, {
          x: x + 0.3, y: 3.15, w: pW - 0.6, h: 2.6,
          fontFace: FONT, fontSize: 12, color: COLORS.textMuted, valign: "top",
        });
      });

      if (slides.launch.closer) {
        s.addText(slides.launch.closer, {
          x: 1.5, y: 6.6, w: W - 3, h: 0.4,
          fontFace: FONT, fontSize: 13, color: COLORS.textSubdim, italic: true, align: "center",
        });
      }
    }

    // ═══════════════════════════════════════════════
    // SLIDE 7: NUMBERS + CHART (native line chart)
    // ═══════════════════════════════════════════════
    {
      const s = newSlide();
      s.addText(slides.numbers.title, {
        x: 0.8, y: 0.5, w: W - 1.6, h: 0.7,
        fontFace: FONT, fontSize: 26, color: COLORS.text, bold: true,
      });

      // Hero MRR
      s.addShape(pres.ShapeType.roundRect, {
        x: 0.8, y: 1.35, w: W - 1.6, h: 1.5, rectRadius: 0.15,
        fill: { color: "1a0a0d" }, line: { color: COLORS.accent, width: 0.5, transparency: 55 },
      });
      s.addText("Projeção Mês 12 · Cenário Moderado", {
        x: 0.8, y: 1.5, w: W - 1.6, h: 0.3,
        fontFace: FONT, fontSize: 11, color: COLORS.accent, bold: true, charSpacing: 5, align: "center",
      });
      s.addText([
        { text: fmtEuro(moderateYear12MRR), options: { fontSize: 54, color: COLORS.text, bold: true } },
        { text: "/mês", options: { fontSize: 18, color: COLORS.textSubdim } },
      ], {
        x: 0.8, y: 1.85, w: W - 1.6, h: 0.9,
        fontFace: FONT, align: "center", valign: "middle",
      });
      s.addText([
        { text: "Receita acumulada Ano 1: ", options: { color: COLORS.textSubdim } },
        { text: fmtEuro(moderateCumulative), options: { color: COLORS.text, bold: true } },
      ], {
        x: 0.8, y: 2.52, w: W - 1.6, h: 0.3,
        fontFace: FONT, fontSize: 12, align: "center",
      });

      // Native line chart
      const chartData = [];
      const monthLabels = Array.from({ length: 12 }, (_, i) => `M${i + 1}`);
      const scenarioOrder = ['agressivo', 'moderado', 'conservador'];
      const scenarioColors = { agressivo: COLORS.success, moderado: COLORS.accent, conservador: "888888" };

      scenarioOrder.forEach(key => {
        const scen = projections?.[key];
        if (!scen) return;
        chartData.push({
          name: scen.label,
          labels: monthLabels,
          values: scen.months.map(m => Math.round(m.mrr)),
        });
      });

      if (chartData.length > 0) {
        s.addChart(pres.ChartType.line, chartData, {
          x: 0.8, y: 3.1, w: W - 1.6, h: 3.4,
          chartColors: scenarioOrder.filter(k => projections?.[k]).map(k => scenarioColors[k]),
          showLegend: true,
          legendPos: "b",
          legendColor: COLORS.textMuted,
          legendFontFace: FONT,
          legendFontSize: 11,
          catAxisLabelColor: COLORS.textSubdim,
          catAxisLabelFontFace: FONT,
          catAxisLabelFontSize: 10,
          valAxisLabelColor: COLORS.textSubdim,
          valAxisLabelFontFace: FONT,
          valAxisLabelFontSize: 10,
          valAxisMinVal: 0,
          dataLabelColor: COLORS.text,
          lineSize: 2,
          lineDataSymbol: "circle",
          lineDataSymbolSize: 6,
          showValue: false,
          plotArea: { fill: { color: COLORS.bg } },
        });
      }

      if (slides.numbers.closer) {
        s.addText(slides.numbers.closer, {
          x: 1.5, y: 6.65, w: W - 3, h: 0.5,
          fontFace: FONT, fontSize: 13, color: COLORS.text, bold: true, align: "center",
        });
      }
    }

    // ═══════════════════════════════════════════════
    // SLIDE 8: PARTNERSHIP
    // ═══════════════════════════════════════════════
    {
      const s = newSlide();
      s.addText(slides.partnership.title, {
        x: 0.8, y: 0.6, w: W - 1.6, h: 0.8,
        fontFace: FONT, fontSize: 32, color: COLORS.text, bold: true,
      });

      // You
      s.addShape(pres.ShapeType.roundRect, {
        x: 0.8, y: 1.9, w: 5.9, h: 3.8, rectRadius: 0.15,
        fill: { color: COLORS.surface }, line: { color: COLORS.border, width: 0.5 },
      });
      s.addText("Tu", {
        x: 1.1, y: 2.1, w: 5.3, h: 0.4,
        fontFace: FONT, fontSize: 11, color: COLORS.accent, bold: true, charSpacing: 5,
      });
      s.addText(slides.partnership.you, {
        x: 1.1, y: 2.7, w: 5.3, h: 2.8,
        fontFace: FONT, fontSize: 15, color: COLORS.text, valign: "top",
      });

      // Us
      s.addShape(pres.ShapeType.roundRect, {
        x: 6.9, y: 1.9, w: 5.6, h: 3.8, rectRadius: 0.15,
        fill: { color: "1a0a0d" }, line: { color: COLORS.accent, width: 0.5, transparency: 60 },
      });
      s.addText("Nós", {
        x: 7.2, y: 2.1, w: 5, h: 0.4,
        fontFace: FONT, fontSize: 11, color: COLORS.success, bold: true, charSpacing: 5,
      });
      s.addText(slides.partnership.us, {
        x: 7.2, y: 2.7, w: 5, h: 2.8,
        fontFace: FONT, fontSize: 15, color: COLORS.text, valign: "top",
      });

      // Alignment
      s.addShape(pres.ShapeType.roundRect, {
        x: 0.8, y: 6, w: W - 1.6, h: 0.9, rectRadius: 0.12,
        fill: { color: "0d1410" }, line: { color: COLORS.success, width: 0.5, transparency: 65 },
      });
      s.addText(slides.partnership.alignment, {
        x: 0.8, y: 6, w: W - 1.6, h: 0.9,
        fontFace: FONT, fontSize: 16, color: COLORS.text, bold: true, align: "center", valign: "middle",
      });
    }

    // ═══════════════════════════════════════════════
    // SLIDE 9: RECAP
    // ═══════════════════════════════════════════════
    {
      const s = newSlide();
      s.addText(slides.recap.title, {
        x: 0.8, y: 0.6, w: W - 1.6, h: 0.8,
        fontFace: FONT, fontSize: 32, color: COLORS.text, bold: true,
      });

      const pairs = slides.recap.pairs || [];
      pairs.forEach((pair, i) => {
        const y = 2 + i * 0.9;
        s.addText("DE", {
          x: 0.8, y, w: 0.8, h: 0.3,
          fontFace: FONT, fontSize: 10, color: COLORS.textDim, bold: true, charSpacing: 5, align: "right",
        });
        s.addText(pair.from, {
          x: 1.7, y, w: 5, h: 0.5,
          fontFace: FONT, fontSize: 17, color: COLORS.textSubdim, align: "right",
        });
        s.addText("→", {
          x: 6.8, y, w: 0.5, h: 0.5,
          fontFace: FONT, fontSize: 22, color: COLORS.accent, bold: true, align: "center",
        });
        s.addText("PARA", {
          x: 7.4, y, w: 1, h: 0.3,
          fontFace: FONT, fontSize: 10, color: COLORS.accent, bold: true, charSpacing: 5,
        });
        s.addText(pair.to, {
          x: 7.4, y: y + 0.25, w: 5, h: 0.5,
          fontFace: FONT, fontSize: 17, color: COLORS.text, bold: true,
        });
      });

      if (slides.recap.closer) {
        s.addText(slides.recap.closer, {
          x: 1.5, y: 6.5, w: W - 3, h: 0.6,
          fontFace: FONT, fontSize: 16, color: COLORS.text, bold: true, italic: true, align: "center",
        });
      }
    }

    // ═══════════════════════════════════════════════
    // SLIDE 12 (LAST): CLOSE — single big centered question
    // (Investimento, when shown, comes BEFORE this slide)
    // ═══════════════════════════════════════════════
    const renderCloseSlide = () => {
      const s = newSlide();
      s.addText(slides.close.title || '', {
        x: 0.5, y: 0.5, w: W - 1, h: H - 1,
        fontFace: FONT, fontSize: 64, color: COLORS.text, bold: true,
        align: "center", valign: "middle",
      });
    };

    // ═══════════════════════════════════════════════
    // SLIDE 11 (OPTIONAL): INVESTIMENTO — render BEFORE close
    // ═══════════════════════════════════════════════
    if (showInvestimento && slides.investment) {
      const s = newSlide();
      s.addText(slides.investment.title, {
        x: 0.8, y: 0.6, w: W - 1.6, h: 0.8,
        fontFace: FONT, fontSize: 32, color: COLORS.text, bold: true,
      });

      // Setup
      s.addShape(pres.ShapeType.roundRect, {
        x: 0.8, y: 1.9, w: 5.9, h: 2.8, rectRadius: 0.15,
        fill: { color: "1a0a0d" }, line: { color: COLORS.accent, width: 0.5, transparency: 60 },
      });
      s.addText("Setup", {
        x: 1.1, y: 2.1, w: 5.3, h: 0.4,
        fontFace: FONT, fontSize: 11, color: COLORS.accent, bold: true, charSpacing: 5,
      });
      s.addText(slides.investment.setupAmount, {
        x: 1.1, y: 2.6, w: 5.3, h: 1,
        fontFace: FONT, fontSize: 42, color: COLORS.text, bold: true,
      });
      s.addText("Investimento único", {
        x: 1.1, y: 3.6, w: 5.3, h: 0.3,
        fontFace: FONT, fontSize: 11, color: COLORS.textSubdim,
      });
      s.addText(slides.investment.setupDesc, {
        x: 1.1, y: 3.95, w: 5.3, h: 0.75,
        fontFace: FONT, fontSize: 11, color: COLORS.textMuted, valign: "top",
      });

      // Commission
      s.addShape(pres.ShapeType.roundRect, {
        x: 6.9, y: 1.9, w: 5.6, h: 2.8, rectRadius: 0.15,
        fill: { color: "0d1410" }, line: { color: COLORS.success, width: 0.5, transparency: 65 },
      });
      s.addText("Parceria", {
        x: 7.2, y: 2.1, w: 5, h: 0.4,
        fontFace: FONT, fontSize: 11, color: COLORS.success, bold: true, charSpacing: 5,
      });
      s.addText(slides.investment.commissionAmount, {
        x: 7.2, y: 2.6, w: 5, h: 1,
        fontFace: FONT, fontSize: 42, color: COLORS.text, bold: true,
      });
      s.addText("Revenue share mensal", {
        x: 7.2, y: 3.6, w: 5, h: 0.3,
        fontFace: FONT, fontSize: 11, color: COLORS.textSubdim,
      });
      s.addText(slides.investment.commissionDesc, {
        x: 7.2, y: 3.95, w: 5, h: 0.75,
        fontFace: FONT, fontSize: 11, color: COLORS.textMuted, valign: "top",
      });

      // Included
      s.addShape(pres.ShapeType.roundRect, {
        x: 0.8, y: 4.9, w: W - 1.6, h: 1.9, rectRadius: 0.12,
        fill: { color: COLORS.surface }, line: { color: COLORS.border, width: 0.5 },
      });
      s.addText("O que está incluído", {
        x: 1.1, y: 5.05, w: 10, h: 0.3,
        fontFace: FONT, fontSize: 11, color: COLORS.textSubdim, bold: true, charSpacing: 5,
      });
      const incItems = (slides.investment.included || []).slice(0, 10);
      const colW = (W - 2.2) / 2;
      incItems.forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 1.1 + col * colW;
        const y = 5.45 + row * 0.28;
        s.addText(`✓  ${item}`, {
          x, y, w: colW - 0.1, h: 0.26,
          fontFace: FONT, fontSize: 11, color: COLORS.textMuted,
        });
      });

      if (slides.investment.closer) {
        s.addText(slides.investment.closer, {
          x: 1.5, y: 6.95, w: W - 3, h: 0.35,
          fontFace: FONT, fontSize: 13, color: COLORS.text, bold: true, italic: true, align: "center",
        });
      }
    }

    // ═══════════════════════════════════════════════
    // FINAL SLIDE: CLOSE — single big centered question (always last)
    // ═══════════════════════════════════════════════
    renderCloseSlide();

    const buffer = await pres.write({ outputType: "nodebuffer" });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="pitch.pptx"`,
      },
    });
  } catch (err) {
    console.error("PPTX export error:", err);
    return new Response(JSON.stringify({ error: err.message || "Export failed" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}

function formatFollowers(n) {
  if (!n && n !== 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}
