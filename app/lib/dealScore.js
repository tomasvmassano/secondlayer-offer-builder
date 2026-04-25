/**
 * Deal Score Calculator
 * Produces an A/B/C/D grade based on creator metrics.
 */

const NICHE_DB = {
  'imobiliario':       { low: 49, mid: 97,  high: 297, roi: 'Very high', tier: 'A' },
  'investimento':      { low: 49, mid: 97,  high: 297, roi: 'Very high', tier: 'A' },
  'fitness':           { low: 19, mid: 39,  high: 79,  roi: 'High',      tier: 'A' },
  'empreendedorismo':  { low: 49, mid: 97,  high: 247, roi: 'Very high', tier: 'A' },
  'business':          { low: 49, mid: 97,  high: 247, roi: 'Very high', tier: 'A' },
  'nutricao':          { low: 19, mid: 37,  high: 69,  roi: 'High',      tier: 'A' },
  'dietetica':         { low: 19, mid: 37,  high: 69,  roi: 'High',      tier: 'A' },
  'culinaria':         { low: 9,  mid: 24,  high: 49,  roi: 'Medium',    tier: 'A' },
  'gastronomia':       { low: 9,  mid: 24,  high: 49,  roi: 'Medium',    tier: 'A' },
  'financas':          { low: 29, mid: 59,  high: 149, roi: 'Very high', tier: 'A' },
  'educacao':          { low: 19, mid: 39,  high: 97,  roi: 'High',      tier: 'A' },
  'desenvolvimento':   { low: 19, mid: 39,  high: 97,  roi: 'High',      tier: 'A' },
  'saude':             { low: 14, mid: 29,  high: 59,  roi: 'Medium',    tier: 'B' },
  'bem-estar':         { low: 14, mid: 29,  high: 59,  roi: 'Medium',    tier: 'B' },
  'moda':              { low: 9,  mid: 19,  high: 39,  roi: 'Low',       tier: 'B' },
  'estilo':            { low: 9,  mid: 19,  high: 39,  roi: 'Low',       tier: 'B' },
  'viagem':            { low: 14, mid: 29,  high: 69,  roi: 'Medium',    tier: 'B' },
  'fotografia':        { low: 14, mid: 29,  high: 79,  roi: 'High',      tier: 'B' },
  'parentalidade':     { low: 9,  mid: 19,  high: 39,  roi: 'Medium',    tier: 'B' },
  'familia':           { low: 9,  mid: 19,  high: 39,  roi: 'Medium',    tier: 'B' },
  'beleza':            { low: 9,  mid: 19,  high: 39,  roi: 'Low',       tier: 'C' },
  'gaming':            { low: 5,  mid: 12,  high: 25,  roi: 'Low',       tier: 'C' },
  'entretenimento':    { low: 5,  mid: 12,  high: 25,  roi: 'Low',       tier: 'C' },
};

// English → Portuguese alias map so AI-detected niches match NICHE_DB
const NICHE_ALIASES = {
  'real estate':       'imobiliario',
  'property':          'imobiliario',
  'investing':         'investimento',
  'investment':        'investimento',
  'crypto':            'investimento',
  'trading':           'investimento',
  'stocks':            'investimento',
  'fitness':           'fitness',
  'gym':               'fitness',
  'workout':           'fitness',
  'training':          'fitness',
  'crossfit':          'fitness',
  'bodybuilding':      'fitness',
  'entrepreneurship':  'empreendedorismo',
  'entrepreneur':      'empreendedorismo',
  'startup':           'empreendedorismo',
  'business':          'business',
  'marketing':         'business',
  'creator economy':   'business',
  'nutrition':         'nutricao',
  'diet':              'dietetica',
  'dietetics':         'dietetica',
  'healthy eating':    'nutricao',
  'food':              'culinaria',
  'cooking':           'culinaria',
  'baking':            'culinaria',
  'recipe':            'culinaria',
  'culinary':          'culinaria',
  'gastronomy':        'gastronomia',
  'plant based':       'culinaria',
  'vegan':             'culinaria',
  'finance':           'financas',
  'personal finance':  'financas',
  'money':             'financas',
  'education':         'educacao',
  'teaching':          'educacao',
  'learning':          'educacao',
  'personal development': 'desenvolvimento',
  'self improvement':  'desenvolvimento',
  'self-improvement':  'desenvolvimento',
  'mindset':           'desenvolvimento',
  'productivity':      'desenvolvimento',
  'health':            'saude',
  'mental health':     'saude',
  'wellness':          'bem-estar',
  'wellbeing':         'bem-estar',
  'meditation':        'bem-estar',
  'yoga':              'bem-estar',
  'fashion':           'moda',
  'style':             'estilo',
  'outfit':            'moda',
  'travel':            'viagem',
  'photography':       'fotografia',
  'photo':             'fotografia',
  'portrait':          'fotografia',
  'parenting':         'parentalidade',
  'motherhood':        'parentalidade',
  'fatherhood':        'parentalidade',
  'family':            'familia',
  'beauty':            'beleza',
  'skincare':          'beleza',
  'makeup':            'beleza',
  'gaming':            'gaming',
  'entertainment':     'entretenimento',
  'comedy':            'entretenimento',
  'humor':             'entretenimento',
  'lifestyle':         'bem-estar',
  'music':             'entretenimento',
  'dance':             'entretenimento',
  'art':               'fotografia',
  'design':            'fotografia',
};

