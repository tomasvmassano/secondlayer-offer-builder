# Second Layer Hub — Handoff Document

> **What this is, what it does, and how it makes the team productive.**
> Last updated 2026-05-24. Replaces the May 12 code-audit version.

---

## 1. One-sentence summary

Second Layer Hub is the team's creator-acquisition operating system: it scrapes creators, runs LLM-powered ecosystem audits, generates personalised outreach (DMs + 3 follow-up emails in PT/EN/ES), builds full offers + pitch decks + launch plans, automates daily reminders + EOD reports, and tracks the 30-touches-per-day accountability game between operators.

Live at **https://hub.secondlayerhq.com**. Repo: `tomasvmassano/secondlayer-offer-builder` on GitHub. Vercel project: `secondlayer-hub`.

---

## 2. The operator's day (the 60-second tour)

**Morning (08:00 Lisbon).** An email lands in your inbox titled `[Second Layer] Os teus reminders · X críticos · Y soft nudges`. It lists only **your** creators (Tomás or Raul, routed by who added them). Each card has a `↗ Instagram` button, an `↗ Abrir no Hub` button, a copy-paste DM follow-up text in the right language, and the matching Day 7 / Day 14 email body when one was pre-generated.

**Daytime work — three loops in parallel.**

1. **Outreach loop.** Open `/creators`, filter by "Por contactar" tab. For each new creator: click `↗ Ver perfil` in the header → DM auto-copies to clipboard + IG profile opens → follow → message → paste → send. The click also auto-marks `dmSentAt`. If they have a `contactEmail`, click `✉ Email` for one-click Gmail compose with the Day 1 body pre-filled (subject + signature included).

2. **Replies loop.** When a creator replies, mark them via the DM tab. The system records which channel they replied through (DM vs email) so the dashboard can show per-channel conversion. The Reply handler classifies the response into Hormozi's 4 BLAME BUCKETS and suggests a brand-voiced response.

3. **Offer-building loop.** For warm creators, run the 4-checkpoint wizard inside the creator detail page:
   - **CP1** Strategic frame (role, tension, dominant transformation)
   - **CP2** Core offer (community name, central promise, weekly rhythm)
   - **Phase 3** Uniqueness extraction (the defensibility chain — *required before CP3*)
   - **CP3** Modules + weekly_formats + library (4-8 modules grounded in uniqueness elements)
   - **CP4** Value stack + pricing

   Then open `/pitch?creatorId=X` for an 11-slide editable deck. Export as PDF, PPTX, or generate the 8-page Launch Plan PDF (Lia-style sent between calls).

**Evening (04:00 Lisbon Tue-Sat).** The EOD email arrives. Subject reads `[Second Layer] EOD · Tomás · X/30 touches · OK | falta Y`. Body shows:
- Headline `X / 30 touches` in green or red
- €50 verdict box ("Cumpriste, recebes €50 de Raul" / "Falhaste por 8, deves €50 ao Tomás")
- 8-cell metric grid (touches, DMs, emails, follow-ups with DM/email split, replies with channel split, reply rate, creators added, signed)
- Team scoreboard
- "Abrir scoreboard" CTA to `/equipa`

Weekends: no EOD email, no €50 penalty (Tue-Sat cron, Mon-Fri reports).

---

## 3. What it does for the team (productivity multipliers)

