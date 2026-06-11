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
