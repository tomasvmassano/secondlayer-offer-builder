/**
 * Currency utilities for the pitch deck and projector.
 *
 * The deck used to swap $ ↔ € based on creator.primaryLanguage, which broke
 * for Dubai / GCC creators (their buyer's mental currency is AED, not USD
 * because they happen to be configured EN). This module:
 *   1. Adds an explicit `creator.currency` override (AED / EUR / USD / GBP)
 *   2. Auto-detects from creator data (location + niche keywords + name)
 *      when no override is set — so the deck does the right thing without
 *      operator intervention
 *   3. Provides a dual-currency renderer ("AED 4,997 · €1,250") for headline
 *      numbers where showing both helps the buyer recognise the price.
 *
 * FX rates are approximate. Updated quarterly. For pitch decks they don't
 * need to be live — the secondary number is a reading aid, not an invoice.
 */

// Approximate FX vs EUR. Quarterly refresh is fine.
const FX_TO_EUR = {
  EUR: 1.00,
  USD: 0.92,
  GBP: 1.16,
  AED: 0.25,
  CHF: 1.05,
  BRL: 0.16,
};

export const CURRENCY_SYMBOLS = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  AED: 'AED',    // 3-letter code — د.إ is harder to read in latin contexts
  CHF: 'CHF',
  BRL: 'R$',
};

export const CURRENCY_LOCALES = {
  EUR: 'pt-PT',
  USD: 'en-US',
  GBP: 'en-GB',
  AED: 'en-AE',
  CHF: 'de-CH',
  BRL: 'pt-BR',
};

// Sensible secondary currency per primary, used for dual-currency display.
// AED creators read EUR as the international anchor; EUR creators read USD;
// etc. Null means "no secondary, just show primary".
export const SECONDARY_CURRENCY = {
  AED: 'EUR',
  EUR: 'USD',
  USD: 'EUR',
  GBP: 'EUR',
  CHF: 'EUR',
  BRL: 'USD',
};

/**
 * Auto-detect a creator's pricing currency from their data.
 * Checks (in priority order):
 *   1. Explicit creator.currency override
 *   2. Location keywords (Dubai/MENA/GCC → AED; UK/London → GBP; etc.)
 *   3. Niche/audience keywords (Dubai real estate → AED; Brazilian market → BRL)
 *   4. primaryLanguage fallback (EN → USD, PT → EUR, ES → EUR)
 *
 * Returns ISO 4217 code (3 chars), e.g. 'AED'.
 */
export function detectCurrency(creator) {
  if (!creator) return 'EUR';
  if (creator.currency && CURRENCY_SYMBOLS[creator.currency]) return creator.currency;

  // Concatenate searchable fields. Lowercase. Defensive on missing values.
  const haystack = [
    creator.location,
    creator.country,
    creator.niche,
    creator.bio,
    creator.name,
    creator.offer?.client_facing_output?.target_audience,
    creator.offer?.internal_metadata?.strategic_frame?.audience_segment?.description,
  ].filter(Boolean).join(' ').toLowerCase();

  // GCC / MENA — Dubai, Abu Dhabi, UAE, Saudi, Qatar, Bahrain, Kuwait, Oman
  if (/(dubai|uae|emirates|abu\s*dhabi|sharjah|gcc|mena|saudi|qatar|bahrain|kuwait|oman|riyadh|jeddah)/.test(haystack)) return 'AED';
  // UK
  if (/(london|united\s*kingdom|\buk\b|england|britain|scotland|wales)/.test(haystack)) return 'GBP';
  // Brazil
  if (/(brasil|brazil|s[aã]o\s*paulo|rio\s*de\s*janeiro)/.test(haystack)) return 'BRL';
  // Switzerland
  if (/(suisse|switzerland|z[uü]rich|geneva|gen[èe]ve|swiss)/.test(haystack)) return 'CHF';
  // US explicit
  if (/(\busa\b|united\s*states|new\s*york|los\s*angeles|silicon\s*valley)/.test(haystack)) return 'USD';

  // Language fallback. EN → USD because most EN creator-economy data is
  // dollar-denominated. PT/ES default to EUR.
  const lang = String(creator.primaryLanguage || '').toLowerCase();
  if (lang === 'en') return 'USD';
  return 'EUR';
}

export function currencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || code || '€';
}

/**
 * Format a numeric amount with the proper symbol + locale grouping.
 *   formatAmount(4997, 'AED')  → "AED 4,997"
 *   formatAmount(4997, 'EUR')  → "€4.997"
 *   formatAmount(4997, 'USD')  → "$4,997"
 */
