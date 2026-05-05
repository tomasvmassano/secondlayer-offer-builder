---
name: ad-assembly
description: 'Stop "making" ads — assemble them. Output an ad MATRIX (50 hooks × 3-5 meats × 1-3 CTAs) instead of finished ads, so the team can mass-produce 150-750 ad variants per week. Use as the primary skill for /api/launch-generate Ad Creative phase. Pulls from hooks (for the hook bank) and uses the Schwartz Awareness Pyramid to allocate hooks across cold-to-warm audiences. Source: Alex Hormozi, $100M Goated Ads Playbook.'
license: MIT
metadata:
  author: secondlayer
  version: "1.0.0"
---

# Ad Assembly

The wrong question: "Can you write 5 ads?"
The right question: "Can you assemble 50 hooks, 5 meats, and 3 CTAs?"

Output: 50 × 5 × 3 = **750 ad combinations** from one prep doc. Recombine, rotate, retire losers.

## Time Allocation (this is the key)

- **80%** of time → Hooks (where the win is decided)
- **20%** of time → Meats (where the conversion happens)
- **~0%** of time → CTAs (3 templates handle every situation)

Most creators invert this. They spend 70% on the body and 5% on the hook. Result: pretty ads nobody watches.

## The Ad Equation

```
Ad = Hook + Meat + CTA
```

Each part is independently produced and remixed. NEVER write a finished ad as the unit of work. Hook bank, meat bank, CTA bank → assembled per ad spot.

## Schwartz Awareness Pyramid (5 levels — continuous)

Every audience member is somewhere on this pyramid. Distribute hooks across all 5 levels:

| Level | What they know | Hook leans on |
|---|---|---|
| **Most-Aware** | Know your offer, just need a deal | Offer/discount/bonus |
| **Product-Aware** | Know your category exists | Proof / testimonial |
| **Solution-Aware** | Know a solution exists, not yours | Promise / dream outcome |
| **Problem-Aware** | Know they have a problem | Pain / agitation |
| **Unaware** | Don't know they have a problem | Curiosity / pattern interrupt |

**Default distribution for cold paid traffic:**
- 20% Most-Aware
- 30% Product-Aware
- 30% Solution-Aware
- 15% Problem-Aware
- 5% Unaware

**For warm retargeting:** invert toward 50% Most-Aware, 30% Product-Aware, 20% Solution-Aware, 0% Problem/Unaware.

**For brand-new offers (no proof yet):** skew Problem-Aware (40%) and Solution-Aware (40%).

### Expansion Hooks
Deliberately write hooks one awareness level BROADER than the current best-performer to expand reach. If your top hooks are Most-Aware (offer-driven), write Product-Aware (proof-driven) variants to expand to the next pool. This is how ads scale past their first ceiling.

## The 5 Meat Formats

Body of the ad. Pick one per spot; rotate weekly:

1. **Demonstration** — show the thing happening on screen. ("Here's the dashboard, here's the click, here's the outcome.")
2. **Testimonial** — customer's own words/face/voice. (See `marketing-machine` for capture.)
3. **Education** — teach something useful in 30-60s; the offer is the "want more?" CTA.
4. **Story** — narrative arc with a twist. ("3 years ago I was X. Now I'm Y. Here's what happened.")
5. **Faceless** — text-on-screen, B-roll, voiceover. Cheapest to produce; works at scale.

Goal: at least 3 of the 5 formats running concurrently. If one wins for a quarter, lean into More (more variants) before Better (re-shoot) before New (different format).

## CTA Formula (only 3 you ever need)

Every CTA includes 5 elements:
- **What** — the action ("tap the link")
- **How** — the mechanic ("fill the 3-question form")
- **When** — urgency ("by Friday")
- **What they get** — payoff ("free 30-min audit")
- **What happens next** — clarity ("I reply within 24h with a calendar link")

**The 3 reusable CTAs:**

1. **Direct-Buy CTA** — "Tap to claim your spot. €39/mo, 30-day money-back. You're inside in 60 seconds."
2. **Lead-Capture CTA** — "Tap, drop your email, I send the playbook. No call, no spam, no follow-up unless you reply."
3. **Book-Call CTA** — "Tap, pick a 30-min slot, I personally walk you through whether this fits. No pitch unless you ask."

Pick by offer price: < €100 → Direct-Buy. €100-€2K → Lead-Capture or Book-Call. > €2K → Book-Call only.

## The Assembly Output Contract

When generating Ad Creative for a launch, return:

```
{
  "hooks": [
    { "text": "...", "awareness": "most|product|solution|problem|unaware", "type": "label|question|conditional|command|statement|list|narrative" },
    ...   // exactly 50, distributed per the awareness percentages above
  ],
  "meats": [
    { "format": "demonstration", "script": "...", "shotlist": [...], "lengthSec": 30 },
    { "format": "testimonial", ... },
    { "format": "education", ... },
    { "format": "story", ... },
    { "format": "faceless", ... }
  ],
  "ctas": [
    { "type": "direct-buy", "copy": "..." },
    { "type": "lead-capture", "copy": "..." },
    { "type": "book-call", "copy": "..." }
  ],
  "weekOneTestSet": [
    { "hookIdx": 0, "meatIdx": 0, "ctaIdx": 0, "platform": "meta" },
    ...   // 9 combinations: top-3 hooks × 3 meats × matched CTA
  ],
  "expansionHookCandidates": [3, 17, 22],   // indexes of broader hooks for scale
  "iterationPlan": "After 7 days, retire bottom 50% by CTR; A/B winners against expansion hooks."
}
```

## Per-platform tweaks (Meta vs TikTok)

- **Meta:** square 1:1 + 4:5; first 3 seconds = entire hook; faceless > face for cold; 15-30s sweet spot.
- **TikTok:** vertical 9:16; native-feel mandatory (no captions on top of video); story + faceless dominate; 15-45s.
- **YouTube Shorts:** mirror TikTok specs; education performs higher than on TikTok.

## Common Failure Modes

- **Writing finished ads instead of an assembly matrix** — locks the team to 1 ad per hour instead of 10.
- **All hooks at one awareness level** — caps your audience reach.
- **Re-shooting the meat for every hook** — wastes 80% of production time.
- **CTAs that don't match the offer price** — direct-buy CTA on a €5K offer = wasted clicks.
- **Skipping the iteration plan** — running the same 9 combos for 60 days; missing winning expansions.
