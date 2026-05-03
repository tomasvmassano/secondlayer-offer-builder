"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { calculateDealScore } from "../../lib/dealScore";
import { SCENARIOS as REVENUE_SCENARIOS, calculateSteadyMRR as sharedCalcMRR } from "../../lib/revenue";
import { renderMd, parseOutput, extractAudience } from "../../offer-builder/lib/shared";
import { OFFER_SYSTEM_PROMPT } from "../../lib/systemPrompt";
import WorkspaceDashboard from "./workspace/WorkspaceDashboard";

const LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAAlCAAAAAAi6fkeAAAAAmJLR0QA/4ePzL8AAAAHdElNRQfqBAUPLQic+FFWAAAMFklEQVRYw9WZa5RVxZXHf1V17u3m0djIw+ahIMjwUERNWhF1RE2MGXVgotEYkYUzLsaMOk5MUNFgcAZxEoKDS8UHiHGJ6FLBKGrQJqCiYAMqKCgSlIciCA1N87qPc6r+8+He7ttgs2Y+gGtmf7nrVu29q/5Vu/brGAAwgmOP67D3q7VA2Q9eE4ebOp7QoWu/kwcNX3zYNTcnAyMX5CQlX0354TlzNx72BSzDazZIqq9k/LRp99gjhqP9PGnl9dUDzhpbJ+lJ3BFYpeyDOHkVNkrbj4R6AJN6U/6ZCICK2jj5JdHhX8OyROE27IdxvOYIAXHcqLiukpS1Nk11oqEc/rs3dNoVwmDMR9JfjxAQY1d6/aloTobVSSfMETitv5O+ag1HCEgERl36oG2msHnrP229ncPvteBCsXS/DYeaNhaDCAIwHLgF0/jXWEwjU2ncGhOBUYdyH3VSKE7tWI3zhx2Gt+dj5nMoIJZQXNOYwLcOsgmGL3BZqTTufKDwqnPB6azKBlOYbNhcOiQTMAql/whDCaU1zQeMNSEU2GjGhEPGxif0M34hh8IR6DLguM7Ubf1snWyw7QPZTGm6VTnUgw2+w2m9KxvWv7+9cCJt0mSy1qdOH3A0AG2/CXk93uiq2lcU99VoyaYJxkGrN70kA65p9iC2ohYzWmG1o+U3Yjn3pV2SJGUXXoCNFtXtWJoqTb+zo+4RnOP4R7+RJNVN7YzF8ciOHbcYrvlUhQtyPK58ooOcroV2Vz02b/59pxWQOKgaPePV15+4uMRw4p1P/3nB/T8qYLU9fjjmDykc7W947oVri/ANlP/kifl/voo5ITxI1CIQyzg1kpeuhtsUdG7xDCzVki4izZU7m9jWV2Mdz0i/ZZKUT7KFxXru9kms65ojcXS6p+GLu3/+mnLnYsHSe0b2g3F/f/Hrer7cgIGhNXrt2otuy2v+sRw9edHGjDSXNFfslaSbcYDF/OJrP2vUmH0//VQajmsJiOU6xcrX/G7M2IfXKBf2dKfr7jg8WgTi+H3wn0aWEQrKvjz+1gc+UV47+5HiKe+vv1yJ5HcUNV2l2CcaVUJi+elGPRJBt32ag8Nww26NBBiZaCzO0nqqchcDnJHVqnYV1/5mjbLJTyx36InfNuSSJRhwnLBAS3sDl2/drYbOmBaAGCq3x37FIADKpiqr0fC0/Ja2RYbU2qBxmIHZWO8MBEjflMupNoqYqfDoJu2bNqzvMY3Hf4fyPtHIRiSWCdJESEcDYl+Ds0xVdjA2cmUr49xbRHSr1e7vETmbYmGiu4Argt9Vxe27quElhbcwOM7eqoVlRJHrnFVYgGnpjTguC7nsyUQuiiKiTT5MgqHK67Lipf6tQrYXzJf/oA3OOQeX+byugZmKM/pk0AHK7lXeJ0VZHPdJL+NMxL9Kk0kzTRpBCijbKj2E6bJG4UpSQGSmBL/KlkX3hDCPK/aeQJmrCeExnOWsPVrfGYeh214f7iRqCUjEvdKaoo9I8ap0P859FMJsLOB4IIRX4Qx5fyYpAJNmpnytZabyYcfxpJwxJSQPK+999kwsOG5RXFeFtRy1wef7wW3ys4kAy/AFD1Wa9GKFWYXri/i9QkMnWCqN6JodQoqyTQXYvbYrOR8HlpO8D4OxtGhaJ5w39FRjXeQM8HHQFMr5N/ndVRig1cagy2Fy0HslkcEh5PsxSxmNI3WANsfTihNt6miM5XSf06+IHMyWboTTEp/p09yvTlK+oVvBHzseDWFvd3pmQqbL8luIDCcmyhyHS70nTScCHJdKm8qB/yFFKT91lnKaQoqqBq/RRDguVPiqDbwbwoPp1ul0Op1Ol6U7bg+6mmeV5PscFBaMtXOVxPojzrjl8l8flYJ2Lyh/MxFvKjzTGBCsSZlBSU6/a/KOrwdtO5prpNkTa4iIGK2whIjbFe/qYgwQMT6EWQWBFoCYFNDr4lunz1vrpbymEDmeCmEhBsf0oMmY8i/ld36x/osirc/m/XieldY2+SfT9Nt6uZIkGQBXKqOJEF2zTW8OIcU5inVRqUaxvKBkX49GyfR6hVp4MsRzVneyBsvzIUzEdG2IdV9ByvC2NOrQQBjwhw/2FgLE1rqkAOQchdzfYGm7JSSDoMNOeTWnoMd5VqHm25m6pU+Dz+lOzKIQZ87+0WNb9MbF4BzTQ9jerhniHplELxUVWE5K8mESrb5QJvkHHNB6s3QeTFCc74sFLL0yyh5f0NBSHPlVRlK8ftGsCVdVvSFNIcLYFUF3UMYwhXewVG6X37+zRPV1DQ/zjPRi0wHfVd24xYiJyoTn6JcPIfvRqjn/3B2wEH0mLaCZX/gXZZpiTsQvlQ/VnB7yerXwsM+WtlZQviFoUWNS8BuFZUUNLbjff5TXupsGtAHgraApRDhuUlhpHbOCriMi+qvC5I5VHYvUqaqqS3tmSi80AVlxYePlWHNKiPU6o5QNd3cBsA4MPbI+zChZlmNmiON+RSlDbdACuDXkfTUWIu4KYQ6crVy4gwgwps0mH+4tIv/2jVRsSZIPOwG4KGUXFIAYOu8K4Qw6bA91HTCWmqAHDzaiZkBsWdfyxsOWtu5z2kNfGTN3i3XOBI+JaF/mzdamG3GBXibauqGQyFoNqfaMgx+YaMkyE8BzPqYGhkhmGQKcbjg2MfNRi3Wn5dSq4P5je5kBnyShorCQ3LY/wQh+3JGXdjhZlsEQnClS+c9GjOzRvP6zXTqd3MxqnFhFJVZZg/cCqxhBs1TeizZoS7bxwdylaOq7dKyWeRoHRlXfM8lC6G5c+BKBTXqN96m65YSiEmGNbdyRcaZzMPrCxQIi9R2YFPYjpsMwO1z8ERF4xfhTzvGRJMnp9GeeerLNAUD6aFhj2WJN71bBzGMfgYpCrIxCu6vZmXWmW4HJWF1aQVZmT8GyIn/Zhfb9X0ecWcn+V/BgGdyWz9YaO1gu5BBWqYfXY2obnEYVIolRrNDkfWJlrDc9feQiZ5LU1LSXIgvBLP6QY0dV8/G7JhDMe+8bTa2MrXMuSrgziRd80ry6sf35/hU+Xdzk6BDV1LLCBDMs2Mg5khNX9ufrdehMgzUmUrhvrGe11BoBUXLcA2bd8IzlAlH7ZaEyO09aJD06yAd3DGkX9PqqT5zeMv6hc/MOQOnePUvUq2c2OE3olfeJ1xnzzzfOtErygA0zjL+vyswMFjDhdhuftHBI8N4nR0+/0KcmH2iij8TZb04Baw38PK/dfeHoOp/ffylAekw8gRRjtF+jAWj13Oq2MFRJfQdSLqJimVb0wGJXhFCoZwyLgkby8CsjlAkvAD2XLGZD0EX811JjDKz0sc82o73ZKS8rq/qZd429f1GszJrEb/73qzAYOtYHhX3dCxZkGa9Y4S8Tb/z1jM3KalohjW/yWvMlxTe0A6rGJ6q/AGsZISXJ8zdfP3Vb7hqcMeWLley/rXenAWM2v9EKY3lIeghg0FrNOApr6OsV+hf92Iokt/gva1qVfamc3po0W0vL2+3O599f+lEhFK3WwTS1544mU2u45HplYj2HA8cM7Q9zGp2qY2xSEprmbHRAHMk++7Pb31N2+fyVkub2L9RQV2+UJOUe64YDQ+WTWUnS5hvAgOHObfrg7jte3FFzHhgc/5TJ1JricuMkLWoP3/9MkjQpIr1S0outCyf7bn3dzua0beeD9J9diOtfP96P7mslPVKISGf4vC5pcvyW6ufqJUmZN4cDjsfq659sDAP/eTvQ75KhPbWxdt6yQk1vQ8V5/VI71yzf09T16DO4a/nOD99VsUFBxyGnVe79fOGGYj+jfWv21zda67CuH7+DQW1+3Dd8/vZWbOj/i71zl1CQrTw4YzSZ/eK4gcem937+UT3Ot7+kcsvb2wDnL3rNrB+QLT3oQNXAnq3iLavWFZS1LSe3p2nalTQ3pvWNDt8d3HdwB/2aQ7UkTVMSZ0sjh6QmNdY047O8Ik1o3oe29mCBkgrnC/IBc0Djp9QsKw2U5jHWgEoMzTtqrjHsOFNkMbYUib4NqMhhVGiGGAtBNjj1/CTtB645oBXWcoPu/zpNUph3BNrQ3ylVnJhufW0mrwuOyBeO74wMfbLrNimvuf/PL8TQW1LQx8eYw/9d4LsF0nVdLt72eOf//feN/waj4NX4IhohZQAAAB50RVh0aWNjOmNvcHlyaWdodABHb29nbGUgSW5jLiAyMDE2rAszOAAAABR0RVh0aWNjOmRlc2NyaXB0aW9uAHNSR0K2kHMHAAAAAElFTkSuQmCC";

const MEETING_QUESTIONS = [
  { key: "brandDealPct", label: "Que percentagem vem de brand deals vs produtos próprios?" },
  { key: "previousSales", label: "Já vendeste algo diretamente? O quê, a que preço, quantos?" },
  { key: "followerQuestions", label: "Que perguntas os teus seguidores te fazem mais?" },
  { key: "topContent", label: "Que tipo de conteúdo costuma ter mais alcance? E mais engagement?" },
  { key: "dmTopics", label: "Sobre o que te mandam DMs?" },
  { key: "audienceProblem", label: "Se pudesses resolver um problema da tua audiência, qual seria?" },
  { key: "emailList", label: "Tens lista de email? Quantos subscritores?" },
  { key: "storyViewRate", label: "Qual é a média de views nos stories?" },
  { key: "exclusivity", label: "Tens algum contrato existente ou exclusividade?" },
];

const TABS = [
  { key: "perfil", label: "Perfil" },
  { key: "dm", label: "DM Writer" },
  { key: "oferta", label: "Oferta" },
  { key: "launch", label: "Launch" },
  { key: "pitch", label: "Pitch" },
];

