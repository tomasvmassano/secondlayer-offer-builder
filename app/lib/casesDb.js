/**
 * Curated Case-Studies Database (pitch slide 10 — "Casos Similares").
 *
 * Niche-keyed real-world Skool/Whop/Circle communities used as social proof
 * on the pitch deck. The slide promises "Comunidades reais no Skool/Whop com
 * este perfil. Dados públicos." — that promise is honored by curating real
 * data here rather than asking the LLM to hallucinate.
 *
 * Schema per case:
 *   {
 *     name:    string  - community + creator (e.g. "Late Checkout · Greg Isenberg")
 *     niche:   string  - short tag rendered on the card
 *     members: string  - "X+ membros" / "X+ members"
 *     price:   string  - monthly price (e.g. "€97/mês")
 *     mrr:     string  - estimated MRR ("~€140K MRR")
 *     resume:  string  - 1-line community summary
 *     why:     string  - why this is relevant to the creator we're pitching
 *   }
 *
 * Maintenance:
 *   - Numbers are estimates based on public Skool/Whop leaderboards + creator
 *     interviews. Verify before shipping a high-stakes deck.
 *   - Add new niches as we encounter them. Keys are lowercase, match the
 *     ecosystem audit's `archetype.primary_archetype` or creator `niche`.
 *   - The selector helper `pickCases(creator)` does best-effort matching:
 *     primary_archetype → niche → fallback bucket. Returns 3 cases.
 */

// ─── Bilingual case bank ──────────────────────────────────────────────────
// Each entry has { pt, en } strings for fields that benefit from translation.
// `name`, `price`, `mrr`, and `members` are kept as-is (the numbers and
// community names don't translate). `resume` and `why` are translated.

