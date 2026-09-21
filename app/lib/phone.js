// Phone → WhatsApp link.
//
// wa.me wants the full international number, digits only. Phones reach the hub
// from enrichment sheets in every shape ("(813) 285-0190", "+49 (0)170 …",
// "666 943 725"), and a fair share are office landlines or toll-free lines that
// will never have WhatsApp. This normalises what can be normalised and labels
// the rest, so the UI can say "probably a landline" instead of opening a dead
// chat. Whether a mobile is actually ON WhatsApp can't be known without
// opening the link — there is no free lookup for that.

// Longest prefix first so +1 doesn't swallow +1-something codes we list.
const COUNTRY_CODES = ['971', '351', '359', '420', '34', '49', '54', '52', '55', '41', '44', '61', '92', '33', '39', '31', '32', '20', '1'];

const TOLL_FREE_US = /^(800|833|844|855|866|877|888)/;

// National-number shape → line type. Only countries where the numbering plan
// separates mobile from fixed; everywhere else (US/CA, MX) it's 'unknown'.
function lineKind(cc, nsn) {
  switch (cc) {
    case '351': return /^9[1236]/.test(nsn) ? 'mobile' : /^[23]/.test(nsn) ? 'landline' : 'unknown';
    case '34':  return /^[67]/.test(nsn) ? 'mobile' : /^[89]/.test(nsn) ? 'landline' : 'unknown';
    case '971': return /^5/.test(nsn) ? 'mobile' : /^800/.test(nsn) ? 'tollfree' : /^[234679]/.test(nsn) ? 'landline' : 'unknown';
    case '49':  return /^1[567]/.test(nsn) ? 'mobile' : 'landline';
    case '54':  return /^9/.test(nsn) ? 'mobile' : 'landline';
    case '55':  return nsn.length === 11 && nsn[2] === '9' ? 'mobile' : 'landline';
    case '41':  return /^7[5-9]/.test(nsn) ? 'mobile' : 'landline';
    case '44':  return /^7/.test(nsn) ? 'mobile' : 'landline';
    case '61':  return /^4/.test(nsn) ? 'mobile' : 'landline';
    case '359': return /^(8[789]|9[89])/.test(nsn) ? 'mobile' : 'landline';
    case '420': return /^[67]/.test(nsn) ? 'mobile' : 'landline';
    case '92':  return /^3/.test(nsn) ? 'mobile' : 'landline';
    case '20':  return /^1/.test(nsn) ? 'mobile' : 'landline';
    case '33':  return /^[67]/.test(nsn) ? 'mobile' : 'landline';
    case '39':  return /^3/.test(nsn) ? 'mobile' : 'landline';
    case '31':  return /^6/.test(nsn) ? 'mobile' : 'landline';
    case '32':  return /^4/.test(nsn) ? 'mobile' : 'landline';
    case '1':   return TOLL_FREE_US.test(nsn) ? 'tollfree' : 'unknown';
    default:    return 'unknown';
  }
}

// No "+": guess the country from the number's shape, then from the lead.
function guessCountry(digits, hints = {}) {
  const email = String(hints.email || '').toLowerCase();
  const lang = String(hints.language || '').toLowerCase();
  if (digits.length === 10 && /^[2-9]/.test(digits)) return '1';
  if (digits.length === 9 && /^[67]/.test(digits)) return '34';
  if (digits.length === 9 && /^9/.test(digits)) {
    if (/\.pt$/.test(email) || lang.startsWith('pt')) return '351';
    if (/\.es$/.test(email) || lang.startsWith('es')) return '34';
  }
  if (digits.length === 9 && /^2/.test(digits) && (/\.pt$/.test(email) || lang.startsWith('pt'))) return '351';
  return null;
}

/**
 * normalizePhone('+34 646 56 84 13')
 *   → { ok, e164: '+34646568413', wa: '34646568413', country: '34',
 *       kind: 'mobile'|'landline'|'tollfree'|'unknown', assumedCountry: false }
 * ok:false means we could not get to a full international number at all.
 */
export function normalizePhone(raw, hints = {}) {
  let s = String(raw || '').trim();
  if (!s) return { ok: false, reason: 'empty' };
  s = s.replace(/\(0\)/g, '');              // "+49 (0)170" trunk zero
  const hasPlus = /^\s*(\+|00)/.test(s);
  let digits = s.replace(/\D/g, '');
  if (/^\s*00/.test(s)) digits = digits.replace(/^00/, '');
  if (digits.length < 7) return { ok: false, reason: 'too short' };

  let cc = null;
  let assumedCountry = false;
  if (hasPlus) {
    cc = COUNTRY_CODES.find(c => digits.startsWith(c)) || null;
  } else {
    cc = guessCountry(digits, hints);
    if (!cc) return { ok: false, reason: 'no country code' };
    assumedCountry = true;
    digits = cc + digits;
  }

  let nsn = cc ? digits.slice(cc.length) : digits;
  if (cc && cc !== '39' && nsn.startsWith('0')) nsn = nsn.replace(/^0+/, ''); // "+44 07…"
  const full = (cc || '') + nsn;
  if (full.length < 9 || full.length > 15) return { ok: false, reason: 'bad length' };

  // Argentina: WhatsApp only accepts mobiles as +54 9 …, but people write them
  // without the 9. A number without it is either a landline (no WhatsApp either
  // way) or a mobile that needs the 9, so adding it can only help the link.
  if (cc === '54' && !nsn.startsWith('9')) {
    return { ok: true, e164: `+${full}`, wa: `549${nsn}`, country: cc, kind: 'unknown', assumedCountry };
  }

  return { ok: true, e164: `+${full}`, wa: full, country: cc, kind: cc ? lineKind(cc, nsn) : 'unknown', assumedCountry };
}

// wa.me deep link, optionally with the message prefilled. WhatsApp truncates
// nothing, but some browsers choke on very long URLs, so the text is capped.
export function whatsappUrl(raw, text = '', hints = {}) {
  const n = normalizePhone(raw, hints);
  if (!n.ok) return null;
  const t = String(text || '').trim().slice(0, 1800);
  return `https://wa.me/${n.wa}${t ? `?text=${encodeURIComponent(t)}` : ''}`;
}
