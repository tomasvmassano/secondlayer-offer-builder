---
name: closing
description: 'Close sales by classifying the prospect''s objection into one of 4 BLAME BUCKETS (Circumstances / Other People / Self / Genuine question) and selecting the matching named close from a 30+ swipe-file library. Always validate first, then transition. Use in /api/dm-reply (objection handling), /api/dm-rewrite (validate-then-transition pass), /api/dm-writer (STAR pre-qualification), and /pitch objection-appendix slide. Source: Alex Hormozi, $100M Closing Playbook.'
license: MIT
metadata:
  author: secondlayer
  version: "1.0.0"
---

# Closing — Blame Classification + Named Closes

## Core Doctrine

A prospect doesn't fail to close because of price/time/spouse. They fail to close because they're protecting themselves from blame. To close, you must give them their power back by dismantling the source of blame.

**Process:**
1. **Validate** — "Totally get it" / "Makes sense" / "I'd think the same" — ALWAYS the first words.
2. **Classify** — what's the blame source? (4 buckets below.)
3. **Transition** — pick a named close from the matching bucket.
4. **Re-ask** — never assume the close worked. Ask for the decision.

Skip step 1 = the prospect digs in. Skip step 4 = no close.

## STAR Pre-Qualification (BEFORE the close)

Before any close attempt, qualify on STAR. If they fail any letter, fix that first:

- **S**ituation — do they actually have the problem this offer solves?
- **T**iming — is this the right moment for them?
- **A**uthority — are they the decision-maker?
- **R**esources — can they actually afford it?

Closing an unqualified prospect is the #1 cause of refunds.

## The 4 Blame Buckets

When the prospect hesitates, listen for which they're using:

| Bucket | Sounds like | Examples |
|---|---|---|
| **Circumstances** | "I don't have time / money / right now" | Time, money, price, deadline |
| **Other People** | "I need to ask my [spouse / partner / boss]" | Permission, alignment with someone external |
| **Self** | "I'm not sure / let me think / I'm a slow decider" | Personality, fear, preference |
| **Genuine Question** | "Can you walk me through how X works?" | Real information gap, NOT a stall |

Genuine questions get answered. The other 3 get a closing script.

## All-Purpose Closes (use when the bucket is unclear)

- **What's Your Main Concern?** — "If we cleared up that one thing, would you sign today?"
- **Reason** — "What's the reason you'd say no right now?"
- **Hypothetical** — "Hypothetically, if money/time wasn't an issue, would you do this?"
- **Zoom Out** — "Forget the price for a sec. Is this even the right thing for you?"
- **1-to-10** — "On a scale of 1-10, how excited are you? Why not a 10?"
- **Best Case / Worst Case** — "What's the worst that happens if you do? What's the worst if you don't?"
- **Card Not On Me** — "OK, want to lock the spot now and we'll handle payment after the call?"

## CIRCUMSTANCES — Time Closes

- **Better To Start When You're Busy** — "The busy version of you is the version that needs the system. The not-busy version doesn't need it."
- **You're Gonna Get Busy Again** — "If 'when I'm less busy' is the bar, you'll be saying that in 6 months too."
- **It's About Priorities** — "You found time for X last month. This is the same time choice."
- **Smartphone** — "When you bought your phone, you didn't 'find time' first. You decided it was important."
- **When/Then** — "When would be the right time? Then. Why not just commit to start in 30 days?"

## CIRCUMSTANCES — Money Closes

- **It's Good That It's A Lot** — "If it were €50, you'd treat it like a €50 thing. The price is part of why it works."
- **Good Things Aren't Cheap** — "Cheap things aren't good. Good things aren't cheap. Which one are you trying to buy?"
- **Some Now Or More Later** — "Either you pay €X now or you pay €5X in lost months later."
- **Future Favor** — "The future-you who has this thing built is going to be furious you didn't start now."
- **Resourcefulness Not Resources** — "It's not about having the money. It's about deciding to find it."
- **Cheap Comparison** — "You'll spend more on coffee this year than this offer costs."
- **Good-Fast-Cheap** — "You can have any 2 of 3. Which are you optimizing for?"
- **We Could Do It For More** — "Honestly, this should be priced higher. The next cohort probably will be."

## OTHER PEOPLE — Authority Closes (Spouse/Partner/Boss)

- **Spouse Permission Ladder** — "Has your partner ever stopped you from doing something you really wanted? No? So they trust your judgment. So this is your call."
- **Support Not Permission** — "You're not asking for permission. You're letting them know what you've decided."
- **3-Day No-Sweat Guarantee** — "Lock it in now. Talk to them tonight. You have 72h to back out, full refund. Win-win."
- **Whose Money Is It?** — "Is this your money or theirs? Then this is your call."

## SELF — Self-Doubt Closes

- **Isolate And Solve** — "Aside from [the surface objection], is there anything else?" Strip away till you find the real one.
- **Pain of Change vs Pain of Staying Same** — "The pain of doing nothing is what you live with every day. The pain of doing this is over in 30 days."
- **You Gotta Change To Change** — "If you do what you've been doing, you'll get what you've been getting."
- **Mechanic Close** — "If your car's broken and the mechanic says it'll take €X to fix, do you say 'let me think about it'? No. You fix the car."
- **Surgeon Secretary** — "When the surgeon says you need surgery, you don't ask the secretary what she thinks. Stop asking the wrong people."
- **Decadere** — Latin for 'to fall' = decision. "A decision IS a fall — you can never go back. That's what makes it powerful."
- **The Gameplan Close** — "Look, here's the gameplan: you join, week 1 you do X, week 2 Y, week 3 Z. Are you in for the gameplan?"
- **It Doesn't Take Time, It Takes Information** — "You don't need 2 weeks to think. You need the information. Ask me anything right now and let's decide."

## Validate-Then-Transition Templates

Every reply, every close, opens with one of these:

- "Totally get it…"
- "That makes complete sense…"
- "Yeah, I'd think the same in your position…"
- "Fair concern. So here's how I think about it…"
- "Hear you. The way I'd frame it is…"

NEVER skip the validation. NEVER lead with "but" — use "and" or restart the sentence.

## Output Contract for the LLM

When `/api/dm-reply` runs against an inbound message, return:

```
{
  "detectedBlame": "circumstances|other-people|self|genuine-question",
  "subType": "time|money|spouse|self-doubt|...",  // null if genuine
  "validation": "Totally get it...",              // mandatory opener
  "closeUsed": "It's About Priorities",           // pick from library
  "reply": "<full bilingual-aware reply, 2-4 sentences max>",
  "reAsk": "Want to lock in Thursday at 3pm?",    // mandatory close ask
  "starGapsToFix": ["Authority"]                  // empty if all 4 letters cleared
}
```

When generating sales-page or pitch-deck objection-handling sections, output the top 3 likely objections per offer category + matching close per blame bucket.

## Common Failure Modes

- **Skipping validation** — instant defensive shut-down.
- **Using a Money close on a Self-doubt blame** — wrong tool, escalates rather than closes.
- **Closing without re-asking** — leaves the door open. ALWAYS end with the calendar/payment ask.
- **Treating a genuine question as an objection** — patronizing; loses the deal.
- **Stacking 4 closes in a row** — feels like a hard sell. Close once, then ask. If they say no again, move on or schedule a follow-up.
