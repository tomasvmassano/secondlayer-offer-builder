---
version: alpha
name: Second Layer Hub
description: >-
  The internal operations hub — secondlayerhq.com's editorial brand system
  adapted for a dense, all-day CRM. Dark by default, light on demand, strict
  monochrome with a single burgundy accent, and deliberately larger type than
  the marketing site. Where the public site optimises for air and impact, the
  Hub optimises for legibility and scanning.
colors:
  bg: "#0A0A0A"
  surface: "#141414"
  surface-raised: "#1B1D1E"
  border: "rgba(255,255,255,0.10)"
  border-strong: "rgba(255,255,255,0.18)"
  text: "#FFFFFF"
  text-muted: "rgba(255,255,255,0.64)"
  text-faint: "rgba(255,255,255,0.40)"
  primary: "#6F1A1C"
  primary-hover: "#8A2427"
  primary-contrast: "#FFFFFF"
  success: "#4FA97B"
  warning: "#C9922E"
  danger: "#C2453C"
  info: "#5B84C4"
typography:
  display:
    fontFamily: Inter Tight
    fontSize: 34px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.02em
  h1:
    fontFamily: Inter Tight
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.015em
  h2:
    fontFamily: Inter Tight
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter Tight
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: Inter Tight
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
  body-lg:
    fontFamily: Inter Tight
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: Inter Tight
    fontSize: 12px
    fontWeight: 600
    letterSpacing: 0.08em
  serif:
    fontFamily: Instrument Serif
    fontSize: 26px
    fontWeight: 400
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 400
rounded:
  input: 8px
  nested: 12px
  card: 16px
  pill: 999px
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-contrast}"
    rounded: "{rounded.pill}"
    padding: "{spacing.md}"
  button-secondary:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "{spacing.md}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "{spacing.xl}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.input}"
    padding: "{spacing.md}"
  tab-active:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
---

## Overview

The Hub is where a three-person team lives all day. The public site sells; the
Hub is used. So it inherits Second Layer's visual language — near-black canvas,
one italic-serif-and-sans duet, a single burgundy accent, borders instead of
shadows — but inverts the marketing site's priorities. Out goes the 140–190px
airy vertical rhythm; in comes tight, scannable density. Type gets **bigger**,
not smaller. Colour gets **quieter**, not louder.

This file is the single source of truth. Every colour and size in the Hub
should resolve to a token here (implemented as CSS variables), never a one-off
hex buried in an inline style.

## Theming — dark by default, light on demand

Brand principle 01 is "dark by default, light for emphasis." The Hub honours it
and answers the team's request for lighter tones by making light a **real,
switchable theme** rather than the default. The tokens above are the **dark**
theme. The **light** theme overrides only the neutrals; the accent and the type
scale are identical in both.

| Token             | Dark (default)        | Light                    |
|:------------------|:----------------------|:-------------------------|
| `bg`              | `#0A0A0A`             | `#FAFAFA`                |
| `surface`         | `#141414`             | `#FFFFFF`                |
| `surface-raised`  | `#1B1D1E`             | `#F1F0ED`                |
| `border`          | `rgba(255,255,255,.10)` | `rgba(27,29,30,.10)`   |
| `border-strong`   | `rgba(255,255,255,.18)` | `rgba(27,29,30,.18)`   |
| `text`            | `#FFFFFF`             | `#0A0A0A`                |
| `text-muted`      | `rgba(255,255,255,.64)` | `rgba(10,10,10,.62)`   |
| `text-faint`      | `rgba(255,255,255,.40)` | `rgba(10,10,10,.40)`   |

The theme is stored per-operator (localStorage) and applied as `data-theme` on
`<html>` before first paint, so there is no flash. Burgundy earns its keep in
both themes: it reads cleanly as a fill under white text (white-on-burgundy is
~11:1) even though burgundy *text* on near-black would not — so the accent is
always a **surface or an italic serif word**, never small burgundy body text on
the dark canvas.