| Manual time | With the Hub | Notes |
|---|---|---|
| ~10 min to research + write a cold DM | ~30s click `Gerar DM` | 8 system prompts (3 templates × 3 languages), audit-aware, voice-locked. Includes T+3 comment + Day 1 email. |
| ~5 min to look up IG handle + open profile + write follow-up | 1 click `↗ Ver perfil` | Copies the right pre-canned follow-up DM to clipboard + opens profile in new tab + auto-marks `dmSentAt`. |
| ~3 min to write + send personalised cold email | 1 click `✉ Email · Day 1` | Opens Gmail compose with `to:` + subject + body + signature pre-filled. |
| ~1 hr to research creator's product ecosystem manually | ~45s `Ecosystem Audit` | Deterministic scraping (Stan/Linktree IIFE eval) + 3 web searches + per-URL HTML preview with pricing-link follow + LLM cross-reference. |
| Bulk import 50 creators ≈ all afternoon | Walk-away worker | Paced 25s/audit to respect Anthropic 30K TPM. Tab open, come back when done. |
| ~hours to design a pitch deck | 60s generate + edit inline | 11 slides, every label editable, 3-language localised, exports PDF + PPTX. |
| ~hours of templating a launch roadmap | 1 click `Plano de Lançamento PDF` | 8-page Lia-style PDF with phase goals derived from audience size, 3 funnel phases × 3 columns, 60-day week-by-week table. |
| Manual €50 reconciliation | Automatic in EOD email | First-stamp-wins on `dmSentAt`, weekend-exempt, per-operator split. |
| "Who hasn't replied in 3 days?" mental tracking | Daily 08:00 digest | Auto-buckets day 3 / 7 / 14, auto-colds at 21, dedupes per milestone. |

**Concrete daily savings** for an operator doing 30 touches/day: ~3-4 hours of clerical work absorbed by the tool. That's not bandwidth for more touches — it's bandwidth for higher-quality calls + actual creator relationships.

---

## 4. The pages you'll actually use

| Route | What it is |
|---|---|
| `/` | Hub landing — two doors (CRM + Pipeline) |
| `/creators` | The CRM list. 4 tabs: **Por contactar** · **Em outreach** · **Em contacto** · **Frios**. Filters: Adicionado por · Deal Score · Audit. "+ Adicionar Creator" + "↑ Bulk Import" entry points. |
| `/creators/audit-queue` | Bulk ecosystem-audit page. Row selection, walk-away worker, "Adicionado por" filter so each operator sees only their creators. |
| `/creators/import` | CSV-style bulk-import workflow. Niche + country per batch. Auto-audits during import. |
| `/creators/[id]` | The per-creator detail page. Tabs: **Perfil** · **Audit** · **DM Writer** · **Oferta** · **Launch** · **Pitch**. Header carries the at-a-glance actions (Ver perfil + Email + score chips + language badge). |
| `/pipeline` | Post-close board. Only `pipelineStatus === 'signed'` creators. |
| `/pitch?creatorId=X` | 11-slide pitch deck. Inline editable. Exports PDF / PPTX / Launch Plan PDF. |
| `/onboarding/[token]` | Public 30-field intake form (no auth). Sent to creators on close to gather kickoff info. |
| `/equipa` | Team dashboard. Per-operator touchpoint stats, funnel breakdown, €50 month-to-date, streaks, weekend-exempt today view. |
| `/support` | Tickets CRUD. Internal bug-tracking + feature requests. |
| `/admin/team` | Allowlist management. Magic-link auth gate is mandatory across the whole hub. |
| `/signin` | Magic-link auth. Email-only login + 6-digit code fallback. |

**Auth model.** The hub is **fully gated**. Middleware redirects to `/signin` for anyone not on the `team:emails` Redis set (seeded from `TEAM_EMAILS` env var). `/onboarding/[token]` is the only public route — needed for creators filling out the kickoff form. The AUTH_ENABLED feature flag was removed on 2026-05-19 — there's no "off" switch any more.

---

## 5. The outreach engine

### DM Writer (`/api/dm-writer`)

3 templates × 3 languages = 9 system prompts. Operator picks the template and language from a dropdown in the DM tab. Sender's first name (Tomás / Raul) is sourced from the signed-in session.

**Templates:**
- **A — Second Layer (consultivo).** 3-block question-led DM, the question IS the close. No video CTA.
- **B — Second Layer (parceria).** 7-block partnership pitch. Names the offer ("comunidade"), explicit video CTA, closes with "Faz sentido?".
- **C — Day in the Life.** Placeholder, reuses A until the DOTL voice spec is defined.

