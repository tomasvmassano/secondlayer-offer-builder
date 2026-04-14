import { getCreator } from '../../lib/creators';
import { loadSkills, formatReferences } from '../../lib/skills';

export const maxDuration = 60;

// Map asset keys to skill names and generation instructions
const ASSET_CONFIG = {
  launchTimeline: {
    skills: ['launch-strategy'],
    instruction: 'Create a detailed week-by-week launch timeline (6-8 weeks) for this creator\'s community/course. Include specific tasks, milestones, and channel priorities for each week. Phases: Pre-launch warm-up → Launch week → Post-launch momentum.',
  },
  salesPageCopy: {
    skills: ['landing-page', 'copywriting'],
    instruction: 'Write the complete sales page copy for this creator\'s community/course. Include: Hero headline + subheadline, problem section (PAS), solution/transformation, value stack with perceived values, social proof placeholders, guarantee, pricing section, FAQ, and final CTA. Make it conversion-focused and authentic to the creator\'s voice.',
  },
  emailSequence: {
    skills: ['email-sequence'],
    instruction: 'Create a complete email launch sequence with 3 phases:\n1. PRE-LAUNCH (3 emails): Build anticipation, share the story, create waitlist urgency\n2. LAUNCH (5 emails): Open cart, value stack, social proof, scarcity, last chance\n3. POST-LAUNCH (3 emails): Welcome/onboarding, quick win, community activation\nFor each email: Subject line + full body copy. Write in the creator\'s language.',
  },
  leadMagnet: {
    skills: ['hundred-million-offers'],
    instruction: 'Design a lead magnet using the "salty pretzel" strategy from $100M Leads. The lead magnet should:\n1. Solve a narrow, specific problem the audience has RIGHT NOW\n2. Be consumable in under 10 minutes\n3. Create desire for the full offer\n4. Include: Title, format (PDF/video/quiz/template), outline, and the copy for the landing page to capture emails.',
  },
  adCreative: {
    skills: ['ad-creative'],
    instruction: 'Create ad creative for Meta (Instagram/Facebook) and TikTok:\n1. 3 ad hooks (pattern interrupt, question, bold claim)\n2. Full ad copy for each hook (primary text + headline + description)\n3. Visual direction for each ad (what the image/video should show)\n4. Targeting suggestions based on the creator\'s audience\n5. Budget allocation recommendations for a €500-1000 launch budget.',
  },
  socialContent: {
    skills: ['social-content'],
    instruction: 'Create a 30-day social content calendar for the launch period. Include:\n- 4 content pillars based on the creator\'s niche\n- Daily post suggestions with hooks and captions\n- Mix of: educational, behind-the-scenes, social proof, direct CTA\n- Platform-specific formats (Reels, Stories, Carousels, TikTok)\n- Posting times and frequency recommendations.',
  },
  communityActivation: {
    skills: ['contagious', 'storybrand-messaging'],
    instruction: 'Design the community activation strategy:\n1. STORYBRAND: Brand script, one-liner, and messaging framework for the community\n2. VIRALITY: Apply STEPPS framework to engineer word-of-mouth (Social Currency, Triggers, Emotion, Public, Practical Value, Stories)\n3. First 30 days engagement plan: daily prompts, challenges, welcome ritual, quick wins\n4. Gamification elements: levels, badges, milestones.',
  },
  onboardingFlow: {
    skills: ['hooked-ux', 'improve-retention'],
    instruction: 'Design the member onboarding flow:\n1. HOOK MODEL: Design the core habit loop (Trigger → Action → Variable Reward → Investment)\n2. RETENTION: Define the activation milestone (the "aha moment"), time-to-value target, and behavior design using B=MAP\n3. First 7 days step-by-step: Welcome email → Profile setup → First win → Community intro → First content consumed → First interaction → First result\n4. Drop-off prevention: what to do when someone goes silent at each step.',
  },
  churnPrevention: {
    skills: ['churn-prevention'],
    instruction: 'Design the churn prevention system:\n1. Early warning signals: what behaviors predict churn\n2. Cancel flow: 3-step cancel flow with save offers\n3. Dunning sequence: failed payment recovery (3 emails + 1 DM)\n4. Win-back campaign: for members who cancelled (3 emails over 30 days)\n5. Monthly engagement scoring: how to identify at-risk members before they cancel.',
  },
};

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'No API key' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { creatorId, assetKey } = body;
  if (!creatorId || !assetKey) {
    return new Response(JSON.stringify({ error: 'Missing creatorId or assetKey' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const config = ASSET_CONFIG[assetKey];
  if (!config) {
    return new Response(JSON.stringify({ error: `Unknown asset: ${assetKey}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // Load creator
    const creator = await getCreator(creatorId);
    if (!creator) return new Response(JSON.stringify({ error: 'Creator not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    // Load skills + references — FULL context now (streaming = no timeout)
    const { systemPrompt, references } = loadSkills(config.skills);
    const refsContext = references.length > 0 ? formatReferences(references, 30000) : '';

    // Build creator context
    const ae = creator.audienceEstimate || {};
    const offer = creator.offer || {};
    const platforms = creator.platforms || {};

    let creatorContext = `## CREATOR PROFILE\n\n`;
    creatorContext += `Name: ${creator.name}\n`;
    creatorContext += `Niche: ${creator.niche}\n`;
    creatorContext += `Primary Platform: ${creator.primaryPlatform}\n`;
    creatorContext += `Bio: ${creator.bio || 'N/A'}\n`;
    creatorContext += `Engagement: ${creator.engagement || 'N/A'}\n`;
    if (platforms.instagram) creatorContext += `Instagram: ${platforms.instagram.followers?.toLocaleString() || 0} followers\n`;
    if (platforms.tiktok) creatorContext += `TikTok: ${platforms.tiktok.followers?.toLocaleString() || 0} followers\n`;
    if (platforms.youtube) creatorContext += `YouTube: ${platforms.youtube.subscribers?.toLocaleString() || 0} subscribers\n`;
    creatorContext += `Products: ${creator.products?.join(', ') || 'None'}\n`;
    creatorContext += `Reputation: ${creator.reputation || 'N/A'}\n`;
    creatorContext += `\n## AUDIENCE\n`;
    creatorContext += `Gender: ${ae.gender || 'Unknown'}\n`;
    creatorContext += `Age: ${ae.age || 'Unknown'}\n`;
    creatorContext += `Location: ${ae.location || 'Unknown'}\n`;
    creatorContext += `Language: ${ae.language || 'Unknown'}\n`;
    creatorContext += `Interests: ${ae.interests?.join(', ') || 'Unknown'}\n`;

    if (offer.raw) {
      const promiseMatch = offer.raw.match(/(?:Core Promise|Promessa)[:\s]*"?([^"\n]+)"?/i);
      const priceMatch = offer.raw.match(/RECOMMENDED MONTHLY PRICE:\s*€?\s*(\d+)/i);
      creatorContext += `\n## OFFER (already created)\n`;
      if (promiseMatch) creatorContext += `Core Promise: ${promiseMatch[1].trim()}\n`;
      if (priceMatch) creatorContext += `Price: €${priceMatch[1]}/month\n`;
      if (offer.parsed?.offer) creatorContext += `\nOffer Summary:\n${offer.parsed.offer.slice(0, 3000)}\n`;
    }

    // Meeting notes context
    const meetingNotes = Object.entries(creator.meeting || {}).filter(([, v]) => v?.trim()).map(([k, v]) => `${k}: ${v}`).join('\n');
    if (meetingNotes) creatorContext += `\n## MEETING NOTES\n${meetingNotes}\n`;

    // Build the message — include references for maximum quality
    const lang = (ae.language || '').toLowerCase().includes('portugu') ? 'Portuguese' : 'English';
    let userMessage = `${config.instruction}\n\n${creatorContext}`;
    if (refsContext) userMessage += `\n\n---\n\n## REFERENCE MATERIAL\n\n${refsContext}`;
    userMessage += `\n\n---\nGenerate the asset now. Be specific to this creator — use their real data. Write in ${lang}. Be thorough and strategic.`;

    // Full system prompt — no truncation needed with streaming
    const fullSystem = 'You are a world-class marketing strategist for Second Layer, an agency that builds communities/courses for content creators in Portugal and Dubai. EUR currency. Be specific, strategic, and use real creator data. Apply the frameworks from the reference material.\n\n' + systemPrompt;

    // Stream from Anthropic
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        stream: true,
        system: fullSystem,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!r.ok) {
      const errData = await r.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: errData.error?.message || 'Generation failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Create a TransformStream to convert Anthropic SSE to our own SSE format
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
                } else if (parsed.type === 'message_stop') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, generatedAt: new Date().toISOString() })}\n\n`));
                } else if (parsed.type === 'error') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: parsed.error?.message || 'Stream error' })}\n\n`));
                }
              } catch {}
            }
          }
          // Final done event in case message_stop wasn't received
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, generatedAt: new Date().toISOString() })}\n\n`));
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
}