## Colours

Strict monochrome plus one accent. The neutrals do the structural work;
burgundy is the only chromatic voice.

- **`bg` / `surface` / `surface-raised`:** the three-step elevation ladder.
  Panels are `surface` on the `bg` canvas; the raised step is for active tabs,
  popovers, and the selected row.
- **`primary` (#6F1A1C):** the brand burgundy, and in the Hub the **primary-action
  colour**. This is a deliberate extension of the marketing rule (which reserves
  burgundy for light-block CTAs): a tool needs its main action found in one
  glance, so the single primary button per view is a solid burgundy pill. Used
  nowhere else as a fill.
- **`success` / `warning` / `danger` / `info`:** a restrained, desaturated status
  set. A CRM genuinely needs state colour (a lead is hot, a call is overdue), but
  the current neon palette (`#22c55e`, `#3b82f6`, `#a855f7`, `#eab308`) is what
  "as cores tornam difícil à vista" is pointing at. These four replace all of it.
  They appear as small dots, thin left-borders, and label text — never as large
  fills competing with the canvas.

## Typography

Two families, the brand duet: **Inter Tight** for everything structural, and
**Instrument Serif** *italic* for a single emphasis word in a heading or a hero
figure. Body copy is always sans.

The scale is tuned for a tool, and it is the direct answer to "textos muito
pequenos": the body floor is **15px** and the smallest label is **12px** — the
Hub today routinely renders 9–11px, which is the complaint. `label` is the
uppercase eyebrow (letter-spaced). `mono` (JetBrains Mono, 13px) is for data:
counts, prices, IDs, timestamps — anything the eye reads as a value.

Weights follow the brand: 400 body, 600 headings and labels. Reserve the italic
serif for one word per heading; never set body copy in the serif.

## Layout and density

The public site's `container-lg` is 1272px of centred marketing. The Hub instead
runs full-width with a persistent left nav and a **dominant centre column** — the
team's note that "o core visual está no terço do meio e pode ocupar mais tela."
The working content (a creator record, the pipeline board, the offer wizard) is
the widest, highest-contrast element on screen; navigation and meta shrink to the
edges. Section rhythm compresses from the brand's 140–190px to a 16/24/32px tool
scale — density is a feature here, legibility permitting.

## Components

A small vocabulary, borders not shadows, pills for action and 16px cards for
content — straight from the brand.

- **`button-primary`:** solid burgundy pill, white text, lightens to
  `primary-hover` on hover. Exactly one per view.
- **`button-secondary`:** transparent pill with a `border-strong` outline and
  `text` label. Every other action.
- **`card`:** `surface` fill, 1px `border`, 16px radius, no shadow. The unit of
  content.
- **`input`:** `surface` fill, 1px `border`, 8px radius (a touch softer than the
  marketing site's 3px, for click affordance in a form-heavy tool). 15px text so
  iOS never zoom-jumps on focus.
- **`tab-active`:** the selected segment lifts to `surface-raised` in a pill.
  Inactive tabs are `text-muted` with no fill.

## Principles (Hub)

1. **One token, everywhere.** No raw hex in a component. If a value is missing,
   add it here and re-lint — don't hardcode.
2. **Legibility over density, density over air.** Bigger type than the site,
   tighter spacing than the site. When they conflict, type size wins.
3. **Quiet colour.** Monochrome canvas, one burgundy action, four muted status
   hues. Never the old neon set.
4. **Borders define surfaces.** 1px at 10% opacity. No drop shadows, ever.
5. **Pills act, cards hold.** Anything clickable is a pill; anything holding
   content is a 16px card.
6. **Both themes are first-class.** Every surface must be legible in dark *and*
   light. Nothing is styled for only one.

## Provenance

Derived from the Second Layer Brand & Web Design Guidelines (2025/2026). Adapts
the marketing identity for internal tooling; deviations (burgundy as primary
action, compressed rhythm, a status palette, larger type floor) are intentional
and documented above.
