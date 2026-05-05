---
name: marketing-machine
description: 'Build a self-feeding "machine" that turns normal customer interactions (calls, posts, reviews, awards, events) into a weekly inbox of customer-generated ad creative. The 9-Node Checklist + 6-Point Testimonial Script + Award/Bonus Unlock + Testimonial Competition. Use in /api/launch-generate (Social Content cadence + Onboarding Flow proof-capture + Churn Prevention milestones) and Kickoff brief. Source: Alex Hormozi, $100M Marketing Machine.'
license: MIT
metadata:
  author: secondlayer
  version: "1.0.0"
---

# Marketing Machine

The wrong way: "Let's make 10 ads this month."
The right way: "Let's build a machine that produces 10 ads/week from customers, forever."

Goal: replace the founder-as-content-machine with a system where customer wins fuel the next quarter's ads automatically.

## The 9 Nodes (each a content source)

Every node feeds the same inbox: a folder/spreadsheet of raw clips, screenshots, quotes the team turns into ads/posts.

1. **Lifecycle Touchpoints** — record sales calls, support calls, milestone calls. Clip the wins.
2. **Social Scrape** — search your handle/keyword on every platform daily; download wins.
3. **Events** — every workshop, retreat, in-person session = filmed; harvest 50+ clips per event.
4. **Comms / Communities / Reviews Scrape** — Skool/Discord/Slack: weekly screenshot pass for member wins.
5. **Bonus Unlocks** — paywall a bonus behind a 6-point testimonial video. They get the bonus; you get the ad.
6. **Award Unlocks** — quarterly awards for member milestones; the "ceremony" is filmed 4 ways (post, video, unbox, on-stage).
7. **Competitions** — "best win of Q3" contest; member-submitted UGC. Winner gets cash or status; you get 50 ads.
8. **Delivery Moments** — every "your thing arrived" / "your access opened" = a recordable moment.
9. **Lifecycle Compilation** — quarterly: stitch a "before / 30 days in / 90 days in / 1 year in" reel per cohort.

## Implementation Order (fastest ROI first)

Don't try all 9 at once. Roll out in this order; each takes 1-2 weeks:

1. **Competition** (week 1-2) — easiest to set up, highest output of UGC.
2. **Chat scrape** (week 3) — already happening; just needs a daily 15-min ritual.
3. **Community scrape** (week 4) — same.
4. **Reviews** (week 5) — DM every reviewer for permission to clip.
5. **Social** (week 6) — automate with Brand24 or similar.
6. **Bonus Unlock** (week 7-8) — design the bonus + 6-point capture flow.
7. **Award Unlock** (week 9-10) — needs a quarterly cadence built.
8. **Events** (when next event happens) — harvest plan in advance.
9. **Lifecycle compilation** (quarter 2+) — only possible after lifecycle data exists.

## The 6-Point Testimonial Script

Send this to every customer at the bonus/award unlock OR after a clear win. Tell them to record a 2-3 min video answering, in order:

1. **Internal struggle BEFORE** — "Before [the offer], internally I was…" (frustration, doubt, fear).
2. **External struggle BEFORE** — "Externally, I was dealing with…" (low revenue, no leads, etc.).
3. **Skepticism** — "When I first heard about [offer], I thought…" (objections they had — these become the closes the next prospect needs).
4. **What overcame it** — "What got me to say yes was…" (the specific thing — close, guarantee, feature, person).
5. **External victory NOW** — "Today, externally I have…" (specific numbers, screenshots).
6. **Internal victory NOW** — "Internally I feel…" (confidence, relief, peace).

These 6 in order = the perfect ad. Most testimonials skip 1, 3, and 6, which is exactly where the persuasion lives.

## Bonus Unlock mechanic

- Design a high-perceived-value bonus (template, group call, software credit, swag).
- Paywall it behind a 6-point video submission.
- "You unlock [bonus] when you submit a 2-min testimonial video. Here are the 6 questions."
- Process: submit → bonus delivered → video reviewed → published with their permission.

## Award Unlock mechanic — "4 forms of proof"

Every quarterly/yearly award produces 4 pieces of content:

1. **In-group post** — "Congrats to [member] for hitting [milestone]!"
2. **Emailed video** — personal video from founder to winner ("you did this").
3. **Unboxing video** — winner unboxes the trophy/swag → THEIR own content for THEIR audience.
4. **On-stage delivery** — at next live event, announce in front of room.

Compounds: 1 award = 4 content pieces × N members = unlimited social proof flywheel.

## Testimonial Competition

Run twice a year between award cycles:

- **Mechanic:** "Best result story between [date] and [date] wins [prize]."
- **Submission format:** the 6-point script.
- **Prize:** ~10% of avg LTV, or status + on-stage moment, or both.
- **Output:** typically 30-100 submissions per cycle. Of those, 5-15 are usable as ads.
- **Cost:** prize + 1 hour of judging.
- **ROI:** weeks of ad creative for ~€1k.

## Cadence (what to publish weekly)

Once 3+ nodes are running, the social calendar self-fills. Default cadence:

| Day | Content |
|---|---|
| Mon | Screenshot wins compilation (community + chat scrape) |
| Tue | Education clip (founder-led, 30-60s) |
| Wed | Lifecycle clip (call recording, milestone moment) |
| Thu | Education or behind-the-scenes |
| Fri | Community wins compilation (UGC, reviews) |
| Weekend | Quarterly: award/competition recap |

This replaces the generic "30-day social calendar" output with a Marketing Machine cadence. Same output volume; 10× the proof density.

## Output Contract for the LLM

When generating Marketing Machine setup for a creator, return:

```
{
  "nineNodeChecklist": [
    { "node": "lifecycle", "active": false, "owner": "...", "startDate": "...", "blockers": [...] },
    ...
  ],
  "implementationOrder": ["competition", "chat-scrape", ...],
  "sixPointScriptTemplate": { /* 6 questions personalized to the offer */ },
  "bonusUnlockSpec": { "bonusName": "...", "perceivedValue": 0, "captureFlow": "..." },
  "awardUnlockSpec": { "name": "...", "frequency": "quarterly", "prize": "...", "fourFormsOfProof": [...] },
  "competitionSpec": { "name": "...", "frequency": "biannual", "prize": "...", "judgingCriteria": [...] },
  "weeklyCadence": [
    { "day": "Mon", "contentType": "screenshot-wins", "source": "community+chat" },
    ...
  ],
  "month1Plan": "Which 2 nodes to launch in month 1 + first capture target."
}
```
