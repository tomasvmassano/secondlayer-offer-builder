---
name: lead-nurture
description: 'Maximize the 30-day SHOW RATE — the % of engaged leads that actually show up to a sales conversation — via 4 pillars: Availability, Speed, Personalization, Volume. Use when generating onboarding flows, follow-up cadences, reminder sequences, DM reply scripts, or sales-call routing logic. Critical inside /api/dm-reply and /api/launch-generate (Onboarding Flow). Source: Alex Hormozi, $100M Lead Nurture Playbook.'
license: MIT
metadata:
  author: secondlayer
  version: "1.0.0"
---

# Lead Nurture — Show Rate Engineering

The metric that matters: **Show Rate** = % of booked appointments that actually attend.
Industry benchmark: 30-50%.
Hormozi-grade: 70-85%.

The 30-percentage-point gap between average and great is engineered, not random. Four pillars get you there.

## The 4 Pillars

### 1. Availability

You miss 100% of the leads you can't reach. Be reachable on the channels they're already on.

- **Calendar slots** — minimum 3 slots/day across morning + afternoon + evening.
- **Multi-channel presence** — let them book via DM, email, link, voice memo. Their preference, not yours.
- **Time zones** — display in THEIR zone, not yours.
- **Holding hours** — explicit "you'll hear back within X hours" SLA on your bio/email signature.

### 2. Speed (the triad)

- **Speed-to-First-Contact:** ≤ 5 minutes from lead capture. Past 5 min, conversion drops 80%.
- **Speed-to-First-Appointment:** ≤ 72 hours from first contact to scheduled call. Anything further out = no-show.
- **Speed-of-Response:** between booking and call, every reply within 1 hour during business hours.

The 5-minute SLA is non-negotiable. Build automation to enforce it.

### 3. Personalization (6 tactics)

Volume × personalization = the magic combination. Six concrete tactics:

1. **Multi-channel start, continue where they replied.** Open in IG DM, if they reply via email, switch to email.
2. **Qualify out early.** "Are you actually building a paid community in the next 90 days?" If no, kindly disqualify. Saves both sides.
3. **Best leads → Best closers.** Score leads R/Y/G (red/yellow/green) by fit. Greens go to Tomas. Yellows to Raul. Reds get nurture only.
4. **Segment messaging.** Don't send the same intro to a 100k-follower fitness creator and a 8k-follower B2B creator.
5. **Push/Pull incentives.** Push (small gift card for showing up) and Pull (case study unlocked after the call). A/B which works for your audience.
6. **Personalized proof.** Send a testimonial from someone in their exact niche/size — not a generic case study.

### 4. Volume (the cadence)

The non-negotiable contact cadence after a lead expresses interest:

| Time after capture | Action |
|---|---|
| < 5 min | Call (if number) + text ("Just saw your application — call you in 2 min") |
| Day 0 | Double-dial + voicemail + text |
| Day 0 | 2 more dials/texts spaced 4h apart |
| Day 1 | 2 attempts (mixed channels) |
| Day 2 | 2 attempts (mixed channels) |
| Days 3-6 | 1 attempt/day |
| Days 7+ | Move to long-term nurture (1/week, then 1/month) |

Most people quit at attempt 3. The win is at attempt 6-8.

### Reminder cadence (after a call is BOOKED)

- **Immediate** confirmation (text + email with .ics) — "you're locked in for X."
- **24h before** — "tomorrow at X. What's the #1 thing you want to walk away with?"
- **12h before** — "see you in 12h. Drop any context here."
- **3h before** — "in 3h. Add me on WhatsApp/iMessage so we can connect easily?"

## The 5-Outcome Scheduling Script

When following up with a lead, every interaction has 1 of 5 outcomes. Decision tree:

1. **No response** → continue cadence per Volume table.
2. **Unqualified** → kindly disqualify with a relevant referral if possible. End cycle.
3. **Live now** → "is now actually a terrible time? If not, let's just do it now."
4. **Pull-forward** → "totally fair. Next slot's tomorrow. Or want to just do 15 min in the next hour?"
5. **Confirm** → "perfect. See you Thursday at 3pm. Save my number for the call."

The "is now a terrible time?" pull-forward script is the #1 highest-leverage line in this whole playbook. Use it constantly.

## BAMFAM — Book A Meeting From A Meeting

Always book the next call inside the current call. Never end without a calendar slot.

- End of discovery call → book proposal call before hanging up.
- End of proposal call → book signing call before hanging up.
- End of onboarding call → book week-2 huddle before hanging up.
- End of week-2 huddle → book month-1 review before hanging up.

This single discipline raises show rate ≥ 30 points.

## The Hot Handoff (when routing leads to a closer)

When passing a lead from intake to closer:

1. **Edify** the closer ("Tomas is the founder, he ran 60+ creator launches; he'll give you 30 min").
2. **Brief the lead on the closer** before the call (1 paragraph: name, role, why they're the right person).
3. **Brief the closer on the lead** (background, fit score, hot points).
4. **3-way text intro 1h before** ("Tomas, meet [creator]. [Creator], meet Tomas. See you both at 3pm.").

Skip the handoff and show rate drops 20+ points.

## Tactical Tips

- **Blue iMessage > green SMS** for US/EU iPhone-heavy audiences. Use a real iPhone or RCS.
- **Local area code** for the outbound number ("local presence" wrapping). 30%+ pickup boost.
- **Voice notes > text** when the lead is high-fit. Personality cuts through.

## Output Contract for the LLM

When generating a Lead Nurture flow for a creator, return:

```
{
  "fourPillars": {
    "availability": { "slotsPerDay": 0, "channels": [...], "responseSLA": "..." },
    "speed":        { "firstContactSLA": "5min", "firstAppointmentSLA": "72h", "responseSLA": "1h" },
    "personalization": { "scoring": "R/Y/G", "routing": "...", "tactics": [...] },
    "volume":       { "cadence": [ { "when": "<5min", "action": "..." }, ... ] }
  },
  "reminderCadence": [
    { "when": "immediate", "channel": "text+email", "copy": "..." },
    { "when": "24h", ... },
    { "when": "12h", ... },
    { "when": "3h", ... }
  ],
  "fiveOutcomeScripts": {
    "noResponse": "...",
    "unqualified": "...",
    "liveNow": "...",
    "pullForward": "...",
    "confirm": "..."
  },
  "bamfamRules": [...],
  "hotHandoff": { "edification": "...", "briefToLead": "...", "briefToCloser": "..." }
}
```
