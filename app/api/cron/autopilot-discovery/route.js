import { NextResponse } from 'next/server';
import {
  listSeedUrls,
  getAutopilotEnabled,
  runDiscoveryFromSeeds,
  logRun,
} from '../../../lib/discovery';

// Long-running cron (seeds + scrapes + filters)
export const maxDuration = 300;

const AUTOPILOT_MAX_CANDIDATES = 30;
const NOTIFY_EMAILS = ['tomas@informallabs.com', 'raul@informallabs.com'];

export async function GET(request) {
  // Verify Vercel cron secret (Vercel auto-sets this header on cron invocations)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const enabled = await getAutopilotEnabled();

  if (!enabled) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'autopilot_disabled',
      timestamp: startedAt,
    });
  }

  const seeds = await listSeedUrls();
  if (seeds.length === 0) {
    const entry = {
      type: 'autopilot',
      status: 'skipped',
      reason: 'no_seeds',
      timestamp: startedAt,
    };
    await logRun(entry);
    return NextResponse.json(entry);
  }

  // Run the discovery pipeline
  let result;
  try {
    result = await runDiscoveryFromSeeds(seeds, AUTOPILOT_MAX_CANDIDATES);
  } catch (err) {
    const entry = {
      type: 'autopilot',
      status: 'error',
      error: err.message,
      seeds: seeds.length,
      timestamp: startedAt,
    };
    await logRun(entry);
    return NextResponse.json(entry, { status: 500 });
  }

  const stats = {
    type: 'autopilot',
    status: 'ok',
    seeds: seeds.length,
    scanned: result.scanned,
    queued: result.queued,
    dismissedLowTier: result.dismissedLowTier,
    dismissedOutOfRange: result.dismissedOutOfRange,
    dismissedLanguage: result.dismissedLanguage,
    dismissedNiche: result.dismissedNiche,
    dismissedNoBusiness: result.dismissedNoBusiness,
    failed: result.failed,
    timestamp: startedAt,
  };
  await logRun(stats);

  // Send notification email (silent fail — cron must still succeed)
  try {
    await sendAutopilotEmail(stats, result);
  } catch (err) {
    console.error('[autopilot] email send failed:', err.message);
  }

  return NextResponse.json(stats);
}

async function sendAutopilotEmail(stats, result) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // no key → skip silently

  const subject = `[Second Layer] Discovery autopilot: ${stats.queued} qualificados`;
  const hubUrl = 'https://hub.secondlayerhq.com/creators';

  const rejectionBreakdown = [
    stats.dismissedNiche ? `${stats.dismissedNiche} fora do nicho` : null,
    stats.dismissedLanguage ? `${stats.dismissedLanguage} idioma errado` : null,
    stats.dismissedNoBusiness ? `${stats.dismissedNoBusiness} sem monetização` : null,
    stats.dismissedLowTier ? `${stats.dismissedLowTier} C/D tier` : null,
    stats.dismissedOutOfRange ? `${stats.dismissedOutOfRange} fora do range` : null,
    stats.failed ? `${stats.failed} falharam` : null,
  ].filter(Boolean).join(' · ') || 'nenhum';

  const topCandidates = (result.results || [])
    .filter(r => r.status === 'queued' && r.candidate)
    .slice(0, 10)
    .map(r => {
      const c = r.candidate;
      return `• @${c.handle} (${c.name}) — ${c.followers?.toLocaleString() || '?'} followers, ${c.engagement || '?'} eng, ${c.dealScoreGrade} tier`;
    }).join('\n') || '(nenhum candidato qualificado hoje)';

  const text = `Discovery autopilot rodou às ${new Date(stats.timestamp).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })} (Lisboa).

RESULTADO:
${stats.queued} candidatos qualificados
${stats.scanned} total scaneados
${stats.seeds} seeds usados

BREAKDOWN:
${rejectionBreakdown}

TOP CANDIDATOS NO QUEUE:
${topCandidates}

Revê e aprova em: ${hubUrl}
`;

  const html = `<div style="font-family: -apple-system, sans-serif; color: #1a1a1a; max-width: 560px;">
  <h2 style="color: #7A0E18; margin-bottom: 8px;">Discovery autopilot</h2>
  <p style="color: #666; font-size: 13px; margin-top: 0;">Rodou às ${new Date(stats.timestamp).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })} (Lisboa)</p>

  <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${stats.queued} qualificados</div>
    <div style="font-size: 12px; color: #666; margin-top: 4px;">${stats.scanned} total scaneados · ${stats.seeds} seeds</div>
  </div>

  <h3 style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">Breakdown</h3>
  <p style="font-size: 13px; color: #444;">${rejectionBreakdown}</p>

  <h3 style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; margin-top: 20px;">Top candidatos</h3>
  <pre style="font-family: monospace; font-size: 12px; color: #333; background: #fafafa; padding: 12px; border-radius: 6px; white-space: pre-wrap;">${topCandidates}</pre>

  <p style="margin-top: 24px;"><a href="${hubUrl}" style="display: inline-block; padding: 10px 18px; background: #7A0E18; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">Rever queue no hub</a></p>
</div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Second Layer Hub <hub@informallabs.com>',
      to: NOTIFY_EMAILS,
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body.slice(0, 200)}`);
  }
}
