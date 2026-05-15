# HANDOFF — Second Layer Hub Audit
Phase 1 of cleanup. Read-only. No code has been changed.

---

## 🚨 Security flags (read first)

Three issues that should be addressed before any deletion work — they're independent of cleanup and live in production today.

1. **Auth middleware is off by default.** `middleware.js:79` short-circuits when `AUTH_ENABLED !== 'true'`. If the env var is unset or misspelled, *every* `/api/*` route is publicly callable, including:
   - `POST /api/creators` (spends Apify + Claude money per call)
   - `POST /api/discovery` (bulk Apify spend)
   - `POST /api/offers`, `DELETE /api/offers` (the DELETE clears the entire offers Redis key)
   - `POST /api/dm-writer`, `/api/generate`, `/api/launch-generate` (Claude spend)
   - `PATCH/DELETE /api/creators/[id]`
   None of these have per-route auth guards — they trust the middleware.

2. **Cron secret is optional.** `app/api/cron/autopilot-discovery/route.js` and `app/api/cron/dm-reminders/route.js` both use:
   ```js
   if (cronSecret && authHeader !== `Bearer ${cronSecret}`) return 401
   ```
   If `CRON_SECRET` is empty, the guard is skipped entirely. Both crons trigger Apify scrapes / Claude calls / email sends. They should fail closed, not open.

3. **`/api/proxy-image` is allowlisted (good).** The proxy enforces a hardcoded domain whitelist (Instagram, TikTok, YouTube, Apify CDNs). Not an open proxy.

Otherwise no hardcoded secrets and no exposed keys in code.

---

## Executive summary — what this tool actually does today

Second Layer Hub is a CRM + content-generation tool for outreach to creators. Operator workflow:

1. **Find creators** — either manually via "+ Adicionar Creator", in bulk via "↑ Bulk Import" (new), or automatically via the daily autopilot-discovery cron seeded from existing creators' "related profiles".
2. **Lean scrape** — Apify Instagram-only + a no-tools Claude call to infer niche, audience, top-post themes. Deal Score computed. D-tier auto-filtered during bulk import.
3. **DM + email outreach** — `/api/dm-writer` generates one DM + T+3 comment + 3 follow-up emails (Day 1 / 7 / 14) in one Claude call.
4. **Daily reminders** — `/api/cron/dm-reminders` (08:00 Lisbon) scans prospects, categorises by days-since-DM (3 / 7 / 14 / 21+ auto-cold), emails the digest to `tomas@ + raul@informallabs.com`.
5. **Creator engages** → operator clicks **↻ Full Scrape** to pull TikTok + YouTube + bio-link products + web-search competitor analysis.
6. **Offer + Pitch** — A-O Hormozi offer generated via `/api/generate` → parsed into the 11-slide pitch deck at `/pitch?id=X`. Pitch toolbar exports PDF / PPTX / **Plano de Lançamento PDF** (8-page Lia-style sent between calls).
7. **Closed deal** — `pipelineStatus: 'signed'` flips the creator page to a Workspace view (kickoff form at `/onboarding/[token]`, kickoff brief PDF, launch asset generation via `/api/launch-generate`).

Three user-facing things stitch the whole experience:
- `/` (Hub landing) → links to **/creators** and **/pipeline** only.
- `/creators` (the CRM list + filters + Bulk Import).
- `/creators/[id]` (the per-creator detail with tabs: DM, Offer, Pitch, etc.).

Bug-tracking + ticketing lives at **/support** (fully wired). Team admin at **/admin/team** (auth-gated when middleware is on).

---

## Feature inventory

### Pages (14)

