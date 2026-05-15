/**
 * Value Stack + Pricing (Phase 4 · Checkpoint 4) schema + validator.
 *
 * Produces FOUR pieces of client_facing_output:
 *   1. mechanism          — the named A-O acronym mechanism ("S.T.R.I.D.E.")
 *   2. value_stack        — Hormozi-style items[] with $ values + total
 *   3. pricing_tiers      — 1-3 tier table (the pitch deck slide 4 table)
 *   4. unlocked_bonuses   — month-by-month value drops
 *
 * Pricing-multiple discipline:
 *   value_stack.total SHOULD be 5-10× value_stack.actualPrice. The validator
 *   does NOT enforce this strictly (€ vs $ ambiguity makes it brittle) but
 *   the prompt tells the model and a soft warning surfaces when too low.
 *
 * Mechanism naming:
 *   Each letter in mechanism.name must have a corresponding entry in
 *   mechanism.letters (one-to-one). Validator enforces this so we don't
 *   ship a "S.T.R.I.D.E." with only 4 explanations.
 */

function isStr(v) { return typeof v === 'string' && v.length > 0; }

// Extract letters from a possibly-dotted mechanism name. "S.T.R.I.D.E." → "STRIDE"
function lettersOf(name) {
  if (!name) return '';
  return String(name).replace(/[^A-Za-z]/g, '').toUpperCase();
}

