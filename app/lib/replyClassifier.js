// Classify-only pass over a creator's reply — tags for the Respostas analytics,
// no response draft. Cheap/fast model. Shared by the live save (/api/reply/
// classify) and the backfill worker. Returns { blame, subtype, sentiment,
// offerReaction } or null on failure.

const BLAME = ['circumstances', 'other-people', 'self', 'genuine-question', 'positive', 'disqualify'];
const SENT = ['positive', 'neutral', 'negative'];
const REACT = ['liked', 'not-for-me', 'didnt-understand', 'na'];
const norm = (v, allowed) => { const s = (v || '').toLowerCase().trim(); return allowed.includes(s) ? s : null; };

const SYSTEM = `You classify a creator's reply to our cold outreach (we help creators turn their audience into a paid community / recurring revenue). Output EXACTLY these 4 lines, nothing else:
BLAME: <circumstances|other-people|self|genuine-question|positive|disqualify>
SUBTYPE: <time|money|spouse|self-doubt|price|tried-agencies|content-vs-monetize|how-do-i-know|need-to-think|null>
SENTIMENT: <positive|neutral|negative>
OFFER_REACTION: <liked|not-for-me|didnt-understand|na>

BLAME: positive = interested/wants the video; genuine-question = neutral logistics/info question; circumstances = time/money; other-people = needs a partner/spouse/team; self = self-doubt; disqualify = clearly not a fit / hard no.
SENTIMENT = how they feel about our message and offer.
OFFER_REACTION: liked = understood and interested; not-for-me = understood but declines; didnt-understand = confused about the offer or the video ask; na = pure logistics, not applicable.`;

export async function classifyReply(apiKey, text, ctx = {}) {
  if (!apiKey || !text) return null;
  const user = `Creator: ${ctx.name || 'Unknown'} (${ctx.niche || 'niche n/a'})
Reply: "${String(text).slice(0, 1200)}"`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const raw = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const grab = (label) => { const m = raw.match(new RegExp(`${label}:\\s*([^\\n]+)`, 'i')); return m ? m[1].trim() : ''; };
  const subtype = grab('SUBTYPE');
  return {
    blame: norm(grab('BLAME'), BLAME),
    subtype: subtype && subtype.toLowerCase() !== 'null' ? subtype.toLowerCase() : null,
    sentiment: norm(grab('SENTIMENT'), SENT),
    offerReaction: norm(grab('OFFER_REACTION'), REACT),
  };
}