| Route | Status | Notes |
|---|---|---|
| `/` | ✅ Active | Landing, two doors: CRM + Pipeline |
| `/creators` | ✅ Active | Main CRM list, Discovery queue, Add/Import |
| `/creators/[id]` | ✅ Active | Detail page with DM, Offer, Pitch, Launch tabs. Switches to Workspace when signed. |
| `/creators/import` | ✅ Active | New bulk-import page |
| `/pipeline` | ✅ Active | Post-close board (signed creators only) |
| `/pitch` | ✅ Active | 11-slide editable deck (reads `?id=X`) |
| `/onboarding/[token]` | ✅ Active | 30-field post-close intake form |
| `/support` | ✅ Active | Tickets CRUD |
| `/admin/team` | ✅ Active | Auth-gated team allowlist mgmt |
| `/signin` | ✅ Active | Magic link auth |
| `/dashboard` | 💀 Stranded | Listed past offers from the LEGACY `/api/offers`. Linked **only** from `/offer-builder` and `/offer/[id]`. Not on root nav. |
| `/dm-writer` | 💀 Stranded | Standalone DM tool. **No inbound links anywhere.** Pre-CRM relic. |
| `/offer-builder` | 💀 Stranded | Standalone Hormozi offer tool that predates the creator-centric flow. Not on root nav. Uses `/api/scrape` (web-search-based) + `/api/offers`. Same job done better inside `/creators/[id]` Offer tab. |
| `/offer/[id]` | 💀 Stranded | Public-ish offer share page. Backed by legacy `/api/offers/[id]`. No inbound links. |

**Note on `/creators/[id]/workspace/`:** This is **not a route** — there's no `page.jsx`. It's a folder holding `WorkspaceDashboard.jsx` + `KickoffSection.jsx` that the parent creator page imports when `pipelineStatus === 'signed'`. Active component dir, not a route.

### API routes (34)

| Route | Status | Callers |
|---|---|---|
| `POST /api/creators` | ✅ Active | `creators/import`, `lib/CreatorSelector.jsx` |
| `GET/PATCH/DELETE /api/creators/[id]` | ✅ Active | `creators/[id]`, `pipeline`, `pitch` |
| `POST /api/creators/[id]/full-scrape` | ✅ Active | `creators/[id]` (new "↻ Full Scrape" button) |
| `POST /api/discovery` + autopilot/runs/seeds/[id] | ✅ Active | `creators` page |
| `POST /api/dm-writer` | ✅ Active | `creators/[id]` (DM tab) |
| `POST /api/dm-reply` | ✅ Active | `creators/[id]` (reply handler) |
| `POST /api/dm-rewrite` | ✅ Active | `creators/[id]` (rewrite button) |
| `POST /api/generate` | ✅ Active | `creators/[id]` (offer gen) + `/offer-builder` (legacy) |
| `POST /api/launch-generate` | ✅ Active | `creators/[id]` (workspace assets) |
| `GET /api/launch-plan/[creatorId]/pdf` | ✅ Active | `pitch` toolbar button |
| `GET /api/kickoff/[creatorId]/brief` | ✅ Active | `creators/[id]/workspace/KickoffSection.jsx` (verified via component) |
| `POST /api/onboarding/[token]` + `/complete` | ✅ Active | `onboarding/[token]` |
| `POST /api/export-pptx` | ✅ Active | `pitch` toolbar |
| `POST /api/translate-audience` | ✅ Active | `pitch` page |
| `GET /api/proxy-image` | ✅ Active | 4 pages (avatar rendering) |
| `GET /api/cron/autopilot-discovery` | ⚠️ Active | Vercel cron 05:00 UTC — guard optional (see security) |
| `GET /api/cron/dm-reminders` | ⚠️ Active | Vercel cron 07:00 UTC — guard optional |
| `GET/POST /api/admin/team` | ✅ Active | `/admin/team` page |
| `GET /api/auth/me` + `/request-link` + `/verify` + `/signout` | ✅ Active | Magic-link flow |
| `GET/POST /api/tickets` + `/[id]` | ✅ Active | `/support` page |
| `POST /api/scrape` | 💀 Stranded | Web-search-based scraper. **Only caller is `/offer-builder/page.jsx`** (legacy). Different engine from `/api/creators` (Apify-based). |
| `POST/GET/DELETE /api/offers` + `/[id]` | 💀 Stranded | Legacy offer store. Used by `/dashboard`, `/offer-builder`, `/offer/[id]` (all stranded). |
| `GET /api/test-ig` | 💀 Dead | Hard-coded test against `@_andre.teixeira`. No callers. Dev relic. |
| `GET /api/debug-apify` | 💀 Dead | Debug endpoint, no callers. Dev relic. |

### Lib (`app/lib/*` — 16 files)

