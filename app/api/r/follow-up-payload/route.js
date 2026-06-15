import { NextResponse } from 'next/server';
import { getCreator } from '../../../lib/creators';
import { buildFollowUpDm, pickStoredFollowUpEmail } from '../../cron/dm-reminders/route';

/**
 * GET /api/r/follow-up-payload?cid=<creatorId>&milestone=<key>&channel=<dm|email>
 *
 * Returns the prefilled follow-up text + the URL to open (Instagram for
 * DM, mailto: for email). Used by the /r/follow-up redirect page —
 * operator clicks a link in the daily reminder email, the page reads
 * this endpoint, copies the text to clipboard, then navigates to openUrl
 * (Instagram profile or the creator's email composer).
 *
 * Auth: protected by the global middleware (anything not in PUBLIC_*
 * needs a session cookie). Operators clicking from the email get
 * redirected to /signin → back here automatically.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cid = searchParams.get('cid');
  const milestone = searchParams.get('milestone') || 'softNudge';
  const channel = searchParams.get('channel') === 'email' ? 'email' : 'dm';

  if (!cid) return NextResponse.json({ error: 'cid required' }, { status: 400 });
  const creator = await getCreator(cid);
  if (!creator) return NextResponse.json({ error: 'creator not found' }, { status: 404 });

  const creatorFirstName = (creator.name || '').split(/\s+/)[0] || 'pessoa';
  const ownerFirstName = creator.addedBy?.firstName || 'Raul';
  const lang = (creator.primaryLanguage || 'pt').toLowerCase();
  const langCode = lang === 'en' ? 'en' : lang === 'es' ? 'es' : 'pt';

  if (channel === 'dm') {
    const text = buildFollowUpDm(milestone, creatorFirstName, ownerFirstName, langCode);
    const igUrl = creator.platforms?.instagram?.url
      || (creator.platforms?.instagram?.handle
            ? `https://instagram.com/${creator.platforms.instagram.handle.replace(/^@/, '')}`
            : null);
    return NextResponse.json({ channel: 'dm', text, openUrl: igUrl, creatorName: creator.name });
  }

  // channel === 'email' — surface the stored follow-up email when one
  // exists (dm-writer generates these on demand). Falls back to the DM
  // text if no stored email is available, so the operator never gets a
  // dead-end click.
  const stored = pickStoredFollowUpEmail(creator, milestone);
  const subject = stored?.subject || `Follow-up — ${creator.name}`;
  const body = stored?.body || buildFollowUpDm(milestone, creatorFirstName, ownerFirstName, langCode);
  const to = creator.contactEmail || creator.email || '';
  // mailto: with subject prefilled. Body is NOT in the mailto URL — we
  // copy it to clipboard so the operator pastes into Gmail / their
  // composer of choice. mailto with body parameter only works reliably
  // in native mail clients (Apple Mail) and breaks in Gmail-web.
  const openUrl = to
    ? `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}`
    : null;
  return NextResponse.json({ channel: 'email', text: body, subject, openUrl, creatorName: creator.name, hasRecipient: !!to });
}
