# Creator Intelligence — Design Doc

## Problem
When the team opens a creator profile, they only see basic stats (followers, engagement, bio). They don't know what the creator sells, at what price, what content performs best, who their competitors are, or who their audience really is. This means every DM, offer, and pitch starts with incomplete information.

## Solution
Enhance the existing scrape pipeline to extract richer data from what's already publicly available — no new APIs or dependencies. The team adds a creator the same way they do today, but gets 5x more info back.

## New Data Extracted at Scrape Time

### 1. Revenue Signals (Bio Link Crawling)
- Follow every link in the creator's bio (Linktree, link.bio, direct URLs)
- For each destination, detect: platform (Skool, Hotmart, Gumroad, Teachable, Kajabi, Stan Store, personal site), product name, pricing if visible
- Stored as `intelligence.bioLinks[]`

### 2. Content Analysis (From Apify Post Data)
- Analyze last 12 posts returned by Apify
- Extract: top 3 performing posts (by engagement), topic clusters, format breakdown (% reels vs carousels vs static), posting frequency (posts/week)
- Stored as `intelligence.topPosts[]` and `intelligence.contentStyle`

### 3. Competitor Scan (Claude Web Search)
- Claude searches for top 3-5 competitors in the creator's niche + language/country
- Returns: name, platform, price, estimated community size, URL
- Stored as `intelligence.competitors[]`

### 4. Audience Estimate (From Content + Comments)
- Estimate from: bio language, location tags, comment language, content language
- Returns: primary country, primary language, estimated age range
- Stored as `intelligence.audience`

## Data Model

```javascript
creator.intelligence = {
  bioLinks: [
    { url, platform, productName, price, currency }
  ],
  topPosts: [
    { caption, engagementRate, format, topic }
  ],
  contentStyle: {
    formatBreakdown: { reels: 60, carousels: 25, static: 15 },
    postsPerWeek: 4.2
  },
  competitors: [
    { name, platform, price, currency, estimatedSize, url }
  ],
  audience: {
    primaryCountry, primaryLanguage, estimatedAgeRange
  }
}
```

Fields that can't be found stay empty. No errors, just gaps.

## UI Changes

No new sections or tabs. New data displays inline on the existing Perfil tab:

- **Products found** (with platform + price) — next to niche and platforms
- **Top 3 posts** (topic + engagement per post) — next to engagement rate
- **Content style** (format breakdown + posting frequency) — next to engagement rate
- **Competitors** (3-5 names with platform + price) — next to niche
- **Audience** (estimated country, language, age range) — next to follower count

## Files to Modify

1. **`/app/api/creators/route.js`** — extend POST handler to run bio link crawling + content analysis + competitor scan after Apify scrape. One flow, one request.
2. **`/app/lib/creators.js`** — add `intelligence` field to data model with deep merge on update.
3. **`/app/creators/[id]/page.jsx`** — enrich Perfil tab to display new fields inline.

## Files NOT Changed
- No new API routes
- No new pages
- No new dependencies

## Verification
- Add a creator with a Linktree in their bio → products + pricing appear on profile
- Add a creator with 12+ posts → top 3 posts + format breakdown visible
- Add any creator → competitors list populated for their niche
- Add any creator → audience estimate (country, language, age) visible
- Empty fields (no Linktree, no pricing found) → no errors, fields just don't show
