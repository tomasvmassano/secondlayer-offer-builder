---
name: pricing-plays
description: '10 instant-profit pricing plays + the R-A-I-S-E letter framework for raising prices on existing customers without losing them. Use when setting initial pricing, picking billing cycles, designing tiered offers with anchors, scheduling annual price increases, or writing the price-raise communication. Always pair with money-model (continuity stage) and hundred-million-offers (perceived value). Source: Alex Hormozi, $100M Pricing Playbook + $100M Price Raise Playbook.'
license: MIT
metadata:
  author: secondlayer
  version: "1.0.0"
---

# Pricing Plays

## Core principle (the math)

Profit doesn't come from more customers. It comes from charging more.

The 3-lever math:
- **2× customers → 3.5× profit**
- **2× purchase frequency → 3.5× profit**
- **2× price → 6× profit**

Always reach for the price lever first. It compounds: higher price → better customers → less support load → higher margin → more cash for proof → easier to raise again.

## Three Pricing Models (only one is right)

1. **Cost-Plus** — set price as cost × markup. Race to the bottom. Don't use.
2. **Market/Competitor** — match what the market charges. Mediocre. Don't use.
3. **Value-Based** — set price as a fraction of the dream-outcome value to the buyer. ALWAYS use this.

**Rule:** if you don't know the dream-outcome value to the buyer in dollars, you can't price the offer yet. Stop and find out.

## The 10 Instant Profit Plays

Apply as many as fit. Each is independently additive.

| # | Play | What it does | Effort |
|---|---|---|---|
| 1 | **28-day billing cycle** | 13 cycles/yr instead of 12 | Trivial config change |
| 2 | **Pass on processing fees** + add a 2nd payment method | Recover 2.9% margin + capture more buyers | Low |
| 3 | **Add sales tax** as line item | Stop eating it | Low |
| 4 | **Annual price increases** (locked in writing) | Compounds 5–15%/yr forever | One-time policy |
| 5 | **Annual prepay tier** (10–17% discount) | Cashflow upgrade + churn shield | Mid |
| 6 | **Round up** the price | $99 → $100, $497 → $500 | Trivial |
| 7 | **Annual renewal fee** on top of monthly | Service businesses recover loaded cost | Mid |
| 8 | **Auto-renew on by default** | Default opt-in is law | Mid |
| 9 | **Ultra-high-ticket anchor tier** (5–10× the recommended) | Reframes core tier as "the reasonable one" | Mid |
| 10 | **Guarantee/warranty upsell** as separate SKU | Pure-margin add-on | Low |

> **Default for paid creator community:** Plays 1, 4, 5, 8, 9 are non-negotiable. Plays 6, 10 are easy wins.

### Play 1 detail: 28-day billing
Don't say "monthly". Say "every 4 weeks". Year = 13 cycles, not 12. On €39/mo, that's an extra €39/yr per member at zero acquisition cost.

### Play 4 detail: annual increases
Lock the increase in the kickoff brief: "Annual rate adjustment of 7% on Jan 1 of each year." Then ACTUALLY do it. Most creators never raise; the discipline is the moat.

### Play 9 detail: anchor tier
Always present 3 tiers. The top one (5–10× recommended) doesn't need to sell — its job is to make the middle tier feel rational. For a €39/mo community, anchor is a €399/mo "founders inner circle" with monthly 1-on-1.

## R-A-I-S-E Letter Framework

When raising prices on existing customers (or relaunching at higher price), use this 5-block letter. Every block is mandatory. Order matters.

- **R — Remind** them of the value already provided. Specific results, before-and-after numbers, named milestones. Triggers reciprocity.
- **A — Address** the price change directly. The new price, in plain text. No apology, no hedging. "Starting Jan 1, the price is €59/mo."
- **I — Invest** in their future. State exactly what the higher price funds: faster turnaround, new feature, more 1-on-1, better software. Tie the increase to their benefit, not yours.
- **S — Soften** with a loyalty reward. Lock the existing rate for a window ("you keep €39/mo through end of Q2"), give a one-time bonus, or a downgrade path.
- **E — Explain** away predictable concerns. FAQ format. Pre-empt: "Why now? What if I can't afford it? Can I cancel?"

### Iron rules of the price raise

- **Never apologize.** Apology signals the price isn't fair. It is.
- **Lead with explainer video.** Email alone gets 1/3 the comprehension. Loom + email > email alone.
- **Turn off comments.** Route to DM/email. Public complaints attract more complaints.
- **New customers pay the new price immediately.** No grandfather window for sign-ups after the announcement date.
- **Once announced, never roll back.** Reversing teaches the market that complaint = discount.

## Output Contract for the LLM

When generating pricing for a creator, always return:

```
{
  "model": "value-based",
  "tiers": [
    { "name": "...", "price": 0, "billingCycle": "28-day", "purpose": "anchor|recommended|entry" },
    ...
  ],
  "annualPrepay": { "discountPct": 0, "monthsFree": 0 },
  "autoRenew": true,
  "annualIncrease": { "pct": 0, "schedule": "Jan 1" },
  "playsApplied": ["28day", "annual-increase", "anchor", ...],
  "rationale": "Why these tiers, anchored on which dream-outcome value."
}
```

When generating a price-raise letter, return all 5 RAISE blocks separately (so they can be edited individually) plus a 60-second explainer video script using the same 5 beats.
