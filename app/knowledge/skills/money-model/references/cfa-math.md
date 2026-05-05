# CFA Math — LTGP, CAC, PPD

## Lifetime Gross Profit (LTGP)

Recurring business: `LTGP = Gross Profit per period / monthly churn rate`
Transactional business: `LTGP = Gross Profit per transaction × avg transactions per customer`

For a paid creator community at €39/mo with 70% gross margin and 8% monthly churn:
`LTGP = (39 × 0.70) / 0.08 = 27.30 / 0.08 = €341 per member`

## Customer Acquisition Cost (CAC)

`CAC = (total ad spend + sales-team cost in period) / new customers in period`

Includes: media spend, agency fees, sales rep salary fraction, tools.
Excludes: COGS (delivery cost) — that goes into LTGP, not CAC.

## Payback Period in Days (PPD)

`PPD = CAC / (30-day Gross Profit per customer)`

PPD < 30 = Customer-Financed Acquisition (you can scale on the float).
PPD 30–90 = needs working capital but credit-card scalable.
PPD > 90 = needs outside funding to scale aggressively.

## CFA Level Lookup

| LTGP : CAC ratio | Level | Action |
|---|---|---|
| < 1.5× | RED | Don't scale. Fix model first. |
| 1.5–3× | L1 | OK, but capital-constrained. |
| 3–5× | L2 | Safe to grow with reinvested profit. |
| > 5× | L3 | Infinite-scale candidate. Pour gas on. |

## Quick sensitivity table (paid community @ €39/mo, 70% GP, 8% churn)

| CAC | LTGP/CAC | Level |
|---|---|---|
| €25 | 13.6× | L3 |
| €50 | 6.8× | L3 |
| €100 | 3.4× | L2 |
| €150 | 2.3× | L1 |
| €250 | 1.4× | RED |

If the creator's CAC > €100, push for either an attraction-offer order bump (+€20 GP) or a one-click upsell (+€50 GP) before scaling ads. Both move the model up a level.
