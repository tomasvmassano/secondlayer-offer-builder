# Creator Discovery — Design Doc

## Problem
The team's bottleneck is finding qualified leads to DM. To hit 100 DMs/day, they need a steady pipeline of creators matching Second Layer's ICP: Portuguese/Dubai creators, 100K-500K followers, 1-3% engagement, selling something or doing brand deals. Manual sourcing doesn't scale.

## Solution
Auto-discover similar creators by chaining Instagram's `relatedProfiles` data (already returned at CRM intake, currently unused). Each existing creator surfaces 5 similar candidates → these are filtered, scored, and only A/B tier matches surface in a review queue. Team approves winners with one click.

## ICP Filters
- **Follower range:** 100,000 – 500,000
- **Deal score grade:** A or B only (C/D auto-dismissed permanently)
- **Language:** Portuguese or English (detected from bio)
- **Niche:** Any niche the deal score recognizes (already covers PT + EN aliases)

## Pipeline

### Stage 1 — Free filtering (€0, instant)
Uses `relatedProfiles` data already scraped at CRM intake. Zero API calls.
- Drop if handle already in CRM
- Drop if handle in dismissed blacklist
- Drop if handle already in discovery queue
- Drop if followers outside 100K-500K

### Stage 2 — Lean scrape (~€0.15 per candidate)
For survivors of Stage 1:
- Single Apify Instagram scrape (details only)
- **Skip** bot detector
- **Skip** Linktree scraper
- **Skip** Claude intelligence analysis
- Get: bio, engagement, verified, recent posts, external URL

### Stage 3 — Free scoring (€0, instant)
- Calculate deal score using existing dealScore.js formula
- Niche detection via existing `matchNiche()` (handles EN aliases)
- If grade A or B → add to discovery queue
- If grade C or D → add handle to dismissed blacklist (permanent)

### Stage 4 — Full intelligence (~€0.20, ON APPROVAL ONLY)
When user clicks "Aceitar":
- Run Claude intelligence analysis (competitors, top posts, bio link products, audience)
- Run bot detector
- Run Linktree scraper if external URL is a bio-link service
- Save creator to CRM as Novos with full profile

## Cost Model
**Per discovery run (10 candidates):**
- Stage 1 filter drops ~3 → 7 scraped
- Stage 2: 7 × €0.15 = **€1.05**
- Stage 3 drops ~3 C/D → 4 in queue
- Stage 4 on ~2 approvals: **€0.40**
- **Total: ~€1.45 per run**

**Full sweep of 13 existing creators (65 related profiles):**
- After dedup + filter: ~30 candidates
- Stage 2: 30 × €0.15 = **€4.50**
- Stage 4 on ~8 approvals: **€1.60**
- **Total: ~€6**

## Data Model

### Redis: `discovery:queue` (list)
```javascript
{
  id: string,
  handle: string,
  name: string,
  profilePicUrl: string,
  url: string,
  followers: number,
  engagement: string,
  bio: string,
  externalUrl: string,
  isVerified: boolean,
  isBusinessAccount: boolean,
  avgLikes: number,
  avgComments: number,
  followerFollowingRatio: string,
  recentPosts: array,
  niche: string,           // detected via matchNiche() or empty
  dealScoreGrade: 'A' | 'B',
  dealScore: number,
  sourceCreatorId: string,
  sourceCreatorName: string,
  sourceCreatorHandle: string,
  createdAt: string,
}
```

### Redis: `discovery:dismissed` (set of lowercase handles)
Permanent blacklist. Never re-surfaced.

## User Flow

### Trigger discovery
**Per-creator** — button on creator profile: "Find 5 similar"
→ Runs Stages 1-3 on that creator's 5 related profiles
→ Toast: "Encontrados 3 A/B tier creators"

**Bulk** — button on Discovery tab: "Run Discovery"
→ Confirms cost estimate
→ Runs Stages 1-3 on all CRM creators
→ Progress bar + live status

### Review queue
- New "Discovery" tab in CRM (alongside Novos + Em contacto)
- Each card: profile pic, name, handle, followers, niche, engagement, deal score badge, source attribution
- Ranked by deal score (A first, then B), then followers desc
- Actions per card: **Aceitar** (→ Stage 4 + add to CRM) / **Dispensar** (→ blacklist)

## Files Changed

**New:**
1. `/app/lib/discovery.js` — queue + blacklist + discovery runner
2. `/app/api/discovery/route.js` — GET (list), POST (run)
3. `/app/api/discovery/[id]/route.js` — POST (accept), DELETE (dismiss)

**Modified:**
1. `/app/lib/apify.js` — add `scrapeInstagramBasic()` that skips bot detector
2. `/app/creators/page.jsx` — Discovery tab
3. `/app/creators/[id]/page.jsx` — Find Similar button

**Reused (no changes):**
- Apify intelligence pipeline
- Claude analysis
- Deal score calculator
- Creator save/index logic

## Out of Scope (Phase 2)
- Hashtag discovery
- Competitor follower scraping
- TikTok/YouTube discovery
- Scheduled auto-discovery
- ML-based ICP tuning

## Verification
- Click "Find Similar" on an existing creator → discovery runs, queue populates
- C/D tier candidates never appear in queue
- Dismissed candidates never resurface even if discovered again via another creator
- Candidates already in CRM are never duplicated
- Follower range filter works (no <100K or >500K in queue)
- Accepting a candidate runs full intelligence and adds to Novos
