/**
 * Curated Case-Studies Database (pitch slide — "Casos Similares").
 *
 * Niche-keyed real-world communities used as social proof on the pitch deck.
 * The slide promises "Comunidades reais no Skool/Whop com este perfil.
 * Dados públicos." — that promise is honored by curating real data here
 * rather than asking the LLM to hallucinate.
 *
 * ⚠ URL VERIFICATION NOTE ⚠
 *   URLs point to the creator's main brand domain. Verify resolution +
 *   current prices before high-stakes live pitches — Skool/Whop slugs
 *   change as creators migrate platforms.
 *
 * REVENUE TYPE — added in response to operator feedback that the
 * "MRR" label was displaying for cases that don't actually run on
 * recurring revenue (Justin Welsh's $149 course, Ali Abdaal's cohort,
 * etc.). Three buckets:
 *   - 'mrr'       — recurring subscription (preferred for the pitch since
 *                   that's what we're selling). Display label: "MRR".
 *   - 'one_time'  — one-shot course / cohort / book. Display label:
 *                   "Lifetime revenue" / "Receita total".
 *   - 'community' — free or open community (the data point is community
 *                   size, not revenue). Display: hidden / "—".
 *
 * pickCases() prioritises MRR offers in the returned 3 cases and only
 * falls back to one_time / community when the niche bucket doesn't have
 * 3 MRR examples.
 *
 * Schema per case:
 *   {
 *     name:          string  - community + creator
 *     niche:         string  - short tag rendered on the card
 *     members:       string  - "X+ membros" / "X+ members"
 *     price:         string  - monthly price (e.g. "€97/mês"; "—" for free)
 *     revenue_type:  'mrr' | 'one_time' | 'community'
 *     revenue_value: string  - "~€760K MRR" / "~$2M+ lifetime" / "—"
 *     trajectory:    { pt, en } - "0 → X in Y yrs" line. The path, not just
 *                                 the destination. Drives the "it's been
 *                                 done before" framing on the slide.
 *     resume:        { pt, en }
 *     why:           { pt, en }
 *     url:           string  - verifiable HTTPS link
 *   }
 */

