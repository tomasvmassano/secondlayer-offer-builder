# Pitch Deck Redesign — Design Doc

## Problem
Creators leave the meeting unclear about what Second Layer actually builds and sells. The current deck buries the product behind problem/audience slides, uses generic "deliverable list" language, shows terminal MRR numbers without growth context, and hard-closes with a 3-step action list that creates decision friction.

## Positioning shift
Second Layer is a **full-service creator business partner**. The creator stays the face (content, lives, events). The Second Layer team (5+ people) builds AND operates the entire monetization backend: community, funnels, ads, emails, analytics, churn, onboarding.

Explicitly NOT an agency — communicated through tone, revenue-share model, and long-term partnership framing. Never stated literally ("não somos uma agência") — understood through positioning.

## New 10-slide structure

### Slide 1 — Cover
Creator name + "Proposta de Parceria" + date. Minimal.

### Slide 2 — Transformation (qualitative)
Title: "Onde estás. Onde podes estar."
Before/After columns, no specific number promises. Qualitative transformation:
- Algorithm dependency → your own business
- Unpredictable sponsor income → recurring monthly revenue
- Audience you don't control → community you own
- Doing everything alone → you stay the face, team operates

### Slide 3 — What You Get (concrete)
Hero: "Vais ter um negócio a sério por trás do teu conteúdo."
Three concrete pillars:
1. Comunidade paga
2. Sistema que traz e mantém membros
3. Equipa dedicada a operar

### Slide 4 — A Tua Audiência
Auto-populated from scraped creator data. Followers, engagement, niche, audience estimate.
Bottom: "Esta é a base. Já a tens."

### Slide 5 — O Que Construímos + O Que Operamos
Two labeled sections in plain Portuguese (no "churn", "analytics", "member ops", "win-back" — replaced with accessible equivalents).

### Slide 6 — Como Lançamos
Three-phase flow without specific timeframes:
1. Validamos antes de gastar
2. Ligamos a máquina de crescimento
3. Otimizamos continuamente

### Slide 7 — Como os Números Crescem ao Longo do Tempo
Growth-curve chart (line chart, not table) over 12 months. Three scenarios overlaid.
Launch month shows 3x steady-state new members (waitlist spike), then normal growth minus churn.
All inputs editable live: audience, price per member, launch conversion %, steady-state %, monthly churn.
Key message: "Mês 1 não é Mês 12."

### Slide 8 — Como Funciona a Parceria
Split: TU (face, content, lives) / NÓS (build + operate).
Terms: setup + revenue share + 12+ month commitment.
Closing: "Só ganhamos quando tu ganhas."

### Slide 9 — Recap: De → Para
Final restatement of transformation with punch. Bottom: "Vais continuar a ser criador. Mas com um negócio a sério por trás."

### Slide 10 — Construímos isto juntos?
Soft close with ONE specific ask: schedule the 30-min follow-up call.
No multi-step process list. No pressure-closing.
Closing line: "A minha aposta é em ti. Quero ouvir a tua."

## Revenue Projector fix

### Bugs
1. **158,981 → "158" display bug** — somewhere the display formatter is truncating. Audit `formatFollowers()` usage and any string-to-number conversions in `/app/pitch/page.jsx` `extractFollowers()`.
2. **Static terminal MRR** — current math shows year-12 MRR as if it's month 1. No growth curve.

### Fixes
1. **Manual overrides** on all projector inputs:
   - Followers (override if scraped value is wrong)
   - Engagement rate
   - Price per member (defaults to nicho pricing from `dealScore.js NICHE_DB`, editable)
   - Launch conversion % (default 3x steady-state)
   - Steady-state conversion % (default based on niche)
   - Monthly churn % (default 6-10%)

2. **Growth math model**:
   ```
   Month 1: new_members = audience × launch_conversion
   Month N (N>1): new_members = audience × steady_conversion
   Active members (N): (Active N-1 × (1 - churn)) + new_members (N)
   MRR (N): Active members (N) × price
   ```

3. **Chart visualization**:
   - Pitch page: inline SVG line chart (no library, 12 monthly data points per scenario)
   - PPTX export: `pptxgenjs.addChart({type: 'line'})` with same data

## Language & formatting rules
- European Portuguese throughout (no "engajada", no Brazilian terms)
- All accents preserved (á, à, é, ê, ç, ã, õ, í, ó, ô, ú)
- No em dashes in generated content (same rule as DM Writer)
- Plain Portuguese — avoid jargon ("churn", "analytics", "member ops") in creator-facing copy

## Files changed
1. `/app/pitch/page.jsx` — full rewrite with 10 new slides + SVG chart + adjustable projector inputs
2. `/app/api/export-pptx/route.js` — rewrite to render new slide structure + pptxgenjs line chart
3. `/app/creators/[id]/page.jsx` — Pitch tab copy may need minor update (portal text)
4. Revenue Projector logic in Offer tab — same adjustable inputs + growth math (shared with pitch slide 7)

## Out of scope (phase 2)
- Multi-language pitch (EN version) — next iteration
- Branded pitch (creator's brand colors) — later
- Analytics dashboard mockup on slide 3 — later, once design is settled
- Interactive scenario sliders inline on the PPTX — not possible, PPTX is static

## Verification
- Rui Tomás (159,000 followers): projector shows correct 159,000, not 158
- Manual override: type "160000" in follower input, math recalculates live
- Launch month in chart is visibly higher than subsequent months (spike visible)
- All Portuguese strings render with accents in browser and in downloaded PPTX
- Three scenarios overlay correctly on the chart
- PPTX export works and chart renders in PowerPoint