**Languages:**
- **PT** — European Portuguese. "tu", never "você". No Brazilian terms.
- **EN** — Natural English, contractions OK, no agency-speak.
- **ES** — Castilian Spanish. "tú", never "vos" or "usted". Spain-market vocabulary.

**Hard constraints baked into every system prompt:**
- Zero em/en dashes as punctuation
- Zero AI-tell vocabulary (vibrant, foster, leverage, landscape, tapestry, intricate, garner, etc.)
- Zero rule-of-three lists, negative parallelisms, persuasive authority tropes
- Zero generic compliments or sycophancy
- Operator notes section pinned at the TOP of the user message + reminder at the bottom (without this, the LLM treated notes as background metadata and ignored them)

**Output per call:** Cold DM + T+3 comment + Email Day 1 (with operator signature appended). Day 7 and Day 14 emails generate on-demand via separate stage flags so the operator only pays for what they'll actually send.

**1000-character cap.** Instagram silently truncates DMs >1000 chars. Defense in depth:
1. Prompt instructs the LLM to stay under 1000 (with order: cut Block 2 first, then tighten Block 3, never cut greeting or sign-off)
2. Post-generation validator. If `dm.length > 1000`, a second minimal Claude call compresses it. If the compress also fails, the original ships with a `dm_overflow` field so the UI can warn.
3. Live counter on the DM card in the UI: `874/1000` chip turns amber within 50 chars, red over the cap, with a red banner under the body.

### DM Rewrite (`/api/dm-rewrite`)

Operator regenerates with a custom instruction ("emphasise the podcast", "tighten Block 2"). Two modes:
- **Single** — rewrites one touchpoint
- **Paired** — rewrites the Cold DM + Day 1 email together, applying the same feedback to both. Same observation, same pitch, same close.

Both modes enforce the 1000-char cap on the DM portion and append the operator's signature on email rewrites.

### DM Reply (`/api/dm-reply`)

Classifies an inbound creator reply using Hormozi's 4 BLAME BUCKETS (circumstances / other-people / self / genuine-question) plus positive / disqualify / handoff. Composes a Raul-voiced validate-then-transition response with a named close (Better-To-Start-When-Busy, Mechanic-Close, etc.). Brand-locked templates per language. The 4-block decision tree from `lead-nurture` skill is layered on top.

### Operator signatures

Every outreach email gets a 3-line contact card appended automatically:

```
Abraço,
Tomás

Tomás Massano
tomas@informallabs.com
secondlayerhq.com
```

Hardcoded in `lib/operatorSignature.js`. Lookup is firstName-based + diacritic-insensitive. **Never** appended to DMs (Instagram doesn't render signatures and the 1000-char cap can't afford the lines).

---

## 6. The offer engine

### Ecosystem Audit (`/api/creators/[id]/ecosystem-audit`)

Single biggest LLM investment per creator. Combines deterministic scraping with web search to produce a complete picture of the creator's existing product ecosystem before the wizard runs.

**Pipeline:**
1. **Deterministic aggregator scrapers** — Stan.store (3 paths: Nuxt IIFE eval via node:vm, legacy `__NEXT_DATA__`, regex fallback) + Linktree (`__NEXT_DATA__` JSON parse). Returns products with original currency intact (no USD→EUR conversion).
2. **Server-side URL previews** (`lib/urlPreview.js`) for non-aggregator URLs. Fetches HTML, extracts title + description + price-hint regex matches, follows up to 2 discovered pricing links per primary URL (`/pricing`, `/plans`, `/checkout`, etc.) with strong/weak path scoring.
3. **Web search** via Claude `web_search_20250305` tool, density-scaled: 0-2 URLs in scope → 3 searches, 3-4 → 1 search, 5+ → skip extra discovery to stay under token budget.
4. **Cross-reference instructions** in the prompt: if a Stan.store ebook shows `5,29 €` in URL_PREVIEW priceHints, the LLM **must** stamp that price on the matching Linktree product instead of guessing.

