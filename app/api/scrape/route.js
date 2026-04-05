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
                content: `Search the web for information about this ${platform} profile or page: ${url}\n\nProvide a detailed summary of:\n- Account/page name and description\n- Follower/subscriber count if available\n- Recent content themes and posting frequency\n- Engagement patterns\n- Any notable information for crafting a partnership offer`,
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
