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

  const { urls } = body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: 'Missing or empty "urls" array' },
      { status: 400 }
    );
  }

  const results = await Promise.all(
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
            tools: [{ type: 'web_search_20250305' }],
            messages: [
              {
                role: 'user',
                content: `Search the web for detailed information about this ${platform} creator profile: ${url}

Analyze this creator and structure your response in these exact 5 sections:

## What they already do
- Content format and style (short-form video, long-form, stories, etc.)
- Posting frequency and consistency
- Area of expertise and depth of knowledge
- Whether they are a genuine specialist, not just a pretty face
- Key moments of visibility (TV appearances, viral content, awards, press)
- Quality of engagement (genuine comments, questions, tags — not just passive likes)

## What they have (signs this is the right person)
- Audience size and engagement rate per platform
- Proof of monetization: have they sold anything before? (workshops, books, courses, products, events)
- Reputation: are they a recognized name in their niche or market?
- Business mindset: do they treat their work as a brand, not just a hobby?
- Multi-platform presence: Instagram + at least TikTok or YouTube?

## What they DON'T have (gaps we fill)
- No recurring monthly revenue product — everything is transactional
- No digital infrastructure: funnels, sales pages, automations, membership platform
- No paid ads management to acquire community members consistently
- No time or knowledge to build and manage a paid community
- No monetization strategy beyond brand deals and one-off products

## Motivations (what makes them say yes)
- Wants predictable monthly income, not just launch-based revenue
- Tired of depending on brand deals that can end anytime
- Feels they have much more to give than free content allows
- Wants to scale without working double — wants a system, not more hours
- Proud of their brand and wants to build something meaningful under their name

## Fears (what makes them hesitate)
- Fear of looking "commercial" and losing authenticity with their audience
- Unsure if their audience will pay for something beyond free content
- Has tried or thought about doing it alone and found it too complicated
- Doesn't want to commit to something that won't deliver results
- Distrusts agencies that promise a lot without guarantees`,
              },
            ],
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          return { platform, url, error: data.error?.message || 'API error' };
        }

        // Extract text blocks from the response
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

  return NextResponse.json({ results });
}
