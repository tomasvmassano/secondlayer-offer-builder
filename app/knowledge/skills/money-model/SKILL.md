---
name: money-model
description: 'Build a 4-stage offer architecture (Attraction → Upsell → Downsell → Continuity) so 30-day gross profit exceeds CAC + COGS — i.e. the customer finances their own acquisition. Use when designing the FULL revenue path for a creator (not a single offer), planning order bumps, one-click upsells, save offers, continuity perks, or computing CFA Level (L1/L2/L3). Pair with hundred-million-offers for the core-offer engineering, and pricing-plays for monetization layers. Source: Alex Hormozi, $100M Money Models.'
license: MIT
metadata:
  author: secondlayer
  version: "1.0.0"
---

# 4-Stage Money Model

A "money model" is the full sequence of offers a customer encounters from first ad click to multi-year retention, engineered so the **30-day Gross Profit beats Customer Acquisition Cost** ("Customer-Financed Acquisition", CFA). When CFA hits, the business funds its own growth and can outbid every competitor on ads.

## The 4 Stages (in order)

Every Hormozi-grade money model has all four. Missing one = leaving money on the table.

1. **Attraction Offer** — what gets a stranger to raise their hand and pay (or commit) for the first time.
2. **Upsell Offer** — what they buy in the same order/session because they're hot.
3. **Downsell Offer** — what they buy when they say no to the upsell (don't lose them).
4. **Continuity Offer** — what makes them keep paying (subscription, retainer, repeat).

## Stage 1 — Attraction Offer (6 named types)

Pick ONE based on the creator's audience temperature, ad budget, and cash position:

- **Win Your Money Back** — "buy the course, complete it, get every cent back." Dramatic risk reversal; converts cold traffic.
- **Giveaway** — free physical/digital prize entry; captures emails at near-zero CAC; convert later.
- **Decoy Offer** — three tiers where the middle is engineered to look obvious; raises AOV.
- **Buy X Get Y Free** — bundle expansion; works when COGS on Y is low.
- **Pay Less Now or Pay More Later** — price-anchored urgency; great for cohorts.
- **Free Goodwill Offer** — pure value gift; builds the brand bouquet, not direct revenue. Use sparingly.

> **Default for paid creator communities:** Decoy Offer (3 tiers with anchor) or Win Your Money Back (with a 30-day completion-based guarantee).

## Stage 2 — Upsell Offer (4 named types)

Run RIGHT AFTER the attraction-offer purchase, while card is still on file:

- **Classic Upsell** — "want the premium version for $X more?"
- **Menu Upsell** — show 3–5 add-ons; let them pick.
- **Anchor Upsell** — present a 5–10× priced premium first; relief-buy the mid-tier.
- **Rollover Upsell** — credit the attraction-offer price toward a higher tier ("apply your $99 toward the $999 program").

**Script sequence to use on every upsell:** Unsell → Prescribe → A/B → Card-on-File.
- *Unsell*: "Most people don't need this. Skip if X."
- *Prescribe*: "But IF you're Y, the right next step is Z."
- *A/B*: "Two ways to do this — A is faster, B is cheaper."
- *Card-on-File*: "I've already got your card. Want me to apply it?"

## Stage 3 — Downsell Offer (3 named types)

Triggered when the prospect declines the upsell — recover revenue you'd otherwise lose:

- **Payment Plan Downsell** — same offer, broken into installments.
- **Trial With Penalty** — first 30 days free, charged in full if they don't cancel.
- **Feature Downsell** — strip out the guarantee, the bonus, or the live coaching to lower the price; preserves margin.

## Stage 4 — Continuity Offer (3 named types)

Where the long-term LTGP lives. Always recurring:

- **Continuity Bonus** — every month they stay, they unlock a new bonus ("month 3 = group call, month 6 = private 1:1").
- **Continuity Discount** — price decreases the longer they stay ("year 1 = $99/mo, year 2 = $79/mo, year 3 = $59/mo"). Reduces churn dramatically.
- **Waived Fee Offer** — waive the setup/annual fee in exchange for a multi-month/year prepay.

> **For paid communities:** stack Continuity Bonus (monthly milestone unlock) + Waived Fee (annual prepay = 2 months free). Combined with milestone bonuses, this is the stickiest configuration.

## Right Stage / Right Problem / Right Way / Right Time

When stacking the 4 stages, every offer must pass:
- **Right Stage** — does this prospect's relationship-temperature warrant this ask?
- **Right Problem** — does this offer solve the next problem they actually have?
- **Right Way** — is the delivery format congruent with their stated preference (DIY / DWY / DFY)?
- **Right Time** — is now the moment of maximum receptivity (post-win, pre-deadline, etc.)?

Fail any of the four = drop or delay the offer.

## CFA Math (the win condition)

The model wins when:

```
30-day Gross Profit ≥ CAC + COGS
```

Three CFA Levels:

| Level | Condition | Implication |
|---|---|---|
| **L1** | 30-day GP < CAC | Requires outside capital to scale. Risky. |
| **L2** | 30-day GP ≈ CAC | Credit-card-fundable. Safe to scale slowly. |
| **L3** | 30-day GP > CAC | Infinitely scalable. The goal state. |

**If a creator's model is L1, the only fixes are:** (a) raise the attraction-offer price, (b) add an order bump that boosts GP within the first session, (c) add a one-click upsell post-purchase, or (d) reduce delivery cost. Always add at least one upsell BEFORE running paid traffic.

## Output Contract for the LLM

When generating a Money Model for a creator, return JSON-shaped:

```
{
  "attractionOffer":   { "type": "...", "name": "...", "price": 0, "copy": "...", "rationale": "..." },
  "coreOffer":         { /* full Grand Slam Offer per hundred-million-offers skill */ },
  "upsellOffer":       { "type": "...", "trigger": "...", "price": 0, "script": { "unsell": "...", "prescribe": "...", "ab": "...", "card": "..." } },
  "downsellOffer":     { "type": "...", "trigger": "...", "price": 0, "copy": "..." },
  "continuityOffer":   { "type": "...", "monthlyHook": "...", "price": 0, "copy": "..." },
  "thirtyDayProjection": { "GP": 0, "CAC": 0, "COGS": 0, "cfaLevel": "L1|L2|L3", "explanation": "..." },
  "rightStageCheck":   { "stage": true, "problem": true, "way": true, "time": true, "notes": "..." }
}
```

## Common Failure Modes

- **Skipping Stage 3 (Downsell)** — leaves 15-30% of attraction-offer buyers on the table.
- **No Continuity** — turns a business into a hamster wheel of new acquisition every month.
- **Continuity priced higher than perceived monthly value** — instant churn at month 2.
- **Stacking 4 upsells in a row** — exhausts the buyer; they refund the attraction.
- **L1 model + paid ads** — fastest way to bankrupt a creator. Force at least L2 before any media spend.