**Output:**
- `products_found[]` — name, price, currency (EUR/USD/GBP — original, never converted), format, tier, URL, transformation, operator-overridable `estimated_buyers` + `retire_on_launch`
- `existing_communities[]` — same shape, with members + platform
- `has_high_ticket` / `has_mid_ticket` / `has_recurring` booleans (derived from tiers)
- `community_cannibalization_risk` — high/medium/low/none (drives downstream offer positioning)
- `gaps_identified[]` — what's missing in the ecosystem that CP3 modules can fill
- Diagnostics (URL previews, pre-discovered count, etc.) for operator override

**Operator override** via `PATCH /api/creators/[id]/ecosystem-audit/patch`. The audit's LLM-generated and occasionally wrong (misses products, hallucinates wrong-creator results from name collisions, misclassifies tiers). Rather than forcing a full re-run, the operator edits the products array inline and the wizard reads from the same fields.

### The 4-checkpoint wizard

Each step writes into `creator.offer.internal_metadata` (operator-only context) and `creator.offer.client_facing_output` (what the pitch deck reads). Schemas + validators live in `app/lib/schemas/*`.

**CP1 — Strategic frame.** Synthesises Phase 1 (audit) + Phase 2 (archetype) + Phase 3 (uniqueness) into a single strategic position: `confirmed_role`, `dominant_transformation`, `positioning_tension`.

**CP2 — Core offer.** The community name, platform (Circle / Skool / etc.), central promise, From/To transformation, core mechanic, weekly rhythm, audience for/not-for, pricing tier. Phase 3 voice + vocabulary is reused verbatim.

**CP3 — Modules + weekly_formats + library.** 4-8 modules grounded in the defensibility chain: every module MUST cite ≥1 Phase 3 uniqueness element by index (`linked_unique_elements: [0, 3]`). Schema validator enforces it. If `uniqueness_extraction.unique_elements` is empty, the route fails fast with a clear "run Phase 3 first" error instead of looping retries.

**CP4 — Value stack + pricing.** Mechanism (acronym with one letter per word, each explained), 5-8 stack items (problem/solution/delivery/value each), total stacked value 5-10× actual price, unlocked bonuses.

All 4 steps support PT / EN / ES via a `langHint` in the user message. Day labels are localised (SEG/TER/QUA for PT, MON/TUE/WED for EN, LUN/MAR/MIÉ for ES).

### Pitch deck (`/pitch?creatorId=X`)

11-slide editable deck rendered at 1920×1080, auto-scaled to viewport. Every label and number is inline-editable + persists to the creator record on blur. Strings are 3-language localised via a `pitchLang(en, pt, es)` helper. Reads exclusively from `creator.offer.client_facing_output` (operator-only metadata stays out).

**Slides:**
1. Cover (creator name + date in localised long form)
2. Ecosystem (existing tier ladder, NEW community slotted in by price)
3. Strategic context ("How this fits")
4. The community (name + mechanic + 3 pricing tiers + weekly calendar grid)
5. The method (mechanism acronym + letter cards + library entries)
6. The value (problem/solution/delivery/value table + total stacked vs actual price)
7. Audit (audience demographics + themes + For/Not For)
8. Launch plan (3 phases: Validate / Launch / Scale, goals + assets)
9. Projection (MRR or annual revenue depending on offer model)
10. Proof (other communities in the same niche, members + price)
11. Investment structure

**Exports:**
- **PDF** via `html2canvas` capture
- **PPTX** via `pptxgenjs`, native PowerPoint slides matching the same visual language
- **Launch Plan PDF** via `jspdf` — separate 8-page asset with funnel phases, week-by-week table, deliverables quadrants

---

## 7. Automation (the crons)

Two Vercel crons, registered from `vercel.json`. Both **require** the GitHub integration to be working — CLI-deployed prods don't re-register crons.

### Morning reminders — `dm-reminders` (07:00 UTC daily)

