# Phase 1 — Signed → Kickoff Ready (Design)

## Problem
A creator signs the partnership and... nothing happens systematically. No information gathering, no agenda for the kickoff call, no formal sign-off on positioning/pricing/launch date. The team improvises every time. Doesn't scale past 2-3 creators.

## Goal
Between contract signature and "we have everything we need to start building Phase 2", **7 days max**, zero ambiguity.

**Output:** a signed Kickoff Brief — one PDF document with every decision locked, ready to feed Phase 2.

## The 7-day journey

```
Day 0   — Contract signed (pipelineStatus → "signed")
Day 0-1 — Welcome email sent automatically with onboarding form link
Day 2-4 — Creator fills hybrid form (10 required + 20 optional)
Day 4-5 — Team reviews form + intelligence + drafts kickoff agenda
Day 6-7 — 90-min kickoff call (Tomas + Raul), decisions locked
Day 7   — Kickoff Brief PDF generated, both parties sign off
```

## Hybrid onboarding form (30 questions, 10 required)

### Section A — Brand Identity (5 questions, 1 required)
1. Logo (file upload) — REQUIRED
2. Brand colors (primary hex)
3. Voice in 3 words
4. Anti-tone (what you DON'T want)
5. Inspirations: 3 brands/creators

### Section B — Audience (7 questions, 2 required)
6. Top 5 questions in your DMs — REQUIRED (top 3 minimum)
7. Top 3 audience pain points — REQUIRED
8. Real customer quotes you remember
9. Demographics (age, gender, location, income)
10. Anti-persona (who your audience IS NOT)
11. Why they follow you (your guess)
12. What they've explicitly asked you to create

### Section C — Existing Business (6 questions, 2 required)
13. Current revenue streams + monthly € — REQUIRED
14. Email list size + provider — REQUIRED
15. Past products launched (what worked, what flopped)
16. Existing platforms (Skool, Hotmart, Substack, etc.)
17. Existing team
18. Brand deals — current + declined recently

### Section D — Goals + Life (6 questions, 3 required)
19. Revenue target year 1 (€/month MRR) — REQUIRED
20. Member count target year 1
21. Launch date preference — REQUIRED
22. Hours/week you can commit — REQUIRED
23. Known vacations / unavailable dates
24. What "winning" looks like in 6 months

### Section E — Constraints + Risks (3 questions, 1 required)
25. Hard NOs — REQUIRED
26. Past launch failures
27. Personal/family constraints

### Section F — Anchoring + Comms (3 questions, 1 required)
28. Preferred language for community + content — REQUIRED
29. Preferred communication with team
30. One thing about your business no one else knows

**Total required: 10 questions (gates the kickoff call).**
**Total optional: 20 questions (encouraged for deeper kickoff).**

## Data model additions to creator

```js
creator.onboarding = {
  token: string,                    // nanoid for the public form URL
  status: 'not_started' | 'form_pending' | 'form_complete' | 'call_scheduled' | 'brief_signed',
  formStartedAt: ISO date,
  formCompletedAt: ISO date,
  responses: { /* all 30 question fields */ },
  kickoff: {
    callScheduledAt: ISO date,
    callCompletedAt: ISO date,
    decisions: {
      positioning: '',              // The exact positioning sentence
      communityName: '',
      pricing: 0,                   // €/month
      launchDate: '',               // Specific calendar date
      foundingOffer: { price, perks, cap },
      techStack: { community, payments, email, ads },
      rolesSplit: { creator, secondLayer },
      commsCadence: '',
    },
    actionItems: [{ task, owner, deadline, done }],
    briefSignedAt: ISO date,
    briefPdfPath: '',               // Reference to generated PDF
  },
}
```

## Components to build

### 1. Onboarding form (public, creator-facing)
- Route: `/onboarding/[token]`
- No auth required (token is the auth)
- 6 sections, progressive disclosure
- Required fields gate "complete" status
- Optional fields show progress indicator: "12/30 answered"
- Auto-saves drafts (debounced PATCH)
- On submit: status → form_complete, notify team

### 2. Onboarding API
- `GET /api/onboarding/[token]` — load creator + responses (public, token-gated)
- `POST /api/onboarding/[token]` — save responses (debounced)
- `POST /api/onboarding/[token]/complete` — mark form complete

### 3. Kickoff tab (team-facing, creator profile)
- New tab on `/creators/[id]` after Pitch tab: "Kickoff"
- Only visible when pipelineStatus === 'signed'
- Shows:
  - Status indicator (Signed / Form pending / Form complete / Call scheduled / Brief signed)
  - Onboarding link (copy to share with creator)
  - Form responses (read-only, organized by section)
  - Hub intelligence (audience, niche, top posts) cross-referenced
  - Kickoff agenda template (editable)
  - Decision tracker (positioning, pricing, dates, etc.)
  - Action items list
  - "Generate Brief" button → PDF

### 4. Kickoff Brief PDF
- Header: creator name, kickoff date, "Confidencial"
- Decisions section (positioning, pricing, dates, tech, founding offer)
- Form responses (compact summary)
- Intelligence summary
- Action items + owners + deadlines
- Sign-off block (Second Layer signature + Creator signature lines)
- Generated on demand, downloadable

### 5. Welcome email automation
- Trigger: when pipelineStatus changes to 'signed'
- Uses existing Resend integration (autopilot already wired)
- Sends to creator with:
  - Welcome message
  - Onboarding form URL with token
  - Calendar invite for kickoff call (placeholder, manual scheduling for v1)
  - Tomas + Raul email addresses
- Sends internal notification to tomas@ + raul@

### 6. Pipeline status badges
- On `/pipeline` page, each signed creator shows a small badge:
  - 📝 "Form pending" (yellow)
  - ✅ "Form complete" (green)
  - 📞 "Call scheduled" (blue)
  - ✅ "Brief signed" (purple)

## Files

**New:**
- `/app/onboarding/[token]/page.jsx` — public form
- `/app/api/onboarding/[token]/route.js` — onboarding API
- `/app/api/onboarding/[token]/complete/route.js` — mark complete
- `/app/api/kickoff/[creatorId]/brief/route.js` — PDF generator

**Modified:**
- `/app/lib/creators.js` — add onboarding field + auto-generate token + deep merge
- `/app/api/creators/[id]/route.js` — trigger welcome email on signed status change
- `/app/creators/[id]/page.jsx` — add Kickoff tab
- `/app/pipeline/page.jsx` — add Phase 1 status badges

## Build order (sequential)

1. Data model (creator.onboarding field) — 0.5h
2. Onboarding form page + API — 1.5 days
3. Kickoff tab + decision tracker — 1 day
4. PDF brief generator — 0.5 day
5. Welcome email automation — 2h
6. Pipeline status badges — 1h
7. Build + deploy + verify — 0.5h

**Total: ~3-4 days of focused build.**

## Out of scope (Phase 2 / later)

- Auto-scheduling kickoff calls (manual for v1; Calendly integration later)
- Creator-facing workspace (separate brainstorm)
- Brand identity auto-generator (separate brainstorm)
- Asset approval workflow (separate Phase 2 work)
- E-signature integration (PDF + email confirmation enough for v1)

## Verification

- Mark a creator as signed → welcome email arrives + onboarding link generated
- Open onboarding URL → form loads with creator name pre-filled
- Fill 10 required questions → status flips to "form_complete"
- Open Kickoff tab on creator → see form responses + intelligence
- Fill in decisions → click Generate Brief → PDF downloads
- Pipeline page shows status badge per signed creator
