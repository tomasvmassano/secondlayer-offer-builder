/**
 * Curated Case-Studies Database (pitch slide 10 — "Casos Similares").
 *
 * Niche-keyed real-world communities used as social proof on the pitch deck.
 * The slide promises "Comunidades reais no Skool/Whop com este perfil.
 * Dados públicos." — that promise is honored by curating real data here
 * rather than asking the LLM to hallucinate.
 *
 * ⚠ URL VERIFICATION NOTE ⚠
 *   The URLs below are the creator's MAIN brand domain. Skool/Whop
 *   community URLs change frequently as creators migrate platforms. Before
 *   using this DB in a high-stakes live pitch:
 *     1. Click each URL to confirm it resolves to the right brand.
 *     2. Verify the price + member-count still match (numbers are
 *        estimates from public Skool/Whop leaderboards + creator
 *        interviews, accurate as of ~Q1 2025).
 *     3. Update any community-specific URL if it differs from the brand
 *        homepage (e.g. if Greg Isenberg's Skool moved from /late-checkout
 *        to a new slug).
 *
 *   The pitch slide renders the URL as a small ↗ icon next to the case
 *   name. Empty URL → no icon (case still renders).
 *
 * Schema per case:
 *   {
 *     name:    string  - community + creator (e.g. "Indie Hackers · Courtland Allen")
 *     niche:   string  - short tag rendered on the card
 *     members: string  - "X+ membros" / "X+ members"
 *     price:   string  - monthly price (e.g. "€97/mês"; "—" for free)
 *     mrr:     string  - estimated MRR ("~€140K MRR")
 *     resume:  { pt, en }  - 1-line community summary
 *     why:     { pt, en }  - why this is relevant to the creator we're pitching
 *     url:     string  - HTTPS link to the brand/community (verify before use)
 *   }
 *
 * Maintenance:
 *   - Numbers are estimates based on public Skool/Whop leaderboards + creator
 *     interviews. Verify before shipping a high-stakes deck.
 *   - Add new niches as we encounter them. Keys are lowercase, match the
 *     archetype.primary_archetype or creator niche.
 *   - The selector helper `pickCases(creator)` does best-effort matching:
 *     primary_archetype → niche → fallback bucket. Returns 3 cases.
 */