| File | Status | Dead exports |
|---|---|---|
| `apify.js` | ⚠️ | **`scrapeCreator`** has zero callers. Everything else used. |
| `auth.js` | ⚠️ | `verifySessionJWT`, `getSessionTokenFromRequest`, `COOKIE_NAME_EXPORT` only used internally — could be private. |
| `creators.js` | ✅ | All 7 exports used |
| `dealScore.js` | ⚠️ | **`getNichePricing`** never called externally (data is inlined in `calculateDealScore`) |
| `discovery.js` (30K) | ✅ | All exports referenced. Big but clean. |
| `language.js` | ⚠️ | **`languageLabel`**, **`languageBreakdown`** unused |
| `magicLink.js` | ✅ | Both exports used |
| `rateLimit.js` | ✅ | Both exports used |
| `revenue.js` | ⚠️ | **`calculateEngagementMultiplier`**, **`DEFAULT_LAUNCH_MULTIPLIER`** only used internally. **`detectNichePricing`** — `pitch/page.jsx` redefines the same logic locally instead of importing. |
| `skills.js` | ✅ | All exports used |
| `systemPrompt.js` | ⚠️ | **`getOfferSystemPrompt`** never imported — `creators/[id]/page.jsx` and `offer-builder/page.jsx` both import `OFFER_SYSTEM_PROMPT` (raw constant) instead. The function is a dead wrapper. |
| `tickets.js` | ✅ | All used |
| `users.js` | ✅ | All 10 exports used |
| `welcomeEmail.js` | ✅ | Used by `/api/creators/[id]` PATCH on "signed" |
| `sendMagicLinkEmail.js` | ✅ | Used by `/api/auth/request-link` |
| `CreatorSelector.jsx` | ✅ | Imported by `/dm-writer` + `/offer-builder` (the stranded pages). Becomes dead once those are removed. |

**Plus** `app/offer-builder/lib/db.js` + `app/offer-builder/lib/shared.jsx`:
- `db.js` — used only by stranded `/api/offers` routes
- `shared.jsx` — **alive and central**: `renderMd`, `parseOutput`, `extractAudience`, `Badge` are imported by `/creators/[id]`, `/pitch`, `/offer/[id]`, `/workspace`. Even though it lives under the legacy `offer-builder/` folder, its exports are the parser everything reads.

### Skills (`app/knowledge/skills/` — 21 skills)

Compiled bundle `skills-bundle.json` is 885KB. Compiler runs as `prebuild`.

| Skill | Used by |
|---|---|
| `hundred-million-offers` | Offer (Section A-O) + launch-generate.leadMagnet |
| `money-model` | Offer + launch-generate.salesPageCopy + churnPrevention |
| `pricing-plays` | Offer + launch-generate.salesPageCopy + emailSequence |
| `case-studies` | Offer (passed via `skills:` body to `/api/generate`) |
| `closing` | Offer + dm-writer + dm-reply + launch-generate (2 assets) |
| `hooks` | dm-writer + launch-generate (4 assets) |
| `core-four` | dm-writer + launch-generate (2 assets) |
| `lead-nurture` | dm-reply + launch-generate.onboardingFlow |
| `launch-strategy` | launch-generate.launchTimeline |
| `copywriting` | launch-generate.salesPageCopy |
| `landing-page` | launch-generate.salesPageCopy |
| `email-sequence` | launch-generate.emailSequence |
| `ad-creative` + `ad-assembly` | launch-generate.adCreative |
| `social-content` + `marketing-machine` | launch-generate.socialContent + communityActivation |
| `contagious` + `storybrand-messaging` | launch-generate.communityActivation |
| `hooked-ux` + `improve-retention` | launch-generate.onboardingFlow |
| `churn-prevention` | launch-generate.churnPrevention |

**All 21 are active.** The earlier deferred set (`branding-bouquet`, `cfa-math`, `crazy-eight`, `fast-cash-play`, `offer-wrappers`, `lead-magnets`, `lead-getters`, `avatar-selection`, `scale`) is absent from disk and code — clean break already done.

### Crons

| Path | Schedule | Notes |
|---|---|---|
| `/api/cron/autopilot-discovery` | `0 5 * * *` (05:00 UTC) | Seed-based candidate scan + Resend digest |
| `/api/cron/dm-reminders` | `0 7 * * *` (07:00 UTC ≈ 08:00 Lisbon) | New — daily follow-up digest |

---

## Mid-refactor / duplicate logic