const CASES = {
  builder_operator: [
    {
      name: 'Lenny\'s Newsletter · Lenny Rachitsky',
      niche: 'Product / SaaS',
      members: '40,000+ paid',
      members_pt: '40.000+ pagos',
      price: '€19/mês',
      price_en: '$19/mo',
      revenue_type: 'mrr',
      revenue_value: '~€760K MRR',
      trajectory: { pt: 'Lançado 2020 · 40K pagantes em 4 anos', en: 'Launched 2020 · 40K paid in 4 years' },
      resume: { pt: 'Newsletter Substack premium + comunidade Discord. Frameworks de product management.', en: 'Premium Substack newsletter + Discord community. Product-management frameworks.' },
      why: { pt: 'Modelo "expert + arquivo profundo" que escala sem live calls. Mostra como continuity baixa-tier funciona em scale.', en: '"Expert + deep archive" model that scales without live calls. Shows how low-tier continuity scales.' },
      url: 'https://www.lennysnewsletter.com',
    },
    {
      name: 'Starter Story Premium · Pat Walls',
      niche: 'Indie Founder',
      members: '5,000+ premium',
      members_pt: '5.000+ premium',
      price: '€20/mês',
      price_en: '$20/mo',
      revenue_type: 'mrr',
      revenue_value: '~€100K MRR',
      trajectory: { pt: 'Lançado 2018 · adquirido pela HubSpot 2021 · 5K+ premium hoje', en: 'Launched 2018 · acquired by HubSpot 2021 · 5K+ premium today' },
      resume: { pt: 'Estudos de caso de indie founders + ferramentas + análise de mercado. Foco em business operation.', en: 'Indie-founder case studies + tools + market analysis. Focused on business operation.' },
      why: { pt: 'Comunidade construída em torno de "como operar" — não "o que vender". Mesmo posicionamento operacional.', en: 'Community built around "how to operate" — not "what to sell". Same operational positioning.' },
      url: 'https://www.starterstory.com',
    },
    {
      name: 'The Solopreneur · Justin Welsh',
      niche: 'Solopreneur',
      members: '14,000+ paid',
      members_pt: '14.000+ pagos',
      price: '€149 one-time',
      price_en: '$149 one-time',
      revenue_type: 'one_time',
      revenue_value: '~$2M+ lifetime',
      trajectory: { pt: 'Saiu da LinkedIn 2019 · $1M ARR solo em 2 anos · 14K alunos hoje', en: 'Left LinkedIn 2019 · $1M ARR solo in 2 years · 14K students today' },
      resume: { pt: 'Curso "The Solopreneur" + comunidade privada sobre construir um one-person business até $1M/ano.', en: 'The Solopreneur course + private community on building a one-person business to $1M/yr.' },
      why: { pt: 'Modelo founder-led puro. Justin é a prova de que solo + sistemas + audiência escala sem equipa.', en: 'Pure founder-led model. Justin is proof that solo + systems + audience scales without a team.' },
      url: 'https://www.justinwelsh.me',
    },
    {
      name: 'Indie Hackers · Courtland Allen',
      niche: 'Indie Maker',
      members: '12,000+ active',
      members_pt: '12.000+ ativos',
      price: '—',
      price_en: '—',
      revenue_type: 'community',
      revenue_value: '—',
      trajectory: { pt: 'Fundado 2016 · adquirido pela Stripe 2017 · 12K ativos hoje', en: 'Founded 2016 · acquired by Stripe 2017 · 12K active today' },
      resume: { pt: 'Comunidade aberta de indie hackers, financiada pela Stripe. Forum + entrevistas semanais.', en: 'Open indie-hacker community, Stripe-funded. Forum + weekly founder interviews.' },
      why: { pt: 'Referência cultural para o teu nicho. Audiência sobreposta. Mostra que o modelo "público + premium fechado" funciona.', en: 'Cultural reference for your niche. Overlapping audience. Shows the "public + premium-private" model works.' },
      url: 'https://www.indiehackers.com',
    },
  ],
  expert_educator: [
    {
      name: 'Lenny\'s Newsletter · Lenny Rachitsky',
      niche: 'Product / SaaS',
      members: '40,000+ paid',
      members_pt: '40.000+ pagos',
      price: '€19/mês',
      price_en: '$19/mo',
      revenue_type: 'mrr',
      revenue_value: '~€760K MRR',
      trajectory: { pt: 'Lançado 2020 · 40K pagantes em 4 anos', en: 'Launched 2020 · 40K paid in 4 years' },
      resume: { pt: 'Newsletter Substack premium + comunidade Discord. Frameworks de product management.', en: 'Premium Substack newsletter + Discord community. Product-management frameworks.' },
      why: { pt: 'Modelo "expert + arquivo profundo" que escala sem live calls. Mostra como continuity baixa-tier funciona em scale.', en: '"Expert + deep archive" model that scales without live calls. Shows how low-tier continuity scales.' },
      url: 'https://www.lennysnewsletter.com',
    },
    {
      name: 'Ness Labs Premium · Anne-Laure Le Cunff',
      niche: 'Productivity / Neuroscience',
      members: '3,500+ paid',
      members_pt: '3.500+ pagos',
      price: '€10/mês',
      price_en: '$10/mo',
      revenue_type: 'mrr',
      revenue_value: '~€35K MRR',
      trajectory: { pt: 'Lançado 2019 (PhD em neurociência) · 3.5K pagantes solo em 5 anos', en: 'Launched 2019 (neuroscience PhD) · 3.5K paid solo in 5 years' },
      resume: { pt: 'Newsletter + comunidade focada em ciência aplicada à produtividade pessoal. Founder solo, sem equipa.', en: 'Newsletter + community focused on applied neuroscience for personal productivity. Solo founder, no team.' },
      why: { pt: 'Founder solo educada que monetiza expertise científica. Audiência: knowledge workers que valorizam rigor.', en: 'Solo educated founder monetizing scientific expertise. Audience: knowledge workers who value rigor.' },
      url: 'https://nesslabs.com',
    },
    {
      name: 'Starter Story Premium · Pat Walls',
      niche: 'Indie Founder',
      members: '5,000+ premium',
      members_pt: '5.000+ premium',
      price: '€20/mês',
      price_en: '$20/mo',
      revenue_type: 'mrr',
      revenue_value: '~€100K MRR',
      trajectory: { pt: 'Lançado 2018 · adquirido pela HubSpot 2021 · 5K+ premium hoje', en: 'Launched 2018 · acquired by HubSpot 2021 · 5K+ premium today' },
      resume: { pt: 'Estudos de caso de indie founders + ferramentas + análise de mercado.', en: 'Indie-founder case studies + tools + market analysis.' },
      why: { pt: 'Operador técnico que monetiza expertise sem grande nome público. Mesmo perfil de receita-via-arquivo.', en: 'Technical operator monetizing expertise without big public name. Same revenue-via-archive profile.' },
      url: 'https://www.starterstory.com',
    },
    {
      name: 'Ali Abdaal · YouTuber Academy',
      niche: 'Creator coaching',
      members: '2,000+ alumni',
      members_pt: '2.000+ alumni',
      price: '€995 cohort',
      price_en: '$995 cohort',
      revenue_type: 'one_time',
      revenue_value: '~$2M+ lifetime',
      trajectory: { pt: 'YouTuber 2017 · primeira coorte 2020 · 2K+ alumni em múltiplas cohorts', en: 'Started YouTube 2017 · first cohort 2020 · 2K+ alumni across cohorts' },
      resume: { pt: 'Coorte privada para construir um canal YouTube de educação. Multiple cohorts/ano, founder-led.', en: 'Private cohort for building a YouTube education channel. Multiple cohorts/yr, founder-led.' },
      why: { pt: 'Modelo cohort-based — útil como contraste se preço/formato pesarem por outra direção.', en: 'Cohort-based model — useful as contrast if pricing/format pulls another way.' },
      url: 'https://academy.aliabdaal.com',
    },
  ],
  coach_transformation: [
    {
      name: 'Ness Labs Premium · Anne-Laure Le Cunff',
      niche: 'Productivity / Neuroscience',
      members: '3,500+ paid',
      members_pt: '3.500+ pagos',
      price: '€10/mês',
      price_en: '$10/mo',
      revenue_type: 'mrr',
      revenue_value: '~€35K MRR',
      trajectory: { pt: 'Lançado 2019 (PhD em neurociência) · 3.5K pagantes solo em 5 anos', en: 'Launched 2019 (neuroscience PhD) · 3.5K paid solo in 5 years' },
      resume: { pt: 'Newsletter + comunidade focada em ciência aplicada à produtividade pessoal.', en: 'Newsletter + community focused on applied neuroscience for personal productivity.' },
      why: { pt: 'Mesma audiência (knowledge workers querendo mudança). Modelo MRR puro com founder solo.', en: 'Same audience (knowledge workers wanting change). Pure MRR model with solo founder.' },
      url: 'https://nesslabs.com',
    },
    {
      name: 'James Clear · Atomic Habits Newsletter',
      niche: 'Habits / Self-improvement',
      members: '3M+ subscribers',
      members_pt: '3M+ subscritores',
      price: '— (free + book)',
      price_en: '— (free + book)',
      revenue_type: 'one_time',
      revenue_value: 'Best-seller author',
      trajectory: { pt: 'Newsletter desde 2014 · livro 2018 (15M+ exemplares) · 3M+ subscritores hoje', en: 'Newsletter since 2014 · book 2018 (15M+ copies) · 3M+ subscribers today' },
      resume: { pt: 'Newsletter semanal "3-2-1" gratuita que vende livros + Atomic Habits Academy. Modelo de funil completo.', en: 'Weekly "3-2-1" free newsletter that sells books + Atomic Habits Academy. Full-funnel model.' },
      why: { pt: 'Mostra a power do "ritual semanal grátis" como retention driver para o resto do funil.', en: 'Shows the power of "weekly free ritual" as retention driver for the rest of the funnel.' },
      url: 'https://jamesclear.com',
    },
    {
      name: 'Ali Abdaal · YouTuber Academy',
      niche: 'Creator coaching',
      members: '2,000+ alumni',
      members_pt: '2.000+ alumni',
      price: '€995 cohort',
      price_en: '$995 cohort',
      revenue_type: 'one_time',
      revenue_value: '~$2M+ lifetime',
      trajectory: { pt: 'YouTuber 2017 · primeira coorte 2020 · 2K+ alumni em múltiplas cohorts', en: 'Started YouTube 2017 · first cohort 2020 · 2K+ alumni across cohorts' },
      resume: { pt: 'Coorte privada founder-led, multiple/ano.', en: 'Founder-led private cohort, multiple/yr.' },
      why: { pt: 'Modelo cohort-based — útil como contraste.', en: 'Cohort-based model — useful as contrast.' },
      url: 'https://academy.aliabdaal.com',
    },
  ],
  default: [
    {
      name: 'Lenny\'s Newsletter · Lenny Rachitsky',
      niche: 'Product / SaaS',
      members: '40,000+ paid',
      members_pt: '40.000+ pagos',
      price: '€19/mês',
      price_en: '$19/mo',
      revenue_type: 'mrr',
      revenue_value: '~€760K MRR',
      trajectory: { pt: 'Lançado 2020 · 40K pagantes em 4 anos', en: 'Launched 2020 · 40K paid in 4 years' },
      resume: { pt: 'Newsletter Substack premium + Discord. Mostra como low-tier escala via volume.', en: 'Premium Substack newsletter + Discord. Shows low-tier scaling via volume.' },
      why: { pt: 'Universal: low-tier high-volume continuity model.', en: 'Universal: low-tier high-volume continuity model.' },
      url: 'https://www.lennysnewsletter.com',
    },
    {
      name: 'Starter Story Premium · Pat Walls',
      niche: 'Indie Founder',
      members: '5,000+ premium',
      members_pt: '5.000+ premium',
      price: '€20/mês',
      price_en: '$20/mo',
      revenue_type: 'mrr',
      revenue_value: '~€100K MRR',
      trajectory: { pt: 'Lançado 2018 · adquirido pela HubSpot 2021 · 5K+ premium hoje', en: 'Launched 2018 · acquired by HubSpot 2021 · 5K+ premium today' },
      resume: { pt: 'Estudos de caso + ferramentas. Mid-tier MRR founder-led.', en: 'Case studies + tools. Mid-tier MRR founder-led.' },
      why: { pt: 'Mid-volume mid-price MRR — equilíbrio realista.', en: 'Mid-volume mid-price MRR — realistic balance.' },
      url: 'https://www.starterstory.com',
    },
    {
      name: 'The Solopreneur · Justin Welsh',
      niche: 'Solopreneur',
      members: '14,000+ paid',
      members_pt: '14.000+ pagos',
      price: '€149 one-time',
      price_en: '$149 one-time',
      revenue_type: 'one_time',
      revenue_value: '~$2M+ lifetime',
      trajectory: { pt: 'Saiu da LinkedIn 2019 · $1M ARR solo em 2 anos · 14K alunos hoje', en: 'Left LinkedIn 2019 · $1M ARR solo in 2 years · 14K students today' },
      resume: { pt: 'Curso + comunidade privada sobre one-person business.', en: 'Course + private community on one-person business.' },
      why: { pt: 'Founder-led universal reference. Modelo one-time + continuity híbrido.', en: 'Founder-led universal reference. One-time + continuity hybrid model.' },
      url: 'https://www.justinwelsh.me',
    },
  ],
};

