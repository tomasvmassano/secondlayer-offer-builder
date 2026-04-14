import PptxGenJS from "pptxgenjs";

const LOGO_B64 =
  "data:image/png;base64,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";

export async function POST(request) {
  try {
    const { slides } = await request.json();
    if (!slides || !Array.isArray(slides)) {
      return new Response(JSON.stringify({ error: "Missing slides data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.defineLayout({ name: "CUSTOM", width: 13.33, height: 7.5 });
    pptx.layout = "CUSTOM";

    const addSlide = (fields, type) => {
      const s = pptx.addSlide();
      s.background = { color: "0a0a0a" };

      switch (type) {
        case "cover":
          s.addImage({ data: LOGO_B64, x: 5.5, y: 1.0, w: 2.3, h: 0.5 });
          s.addText(fields.creatorName, {
            x: 0.5, y: 2.5, w: 12.33, h: 1.2,
            fontSize: 44, fontFace: "Inter", color: "f5f5f5", bold: true, align: "center",
          });
          s.addText(fields.subtitle, {
            x: 0.5, y: 3.8, w: 12.33, h: 0.6,
            fontSize: 20, fontFace: "Inter", color: "888888", align: "center",
          });
          s.addShape(pptx.ShapeType.rect, {
            x: 6.15, y: 5.0, w: 1.0, h: 0.05, fill: { color: "7A0E18" },
          });
          break;

        case "problem":
          s.addText(fields.heading, {
            x: 0.8, y: 0.6, w: 11, h: 0.8,
            fontSize: 28, fontFace: "Inter", color: "f5f5f5", bold: true,
          });
          fields.bullets.forEach((b, i) => {
            s.addShape(pptx.ShapeType.ellipse, {
              x: 1.0, y: 2.0 + i * 1.0, w: 0.15, h: 0.15, fill: { color: "7A0E18" },
            });
            s.addText(b, {
              x: 1.4, y: 1.85 + i * 1.0, w: 10, h: 0.5,
              fontSize: 16, fontFace: "Inter", color: "888888",
            });
          });
          break;

        case "audience":
          s.addText(fields.heading, {
            x: 0.8, y: 0.6, w: 11, h: 0.8,
            fontSize: 28, fontFace: "Inter", color: "f5f5f5", bold: true,
          });
          const metrics = [
            { label: "PLATAFORMA", val: fields.primaryPlatform },
            { label: "ENGAGEMENT", val: fields.engagement },
            { label: "NICHO", val: fields.niche },
          ];
          metrics.forEach((m, i) => {
            const xPos = 0.8 + i * 4.0;
            s.addShape(pptx.ShapeType.roundRect, {
              x: xPos, y: 2.0, w: 3.5, h: 1.8, fill: { color: "1a0508" }, rectRadius: 0.15,
            });
            s.addText(m.label, {
              x: xPos, y: 2.2, w: 3.5, h: 0.4,
              fontSize: 10, fontFace: "Inter", color: "555555", align: "center", bold: true,
            });
            s.addText(m.val, {
              x: xPos, y: 2.7, w: 3.5, h: 0.6,
              fontSize: 20, fontFace: "Inter", color: "f5f5f5", align: "center", bold: true,
            });
          });
          s.addText(fields.platforms, {
            x: 0.8, y: 4.5, w: 11.5, h: 1.0,
            fontSize: 14, fontFace: "Inter", color: "f5f5f5",
          });
          break;

        case "offer":
          s.addText(fields.heading, {
            x: 0.8, y: 0.5, w: 11, h: 0.7,
            fontSize: 28, fontFace: "Inter", color: "f5f5f5", bold: true,
          });
          s.addText(fields.offerName, {
            x: 0.8, y: 1.3, w: 11, h: 0.6,
            fontSize: 22, fontFace: "Inter", color: "7A0E18", bold: true,
          });
          s.addText(fields.corePromise, {
            x: 0.8, y: 2.0, w: 11, h: 0.5,
            fontSize: 14, fontFace: "Inter", color: "888888",
          });
          fields.valueStack.forEach((item, i) => {
            s.addShape(pptx.ShapeType.roundRect, {
              x: 0.8, y: 3.0 + i * 0.75, w: 11.5, h: 0.6, fill: { color: "1a0508" }, rectRadius: 0.08,
            });
            s.addText(`${i + 1}.  ${item}`, {
              x: 1.0, y: 3.0 + i * 0.75, w: 11, h: 0.6,
              fontSize: 14, fontFace: "Inter", color: "f5f5f5",
            });
          });
          break;

        case "revenue":
          s.addText(fields.heading, {
            x: 0.8, y: 0.5, w: 11, h: 0.7,
            fontSize: 28, fontFace: "Inter", color: "f5f5f5", bold: true,
          });
          s.addShape(pptx.ShapeType.roundRect, {
            x: 2.5, y: 1.5, w: 8.3, h: 2.2, fill: { color: "1a0508" }, rectRadius: 0.15,
          });
          s.addText("RECEITA MENSAL ESTIMADA", {
            x: 2.5, y: 1.7, w: 8.3, h: 0.4,
            fontSize: 10, fontFace: "Inter", color: "555555", align: "center", bold: true,
          });
          s.addText(fields.heroMRR, {
            x: 2.5, y: 2.1, w: 8.3, h: 1.0,
            fontSize: 42, fontFace: "Inter", color: "7A0E18", align: "center",
          });
          s.addText(`${fields.followers} seguidores -> ${fields.activeClients} clientes ativos`, {
            x: 2.5, y: 3.0, w: 8.3, h: 0.4,
            fontSize: 11, fontFace: "Inter", color: "555555", align: "center",
          });
          const scenarios = [
            { label: "CONSERVADOR", val: fields.conservative, color: "555555" },
            { label: "MODERADO", val: fields.moderate, color: "7A0E18" },
            { label: "AGRESSIVO", val: fields.aggressive, color: "f5f5f5" },
          ];
          scenarios.forEach((sc, i) => {
            const xPos = 1.5 + i * 3.8;
            s.addShape(pptx.ShapeType.roundRect, {
              x: xPos, y: 4.3, w: 3.3, h: 1.8, fill: { color: "141414" }, rectRadius: 0.1,
              line: { color: sc.color === "7A0E18" ? "7A0E1855" : "1a1a1a", width: 1 },
            });
            s.addText(sc.label, {
              x: xPos, y: 4.5, w: 3.3, h: 0.4,
              fontSize: 10, fontFace: "Inter", color: sc.color, align: "center", bold: true,
            });
            s.addText(sc.val, {
              x: xPos, y: 5.0, w: 3.3, h: 0.6,
              fontSize: 20, fontFace: "Inter", color: "f5f5f5", align: "center", bold: true,
            });
          });
          s.addText(fields.note, {
            x: 0.8, y: 6.5, w: 11.5, h: 0.4,
            fontSize: 11, fontFace: "Inter", color: "555555", align: "center", italic: true,
          });
          break;

        case "deliverables":
          s.addText(fields.heading, {
            x: 0.8, y: 0.5, w: 11, h: 0.7,
            fontSize: 28, fontFace: "Inter", color: "f5f5f5", bold: true,
          });
          fields.items.forEach((item, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const xPos = 0.8 + col * 6.2;
            const yPos = 1.8 + row * 1.1;
            s.addShape(pptx.ShapeType.roundRect, {
              x: xPos, y: yPos, w: 5.8, h: 0.85, fill: { color: "141414" }, rectRadius: 0.08,
            });
            s.addText(`\u2713  ${item}`, {
              x: xPos + 0.3, y: yPos, w: 5.2, h: 0.85,
              fontSize: 14, fontFace: "Inter", color: "f5f5f5",
            });
          });
          break;

        case "timeline":
          s.addText(fields.heading, {
            x: 0.8, y: 0.5, w: 11, h: 0.7,
            fontSize: 28, fontFace: "Inter", color: "f5f5f5", bold: true,
          });
          fields.weeks.forEach((w, i) => {
            const xPos = 0.8 + i * 3.1;
            s.addShape(pptx.ShapeType.roundRect, {
              x: xPos, y: 1.6, w: 2.8, h: 1.6, fill: { color: "1a0508" }, rectRadius: 0.08,
            });
            s.addShape(pptx.ShapeType.rect, {
              x: xPos, y: 1.6, w: 0.06, h: 1.6, fill: { color: "7A0E18" },
            });
            s.addText(w.week, {
              x: xPos + 0.2, y: 1.7, w: 2.4, h: 0.4,
              fontSize: 12, fontFace: "Inter", color: "7A0E18", bold: true,
            });
            s.addText(w.task, {
              x: xPos + 0.2, y: 2.1, w: 2.4, h: 0.8,
              fontSize: 12, fontFace: "Inter", color: "888888",
            });
          });
          // You vs We
          s.addShape(pptx.ShapeType.roundRect, {
            x: 0.8, y: 3.8, w: 5.8, h: 2.8, fill: { color: "141414" }, rectRadius: 0.1,
          });
          s.addText("TU FAZES", {
            x: 0.8, y: 4.0, w: 5.8, h: 0.4,
            fontSize: 10, fontFace: "Inter", color: "555555", align: "center", bold: true,
          });
          fields.youDo.forEach((item, i) => {
            s.addText(`\u2022  ${item}`, {
              x: 1.2, y: 4.5 + i * 0.55, w: 5.0, h: 0.4,
              fontSize: 14, fontFace: "Inter", color: "888888",
            });
          });
          s.addShape(pptx.ShapeType.roundRect, {
            x: 7.0, y: 3.8, w: 5.8, h: 2.8, fill: { color: "1a0508" }, rectRadius: 0.1,
          });
          s.addText("NOS FAZEMOS", {
            x: 7.0, y: 4.0, w: 5.8, h: 0.4,
            fontSize: 10, fontFace: "Inter", color: "7A0E18", align: "center", bold: true,
          });
          fields.weDo.forEach((item, i) => {
            s.addText(`\u2022  ${item}`, {
              x: 7.4, y: 4.5 + i * 0.55, w: 5.0, h: 0.4,
              fontSize: 14, fontFace: "Inter", color: "f5f5f5", bold: true,
            });
          });
          break;

        case "investment":
          s.addText(fields.heading, {
            x: 0.8, y: 0.5, w: 11, h: 0.7,
            fontSize: 28, fontFace: "Inter", color: "f5f5f5", bold: true,
          });
          s.addShape(pptx.ShapeType.roundRect, {
            x: 0.8, y: 1.6, w: 5.8, h: 2.4, fill: { color: "1a0508" }, rectRadius: 0.12,
          });
          s.addText("SETUP FEE (ONE-TIME)", {
            x: 0.8, y: 1.8, w: 5.8, h: 0.4,
            fontSize: 10, fontFace: "Inter", color: "555555", align: "center", bold: true,
          });
          s.addText(fields.setupFee, {
            x: 0.8, y: 2.4, w: 5.8, h: 1.0,
            fontSize: 36, fontFace: "Inter", color: "7A0E18", align: "center", bold: true,
          });
          s.addShape(pptx.ShapeType.roundRect, {
            x: 7.0, y: 1.6, w: 5.8, h: 2.4, fill: { color: "141414" }, rectRadius: 0.12,
          });
          s.addText("COMMISSION", {
            x: 7.0, y: 1.8, w: 5.8, h: 0.4,
            fontSize: 10, fontFace: "Inter", color: "555555", align: "center", bold: true,
          });
          s.addText(fields.commission, {
            x: 7.0, y: 2.4, w: 5.8, h: 1.0,
            fontSize: 36, fontFace: "Inter", color: "f5f5f5", align: "center", bold: true,
          });
          s.addText("INCLUIDO NO SETUP", {
            x: 0.8, y: 4.4, w: 11.5, h: 0.4,
            fontSize: 10, fontFace: "Inter", color: "555555", bold: true,
          });
          const inclText = fields.includes.join("  |  ");
          s.addText(inclText, {
            x: 0.8, y: 4.9, w: 11.5, h: 0.5,
            fontSize: 13, fontFace: "Inter", color: "888888",
          });
          s.addText(fields.alignment, {
            x: 0.8, y: 5.8, w: 11.5, h: 0.6,
            fontSize: 16, fontFace: "Inter", color: "888888", align: "center", italic: true,
          });
          break;

        case "nextsteps":
          s.addText(fields.heading, {
            x: 0.5, y: 0.8, w: 12.33, h: 0.7,
            fontSize: 28, fontFace: "Inter", color: "f5f5f5", bold: true, align: "center",
          });
          fields.steps.forEach((st, i) => {
            const xPos = 2.0 + i * 3.5;
            s.addShape(pptx.ShapeType.ellipse, {
              x: xPos + 0.9, y: 2.2, w: 0.9, h: 0.9, fill: { color: "7A0E18" },
            });
            s.addText(st.num, {
              x: xPos + 0.9, y: 2.2, w: 0.9, h: 0.9,
              fontSize: 20, fontFace: "Inter", color: "ffffff", align: "center", valign: "middle", bold: true,
            });
            s.addText(st.text, {
              x: xPos, y: 3.4, w: 2.7, h: 0.6,
              fontSize: 15, fontFace: "Inter", color: "f5f5f5", align: "center", bold: true,
            });
          });
          s.addText(fields.contact, {
            x: 0.5, y: 5.0, w: 12.33, h: 0.5,
            fontSize: 14, fontFace: "Inter", color: "888888", align: "center",
          });
          s.addImage({ data: LOGO_B64, x: 5.8, y: 5.8, w: 1.7, h: 0.4 });
          break;
      }
    };

    slides.forEach((sl) => addSlide(sl.fields, sl.id));

    const buffer = await pptx.write({ outputType: "nodebuffer" });
    const fileName = `Second_Layer_Pitch_${slides[0]?.fields?.creatorName || "Creator"}.pptx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("PPTX generation error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