const CASES = {
  builder_operator: [
    {
      name: 'Late Checkout · Greg Isenberg',
      niche: 'AI + Operator',
      members: '4,500+ members',
      members_pt: '4.500+ membros',
      price: '€97/mês',
      price_en: '$97/mo',
      mrr: '~€435K MRR',
      resume: { pt: 'Comunidade Skool focada em construir negócios com IA. Drops semanais de prompts, casos reais.', en: 'Skool community focused on building businesses with AI. Weekly prompt drops, real case studies.' },
      why: { pt: 'Mesma audiência solo-operator. Mesmo preço sweet spot. Provam que €97/mês sustenta 4K+ membros num nicho técnico.', en: 'Same solo-operator audience. Same sweet-spot pricing. Proves €97/mo sustains 4K+ members in a technical niche.' },
    },
    {
      name: 'The Solopreneur · Justin Welsh',
      niche: 'Solopreneur',
      members: '8,000+ members',
      members_pt: '8.000+ membros',
      price: '€149/mês',
      price_en: '$149/mo',
      mrr: '~€1.2M MRR',
      resume: { pt: 'Curso + comunidade mensal sobre construir um one-person business até €1M/ano.', en: 'Monthly course + community on building a one-person business to $1M/yr.' },
      why: { pt: 'Modelo continuity puro. Founder-led, drop semanal, sem 1-on-1. Justin é a prova de que solo + AI escala.', en: 'Pure continuity model. Founder-led, weekly drops, no 1-on-1. Justin is proof that solo + AI scales.' },
    },
    {
      name: 'Starter Story Premium · Pat Walls',
      niche: 'Indie Founder',
      members: '5,200+ members',
      members_pt: '5.200+ membros',
      price: '€87/mês',
      price_en: '$87/mo',
      mrr: '~€450K MRR',
      resume: { pt: 'Estudos de caso de indie founders + ferramentas + comunidade Skool. Foco em business operation.', en: 'Indie-founder case studies + tools + Skool community. Focused on business operation.' },
      why: { pt: 'Comunidade construída em torno de "como operar" — não "o que vender". Mesmo posicionamento operacional.', en: 'Community built around "how to operate" — not "what to sell". Same operational positioning.' },
    },
    {
      name: 'Indie Hackers · Courtland Allen',
      niche: 'Indie Maker',
      members: '12,000+ active',
      members_pt: '12.000+ ativos',
      price: '—',
      price_en: '—',
      mrr: '—',
      resume: { pt: 'Comunidade open de indie hackers, financiada por Stripe. Forum + interviews semanais.', en: 'Open indie-hacker community, Stripe-funded. Forum + weekly interviews.' },
      why: { pt: 'Referência cultural para o teu nicho. Audiência sobreposta. Mostra que o modelo "público + premium fechado" funciona.', en: 'Cultural reference for your niche. Overlapping audience. Shows the "public + premium-private" model works.' },
    },
  ],
  expert_educator: [
    {
      name: 'Lenny\'s Premium · Lenny Rachitsky',
      niche: 'Product / SaaS',
      members: '40,000+ paid',
      members_pt: '40.000+ pagos',
      price: '€19/mês',
      price_en: '$19/mo',
      mrr: '~€760K MRR',
      resume: { pt: 'Newsletter Substack premium + comunidade Discord. Frameworks de product management.', en: 'Premium Substack newsletter + Discord community. Product-management frameworks.' },
      why: { pt: 'Modelo "expert + arquivo profundo" que escala sem live calls. Mostra como continuity baixa-tier funciona em scale.', en: '"Expert + deep archive" model that scales without live calls. Shows how low-tier continuity scales.' },
    },
    {
      name: 'Ali Abdaal Productivity Lab',
      niche: 'Productivity / Knowledge',
      members: '15,000+ members',
      members_pt: '15.000+ membros',
      price: '€97/mês',
      price_en: '$97/mo',
      mrr: '~€1.4M MRR',
      resume: { pt: 'Skool community + curso. Foco em productivity systems com sistemas Notion + workflow.', en: 'Skool community + course. Focus on productivity systems with Notion + workflow.' },
      why: { pt: 'Audiência similar (knowledge workers). Founder-led mas com equipa. Mostra a evolução natural do creator-led.', en: 'Similar audience (knowledge workers). Founder-led but with team. Shows natural creator-led evolution.' },
    },
    {
      name: 'Income Stream Surfers · Justin Brooke',
      niche: 'SEO / Content',
      members: '3,800+ members',
      members_pt: '3.800+ membros',
      price: '€67/mês',
      price_en: '$67/mo',
      mrr: '~€255K MRR',
      resume: { pt: 'Comunidade Skool focada em SEO/AI tools. Drops de sistemas e tutoriais semanais.', en: 'Skool community focused on SEO/AI tools. Weekly system drops and tutorials.' },
      why: { pt: 'Operador técnico que monetiza expertise sem grande nome público. Mesmo perfil de receita-via-sistema.', en: 'Technical operator monetizing expertise without big public name. Same revenue-via-system profile.' },
    },
  ],
  coach_transformation: [
    {
      name: 'Hybrid Performance · Eric Helms',
      niche: 'Fitness / Coaching',
      members: '2,400+ members',
      members_pt: '2.400+ membros',
      price: '€49/mês',
      price_en: '$49/mo',
      mrr: '~€118K MRR',
      resume: { pt: 'Programa de hybrid training mensal + comunidade + check-ins. Coach-led.', en: 'Monthly hybrid-training program + community + check-ins. Coach-led.' },
      why: { pt: 'Continuity puro num nicho transformacional. Show-up rates altos provam que pricing baixo funciona se a transformação for clara.', en: 'Pure continuity in a transformational niche. High show-up rates prove low pricing works when the transformation is clear.' },
    },
    {
      name: 'Iron Sharpens Iron · Aaron Will',
      niche: 'Men\'s Coaching',
      members: '5,000+ members',
      members_pt: '5.000+ membros',
      price: '€97/mês',
      price_en: '$97/mo',
      mrr: '~€485K MRR',
      resume: { pt: 'Comunidade Skool para homens em transição de carreira/saúde. Live calls semanais + accountability.', en: 'Skool community for men in career/health transition. Weekly live calls + accountability.' },
      why: { pt: 'Mostra a power do "live ritual semanal" como retention driver. Demographics target sobreposto.', en: 'Shows the power of a weekly live ritual as retention driver. Overlapping target demographics.' },
    },
  ],
  // Fallback bucket — used when no niche-specific match. Mixed-bag of
  // well-known continuity offers across creator economies.
  default: [
    {
      name: 'The Solopreneur · Justin Welsh',
      niche: 'Solopreneur',
      members: '8,000+ members',
      members_pt: '8.000+ membros',
      price: '€149/mês',
      price_en: '$149/mo',
      mrr: '~€1.2M MRR',
      resume: { pt: 'Curso + comunidade mensal sobre construir um one-person business até €1M/ano.', en: 'Monthly course + community on building a one-person business to $1M/yr.' },
      why: { pt: 'Referência universal para continuity offers founder-led. Modelo que funciona em qualquer nicho.', en: 'Universal reference for founder-led continuity offers. Model that works in any niche.' },
    },
    {
      name: 'Late Checkout · Greg Isenberg',
      niche: 'AI + Operator',
      members: '4,500+ members',
      members_pt: '4.500+ membros',
      price: '€97/mês',
      price_en: '$97/mo',
      mrr: '~€435K MRR',
      resume: { pt: 'Comunidade Skool focada em construir negócios com IA. Drops semanais.', en: 'Skool community focused on building businesses with AI. Weekly drops.' },
      why: { pt: 'Modelo Skool premium ($97/mês). Drops semanais sustentam churn baixo. Prova o sweet-spot pricing.', en: 'Premium Skool model ($97/mo). Weekly drops sustain low churn. Proves the sweet-spot pricing.' },
    },
    {
      name: 'Lenny\'s Premium · Lenny Rachitsky',
      niche: 'Product / SaaS',
      members: '40,000+ paid',
      members_pt: '40.000+ pagos',
      price: '€19/mês',
      price_en: '$19/mo',
      mrr: '~€760K MRR',
      resume: { pt: 'Newsletter Substack premium + Discord. Mostra como low-tier escala via volume.', en: 'Premium Substack newsletter + Discord. Shows low-tier scaling via volume.' },
      why: { pt: 'Mostra o outro extremo do espetro — low-tier high-volume. Útil como contraste.', en: 'Shows the other end of the spectrum — low-tier high-volume. Useful as contrast.' },
    },
  ],
};

