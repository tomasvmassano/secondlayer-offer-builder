---
name: hooks
description: 'Generate hooks (the first 3-5 seconds of any ad, post, DM, email, or video) using the Call-Out + Value Promise structure across 7 verbal types, with the 10:1 hook-to-content ratio and 70-20-10 innovation allocation. Use whenever the LLM is asked to write the OPENING line of anything: cold DM, ad headline, email subject, social post, podcast title, sales-page hero, or pitch-deck cover. Always generate 3-10 hook variants — never one. Source: Alex Hormozi, $100M Hooks Playbook (consolidated with overlap from $100M Goated Ads + $100M Leads — Free Content chapter).'
license: MIT
metadata:
  author: secondlayer
  version: "1.0.0"
---

# Hooks Framework

The hook is the highest-leverage thing in marketing. If the hook fails, nothing after it matters — the audience is already gone. Spend 80% of writing time on the hook, 20% on the rest.

## Anatomy: every hook = Call-Out + Value Promise

- **Call-Out** — invokes the cocktail-party effect. The reader hears their own name. ("Paid-community creators in Portugal…", "If you've launched twice and it flopped both times…", "For founders who hate writing…")
- **Value Promise** — the if-then payoff. ("…here's how to add €25K MRR in 90 days." / "…this 3-step swipe gets 38% reply rates.")

A hook missing the call-out is a generic statement. A hook missing the value promise is a tease without a payoff. Both halves are mandatory.

## The 7 Verbal Hook Types

Generate hooks across these types — never lean on one. The mix is the moat.

1. **Label** — "The 3 Closes Every Founder Needs."
2. **Yes / Open Question** — "Are you launching this quarter?" / "What's the #1 reason creators churn?"
3. **Conditional** — "If you have an audience > 10k, you should never run paid ads first."
4. **Command** — "Stop emailing your list weekly."
5. **Statement** — "Most paid communities die in month 4."
6. **List / Steps** — "5 things to fix on your sales page before you spend a euro on ads."
7. **Narrative** — "Three years ago Rui was deleting DMs unread. Today he does €25K/mo. Here's what changed."

Bonus 8: **Provocative Exclamation** — "Your offer is the problem!" Use sparingly; high reward, high risk.

## The 10:1 Hook-to-Content Ratio

For every piece of content (ad, video, post, email):
- Generate **at least 10 hook variants**.
- Pick the strongest 3 to test.
- Re-record / re-publish the same body under the winning hook.

**One ad with 10 hooks ≠ 10 ads with 1 hook.** Same body, different opening. The body is locked; the hook is the variable. This produces 5-10× the throughput per hour of recording.

## 70 / 20 / 10 Innovation Allocation

When deciding what hook types to write next:

- **70%** — proven hook types/themes that have already won for this creator.
- **20%** — adjacent variants of the proven winners (same type, new angle; or new type, same angle).
- **10%** — wild new bets (entirely new type or topic, unproven).

This is portfolio theory for marketing. Pure exploitation (100% proven) decays. Pure exploration (100% new) bleeds cash.

## Hook Sources (where to mine new hooks from)

When out of ideas, mine from these in order:

1. **Your own past winners** (highest signal — already tested).
2. **Your own free content's top performers** (organic posts that landed → re-cut as ads/DMs).
3. **Other creators' winning ads** in your niche (use ad libraries).
4. **Other creators' top free content** (their viral posts, your hook angle).
5. **Ad libraries** (Meta, TikTok, Google) — sort by run-time descending; long-runners are winners.

## Hook Bank Schema

Every creator should maintain a `hookBank` table:

| name | hookText | type | source | platform | views | conversionsOrReplies | linkUrl |

Sort by performance descending. The top-5 become the 70%-allocation pool for the next batch.

## Output Contract for the LLM

When asked to generate hooks for any asset, ALWAYS return:

```
{
  "hooks": [
    { "text": "...", "type": "label|question|conditional|command|statement|list|narrative", "callout": "...", "valuePromise": "...", "innovationTier": "70|20|10" },
    ...   // at least 10
  ],
  "recommendedTop3": [0, 4, 7],   // indexes into hooks[]
  "rationale": "Why these 3 are the strongest tests."
}
```

Per-output type sub-rules:
- **DM opener** → 5 hooks of mixed types, all under 12 words, must read like a human typing.
- **Ad headline** → 10 hooks, distributed 7/2/1 across innovation tiers.
- **Email subject line** → 5 hooks of mixed types, max 50 chars (mobile-truncation safe).
- **Sales-page hero** → 3 hooks (Conditional + Statement + Narrative), all under 18 words.
- **Pitch-deck cover** → 1 hook (Narrative or Statement preferred), reads as a promise to the specific creator.

## Common Failure Modes

- **One hook for everything** — wastes the asset.
- **Hooks that are headlines, not hooks** — generic, no call-out. ("5 Tips for Better Ads.")
- **Value promises without specificity** — "you'll grow your business" → kill it. Numbers, names, time-frames mandatory.
- **Same type over and over** — picking only Lists or only Questions. Forces audience to disengage.
- **Cute hooks for serious sellers** — clever wordplay reduces clarity. Plain > clever.
