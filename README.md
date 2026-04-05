# Second Layer - Offer Builder

Internal tool for building partnership offers using AI-powered social media intelligence.

## Local Development

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local and add your Anthropic API key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. In the Vercel project settings, add the environment variable:
   - `ANTHROPIC_API_KEY` — your Anthropic API key
4. Click **Deploy**. Vercel auto-detects Next.js and builds with the App Router.

Every push to `main` will trigger a new deployment automatically.

## API Routes

### POST /api/generate

Proxies requests to the Anthropic Messages API.

**Body:**
```json
{
  "system": "Optional system prompt",
  "message": "User message"
}
```

### POST /api/scrape

Scrapes social media intelligence using Anthropic's web search tool.

**Body:**
```json
{
  "urls": [
    { "platform": "instagram", "url": "https://instagram.com/example" }
  ]
}
```