// Naive currency-amount extractor. Pulls the FIRST numeric value from a
// price string. "€1,500" → 1500; "€297/mo" → 297; "€2,497 + €197/mo" → 2497.
// Returns null if no number found. Used for the soft multiple check below.
export function extractAmount(priceStr) {
  if (!priceStr) return null;
  const m = String(priceStr).match(/([\d.,]+)/);
  if (!m) return null;
  const cleaned = m[1].replace(/,/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function validateValueStack(obj) {
  const errors = [];
  const warnings = [];
  const push = (p, msg) => errors.push(`${p}: ${msg}`);

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['root: must be a JSON object'], warnings: [] };
  }

  // ── mechanism — named acronym + per-letter explanations
  if (!obj.mechanism || typeof obj.mechanism !== 'object' || Array.isArray(obj.mechanism)) {
    push('mechanism', 'required object { name, letters: [...], description }');
  } else {
    const m = obj.mechanism;
    if (!isStr(m.name)) push('mechanism.name', 'required non-empty string (e.g. "S.T.R.I.D.E.")');
    else if (m.name.length > 30) push('mechanism.name', `should be ≤30 chars (got ${m.name.length})`);
    if (!isStr(m.description)) push('mechanism.description', 'required non-empty string (1-2 sentences explaining the mechanism as a whole)');
    else if (m.description.length > 400) push('mechanism.description', `should be ≤400 chars (got ${m.description.length})`);
    if (!Array.isArray(m.letters)) {
      push('mechanism.letters', 'must be an array, one entry per letter of the mechanism name');
    } else {
      const expectedLetters = lettersOf(m.name);
      if (expectedLetters.length === 0) {
        push('mechanism.letters', 'mechanism.name has no extractable letters — cannot validate the letters array');
      } else if (m.letters.length !== expectedLetters.length) {
        push('mechanism.letters', `must have exactly ${expectedLetters.length} entries (one per letter in "${expectedLetters}"); got ${m.letters.length}`);
      }
      m.letters.forEach((l, i) => {
        const px = `mechanism.letters[${i}]`;
        if (!l || typeof l !== 'object' || Array.isArray(l)) { push(px, 'must be an object'); return; }
        if (!isStr(l.letter) || l.letter.length !== 1) push(`${px}.letter`, 'must be a single character');
        if (!isStr(l.word)) push(`${px}.word`, 'required non-empty string (≤30 chars)');
        else if (l.word.length > 30) push(`${px}.word`, `should be ≤30 chars (got ${l.word.length})`);
        if (!isStr(l.explanation)) push(`${px}.explanation`, 'required non-empty string (≤200 chars)');
        else if (l.explanation.length > 200) push(`${px}.explanation`, `should be ≤200 chars (got ${l.explanation.length})`);
        // Per-letter consistency: l.letter must match the i-th letter of name
        if (isStr(m.name) && isStr(l.letter)) {
          const expected = expectedLetters[i];
          if (expected && expected !== l.letter.toUpperCase()) {
            push(`${px}.letter`, `should be "${expected}" to match position ${i + 1} of mechanism.name (got "${l.letter}")`);
          }
        }
      });
    }
  }

  // ── value_stack — items[] + total + actualPrice
  if (!obj.value_stack || typeof obj.value_stack !== 'object' || Array.isArray(obj.value_stack)) {
    push('value_stack', 'required object { items: [...], total, actualPrice }');
  } else {
    const vs = obj.value_stack;
    if (!Array.isArray(vs.items)) {
      push('value_stack.items', 'must be an array of 4-8 stack items');
    } else if (vs.items.length < 4 || vs.items.length > 8) {
      push('value_stack.items', `must contain 4-8 items (got ${vs.items.length})`);
    } else {
      vs.items.forEach((it, i) => {
        const px = `value_stack.items[${i}]`;
        if (!it || typeof it !== 'object' || Array.isArray(it)) { push(px, 'must be an object'); return; }
        if (!isStr(it.problem)) push(`${px}.problem`, 'required non-empty string (≤200 chars, the pain this addresses)');
        else if (it.problem.length > 200) push(`${px}.problem`, `should be ≤200 chars (got ${it.problem.length})`);
        if (!isStr(it.solution)) push(`${px}.solution`, 'required non-empty string (≤200 chars, how the offer solves it)');
        else if (it.solution.length > 200) push(`${px}.solution`, `should be ≤200 chars (got ${it.solution.length})`);
        if (!isStr(it.delivery)) push(`${px}.delivery`, 'required non-empty string (≤120 chars, format/mechanic)');
        else if (it.delivery.length > 120) push(`${px}.delivery`, `should be ≤120 chars (got ${it.delivery.length})`);
        if (!isStr(it.dollarValue)) push(`${px}.dollarValue`, 'required non-empty string (e.g. "€500", "€1,500")');
      });
    }
    if (!isStr(vs.total)) push('value_stack.total', 'required non-empty string (sum of all dollarValues)');
    if (!isStr(vs.actualPrice)) push('value_stack.actualPrice', 'required non-empty string (matches CP2 target_price)');

    // Soft check: total should be 5-10× actualPrice
    if (isStr(vs.total) && isStr(vs.actualPrice)) {
      const totalNum = extractAmount(vs.total);
      const priceNum = extractAmount(vs.actualPrice);
      if (totalNum && priceNum && priceNum > 0) {
        const multiple = totalNum / priceNum;
        if (multiple < 3) {
          warnings.push(`value_stack total (${vs.total}) is only ${multiple.toFixed(1)}× the actualPrice (${vs.actualPrice}). Hormozi target is 5-10×. Stack feels weak — inflate item dollarValues or add items.`);
        } else if (multiple > 15) {
          warnings.push(`value_stack total (${vs.total}) is ${multiple.toFixed(1)}× the actualPrice (${vs.actualPrice}). Above 10× starts to feel dishonest — pull back.`);
        }
      }
    }
  }

  // ── pricing_tiers — 1-3 rows for the pitch slide 4 table
  if (!Array.isArray(obj.pricing_tiers)) {
    push('pricing_tiers', 'must be an array of 1-3 tier objects');
  } else if (obj.pricing_tiers.length < 1 || obj.pricing_tiers.length > 3) {
    push('pricing_tiers', `must contain 1-3 tiers (got ${obj.pricing_tiers.length})`);
  } else {
    obj.pricing_tiers.forEach((t, i) => {
      const px = `pricing_tiers[${i}]`;
      if (!t || typeof t !== 'object' || Array.isArray(t)) { push(px, 'must be an object'); return; }
      if (!isStr(t.name)) push(`${px}.name`, 'required non-empty string (≤40 chars)');
      else if (t.name.length > 40) push(`${px}.name`, `should be ≤40 chars (got ${t.name.length})`);
      if (!isStr(t.price)) push(`${px}.price`, 'required non-empty string');
      if (!isStr(t.note)) push(`${px}.note`, 'required non-empty string (≤140 chars, what is included)');
      else if (t.note.length > 140) push(`${px}.note`, `should be ≤140 chars (got ${t.note.length})`);
    });
  }

  // ── unlocked_bonuses — 4-8 month-tagged value drops
  if (!Array.isArray(obj.unlocked_bonuses)) {
    push('unlocked_bonuses', 'must be an array of 4-8 month-tagged strings');
  } else if (obj.unlocked_bonuses.length < 4 || obj.unlocked_bonuses.length > 8) {
    push('unlocked_bonuses', `must contain 4-8 bonuses (got ${obj.unlocked_bonuses.length})`);
  } else {
    obj.unlocked_bonuses.forEach((s, i) => {
      if (!isStr(s)) push(`unlocked_bonuses[${i}]`, 'must be a non-empty string');
      else if (s.length > 160) push(`unlocked_bonuses[${i}]`, `should be ≤160 chars (got ${s.length})`);
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}
