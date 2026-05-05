import { getCreator } from '../../lib/creators';
import { loadSkills, formatReferences } from '../../lib/skills';

export const maxDuration = 60;

// Map asset keys to skill names and generation instructions.
// Each ASSET pulls 1+ skills from app/knowledge/skills/* (compiled into skills-bundle.json).
// Skills are concatenated as the system prompt; their references[] are joined into REFERENCE MATERIAL.
const ASSET_CONFIG = {
  launchTimeline: {
    // launch-strategy = the timeline framework. core-four = which channels to phase in when (warm → content → cold → paid).
    skills: ['launch-strategy', 'core-four'],
    instruction: 'Create a detailed week-by-week launch timeline (6-8 weeks) for this creator\'s community/course. Sequence the Core Four channels in the right order (Warm → Free Content → Cold → Paid; never invert). For each week, specify Open-To-Goal targets (e.g. "10 booked discovery calls/day") and Rule-of-100 daily commitments per active channel. Phases: Pre-launch warm-up → Launch week → Post-launch momentum.',
  },
  salesPageCopy: {
    // landing-page + copywriting = layout + voice. hooks = the hero. money-model = the offer architecture. pricing-plays = the tier with anchor.
    skills: ['landing-page', 'copywriting', 'hooks', 'money-model', 'pricing-plays'],
    instruction: 'Write the complete sales page copy for this creator\'s community/course.\n\nMANDATORY structure:\n1. HERO — generate 3 headline variants using the Hooks skill (Conditional + Statement + Narrative types, all under 18 words, all with explicit Call-Out + Value Promise). Pick the strongest as primary.\n2. Problem (PAS) — pain agitation, callout-then-value-promise.\n3. Solution / transformation.\n4. VALUE STACK — render the trim-&-stack table (problem → sexy name → dollar value → delivery vehicle) per hundred-million-offers.\n5. Social proof placeholders.\n6. Guarantee block.\n7. PRICING — always 3 tiers WITH an Ultra-High-Ticket Anchor (5-10× the recommended tier) per pricing-plays Play #9. Include 28-day billing language and annual prepay.\n8. FAQ — pre-empt top 5 objections.\n9. Final CTA — Direct-Buy / Book-Call style depending on price.\n\nMake it conversion-focused and authentic to the creator\'s voice.',
  },
  emailSequence: {
    // email-sequence + hooks (subjects) + closing (objections in mid-sequence) + pricing-plays (RAISE letter for relaunches with existing members).
    skills: ['email-sequence', 'hooks', 'closing', 'pricing-plays'],
    instruction: 'Create a complete email launch sequence with 3 phases:\n1. PRE-LAUNCH (3 emails): Build anticipation, share the story, create waitlist urgency.\n2. LAUNCH (5 emails): Open cart, value stack, social proof, scarcity, last chance.\n3. POST-LAUNCH (3 emails): Welcome/onboarding, quick win, community activation.\n\nFor EVERY email:\n- Subject line: generate 5 hook variants (mixed Hooks types, max 50 chars each — mobile-truncation safe). Pick the strongest as primary.\n- Body: pre-empt at least one objection from the closing skill (Time / Money / Self-doubt / Authority blame).\n\nIF the creator has an existing audience/community at a lower price, add an Email 0 (pre-launch) using the R-A-I-S-E letter framework from pricing-plays.\n\nWrite in the creator\'s language.',
  },
  leadMagnet: {
    // hundred-million-offers + core-four (the literal 7-step lead-magnet method from the Leads book).
    skills: ['hundred-million-offers', 'core-four'],
    instruction: 'Design a lead magnet following the 7-step framework from $100M Leads:\n1. Pick a narrow, specific problem the audience has RIGHT NOW + WHO it\'s for.\n2. Solve THAT problem (not the bigger one — that\'s what the paid offer is for).\n3. Pick the delivery vehicle (template / checklist / training video / quiz / mini-tool).\n4. Test 3 candidate names — pick the one with highest specific-promise weight.\n5. Make it consumable in under 10 minutes (max).\n6. Make it actually good — over-deliver on the narrow promise.\n7. End with a clear next-step CTA into the paid offer.\n\nReturn: Title (3 candidates → pick 1), format, full outline, the landing page copy to capture emails (with 3 hook variants for the headline).',
  },
  adCreative: {
    // ad-creative (legacy generator) + ad-assembly (matrix) + hooks (50 hook bank).
    // The output should be a MATRIX (50 hooks × 5 meats × 3 CTAs), not finished ads.
    skills: ['ad-creative', 'ad-assembly', 'hooks'],
    instruction: 'Output an AD MATRIX for Meta (IG/FB) + TikTok, NOT finished ads. Per the ad-assembly skill:\n\n1. HOOKS — exactly 50 hooks, distributed across the Schwartz Awareness Pyramid (default for cold paid: 20% Most-Aware / 30% Product-Aware / 30% Solution-Aware / 15% Problem-Aware / 5% Unaware). Tag each with awareness level + verbal type from the hooks skill.\n\n2. MEATS — 5 scripts, one per format (Demonstration / Testimonial / Education / Story / Faceless). Each 30-60 sec, with shotlist.\n\n3. CTAs — 3 reusable (Direct-Buy / Lead-Capture / Book-Call). Match offer price.\n\n4. WEEK-1 TEST SET — pick top 3 hooks × 3 meats × matched CTA = 9 starting combinations. Specify which platform for each.\n\n5. EXPANSION HOOK CANDIDATES — list 3 hooks one awareness level BROADER than current best for scaling past the first ceiling.\n\n6. TARGETING + BUDGET — based on creator\'s audience, recommend audiences and budget allocation for a €500-1000 launch budget.\n\nReturn structured by these 6 sections.',
  },
  socialContent: {
    // social-content (calendar engine) + marketing-machine (proof-driven cadence) + hooks (post openers).
    skills: ['social-content', 'marketing-machine', 'hooks'],
    instruction: 'Create a 30-day social content calendar for the launch period using the marketing-machine cadence:\n\nWEEKLY RHYTHM (template):\n- Mon: Screenshot wins compilation (community + chat scrape)\n- Tue: Education clip (founder-led, 30-60s)\n- Wed: Lifecycle clip (call recording, milestone moment)\n- Thu: Education or behind-the-scenes\n- Fri: Community wins compilation (UGC, reviews)\n- Weekend: Quarterly award/competition recap when relevant\n\nFOR EVERY POST:\n- Generate 3 hook variants using the Hooks skill (mixed verbal types).\n- Apply Hook → Retain → Reward structure from the Free Content chapter (in core-four references / hooks).\n- Tag content pillar (4 pillars based on creator\'s niche).\n- Specify platform-specific format (Reels / Stories / Carousels / TikTok / YouTube Shorts).\n- Distribute hooks 70-20-10 (proven / adjacent / new) per the hooks skill.\n\nAlso include: posting times, frequency, and the proof-capture moments (when to harvest UGC for ads).',
  },
  communityActivation: {
    // contagious + storybrand-messaging + marketing-machine (proof + competition mechanics seed virality).
    skills: ['contagious', 'storybrand-messaging', 'marketing-machine'],
    instruction: 'Design the community activation strategy:\n\n1. STORYBRAND — brand script, one-liner, messaging framework for the community.\n2. VIRALITY — apply STEPPS framework to engineer word-of-mouth (Social Currency, Triggers, Emotion, Public, Practical Value, Stories).\n3. MARKETING MACHINE — design the 3 highest-ROI nodes to activate FIRST (typically: Competition + Chat-scrape + Community-scrape per implementation order). Spec the Bonus Unlock mechanic and the 6-Point Testimonial Script tailored to this creator\'s offer.\n4. FIRST 30 DAYS engagement plan: daily prompts, challenges, welcome ritual, quick wins.\n5. GAMIFICATION: levels, badges, milestones — each tied to a Marketing Machine capture moment so wins become content.',
  },
  onboardingFlow: {
    // hooked-ux + improve-retention + lead-nurture (4-touch reminder cadence + 5-outcome scripts + BAMFAM).
    skills: ['hooked-ux', 'improve-retention', 'lead-nurture'],
    instruction: 'Design the member onboarding flow:\n\n1. HOOK MODEL — design the core habit loop (Trigger → Action → Variable Reward → Investment).\n2. RETENTION — define the activation milestone ("aha moment"), time-to-value target, behavior design using B=MAP.\n3. FIRST 7 DAYS step-by-step: Welcome email (immediate) → Profile setup (24h) → First win (48h) → Community intro → First content consumed → First interaction → First result.\n4. AUTOMATED REMINDER CADENCE per lead-nurture: immediate / 24h / 12h / 3h before each scheduled live event or coaching call.\n5. BAMFAM — at end of every onboarding call, the next call is booked before hanging up. Specify which calls trigger BAMFAM.\n6. DROP-OFF PREVENTION — what to do when a member goes silent at each step. Use the Volume cadence from lead-nurture (day-0 → day-7 outreach pattern).\n7. PROOF CAPTURE — schedule the 6-point testimonial ask at the first-win moment (per marketing-machine skill).',
  },
  churnPrevention: {
    // churn-prevention + money-model (Continuity Bonus / Discount / Waived Fee mechanics) + closing (save-objection scripts using blame classification).
    skills: ['churn-prevention', 'money-model', 'closing'],
    instruction: 'Design the churn prevention system:\n\n1. EARLY WARNING SIGNALS — behaviors that predict churn (last login, post engagement, payment retry, support ticket pattern).\n2. CANCEL FLOW — 3-step cancel flow with SAVE OFFERS using money-model levers:\n   - Step 1: Validate-then-transition reply (per closing skill).\n   - Step 2: Continuity Bonus offer ("month X you unlock Y — leaving means losing this") OR Continuity Discount ("if you stay, your rate drops to €X").\n   - Step 3: Downsell Quantity (less coaching) or Downsell Quality (free tier) — the "less rather than nothing" Crazy Eight lever.\n3. DUNNING SEQUENCE — failed payment recovery (3 emails + 1 DM, with empathetic copy).\n4. WIN-BACK CAMPAIGN — for members who cancelled (3 emails over 30 days, leading with Free Goodwill, ending with a soft re-entry offer using R-A-I-S-E logic if re-pricing).\n5. MONTHLY ENGAGEMENT SCORING — Red/Yellow/Green per lead-nurture\'s scoring pattern. Reds get the cancel-flow pre-emptively; Yellows get founder check-in; Greens get the testimonial ask.\n6. SAVE-CALL SCRIPT — when a member books a "I want to cancel" call, use closing skill\'s Self-blame closes (Mechanic / Pain of Change vs Pain of Same / Gameplan Close).',
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
