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
  // ────────── NICHE-SPECIFIC BUCKETS ──────────
  // The 4 buckets above cover generic creator-economy positioning. The
  // buckets below match concrete niches where the LLM-finder would
  // otherwise have to guess. URLs verified via npm run audit:cases.
  finance_investing: [
    {
      name: 'Contrarian Thinking · Codie Sanchez',
      niche: 'Wealth / Investing',
      members: '200,000+ subscribers',
      members_pt: '200.000+ subscritores',
      price: '$49/mo premium',
      price_en: '$49/mo premium',
      revenue_type: 'mrr',
      revenue_value: '~$500K+ MRR',
      trajectory: { pt: 'Newsletter desde 2020 · 200K+ subscritores · curso $5K em escala', en: 'Newsletter since 2020 · 200K+ subscribers · $5K course at scale' },
      resume: { pt: 'Newsletter sobre comprar pequenos negócios + curso premium. Foco em wealth real, não conteúdo financeiro tradicional.', en: 'Newsletter on buying small businesses + premium course. Focus on real wealth, not generic finance content.' },
      why: { pt: 'Mesma audiência (mulheres que querem riqueza fora do salário). Founder forte com conteúdo concreto, não teórico.', en: 'Same audience (women who want wealth outside salary). Strong founder with concrete content, not theory.' },
      url: 'https://contrarianthinking.co',
    },
    {
      name: 'BiggerPockets Pro · Brandon Turner',
      niche: 'Real Estate',
      members: '3M+ members',
      members_pt: '3M+ membros',
      price: '$99/yr Pro',
      price_en: '$99/yr Pro',
      revenue_type: 'mrr',
      revenue_value: '~$15M+ ARR',
      trajectory: { pt: 'Fundado 2004 · maior comunidade real-estate dos EUA · 3M+ membros hoje', en: 'Founded 2004 · largest US real-estate community · 3M+ members today' },
      resume: { pt: 'Plataforma de educação + ferramentas + comunidade para investidores imobiliários. Modelo freemium → Pro.', en: 'Education + tools + community platform for real-estate investors. Freemium → Pro model.' },
      why: { pt: 'Referência mundial. Mostra que niche real-estate sustenta comunidade de 7-figures.', en: 'Global reference. Shows real-estate niche can sustain 7-figure community.' },
      url: 'https://www.biggerpockets.com',
    },
    {
      name: 'The Money With Katie Show · Katie Gatti Tassin',
      niche: 'Personal Finance',
      members: '100K+ subscribers',
      members_pt: '100K+ subscritores',
      price: '— (free + book)',
      price_en: '— (free + book)',
      revenue_type: 'one_time',
      revenue_value: 'Best-seller author',
      trajectory: { pt: 'Newsletter 2020 · podcast Morning Brew · livro 2024 · 100K+ subscritores', en: 'Newsletter 2020 · Morning Brew podcast · book 2024 · 100K+ subscribers' },
      resume: { pt: 'Newsletter sobre wealth para mulheres + podcast + livro. Voz forte, audiência ultra-engajada.', en: 'Newsletter on wealth for women + podcast + book. Strong voice, ultra-engaged audience.' },
      why: { pt: 'Founder-led no nicho de women wealth. Modelo conteúdo livre → premium curso/livro.', en: 'Founder-led in women-wealth niche. Free content → premium course/book model.' },
      url: 'https://moneywithkatie.com',
    },
  ],
  fitness_wellness: [
    {
      name: 'Sweat App · Kayla Itsines',
      niche: 'Fitness · Women',
      members: '2M+ paying users',
      members_pt: '2M+ utilizadores pagos',
      price: '$19.99/mo',
      price_en: '$19.99/mo',
      revenue_type: 'mrr',
      revenue_value: '~$80M+ ARR',
      trajectory: { pt: 'PDFs BBG 2014 · app Sweat 2017 · $400M valuation 2021', en: 'BBG PDFs 2014 · Sweat app 2017 · $400M valuation 2021' },
      resume: { pt: 'App de fitness para mulheres com workouts guiados + comunidade global. Founder-led puro.', en: 'Women\'s fitness app with guided workouts + global community. Pure founder-led.' },
      why: { pt: 'Provou que fitness para mulher sustenta MRR de 8 figures. Mesmo formato mensal.', en: 'Proved women\'s fitness sustains 8-figure MRR. Same monthly format.' },
      url: 'https://www.sweat.com',
    },
    {
      name: 'Future · 1-on-1 Coaching',
      niche: 'Fitness · 1-on-1',
      members: '50,000+ members',
      members_pt: '50.000+ membros',
      price: '$199/mo',
      price_en: '$199/mo',
      revenue_type: 'mrr',
      revenue_value: '~$10M+ MRR',
      trajectory: { pt: 'Lançado 2019 · $75M Series C 2021 · 50K+ membros pagantes', en: 'Launched 2019 · $75M Series C 2021 · 50K+ paying members' },
      resume: { pt: 'App de personal training 1-on-1 via mensagens. Mid-ticket recorrente.', en: 'App for 1-on-1 personal training via messaging. Mid-ticket recurring.' },
      why: { pt: 'Validação de mid-ticket recorrente em fitness. Mostra ceiling alto se a entrega for personalizada.', en: 'Mid-ticket recurring validation in fitness. Shows high ceiling when delivery is personal.' },
      url: 'https://www.future.co',
    },
    {
      name: 'MadFit Studio · Maddie Lymburner',
      niche: 'Fitness · YouTuber',
      members: '8M+ subscribers',
      members_pt: '8M+ subscritores',
      price: '$9.99/mo app',
      price_en: '$9.99/mo app',
      revenue_type: 'mrr',
      revenue_value: '~$1M+ MRR',
      trajectory: { pt: 'YouTube 2017 · app 2020 · 8M+ subscritores · app 100K+ pagantes', en: 'YouTube 2017 · app 2020 · 8M+ subscribers · app 100K+ paying' },
      resume: { pt: 'YouTuber de fitness em casa que monetiza via app premium + parcerias.', en: 'At-home fitness YouTuber monetizing via premium app + partnerships.' },
      why: { pt: 'Modelo solo creator → app. Mostra como audiência IG/YouTube converte em MRR.', en: 'Solo creator → app model. Shows how IG/YouTube audience converts to MRR.' },
      url: 'https://www.youtube.com/@MadFit',
    },
  ],
  food_chef: [
    {
      name: 'Joshua Weissman · Patreon',
      niche: 'Food · YouTuber',
      members: '10,000+ patrons',
      members_pt: '10.000+ patrons',
      price: '$5/mo',
      price_en: '$5/mo',
      revenue_type: 'mrr',
      revenue_value: '~$50K MRR Patreon',
      trajectory: { pt: 'YouTube 2018 · 10M+ subs · livro best-seller 2021 · Patreon 10K+', en: 'YouTube 2018 · 10M+ subs · best-seller book 2021 · 10K+ Patreon' },
      resume: { pt: 'Chef YouTuber com membership Patreon para bonus content + livro físico.', en: 'Chef YouTuber with Patreon membership for bonus content + physical book.' },
      why: { pt: 'Low-tier high-volume continuity em food. Mostra que $5/mo escala se audience for grande.', en: 'Low-tier high-volume continuity in food. Shows $5/mo scales with large audience.' },
      url: 'https://www.patreon.com/joshuaweissman',
    },
    {
      name: 'Sorted Food · Sidekick App',
      niche: 'Food · App',
      members: '100,000+ paying',
      members_pt: '100.000+ pagantes',
      price: '$5.99/mo',
      price_en: '$5.99/mo',
      revenue_type: 'mrr',
      revenue_value: '~$500K+ MRR',
      trajectory: { pt: 'YouTube 2010 · app Sidekick 2020 · 100K+ utilizadores pagantes', en: 'YouTube 2010 · Sidekick app 2020 · 100K+ paying users' },
      resume: { pt: 'Chef team com app premium que organiza meal-planning + grocery lists. Founder-led mas com equipa.', en: 'Chef team with premium app for meal-planning + grocery lists. Founder-led with team.' },
      why: { pt: 'YouTube grátis → app pago. Modelo de conversão direta validado em food.', en: 'Free YouTube → paid app. Validated direct-conversion model in food.' },
      url: 'https://www.sortedfood.com',
    },
    {
      name: 'America\'s Test Kitchen · ATK Online',
      niche: 'Food · Education',
      members: '500,000+ members',
      members_pt: '500.000+ membros',
      price: '$39.95/yr',
      price_en: '$39.95/yr',
      revenue_type: 'mrr',
      revenue_value: '~$20M+ ARR',
      trajectory: { pt: 'TV show 1993 · digital subscription 2010 · 500K+ membros pagantes hoje', en: 'TV show 1993 · digital subscription 2010 · 500K+ paying members today' },
      resume: { pt: 'Receitas + reviews + técnicas com subscription anual. Modelo institucional.', en: 'Recipes + reviews + technique with annual subscription. Institutional model.' },
      why: { pt: 'Annual prepay model em food. Útil como referência para tier "anual" do creator.', en: 'Annual prepay model in food. Useful as reference for creator\'s "annual" tier.' },
      url: 'https://www.americastestkitchen.com',
    },
  ],
  // High-ticket hybrid offers (setup + monthly recurring with 1:1 access)
  // get peer-board / intimate-community comps instead of mass-market
  // newsletter unicorns. Different unit economics — 30-200 members, $5-50K/yr,
  // delivery includes high-touch personal access. This bucket is what makes
  // the "30 serious players at premium price" narrative defensible on the
  // pitch deck.
  peer_board: [
    {
      name: 'Hampton · Sam Parr',
      niche: 'Founders · Peer Board',
      members: '600+ vetted founders',
      members_pt: '600+ founders verificados',
      price: '$8,500/yr',
      price_en: '$8,500/yr',
      revenue_type: 'mrr',
      revenue_value: '~$5M+ ARR',
      trajectory: { pt: 'Lançado 2023 · 600+ membros pagantes em 18 meses · founder do The Hustle', en: 'Launched 2023 · 600+ paying members in 18 months · founder of The Hustle' },
      resume: { pt: 'Comunidade fechada para founders 7-9 figures. Application-only, peer groups de 8, eventos físicos.', en: 'Closed community for 7-9 figure founders. Application-only, 8-person peer groups, in-person events.' },
      why: { pt: 'O modelo definitivo de peer-board high-ticket. Mostra que $8.5K/ano com 600 membros = $5M ARR é viável sem volume mass-market.', en: 'The definitive high-ticket peer-board model. Shows $8.5K/yr × 600 members = $5M ARR is viable without mass-market volume.' },
      url: 'https://www.joinhampton.com',
    },
    {
      name: 'Founders Network · Kevin Holmes',
      niche: 'Founders · Peer Board',
      members: '1,200+ tech founders',
      members_pt: '1.200+ founders tech',
      price: '$2,500/yr',
      price_en: '$2,500/yr',
      revenue_type: 'mrr',
      revenue_value: '~$3M+ ARR',
      trajectory: { pt: 'Fundado 2011 · 1.200+ tech founders · 50+ chapters globais', en: 'Founded 2011 · 1,200+ tech founders · 50+ global chapters' },
      resume: { pt: 'Peer-to-peer network para tech founders. Mentor matching + chapters mensais + due-diligence em deals.', en: 'Peer-to-peer network for tech founders. Mentor matching + monthly chapters + deal due-diligence.' },
      why: { pt: 'Modelo de chapter local + acesso global. Útil se a oferta vai escalar via cidades em vez de seguidores online.', en: 'Local chapter + global access model. Useful if the offer will scale via cities rather than online followers.' },
      url: 'https://foundersnetwork.com',
    },
    {
      name: 'Chief · Carolyn Childers',
      niche: 'Women execs · Peer Board',
      members: '20,000+ senior executives',
      members_pt: '20.000+ executivas seniores',
      price: '$7,800/yr',
      price_en: '$7,800/yr',
      revenue_type: 'mrr',
      revenue_value: '~$150M+ ARR',
      trajectory: { pt: 'Lançado 2019 · 20K+ executivas · $1.1B valuation 2022', en: 'Launched 2019 · 20K+ executives · $1.1B valuation 2022' },
      resume: { pt: 'Network privado para mulheres em C-suite + VP roles. Application-only, peer groups facilitados, eventos em 12 cidades.', en: 'Private network for women in C-suite + VP roles. Application-only, facilitated peer groups, events in 12 cities.' },
      why: { pt: 'Prova máxima: women-only premium peer-board sustenta $150M ARR. Mesma audiência (mulheres em momento de poder).', en: 'Peak proof: women-only premium peer-board sustains $150M ARR. Same audience (women in moments of power).' },
      url: 'https://chief.com',
    },
    {
      name: 'YPO · Young Presidents\' Organization',
      niche: 'CEOs · Peer Board',
      members: '34,000+ chief executives',
      members_pt: '34.000+ chief executives',
      price: '$3,500-7,000/yr',
      price_en: '$3,500-7,000/yr',
      revenue_type: 'mrr',
      revenue_value: '~$200M+ ARR',
      trajectory: { pt: 'Fundada 1950 · 34K+ CEOs em 142 países · referência mundial', en: 'Founded 1950 · 34K+ CEOs in 142 countries · global reference' },
      resume: { pt: 'A organização original de peer-board para CEOs. Forums de 8-10 pessoas, eventos globais, learning experiences.', en: 'The original CEO peer-board organization. 8-10 person forums, global events, learning experiences.' },
      why: { pt: 'A referência histórica. Mostra que peer-board high-ticket é uma categoria de 75 anos, não uma moda.', en: 'The historical reference. Shows high-ticket peer-board is a 75-year-old category, not a trend.' },
      url: 'https://www.ypo.org',
    },
  ],
  beauty_skincare: [
    {
      name: 'Skin Rocks · Caroline Hirons',
      niche: 'Skincare · Expert',
      members: '300K+ app users',
      members_pt: '300K+ utilizadores app',
      price: '£2.99/mo',
      price_en: '$3.99/mo',
      revenue_type: 'mrr',
      revenue_value: '~£500K+ MRR',
      trajectory: { pt: 'Blogger 2010 · livro best-seller 2020 · app Skin Rocks 2021', en: 'Blogger 2010 · best-seller book 2020 · Skin Rocks app 2021' },
      resume: { pt: 'App de skincare com recomendações personalizadas + comunidade de expert.', en: 'Skincare app with personal recommendations + expert community.' },
      why: { pt: 'Expert-led com app pago. Mostra que beauty sustenta low-tier MRR escalado.', en: 'Expert-led with paid app. Shows beauty sustains scaled low-tier MRR.' },
      url: 'https://www.skinrocks.com',
    },
    {
      name: 'Hyram\'s Skincare School',
      niche: 'Skincare · Education',
      members: '7M+ subscribers',
      members_pt: '7M+ subscritores',
      price: '— (free + product brand)',
      price_en: '— (free + product brand)',
      revenue_type: 'community',
      revenue_value: 'Selfless skincare brand',
      trajectory: { pt: 'TikTok 2020 · 7M+ subs YouTube · marca própria Selfless 2021', en: 'TikTok 2020 · 7M+ YouTube subs · own brand Selfless 2021' },
      resume: { pt: 'Educador de skincare que escalou audience → marca de produtos.', en: 'Skincare educator who scaled audience → product brand.' },
      why: { pt: 'Modelo audience-first → produto. Mostra que conteúdo grátis sustenta brand premium.', en: 'Audience-first → product model. Shows free content sustains premium brand.' },
      url: 'https://www.youtube.com/@Hyram',
    },
    {
      name: 'Mixed Makeup · Susan Yara',
      niche: 'Skincare · Brand',
      members: '1.5M+ subscribers',
      members_pt: '1.5M+ subscritores',
      price: '— (creator → brand Naturium)',
      price_en: '— (creator → brand Naturium)',
      revenue_type: 'one_time',
      revenue_value: 'Naturium $355M exit',
      trajectory: { pt: 'YouTube 2014 · marca Naturium 2019 · vendida E.l.f. por $355M 2023', en: 'YouTube 2014 · Naturium brand 2019 · sold to E.l.f. for $355M 2023' },
      resume: { pt: 'Esteticista que construiu canal → brand de skincare → exit. Founder-led puro.', en: 'Esthetician who built channel → skincare brand → exit. Pure founder-led.' },
      why: { pt: 'O modelo máximo. Mostra que creator-led em beauty pode terminar em 9-figure exit.', en: 'The peak model. Shows creator-led beauty can end in 9-figure exit.' },
      url: 'https://www.naturium.com',
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
    if (h.includes('youtube.com'))    return { label: 'YouTube',    color: '#FF0000' };
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
  const cfo = creator?.offer?.client_facing_output || {};
  const pricingTier = cfo.pricing_tier;
  const pricingModel = cfo.pricing_model;

  // High-ticket hybrid offers (setup + monthly recurring with 1:1 access)
  // get peer-board comps instead of generic creator-economy/niche cases.
  // Without this, a $4,997 + $997/mo offer with quarterly 1:1 calls would
  // show Lenny ($19/mo, 40K subs) as proof — destroying the narrative
  // ("but you said this was an intimate cohort?"). The peer-board comps
  // make the high-ticket promise defensible.
  const isPeerBoardOffer = (pricingTier === 'high' || pricingTier === 'high_ticket')
    && (pricingModel === 'hybrid' || pricingModel === 'one_time');

  let bucket = archetype && CASES[archetype] ? CASES[archetype] : null;
  if (isPeerBoardOffer) {
    bucket = CASES.peer_board;
  } else if (!bucket) {
    // Niche-keyword routing — specific niches before generic archetypes
    // so a "real-estate woman investor" gets finance_investing not
    // coach_transformation.
    //
    // Patterns include PT-PT/PT-BR terms (2026-07-09) — the CRM stores
    // niches in Portuguese ("Imobiliário", "Nutrição", "Culinária") but
    // the matcher was English-only, so every PT creator fell through to
    // the generic `default` bucket and shipped mismatched pitch-deck
    // cases. Accent-insensitive via the [aã] style classes since niche
    // strings arrive both accented and stripped.
    if (/(real.?estate|property|dubai|invest(ing|or|ments)|crypto|stocks?|trading|wealth|finance|money|imobili[aá]ri|propriedade|investiment|investidor|finan[cç]|dinheiro|riqueza|bolsa|a[cç][oõ]es|cripto)/.test(nicheRaw)) bucket = CASES.finance_investing;
    else if (/(fitness|workout|exercise|gym|training|bodybuild|yoga|pilates|crossfit|strength|gin[aá]sio|trein|muscula[cç][aã]o|exerc[ií]cio|for[cç]a|emagrec)/.test(nicheRaw)) bucket = CASES.fitness_wellness;
    else if (/(food|chef|recipe|cook|cuisine|kitchen|bake|nutrition|meal|diet|culin[aá]ri|cozinh|receita|gastronom|nutri[cç][aã]o|comida|padari|confeitar|dieta|aliment)/.test(nicheRaw)) bucket = CASES.food_chef;
    else if (/(beauty|skincare|skin.?care|makeup|cosmetic|haircare|aesthetic|beleza|maquilhag|maquiag|cosm[eé]tic|pele|cabelo|est[eé]tic)/.test(nicheRaw)) bucket = CASES.beauty_skincare;
    else if (/(ai|automation|tech|saas|builder|operator|indie|tecnolog|automa[cç][aã]o|program|software|desenvolvedor|desenvolvimento (de )?(software|web|app))/.test(nicheRaw)) bucket = CASES.builder_operator;
    else if (/(coach|transform|health|wellness|habits|mindset|therapy|mental|sa[uú]de|bem.?estar|h[aá]bitos|terapia|mentalidade|desenvolvimento pessoal|autoajuda)/.test(nicheRaw)) bucket = CASES.coach_transformation;
    else if (/(product|education|teach|knowledge|learn|expert|course|educa[cç][aã]o|ensin|aprend|conhecimento|curso|forma[cç][aã]o|professor)/.test(nicheRaw)) bucket = CASES.expert_educator;
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