1. **Two scrape engines coexist.**
   - **Modern path:** `/api/creators` POST → `scrapeLean` / `scrapeMultiplePlatforms` (Apify-based, lean by default, full on demand).
   - **Legacy path:** `/api/scrape` POST → Claude + `web_search` tool, called only by `/offer-builder`. Different return shape, different cost profile (Sonnet+web_search ~$0.05+ per call), no Apify involvement.
   The legacy path can go when `/offer-builder` goes.

2. **Two offer-builder flows coexist.**
   - **Modern:** Inside `/creators/[id]` → Offer tab → `/api/generate` with skills → A-O parsed offer → autoflows into `/pitch`.
   - **Legacy:** `/offer-builder` page → `/api/scrape` → `/api/generate` → saves to `/api/offers` → renders at `/offer/[id]`. Self-contained, predates the creator-centric model. None of its UI is reachable from the hub today.

3. **`OFFER_SYSTEM_PROMPT` is imported as a raw constant in two places.** `creators/[id]/page.jsx` and `offer-builder/page.jsx` both import the constant directly, bypassing `getOfferSystemPrompt()`. The function-wrapper is a dead export. Either everyone migrates to the function (so skill-loading is centralised) or the wrapper goes.

4. **`detectNichePricing` is defined twice.** Once in `app/lib/revenue.js` (exported, no callers), once inline in `app/pitch/page.jsx`. Same logic, drifted independently. Pick one.

5. **`scrapeInstagram` vs `scrapeInstagramBasic` vs `scrapeLean`.** All three live and all three used (full vs basic vs lean-wrapper). Not technically duplicated — they're a tiered family — but worth documenting which Apify cost each one carries.

6. **Stale "outreach" tracking on legacy creators.** Pre-existing `dmSequence.generatedAt` is being used as a fallback anchor for the new reminders cron. If you ever rename `dmSequence` → `dm`, the cron's fallback breaks silently. Worth a tiny safeguard.

---

## Quick wins (safe deletions, no behaviour change)

These have **zero callers anywhere**. Safe to delete with one commit each:

1. `app/api/test-ig/route.js` — hardcoded `@_andre.teixeira` test endpoint
2. `app/api/debug-apify/route.js` — dev-only debug endpoint
3. `scrapeCreator` export in `app/lib/apify.js` — orphan function
4. `getNichePricing` export in `app/lib/dealScore.js` — orphan
5. `languageLabel`, `languageBreakdown` exports in `app/lib/language.js` — orphan
6. `calculateEngagementMultiplier`, `DEFAULT_LAUNCH_MULTIPLIER` exports in `app/lib/revenue.js` — only used internally, can become private
7. `getOfferSystemPrompt` export in `app/lib/systemPrompt.js` — wrapper bypassed everywhere
8. `verifySessionJWT`, `getSessionTokenFromRequest`, `COOKIE_NAME_EXPORT` in `app/lib/auth.js` — only used internally
9. The pitch deck's three legacy state slots (`whatYouGet`, `buildOperate`, `recap` in `buildDefaultSlides`) — their slides were cut weeks ago and the state is now dead data hanging on the slides object. (~50 lines)

---

## Proposed cleanup plan — ordered by risk

### Phase A — Zero-risk deletions (no UX change)

1. Delete `/api/test-ig` and `/api/debug-apify` endpoints.
2. Delete the 9 dead exports listed in "Quick wins" above. Each in its own commit.
3. Strip the dead pitch-deck state slots (`whatYouGet`, `buildOperate`, `recap`) from `buildDefaultSlides`.

**Estimated diff:** ~300 lines removed, no functional change.

### Phase B — Security hardening (do BEFORE anything else if any of these are exposed today)

4. Flip `middleware.js` to fail closed: if `AUTH_ENABLED` is anything but `'true'` AND production env, log a warning but apply a basic IP/origin allowlist OR require the cron secret on cron routes regardless.
5. Make `CRON_SECRET` required, not optional. Routes 401 if env unset.
6. Add a basic auth check to every POST/PATCH/DELETE `/api/creators*`, `/api/discovery*`, `/api/dm-*`, `/api/generate`, `/api/launch-generate`, `/api/offers*`, `/api/tickets*` — even just a single shared bearer if you don't want full session auth yet.

These are independent of the cleanup itself but should not be left for "later" once the codebase is stable.

### Phase C — Decide on the stranded legacy sub-app