export function formatAmount(amount, code = 'EUR', opts = {}) {
  if (amount == null || amount === '') return '';
  const sym = currencySymbol(code);
  const locale = CURRENCY_LOCALES[code] || 'en-US';
  const n = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]/g, '')) : amount;
  if (!Number.isFinite(n)) return String(amount);
  const formatted = Math.round(n).toLocaleString(locale);
  // 3-letter codes get a space ("AED 4,997"); single-char symbols hug ("$4,997")
  const sep = sym.length > 1 ? ' ' : '';
  // Honor opts.symbolAfter for languages/conventions that prefer "4.997 €"
  if (opts.symbolAfter) return `${formatted}${sep || ' '}${sym}`;
  return `${sym}${sep}${formatted}`;
}

/**
 * Convert amount between currencies via EUR pivot. Approximate — for pitch
 * deck "show both numbers" use, NOT for invoices.
 */
export function convert(amount, from, to) {
  if (!Number.isFinite(amount) || from === to) return amount;
  const fromRate = FX_TO_EUR[from] ?? 1;
  const toRate = FX_TO_EUR[to] ?? 1;
  return (amount * fromRate) / toRate;
}

/**
 * Dual-currency string. "AED 4,997 · €1,250" pattern for headline numbers.
 * Returns just the primary if secondary is null.
 *   formatDual(4997, 'AED')          → "AED 4,997 · €1,250"
 *   formatDual(4997, 'EUR', null)    → "€4.997"
 */
export function formatDual(amount, primary, secondary) {
  const sec = secondary === null ? null : (secondary ?? SECONDARY_CURRENCY[primary]);
  const primaryStr = formatAmount(amount, primary);
  if (!sec) return primaryStr;
  const converted = convert(amount, primary, sec);
  return `${primaryStr} · ${formatAmount(converted, sec)}`;
}

/**
 * Build a currency-aware price label. Replaces the old `lang === 'en' ? '$' : '€'`
 * pattern used throughout the pitch deck.
 *   priceLabel(997, 'AED', '/mo')   → "AED 997/mo"
 *   priceLabel(997, 'USD', '/mês')  → "$997/mês"
 */
export function priceLabel(amount, code = 'EUR', suffix = '') {
  return `${formatAmount(amount, code)}${suffix || ''}`;
}

/**
 * Detect the currency code embedded in a price string by scanning for known
 * symbols/codes. Returns null when nothing recognisable is found.
 *   detectCurrencyInString("$8,500")    → 'USD'
 *   detectCurrencyInString("€297/mês")  → 'EUR'
 *   detectCurrencyInString("AED 4,997") → 'AED'
 *   detectCurrencyInString("8500")      → null
 */
export function detectCurrencyInString(s) {
  if (typeof s !== 'string') return null;
  if (/(?:^|\s)AED\s?\d/.test(s)) return 'AED';
  if (/(?:^|\s)EUR\s?\d/.test(s)) return 'EUR';
  if (/(?:^|\s)USD\s?\d/.test(s)) return 'USD';
  if (/(?:^|\s)GBP\s?\d/.test(s)) return 'GBP';
  if (/(?:^|\s)CHF\s?\d/.test(s)) return 'CHF';
  if (/R\$\s?\d/.test(s)) return 'BRL';
  if (/\$\d/.test(s)) return 'USD';
  if (/€\d/.test(s)) return 'EUR';
  if (/£\d/.test(s)) return 'GBP';
  return null;
}

/**
 * FX-convert + re-emit a price string. Parses out the amount and source
 * currency, converts to the target, re-emits with the target symbol.
 * Preserves any trailing unit ("/mês", "/yr", " one-time").
 *   convertPriceString("$8,500", 'AED')        → "AED 31,205"
 *   convertPriceString("€997/mês", 'AED')      → "AED 3,996/mês"
 *   convertPriceString("8500", 'AED')          → "8500"  (no source currency → no-op)
 *
 * For use on LLM-generated price strings (value-stack dollarValue, CP2
 * pricing_tiers) where the LLM picked a currency that disagrees with the
 * creator's chosen display currency.
 */