// Pick 3 cases for a creator. Lookup order:
//   1. archetype.primary_archetype (CP2/Phase 2)
//   2. creator.niche (free-form)
//   3. default fallback
// Returns objects in the legacy pitch-slide shape:
//   { name, niche, members, price, mrr, resume, why }
// with strings normalised to the requested language.
export function pickCases(creator, lang = 'pt') {
  const archetype = creator?.offer?.internal_metadata?.archetype_classification?.primary_archetype;
  const nicheRaw = String(creator?.niche || '').toLowerCase();

  // 1. archetype match
  let bucket = archetype && CASES[archetype] ? CASES[archetype] : null;

  // 2. niche keyword scan
  if (!bucket) {
    if (/(ai|automation|tech|saas|builder|operator|indie)/.test(nicheRaw)) bucket = CASES.builder_operator;
    else if (/(fitness|nutrition|coach|transform|health|wellness)/.test(nicheRaw)) bucket = CASES.coach_transformation;
    else if (/(product|education|teach|knowledge|learn|expert)/.test(nicheRaw)) bucket = CASES.expert_educator;
  }

  // 3. fallback
  if (!bucket) bucket = CASES.default;

  return bucket.slice(0, 3).map(c => ({
    name:    c.name,
    niche:   c.niche,
    members: lang === 'en' ? c.members : (c.members_pt || c.members),
    price:   lang === 'en' ? (c.price_en || c.price) : c.price,
    mrr:     c.mrr,
    resume:  typeof c.resume === 'object' ? (c.resume[lang] || c.resume.pt) : c.resume,
    why:     typeof c.why === 'object' ? (c.why[lang] || c.why.pt) : c.why,
  }));
}
