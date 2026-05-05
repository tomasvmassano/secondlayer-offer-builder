---
name: core-four
description: 'The 4 advertising channels every business uses to get engaged leads — Warm Outreach, Free Content, Cold Outreach, Paid Ads — plus the More-Better-New scaling triad and the Rule of 100 daily volume mandate. Use when planning a creator''s growth strategy, sequencing channel launches, generating cold/warm DM scripts, designing the social content cadence, or computing CAC/payback on paid. Pair with hooks for opening lines, ad-assembly for paid creative, and lead-nurture for what happens after the engaged lead. Source: Alex Hormozi, $100M Leads.'
license: MIT
metadata:
  author: secondlayer
  version: "1.0.0"
---

# Core Four — Channel Strategy

There are exactly **four channels** any business uses to get engaged leads (people who have shown interest, not just impressions):

1. **Warm Outreach** — you reach people you already know.
2. **Free Content** — strangers reach YOU because of what you posted.
3. **Cold Outreach** — you reach strangers.
4. **Paid Ads** — money reaches strangers for you.

Every business is some mix of these four. There is no fifth channel. Anything that looks like a fifth (PR, partnerships, SEO, affiliates) is one of the four wrapped in a label, OR it's a "Lead Getter" — someone else doing one of the four for you (employees, agencies, affiliates, customers via referral).

**Rule of sequencing:** start with Warm → Free Content → Cold → Paid (in that order of capital required). Skip a step at your peril.

## Channel 1 — Warm Outreach (the 10 Steps)

Use when the creator has any prior relationship — past customers, current followers, list, friends-of-friends.

1. **Get the list** — every contact, name, number, email, DM thread.
2. **Pick the platform** — wherever YOU last spoke with them.
3. **Personalize** — reference the specific last interaction.
4. **Reach out** — open with the relationship, not the pitch.
5. **Warm them up** — small talk that's actually relevant.
6. **Invite friends** — "who else do you know that might want this?"
7. **Easiest offer in the world** — free, low-risk, low-time.
8. **Start at the top** — biggest names / most engaged first.
9. **Start charging** — once 5–10 freebies validate, switch to paid.
10. **Keep the list warm** — recurring touch every 30–60 days.

> Use this whenever the creator has an existing audience > 1k. It's the highest-conversion channel they have.

## Channel 2 — Free Content (Hook → Retain → Reward)

The structure of every viral post / video / podcast:

- **Hook** — a topic + headline that earns 3 seconds of attention. (See `hooks` skill for the 7 verbal types.)
- **Retain** — lists, steps, stories, novelty, contrast — anything that keeps them past the first 10 seconds.
- **Reward** — a payoff. Specific, non-obvious, immediately useful. Without the reward, they don't come back.

**Free Goodwill:** the cousin doctrine. Give value in advance, with no ask. Compounds the audience's willingness to buy when you finally do ask. Plan one Free Goodwill drop per quarter minimum.

## Channel 3 — Cold Outreach

The DM/email/call to a stranger. Five non-negotiables:

1. **List quality** beats volume — bad list × any volume = waste.
2. **Personalization** is the cost of entry — generic = ignored.
3. **Offer fit** — the thing you're offering must match THIS person's stage.
4. **Speed of follow-up** — slow follow-up kills the channel.
5. **Volume per Rule of 100** — see scaling section below.

**Format that works:**
- Sentence 1 — call out (proves it's for them)
- Sentence 2 — observation (proves you researched)
- Sentence 3 — value promise (what's in it for them)
- Sentence 4 — micro-CTA (yes/no question)

That's it. ≥5 sentences = trash.

## Channel 4 — Paid Ads (Make-the-Ad / Run-the-Money)

### Part I — Make the Ad
Every ad has 4 parts in order:
- **Callout** — who's it for ("Hey, paid-community creators in Portugal…")
- **Value** — the dream outcome ("…here's how Rui added €25K MRR in 90 days…")
- **Proof** — receipts ("…with screenshots…")
- **CTA** — exact next step ("…tap to read.")

### Part II — Money Stuff
Three numbers govern paid:
- **CAC** (Customer Acquisition Cost): per-customer ad spend.
- **LTV / LTGP** (Lifetime Gross Profit per customer).
- **PPD** (Payback Period in Days): CAC / 30-day GP per customer.

Scale rule: **never scale spend until 30-day PPD < 30 days** (i.e. Customer-Financed Acquisition). See `money-model` skill for full CFA framework.

## Lead Getters — The 4 Get Multiplied

Other people running the Core Four for you:
- **Customers (Referrals)** — over-deliver → ask → make it easy.
- **Employees** — recruit your own Core Four (the same playbook applied to hiring).
- **Affiliates / Partners** — commission-based; needs edification + tracking.
- **Agencies** — outsource a channel; watch for the 9-step decay (slow drift toward worse work).

> For the creator's launch, plan Lead Getters in Phase 3 (Operate), not Phase 2 (Launch). Validate the channel YOURSELF first.

## Scaling: More / Better / New

For every channel, three lever options:

- **More** — same thing, higher volume. (Easiest.)
- **Better** — same thing, higher conversion. (Hardest.)
- **New** — different version of same channel. (Required for plateaus.)

Always run them in that order. Exhaust More before Better. Exhaust Better before New.

## The Rule of 100

The non-negotiable daily activity floor per active channel:
- Warm: 100 reach-outs/day (DMs/calls/messages)
- Free Content: 100 minutes of content production/day
- Cold: 100 outreach attempts/day
- Paid Ads: 100 minutes managing/iterating/day

For 100 days. Anything less and you can't tell if the channel works — you're under the noise floor.

## Open To Goal

Daily standard: work each channel until you hit a measurable lead goal (e.g. "10 booked calls"), not until the clock hits 5pm. Don't quit early. Don't overshoot — close the laptop at goal.

## Output Contract for the LLM

When generating a Core Four plan for a creator:

```
{
  "currentReadiness": {
    "warm": { "score": 0-10, "ready": bool, "blockers": [...] },
    "freeContent": { "score": 0-10, ... },
    "cold": { ... },
    "paid": { ... }
  },
  "phaseSequence": ["warm", "freeContent", "cold", "paid"],   // tailored to creator
  "ruleOf100Targets": {
    "warm": 100,    // daily reach-outs
    "content": 100, // daily minutes
    "cold": 100,
    "paid": 100
  },
  "openToGoal": { "metric": "booked calls", "dailyTarget": 10 },
  "leadGettersTimeline": "Phase 3: month X",
  "nextChannelToActivate": "..."
}
```