export function convertPriceString(s, targetCurrency, assumeFromCurrency = null) {
  if (typeof s !== 'string' || !targetCurrency) return s;
  // Per-token detection. A string like "$4,997 + $997/mo" has TWO price
  // tokens, possibly in different currencies — we convert each one in place,
  // preserving any non-price text (separators, units, words) between them.
  const tokenRe = /(R\$|AED\s?|EUR\s?|USD\s?|GBP\s?|CHF\s?|BRL\s?|\$|€|£)\s?([\d][\d.,]*)/g;
  return s.replace(tokenRe, (whole, symRaw, numRaw) => {
    const sym = symRaw.trim();
    const fromCurrency = ({
      'R$': 'BRL', 'AED': 'AED', 'EUR': 'EUR', 'USD': 'USD',
      'GBP': 'GBP', 'CHF': 'CHF', 'BRL': 'BRL',
      '$': 'USD', '€': 'EUR', '£': 'GBP',
    })[sym] || assumeFromCurrency;
    if (!fromCurrency) return whole;
    // Strip thousands separators (both "," and "."), parse as integer-ish.
    const num = parseFloat(numRaw.replace(/[.,](?=\d{3}(?:\D|$))/g, ''));
    if (!Number.isFinite(num)) return whole;
    if (fromCurrency === targetCurrency) {
      // Just re-emit with consistent symbol style (e.g. "USD 8500" → "$8,500").
      return formatAmount(num, targetCurrency);
    }
    const converted = convert(num, fromCurrency, targetCurrency);
    return formatAmount(converted, targetCurrency);
  });
}

// Suffix per recurring period × language. Centralised so a structured
// price with recurring_period="quarter" doesn't render as "/mo" on one
// slide and "/quarter" on another.
const PERIOD_SUFFIX = {
  month:   { en: '/mo',     pt: '/mês',     es: '/mes',     fallback: '/mo' },
  quarter: { en: '/quarter', pt: '/trimestre', es: '/trimestre', fallback: '/quarter' },
  year:    { en: '/yr',     pt: '/ano',     es: '/año',     fallback: '/yr' },
  week:    { en: '/wk',     pt: '/semana',  es: '/semana',  fallback: '/wk' },
};

function periodSuffix(period, lang) {
  const row = PERIOD_SUFFIX[period];
  if (!row) return '';
  return row[lang] || row.fallback;
}

/**
 * Canonical formatter for an offer's price. Every slide + the projector
 * calls this; FX conversion happens here once. Replaces the three
 * incompatible render paths that used to produce e.g.
 *   "AED 2,497 + AED 997/quarter" (slide 4),
 *   "AED 2,497/mo"                (slide 7),
 *   "€2,497/mo"                   (slide 10)
 * for the SAME offer.
 *
 * @param {object} price - structured price from cfo.price
 *   { setup_amount, recurring_amount, recurring_period, one_time_amount, currency }
 * @param {string} displayCurrency - target currency for render (e.g. 'AED')
 * @param {string} lang - 'en' | 'pt' | 'es' for period suffix localisation
 * @param {object} [opts]
 *   opts.mode = 'full' | 'recurring_only' | 'setup_only' | 'one_time_only'
 *   opts.dual = bool — append secondary currency in parens
 * @returns {string} formatted price label
 */
export function formatOfferPrice(price, displayCurrency, lang = 'en', opts = {}) {
  if (!price || typeof price !== 'object') return '';
  const src = price.currency || 'EUR';
  const dst = displayCurrency || src;
  const mode = opts.mode || 'full';
  const conv = (amt) => (amt == null ? null : convert(amt, src, dst));

  const setup     = Number(price.setup_amount);
  const recurring = Number(price.recurring_amount);
  const oneTime   = Number(price.one_time_amount);
  const period    = price.recurring_period;
  const hasSetup     = Number.isFinite(setup)     && setup     > 0;
  const hasRecurring = Number.isFinite(recurring) && recurring > 0;
  const hasOneTime   = Number.isFinite(oneTime)   && oneTime   > 0;

  const sfx = periodSuffix(period, lang);

  // Build the label per mode.
  if (mode === 'recurring_only' && hasRecurring) {
    return `${formatAmount(conv(recurring), dst)}${sfx}`;
  }
  if (mode === 'setup_only' && hasSetup) {
    return formatAmount(conv(setup), dst);
  }
  if (mode === 'one_time_only' && hasOneTime) {
    return formatAmount(conv(oneTime), dst);
  }
  // mode === 'full' (default) — synthesise from whatever fields are set
  if (hasSetup && hasRecurring) {
    // Hybrid: "AED 9,162 + AED 3,659/mo"
    return `${formatAmount(conv(setup), dst)} + ${formatAmount(conv(recurring), dst)}${sfx}`;
  }
  if (hasRecurring) {
    return `${formatAmount(conv(recurring), dst)}${sfx}`;
  }
  if (hasOneTime) {
    return formatAmount(conv(oneTime), dst);
  }
  if (hasSetup) {
    // Setup-only is unusual — treat as one-time charge.
    return formatAmount(conv(setup), dst);
  }
  return '';
}