const LAUNCH_PHASES = [
  { phase: "Pre-Launch", assets: [
    { key: "launchTimeline", label: "Launch Timeline", desc: "Plano semana a semana para o lançamento" },
    { key: "salesPageCopy", label: "Sales Page Copy", desc: "Copy completo para a página de vendas" },
    { key: "emailSequence", label: "Email Sequence", desc: "Sequência de emails: pre-launch + launch + onboarding" },
    { key: "leadMagnet", label: "Lead Magnet", desc: "Design do lead magnet (salty pretzel strategy)" },
  ]},
  { phase: "Launch", assets: [
    { key: "adCreative", label: "Ad Creative", desc: "Copy e direcção visual para Meta + TikTok ads" },
    { key: "socialContent", label: "Social Content", desc: "Calendário de conteúdo de 30 dias" },
    { key: "communityActivation", label: "Community Activation", desc: "Estratégia de ativação e viralidade" },
  ]},
  { phase: "Post-Launch", assets: [
    { key: "onboardingFlow", label: "Onboarding Flow", desc: "Fluxo de onboarding + habit loop design" },
    { key: "churnPrevention", label: "Churn Prevention", desc: "Sistema anti-churn + win-back campaigns" },
  ]},
];

const OFFER_STEPS = [
  { section: "Creator Profile", icon: "01", fields: [
    { key: "creator_name", label: "Creator Name", type: "text" },
    { key: "niche", label: "Creator's Niche", type: "text" },
    { key: "platforms", label: "Platforms & Audience Size", type: "text" },
    { key: "engagement", label: "Engagement Rate / Avg Views", type: "text" },
    { key: "primary_platform", label: "Primary Platform", type: "select", options: ["Instagram", "TikTok", "YouTube"] },
    { key: "language", label: "Output Language", type: "select", options: ["English", "Português"] },
  ]},
  { section: "Social Profiles", icon: "02", fields: [
    { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/username", type: "text" },
    { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@username", type: "text" },
    { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@channel", type: "text" },
  ]},
  { section: "Audience Analysis", icon: "03", fields: [
    { key: "audience_demo", label: "Core Audience Demographics", placeholder: "e.g. Women 25-35, Portugal, middle income", type: "text" },
    { key: "audience_problem", label: "Main Problem / Desire", placeholder: "What does this audience want that the creator solves for free?", type: "textarea" },
  ]},
  { section: "Business Parameters", icon: "04", fields: [
    { key: "format", label: "Delivery Format", placeholder: "Skool community, Course, Membership, Hybrid", type: "text" },
    { key: "price_range", label: "Target Price Range", placeholder: "e.g. 39 EUR/mês", type: "text" },
    { key: "creator_capacity", label: "Creator Involvement", placeholder: "e.g. 2 hours/week, weekly live call, fully hands-off", type: "text" },
    { key: "credibility", label: "Unique Credibility Factor", placeholder: "Credentials, results, story, unique method", type: "textarea" },
  ]},
  { section: "Team Notes", icon: "05", fields: [
    { key: "guidelines", label: "Additional Context", placeholder: "Constraints, preferences, or notes from the team", type: "textarea" },
  ]},
];

function suggestFormat(dealScore, engagement) {
  const tier = dealScore?.nicheData?.tier;
  const eng = parseFloat(engagement) || 0;
  if (tier === 'A' && eng >= 3) return "Skool community (recomendado)";
  if (tier === 'A') return "Hybrid: curso + community (recomendado)";
  if (tier === 'B') return "Hybrid: curso + community";
  return "Curso online";
}

function formatFollowers(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

const metricCardStyle = { padding: "12px 16px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8, minWidth: 0 };
const metricLabelStyle = { fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 };
const metricValueStyle = { fontSize: 16, fontWeight: 700, color: "#f5f5f5" };
const sectionTitleStyle = { fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" };
const inputStyle = { width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "#f5f5f5", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "vertical" };

function CreatorProfilePageImpl({ params: paramsPromise }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forcedCrmView = searchParams?.get('view') === 'crm';
  const initialTab = searchParams?.get('tab') || 'perfil';
  const [params, setParams] = useState(null);
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [tab, setTab] = useState(initialTab);
  const [editName, setEditName] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const nameRef = useRef(null);

  // DM Writer state
  const [dmLoading, setDmLoading] = useState(false);
  const [dmError, setDmError] = useState(null);
  const [dmTemplate, setDmTemplate] = useState("A");
  const [dmNotes, setDmNotes] = useState("");
  const [dmInputs, setDmInputs] = useState({});
  const [rewritingDm, setRewritingDm] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyResult, setReplyResult] = useState(null);
  const [replyError, setReplyError] = useState(null);
  const [revenuePrice, setRevenuePrice] = useState(null);
  const [revenueCommission, setRevenueCommission] = useState(30);
  const [engagementRate, setEngagementRate] = useState(null);
  // Hydrate revenue inputs from creator record on load (single source of truth)
  useEffect(() => {
    if (!creator) return;
    if (revenuePrice == null && creator.revenuePrice != null) setRevenuePrice(creator.revenuePrice);
    if (creator.revenueCommission != null) setRevenueCommission(creator.revenueCommission);
    if (engagementRate == null && creator.revenueEngagement != null) setEngagementRate(creator.revenueEngagement);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creator?.id]);
  // Debounced save-back so the Pitch deck reads the same numbers
  useEffect(() => {
    if (!params?.id || !creator) return;
    const handle = setTimeout(() => {
      const payload = {};
      if (revenuePrice != null) payload.revenuePrice = revenuePrice;
      if (engagementRate != null) payload.revenueEngagement = engagementRate;
      payload.revenueCommission = revenueCommission;
      fetch(`/api/creators/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(handle);
  }, [revenuePrice, revenueCommission, engagementRate, params?.id, creator?.id]);
  const [findingSimilar, setFindingSimilar] = useState(false);
  const [similarResult, setSimilarResult] = useState("");

  // Launch state
  const [launchGenerating, setLaunchGenerating] = useState(null);
  const [launchError, setLaunchError] = useState(null);
  const [launchExpanded, setLaunchExpanded] = useState(null);
  const [launchStreamText, setLaunchStreamText] = useState("");
  const [launchEditing, setLaunchEditing] = useState(null);
  const [launchEditContent, setLaunchEditContent] = useState("");

  // Offer Builder state
  const [offerForm, setOfferForm] = useState({});
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerError, setOfferError] = useState(null);
  const [offerTab, setOfferTab] = useState("offer");
  const [offerStep, setOfferStep] = useState(0);

  useEffect(() => { Promise.resolve(paramsPromise).then(setParams); }, [paramsPromise]);

  const fetchCreator = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/creators/${id}`);
      if (!res.ok) throw new Error("Creator não encontrado");
      const data = await res.json();
      setCreator(data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (params?.id) fetchCreator(params.id); }, [params, fetchCreator]);

  // Auto-fill offer form when creator loads
  useEffect(() => {
    if (!creator || offerForm._filled) return;
    let ds = null;
    try { ds = calculateDealScore(creator); } catch (e) { /* ignore */ }
    const ae = creator.audienceEstimate || {};
    const fmtPlat = (p) => {
      const parts = [];
      if (p?.instagram?.followers) parts.push(`Instagram ${p.instagram.followers.toLocaleString()}`);
      if (p?.tiktok?.followers) parts.push(`TikTok ${p.tiktok.followers.toLocaleString()}`);
      if (p?.youtube?.subscribers) parts.push(`YouTube ${p.youtube.subscribers.toLocaleString()}`);
      return parts.join(", ");
    };
    setOfferForm({
      _filled: true,
      creator_name: creator.name || "",
      niche: creator.niche || "",
      platforms: fmtPlat(creator.platforms),
      engagement: creator.engagement || "",
      primary_platform: creator.primaryPlatform || "Instagram",
      language: (ae.language || "").toLowerCase().includes("portugu") ? "Português" : "English",
      instagram: creator.platforms?.instagram?.url || "",
      tiktok: creator.tiktokUrl || creator.platforms?.tiktok?.url || "",
      youtube: creator.youtubeUrl || creator.platforms?.youtube?.url || "",
      audience_demo: [ae.gender, ae.age, ae.location].filter(Boolean).join(", "),
      format: suggestFormat(ds, creator.engagement),
      price_range: ds?.nicheData ? `€${ds.nicheData.mid}/mês` : "",
      credibility: [creator.reputation, creator.products?.length ? "Produtos: " + creator.products.join(", ") : ""].filter(Boolean).join("\n"),
    });
  }, [creator, offerForm._filled]);

  // Auto-fill DM inputs when creator loads
  useEffect(() => {
    if (!creator || dmInputs._filled) return;
    const ig = creator.platforms?.instagram;
    const firstName = (creator.name || "").split(" ")[0];
    const handle = ig?.url ? "@" + ig.url.split("/").filter(Boolean).pop() : "";
    const followers = ig?.followers || 0;
    let buraco = "";
    const hasProducts = creator.products?.length > 0;
    const hasBioLinks = creator.bioLinks?.length > 0;
    if (!hasProducts && !hasBioLinks && !creator.externalUrl) buraco = "nao tens um sitio teu onde as pessoas te possam seguir fora do Instagram";
    else if (!hasProducts) buraco = "nao tens nenhum produto proprio";
    else if (!hasBioLinks && !creator.externalUrl) buraco = "nao tens presenca fora das redes sociais";
    setDmInputs({
      _filled: true,
      primeiro_nome: firstName,
      handle_instagram: handle,
      seguidores: followers ? followers.toLocaleString() : "",
      nicho: creator.niche || "",
      como_cheguei: "",
      reacao_pessoal: "",
      observacao_dor: buraco,
    });
  }, [creator, dmInputs._filled]);

  const patchCreator = useCallback(async (updates) => {
    if (!params?.id) return;
    setSaving("A guardar...");
    try {
      const res = await fetch(`/api/creators/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
      if (!res.ok) throw new Error("Erro ao guardar");
      const data = await res.json();
      setCreator(data);
      setSaving("Guardado!");
      setTimeout(() => setSaving(""), 2000);
    } catch { setSaving("Erro ao guardar"); setTimeout(() => setSaving(""), 3000); }
  }, [params]);

  const handleDelete = useCallback(async () => {
    if (!params?.id || !window.confirm("Tens a certeza que queres eliminar este creator?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/creators/${params.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro");
      router.push("/creators");
    } catch { setDeleting(false); alert("Erro ao eliminar."); }
  }, [params, router]);

  // — DM Writer generate —
  const generateDM = useCallback(async () => {
    if (!creator) return;
    setDmLoading(true); setDmError(null);
    try {
      const r = await fetch("/api/dm-writer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: dmTemplate,
          inputs: {
            primeiro_nome: dmInputs.primeiro_nome || "",
            handle_instagram: dmInputs.handle_instagram || "",
            seguidores: dmInputs.seguidores || "",
            nicho: dmInputs.nicho || "",
            como_cheguei: dmInputs.como_cheguei || "",
            reacao_pessoal: dmInputs.reacao_pessoal || "",
            observacao_dor: dmInputs.observacao_dor || "",
          },
          notes: dmNotes,
          creatorProfile: {
            name: creator.name,
            niche: creator.niche,
            bio: creator.bio,
            engagement: creator.engagement,
            isVerified: creator.isVerified,
            isBusinessAccount: creator.isBusinessAccount,
            products: creator.products,
            bioLinks: creator.bioLinks,
            externalUrl: creator.externalUrl,
            reputation: creator.reputation,
            research: creator.research,
            platforms: creator.platforms,
            primaryLanguage: creator.primaryLanguage,
            intelligence: creator.intelligence,
            audienceEstimate: creator.audienceEstimate,
          },
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      const data = await r.json();
      await patchCreator({ dmSequence: { ...data, generatedAt: new Date().toISOString() } });
      if (data.inputs) setDmInputs({ _filled: true, ...data.inputs });
    } catch (e) { setDmError(e.message); } finally { setDmLoading(false); }
  }, [creator, dmTemplate, dmInputs, dmNotes, patchCreator]);

  // — DM Reply handler —
  const handleReply = useCallback(async () => {
    if (!replyText.trim() || !creator?.dmSequence) return;
    setReplyLoading(true); setReplyError(null); setReplyResult(null);
    try {
      const r = await fetch("/api/dm-reply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorReply: replyText,
          originalDm: creator.dmSequence.dm || "",
          creatorName: creator.name,
          buraco: creator.dmSequence.inputs?.observacao_dor || creator.dmSequence.inputs?.buraco_identificado || "",
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      const data = await r.json();
      setReplyResult(data);
    } catch (e) { setReplyError(e.message); } finally { setReplyLoading(false); }
  }, [replyText, creator, patchCreator]);

  const findSimilar = useCallback(async () => {
    if (!params?.id || findingSimilar) return;
    setFindingSimilar(true); setSimilarResult("");
    try {
      const r = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: params.id, max: 5 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Erro");
      const parts = [`${data.queued || 0} qualificados`];
      if (data.dismissedNiche) parts.push(`${data.dismissedNiche} fora do nicho`);
      if (data.dismissedLanguage) parts.push(`${data.dismissedLanguage} idioma errado`);
      if (data.dismissedNoBusiness) parts.push(`${data.dismissedNoBusiness} sem monetização`);
      if (data.dismissedLowTier) parts.push(`${data.dismissedLowTier} C/D tier`);
      if (data.dismissedOutOfRange) {
        const rng = [];
        if (data.tooSmall) rng.push(`${data.tooSmall} <50K`);
        if (data.tooBig) rng.push(`${data.tooBig} too big`);
        parts.push(`${data.dismissedOutOfRange} fora do range${rng.length ? ` (${rng.join(", ")})` : ""}`);
      }
      if (data.failed) parts.push(`${data.failed} falharam`);
      const d = data.drops || {};
      let msg = parts.join(" · ");
      const totalDismissed = (data.dismissedLowTier || 0) + (data.dismissedOutOfRange || 0) + (data.dismissedLanguage || 0) + (data.dismissedNiche || 0) + (data.dismissedNoBusiness || 0);
      if ((data.queued || 0) === 0 && totalDismissed === 0) {
        if (d.totalRelated === 0) msg = "Nenhum similar no perfil (precisa re-scrape o creator)";
        else msg = `Sem candidatos novos: ${d.totalRelated} encontrados, ${d.inCRM || 0} já no CRM, ${d.dismissed || 0} dispensados antes, ${d.inQueue || 0} em queue`;
      }
      setSimilarResult(msg);
      setTimeout(() => setSimilarResult(""), 20000);
    } catch (e) {
      setSimilarResult(`Erro: ${e.message}`);
    } finally {
      setFindingSimilar(false);
    }
  }, [params, findingSimilar]);

  // — Launch asset generate (streaming) —
  const generateLaunchAsset = useCallback(async (assetKey) => {
    if (!params?.id) return;
    setLaunchGenerating(assetKey); setLaunchError(null); setLaunchStreamText(""); setLaunchExpanded(assetKey);
    try {
      const r = await fetch("/api/launch-generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: params.id, assetKey }),
      });
      if (!r.ok) {
        const text = await r.text();
        if (text.includes('FUNCTION_INVOCATION_TIMEOUT')) throw new Error('Timeout — tenta outra vez');
        try { const err = JSON.parse(text); throw new Error(err.error || 'Failed'); } catch (e) { if (e.message.includes('Timeout') || e.message.includes('Failed')) throw e; throw new Error('Failed'); }
      }
      // Read the SSE stream
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let generatedAt = new Date().toISOString();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) { fullText += data.text; setLaunchStreamText(fullText); }
            if (data.generatedAt) generatedAt = data.generatedAt;
            if (data.error) throw new Error(data.error);
          } catch (e) { if (e.message && !e.message.includes('JSON')) throw e; }
        }
      }
      if (fullText) {
        await patchCreator({ launch: { [assetKey]: { content: fullText, generatedAt } } });
      }
    } catch (e) { setLaunchError(e.message); }
    finally { setLaunchGenerating(null); setLaunchStreamText(""); }
  }, [params, patchCreator]);

  // — DM Rewrite single touchpoint —
  const rewriteDm = useCallback(async () => {
    if (!creator?.dmSequence?.dm) return;
    setRewriteLoading(true);
    try {
      const r = await fetch("/api/dm-rewrite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          touchpointKey: "cold_dm", currentContent: creator.dmSequence.dm,
          instruction: rewriteInstruction,
          creatorName: creator.name,
          senderName: "Raul",
          language: "Portuguese",
        }),
      });
      if (!r.ok) throw new Error("Rewrite failed");
      const data = await r.json();
      await patchCreator({ dmSequence: { ...creator.dmSequence, dm: data.rewritten } });
      setRewritingDm(false);
      setRewriteInstruction("");
    } catch (e) { console.error(e); }
    finally { setRewriteLoading(false); }
  }, [creator, rewriteInstruction, patchCreator]);

  // — Offer Builder generate —
  const generateOffer = useCallback(async () => {
    if (!creator) return;
    setOfferLoading(true); setOfferError(null);
    try {
      const ae = creator.audienceEstimate || {};
      const meetingContext = Object.entries(creator.meeting || {}).filter(([, v]) => v?.trim()).map(([k, v]) => {
        const label = MEETING_QUESTIONS.find(q => q.key === k)?.label || k;
        return `**${label}:** ${v}`;
      }).join("\n");

      const formatPlatforms = (p) => {
        const parts = [];
        if (p?.instagram?.followers) parts.push(`Instagram ${p.instagram.followers.toLocaleString()}`);
        if (p?.tiktok?.followers) parts.push(`TikTok ${p.tiktok.followers.toLocaleString()}`);
        if (p?.youtube?.subscribers) parts.push(`YouTube ${p.youtube.subscribers.toLocaleString()}`);
        return parts.join(", ");
      };

      let msg = "## CREATOR INTAKE DATA\n\n";
      msg += `**Creator Name:** ${creator.name}\n`;
      msg += `**Niche:** ${creator.niche}\n`;
      msg += `**Platforms:** ${formatPlatforms(creator.platforms)}\n`;
      msg += `**Engagement:** ${creator.engagement}\n`;
      msg += `**Primary Platform:** ${creator.primaryPlatform}\n`;
      msg += `**Bio:** ${creator.bio || "(not provided)"}\n`;
      msg += `**Audience Demographics:** ${[ae.gender, ae.age, ae.location].filter(Boolean).join(", ") || "(not provided)"}\n`;
      msg += `**Audience Interests:** ${ae.interests?.join(", ") || "(not provided)"}\n`;
      msg += `**Audience Problem:** ${offerForm.audience_problem || "(not provided)"}\n`;
      msg += `**Format:** ${offerForm.format || "(not provided)"}\n`;
      msg += `**Price Range:** ${offerForm.price_range || "let the system decide"}\n`;
      msg += `**Creator Involvement:** ${offerForm.creator_capacity || "(not provided)"}\n`;
      msg += `**Products Already Sold:** ${creator.products?.join(", ") || "None found"}\n`;
      msg += `**Credibility:** ${creator.reputation || "(not provided)"}\n`;
      msg += `**Additional Context:** ${offerForm.guidelines || "(not provided)"}\n`;
      if (meetingContext) msg += `\n## MEETING NOTES (from direct conversation with the creator)\n\n${meetingContext}\n`;
      msg += `\n---\nGenerate all three outputs now. Follow system instructions and Hormozi frameworks exactly.\n**IMPORTANT: Write the ENTIRE output in ${(ae.language || "").toLowerCase().includes("portugu") ? "Português" : "English"}.** All section titles, analysis, tables, objection scripts — everything.`;

      const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: OFFER_SYSTEM_PROMPT, message: msg }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "API error");
      const d = await r.json();
      const text = d.content?.map(c => c.text || "").join("\n") || "";
      const parsed = parseOutput(text);
      await patchCreator({ offer: { raw: text, parsed, generatedAt: new Date().toISOString() } });
      setOfferTab("offer");
    } catch (e) { setOfferError(e.message); } finally { setOfferLoading(false); }
  }, [creator, offerForm, patchCreator]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <p style={{ color: "#555" }}>A carregar...</p>
    </div>
  );

  if (error || !creator) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#ef4444", marginBottom: 16 }}>{error || "Creator não encontrado"}</p>
        <a href="/creators" style={{ color: "#7A0E18", textDecoration: "none", fontSize: 14 }}>Voltar</a>
      </div>
    </div>
  );

  const igData = creator.platforms?.instagram || null;
  const tkData = creator.platforms?.tiktok || null;
  const ytData = creator.platforms?.youtube || null;

  let dealScore = null;
  try { if (creator) dealScore = calculateDealScore(creator); } catch (e) { console.error(e); }

  const OFFER_TABS = [
    { key: "offer", label: "Grand Slam Offer" },
    { key: "blindspots", label: "Blind Spot Audit" },
    { key: "objections", label: "Objection Playbook" },
    { key: "revenue", label: "Revenue Projector" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        [data-tip]{position:relative}
        [data-tip]:hover::after{content:attr(data-tip);position:absolute;left:0;top:100%;margin-top:4px;padding:8px 12px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:6px;font-size:11px;color:#ccc;white-space:pre-line;line-height:1.5;z-index:100;min-width:200px;max-width:320px;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.4)}
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}><img src={LOGO_B64} alt="SL" style={{ height: 16, opacity: 0.85 }} /></a>
          <span style={{ color: "#333", fontSize: 14 }}>|</span>
          <a href="/creators" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", textDecoration: "none" }}>CRM</a>
          <span style={{ color: "#333", fontSize: 14 }}>/</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888" }}>{creator.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {saving && <span style={{ fontSize: 11, color: saving.includes("Erro") ? "#ef4444" : "#22c55e" }}>{saving}</span>}
          {forcedCrmView && creator.pipelineStatus === 'signed' && (
            <a href={`/creators/${params?.id}`} style={{ fontSize: 11, color: "#aaa", textDecoration: "none", padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(122,14,24,0.4)", background: "rgba(122,14,24,0.08)" }}>← Workspace</a>
          )}
          {creator.pipelineStatus === 'signed' ? (
            <a href="/pipeline" style={{ fontSize: 11, color: "#555", textDecoration: "none", padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>Pipeline</a>
          ) : (
            <a href="/creators" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}>Voltar</a>
          )}
        </div>
      </div>

      {creator.pipelineStatus === 'signed' && !forcedCrmView ? (
        <WorkspaceDashboard
          creator={creator}
          params={params}
          patchCreator={patchCreator}
          saving={saving}
          generateLaunchAsset={generateLaunchAsset}
          launchGenerating={launchGenerating}
          launchError={launchError}
          launchStreamText={launchStreamText}
          launchExpanded={launchExpanded}
          setLaunchExpanded={setLaunchExpanded}
          launchEditing={launchEditing}
          setLaunchEditing={setLaunchEditing}
          launchEditContent={launchEditContent}
          setLaunchEditContent={setLaunchEditContent}
        />
      ) : (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Profile Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
          {creator.profilePicUrl ? (
            <img src={`/api/proxy-image?url=${encodeURIComponent(creator.profilePicUrl)}`} alt={creator.name}
              onError={e => { e.target.style.display = "none"; e.target.nextSibling && (e.target.nextSibling.style.display = "flex"); }}
              style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.06)", flexShrink: 0 }} />
          ) : null}
          <div style={{ display: creator.profilePicUrl ? "none" : "flex", width: 56, height: 56, borderRadius: "50%", background: "#1a1a1a", border: "2px solid rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22, fontWeight: 700, color: "#555" }}>
            {(creator.name || "?")[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            {editName ? (
              <input ref={nameRef} defaultValue={creator.name} autoFocus
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== creator.name) patchCreator({ name: v }); setEditName(false); }}
                onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                style={{ fontSize: 24, fontWeight: 700, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f5f5f5", padding: "2px 6px", outline: "none", fontFamily: "inherit", width: "100%" }} />
            ) : (
              <h1 onClick={() => setEditName(true)} style={{ fontSize: 24, fontWeight: 700, margin: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }} title="Clica para editar">
                {creator.name}
                {creator.isVerified && <span style={{ fontSize: 12, color: "#3b82f6" }} title="Verificado">&#10003;</span>}
              </h1>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
              {creator.pipelineStatus === 'signed' && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 4, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>Signed</span>}
              {creator.niche && <span style={{ fontSize: 11, color: "#888", padding: "3px 8px", background: "rgba(255,255,255,0.03)", borderRadius: 4 }}>{creator.niche}</span>}
              {(() => {
                const lang = creator.primaryLanguage;
                const audienceHint = creator.intelligence?.audience?.primaryLanguage || creator.audienceEstimate?.language || '';
                const toggleLanguage = () => {
                  const next = lang === 'en' ? 'pt' : 'en';
                  if (window.confirm(`Mudar idioma para ${next === 'en' ? 'English' : 'Portuguese'}? Todos os assets (DM, emails, offer, etc.) vão ser gerados em ${next === 'en' ? 'inglês' : 'português'}.`)) {
                    patchCreator({ primaryLanguage: next });
                  }
                };
                return (
                  <button
                    onClick={toggleLanguage}
                    title={audienceHint ? `Audiência: ${audienceHint}\nClica para mudar o idioma de todos os assets.` : 'Clica para mudar o idioma de todos os assets.'}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 8px",
                      background: lang === 'en' ? "rgba(59,130,246,0.1)" : lang === 'pt' ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)",
                      color: lang === 'en' ? "#3b82f6" : lang === 'pt' ? "#22c55e" : "#888",
                      border: `1px solid ${lang === 'en' ? "rgba(59,130,246,0.25)" : lang === 'pt' ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 4, cursor: "pointer", fontFamily: "inherit"
                    }}
                  >
                    {lang === 'en' ? 'EN' : lang === 'pt' ? 'PT' : 'Lang ?'}
                  </button>
                );
              })()}
              {dealScore && <span style={{ fontSize: 11, fontWeight: 700, color: dealScore.colors.color, padding: "3px 8px", background: dealScore.colors.bg, border: `1px solid ${dealScore.colors.border}`, borderRadius: 4 }}>Score {dealScore.grade} ({dealScore.score})</span>}
              {dealScore?.nicheData && <span style={{ fontSize: 11, color: "#555", padding: "3px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 4 }}>€{dealScore.nicheData.mid}/mês</span>}
              {creator.pipelineStatus !== 'signed' && (
                <button onClick={() => { if (window.confirm("Fechar deal com " + creator.name + "? Isto move o creator para o Pipeline.")) patchCreator({ pipelineStatus: 'signed', signedAt: new Date().toISOString() }); }}
                  style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 4, background: "rgba(122,14,24,0.1)", color: "#7A0E18", border: "1px solid rgba(122,14,24,0.25)", cursor: "pointer", fontFamily: "inherit" }}>
                  Fechar Deal
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "12px 20px", border: "none", background: "transparent",
              color: tab === t.key ? "#f5f5f5" : "#444",
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              letterSpacing: "0.04em", textTransform: "uppercase",
              borderBottom: tab === t.key ? "2px solid #7A0E18" : "2px solid transparent",
              marginBottom: -1, transition: "all 0.15s",
            }}>
              {t.label}
              {t.key === "dm" && creator.dmSequence && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginLeft: 6 }} />}
              {t.key === "oferta" && creator.offer && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginLeft: 6 }} />}
              {t.key === "launch" && Object.keys(creator.launch || {}).length > 0 && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginLeft: 6 }} />}
            </button>
          ))}
        </div>

        {/* ════════════ PERFIL TAB ════════════ */}
        {tab === "perfil" && (<div style={{ display: "flex", gap: 28 }}>
          <div style={{ flex: "0 0 60%", maxWidth: "60%" }}>

          {/* Deal Score Card */}
          {dealScore && (
            <div style={{ marginBottom: 24, padding: "20px 22px", background: dealScore.colors.bg, border: `1px solid ${dealScore.colors.border}`, borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, background: dealScore.colors.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: dealScore.colors.color }}>
                  {dealScore.grade}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>Deal Score: {dealScore.score}/{dealScore.maxScore}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                    {dealScore.grade === 'A' ? 'Oportunidade excelente' : dealScore.grade === 'B' ? 'Bom potencial' : dealScore.grade === 'C' ? 'Potencial moderado' : 'Potencial baixo'}
                  </div>
                </div>
                {dealScore.nicheData && (
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>Preço sugerido</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5" }}>€{dealScore.nicheData.mid}<span style={{ fontSize: 11, color: "#555", fontWeight: 400 }}>/mês</span></div>
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {Object.entries(dealScore.breakdown).map(([key, points]) => {
                  const maxPts = { followers: 20, engagement: 25, niche: 20, authenticity: 15, monetization: 10, multiPlatform: 10 }[key] || 10;
                  const pct = Math.round((points / maxPts) * 100);
                  return (
                    <div key={key} data-tip={dealScore.tooltips?.[key] || ''} style={{ padding: "5px 8px", background: "rgba(0,0,0,0.3)", borderRadius: 6, cursor: "help" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontSize: 8, color: "#666", textTransform: "uppercase" }}>{dealScore.labels[key]}</span>
                        <span style={{ fontSize: 8, color: "#888", fontWeight: 600 }}>{points}/{maxPts}</span>
                      </div>
                      <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                        <div style={{ height: 2, borderRadius: 2, width: pct + "%", background: pct >= 70 ? "#22c55e" : pct >= 40 ? "#eab308" : "#ef4444" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audience Estimate */}
          {creator.audienceEstimate && (
            <div style={{ marginBottom: 24, padding: "16px 20px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ ...sectionTitleStyle, margin: 0 }}>Audiência Estimada</span>
                <span style={{ fontSize: 8, color: "#555", padding: "2px 6px", background: "rgba(255,255,255,0.04)", borderRadius: 4, textTransform: "uppercase" }}>AI</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {creator.audienceEstimate.gender && <div><div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", marginBottom: 2 }}>Género</div><div style={{ fontSize: 12, color: "#ccc" }}>{creator.audienceEstimate.gender}</div></div>}
                {creator.audienceEstimate.age && <div><div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", marginBottom: 2 }}>Idade</div><div style={{ fontSize: 12, color: "#ccc" }}>{creator.audienceEstimate.age}</div></div>}
                {creator.audienceEstimate.location && <div><div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", marginBottom: 2 }}>Localização</div><div style={{ fontSize: 12, color: "#ccc" }}>{creator.audienceEstimate.location}</div></div>}
                {creator.audienceEstimate.language && <div><div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", marginBottom: 2 }}>Idioma</div><div style={{ fontSize: 12, color: "#ccc" }}>{creator.audienceEstimate.language}</div></div>}
              </div>
              {creator.audienceEstimate.interests?.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Interesses</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {creator.audienceEstimate.interests.map((i, idx) => <span key={idx} style={{ fontSize: 10, color: "#aaa", padding: "3px 8px", background: "rgba(255,255,255,0.04)", borderRadius: 4 }}>{i}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instagram */}
          {igData && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={sectionTitleStyle}>Instagram {igData.url && <a href={igData.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#7A0E18", textDecoration: "none", marginLeft: 8, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>Ver perfil</a>}</h3>
              {(creator.bio || creator.externalUrl) && (
                <div style={{ marginBottom: 12, padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8 }}>
                  {creator.bio && <p style={{ fontSize: 12, color: "#bbb", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{creator.bio}</p>}
                  {creator.externalUrl && <a href={creator.externalUrl.startsWith("http") ? creator.externalUrl : "https://" + creator.externalUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 6, fontSize: 11, color: "#7A0E18", textDecoration: "none" }}>{creator.externalUrl}</a>}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 6, marginBottom: 10 }}>
                {igData.followers > 0 && <div style={metricCardStyle}><div style={metricLabelStyle}>Followers</div><div style={metricValueStyle}>{formatFollowers(igData.followers)}</div></div>}
                {igData.following > 0 && <div style={metricCardStyle}><div style={metricLabelStyle}>Following</div><div style={metricValueStyle}>{formatFollowers(igData.following)}</div></div>}
                {igData.postCount > 0 && <div style={metricCardStyle}><div style={metricLabelStyle}>Posts</div><div style={metricValueStyle}>{formatFollowers(igData.postCount)}</div></div>}
                {igData.avgLikes > 0 && <div style={metricCardStyle}><div style={metricLabelStyle}>Média Likes</div><div style={metricValueStyle}>{formatFollowers(igData.avgLikes)}</div></div>}
                {igData.avgComments > 0 && <div style={metricCardStyle}><div style={metricLabelStyle}>Média Com.</div><div style={metricValueStyle}>{formatFollowers(igData.avgComments)}</div></div>}
                {(igData.engagementRate || creator.engagement) && <div style={metricCardStyle} data-tip={"(Avg Likes + Avg Comments) / Followers × 100\nMeasures how actively the audience interacts"}><div style={{ ...metricLabelStyle, cursor: "help" }}>Engagement</div><div style={metricValueStyle}>{igData.engagementRate || creator.engagement}</div></div>}
                {igData.botScore != null && <div style={{ ...metricCardStyle, background: igData.botScore <= 0.3 ? "#22c55e0a" : "#ef44440a" }} data-tip={"Bot score: " + (igData.botScore * 100).toFixed(0) + "%\n0% = fully real audience\n100% = mostly bots\n≤30% = Low (good) | 30-60% = Medium | >60% = High (bad)"}><div style={{ ...metricLabelStyle, cursor: "help" }}>Fake Followers</div><div style={{ ...metricValueStyle, color: igData.botScore <= 0.3 ? "#22c55e" : igData.botScore <= 0.6 ? "#eab308" : "#ef4444" }}>{igData.botScore <= 0.3 ? "Low" : igData.botScore <= 0.6 ? "Med" : "High"} <span style={{ fontSize: 10, color: "#555", fontWeight: 400 }}>{(igData.botScore * 100).toFixed(0)}%</span></div></div>}
              </div>
              {(igData.recentPosts || []).length > 0 && (
                <div><div style={{ fontSize: 10, fontWeight: 600, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Posts Recentes</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {igData.recentPosts.slice(0, 6).map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#141414", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 6 }}>
                      <span style={{ flex: 1, fontSize: 11, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.caption || "(sem legenda)"}</span>
                      {p.type && <span style={{ fontSize: 9, color: "#444", padding: "1px 5px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3 }}>{p.type}</span>}
                      <span style={{ fontSize: 10, color: "#888", whiteSpace: "nowrap" }}>{formatFollowers(p.likes)} likes</span>
                      <span style={{ fontSize: 10, color: "#555", whiteSpace: "nowrap" }}>{p.comments} com.</span>
                    </div>
                  ))}
                </div></div>
              )}
            </div>
          )}

          {/* TikTok */}
          {tkData && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={sectionTitleStyle}>TikTok {tkData.url && <a href={tkData.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#7A0E18", textDecoration: "none", marginLeft: 8, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>Ver perfil</a>}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 6, marginBottom: 10 }}>
                {tkData.followers > 0 && <div style={metricCardStyle}><div style={metricLabelStyle}>Followers</div><div style={metricValueStyle}>{formatFollowers(tkData.followers)}</div></div>}
                {tkData.totalLikes > 0 && <div style={metricCardStyle}><div style={metricLabelStyle}>Total Likes</div><div style={metricValueStyle}>{formatFollowers(tkData.totalLikes)}</div></div>}
                {tkData.videoCount > 0 && <div style={metricCardStyle}><div style={metricLabelStyle}>Vídeos</div><div style={metricValueStyle}>{formatFollowers(tkData.videoCount)}</div></div>}
                {tkData.avgViews > 0 && <div style={metricCardStyle}><div style={metricLabelStyle}>Média Views</div><div style={metricValueStyle}>{formatFollowers(tkData.avgViews)}</div></div>}
              </div>
              {(tkData.recentVideos || []).length > 0 && (
                <div><div style={{ fontSize: 10, fontWeight: 600, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Vídeos Recentes</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {tkData.recentVideos.slice(0, 6).map((v, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#141414", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 6 }}>
                      <span style={{ flex: 1, fontSize: 11, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.caption || "(sem legenda)"}</span>
                      <span style={{ fontSize: 10, color: "#888", whiteSpace: "nowrap" }}>{formatFollowers(v.views)} views</span>
                      <span style={{ fontSize: 10, color: "#888", whiteSpace: "nowrap" }}>{formatFollowers(v.likes)} likes</span>
                      <span style={{ fontSize: 10, color: "#555", whiteSpace: "nowrap" }}>{v.shares} shares</span>
                    </div>
                  ))}
                </div></div>
              )}
            </div>
          )}

          {/* YouTube */}
          {ytData && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={sectionTitleStyle}>YouTube {ytData.url && <a href={ytData.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#7A0E18", textDecoration: "none", marginLeft: 8, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>Ver canal</a>}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 6, marginBottom: 10 }}>
                {ytData.subscribers > 0 && <div style={metricCardStyle}><div style={metricLabelStyle}>Subscribers</div><div style={metricValueStyle}>{formatFollowers(ytData.subscribers)}</div></div>}
                {ytData.videoCount > 0 && <div style={metricCardStyle}><div style={metricLabelStyle}>Vídeos</div><div style={metricValueStyle}>{formatFollowers(ytData.videoCount)}</div></div>}
                {ytData.totalViews > 0 && <div style={metricCardStyle}><div style={metricLabelStyle}>Total Views</div><div style={metricValueStyle}>{formatFollowers(ytData.totalViews)}</div></div>}
                {ytData.avgViews > 0 && <div style={metricCardStyle}><div style={metricLabelStyle}>Média Views</div><div style={metricValueStyle}>{formatFollowers(ytData.avgViews)}</div></div>}
                {ytData.viewEngagement && ytData.viewEngagement !== '' && <div style={{ ...metricCardStyle, background: "#1a1410" }} data-tip={"Avg Views / Subscribers × 100\nMeasures what % of subscribers watch each video\n>100% = content reaches beyond subscribers"}><div style={{ ...metricLabelStyle, cursor: "help" }}>View Rate</div><div style={metricValueStyle}>{ytData.viewEngagement}</div></div>}
                {ytData.joinedDate && <div style={metricCardStyle}><div style={metricLabelStyle}>Desde</div><div style={{ ...metricValueStyle, fontSize: 12 }}>{ytData.joinedDate}</div></div>}
              </div>
              {(ytData.recentVideos || []).length > 0 && (
                <div><div style={{ fontSize: 10, fontWeight: 600, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Vídeos Recentes</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {ytData.recentVideos.slice(0, 3).map((v, i) => (
                    <div key={i} style={{ padding: "8px 12px", background: "#141414", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 6 }}>
                      <div style={{ fontSize: 11, color: "#ccc", marginBottom: 3 }}>{v.url ? <a href={v.url} target="_blank" rel="noopener noreferrer" style={{ color: "#ccc", textDecoration: "none" }}>{v.title}</a> : v.title}</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, color: "#888" }}>{formatFollowers(v.views)} views</span>
                        {v.duration && <span style={{ fontSize: 10, color: "#555" }}>{v.duration}</span>}
                        {v.date && <span style={{ fontSize: 10, color: "#444" }}>{v.date}</span>}
                      </div>
                    </div>
                  ))}
                </div></div>
              )}
            </div>
          )}

          {/* Content Analysis */}
          {(creator.intelligence?.topPosts?.length > 0 || creator.intelligence?.contentStyle) && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={sectionTitleStyle}>Análise de Conteúdo <span style={{ fontSize: 8, color: "#555", padding: "2px 6px", background: "rgba(255,255,255,0.04)", borderRadius: 4, textTransform: "uppercase", fontWeight: 400, marginLeft: 8 }}>AI</span></h3>

              {/* Format breakdown */}
              {creator.intelligence.contentStyle && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {[
                    { label: "Reels", value: creator.intelligence.contentStyle.formatBreakdown?.reels, color: "#7A0E18" },
                    { label: "Carousels", value: creator.intelligence.contentStyle.formatBreakdown?.carousels, color: "#3b82f6" },
                    { label: "Estático", value: creator.intelligence.contentStyle.formatBreakdown?.static, color: "#555" },
                  ].filter(f => f.value > 0).map((f, i) => (
                    <div key={i} style={{ flex: 1, padding: "10px 12px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: f.color }}>{f.value}%</div>
                      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", marginTop: 2 }}>{f.label}</div>
                    </div>
                  ))}
                  {creator.intelligence.contentStyle.postsPerWeek > 0 && (
                    <div style={{ flex: 1, padding: "10px 12px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e" }}>{creator.intelligence.contentStyle.postsPerWeek}</div>
                      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", marginTop: 2 }}>Posts/semana</div>
                    </div>
                  )}
                </div>
              )}

              {/* Top posts */}
              {creator.intelligence.topPosts?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Top Posts</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {creator.intelligence.topPosts.map((p, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#141414", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", minWidth: 16 }}>#{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 11, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.caption}</span>
                        {p.format && <span style={{ fontSize: 9, color: "#444", padding: "1px 5px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3 }}>{p.format}</span>}
                        {p.topic && <span style={{ fontSize: 9, color: "#888", padding: "1px 6px", background: "rgba(122,14,24,0.15)", borderRadius: 3 }}>{p.topic}</span>}
                        {p.engagementRate && <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600, whiteSpace: "nowrap" }}>{p.engagementRate}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Products & Revenue Signals */}
          {(creator.intelligence?.bioLinks?.length > 0 || creator.products?.length > 0 || creator.bioLinks?.length > 0) && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={sectionTitleStyle}>Produtos & Revenue <span style={{ fontSize: 8, color: "#555", padding: "2px 6px", background: "rgba(255,255,255,0.04)", borderRadius: 4, textTransform: "uppercase", fontWeight: 400, marginLeft: 8 }}>AI</span></h3>

              {/* Intelligence bio link products (with platform + pricing) */}
              {creator.intelligence?.bioLinks?.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                  {creator.intelligence.bioLinks.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5" }}>{p.productName}</div>
                        <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{p.platform}{p.url ? ` — ${p.url}` : ''}</div>
                      </div>
                      {p.price && (
                        <div style={{ padding: "4px 10px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                          {p.currency === 'EUR' || !p.currency ? '€' : p.currency}{p.price}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Raw bio links (from Linktree scraper) */}
              {creator.bioLinks?.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Links na Bio</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {creator.bioLinks.map((l, i) => <a key={i} href={l.url?.startsWith("http") ? l.url : "https://" + l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#7A0E18", textDecoration: "none", padding: "6px 10px", background: "#141414", borderRadius: 6, wordBreak: "break-all" }}>{l.title || l.url}</a>)}
                  </div>
                </div>
              )}

              {/* AI-detected products */}
              {creator.products?.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {creator.products.map((p, i) => <span key={i} style={{ fontSize: 11, color: "#f5f5f5", padding: "4px 10px", background: "rgba(122,14,24,0.15)", border: "1px solid rgba(122,14,24,0.25)", borderRadius: 4 }}>{p}</span>)}
                </div>
              )}
            </div>
          )}

          {/* Discovery — always visible */}
          <div style={{ marginBottom: 24, padding: "14px 16px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", marginBottom: 2 }}>Descobrir similares</div>
              <div style={{ fontSize: 10, color: "#666" }}>
                Scanear 5 creators similares no Instagram e adicionar ao Discovery queue. ~€0.75
              </div>
              {similarResult && (
                <div style={{ fontSize: 10, color: similarResult.startsWith("Erro") ? "#ef4444" : "#22c55e", marginTop: 4 }}>{similarResult}</div>
              )}
            </div>
            <button
              onClick={findSimilar}
              disabled={findingSimilar}
              style={{ fontSize: 11, fontWeight: 600, padding: "8px 14px", background: findingSimilar ? "#222" : "#7A0E18", border: "none", borderRadius: 6, color: findingSimilar ? "#555" : "#fff", cursor: findingSimilar ? "wait" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              {findingSimilar ? "A descobrir..." : "Find 5 similar"}
            </button>
          </div>

          {/* Competitors (intelligence version + Instagram similar) */}
          {(creator.intelligence?.competitors?.length > 0 || creator.competitors?.length > 0) && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={sectionTitleStyle}>Competidores no Nicho <span style={{ fontSize: 8, color: "#555", padding: "2px 6px", background: "rgba(255,255,255,0.04)", borderRadius: 4, textTransform: "uppercase", fontWeight: 400, marginLeft: 8 }}>AI</span></h3>

              {/* Intelligence competitors (with pricing) */}
              {creator.intelligence?.competitors?.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                  {creator.intelligence.competitors.map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#ccc" }}>
                          {c.url ? <a href={c.url.startsWith("http") ? c.url : "https://" + c.url} target="_blank" rel="noopener noreferrer" style={{ color: "#ccc", textDecoration: "none" }}>{c.name}</a> : c.name}
                        </div>
                        <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
                          {c.platform}
                          {c.estimatedSize && <span style={{ marginLeft: 8 }}>{c.estimatedSize} membros</span>}
                        </div>
                      </div>
                      {c.price && (
                        <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#eab308" }}>
                          {c.currency === 'EUR' || !c.currency ? '€' : c.currency}{c.price}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Instagram similar profiles (existing data) */}
              {creator.competitors?.length > 0 && creator.competitors[0]?.username && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Instagram Similares</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {creator.competitors.slice(0, 5).map((c, i) => (
                      <a key={i} href={c.url || `https://instagram.com/${c.username}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#141414", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 6, textDecoration: "none" }}>
                        <div style={{ fontSize: 12, color: "#ccc", flex: 1 }}>{c.fullName || c.username} <span style={{ color: "#555" }}>@{c.username}</span></div>
                        {c.followers > 0 && <span style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>{formatFollowers(c.followers)}</span>}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reputation */}
          {creator.reputation && <div style={{ marginBottom: 24 }}><h3 style={sectionTitleStyle}>Reputação</h3><p style={{ fontSize: 12, color: "#888", margin: 0, lineHeight: 1.6 }}>{creator.reputation}</p></div>}

          {/* Research */}
          {creator.research && (
            <div style={{ marginBottom: 24 }}>
              <button onClick={() => setShowResearch(!showResearch)} style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", background: "transparent", border: "none", cursor: "pointer", padding: 0, marginBottom: 10, fontFamily: "inherit" }}>
                Pesquisa Completa {showResearch ? "[-]" : "[+]"}
              </button>
              {showResearch && <div style={{ padding: 16, background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8, fontSize: 11, color: "#888", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 400, overflowY: "auto" }}>{creator.research}</div>}
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={sectionTitleStyle}>Notas</h3>
            <textarea defaultValue={creator.notes || ""} placeholder="Adicionar notas..."
              onBlur={e => { const v = e.target.value; if (v !== (creator.notes || "")) patchCreator({ notes: v }); }}
              style={{ ...inputStyle, minHeight: 80 }} />
          </div>

          {/* Delete */}
          <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <button onClick={handleDelete} disabled={deleting} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #dc2626", borderRadius: 6, color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: deleting ? 0.5 : 1 }}>
              {deleting ? "A eliminar..." : "Eliminar Creator"}
            </button>
          </div>
          </div>

          {/* Right Column - Meeting Notes */}
          <div style={{ flex: "0 0 40%", maxWidth: "40%" }}>
            <div style={{ padding: 24, background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12, position: "sticky", top: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Notas de Reunião</h2>
              <p style={{ fontSize: 11, color: "#555", margin: "0 0 20px" }}>Preencher durante ou após a call com o creator.</p>
              {MEETING_QUESTIONS.map(q => (
                <div key={q.key} style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6 }}>{q.label}</label>
                  <textarea defaultValue={creator.meeting?.[q.key] || ""}
                    onBlur={e => { const v = e.target.value; if (v !== (creator.meeting?.[q.key] || "")) patchCreator({ meeting: { [q.key]: v } }); }}
                    style={{ ...inputStyle, minHeight: 60 }} />
                </div>
              ))}
            </div>
          </div>
        </div>)}

        {/* ════════════ DM WRITER TAB ════════════ */}
        {tab === "dm" && (<>
          {!creator.dmSequence && !dmLoading && (
            <div>
              <p style={sectionTitleStyle}>Inputs do Criador</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {[
                  { key: "primeiro_nome", label: "Primeiro Nome", placeholder: "Ex: Mariana" },
                  { key: "handle_instagram", label: "Handle Instagram", placeholder: "@username" },
                  { key: "seguidores", label: "Seguidores", placeholder: "Ex: 85,000" },
                  { key: "nicho", label: "Nicho", placeholder: "Ex: finanças pessoais" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.label}</label>
                    <input type="text" style={inputStyle} placeholder={f.placeholder} value={dmInputs[f.key] || ""} onChange={e => setDmInputs(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              {[
                { key: "como_cheguei", label: "Como Cheguei Até Ti", placeholder: "Como o Raul descobriu o creator + conteúdo concreto (ex: 'através da receita do pudim de laranja e coco'). Começa com preposição (através, por, porque vi...). Deixa vazio para auto-preencher." },
                { key: "reacao_pessoal", label: "Reação Pessoal", placeholder: "Reação/ligação genuína (ex: 'é a minha sobremesa favorita 😅' ou 'identifico-me com esse processo'). Max 1 emoji. Deixa vazio para auto-preencher." },
                { key: "observacao_dor", label: "Observação / Dor", placeholder: "Observação sobre o negócio em PT europeu (ex: 'tens uma audiência gigante que interage bem, mas só vejo parcerias pontuais'). Sem menções a 'receita recorrente' ou 'monetizar' aqui. Deixa vazio para auto-preencher." },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.label}</label>
                  <textarea style={{ ...inputStyle, minHeight: 50 }} placeholder={f.placeholder} value={dmInputs[f.key] || ""} onChange={e => setDmInputs(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Template</label>
                  <select style={inputStyle} value={dmTemplate} onChange={e => setDmTemplate(e.target.value)}>
                    <option value="A">Template A — Direto</option>
                    <option value="B">Template B — Série (Day in the Life)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Notas <span style={{ fontWeight: 400, color: "#333" }}>(opcional)</span></label>
                  <input type="text" style={inputStyle} placeholder="Contexto extra..." value={dmNotes} onChange={e => setDmNotes(e.target.value)} />
                </div>
              </div>
              <button onClick={generateDM} style={{ padding: "12px 32px", borderRadius: 8, border: "none", background: "#7A0E18", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>Gerar DM</button>
            </div>
          )}
          {dmLoading && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ width: 20, height: 20, margin: "0 auto 12px", border: "2px solid #222", borderTopColor: "#7A0E18", borderRadius: "50%", animation: "sl-spin 0.8s linear infinite" }} />
              <p style={{ fontSize: 12, color: "#555" }}>A analisar perfil e gerar outreach... (30-60s)</p>
              <style>{`@keyframes sl-spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          {dmError && <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 11, marginBottom: 16 }}>{dmError}</div>}
          {creator.dmSequence && (() => {
            const seq = creator.dmSequence;
            const firstName = seq.inputs?.primeiro_nome || creator.name?.split(" ")[0] || "";
            const followupT7 = `${firstName}, voltei aqui porque acho que faz mesmo sentido partilhar contigo o que vi. Gravo-te o video de 3 min a mesma. Se nao fizer sentido, nao ves e esta resolvido.\n\nParece-te bem?\n\n— Raul`;
            const breakupT14 = `${firstName}, assumo que agora nao e o momento. Fecho o loop do meu lado.\nSe um dia mudar, a porta fica aberta. Um abraco.\n\n— Raul`;

            const MessageCard = ({ label, type, content, accent, children }) => (
              <div style={{ padding: "16px 18px", borderRadius: 8, background: "#141414", border: `1px solid ${accent ? "rgba(122,14,24,0.2)" : "rgba(255,255,255,0.04)"}`, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: accent ? "#7A0E18" : "#888" }}>{label}</span>
                    <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 3, background: type === "email" ? "#1a1520" : "rgba(255,255,255,0.03)", color: type === "email" ? "#9a7abf" : "#666", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{type}</span>
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(content)} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#666", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>Copy</button>
                </div>
                <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{content}</div>
                {children}
              </div>
            );

            return (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "#555" }}>Gerado: {new Date(seq.generatedAt).toLocaleString("pt-PT")}</span>
                    <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 3, background: "rgba(122,14,24,0.1)", color: "#7A0E18", fontWeight: 600 }}>Template {seq.template || "A"}</span>
                  </div>
                  <button onClick={() => { patchCreator({ dmSequence: null }); setReplyResult(null); setReplyText(""); }} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#888", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Regenerar</button>
                </div>

                {/* Cold DM */}
                <MessageCard label="T+0 — Cold DM" type="dm" content={seq.dm || ""} accent>
                  {!rewritingDm ? (
                    <button onClick={() => { setRewritingDm(true); setRewriteInstruction(""); }} style={{ marginTop: 10, padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#666", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>Reescrever</button>
                  ) : (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <textarea placeholder="O que queres mudar? Ex: 'mais curto', 'referir o podcast'..." value={rewriteInstruction} onChange={e => setRewriteInstruction(e.target.value)} style={{ ...inputStyle, minHeight: 50, fontSize: 12, marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={rewriteDm} disabled={rewriteLoading} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#7A0E18", color: "#fff", fontSize: 11, fontWeight: 600, cursor: rewriteLoading ? "wait" : "pointer", fontFamily: "inherit" }}>{rewriteLoading ? "A reescrever..." : "Reescrever"}</button>
                        <button onClick={() => { setRewritingDm(false); setRewriteInstruction(""); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#666", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </MessageCard>

                {/* Follow-ups */}
                <p style={{ ...sectionTitleStyle, marginTop: 24 }}>Follow-ups</p>

                {seq.comment_t3 && (
                  <MessageCard label="T+3 — Comentário no Post" type="comentário" content={seq.comment_t3} />
                )}
                <MessageCard label="T+7 — Segunda DM" type="dm" content={followupT7} />
                <MessageCard label="T+14 — Breakup" type="dm" content={breakupT14} />

                {/* Emails */}
                <p style={{ ...sectionTitleStyle, marginTop: 24 }}>Emails</p>

                {seq.email_day1?.body && (
                  <MessageCard label="Day 1 — Email" type="email" content={`Subject: ${seq.email_day1.subject || ""}\n\n${seq.email_day1.body}`} />
                )}
                {seq.email_day7?.body && (
                  <MessageCard label="Day 7 — Email" type="email" content={`Subject: ${seq.email_day7.subject || ""}\n\n${seq.email_day7.body}`} />
                )}
                {seq.email_day14?.body && (
                  <MessageCard label="Day 14 — Email" type="email" content={`Subject: ${seq.email_day14.subject || ""}\n\n${seq.email_day14.body}`} />
                )}

                {/* Reply Handler */}
                <p style={{ ...sectionTitleStyle, marginTop: 24 }}>Resposta do Criador</p>
                <div style={{ padding: "16px 18px", borderRadius: 8, background: "#141414", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <textarea placeholder="Cola aqui a resposta do criador..." value={replyText} onChange={e => setReplyText(e.target.value)} style={{ ...inputStyle, minHeight: 60, marginBottom: 10 }} />
                  <button onClick={handleReply} disabled={replyLoading || !replyText.trim()} style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: replyText.trim() ? "#7A0E18" : "#333", color: replyText.trim() ? "#fff" : "#666", fontSize: 12, fontWeight: 600, cursor: replyLoading ? "wait" : replyText.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                    {replyLoading ? "A classificar..." : "Obter Resposta"}
                  </button>
                  {replyError && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 11 }}>{replyError}</div>}
                  {replyResult && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A0E18", marginBottom: 8 }}>{replyResult.category}</div>
                      <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 8 }}>{replyResult.response}</div>
                      <button onClick={() => navigator.clipboard.writeText(replyResult.response)} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#666", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>Copy</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </>)}

        {/* ════════════ OFERTA TAB ════════════ */}
        {tab === "oferta" && (<>
          {!creator.offer && !offerLoading && (() => {
            const sec = OFFER_STEPS[offerStep] || OFFER_STEPS[0];
            return (
            <div>
              <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>Completa os campos para gerar a oferta Grand Slam de {creator.name}.</p>

              <div style={{ display: "flex", gap: 2, marginBottom: 24 }}>
                {OFFER_STEPS.map((_, i) => <button key={i} onClick={() => setOfferStep(i)} style={{ flex: 1, height: 2, border: "none", cursor: "pointer", background: i <= offerStep ? "#7A0E18" : "#222", borderRadius: 1 }} />)}
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#7A0E18", letterSpacing: "0.06em" }}>{sec.icon}/{String(OFFER_STEPS.length).padStart(2, "0")}</span>
                  <h2 style={{ fontSize: 15, fontWeight: 500, margin: 0, color: "#f5f5f5" }}>{sec.section}</h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {sec.fields.map(f => (
                    <div key={f.key}>
                      <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.label}</label>
                      {f.type === "textarea" ? (
                        <textarea style={{ ...inputStyle, minHeight: 60 }} placeholder={f.placeholder || ""} value={offerForm[f.key] || ""} onChange={e => setOfferForm(p => ({ ...p, [f.key]: e.target.value }))} />
                      ) : f.type === "select" ? (
                        <select style={{ ...inputStyle, cursor: "pointer" }} value={offerForm[f.key] || f.options?.[0] || ""} onChange={e => setOfferForm(p => ({ ...p, [f.key]: e.target.value }))}>
                          {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type="text" style={inputStyle} placeholder={f.placeholder || ""} value={offerForm[f.key] || ""} onChange={e => setOfferForm(p => ({ ...p, [f.key]: e.target.value }))} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button onClick={() => setOfferStep(Math.max(0, offerStep - 1))} disabled={offerStep === 0} style={{ padding: "10px 22px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: offerStep === 0 ? "#222" : "#888", fontSize: 12, fontWeight: 500, cursor: offerStep === 0 ? "default" : "pointer", fontFamily: "inherit" }}>Back</button>
                {offerStep < OFFER_STEPS.length - 1
                  ? <button onClick={() => setOfferStep(offerStep + 1)} style={{ padding: "10px 28px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#f5f5f5", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Continue</button>
                  : <button onClick={generateOffer} style={{ padding: "10px 32px", borderRadius: 6, border: "none", background: "#7A0E18", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Gerar Oferta</button>
                }
              </div>
            </div>
            );
          })()}
          {offerLoading && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ width: 20, height: 20, margin: "0 auto 12px", border: "2px solid #222", borderTopColor: "#7A0E18", borderRadius: "50%", animation: "sl-spin 0.8s linear infinite" }} />
              <p style={{ fontSize: 12, color: "#555" }}>A construir oferta Grand Slam... (60-90s)</p>
              <style>{`@keyframes sl-spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          {offerError && <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 11, marginBottom: 16 }}>{offerError}</div>}
          {creator.offer && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {OFFER_TABS.map(t => <button key={t.key} onClick={() => setOfferTab(t.key)} style={{
                    padding: "8px 14px", border: "none", background: "transparent", color: offerTab === t.key ? "#f5f5f5" : "#444",
                    fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase",
                    borderBottom: offerTab === t.key ? "2px solid #7A0E18" : "2px solid transparent", marginBottom: -1,
                  }}>{t.label}</button>)}
                </div>
                <button onClick={() => { setOfferForm({ _filled: false }); setOfferStep(0); patchCreator({ offer: null }); }} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#888", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Regenerar</button>
              </div>
              <div style={{ padding: 20, background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, minHeight: 200 }}>
                {offerTab === "revenue" ? (() => {
                  // Audience: use creator.revenueAudience override if set, else scraped data
                  const scrapedF = igData?.followers || tkData?.followers || ytData?.subscribers || 10000;
                  const primaryF = creator.revenueAudience ?? scrapedF;
                  const nichePrice = dealScore?.nicheData?.mid || 39;
                  const rawPriceMatch = creator.offer?.raw?.match(/RECOMMENDED MONTHLY PRICE:\s*€?\s*(\d+)/i);
                  const defaultPrice = rawPriceMatch ? parseInt(rawPriceMatch[1], 10) : nichePrice;
                  const price = revenuePrice ?? creator.revenuePrice ?? defaultPrice;
                  const fmt = (n) => "€" + Math.round(n).toLocaleString();

                  // Engagement rate
                  const rawEng = creator.engagement || igData?.engagementRate || "";
                  const defaultEng = parseFloat(String(rawEng).replace(/[^0-9.]/g, "")) || 2.0;
                  const eng = engagementRate ?? creator.revenueEngagement ?? defaultEng;

                  // Use SHARED revenue lib — same scenarios + same formula as the Pitch deck
                  const scenarios = [
                    { ...REVENUE_SCENARIOS.conservador, label: "Conservative", color: "#888", border: "rgba(255,255,255,0.04)" },
                    { ...REVENUE_SCENARIOS.moderado, label: "Moderate", color: "#f5f5f5", border: "rgba(122,14,24,0.2)" },
                    { ...REVENUE_SCENARIOS.agressivo, label: "Aggressive", color: "#7A0E18", border: "rgba(255,255,255,0.04)" },
                  ];

                  const calcSteady = (s) => sharedCalcMRR({ audience: primaryF, price, engagementRate: eng, scenario: s });
                  const calcClients = (s) => calcSteady(s).activeMembers;
                  const engMultiplier = sharedCalcMRR({ audience: primaryF, price, engagementRate: eng, scenario: scenarios[1] }).engMultiplier;

                  const modScenario = scenarios[1];
                  const modSteady = calcSteady(modScenario);
                  const modClients = modSteady.activeMembers;
                  const modRevenue = modSteady.monthlyRevenue;

                  return (
                    <div>
                      <div style={{ textAlign: "center", padding: "28px 20px 24px", marginBottom: 20, background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Estimated Monthly Recurring Revenue</div>
                        <div style={{ fontSize: 42, fontWeight: 200, color: "#7A0E18", letterSpacing: "-0.03em", lineHeight: 1.1 }}>{fmt(modRevenue)}</div>
                        <div style={{ fontSize: 11, color: "#444", marginTop: 6 }}>/mês · {modClients} active clients · {creator.primaryPlatform} {primaryF.toLocaleString()} followers · {eng.toFixed(2)}% eng</div>
                      </div>

                      {/* Inputs: Price, Engagement, Commission */}
                      <div style={{ padding: "16px 18px", marginBottom: 20, background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
                        {/* Monthly Price */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#555", letterSpacing: "0.05em", textTransform: "uppercase" }}>Monthly Price</span>
                            {price === defaultPrice && <span style={{ fontSize: 8, fontWeight: 600, color: "#7A0E18", letterSpacing: "0.06em", padding: "1px 5px", borderRadius: 2, border: "1px solid rgba(122,14,24,0.2)", textTransform: "uppercase" }}>Recommended</span>}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>{fmt(price)}</span>
                        </div>
                        <input type="range" min={5} max={497} step={1} value={price}
                          onChange={e => setRevenuePrice(Number(e.target.value))}
                          style={{ width: "100%", height: 4, appearance: "none", background: "#222", borderRadius: 2, outline: "none", cursor: "pointer", accentColor: "#7A0E18" }} />

                        {/* Engagement Rate */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#555", letterSpacing: "0.05em", textTransform: "uppercase" }}>Engagement Rate</span>
                            {eng === defaultEng && <span style={{ fontSize: 8, fontWeight: 600, color: "#7A0E18", letterSpacing: "0.06em", padding: "1px 5px", borderRadius: 2, border: "1px solid rgba(122,14,24,0.2)", textTransform: "uppercase" }}>From Profile</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>{eng.toFixed(2)}%</span>
                            <span style={{ fontSize: 9, color: engMultiplier >= 1.5 ? "#22c55e" : engMultiplier >= 0.8 ? "#eab308" : "#ef4444", fontWeight: 600 }}>{engMultiplier.toFixed(2)}x</span>
                          </div>
                        </div>
                        <input type="range" min={0.1} max={15} step={0.1} value={eng}
                          onChange={e => setEngagementRate(Number(e.target.value))}
                          style={{ width: "100%", height: 4, appearance: "none", background: "#222", borderRadius: 2, outline: "none", cursor: "pointer", accentColor: "#7A0E18" }} />

                        {/* SL Commission */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#555", letterSpacing: "0.05em", textTransform: "uppercase" }}>SL Commission</span>
                            {revenueCommission === 30 && <span style={{ fontSize: 8, fontWeight: 600, color: "#7A0E18", letterSpacing: "0.06em", padding: "1px 5px", borderRadius: 2, border: "1px solid rgba(122,14,24,0.2)", textTransform: "uppercase" }}>Default</span>}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>{revenueCommission}%</span>
                        </div>
                        <input type="range" min={15} max={50} step={1} value={revenueCommission}
                          onChange={e => setRevenueCommission(Number(e.target.value))}
                          style={{ width: "100%", height: 4, appearance: "none", background: "#222", borderRadius: 2, outline: "none", cursor: "pointer", accentColor: "#7A0E18" }} />
                      </div>

                      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {scenarios.map(s => {
                          const clients = calcClients(s);
                          const monthly = clients * price;
                          const year1 = monthly * 12;
                          const slComm = Math.round(year1 * (revenueCommission / 100));
                          const ltv = s.churn > 0 ? Math.round(price / s.churn) : price * 12;
                          const pct = primaryF > 0 ? ((clients / primaryF) * 100).toFixed(2) : "0";
                          return (
                            <div key={s.label} style={{ flex: 1, padding: 14, borderRadius: 8, background: "#0a0a0a", border: `1px solid ${s.border}` }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{s.label}</div>
                              <div style={{ fontSize: 11, color: "#666", marginBottom: 3 }}>Active clients: <span style={{ color: "#f5f5f5", fontWeight: 600 }}>{clients.toLocaleString()}</span></div>
                              <div style={{ fontSize: 11, color: "#666", marginBottom: 3 }}>% of followers: <span style={{ color: "#888" }}>{pct}%</span></div>
                              <div style={{ paddingTop: 8, marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                <div style={{ fontSize: 11, color: "#666", marginBottom: 3 }}>Monthly: <span style={{ color: "#f5f5f5", fontWeight: 600 }}>{fmt(monthly)}</span></div>
                                <div style={{ fontSize: 11, color: "#666", marginBottom: 3 }}>Year 1: <span style={{ color: "#f5f5f5", fontWeight: 600 }}>{fmt(year1)}</span></div>
                                <div style={{ fontSize: 11, color: "#666", marginBottom: 3 }}>LTV/client: <span style={{ color: "#888" }}>{fmt(ltv)}</span></div>
                                <div style={{ fontSize: 11, color: "#666" }}>SL commission: <span style={{ color: "#7A0E18", fontWeight: 600 }}>{fmt(slComm)}</span></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Funnel explanation + live calculation breakdown */}
                      {(() => {
                        const mod = scenarios[1];
                        const vrAdj = mod.vr * engMultiplier;
                        const step1 = Math.round(primaryF * vrAdj);
                        const step2 = Math.round(step1 * mod.lr);
                        const step3 = Math.round(step2 * mod.cr);
                        const step4 = step3 * mod.p;
                        const step5 = Math.round(step4 * (1 - mod.churn));
                        const maxCap = Math.round(primaryF * mod.cap);
                        const finalClients = Math.min(step5, maxCap);
                        const capped = step5 > maxCap;
                        return (
                          <div style={{ padding: "16px 18px", borderRadius: 8, background: "rgba(122,14,24,0.05)", border: "1px solid rgba(122,14,24,0.1)", fontSize: 11, color: "#888", lineHeight: 1.8 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#888", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>How we calculate (Moderate scenario)</div>

                            <div style={{ marginBottom: 12, color: "#666", lineHeight: 1.7 }}>
                              Your followers go through 5 filters. Only the ones who survive all 5 become paying clients.
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 18, height: 18, borderRadius: 4, background: "rgba(122,14,24,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#7A0E18", flexShrink: 0 }}>1</span>
                                <span style={{ color: "#888" }}><strong style={{ color: "#ccc" }}>See it</strong> — {(vrAdj * 100).toFixed(1)}% of followers see the offer (15% base × {engMultiplier.toFixed(2)}x engagement)</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 18, height: 18, borderRadius: 4, background: "rgba(122,14,24,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#7A0E18", flexShrink: 0 }}>2</span>
                                <span style={{ color: "#888" }}><strong style={{ color: "#ccc" }}>Click</strong> — {(mod.lr * 100)}% of those click the link to learn more</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 18, height: 18, borderRadius: 4, background: "rgba(122,14,24,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#7A0E18", flexShrink: 0 }}>3</span>
                                <span style={{ color: "#888" }}><strong style={{ color: "#ccc" }}>Buy</strong> — {(mod.cr * 100)}% of those actually pay</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 18, height: 18, borderRadius: 4, background: "rgba(122,14,24,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#7A0E18", flexShrink: 0 }}>4</span>
                                <span style={{ color: "#888" }}><strong style={{ color: "#ccc" }}>Stack</strong> — New batch every month for {mod.p} months, clients accumulate</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 18, height: 18, borderRadius: 4, background: "rgba(122,14,24,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#7A0E18", flexShrink: 0 }}>5</span>
                                <span style={{ color: "#888" }}><strong style={{ color: "#ccc" }}>Stay</strong> — {((1 - mod.churn) * 100)}% of clients stay each month ({(mod.churn * 100)}% churn)</span>
                              </div>
                            </div>

                            <div style={{ padding: "12px 14px", borderRadius: 6, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.04)", fontFamily: "monospace", fontSize: 11, color: "#ccc", lineHeight: 2 }}>
                              <div>{primaryF.toLocaleString()} followers</div>
                              <div>× {(vrAdj * 100).toFixed(1)}% see it = <span style={{ color: "#f5f5f5" }}>{step1.toLocaleString()}</span> people</div>
                              <div>× {(mod.lr * 100)}% click = <span style={{ color: "#f5f5f5" }}>{step2.toLocaleString()}</span> people</div>
                              <div>× {(mod.cr * 100)}% buy = <span style={{ color: "#f5f5f5" }}>{step3.toLocaleString()}</span> new clients/month</div>
                              <div>× {mod.p} months stacked = <span style={{ color: "#f5f5f5" }}>{step4.toLocaleString()}</span> total</div>
                              <div>× {((1 - mod.churn) * 100)}% stay = <span style={{ color: "#7A0E18", fontWeight: 700 }}>{step5.toLocaleString()} active clients</span></div>
                              {capped && <div style={{ color: "#eab308", marginTop: 4 }}>Capped at {(mod.cap * 100)}% of followers = {maxCap.toLocaleString()} clients</div>}
                            </div>

                            {/* Engagement multiplier reference table */}
                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#888", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Engagement Rate Impact</div>
                              <div style={{ fontSize: 10, color: "#666", marginBottom: 10, lineHeight: 1.5 }}>The engagement rate determines how many followers actually see the offer. A creator with high engagement has an audience that pays attention. Low engagement means a passive audience that scrolls past.</div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, fontSize: 10, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.04)", fontWeight: 700, color: "#888" }}>Engagement</div>
                                <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.04)", fontWeight: 700, color: "#888" }}>Multiplier</div>
                                <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.04)", fontWeight: 700, color: "#888" }}>Effect</div>
                                {[
                                  { eng: "0.5%", mult: "0.63x", effect: "-37% visibility", color: "#ef4444" },
                                  { eng: "1.0%", mult: "0.75x", effect: "-25% visibility", color: "#ef4444" },
                                  { eng: "2.0%", mult: "1.0x", effect: "baseline", color: "#f5f5f5", bold: true },
                                  { eng: "3.0%", mult: "1.25x", effect: "+25% visibility", color: "#eab308" },
                                  { eng: "5.0%", mult: "1.75x", effect: "+75% visibility", color: "#22c55e" },
                                  { eng: "10.0%", mult: "3.0x", effect: "+200% (capped)", color: "#22c55e" },
                                ].map((row, i) => (
                                  <div key={i} style={{ display: "contents" }}>
                                    <div style={{ padding: "5px 10px", borderTop: "1px solid rgba(255,255,255,0.04)", color: row.bold ? "#f5f5f5" : "#888", fontWeight: row.bold ? 700 : 400 }}>{row.eng}</div>
                                    <div style={{ padding: "5px 10px", borderTop: "1px solid rgba(255,255,255,0.04)", color: row.color, fontWeight: 600 }}>{row.mult}</div>
                                    <div style={{ padding: "5px 10px", borderTop: "1px solid rgba(255,255,255,0.04)", color: row.color, fontWeight: row.bold ? 700 : 400 }}>{row.effect}</div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div style={{ marginTop: 10, fontSize: 10, color: "#555" }}>
                              Benchmark: 2% (avg Instagram creator). Max cap per scenario: {(mod.cap * 100)}% of followers. Price: {fmt(defaultPrice)}/mês ({rawPriceMatch ? "from offer" : "niche DB"}).
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })() : renderMd(creator.offer.parsed?.[offerTab])}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "#444" }}>Gerado: {new Date(creator.offer.generatedAt).toLocaleString("pt-PT")}</div>
            </div>
          )}
        </>)}

        {/* ════════════ LAUNCH TAB ════════════ */}
        {tab === "launch" && (<>
          {!creator.offer ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ width: 40, height: 40, margin: "0 auto 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#444" }}>&#128274;</div>
              <p style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>Launch bloqueado</p>
              <p style={{ fontSize: 12, color: "#444", marginBottom: 20 }}>Cria primeiro a oferta para desbloquear o launch blueprint.</p>
              <button onClick={() => setTab("oferta")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#888", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Ir para Oferta</button>
            </div>
          ) : (
            <div>
              {/* Progress bar */}
              {(() => {
                const allAssets = LAUNCH_PHASES.flatMap(p => p.assets);
                const done = allAssets.filter(a => creator.launch?.[a.key]).length;
                const total = allAssets.length;
                const approved = allAssets.filter(a => creator.launch?.[a.key]?.status === 'approved' || creator.launch?.[a.key]?.status === 'live').length;
                return (
                  <div style={{ marginBottom: 24, padding: "16px 20px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5" }}>Launch Progress</span>
                      <span style={{ fontSize: 11, color: "#888" }}>{done}/{total} gerados &middot; {approved}/{total} aprovados</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", display: "flex" }}>
                      <div style={{ height: 4, background: "#22c55e", width: (approved / total * 100) + "%", transition: "width 0.3s" }} />
                      <div style={{ height: 4, background: "#eab308", width: ((done - approved) / total * 100) + "%", transition: "width 0.3s" }} />
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                      <span style={{ fontSize: 9, color: "#555", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} /> Aprovado</span>
                      <span style={{ fontSize: 9, color: "#555", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#eab308", display: "inline-block" }} /> Draft</span>
                      <span style={{ fontSize: 9, color: "#555", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: "rgba(255,255,255,0.1)", display: "inline-block" }} /> Pendente</span>
                    </div>
                  </div>
                );
              })()}

              <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>Launch Blueprint para {creator.name}. Cada asset é gerado com base nos dados do creator, oferta, e knowledge base de marketing.</p>
              {launchError && <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 11, marginBottom: 16 }}>{launchError}</div>}

              {LAUNCH_PHASES.map(phase => (
                <div key={phase.phase} style={{ marginBottom: 28 }}>
                  <h3 style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>{phase.phase}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {phase.assets.map(asset => {
                      const saved = creator.launch?.[asset.key];
                      const isGenerating = launchGenerating === asset.key;
                      const isExpanded = launchExpanded === asset.key;
                      const isEditMode = launchEditing === asset.key;
                      const status = saved?.status || (saved ? 'draft' : null);
                      const STATUS_COLORS = { draft: { bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.25)", color: "#eab308", label: "Draft" }, reviewed: { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.25)", color: "#3b82f6", label: "Em Revisão" }, approved: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", color: "#22c55e", label: "Aprovado" }, live: { bg: "rgba(122,14,24,0.15)", border: "rgba(122,14,24,0.3)", color: "#7A0E18", label: "Live" } };
                      const sc = STATUS_COLORS[status] || {};
                      return (
                        <div key={asset.key} style={{ background: "#141414", border: `1px solid ${saved ? sc.border || "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)"}`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: saved ? "pointer" : "default" }}
                            onClick={() => saved && !isEditMode && setLaunchExpanded(isExpanded ? null : asset.key)}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5" }}>{asset.label}</span>
                                {status && <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 4, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>}
                              </div>
                              <span style={{ fontSize: 11, color: "#555", marginTop: 2, display: "block" }}>{asset.desc}</span>
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              {isGenerating && <div style={{ width: 16, height: 16, border: "2px solid #222", borderTopColor: "#7A0E18", borderRadius: "50%", animation: "sl-spin 0.8s linear infinite" }} />}
                              {!isGenerating && (
                                <button onClick={e => { e.stopPropagation(); generateLaunchAsset(asset.key); }}
                                  style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: saved ? "transparent" : "#7A0E18", color: saved ? "#888" : "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", ...(saved ? { border: "1px solid rgba(255,255,255,0.06)" } : {}) }}>
                                  {saved ? "Regenerar" : "Gerar"}
                                </button>
                              )}
                              {saved && <span style={{ fontSize: 18, color: "#444", cursor: "pointer" }}>{isExpanded ? "−" : "+"}</span>}
                            </div>
                          </div>

                          {/* Streaming preview while generating */}
                          {isGenerating && launchStreamText && isExpanded && (
                            <div style={{ padding: "0 18px 18px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                              <div style={{ fontSize: 10, color: "#7A0E18", margin: "10px 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#7A0E18", animation: "sl-pulse 1.5s ease-in-out infinite" }} />
                                A gerar...
                              </div>
                              <div style={{ padding: 16, background: "#0a0a0a", borderRadius: 8, fontSize: 13, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 500, overflowY: "auto" }}>
                                {renderMd(launchStreamText)}
                              </div>
                            </div>
                          )}

                          {/* Saved content — view or edit mode */}
                          {saved && isExpanded && !isGenerating && (
                            <div style={{ padding: "0 18px 18px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                              {/* Toolbar */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 12px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 10, color: "#444" }}>Gerado: {new Date(saved.generatedAt).toLocaleString("pt-PT")}</span>
                                </div>
                                <div style={{ display: "flex", gap: 4 }}>
                                  {/* Copy button */}
                                  <button onClick={() => navigator.clipboard.writeText(saved.content)} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#666", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>Copiar</button>
                                  {/* Edit toggle */}
                                  <button onClick={() => { if (isEditMode) { setLaunchEditing(null); } else { setLaunchEditing(asset.key); setLaunchEditContent(saved.content); }}}
                                    style={{ padding: "4px 10px", borderRadius: 4, border: `1px solid ${isEditMode ? "rgba(122,14,24,0.3)" : "rgba(255,255,255,0.06)"}`, background: isEditMode ? "rgba(122,14,24,0.1)" : "transparent", color: isEditMode ? "#7A0E18" : "#666", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>
                                    {isEditMode ? "Cancelar" : "Editar"}
                                  </button>
                                  {/* Status cycle */}
                                  {['draft', 'reviewed', 'approved', 'live'].map(s => {
                                    const c = STATUS_COLORS[s];
                                    const isActive = status === s;
                                    return (
                                      <button key={s} onClick={() => patchCreator({ launch: { [asset.key]: { ...saved, status: s } } })}
                                        style={{ padding: "4px 8px", borderRadius: 4, border: `1px solid ${isActive ? c.border : "rgba(255,255,255,0.04)"}`, background: isActive ? c.bg : "transparent", color: isActive ? c.color : "#444", fontSize: 8, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                        {c.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Edit mode */}
                              {isEditMode ? (
                                <div>
                                  <textarea value={launchEditContent} onChange={e => setLaunchEditContent(e.target.value)}
                                    style={{ width: "100%", minHeight: 400, padding: 16, background: "#0a0a0a", border: "1px solid rgba(122,14,24,0.2)", borderRadius: 8, fontSize: 13, color: "#ccc", lineHeight: 1.7, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                                    <button onClick={() => { setLaunchEditContent(saved.content); }}
                                      style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#888", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Reset</button>
                                    <button onClick={async () => { await patchCreator({ launch: { [asset.key]: { ...saved, content: launchEditContent, editedAt: new Date().toISOString() } } }); setLaunchEditing(null); }}
                                      style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#7A0E18", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Guardar</button>
                                  </div>
                                </div>
                              ) : (
                                /* View mode */
                                <div style={{ padding: 16, background: "#0a0a0a", borderRadius: 8, fontSize: 13, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 500, overflowY: "auto" }}>
                                  {renderMd(saved.content)}
                                </div>
                              )}
                              {saved.editedAt && !isEditMode && <div style={{ fontSize: 9, color: "#333", marginTop: 4 }}>Editado: {new Date(saved.editedAt).toLocaleString("pt-PT")}</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <style>{`@keyframes sl-spin{to{transform:rotate(360deg)}} @keyframes sl-pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
            </div>
          )}
        </>)}

        {/* ════════════ PITCH TAB ════════════ */}
        {tab === "pitch" && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            {creator.offer ? (<>
              <p style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>Pitch page para {creator.name}.</p>
              <p style={{ fontSize: 11, color: "#444", marginBottom: 24 }}>Editável inline e exportável para PPTX. Dados do creator e oferta carregados automaticamente.</p>
              <a href={`/pitch?creatorId=${params?.id}`} style={{ display: "inline-block", padding: "12px 32px", borderRadius: 8, background: "#7A0E18", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>
                Abrir Pitch
              </a>
            </>) : (<>
              <div style={{ width: 40, height: 40, margin: "0 auto 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#444" }}>&#128274;</div>
              <p style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>Pitch bloqueado</p>
              <p style={{ fontSize: 12, color: "#444", marginBottom: 20 }}>Cria primeiro a oferta no tab "Oferta" para desbloquear o pitch.</p>
              <button onClick={() => setTab("oferta")} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#888", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Ir para Oferta
              </button>
            </>)}
          </div>
        )}

      </div>
      )}
    </div>
  );
}

export default function CreatorProfilePage(props) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#555", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>A carregar...</div>}>
      <CreatorProfilePageImpl {...props} />
    </Suspense>
  );
}