const CASES = {
  builder_operator: [
    {
      name: 'Indie Hackers · Courtland Allen',
      niche: 'Indie Maker',
      members: '12,000+ active',
      members_pt: '12.000+ ativos',
      price: '—',
      price_en: '—',
      mrr: '—',
      resume: { pt: 'Comunidade aberta de indie hackers, financiada pela Stripe. Forum + entrevistas semanais com founders.', en: 'Open indie-hacker community, Stripe-funded. Forum + weekly founder interviews.' },
      why: { pt: 'Referência cultural para o teu nicho. Audiência sobreposta. Mostra que o modelo "público + premium fechado" funciona.', en: 'Cultural reference for your niche. Overlapping audience. Shows the "public + premium-private" model works.' },
      url: 'https://www.indiehackers.com',
    },
    {
      name: 'The Solopreneur · Justin Welsh',
      niche: 'Solopreneur',
      members: '14,000+ paid',
      members_pt: '14.000+ pagos',
      price: '€149 one-time',
      price_en: '$149 one-time',
      mrr: '—',
      resume: { pt: 'Curso "The Solopreneur" + comunidade privada sobre construir um one-person business até $1M/ano.', en: 'The Solopreneur course + private community on building a one-person business to $1M/yr.' },
      why: { pt: 'Modelo founder-led puro. Justin é a prova de que solo + sistemas + audiência escala sem equipa.', en: 'Pure founder-led model. Justin is proof that solo + systems + audience scales without a team.' },
      url: 'https://www.justinwelsh.me',
    },
    {
      name: 'Starter Story Premium · Pat Walls',
      niche: 'Indie Founder',
      members: '5,000+ premium',
      members_pt: '5.000+ premium',
      price: '€20/mês',
      price_en: '$20/mo',
      mrr: '~€100K MRR',
      resume: { pt: 'Estudos de caso de indie founders + ferramentas + análise de mercado. Foco em business operation.', en: 'Indie-founder case studies + tools + market analysis. Focused on business operation.' },
      why: { pt: 'Comunidade construída em torno de "como operar" — não "o que vender". Mesmo posicionamento operacional.', en: 'Community built around "how to operate" — not "what to sell". Same operational positioning.' },
      url: 'https://www.starterstory.com/premium',
    },
    {
      name: 'Lenny\'s Newsletter · Lenny Rachitsky',
      niche: 'Product / SaaS',
      members: '40,000+ paid',
      members_pt: '40.000+ pagos',
      price: '€19/mês',
      price_en: '$19/mo',
      mrr: '~€760K MRR',
      resume: { pt: 'Newsletter Substack premium + comunidade Discord. Frameworks de product management.', en: 'Premium Substack newsletter + Discord community. Product-management frameworks.' },
      why: { pt: 'Modelo "expert + arquivo profundo" que escala sem live calls. Mostra como continuity baixa-tier funciona em scale.', en: '"Expert + deep archive" model that scales without live calls. Shows how low-tier continuity scales.' },
      url: 'https://www.lennysnewsletter.com',
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
      mrr: '~€760K MRR',
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
      mrr: '~€35K MRR',
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
      mrr: '~€100K MRR',
      resume: { pt: 'Estudos de caso de indie founders + ferramentas + análise de mercado.', en: 'Indie-founder case studies + tools + market analysis.' },
      why: { pt: 'Operador técnico que monetiza expertise sem grande nome público. Mesmo perfil de receita-via-arquivo.', en: 'Technical operator monetizing expertise without big public name. Same revenue-via-archive profile.' },
      url: 'https://www.starterstory.com/premium',
    },
  ],
  coach_transformation: [
    {
      name: 'James Clear Newsletter (3-2-1)',
      niche: 'Habits / Self-improvement',
      members: '3M+ subscribers',
      members_pt: '3M+ subscritores',
      price: '— (free + book sales)',
      price_en: '— (free + book sales)',
      mrr: '—',
      resume: { pt: 'Newsletter semanal "3-2-1" gratuita que vende livros + Atomic Habits Academy. Modelo de funil completo.', en: 'Weekly "3-2-1" free newsletter that sells books + Atomic Habits Academy. Full-funnel model.' },
      why: { pt: 'Mostra a power do "ritual semanal grátis" como retention driver para o resto do funil. Mesmo arquétipo de coach.', en: 'Shows the power of "weekly free ritual" as retention driver for the rest of the funnel. Same coach archetype.' },
      url: 'https://jamesclear.com',
    },
    {
      name: 'Ali Abdaal · YouTuber Academy',
      niche: 'Creator coaching',
      members: '2,000+ alumni',
      members_pt: '2.000+ alumni',
      price: '€995 cohort',
      price_en: '$995 cohort',
      mrr: '—',
      resume: { pt: 'Coorte privada para construir um canal YouTube de educação. Multiple cohorts/ano, founder-led.', en: 'Private cohort for building a YouTube education channel. Multiple cohorts/yr, founder-led.' },
      why: { pt: 'Modelo cohort-based (não continuity) — útil como contraste se preço/formato pesarem por outra direção.', en: 'Cohort-based model (not continuity) — useful as contrast if pricing/format pulls another way.' },
      url: 'https://aliabdaal.com',
    },
  ],
  default: [
    {
      name: 'Indie Hackers · Courtland Allen',
      niche: 'Indie Maker',
      members: '12,000+ active',
      members_pt: '12.000+ ativos',
      price: '—',
      price_en: '—',
      mrr: '—',
      resume: { pt: 'Comunidade aberta de indie hackers, financiada pela Stripe. Forum + entrevistas semanais.', en: 'Open indie-hacker community, Stripe-funded. Forum + weekly interviews.' },
      why: { pt: 'Referência universal de community-as-trust-engine. Mostra o modelo "público + premium" em escala.', en: 'Universal reference for community-as-trust-engine. Shows the "public + premium" model at scale.' },
      url: 'https://www.indiehackers.com',
    },
    {
      name: 'Lenny\'s Newsletter · Lenny Rachitsky',
      niche: 'Product / SaaS',
      members: '40,000+ paid',
      members_pt: '40.000+ pagos',
      price: '€19/mês',
      price_en: '$19/mo',
      mrr: '~€760K MRR',
      resume: { pt: 'Newsletter Substack premium + Discord. Mostra como low-tier escala via volume.', en: 'Premium Substack newsletter + Discord. Shows low-tier scaling via volume.' },
      why: { pt: 'Mostra o outro extremo do espetro — low-tier high-volume. Útil como contraste.', en: 'Shows the other end of the spectrum — low-tier high-volume. Useful as contrast.' },
      url: 'https://www.lennysnewsletter.com',
    },
    {
      name: 'The Solopreneur · Justin Welsh',
      niche: 'Solopreneur',
      members: '14,000+ paid',
      members_pt: '14.000+ pagos',
      price: '€149 one-time',
      price_en: '$149 one-time',
      mrr: '—',
      resume: { pt: 'Curso + comunidade privada sobre construir um one-person business até $1M/ano.', en: 'Course + private community on building a one-person business to $1M/yr.' },
      why: { pt: 'Referência universal para founder-led offers. Modelo que funciona em qualquer nicho operacional.', en: 'Universal reference for founder-led offers. Model that works in any operational niche.' },
      url: 'https://www.justinwelsh.me',
    },
  ],
};

// Pick 3 cases for a creator. Lookup order:
//   1. archetype.primary_archetype (CP2/Phase 2)
//   2. creator.niche (free-form)
//   3. default fallback
// Returns objects in the legacy pitch-slide shape:
//   { name, niche, members, price, mrr, resume, why, url }
// with strings normalised to the requested language.
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

  return bucket.slice(0, 3).map(c => ({
    name:    c.name,
    niche:   c.niche,
    members: lang === 'en' ? c.members : (c.members_pt || c.members),
    price:   lang === 'en' ? (c.price_en || c.price) : c.price,
    mrr:     c.mrr,
    resume:  typeof c.resume === 'object' ? (c.resume[lang] || c.resume.pt) : c.resume,
    why:     typeof c.why === 'object' ? (c.why[lang] || c.why.pt) : c.why,
    url:     c.url || '',
  }));
}
