// ─────────────────────────────────────────────────────────────────
// Phase 5 · Offer Judgment (Kill Test)
//
// Validates the output of /api/creators/[id]/offer-judgment, which
// scores each sequenced_play from the strategic_frame against six
// dimensions, runs a kill test, and ranks survivors. The judgment
// is the skeptical counterweight to the strategic frame — its job
// is to KILL bad offers before CP2-CP4 spend time building them.
//
// Lives at internal_metadata.offer_judgment.
// ─────────────────────────────────────────────────────────────────

export const POSTURE_VALUES = ['PASSIVE', 'ACTIVE'];
export const VERDICT_VALUES = ['KILL', 'SURVIVES'];
const SCORE_FIELDS = [
  'buyer_intent_density',
  'audience_offer_fit',
  'creator_time_cost',
  'friction',
  'market_validation',
  'defensibility',
];

const isStr = v => typeof v === 'string' && v.trim().length > 0;
const isScore = v => Number.isInteger(v) && v >= 1 && v <= 5;

export function validateOfferJudgment(obj) {
  const errors = [];
  const push = (path, msg) => errors.push(`${path}: ${msg}`);

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['offer_judgment must be an object'] };
  }

  // audience_classification ────────────────────────────────────────
  const ac = obj.audience_classification;
  if (!ac || typeof ac !== 'object') {
    push('audience_classification', 'required object');
  } else {
    if (!POSTURE_VALUES.includes(ac.posture)) {
      push('audience_classification.posture', `must be one of ${POSTURE_VALUES.join(' | ')}`);
    }
    if (!isStr(ac.posture_rationale)) {
      push('audience_classification.posture_rationale', 'required non-empty string');
    }
    if (!isStr(ac.what_audience_trusts_creator_FOR)) {
      push('audience_classification.what_audience_trusts_creator_FOR', 'required non-empty string');
    }
  }

  // offer_evaluations ──────────────────────────────────────────────
  if (!Array.isArray(obj.offer_evaluations)) {
    push('offer_evaluations', 'must be an array (one entry per sequenced_play)');
  } else if (obj.offer_evaluations.length === 0) {
    push('offer_evaluations', 'must contain at least 1 offer evaluation');
  } else {
    obj.offer_evaluations.forEach((ev, i) => {
      const root = `offer_evaluations[${i}]`;
      if (!ev || typeof ev !== 'object') {
        push(root, 'must be an object');
        return;
      }
      if (!isStr(ev.offer_name)) push(`${root}.offer_name`, 'required non-empty string');

      if (!ev.scores || typeof ev.scores !== 'object') {
        push(`${root}.scores`, 'required object with the six score fields');
      } else {
        SCORE_FIELDS.forEach(f => {
          const s = ev.scores[f];
          if (!s || typeof s !== 'object') {
            push(`${root}.scores.${f}`, 'required object { score, justification }');
            return;
          }
          if (!isScore(s.score)) push(`${root}.scores.${f}.score`, 'must be integer 1-5');
          if (!isStr(s.justification)) push(`${root}.scores.${f}.justification`, 'required non-empty string');
        });
      }

      const kt = ev.kill_test;
      if (!kt || typeof kt !== 'object') {
        push(`${root}.kill_test`, 'required object');
      } else {
        if (!isStr(kt.strongest_failure_reason)) {
          push(`${root}.kill_test.strongest_failure_reason`, 'required non-empty string');
        }
        if (typeof kt.survives !== 'boolean') {
          push(`${root}.kill_test.survives`, 'required boolean');
        }
        if (kt.survives === true && !isStr(kt.survival_reason)) {
          push(`${root}.kill_test.survival_reason`, 'required when survives=true (concrete reason the offer holds anyway)');
        }
      }

      if (!VERDICT_VALUES.includes(ev.verdict)) {
        push(`${root}.verdict`, `must be one of ${VERDICT_VALUES.join(' | ')}`);
      }
      if (ev.kill_test && typeof ev.kill_test.survives === 'boolean') {
        const expected = ev.kill_test.survives ? 'SURVIVES' : 'KILL';
        if (ev.verdict && ev.verdict !== expected) {
          push(`${root}.verdict`, `must be "${expected}" given kill_test.survives=${ev.kill_test.survives}`);
        }
      }
    });
  }

  // ranking ────────────────────────────────────────────────────────
  const rk = obj.ranking;
  if (!rk || typeof rk !== 'object') {
    push('ranking', 'required object');
  } else {
    if (!isStr(rk.weighting_explanation)) {
      push('ranking.weighting_explanation', 'required non-empty string (cite the audience_posture)');
    }
    if (!Array.isArray(rk.ranked_offers)) {
      push('ranking.ranked_offers', 'must be an array');
    } else {
      rk.ranked_offers.forEach((r, i) => {
        const root = `ranking.ranked_offers[${i}]`;
        if (!isStr(r?.offer_name)) push(`${root}.offer_name`, 'required non-empty string');
        if (typeof r?.weighted_score !== 'number') push(`${root}.weighted_score`, 'required number');
        if (!Number.isInteger(r?.rank) || r.rank < 1) push(`${root}.rank`, 'must be integer ≥ 1');
      });
    }

    // launch_first can be null (when all KILL'd) — only validate shape when present
    if (rk.launch_first !== null && rk.launch_first !== undefined) {
      if (typeof rk.launch_first !== 'object') {
        push('ranking.launch_first', 'must be object or null');
      } else {
        if (!isStr(rk.launch_first.offer_name)) push('ranking.launch_first.offer_name', 'required non-empty string');
        if (!isStr(rk.launch_first.why_it_beats_others)) push('ranking.launch_first.why_it_beats_others', 'required non-empty string');
      }
    }

    if (!Array.isArray(rk.required_validation_tests)) {
      push('ranking.required_validation_tests', 'must be an array (empty array OK if nothing speculative)');
    } else {
      rk.required_validation_tests.forEach((t, i) => {
        const root = `ranking.required_validation_tests[${i}]`;
        if (!isStr(t?.offer_name)) push(`${root}.offer_name`, 'required non-empty string');
        if (!isStr(t?.test))       push(`${root}.test`, 'required non-empty string');
        if (!isStr(t?.threshold))  push(`${root}.threshold`, 'required non-empty string (GO/NO-GO bar)');
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

// Helper for the UI — count surviving offers
export function countSurvivors(judgment) {
  if (!judgment?.offer_evaluations) return 0;
  return judgment.offer_evaluations.filter(e => e.verdict === 'SURVIVES').length;
}

// Helper for the UI — is the entire thesis dead?
export function isThesisDead(judgment) {
  if (!judgment?.offer_evaluations || judgment.offer_evaluations.length === 0) return false;
  return judgment.offer_evaluations.every(e => e.verdict === 'KILL');
}