/**
 * Parse a legacy freeform target_price string into structured form. Used
 * to upgrade old offers in-place when they're read but haven't been
 * regenerated. Handles the common patterns the LLM emits:
 *   "€2497 + €997/mo"        → hybrid setup + monthly
 *   "€2497 + €997/quarter"   → hybrid setup + quarterly
 *   "€997/mês"               → recurring monthly
 *   "€1497/yr"               → recurring annual
 *   "€3497 one-time"         → one-time
 *   "$497"                   → one-time (no period)
 *
 * @param {string} s freeform string
 * @param {string} [sourceCurrency] override; default detect from symbol or fallback EUR
 * @returns {object|null} structured price object, or null if unparseable
 */
export function parseTargetPriceToStructured(s, sourceCurrency = null) {
  if (typeof s !== 'string' || !s.trim()) return null;
  const str = s.trim();

  // Detect period from any unit suffix in the string.
  const periodFromSuffix = (sfx) => {
    if (!sfx) return null;
    const sl = sfx.toLowerCase();
    if (/(mês|mes|mo(nth)?|\/mo$)/.test(sl)) return 'month';
    if (/(quarter|trimestre|trim|\/q$)/.test(sl)) return 'quarter';
    if (/(ano|año|year|\/yr$)/.test(sl)) return 'year';
    if (/(semana|week|wk|\/wk$)/.test(sl)) return 'week';
    return null;
  };

  // Currency detection — prefer the FIRST currency token in the string.
  const detectedCurrency = detectCurrencyInString(str) || sourceCurrency || 'EUR';

  // Hybrid: "€2497 + €997/mo" / "€2497 setup + €997/mo"
  const hybridRe = /(?:R\$|AED\s?|EUR\s?|USD\s?|GBP\s?|CHF\s?|BRL\s?|\$|€|£)\s?(\d[\d.,]*)\s*(?:setup\s*)?\+\s*(?:R\$|AED\s?|EUR\s?|USD\s?|GBP\s?|CHF\s?|BRL\s?|\$|€|£)\s?(\d[\d.,]*)\s*(\/\s*\w+|\s+\w+)?/i;
  const hybridMatch = str.match(hybridRe);
  if (hybridMatch) {
    const setup = parseFloat(hybridMatch[1].replace(/[.,](?=\d{3}(?:\D|$))/g, ''));
    const recurring = parseFloat(hybridMatch[2].replace(/[.,](?=\d{3}(?:\D|$))/g, ''));
    return {
      setup_amount: Number.isFinite(setup) ? setup : null,
      recurring_amount: Number.isFinite(recurring) ? recurring : null,
      recurring_period: periodFromSuffix(hybridMatch[3]) || 'month',
      one_time_amount: null,
      currency: detectedCurrency,
    };
  }

  // Recurring: "€997/mo", "€1497/yr", "€100/quarter"
  const recurringRe = /(?:R\$|AED\s?|EUR\s?|USD\s?|GBP\s?|CHF\s?|BRL\s?|\$|€|£)\s?(\d[\d.,]*)\s*\/\s*(\w+)/i;
  const recurringMatch = str.match(recurringRe);
  if (recurringMatch) {
    const amt = parseFloat(recurringMatch[1].replace(/[.,](?=\d{3}(?:\D|$))/g, ''));
    return {
      setup_amount: null,
      recurring_amount: Number.isFinite(amt) ? amt : null,
      recurring_period: periodFromSuffix('/' + recurringMatch[2]) || 'month',
      one_time_amount: null,
      currency: detectedCurrency,
    };
  }

  // One-time: "€3497 one-time", "$497"
  const oneTimeRe = /(?:R\$|AED\s?|EUR\s?|USD\s?|GBP\s?|CHF\s?|BRL\s?|\$|€|£)\s?(\d[\d.,]*)/;
  const oneTimeMatch = str.match(oneTimeRe);
  if (oneTimeMatch) {
    const amt = parseFloat(oneTimeMatch[1].replace(/[.,](?=\d{3}(?:\D|$))/g, ''));
    return {
      setup_amount: null,
      recurring_amount: null,
      recurring_period: null,
      one_time_amount: Number.isFinite(amt) ? amt : null,
      currency: detectedCurrency,
    };
  }
  return null;
}

/**
 * Compose a hybrid pricing label: "$4,997 setup + $997/mo".
 * For the value-stack "actual price" block and any other spot that needs to
 * convey the full hybrid offer rather than just the recurring tail.
 */
export function hybridPriceLabel(setup, monthly, code = 'EUR', lang = 'en') {
  const setupStr = formatAmount(setup, code);
  const monthlyStr = formatAmount(monthly, code);
  const monthlySuffix = lang === 'pt' ? '/mês' : lang === 'es' ? '/mes' : '/mo';
  const conn = lang === 'pt' ? ' setup + ' : lang === 'es' ? ' setup + ' : ' setup + ';
  return `${setupStr}${conn}${monthlyStr}${monthlySuffix}`;
}