For every active prospect (not signed, not cold, hasn't replied):
- Compute days since first DM (`outreach.dmSentAt` or `dmSequence.generatedAt`)
- Bucket into Soft Nudge (day 3) / Value Drop (day 7) / Último Toque (day 14)
- Auto-cold at day 21 — moves `pipelineStatus = 'cold'`, stops further reminders
- Dedupe via `outreach.remindersSent.followUpN` — each milestone fires at most once
- Also flags `noDm` (creators in CRM ≥1 day with no outreach yet)

**Per-operator routing.** Each creator's `addedBy.firstName` is mapped to an operator email via `FIRSTNAME_TO_EMAIL`. Tomás's creators ship to `tomas@`, Raul's to `raul@`. Unrecognised actor names → both operators get the row with a `⚠ SEM OWNER` badge.

**Rich card rendering.** Each due-bucket creator shows:
- `↗ Instagram` button + `↗ Abrir no Hub` button
- Copy-paste DM follow-up text in the creator's language, signed with the operator's first name
- The pre-generated Day 7 / Day 14 email (subject + body) when `dmSequence.email_day7` / `email_day14` exists

### EOD report — `daily-dm-report` (03:00 UTC Tue-Sat ≈ 04:00 Lisbon DST)

**Why 4am.** Late-night DM sessions (operator working past midnight) used to land in the wrong day's bucket. New schedule fires after the operator's day actually ends. Uses `'yesterday'` window (`lib/teamStats.js`) so the scoreboard reflects yesterday's calendar day **plus** any post-midnight overflow into today.

**Per-operator personalised email.** Subject `[Second Layer] EOD · Tomás · X/30 touches · OK | falta Y`. Body covers:
- Headline `X / 30` in green or red
- €50 verdict box (cumpriu / falhou / nobody hit / everyone hit)
- 8-cell metric grid: touches (the unique-creator counter, NOT raw DMs), DMs, emails, follow-ups split DM/email, replies split DM/email, reply rate, creators added, signed
- Team scoreboard table

**Recipients are hardcoded** in `OPERATORS` (Tomás + Raul). The old version depended on `listTeamEmails()` reading Redis; when the set was empty AND `TEAM_EMAILS` wasn't set, the cron silently sent nothing.

**Weekend exemption.** `getDailyScoreboard()` checks the reference Lisbon day. Saturdays and Sundays return every row with `missedGoal: false` and €50 zeroed. The cron schedule is Tue-Sat (no Sun/Mon fires), so this mostly matters for the `/equipa` dashboard showing "today" on a Saturday — no red "0/30 falhou" bars on rest days.

---

## 8. The 30-touches-per-day game

The team's core accountability rule, codified in the system:

**Daily target:** 30 outreach touches per operator per weekday. A "touch" = a unique creator contacted via DM AND/OR email on that day. Sending DM + email to the same creator = 1 touch (not 2). Prevents gaming.

**Penalty:** Miss the target → pay **€50 to each teammate who hit it**, split evenly. Hit it while a teammate missed → earn €50 from each.

**Weekend rule:** No target, no penalty. Mon-Fri only.

**Tracking.** Auto-marked when the operator clicks `↗ Ver perfil` (DM) or `✉ Email` in the creator header. First-stamp-wins keeps the cron anchor stable. The Sent chip in the DM tab is still there for un-marking if you clicked but didn't actually send.

**Live scoreboard** on `/equipa`. Today / Week / Month / All windows. Funnel breakdown (added → DM → reply → call agreed → call held → signed) with conversion rates per stage. €50 month-to-date tally. Streak counter (consecutive weekdays at goal).

---

## 9. Architecture (for engineers)

### Stack
- **Next.js 14 App Router** on Vercel (Hobby plan — 2 crons max, 60s/120s function timeouts)
- **Upstash Redis** for persistence (creator records + sorted-set index `creators:index`)
- **Apify actors** for scraping:
  - `apify~instagram-scraper`
  - `clockworks~tiktok-profile-scraper`
  - `streamers~youtube-channel-scraper`
  - `ahmed_jasarevic~linktree-beacons-bio-email-scraper-extract-leads`
  - `louisdeconinck~instagram-bot-detector`
- **Claude Sonnet 4** (`claude-sonnet-4-20250514`) + `web_search_20250305` tool for all LLM work
- **Resend** for transactional email (magic links, welcome, reminders, EOD)
- **JOSE** for JWT cookies (magic-link auth)

### Storage model
- `creator:{id}` — full record (JSON in Redis)
- `creators:index` — sorted set of summary objects keyed by createdAt (for fast list queries)
- `user:{id}` + `user:byEmail:{email}` — magic-link sessions
- `team:emails` — allowlist set (bootstrapped from `TEAM_EMAILS` env var)
- `ticket:{id}` + `tickets:index` — support tickets

### Lazy-backfill pattern
Used throughout `lib/creators.js` for migrations. When `getCreator()` reads a record:
1. Check for missing fields (e.g. `addedBy`, `primaryLanguage`, `outreach.repliedChannel`)
2. Backfill in-memory with safe defaults
3. Persist the migrated record so the next read is clean

Same pattern for `addedBy` (legacy → Tomás), `primaryLanguage` (null → 'en'), and `outreach.followUps[]` array (channel-tagged).

### Summary-index denormalisation
The creators list endpoint reads from the sorted set, not full records. Summary shape includes `addedByFirstName` (canonicalised via `normalizeOperatorName`), `dealScore`, `hasEcosystemAudit`, `outreach` snapshot fields. Adding a new filter to the CRM = add to summary projection in `lib/creators.js`.

### Prompt caching
Anthropic `cache_control: { type: 'ephemeral' }` is set on every system prompt + reference material block. Cache key is per (template, language) for DM writer, per (creator, checkpoint) for the wizard. 30K TPM rate-limit retry with 65s backoff. Single retry on 429.

### Build + deploy
- `git push origin main` → Vercel auto-deploy (when GitHub integration is connected)
- CLI fallback: `cd <worktree> && vercel deploy --prod --yes` — **but CLI deploys don't register cron jobs**. Only Git-source production deployments do.
- Production aliases: `hub.secondlayerhq.com` + `secondlayer-hub.vercel.app` + `secondlayer-hub-git-main-tomasvmassanos-projects.vercel.app`

---

## 10. Operations

### Environment variables (Vercel production)

Critical:
- `ANTHROPIC_API_KEY` — all Claude calls
- `APIFY_TOKEN` — all scraping
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — storage
- `RESEND_API_KEY` — magic links, welcome, reminders, EOD
- `JWT_SECRET` — session cookies
- `CRON_SECRET` — Bearer auth on `/api/cron/*` routes (set, but route fails open if missing — see security flags below)
- `TEAM_EMAILS` — comma-separated allowlist seed (`tomas@informallabs.com,raul@informallabs.com`)
- `DAILY_DM_TARGET` — defaults to 30 if unset

### Cron schedule (`vercel.json`)
```json
{
  "crons": [
    { "path": "/api/cron/dm-reminders",    "schedule": "0 7 * * *" },
    { "path": "/api/cron/daily-dm-report", "schedule": "0 3 * * 2-6" }
  ]
}
```

### Common gotchas

1. **GitHub repo name mismatch.** The repo was renamed from `secondlayer-hub` to `secondlayer-offer-builder`. If Vercel's Git connection still points at the old name, pushes succeed (GitHub auto-redirects) but **webhooks fail silently** — no auto-deploy AND no cron registration. Fix: Vercel Settings → Git → Disconnect → Connect to the renamed repo.

2. **CLI deploys don't register crons.** Cron jobs only get registered from Git-source production deployments. After every disconnect/reconnect, the next Git push re-registers them. Confirm in Vercel Settings → Cron Jobs.

3. **Auth failure on cron endpoints.** The route reads `CRON_SECRET` and only enforces if set. If the env var is empty, anyone can hit the endpoint. Set it.

4. **Anthropic 30K TPM.** Bulk audits + import workers are paced at 25s/row to stay under. Single-creator paths handle 429 with a 65s backoff + one retry.

5. **Vercel Hobby plan limit.** 2 crons max. Adding a third = upgrade or merge functionality.

### Investigation playbook

When something seems broken:
- **Email not arriving** → check Resend dashboard for the actual send + `vercel logs` for the cron invocation. Most likely cause: GitHub webhook is dead so crons aren't firing.
- **Audit returns 0 products** → check `creator.offer.internal_metadata.ecosystem_audit_diagnostics.url_previews[]` in the audit tab's "Ver detalhe" toggle. Tells you which URLs returned what HTML.
- **DM regen ignoring notes** → fixed 2026-05-23, notes block is now hoisted to the top of the user message. If still seeing it, the request didn't include the field.
- **Creator showing wrong language** → check `creator.primaryLanguage`. The language badge on the creator detail page cycles PT → EN → ES → PT on click.
- **EOD email missing operator's row** → the cron uses synthetic zero-rows for any operator missing from the scoreboard. If still missing, check the `OPERATORS` array in `daily-dm-report/route.js`.

---

## 11. What's still manual

Honest list of gaps:

1. **DM Template C (Day in the Life)** — placeholder using Template A's prompt until the voice spec is defined.
2. **Welcome email signatures** — the welcome email fires when `pipelineStatus → 'signed'` but doesn't carry the per-operator signature.
3. **Onboarding page i18n** — uses `t(pt, en, es)` with EN-fallback for Spanish, but actual ES translations of the 30-field form copy haven't been filled in.
4. **Pitch deck Launch Plan PDF** — most ES translations fall back to EN. PT and EN are complete; ES is partial.
5. **`/api/cron/autopilot-discovery`** — designed but no longer in `vercel.json` (slot used by EOD report). Can be re-enabled if the team wants automated lead discovery again.
6. **Editable contactEmail** — works via the IG section card, but there's no "set email manually on a creator with no IG card" path.
7. **Operator signing UI** — the only path to mark a creator as signed was the "Fechar Deal" button, which was removed from the header on 2026-05-20 in favour of `↗ Ver perfil`. To mark signed today: PATCH the creator record directly or add it back to the Kickoff section UI (one-line change).
8. **Cron auth fail-open** — `CRON_SECRET` is optional. Should fail closed when the env var isn't set.

---

## 12. Recent shipped (last 2 weeks)

In rough order, newest first:

- **2026-05-24** Bulk-audit page: "Adicionado por" filter chip
- **2026-05-23** Reminder ownership fixed (was reading non-existent `addedBy.email`, now keys on firstName)
- **2026-05-23** Weekend exemption on €50 + missedGoal logic
- **2026-05-22** EOD moved to 04:00 Lisbon Tue-Sat, uses 'yesterday' window
- **2026-05-22** Vercel GitHub integration reconnected (repo rename mismatch was killing auto-deploys + cron registrations)
- **2026-05-22** DM Writer language dropdown (PT / EN / ES override)
- **2026-05-21** Operator email signatures (Tomás Massano + Raúl, hardcoded in `lib/operatorSignature.js`)
- **2026-05-21** Operator notes hoisted to top of dm-writer user message + system-prompt priority directive
- **2026-05-21** "Ver perfil" merges DM-copy + profile-open into one click
- **2026-05-21** Auto-mark sent on header button clicks (first-stamp-wins)
- **2026-05-21** Email auto-discovery cascade widened: TikTok bio, YouTube description, bio-link titles, external-URL fetch with mailto: anchors + visible-text regex
- **2026-05-21** Editable contactEmail on creator detail page
- **2026-05-20** Gmail compose button (Day 1 pre-filled when available)
- **2026-05-20** 1000-character DM cap end-to-end (prompt + post-validate + live counter)
- **2026-05-20** "Ver perfil" replaces "Fechar Deal" in the header
- **2026-05-20** Per-operator reminders + new EOD format (rebuilt from a single-team-digest model)
- **2026-05-20** Spanish (Castilian) language support end-to-end
- **2026-05-19** Currency tracking — original currency (USD/EUR/GBP) preserved instead of fake-converted to EUR
- **2026-05-19** Server-side URL previews + pricing-link follow + cross-reference instructions
- **2026-05-19** Deterministic Linktree scraper (`__NEXT_DATA__` JSON parse)
- **2026-05-18** Auth gate made mandatory (AUTH_ENABLED feature flag removed)
- **2026-05-18** Channel-aware reply tracking (`repliedChannel`, `followUps[].channel`)
- **2026-05-18** Tab restructure: "Novos" → "Por contactar" + "Em outreach"
- **2026-05-17** Bulk audit page (`/creators/audit-queue`)
- **2026-05-17** Auto-audit during bulk import
- **2026-05-16** 8 team-stats metrics (pipeline coverage, CAC, touchpoints/close, show-up rate, loss reasons, follow-up effectiveness, pipeline velocity, win-rate trajectory)
- **2026-05-15** Mobile responsiveness pass (`.sl-grid-N` classes stack to 1 column under 768px)

---

## 13. Where to look for things

| Want to change... | Look in |
|---|---|
| The DM writer prompts | `app/api/dm-writer/route.js` — search `DM_A_PT` / `DM_B_PT` / `DM_A_EN` etc. SHARED_RULES at top covers anti-AI rules + 1000-char cap + operator-notes priority. |
| The reminder email layout | `app/api/cron/dm-reminders/route.js` — `sendDigest()` function. Card rendering in `fmtCardHtml`. |
| The EOD email layout | `app/api/cron/daily-dm-report/route.js` — `buildOperatorEmail()`. |
| The pitch deck slides | `app/pitch/page.jsx`. Pitch strings via the `pitchLang(en, pt, es)` helper near the top of `PitchPageContent`. |
| Operator signatures | `app/lib/operatorSignature.js`. One-line edit per operator. |
| The 4-checkpoint wizard | `app/api/creators/[id]/wizard/{strategic-frame,core-offer,modules,value-stack}/route.js`. Schemas in `app/lib/schemas/`. |
| The ecosystem audit prompt | `app/api/creators/[id]/ecosystem-audit/route.js`. Aggregator scrapers in `app/lib/aggregatorScrapers.js`. URL previews in `app/lib/urlPreview.js`. |
| Team-stats math | `app/lib/teamStats.js` — `getTeamStats`, `getDailyScoreboard`, `getFunnels`, `getStreaks`. Window logic in `windowStart()`. |
| The CRM list filters | `app/creators/page.jsx`. `FilterDropdown` component at the bottom. |
| Magic-link auth | `app/lib/auth.js` + `app/lib/magicLink.js` + `app/api/auth/*`. Middleware in `middleware.js`. |
| Cron schedule | `vercel.json`. Re-register requires a Git-source deploy. |

---

## 14. One-line install / dev

```bash
git clone https://github.com/tomasvmassano/secondlayer-offer-builder.git
cd secondlayer-offer-builder
npm install
cp .env.example .env.local   # fill in the 6 critical env vars
npm run dev
```

App boots at `http://localhost:3000`. Without Redis env vars, in-memory fallback runs (data wiped on restart — fine for dev). Without Apify token, scrape calls error gracefully. Without Anthropic key, LLM calls 500.

Magic-link emails go to console.log when `RESEND_API_KEY` is missing — copy the link from the terminal to "log in" locally.

---

## 15. Contact + ownership

- **Founder + primary operator:** Tomás Massano · tomas@informallabs.com
- **Outreach operator:** Raúl · raul@informallabs.com
- **Repo:** https://github.com/tomasvmassano/secondlayer-offer-builder
- **Production:** https://hub.secondlayerhq.com
- **Vercel project:** `tomasvmassanos-projects/secondlayer-hub` (Hobby plan)
- **Support tickets:** filed at `/support` inside the hub

Bugs go to `/support`. Code changes go through the worktree workflow in `.claude/worktrees/` with conventional commits.
