---
name: case-studies
description: 'A library of REAL public Skool/Whop community case studies organized by niche, plus benchmark math per niche. Use whenever generating output that must show the creator "this is what someone like you actually did" — first-call offers, pitch decks, sales pages. Critical for pre-close persuasion when the creator hasn''t shared any custom intake yet. The cases are real and publicly visible; cite them by exact name + member count + price.'
license: MIT
metadata:
  author: secondlayer
  version: "1.0.0"
---

# Case Studies — Real Skool & Whop Community Benchmarks

Use this knowledge whenever the generated output should show the creator a concrete, similar success — not a hypothetical. The data is publicly visible on Skool / Whop and was last refreshed manually. Numbers are observable as of mid-2026.

## Selection rule

When a creator's niche is given, pick **2–3 cases** that meet ALL of:

1. **Niche-adjacent** — same or one-step-adjacent vertical (cooking creator → other food/lifestyle communities; not crypto).
2. **Audience-size proportionate** — pick cases whose member count is within ~10× of the creator's followers (don't show a 200K-member case to an 8K-follower creator; cognitive dissonance).
3. **Price range plausible** — within 0.5× to 3× of the price we're proposing for the creator.

If no real Skool case fits the niche tightly, pick the most-relevant cross-niche case AND cite the niche-benchmark math from `references/niche-benchmarks.md` (e.g. "fitness coaches at this audience size typically run €39-69/mo with 6-9% monthly churn").

## How to cite (output format)

When citing a case in any generated asset:

```
{
  "name": "Community Empire",
  "niche": "Community building",
  "members": 345,
  "monthlyPrice": "$149/mo",
  "estimatedMrr": "$51,400",
  "shortResume": "Greg Isenberg's premium community for scaling other communities. Live calls, templates, direct founder access.",
  "skoolUrl": null,
  "asOf": "2026-05"
}
```

When rendering for a pitch deck or sales page (human reading):

> **Community Empire** — community-building niche · 345 members · $149/mo · ~$51K/mo MRR · Greg Isenberg's premium community for scaling other communities. Live calls + templates + founder access.

Always include the "asOf" caveat ("as of mid-2026") if the number could shift materially.

## Failure modes (what NOT to do)

- ❌ Don't invent member counts or revenue. If the data isn't in the references, say "benchmark range" instead of a fake number.
- ❌ Don't cite a case in the wrong niche just to fill a slot. Better to use a niche-benchmark range than a misfit case.
- ❌ Don't use top-decile outliers (Skoolers, Hormozi's Acquisition) as the relatable example for a small creator — those are aspirational ceiling, not the typical case. Pair them with a more-relatable mid-tier case.
- ❌ Don't claim associations Second Layer doesn't have ("we built X" when we didn't) — these are public benchmarks, not our portfolio.

## Output Contract

When generating an asset that uses cases:

```
{
  "casesShown": [
    { /* case object as above */ },
    ...
  ],
  "selectionRationale": "Why these 2-3 cases are right for THIS creator (niche fit + audience scale + price range)."
}
```
