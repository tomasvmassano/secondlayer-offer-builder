import { normalizeEnum, clampStr, clampArray } from './normalize';

/**
 * Productized Service offer — the "done-for-you" archetype.
 *
 * Built when the strategic frame's primary_offer_archetype is
 * `productized_service` (a fixed-price async deliverable: mood board,
 * room design, audit report, custom plan, edit pack…). The community
 * wizard (CP2-CP5) can't shape this — it assumes a recurring space +
 * modules + weekly rhythm. A service sells a REPEATABLE PROCESS that
 * ships ONE artifact per buyer.
 *
 * Lives at internal_metadata.service_offer. Rendered as its own
 * deliverable panel in the Oferta tab (not forced into the
 * community-shaped pitch deck — that's a later slice).
 *
 * Shape:
 *   service_name         : the productized service name
 *   name_candidates      : 2-4 alternates the operator can pick from
 *   central_promise      : the transformation in one sentence (buyer voice)
 *   core_deliverable     : WHAT the buyer receives — the concrete artifact
 *   who_its_for          : 2-4 bullets (self-qualify)
 *   who_its_not_for      : 2-4 bullets (self-disqualify)
 *   process_steps        : 3-6 templatized steps — the "productized" engine
 *   packages             : 1-3 tiers { name, whats_included[], price, turnaround, best_for }
 *   turnaround           : typical delivery time for the base package
 *   positioning          : why this beats hiring an agency / doing it yourself
 *   delivery_format      : async | live | hybrid
 */

export const VALID_DELIVERY_FORMATS = ['async', 'live', 'hybrid'];
export const VALID_PRICE_MODELS = ['per_project', 'per_unit', 'per_month'];
export const VALID_CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'CHF', 'BRL'];

const isStr = v => typeof v === 'string' && v.trim().length > 0;
const isNum = v => typeof v === 'number' && Number.isFinite(v);

// Char caps — generous ceilings; the prompt asks for 70-80%.
const CAP = {
  service_name: 80,
  central_promise: 240,
  core_deliverable: 400,
  bullet: 180,
  step: 220,
  positioning: 400,
  turnaround: 60,
  pkg_name: 60,
  pkg_included: 160,
  pkg_best_for: 140,
};

function validatePrice(p, path, push) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    push(path, 'required object { amount, currency, model }');
    return;
  }
  // Coerce currency + model before validating.
  const cur = normalizeEnum(p.currency, VALID_CURRENCIES, {
    '€': 'EUR', 'eur': 'EUR', '$': 'USD', 'usd': 'USD', '£': 'GBP', 'gbp': 'GBP',
  });
  if (cur) p.currency = cur;
  else if (p.currency != null) p.currency = null; // auto-null unknown, don't hard-fail
  const model = normalizeEnum(p.model, VALID_PRICE_MODELS, {
    'project': 'per_project', 'per-project': 'per_project', 'one_time': 'per_project', 'one-time': 'per_project',
    'unit': 'per_unit', 'per-unit': 'per_unit', 'each': 'per_unit',
    'month': 'per_month', 'monthly': 'per_month', 'per-month': 'per_month', 'recurring': 'per_month',
  });
  if (model) p.model = model;
  if (!isNum(p.amount) || p.amount <= 0) push(`${path}.amount`, 'required positive number');
  if (!VALID_PRICE_MODELS.includes(p.model)) push(`${path}.model`, `must be one of ${VALID_PRICE_MODELS.join('|')}`);
}

