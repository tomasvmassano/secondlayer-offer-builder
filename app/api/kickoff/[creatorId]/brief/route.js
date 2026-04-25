import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { getCreator, updateCreator } from '../../../../lib/creators';

export const runtime = 'nodejs';

const SECTION_ORDER = [
  { title: 'Brand Identity', fields: [
    ['logo', 'Logo / brand name'],
    ['brandColors', 'Brand colors'],
    ['voice', 'Voice'],
    ['antiTone', 'Anti-tone'],
    ['inspirations', 'Inspirations'],
  ]},
  { title: 'Audience', fields: [
    ['topQuestions', 'Top DM questions'],
    ['painPoints', 'Pain points'],
    ['customerQuotes', 'Customer quotes'],
    ['demographics', 'Demographics'],
    ['antiPersona', 'Anti-persona'],
    ['whyFollow', 'Why they follow'],
    ['explicitAsks', 'Explicit asks'],
  ]},
  { title: 'Existing Business', fields: [
    ['revenueStreams', 'Revenue streams'],
    ['emailList', 'Email list'],
    ['pastProducts', 'Past products'],
    ['platforms', 'Existing platforms'],
    ['team', 'Existing team'],
    ['brandDeals', 'Brand deals'],
  ]},
  { title: 'Goals + Life', fields: [
    ['revenueTarget', 'Revenue target (€/mo MRR)'],
    ['memberTarget', 'Member target'],
    ['launchDate', 'Launch date'],
    ['hoursPerWeek', 'Hours/week'],
    ['vacations', 'Vacations'],
    ['winning', 'What winning looks like'],
  ]},
  { title: 'Constraints + Risks', fields: [
    ['hardNos', 'Hard NOs'],
    ['pastFailures', 'Past failures'],
    ['personalConstraints', 'Personal constraints'],
  ]},
  { title: 'Comms + Anchoring', fields: [
    ['preferredLanguage', 'Preferred language'],
    ['preferredComms', 'Preferred comms'],
    ['secret', 'One thing nobody knows'],
  ]},
];

function valToString(v) {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.filter(Boolean).join(', ') || '—';
  if (typeof v === 'object') return Object.entries(v).filter(([,x])=>x).map(([k,x])=>`${k}: ${x}`).join(' · ') || '—';
  return String(v);
}

export async function GET(request, { params }) {
  try {
    const { creatorId } = await params;
    const creator = await getCreator(creatorId);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    const onb = creator.onboarding || {};
    const responses = onb.responses || {};
    const kickoff = onb.kickoff || {};
    const decisions = kickoff.decisions || {};
    const actionItems = kickoff.actionItems || [];

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 50;
    const usableW = pageW - margin * 2;
    let y = margin;

    const ensureSpace = (needed) => {
      if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
    };

    const writeText = (text, opts = {}) => {
      const { size = 10, color = [40,40,40], style = 'normal', leading = 1.4, indent = 0 } = opts;
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
      const lines = doc.splitTextToSize(String(text), usableW - indent);
      const lineHeight = size * leading;
      lines.forEach(line => {
        ensureSpace(lineHeight);
        doc.text(line, margin + indent, y);
        y += lineHeight;
      });
    };

    const sectionHeader = (label) => {
      ensureSpace(28);
      y += 10;
      doc.setDrawColor(122, 14, 24);
      doc.setLineWidth(2);
      doc.line(margin, y, margin + 24, y);
      y += 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text(label.toUpperCase(), margin, y);
      y += 16;
    };

    const fieldRow = (label, value) => {
      ensureSpace(28);
      writeText(label, { size: 8, color: [120,120,120], style: 'bold' });
      writeText(valToString(value), { size: 10, color: [40,40,40] });
      y += 4;
    };

    // ─── Header ───
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(122, 14, 24);
    doc.text('SECOND LAYER · KICKOFF BRIEF', margin, y);
    y += 6;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 22;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text(creator.name || 'Creator', margin, y);
    y += 26;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    const meta = [
      creator.niche,
      `Generated ${new Date().toLocaleDateString('en-GB')}`,
      'Confidencial',
    ].filter(Boolean).join(' · ');
    doc.text(meta, margin, y);
    y += 22;

    // ─── Decisions ───
    sectionHeader('Decisions');
    const decFields = [
      ['Positioning', decisions.positioning],
      ['Community name', decisions.communityName],
      ['Pricing (€/month)', decisions.pricing],
      ['Launch date', decisions.launchDate],
      ['Tech stack', decisions.techStack],
      ['Roles split', decisions.rolesSplit],
      ['Comms cadence', decisions.commsCadence],
    ];
    decFields.forEach(([l, v]) => fieldRow(l, v));

    // ─── Action Items ───
    sectionHeader('Action Items');
    if (actionItems.length === 0) {
      writeText('No action items yet.', { size: 10, color: [150,150,150] });
    } else {
      actionItems.forEach((it, i) => {
        ensureSpace(20);
        const tag = `${i + 1}. [${it.done ? '✓' : ' '}]`;
        writeText(`${tag} ${it.task || '(untitled)'}`, { size: 10, color: [40,40,40], style: 'bold' });
        const meta = [it.owner && `Owner: ${it.owner}`, it.deadline && `Due: ${it.deadline}`].filter(Boolean).join(' · ');
        if (meta) writeText(meta, { size: 9, color: [130,130,130], indent: 14 });
        y += 4;
      });
    }

    // ─── Onboarding Responses ───
    sectionHeader('Onboarding Responses');
    SECTION_ORDER.forEach(sec => {
      const filled = sec.fields.filter(([k]) => responses[k]);
      if (filled.length === 0) return;
      ensureSpace(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(sec.title, margin, y);
      y += 14;
      filled.forEach(([k, label]) => fieldRow(label, responses[k]));
      y += 6;
    });

    // ─── Sign-off ───
    sectionHeader('Sign-off');
    y += 30;
    const colW = (usableW - 30) / 2;
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.6);
    doc.line(margin, y, margin + colW, y);
    doc.line(margin + colW + 30, y, margin + colW * 2 + 30, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Second Layer', margin, y);
    doc.text(creator.name || 'Creator', margin + colW + 30, y);
    y += 12;
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text('Date: __________________', margin, y);
    doc.text('Date: __________________', margin + colW + 30, y);

    // ─── Footer on every page ───
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text(`Second Layer · Kickoff Brief · ${creator.name || ''}`, margin, pageH - 20);
      doc.text(`${i} / ${total}`, pageW - margin, pageH - 20, { align: 'right' });
    }

    // Mark brief as generated. (Status flip to brief_signed stays manual until signed.)
    await updateCreator(creator.id, {
      onboarding: {
        kickoff: {
          briefGeneratedAt: new Date().toISOString(),
        },
      },
    }).catch(() => {});

    const buffer = Buffer.from(doc.output('arraybuffer'));
    const filename = `kickoff-brief-${(creator.name || 'creator').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[kickoff brief] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