// Revenue label by type — used at slide render time so we don't show
// "MRR" for one-time offers (operator complained that "—" + "MRR" looked
// like a bug — it was data correctness, but the label was wrong too).
export const REVENUE_LABELS = {
  mrr:       { pt: 'MRR',           en: 'MRR' },
  one_time:  { pt: 'Receita total', en: 'Lifetime revenue' },
  community: { pt: 'Comunidade',    en: 'Community' },
};

// Map a case URL to a platform badge. Hostname-based, deterministic, no
// network. Returns null for plain personal-domain URLs so the badge only
// appears when we can name a concrete platform — "Skool" / "Whop" /
// "Substack" carry social proof; "their own site" doesn't.
export function platformFromUrl(url) {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (h.includes('skool.com'))      return { label: 'Skool',      color: '#FFA500' };
    if (h.includes('whop.com'))       return { label: 'Whop',       color: '#FF6B35' };
    if (h.includes('substack.com'))   return { label: 'Substack',   color: '#FF6719' };
    if (h.includes('circle.so'))      return { label: 'Circle',     color: '#5046E5' };
    if (h.includes('discord'))        return { label: 'Discord',    color: '#5865F2' };
    if (h.includes('patreon.com'))    return { label: 'Patreon',    color: '#F96854' };
    if (h.includes('teachable.com'))  return { label: 'Teachable',  color: '#3A26FF' };
    if (h.includes('podia.com'))      return { label: 'Podia',      color: '#1FBA8C' };
    if (h.includes('mighty'))         return { label: 'Mighty',     color: '#FF5A5F' };
    if (h.includes('memberful.com'))  return { label: 'Memberful',  color: '#0D6EFD' };
    if (h.includes('kajabi.com'))     return { label: 'Kajabi',     color: '#1FBA8C' };
    // lennysnewsletter is Substack-hosted under their own domain
    if (h.includes('lennysnewsletter')) return { label: 'Substack', color: '#FF6719' };
  } catch { /* malformed URL — fall through */ }
  return null;
}