This is the biggest pile of dead-ish code and the one I want your input on. The block:

```
/dashboard
/dm-writer
/offer-builder
/offer/[id]
/api/scrape
/api/offers
/api/offers/[id]
app/offer-builder/lib/db.js
```

**Recommendation: kill it.** Reasoning:
- None of it is on the hub navigation. New users would have to know the URLs.
- Functionality is duplicated by the creator-centric flow inside `/creators/[id]`.
- The legacy uses a different + more expensive scrape engine (`/api/scrape`'s web_search Claude calls vs `/api/creators`' Apify path).
- Removing it lets us also delete `app/lib/CreatorSelector.jsx` (only used by stranded pages).

**The catch:** `app/offer-builder/lib/shared.jsx` (`renderMd`, `parseOutput`, `extractAudience`) IS used by the modern app. The folder name is just historical. Suggest: **move `shared.jsx` to `app/lib/offerParser.jsx`** and delete the rest of `app/offer-builder/`. ~3000 lines gone.

### Phase D — Plumbing fixes (low-risk, high-value)

7. Decide on `getOfferSystemPrompt()` vs raw `OFFER_SYSTEM_PROMPT` import. If we want skills loaded centrally, migrate both callers to the function and delete the constant export. Otherwise delete the function.
8. Pick one `detectNichePricing` — either export the one from `revenue.js` and delete the duplicate in `pitch/page.jsx`, or vice versa.
9. Move `app/offer-builder/lib/shared.jsx` → `app/lib/offerParser.jsx` (rename + update ~6 imports).

### Phase E — Build the missing referenced features (or remove the references)

These are referenced in code but the destination doesn't exist:

- **`/c/[token]` creator portal** — `middleware.js:95` whitelists it as public, but no page. Either build it or remove the middleware reference.
- **`/privacy` page** — same: whitelisted in middleware, no page.
- **`/admin/cases` UI** — mentioned in earlier work but never built. No middleware reference; can simply be marked "not planned" or scoped.

### Phase F — Refactor opportunities (only after the above)

10. `app/lib/discovery.js` is 30KB / 873 lines. Big but all exports are used. Worth splitting into `discovery/queue.js` + `discovery/runner.js` + `discovery/seeds.js` once the rest of the cleanup settles. Lower priority.
11. The pitch deck's `buildDefaultSlides` builder is becoming a 200-line monolith. Could split per-slide into separate factories. Cosmetic, not urgent.

---

## Open questions for you

I can't tell intent from the code alone on these. I need a yes/no per item before touching anything.

1. **Kill the legacy sub-app** (`/dashboard`, `/dm-writer`, `/offer-builder`, `/offer/[id]`, `/api/scrape`, `/api/offers*`)? Recommendation is yes — they're not linked and the functionality is duplicated. If yes: any data in the Redis `offers:*` key worth migrating first?

2. **The dead exports in `/lib`** — kill all of them, or do you want to keep some as "API surface" for future internal use? I default to deleting unused exports.

3. **`getOfferSystemPrompt()` vs `OFFER_SYSTEM_PROMPT` constant** — which pattern do you want to standardise on? The function is cleaner for centralised skill management; the constant is simpler for the two existing callers.

4. **`/c/[token]` creator portal** and **`/privacy` page** — finish them, or remove the middleware references and forget them?

5. **`/admin/cases` Skool case-studies management UI** — never built. Do you want it on the roadmap or kill the idea?

6. **Cron-secret enforcement** — make it required (cron routes 401 if env unset)? Recommendation is yes; the current optional guard is footgun-shaped.

7. **Auth-middleware default** — flip to fail-closed in production? Recommendation is yes; today a missing env var silently disables all protection.

8. **DM Reply auto-marking outreach.repliedAt** (shipped last commit) — there's a small edge case: if the reply was pasted but the operator didn't actually run the generator, `repliedAt` won't be set. The "Marcar respondeu" button covers it. Want me to also set `repliedAt` on any inbound text paste, or leave the explicit button as the source of truth?

---

## What I have NOT changed

Nothing. This is a read-only audit. Waiting for your green light on each section above before any file moves.

The next commit, when you approve, will be the smallest possible: probably Phase A.1 (delete the two debug endpoints) so we have a clean test of the cleanup workflow before doing larger surgery.
