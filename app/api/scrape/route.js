import { NextResponse } from 'next/server';

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { urls, creatorName } = body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: 'Missing or empty "urls" array' },
      { status: 400 }
    );
  }

  // Step 1: Scrape each platform profile
  const profileResults = await Promise.all(
    urls.map(async ({ platform, url }) => {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000,
            tools: [{ type: 'web_search_20250305', name: 'web_search' }],
            messages: [
              {
                role: 'user',
                content: `Do a thorough web search about this ${platform} creator: ${url}
${creatorName ? `Their name is ${creatorName}.` : ''}

Search for their profile on social media analytics sites, news articles, interviews, and any other public sources. Do MULTIPLE searches to gather comprehensive data.

Search for:
1. "${url}" - their actual profile
2. "${creatorName || 'this creator'} ${platform}" - general info
3. "${creatorName || 'this creator'} products OR course OR workshop OR ebook OR brand deal" - monetization history
4. "${creatorName || 'this creator'} interview OR podcast OR feature" - press coverage

Then provide a DETAILED analysis with EXACT numbers where possible:

## Profile Overview
- Full name and bio
- Exact follower/subscriber count (state the number, don't round)
- Engagement rate (calculate from likes/comments vs followers if possible)
- Content frequency (posts per week)
- Primary content themes and format

## Audience Analysis
- Estimated demographics (age, gender, location) based on content and comments
- Quality of engagement: are comments genuine questions/discussions or just emojis?
- Community sentiment: how do followers talk about this creator?

## Monetization History
- EVERYTHING they have ever sold: courses, ebooks, workshops, merch, events, coaching, digital products
- Brand deals and sponsorships visible in their content
- Any link-in-bio products, affiliate links, or shop pages
- Estimated revenue if any data is available
- If no products found, explicitly state "No products or courses found"

## Online Presence & Reputation
- Press mentions, interviews, podcast appearances
- TV appearances, awards, features
- Other platforms they're active on
- Website or landing pages
- How they're perceived in their niche

## Key Numbers for Revenue Projection
- Total followers across all known platforms
- Average engagement rate
- Estimated reach per post
- Any known conversion data (if they've sold before, what was the response?)`,
              },
            ],
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          return { platform, url, error: data.error?.message || 'API error' };
        }

        const textContent = (data.content || [])
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n\n');

        return { platform, url, content: textContent };
      } catch (err) {
        return { platform, url, error: err.message };
      }
    })
  );

  // Step 2: Synthesize all profiles into a unified creator analysis
  const allContent = profileResults
    .filter(r => r.content)
    .map(r => `## ${r.platform.toUpperCase()} (${r.url})\n${r.content}`)
    .join('\n\n---\n\n');

  let synthesis = null;
  if (allContent) {
    try {
      const synthResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          messages: [
            {
              role: 'user',
              content: `Based on all this research about ${creatorName || 'this creator'}, create a unified creator intelligence report.

RAW RESEARCH:
${allContent}

---

Synthesize into these exact sections. Be specific — use real numbers, real product names, real facts. Never assume — if data is missing, say so explicitly.

## What they already do
- Content format and style (be specific: Reels, TikToks, long-form YouTube, Stories, etc.)
- Posting frequency and consistency
- Area of expertise — are they a genuine authority or surface-level?
- Key visibility moments (TV, viral posts, press, awards)
- Engagement quality (genuine comments vs passive likes)

## What they have (signs this is the right partner)
- Exact follower counts per platform
- Engagement rate with numbers
- Monetization proof: list EVERY product, course, event, or sale you found with prices if available
- Reputation in their market
- Multi-platform presence

## What they DON'T have (gaps Second Layer fills)
- Assess based on evidence: do they have recurring revenue? Funnels? Sales pages? A membership?
- Only list gaps that are ACTUALLY confirmed by the research — don't assume

## Previous Sales & Revenue History
- List every product, course, workshop, ebook, event, or digital product found
- Include prices, platforms, and any sales volume data
- If nothing found, state clearly: "No previous digital products or courses found in public data"

## Motivations (based on their content and interviews)
- What signals suggest they want to monetize further?
- What have they said in interviews or captions about their goals?

## Fears & Objections (based on evidence)
- What might hold them back based on how they present themselves?
- Any evidence of failed launches or negative experiences?

## Primary Conversion Platform
Determine which platform is this creator's PRIMARY conversion channel — where their most engaged, loyal, ready-to-buy audience lives. Consider:
- Niche type: visual/lifestyle → Instagram, education/tutorials → YouTube, trend/entertainment → TikTok
- Engagement depth: which platform has the most genuine comments, questions, saves?
- Content depth: where do they share the most valuable, in-depth content?
- Audience intent: where are followers most likely to buy?

State clearly: "Primary platform: [PLATFORM] with [X] followers — this is the buyer pool."
Other platforms are awareness/funnel channels that drive people to the primary.

## Key Numbers Summary
| Metric | Value |
|--------|-------|
| Primary platform | X |
| Primary platform followers (buyer pool) | X |
| Instagram followers | X |
| TikTok followers | X |
| YouTube subscribers | X |
| Primary platform engagement rate | X% |
| Products sold before | Yes/No (list) |
| Estimated audience value | Low/Medium/High |`,
            },
          ],
        }),
      });

      const synthData = await synthResponse.json();
      if (synthResponse.ok) {
        synthesis = (synthData.content || [])
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n\n');
      }
    } catch (err) {
      // Synthesis failed, we'll still return individual results
    }
  }

  return NextResponse.json({
    results: profileResults,
    synthesis,
  });
}