export function validateServiceOffer(obj) {
  const errors = [];
  const push = (path, msg) => errors.push(`${path}: ${msg}`);

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['root: must be a JSON object'] };
  }

  // Coerce delivery_format before validating.
  const df = normalizeEnum(obj.delivery_format, VALID_DELIVERY_FORMATS, {
    'asynchronous': 'async', 'assíncrono': 'async', 'assincrono': 'async',
    'ao vivo': 'live', 'síncrono': 'live', 'sincrono': 'live',
    'híbrido': 'hybrid', 'hibrido': 'hybrid', 'misto': 'hybrid',
  });
  if (df) obj.delivery_format = df;

  // Clamp all prose fields (never hard-fail on length).
  if (isStr(obj.service_name))    obj.service_name    = clampStr(obj.service_name, CAP.service_name);
  if (isStr(obj.central_promise)) obj.central_promise = clampStr(obj.central_promise, CAP.central_promise);
  if (isStr(obj.core_deliverable))obj.core_deliverable= clampStr(obj.core_deliverable, CAP.core_deliverable);
  if (isStr(obj.positioning))     obj.positioning     = clampStr(obj.positioning, CAP.positioning);
  if (isStr(obj.turnaround))      obj.turnaround      = clampStr(obj.turnaround, CAP.turnaround);

  // ── Required strings
  if (!isStr(obj.service_name))     push('service_name', 'required non-empty string');
  if (!isStr(obj.central_promise))  push('central_promise', 'required non-empty string');
  if (!isStr(obj.core_deliverable)) push('core_deliverable', 'required non-empty string (the concrete artifact the buyer receives)');
  if (!isStr(obj.positioning))      push('positioning', 'required non-empty string');
  if (!isStr(obj.turnaround))       push('turnaround', 'required non-empty string');
  if (!VALID_DELIVERY_FORMATS.includes(obj.delivery_format)) {
    push('delivery_format', `must be one of ${VALID_DELIVERY_FORMATS.join('|')}`);
  }

  // ── name_candidates — 2-4 alternates
  if (!Array.isArray(obj.name_candidates)) {
    push('name_candidates', 'must be an array of 2-4 alternate names');
  } else {
    obj.name_candidates = clampArray(obj.name_candidates, 2, 4);
    if (obj.name_candidates.length < 2) push('name_candidates', 'need at least 2 alternates');
  }

  // ── who_its_for / who_its_not_for — 2-4 bullets each
  for (const key of ['who_its_for', 'who_its_not_for']) {
    if (!Array.isArray(obj[key])) {
      push(key, 'must be an array of 2-4 bullets');
    } else {
      obj[key] = clampArray(obj[key], 2, 4).map(s => (isStr(s) ? clampStr(s, CAP.bullet) : s));
      if (obj[key].length < 2) push(key, 'need at least 2 bullets');
      obj[key].forEach((s, i) => { if (!isStr(s)) push(`${key}[${i}]`, 'must be a non-empty string'); });
    }
  }

  // ── process_steps — 3-6 templatized steps. Each { name, detail }.
  if (!Array.isArray(obj.process_steps)) {
    push('process_steps', 'must be an array of 3-6 steps');
  } else {
    obj.process_steps = clampArray(obj.process_steps, 3, 6);
    if (obj.process_steps.length < 3) push('process_steps', 'need at least 3 steps (the repeatable engine)');
    obj.process_steps.forEach((s, i) => {
      const root = `process_steps[${i}]`;
      if (!s || typeof s !== 'object') { push(root, 'must be an object { name, detail }'); return; }
      if (isStr(s.name))   s.name   = clampStr(s.name, CAP.pkg_name);
      if (isStr(s.detail)) s.detail = clampStr(s.detail, CAP.step);
      if (!isStr(s.name))   push(`${root}.name`, 'required non-empty string');
      if (!isStr(s.detail)) push(`${root}.detail`, 'required non-empty string');
    });
  }

  // ── packages — 1-3 tiers
  if (!Array.isArray(obj.packages)) {
    push('packages', 'must be an array of 1-3 packages');
  } else {
    obj.packages = clampArray(obj.packages, 1, 3);
    if (obj.packages.length < 1) push('packages', 'need at least 1 package');
    obj.packages.forEach((pkg, i) => {
      const root = `packages[${i}]`;
      if (!pkg || typeof pkg !== 'object') { push(root, 'must be an object'); return; }
      if (isStr(pkg.name))      pkg.name      = clampStr(pkg.name, CAP.pkg_name);
      if (isStr(pkg.best_for))  pkg.best_for  = clampStr(pkg.best_for, CAP.pkg_best_for);
      if (isStr(pkg.turnaround))pkg.turnaround= clampStr(pkg.turnaround, CAP.turnaround);
      if (!isStr(pkg.name)) push(`${root}.name`, 'required non-empty string');
      validatePrice(pkg.price, `${root}.price`, push);
      if (!Array.isArray(pkg.whats_included)) {
        push(`${root}.whats_included`, 'must be an array of 2-6 bullets');
      } else {
        pkg.whats_included = clampArray(pkg.whats_included, 2, 6).map(s => (isStr(s) ? clampStr(s, CAP.pkg_included) : s));
        if (pkg.whats_included.length < 2) push(`${root}.whats_included`, 'need at least 2 bullets');
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

// Small helper for the UI / markdown export — a one-line price label.
export function formatServicePrice(price, symbolMap = {}) {
  if (!price || !isNum(price.amount)) return '';
  const sym = symbolMap[price.currency] || { EUR: '€', USD: '$', GBP: '£', AED: 'AED ', CHF: 'CHF ', BRL: 'R$' }[price.currency] || '';
  const amount = price.amount >= 1000 ? price.amount.toLocaleString('pt-PT') : String(price.amount);
  const suffix = price.model === 'per_month' ? '/mês' : price.model === 'per_unit' ? '/unidade' : '';
  return `${sym}${amount}${suffix}`;
}