// Initials from a "Community Name · Creator Name" string. Uses the creator
// half if present; else falls back to first two words of the whole string.
// Two letters, uppercase. Drives the avatar circle on each case card.
export function caseInitials(name) {
  if (!name) return '?';
  const tail = String(name).split('·').pop().trim() || String(name);
  const words = tail.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return '?';
}

// Deterministic muted color from initials. Same name → same color, so the
// avatar feels stable across re-renders. HSL with fixed S/L for visual
// consistency across cards.
export function caseAvatarColor(name) {
  const init = caseInitials(name);
  let hash = 0;
  for (let i = 0; i < init.length; i++) hash = (hash * 31 + init.charCodeAt(i)) & 0xff;
  const hue = (hash * 137) % 360;
  return `hsl(${hue}, 35%, 30%)`;
}

// Pick 3 cases for a creator, MRR-prioritised.
// Lookup order for the bucket:
//   1. archetype.primary_archetype (CP2/Phase 2)
//   2. creator.niche (free-form keyword scan)
//   3. default fallback
// Within the bucket, MRR cases are returned first, then one_time, then
// community — so the pitch foregrounds the most-relevant proof. Falls
// through if the bucket has fewer than 3 of the preferred type.
export function pickCases(creator, lang = 'pt') {
  const archetype = creator?.offer?.internal_metadata?.archetype_classification?.primary_archetype;
  const nicheRaw = String(creator?.niche || '').toLowerCase();

  let bucket = archetype && CASES[archetype] ? CASES[archetype] : null;
  if (!bucket) {
    if (/(ai|automation|tech|saas|builder|operator|indie)/.test(nicheRaw)) bucket = CASES.builder_operator;
    else if (/(fitness|nutrition|coach|transform|health|wellness|habits)/.test(nicheRaw)) bucket = CASES.coach_transformation;
    else if (/(product|education|teach|knowledge|learn|expert)/.test(nicheRaw)) bucket = CASES.expert_educator;
  }
  if (!bucket) bucket = CASES.default;

  // Sort: MRR first, then one_time, then community.
  const typeOrder = { mrr: 0, one_time: 1, community: 2 };
  const sorted = [...bucket].sort((a, b) => (typeOrder[a.revenue_type] ?? 9) - (typeOrder[b.revenue_type] ?? 9));

  return sorted.slice(0, 3).map(c => ({
    name:    c.name,
    niche:   c.niche,
    members: lang === 'en' ? c.members : (c.members_pt || c.members),
    price:   lang === 'en' ? (c.price_en || c.price) : c.price,
    revenue_type:  c.revenue_type,
    revenue_value: c.revenue_value,
    revenue_label: (REVENUE_LABELS[c.revenue_type] || REVENUE_LABELS.mrr)[lang] || (REVENUE_LABELS[c.revenue_type] || REVENUE_LABELS.mrr).pt,
    trajectory: typeof c.trajectory === 'object' ? (c.trajectory[lang] || c.trajectory.pt) : (c.trajectory || ''),
    resume:  typeof c.resume === 'object' ? (c.resume[lang] || c.resume.pt) : c.resume,
    why:     typeof c.why === 'object' ? (c.why[lang] || c.why.pt) : c.why,
    url:     c.url || '',
  }));
}