// Look up pricing for a niche (returns { low, mid, high } or a sensible default).
// Used by the pitch deck + revenue projector to auto-populate €/member.
export function getNichePricing(niche) {
  const matched = matchNiche(niche);
  if (matched) return { low: matched.low, mid: matched.mid, high: matched.high };
  return { low: 19, mid: 39, high: 79 }; // neutral default
}

function matchNiche(niche) {
  if (!niche) return null;
  const lower = niche.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. Direct match against Portuguese NICHE_DB keys
  for (const [key, val] of Object.entries(NICHE_DB)) {
    if (lower.includes(key)) return val;
  }

  // 2. Match via English aliases (check longer phrases first to avoid partial matches)
  const sortedAliases = Object.entries(NICHE_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, dbKey] of sortedAliases) {
    if (lower.includes(alias)) return NICHE_DB[dbKey];
  }

  return null;
}

export function calculateDealScore(creator) {
  const breakdown = {};
  let total = 0;

  // 1. Followers (0-20 points)
  const ig = creator.platforms?.instagram;
  const tk = creator.platforms?.tiktok;
  const yt = creator.platforms?.youtube;
  const primaryFollowers = ig?.followers || tk?.followers || yt?.subscribers || 0;

  const tooltips = {};

  if (primaryFollowers >= 500000) { breakdown.followers = 20; }
  else if (primaryFollowers >= 100000) { breakdown.followers = 17; }
  else if (primaryFollowers >= 50000) { breakdown.followers = 14; }
  else if (primaryFollowers >= 20000) { breakdown.followers = 11; }
  else if (primaryFollowers >= 10000) { breakdown.followers = 8; }
  else if (primaryFollowers >= 5000) { breakdown.followers = 5; }
  else { breakdown.followers = 2; }
  total += breakdown.followers;
  tooltips.followers = `${primaryFollowers.toLocaleString()} followers\n500K+ = 20pts | 100K+ = 17 | 50K+ = 14 | 20K+ = 11 | 10K+ = 8 | 5K+ = 5 | <5K = 2`;

  // 2. Engagement rate (0-25 points) — most important signal
  const engStr = ig?.engagementRate || creator.engagement || '0';
  const engRate = parseFloat(engStr) || 0;

  if (engRate >= 6) { breakdown.engagement = 25; }
  else if (engRate >= 4) { breakdown.engagement = 22; }
  else if (engRate >= 3) { breakdown.engagement = 18; }
  else if (engRate >= 2) { breakdown.engagement = 14; }
  else if (engRate >= 1) { breakdown.engagement = 8; }
  else { breakdown.engagement = 2; }
  total += breakdown.engagement;
  tooltips.engagement = `${engRate}% engagement rate\n6%+ = 25pts (excellent) | 4%+ = 22 | 3%+ = 18 | 2%+ = 14 | 1%+ = 8 | <1% = 2\nMost important signal — weights 25% of total score`;

  // 3. Niche tier (0-20 points)
  const nicheData = matchNiche(creator.niche);
  if (nicheData?.tier === 'A') { breakdown.niche = 20; }
  else if (nicheData?.tier === 'B') { breakdown.niche = 13; }
  else if (nicheData?.tier === 'C') { breakdown.niche = 6; }
  else { breakdown.niche = 10; }
  total += breakdown.niche;
  tooltips.niche = nicheData
    ? `Niche: "${creator.niche}" → Tier ${nicheData.tier} (ROI: ${nicheData.roi})\nPrice range: €${nicheData.low}-${nicheData.high}/mês\nTier A = 20pts | Tier B = 13 | Tier C = 6`
    : `Niche "${creator.niche}" not in database — neutral score (10pts)`;

  // 4. Authenticity / bot score (0-15 points)
  const botScore = ig?.botScore;
  if (botScore != null) {
    if (botScore <= 0.2) { breakdown.authenticity = 15; }
    else if (botScore <= 0.4) { breakdown.authenticity = 11; }
    else if (botScore <= 0.6) { breakdown.authenticity = 6; }
    else { breakdown.authenticity = 1; }
    tooltips.authenticity = `Bot score: ${(botScore * 100).toFixed(0)}% (0=real, 100=bots)\n≤20% = 15pts | ≤40% = 11 | ≤60% = 6 | >60% = 1`;
  } else {
    const ratio = parseFloat(ig?.followerFollowingRatio || '0');
    if (ratio >= 10) { breakdown.authenticity = 13; }
    else if (ratio >= 3) { breakdown.authenticity = 10; }
    else if (ratio >= 1) { breakdown.authenticity = 6; }
    else { breakdown.authenticity = 3; }
    tooltips.authenticity = `No bot data — using follower/following ratio: ${ratio}x\n10x+ = 13pts | 3x+ = 10 | 1x+ = 6 | <1x = 3\nHigh ratio = creator gets followed, doesn't follow back = good sign`;
  }
  total += breakdown.authenticity;

  // 5. Monetization readiness (0-10 points)
  let monetization = 0;
  if (creator.externalUrl) monetization += 3;
  if (creator.isBusinessAccount) monetization += 2;
  if (creator.bioLinks?.length > 0) monetization += 2;
  if (creator.products?.length > 0) monetization += 3;
  breakdown.monetization = Math.min(monetization, 10);
  total += breakdown.monetization;
  const monParts = [];
  if (creator.externalUrl) monParts.push('Bio link (+3)');
  if (creator.isBusinessAccount) monParts.push('Business account (+2)');
  if (creator.bioLinks?.length > 0) monParts.push(`Linktree links: ${creator.bioLinks.length} (+2)`);
  if (creator.products?.length > 0) monParts.push(`Products: ${creator.products.join(', ')} (+3)`);
  tooltips.monetization = monParts.length > 0
    ? monParts.join('\n') + `\nTotal: ${monetization}/10`
    : 'No monetization signals found (0pts)';

  // 6. Multi-platform presence (0-10 points)
  let multiPlatform = 0;
  if (ig?.followers > 0) multiPlatform += 3;
  if (tk?.followers > 0) multiPlatform += 3;
  if (yt?.subscribers > 0) multiPlatform += 4;
  breakdown.multiPlatform = Math.min(multiPlatform, 10);
  total += breakdown.multiPlatform;
  const platParts = [];
  if (ig?.followers > 0) platParts.push(`Instagram: ${ig.followers.toLocaleString()} (+3)`);
  if (tk?.followers > 0) platParts.push(`TikTok: ${tk.followers.toLocaleString()} (+3)`);
  if (yt?.subscribers > 0) platParts.push(`YouTube: ${yt.subscribers.toLocaleString()} (+4)`);
  tooltips.multiPlatform = platParts.length > 0
    ? platParts.join('\n') + '\nYouTube weighs more — longer content = deeper trust'
    : 'No platform data found';

  // Grade
  let grade;
  if (total >= 75) grade = 'A';
  else if (total >= 55) grade = 'B';
  else if (total >= 35) grade = 'C';
  else grade = 'D';

  const gradeColors = {
    A: { bg: '#22c55e18', color: '#22c55e', border: '#22c55e33' },
    B: { bg: '#3b82f618', color: '#3b82f6', border: '#3b82f633' },
    C: { bg: '#eab30818', color: '#eab308', border: '#eab30833' },
    D: { bg: '#ef444418', color: '#ef4444', border: '#ef444433' },
  };

  return {
    grade,
    score: total,
    maxScore: 100,
    colors: gradeColors[grade],
    nicheData,
    breakdown,
    tooltips,
    labels: {
      followers: `Followers (${primaryFollowers.toLocaleString()})`,
      engagement: `Engagement (${engRate}%)`,
      niche: `Niche Tier (${nicheData?.tier || '?'})`,
      authenticity: botScore != null ? `Bot Score (${botScore})` : `F/F Ratio`,
      monetization: `Monetization Readiness`,
      multiPlatform: `Multi-Platform`,
    },
  };
}
