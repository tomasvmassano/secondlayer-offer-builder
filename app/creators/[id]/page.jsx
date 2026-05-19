"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { calculateDealScore } from "../../lib/dealScore";
import { SCENARIOS as REVENUE_SCENARIOS, calculateSteadyMRR as sharedCalcMRR, calculateOfferRevenue, projectEcosystemRevenue, classifyTierBucket, estimateCurrentBuyers, TIER_CONVERSION_CAP } from "../../lib/revenue";
import { renderMd, parseOutput, extractAudience } from "../../lib/offerParser";
import { legacyParsedToOfferState, CHECKPOINTS, readCheckpointProgress, readOfferState } from "../../lib/offerSchema";
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
  { key: "audit", label: "Audit" },
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

// Defined at module level so React never sees a new component type on re-render.
// If defined inside the render function, every keystroke causes remount + cursor reset.
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

const PendingEmailCard = ({ label, hint, loading, onClick }) => (
  <div style={{ padding: "16px 18px", borderRadius: 8, background: "transparent", border: "1px dashed rgba(255,255,255,0.08)", marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#555" }}>{label}</span>
        <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 3, background: "rgba(255,255,255,0.03)", color: "#555", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>pendente</span>
      </div>
      <button onClick={onClick} disabled={loading} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid rgba(122,14,24,0.35)", background: loading ? "transparent" : "rgba(122,14,24,0.08)", color: loading ? "#555" : "#B11E2F", fontSize: 10, fontWeight: 600, cursor: loading ? "wait" : "pointer", fontFamily: "inherit" }}>
        {loading ? "A gerar..." : "Gerar"}
      </button>
    </div>
    <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>{hint}</div>
  </div>
);

// Inline instruction textarea + re-run button. Shown on every wizard CP panel
// below the main action row so the operator can steer a re-generation
// ("emphasise the missing mid-tier", "shorten bullet 0", etc.) without
// unlocking + cascading. The textarea is uncontrolled-on-mount (uses defaultValue + ref) so typing
// doesn't re-render the parent panel and reset cursor.
const RegenWithInstructionBlock = ({ placeholder, busy, onRegen, disabled }) => {
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  if (disabled) return null;
  return (
    <div style={{ marginTop: 12 }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          disabled={busy}
          style={{ padding: "6px 12px", borderRadius: 4, border: "1px dashed rgba(255,255,255,0.12)", background: "transparent", color: "#888", fontSize: 10, fontWeight: 600, cursor: busy ? "wait" : "pointer", fontFamily: "inherit", letterSpacing: "0.04em" }}
        >
          + Regenerar com instrução
        </button>
      ) : (
        <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
          <textarea
            ref={inputRef}
            placeholder={placeholder || "Ex: 'mais conservador', 'foca no upgrade path do high-ticket', etc."}
            defaultValue=""
            disabled={busy}
            rows={2}
            style={{ flex: 1, padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "#ddd", fontSize: 11, fontFamily: "inherit", resize: "vertical", minHeight: 38 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button
              onClick={() => {
                const val = (inputRef.current?.value || '').trim();
                onRegen(val || null);
                setOpen(false);
              }}
              disabled={busy}
              style={{ padding: "8px 14px", borderRadius: 4, border: "1px solid rgba(122,14,24,0.45)", background: busy ? "rgba(255,255,255,0.02)" : "rgba(122,14,24,0.08)", color: busy ? "#555" : "#B11E2F", fontSize: 10, fontWeight: 700, cursor: busy ? "wait" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              {busy ? "..." : "↻ Regenerar"}
            </button>
            <button
              onClick={() => setOpen(false)}
              disabled={busy}
              style={{ padding: "4px 14px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#555", fontSize: 9, fontWeight: 500, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}
            >
              cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

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
  const [runningFullScrape, setRunningFullScrape] = useState(false);
  // Phase 1 — Ecosystem Audit run state. Operator-only; output lives under
  // creator.offer.internal_metadata.ecosystem_audit and is NEVER shown to creators.
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [auditDiag, setAuditDiag] = useState(null);
  // Phase 2 — Archetype + Fame Tier. Same internal-only treatment.
  const [archetypeRunning, setArchetypeRunning] = useState(false);
  const [archetypeError, setArchetypeError] = useState(null);
  const [archetypeDiag, setArchetypeDiag] = useState(null);
  // Phase 3 — Uniqueness Extraction (5-8 differentiator elements + voice).
  // Internal-only. Phase 4 wizard translates strongest elements into sales copy.
  const [uniquenessRunning, setUniquenessRunning] = useState(false);
  const [uniquenessError, setUniquenessError] = useState(null);
  const [uniquenessDiag, setUniquenessDiag] = useState(null);
  // Phase 4 · CP1 — Strategic Frame (operator-language strategic commitment).
  // Internal-only; never rendered to creator.
  const [frameRunning, setFrameRunning] = useState(false);
  const [frameError, setFrameError] = useState(null);
  const [frameDiag, setFrameDiag] = useState(null);
  // Phase 4 · CP2 — Core Offer (first creator-facing checkpoint).
  // Writes the offer spine into client_facing_output.
  const [coreOfferRunning, setCoreOfferRunning] = useState(false);
  const [coreOfferError, setCoreOfferError] = useState(null);
  const [coreOfferDiag, setCoreOfferDiag] = useState(null);
  // Phase 4 · CP3 — Modules. 4-8 curriculum modules. Single-module regen
  // supported — `regenBusy` maps index → in-flight bool so the operator can
  // regenerate one card without blocking others (in principle; we serialise
  // for now to keep state simple).
  const [modulesRunning, setModulesRunning] = useState(false);
  const [modulesError, setModulesError] = useState(null);
  const [modulesDiag, setModulesDiag] = useState(null);
  // Phase 4 · CP4 — Value Stack + Pricing. Largest output of any CP
  // (mechanism + stack + tiers + bonuses all in one).
  const [stackRunning, setStackRunning] = useState(false);
  const [stackError, setStackError] = useState(null);
  const [stackDiag, setStackDiag] = useState(null);
  // Phase 4 · CP5 — Sales Copy (final assembly).
  // differentiator_section, hero, objections, faq, social_proof_line.
  const [copyRunning, setCopyRunning] = useState(false);
  const [copyError, setCopyError] = useState(null);
  const [copyDiag, setCopyDiag] = useState(null);
  const nameRef = useRef(null);

  // DM Writer state
  const [dmLoading, setDmLoading] = useState(false);
  const [dmError, setDmError] = useState(null);
  const [dmTemplate, setDmTemplate] = useState("A");
  const [dmNotes, setDmNotes] = useState("");
  const [dmInputs, setDmInputs] = useState({});
  // Signed-in operator's display name (Tomás / Raúl) — used as the DM signer
  // so the message goes out under whoever's actually generating it. Fetched
  // once from /api/auth/me; falls back to "Raul" if the call fails so legacy
  // behaviour is preserved.
  const [senderName, setSenderName] = useState("Raul");
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
  const [revenueLaunches, setRevenueLaunches] = useState(null);   // one-time only
  const [revenuePaymentPlan, setRevenuePaymentPlan] = useState(false);
  // Hydrate revenue inputs from creator record on load (single source of truth)
  useEffect(() => {
    if (!creator) return;
    if (revenuePrice == null && creator.revenuePrice != null) setRevenuePrice(creator.revenuePrice);
    if (creator.revenueCommission != null) setRevenueCommission(creator.revenueCommission);
    if (engagementRate == null && creator.revenueEngagement != null) setEngagementRate(creator.revenueEngagement);
    if (revenueLaunches == null && creator.revenueLaunches != null) setRevenueLaunches(creator.revenueLaunches);
    if (creator.revenuePaymentPlan != null) setRevenuePaymentPlan(!!creator.revenuePaymentPlan);
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
      if (revenueLaunches != null) payload.revenueLaunches = revenueLaunches;
      payload.revenuePaymentPlan = revenuePaymentPlan;
      fetch(`/api/creators/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(handle);
  }, [revenuePrice, revenueCommission, engagementRate, revenueLaunches, revenuePaymentPlan, params?.id, creator?.id]);
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

  // One-shot fetch of the signed-in operator's display name so DMs go out
  // under Tomás / Raúl based on who's actually generating. Falls back to
  // "Raul" silently if /api/auth/me 401s (legacy behaviour).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.user?.firstName) setSenderName(d.user.firstName); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
    const firstName = (creator.name || "").split(" ")[0];
    setDmInputs({ _filled: true, primeiro_nome: firstName });
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

  // — DM Writer generate (staged) —
  // stage: 'initial' generates DM + T+3 comment + Email Day 1 only.
  // stage: 'followup_7' / 'followup_14' generates just that single email later,
  // when the operator's actually about to send it (saves output tokens on the
  // ~80% of creators who never reach the follow-up stage).
  const generateDM = useCallback(async (stage = 'initial') => {
    if (!creator) return;
    setDmLoading(true); setDmError(null);
    try {
      const r = await fetch("/api/dm-writer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          template: dmTemplate,
          senderName,
          inputs: {
            primeiro_nome: dmInputs.primeiro_nome || "",
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
            ecosystemAudit: creator.offer?.internal_metadata?.ecosystem_audit,
          },
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      const data = await r.json();
      // Merge into existing dmSequence so initial + followups accumulate over
      // time. `generatedAt` is only set on the initial generation (anchor for
      // the dm-reminders cron); followups stamp their own timestamps.
      const existing = creator.dmSequence || {};
      const now = new Date().toISOString();
      let merged;
      if (stage === 'followup_7') {
        merged = { ...existing, email_day7: data.email_day7, followup7GeneratedAt: now };
      } else if (stage === 'followup_14') {
        merged = { ...existing, email_day14: data.email_day14, followup14GeneratedAt: now };
      } else {
        // initial — full replace of opening fields, preserve any earlier followups
        merged = { ...existing, ...data, generatedAt: now };
      }
      await patchCreator({ dmSequence: merged });
      if (data.inputs) setDmInputs({ _filled: true, ...data.inputs });
    } catch (e) { setDmError(e.message); } finally { setDmLoading(false); }
  }, [creator, dmTemplate, dmInputs, dmNotes, senderName, patchCreator]);

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
      // Mark creator as replied — stops reminder digest from pinging them again.
      // Defaults channel to 'dm' since this flow runs from the DM Writer's
      // reply box (operator pastes the IG DM into the textarea). Operator
      // can flip via the chip if it actually came in by email.
      await patchCreator({ outreach: { ...(creator.outreach || {}), repliedAt: new Date().toISOString(), repliedChannel: 'dm' } });
    } catch (e) { setReplyError(e.message); } finally { setReplyLoading(false); }
  }, [replyText, creator, patchCreator]);

  // Outreach helpers — mark DM / email / follow-up as sent so the reminder cron
  // knows which milestone is next AND the dashboard can compute per-channel
  // reply rates. Each is one server round-trip. Follow-up + reply now carry
  // a channel ('dm' | 'email') so we can answer "where do replies actually
  // come from".
  const markOutreach = useCallback(async (field) => {
    const now = new Date().toISOString();
    const cur = creator?.outreach || {};
    const patch = { ...cur };
    if (field === 'dm')    patch.dmSentAt = now;
    if (field === 'email') patch.emailSentAt = now;
    if (field === 'followUpDm' || field === 'followUpEmail') {
      const existingArr = Array.isArray(cur.followUps) ? cur.followUps : [];
      if (existingArr.length >= 3) return; // cap stays at 3 across channels
      const channel = field === 'followUpDm' ? 'dm' : 'email';
      patch.followUps = [...existingArr, { channel, at: now }]; // server stamps `by`
    }
    if (field === 'repliedDm')    { patch.repliedAt = now; patch.repliedChannel = 'dm'; }
    if (field === 'repliedEmail') { patch.repliedAt = now; patch.repliedChannel = 'email'; }
    if (field === 'unreplied')    { patch.repliedAt = null; patch.repliedChannel = null; }
    if (field === 'callAgreed')   patch.callAgreedAt = now;
    if (field === 'uncallAgreed') patch.callAgreedAt = null;
    if (field === 'callHeld')     patch.callHeldAt = now;
    if (field === 'uncallHeld')   patch.callHeldAt = null;
    await patchCreator({ outreach: patch });
  }, [creator, patchCreator]);

  // Mark creator cold + capture the loss reason so the dashboard can show
  // why deals die. lostReason is required — the prompt loops until the
  // operator either picks one or cancels.
  const markCold = useCallback(async () => {
    const reasons = [
      ['price',      'Preço'],
      ['timing',     'Timing'],
      ['fit',        'Não encaixa'],
      ['ghost',      'Não respondeu'],
      ['competitor', 'Concorrente'],
      ['other',      'Outro'],
    ];
    const msg = 'Razão de perda?\n\n' + reasons.map((r, i) => `${i + 1}. ${r[1]}`).join('\n') + '\n\nEscreve 1-6 (ou cancela):';
    const raw = window.prompt(msg, '');
    if (!raw) return;
    const idx = Number(String(raw).trim()) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= reasons.length) {
      window.alert('Opção inválida — cancela.');
      return;
    }
    const [reasonKey] = reasons[idx];
    await patchCreator({
      pipelineStatus: 'cold',
      lostReason: reasonKey,
      lostAt: new Date().toISOString(),
    });
  }, [patchCreator]);

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
          senderName,
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
  }, [creator, rewriteInstruction, senderName, patchCreator]);

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

      // Top-performing content (signals what audience already responds to —
      // used to name weekly formats + pre-recorded library themes in Section K).
      const topPosts = (creator.intelligence?.topPosts || []).slice(0, 10);
      if (topPosts.length > 0) {
        msg += `\n## TOP-PERFORMING CONTENT (audience signals from public scrape)\n\n`;
        msg += `Use these to theme Section K's Weekly Content Formats + Pre-recorded Library — these are formats/topics the audience already engages with.\n\n`;
        topPosts.forEach((p, i) => {
          msg += `${i + 1}. [${p.format || 'post'} · ${p.engagementRate || '?'}%] ${p.topic || ''}${p.caption ? ` — "${String(p.caption).slice(0, 140)}"` : ''}\n`;
        });
      }

      if (meetingContext) msg += `\n## MEETING NOTES (from direct conversation with the creator)\n\n${meetingContext}\n`;
      msg += `\n---\nGenerate all three outputs now. Follow system instructions and Hormozi frameworks exactly.\n**IMPORTANT: Write the ENTIRE output in ${(ae.language || "").toLowerCase().includes("portugu") ? "Português" : "English"}.** All section titles, analysis, tables, objection scripts — everything.`;

      // Pre-close offer: server-side composes Hormozi skills + REAL Skool case
      // studies + the closing skill (so the objection-handling Output 6 uses the
      // blame-bucket classification with a named close per objection).
      const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: OFFER_SYSTEM_PROMPT, message: msg, skills: ['hundred-million-offers', 'money-model', 'pricing-plays', 'case-studies', 'closing'] }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "API error");
      const d = await r.json();
      const text = d.content?.map(c => c.text || "").join("\n") || "";
      const parsed = parseOutput(text);
      // Extract recommended price from the offer so the Pitch Numbers slide
      // and Revenue Projector use the SAME price the team is pitching.
      // Looks for "RECOMMENDED MONTHLY PRICE: €79" or "PREÇO MENSAL RECOMENDADO: €79".
      const priceMatch = text.match(/(?:RECOMMENDED MONTHLY PRICE|PRE[CÇ]O MENSAL RECOMENDADO)\s*[:\-]?\s*€?\s*(\d{1,4})/i)
        || (parsed.community?.tiers?.[0]?.price?.match(/(\d{1,4})/));
      const recPrice = priceMatch ? parseInt(priceMatch[1] || priceMatch[0], 10) : null;
      // Write the new dual schema alongside `parsed` for back-compat. Consumers
      // (pitch deck, launch-plan PDF) prefer client_facing_output and fall back
      // to parsed for legacy creators. When the wizard ships in Phase 4 it'll
      // write client_facing_output directly and `parsed` can be dropped.
      const { internal_metadata, client_facing_output } = legacyParsedToOfferState(parsed);
      const updates = {
        offer: {
          raw: text,
          parsed,
          internal_metadata,
          client_facing_output,
          generatedAt: new Date().toISOString(),
        },
      };
      if (recPrice && recPrice > 0) updates.revenuePrice = recPrice;
      await patchCreator(updates);
      setOfferTab("offer");
    } catch (e) { setOfferError(e.message); } finally { setOfferLoading(false); }
  }, [creator, offerForm, patchCreator]);

  // Run full scrape — upgrades a lean creator with the deep IG + TikTok +
  // YouTube + bio-link products + web-search competitors data needed to build
  // the offer. Long-running (up to ~90s). Refreshes the creator on completion.
  const runFullScrape = useCallback(async () => {
    if (!creator?.id) return;
    const links = [
      creator.platforms?.instagram?.url,
      creator.tiktokUrl || creator.platforms?.tiktok?.url,
      creator.youtubeUrl || creator.platforms?.youtube?.url,
    ].filter(Boolean);
    if (links.length === 0) {
      window.alert('Este creator não tem links de plataforma para scrape.');
      return;
    }
    if (!window.confirm(`Correr full scrape para ${creator.name}?\n\nVai correr:\n• Instagram (deep + bot detector)\n${creator.tiktokUrl || creator.platforms?.tiktok?.url ? '• TikTok\n' : ''}${creator.youtubeUrl || creator.platforms?.youtube?.url ? '• YouTube\n' : ''}• Bio-link products discovery\n• Web-search analysis (products + competitors)\n\nPode demorar até 90s.`)) return;
    setRunningFullScrape(true);
    setSaving('A correr full scrape...');
    try {
      const r = await fetch(`/api/creators/${creator.id}/full-scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Full scrape failed');
      if (data.creator) setCreator(data.creator);
      setSaving('Full scrape concluído');
      setTimeout(() => setSaving(''), 2500);
    } catch (err) {
      setSaving('Erro: ' + (err.message || 'falhou'));
      setTimeout(() => setSaving(''), 4000);
    } finally {
      setRunningFullScrape(false);
    }
  }, [creator]);

  // ── Phase 1 · Ecosystem Audit ──
  // Maps the creator's existing product ecosystem (every IG bio link, every
  // bio-link aggregator destination, every product on intelligence.bioLinks)
  // and decides the strategic role of the future paid community within their
  // funnel. Output is internal_metadata only — never rendered to the creator.
  // Long-running (web_search Claude call, up to ~90s).
  const runEcosystemAudit = useCallback(async () => {
    if (!creator?.id || auditRunning) return;
    setAuditRunning(true);
    setAuditError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/ecosystem-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (!r.ok) {
        const detail = data.errors?.length ? '\n\n' + data.errors.join('\n') : '';
        throw new Error((data.error || 'Audit failed') + detail);
      }
      setAuditDiag(data._diagnostics || null);
      // Merge the audit into the local creator state so the viewer updates
      // without a full reload. Server already persisted to Redis.
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            ecosystem_audit: data.ecosystem_audit,
          },
        },
      }) : prev);
    } catch (err) {
      setAuditError(err.message || 'Falha desconhecida');
    } finally {
      setAuditRunning(false);
    }
  }, [creator, auditRunning]);

  // ── Phase 2 · Archetype + Fame Tier ──
  // Classifies the creator into one of 6 archetypes and assesses fame tier
  // (external recognition signals, not follower count). Stays in
  // internal_metadata — the creator NEVER sees their archetype label.
  const runArchetype = useCallback(async () => {
    if (!creator?.id || archetypeRunning) return;
    setArchetypeRunning(true);
    setArchetypeError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/archetype`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (!r.ok) {
        const detail = data.errors?.length ? '\n\n' + data.errors.join('\n') : '';
        throw new Error((data.error || 'Archetype classification failed') + detail);
      }
      setArchetypeDiag(data._diagnostics || null);
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            archetype_classification: data.archetype_classification,
          },
        },
      }) : prev);
    } catch (err) {
      setArchetypeError(err.message || 'Unknown error');
    } finally {
      setArchetypeRunning(false);
    }
  }, [creator, archetypeRunning]);

  // ── Phase 3 · Uniqueness Extraction ──
  // Extracts 5-8 concrete differentiator elements (each with evidence citation)
  // plus a creator_voice_summary. Pure Sonnet call, no web_search — Phase 1
  // (ecosystem) + Phase 2 (archetype) outputs are passed in as context so the
  // model doesn't re-derive them. Output is internal_metadata only; Phase 4
  // wizard will translate strongest elements into sales-language copy that
  // lands in client_facing_output.differentiator_section.
  const runUniqueness = useCallback(async () => {
    if (!creator?.id || uniquenessRunning) return;
    setUniquenessRunning(true);
    setUniquenessError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/uniqueness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (!r.ok) {
        const detail = data.errors?.length ? '\n\n' + data.errors.join('\n') : '';
        throw new Error((data.error || 'Uniqueness extraction failed') + detail);
      }
      setUniquenessDiag(data._diagnostics || null);
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            uniqueness_extraction: data.uniqueness_extraction,
          },
        },
      }) : prev);
    } catch (err) {
      setUniquenessError(err.message || 'Unknown error');
    } finally {
      setUniquenessRunning(false);
    }
  }, [creator, uniquenessRunning]);

  // Re-parse button — re-runs parseOutput on existing offer.raw without burning a new API call.
  // Useful when parser improves and stale parsed data needs refresh. Refreshes
  // both `parsed` (back-compat) and the derived `client_facing_output`.
  const reparseOffer = useCallback(async () => {
    if (!creator?.offer?.raw) return;
    const parsed = parseOutput(creator.offer.raw);
    const text = creator.offer.raw;
    const priceMatch = text.match(/(?:RECOMMENDED MONTHLY PRICE|PRE[CÇ]O MENSAL RECOMENDADO)\s*[:\-]?\s*€?\s*(\d{1,4})/i)
      || (parsed.community?.tiers?.[0]?.price?.match(/(\d{1,4})/));
    const recPrice = priceMatch ? parseInt(priceMatch[1] || priceMatch[0], 10) : null;
    const { client_facing_output } = legacyParsedToOfferState(parsed);
    const updates = {
      offer: {
        ...creator.offer,
        parsed,
        client_facing_output,
        reparsedAt: new Date().toISOString(),
      },
    };
    if (recPrice && recPrice > 0) updates.revenuePrice = recPrice;
    await patchCreator(updates);
  }, [creator, patchCreator]);

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

  // Top-level view switch on the Oferta tab.
  //  - "offer"   → Phase 1-3 panels + Phase 4 wizard + Grand Slam Offer markdown
  //  - "revenue" → just the Revenue Projector (reads price from CP2.target_price
  //                first, then falls back to the legacy `RECOMMENDED MONTHLY PRICE`
  //                match, then to the niche DB)
  // Blind Spot Audit + Objection Playbook were removed — the audience-facing
  // sales copy that those tabs used to render belongs in the post-close
  // launch-assets tool. The system prompt was also trimmed (sections N+O dropped).
  const OFFER_TABS = [
    { key: "offer", label: "Grand Slam Offer" },
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
      <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", minWidth: 0 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}><img src={LOGO_B64} alt="SL" style={{ height: 16, opacity: 0.85 }} /></a>
          <span style={{ color: "#333", fontSize: 14 }}>|</span>
          <a href="/creators" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", textDecoration: "none" }}>CRM</a>
          <span style={{ color: "#333", fontSize: 14 }}>/</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888", overflow: "hidden", textOverflow: "ellipsis" }}>{creator.name}</span>
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
      <div className="sl-page" style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px" }}>

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
              {/* Analysis-derived price only — shows the operator-set revenuePrice
                  or CP2's target_price when one exists. Used to fall back to the
                  niche-DB bucket (e.g. "AI / Tech / Business" → €97/mês), which
                  surfaced a pre-analysis guess that wasn't tied to the creator
                  at all. Pre-analysis = no badge. */}
              {(() => {
                const cfoTarget = creator.offer?.client_facing_output?.target_price;
                const display = creator.revenuePrice != null
                  ? `€${creator.revenuePrice}/mês`
                  : (cfoTarget && String(cfoTarget).trim() ? String(cfoTarget).trim() : null);
                if (!display) return null;
                return <span style={{ fontSize: 11, color: "#555", padding: "3px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 4 }}>{display}</span>;
              })()}
              {/* Scrape-level chip — lean = top-of-funnel (IG only), full = ready to build offer */}
              {(() => {
                const level = creator.scrapeLevel || (creator.intelligence?.bioLinks?.length || creator.platforms?.tiktok?.followers || creator.platforms?.youtube?.subscribers ? 'full' : 'lean');
                if (level === 'full') {
                  return (
                    <span title="Full scrape concluído — IG deep + TikTok + YouTube + products + competitors" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 4, background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>● Full</span>
                  );
                }
                return (
                  <span title="Lean scrape — só Instagram. Corre full scrape antes de gerar a offer." style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 4, background: "rgba(234,179,8,0.08)", color: "#eab308", border: "1px solid rgba(234,179,8,0.25)" }}>○ Lean</span>
                );
              })()}
              {/* Run Full Scrape button — appears for lean creators before they're signed */}
              {creator.pipelineStatus !== 'signed' && (creator.scrapeLevel || 'lean') !== 'full' && (
                <button
                  onClick={runFullScrape}
                  disabled={runningFullScrape}
                  title="Corre o full scrape: Instagram deep + TikTok + YouTube + produtos do bio link + análise de competidores. Necessário antes de gerar a offer."
                  style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 4, background: runningFullScrape ? "rgba(255,255,255,0.04)" : "rgba(59,130,246,0.1)", color: runningFullScrape ? "#555" : "#3b82f6", border: `1px solid ${runningFullScrape ? "rgba(255,255,255,0.08)" : "rgba(59,130,246,0.25)"}`, cursor: runningFullScrape ? "wait" : "pointer", fontFamily: "inherit" }}
                >
                  {runningFullScrape ? "A scrapear..." : "↻ Full Scrape"}
                </button>
              )}
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
        <div className="sl-tabs sl-hscroll" style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
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
              {t.key === "audit" && creator?.offer?.internal_metadata?.ecosystem_audit && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginLeft: 6 }} />}
              {t.key === "dm" && creator.dmSequence && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginLeft: 6 }} />}
              {t.key === "oferta" && creator.offer && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginLeft: 6 }} />}
              {t.key === "launch" && Object.keys(creator.launch || {}).length > 0 && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginLeft: 6 }} />}
            </button>
          ))}
        </div>

        {/* ════════════ PERFIL TAB ════════════ */}
        {tab === "perfil" && (<div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "60% 1fr", gap: 28 }}>
          <div style={{ minWidth: 0 }}>

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
                {/* "Preço sugerido" used to render dealScore.nicheData.mid (a
                    pre-analysis bucket-price by niche category) — replaced with
                    an analysis-derived display. Shows only when revenuePrice or
                    CP2 target_price has been set. */}
                {(() => {
                  const cfoTarget = creator.offer?.client_facing_output?.target_price;
                  const display = creator.revenuePrice != null
                    ? { amount: `€${creator.revenuePrice}`, suffix: '/mês' }
                    : (cfoTarget && String(cfoTarget).trim() ? { amount: String(cfoTarget).trim(), suffix: '' } : null);
                  if (!display) return null;
                  return (
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>Preço</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5" }}>{display.amount}{display.suffix && <span style={{ fontSize: 11, color: "#555", fontWeight: 400 }}>{display.suffix}</span>}</div>
                    </div>
                  );
                })()}
              </div>
              <div className="sl-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
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
              <div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
              {(creator.bio || creator.externalUrl || creator.contactEmail) && (
                <div style={{ marginBottom: 12, padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8 }}>
                  {creator.bio && <p style={{ fontSize: 12, color: "#bbb", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{creator.bio}</p>}
                  {creator.externalUrl && <a href={creator.externalUrl.startsWith("http") ? creator.externalUrl : "https://" + creator.externalUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 6, fontSize: 11, color: "#7A0E18", textDecoration: "none" }}>{creator.externalUrl}</a>}
                  {creator.contactEmail && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.20)", borderRadius: 6 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", letterSpacing: "0.10em", textTransform: "uppercase" }}>Email</span>
                      <a href={`mailto:${creator.contactEmail}`} style={{ fontSize: 12, color: "#22c55e", textDecoration: "none", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{creator.contactEmail}</a>
                      <button
                        onClick={() => navigator.clipboard.writeText(creator.contactEmail)}
                        title="Copy email"
                        style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(34,197,94,0.25)", background: "transparent", color: "#22c55e", fontSize: 9, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              )}
              {/* IG multi-link bio — Instagram's native "Links" feature, up to 5
                  titled links per profile. Captured on every scrape; falls back
                  silently if the actor didn't return any (some accounts have
                  only one externalUrl which is already shown above). */}
              {(igData.bioLinks || []).length > 0 && (
                <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(122,14,24,0.04)", border: "1px solid rgba(122,14,24,0.15)", borderRadius: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Bio Links · {igData.bioLinks.length}</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {igData.bioLinks.map((l, i) => (
                      <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, color: "#555", minWidth: 18 }}>{String(i + 1).padStart(2, '0')}</span>
                        <span style={{ flex: 1, fontSize: 12, color: "#ccc" }}>
                          {l.title && <span style={{ fontWeight: 600, color: "#f5f5f5" }}>{l.title}</span>}
                          {l.title && l.url && <span style={{ color: "#444", margin: "0 6px" }}>·</span>}
                          <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: "#7A0E18", textDecoration: "none", wordBreak: "break-all" }}>{l.url}</a>
                        </span>
                      </li>
                    ))}
                  </ul>
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

          {/* Phase 2 — TikTok + YouTube (lean creators only) */}
          {(creator.scrapeLevel || 'lean') !== 'full' && (
            <div style={{ marginBottom: 24, padding: "16px 20px", background: "#141414", border: `1px solid ${creator.outreach?.repliedAt ? "rgba(34,197,94,0.3)" : "rgba(234,179,8,0.15)"}`, borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: creator.outreach?.repliedAt ? "#22c55e" : "#eab308" }}>
                  {creator.outreach?.repliedAt ? "● Fase 2 — Pronto para scrape completo" : "○ Fase 2 — Após o criador responder"}
                </span>
              </div>
              <p style={{ fontSize: 11, color: "#555", margin: "0 0 14px", lineHeight: 1.5 }}>
                Adiciona TikTok e YouTube para enriquecer o audit, archetype e unicidade antes de construir a offer.
              </p>
              <div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>TikTok URL</label>
                  <input type="text" style={inputStyle} placeholder="https://tiktok.com/@username"
                    defaultValue={creator.tiktokUrl || creator.platforms?.tiktok?.url || ""}
                    onBlur={e => { const v = e.target.value.trim(); const cur = creator.tiktokUrl || creator.platforms?.tiktok?.url || ""; if (v !== cur) patchCreator({ tiktokUrl: v || null }); }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>YouTube URL</label>
                  <input type="text" style={inputStyle} placeholder="https://youtube.com/@channel"
                    defaultValue={creator.youtubeUrl || creator.platforms?.youtube?.url || ""}
                    onBlur={e => { const v = e.target.value.trim(); const cur = creator.youtubeUrl || creator.platforms?.youtube?.url || ""; if (v !== cur) patchCreator({ youtubeUrl: v || null }); }}
                  />
                </div>
              </div>
              <button onClick={runFullScrape} disabled={runningFullScrape} style={{ padding: "10px 24px", borderRadius: 6, border: "none", background: creator.outreach?.repliedAt ? "#22c55e" : "rgba(234,179,8,0.12)", color: creator.outreach?.repliedAt ? "#000" : "#eab308", fontSize: 12, fontWeight: 700, cursor: runningFullScrape ? "wait" : "pointer", fontFamily: "inherit", opacity: runningFullScrape ? 0.6 : 1 }}>
                {runningFullScrape ? "A scrapear..." : "↻ Full Scrape"}
              </button>
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
          <div style={{ minWidth: 0 }}>
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

        {/* ════════════ AUDIT TAB ════════════ */}
        {tab === "audit" && (<>
          <EcosystemAuditPanel
            creator={creator}
            setCreator={setCreator}
            running={auditRunning}
            error={auditError}
            diag={auditDiag}
            onRun={runEcosystemAudit}
          />
          {creator.outreach?.repliedAt ? (
            <>
              <ArchetypePanel
                creator={creator}
                running={archetypeRunning}
                error={archetypeError}
                diag={archetypeDiag}
                onRun={runArchetype}
              />
              <UniquenessPanel
                creator={creator}
                running={uniquenessRunning}
                error={uniquenessError}
                diag={uniquenessDiag}
                onRun={runUniqueness}
              />
            </>
          ) : (
            <div style={{ marginTop: 12, padding: "24px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 8, background: "rgba(255,255,255,0.01)" }}>
              <p style={{ color: "#444", fontSize: 12, margin: "0 0 4px", fontWeight: 600 }}>Archetype + Unicidade</p>
              <p style={{ color: "#333", fontSize: 11, margin: 0 }}>Disponível após o criador responder à DM. Marca "Respondeu" na tab DM.</p>
            </div>
          )}
        </>)}

        {/* ════════════ DM WRITER TAB ════════════ */}
        {tab === "dm" && (<>
          {!creator.dmSequence && !dmLoading && (
            !creator?.offer?.internal_metadata?.ecosystem_audit ? (
              <div style={{ padding: "48px 24px", textAlign: "center", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, marginBottom: 24 }}>
                <p style={{ color: "#aaa", fontSize: 13, marginBottom: 8 }}>O Ecosystem Audit é necessário para gerar a DM.</p>
                <p style={{ color: "#666", fontSize: 11, marginBottom: 20 }}>Os dados do audit garantem que a mensagem é específica ao criador e com o ângulo certo.</p>
                <button onClick={() => setTab("audit")} style={{ padding: "10px 24px", borderRadius: 6, border: "none", background: "#7A0E18", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Correr Audit →</button>
              </div>
            ) : (
            <div>
              <div className="sl-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Primeiro Nome</label>
                  <input type="text" style={inputStyle} placeholder="Ex: Mariana" value={dmInputs.primeiro_nome || ""} onChange={e => setDmInputs(p => ({ ...p, primeiro_nome: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Template</label>
                  <select style={inputStyle} value={dmTemplate} onChange={e => setDmTemplate(e.target.value)}>
                    <option value="A">A — Second Layer (consultivo)</option>
                    <option value="B">B — Second Layer (parceria)</option>
                    <option value="C">C — Day in the Life</option>
                  </select>
                  <div style={{ fontSize: 9, color: "#444", marginTop: 6, lineHeight: 1.4 }}>Vai sair assinado por <strong style={{ color: "#888" }}>{senderName}</strong>.</div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Notas <span style={{ fontWeight: 400, color: "#333" }}>(opcional)</span></label>
                  <input type="text" style={inputStyle} placeholder="Contexto extra..." value={dmNotes} onChange={e => setDmNotes(e.target.value)} />
                </div>
              </div>
              <button onClick={() => generateDM('initial')} style={{ padding: "12px 32px", borderRadius: 8, border: "none", background: "#7A0E18", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>Gerar DM</button>
            </div>
            )
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
            // Templates — zero API cost, switched on creator language so an
            // English creator doesn't get PT text. Style mirrors the cold DM:
            // short, conversational, no em dashes, signed off with "Raul".
            const isEn = creator?.primaryLanguage === 'en';
            const followupT7 = isEn
              ? `Hey ${firstName},\n\nNoticed I haven't heard back. Figured it's worth recording a 3-minute video with a concrete proposal for your case.\n\nIf it doesn't land, you close it and won't hear from me again. Sound fair?\n\nCheers,\nRaul`
              : `Olá ${firstName},\n\nVi que ainda não vimos um do outro. Achei que valia a pena gravar-te um vídeo de 3 minutos com uma proposta concreta para o teu caso.\n\nSe não fizer sentido, fechas e não voltas a ouvir de mim. Faz sentido?\n\nAbraço,\nRaul`;
            const breakupT14 = isEn
              ? `Hey ${firstName},\n\nI'll assume now isn't the moment. Closing the loop on my end.\n\nIf that changes, the door stays open.\n\nCheers,\nRaul`
              : `Olá ${firstName},\n\nAssumo que agora não é altura. Fecho o loop do meu lado.\n\nSe um dia mudar, a porta fica aberta.\n\nAbraço,\nRaul`;

            return (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "#555" }}>Gerado: {new Date(seq.generatedAt).toLocaleString("pt-PT")}</span>
                    <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 3, background: "rgba(122,14,24,0.1)", color: "#7A0E18", fontWeight: 600 }}>Template {seq.template || "A"}</span>
                  </div>
                  <button onClick={() => { patchCreator({ dmSequence: null }); setReplyResult(null); setReplyText(""); }} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#888", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Regenerar</button>
                </div>

                {/* Outreach tracker — drives the daily reminder digest. Each chip
                    is click-to-mark; once marked it shows the date and the
                    reminder cron stops pinging that milestone. */}
                {(() => {
                  const out = creator.outreach || {};
                  const sentChip = (sent, label, onClick) => (
                    <button
                      onClick={onClick}
                      title={sent ? `Marcado a ${new Date(sent).toLocaleString('pt-PT')} · Clica para desmarcar` : 'Clica quando enviares'}
                      style={{
                        padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                        border: `1px solid ${sent ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        background: sent ? 'rgba(34,197,94,0.08)' : 'transparent',
                        color: sent ? '#22c55e' : '#888',
                      }}
                    >
                      {sent ? `✓ ${label}` : `○ ${label}`}
                    </button>
                  );
                  const fmtRelative = (iso) => {
                    if (!iso) return null;
                    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
                    return days === 0 ? 'hoje' : days === 1 ? 'há 1 dia' : `há ${days} dias`;
                  };
                  return (
                    <div style={{ padding: "10px 14px", marginBottom: 16, background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase" }}>Outreach</span>
                      {sentChip(out.dmSentAt, 'DM', () => markOutreach('dm'))}
                      {sentChip(out.emailSentAt, 'Email', () => markOutreach('email'))}
                      <span style={{ fontSize: 9, color: "#444" }}>·</span>
                      {/* Follow-ups split by channel so the dashboard can
                          show DM-followups vs Email-followups effectiveness.
                          Cap at 3 across channels combined. */}
                      {(() => {
                        const followUps = Array.isArray(out.followUps) ? out.followUps : [];
                        const dmFu = followUps.filter(f => f.channel === 'dm').length;
                        const emFu = followUps.filter(f => f.channel === 'email').length;
                        const totalFu = followUps.length;
                        const capped = totalFu >= 3;
                        return (
                          <>
                            <button
                              onClick={() => markOutreach('followUpDm')}
                              title="Marca quando enviares um follow-up por DM"
                              disabled={capped}
                              style={{ padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: capped ? "default" : "pointer", fontFamily: "inherit", border: "1px solid rgba(255,255,255,0.08)", background: dmFu > 0 ? "rgba(59,130,246,0.08)" : "transparent", color: dmFu > 0 ? "#3b82f6" : "#888" }}
                            >
                              + Follow-up DM{dmFu > 0 ? ` (${dmFu})` : ''}
                            </button>
                            <button
                              onClick={() => markOutreach('followUpEmail')}
                              title="Marca quando enviares um follow-up por email"
                              disabled={capped}
                              style={{ padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: capped ? "default" : "pointer", fontFamily: "inherit", border: "1px solid rgba(255,255,255,0.08)", background: emFu > 0 ? "rgba(59,130,246,0.08)" : "transparent", color: emFu > 0 ? "#3b82f6" : "#888" }}
                            >
                              + Follow-up Email{emFu > 0 ? ` (${emFu})` : ''}
                            </button>
                            {totalFu > 0 && (
                              <span style={{ fontSize: 10, color: "#666" }}>· {totalFu}/3{out.lastFollowUpAt ? ` · ${fmtRelative(out.lastFollowUpAt)}` : ''}</span>
                            )}
                          </>
                        );
                      })()}
                      <span style={{ fontSize: 9, color: "#444" }}>·</span>
                      {/* Reply attribution — split by channel so we know
                          where the conversion happened. After marking, the
                          chip shows which channel was used. */}
                      {out.repliedAt ? (
                        <button onClick={() => markOutreach('unreplied')} title={`Respondeu via ${out.repliedChannel === 'email' ? 'Email' : 'DM'} ${fmtRelative(out.repliedAt)} · Clica para desmarcar`} style={{ padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", color: "#22c55e" }}>
                          ✓ Respondeu via {out.repliedChannel === 'email' ? 'Email' : out.repliedChannel === 'dm' ? 'DM' : '?'} · {fmtRelative(out.repliedAt)}
                        </button>
                      ) : (
                        <>
                          <button onClick={() => markOutreach('repliedDm')} title="Marca quando o creator responder via DM." style={{ padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#888" }}>
                            ○ Respondeu (DM)
                          </button>
                          <button onClick={() => markOutreach('repliedEmail')} title="Marca quando o creator responder via email." style={{ padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#888" }}>
                            ○ Respondeu (Email)
                          </button>
                        </>
                      )}
                      <span style={{ fontSize: 9, color: "#444" }}>·</span>
                      {/* Sales-call stages — feed show-up rate + extended funnel.
                          callAgreed = creator said yes to a call. callHeld = call
                          actually happened. Show as separate chips so they can
                          flip independently (e.g. cancelled calls). */}
                      {out.callAgreedAt ? (
                        <button onClick={() => markOutreach('uncallAgreed')} title={`Call agendada ${fmtRelative(out.callAgreedAt)} · Clica para desmarcar`} style={{ padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "1px solid rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.08)", color: "#a855f7" }}>
                          ✓ Call agendada
                        </button>
                      ) : (
                        <button onClick={() => markOutreach('callAgreed')} title="Marca quando o criador aceita uma call." style={{ padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#888" }}>
                          ○ Call agendada
                        </button>
                      )}
                      {out.callHeldAt ? (
                        <button onClick={() => markOutreach('uncallHeld')} title={`Call realizada ${fmtRelative(out.callHeldAt)} · Clica para desmarcar`} style={{ padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "1px solid rgba(168,85,247,0.45)", background: "rgba(168,85,247,0.14)", color: "#c084fc" }}>
                          ✓ Call realizada
                        </button>
                      ) : (
                        <button onClick={() => markOutreach('callHeld')} title="Marca quando a call efectivamente aconteceu (não só agendada)." disabled={!out.callAgreedAt} style={{ padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: out.callAgreedAt ? "pointer" : "default", fontFamily: "inherit", border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: out.callAgreedAt ? "#888" : "#444" }}>
                          ○ Call realizada
                        </button>
                      )}
                      <span style={{ flex: 1 }} />
                      {/* Mark cold w/ loss-reason capture. Only surfaced once
                          the conversation has actually started (DM sent) and
                          isn't already cold/signed — otherwise there's nothing
                          to lose. */}
                      {out.dmSentAt && creator.pipelineStatus !== 'cold' && creator.pipelineStatus !== 'signed' && (
                        <button onClick={markCold} title="Marca como frio e regista a razão de perda." style={{ padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "1px solid rgba(239,68,68,0.25)", background: "transparent", color: "#ef4444" }}>
                          Marcar frio
                        </button>
                      )}
                      {creator.pipelineStatus === 'cold' && creator.lostReason && (
                        <span style={{ padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444" }} title={`Perdido por ${creator.lostReason}`}>
                          Frio · {({ price: 'preço', timing: 'timing', fit: 'fit', ghost: 'sem resposta', competitor: 'concorrente', other: 'outro' }[creator.lostReason]) || creator.lostReason}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Cold DM */}
                <MessageCard label="T+0 — Cold DM" type="dm" content={seq.dm || ""} accent>
                  {!rewritingDm ? (
                    <button onClick={() => { setRewritingDm(true); setRewriteInstruction(""); }} style={{ marginTop: 10, padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#666", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>Reescrever</button>
                  ) : (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <textarea autoFocus placeholder="O que queres mudar? Ex: 'mais curto', 'referir o podcast'..." value={rewriteInstruction} onChange={e => setRewriteInstruction(e.target.value)} style={{ ...inputStyle, display: "block", minHeight: 50, fontSize: 12, marginBottom: 8 }} />
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

                {/* Emails — Day 1 always generated with the initial DM; Day 7 +
                    Day 14 are generated ON DEMAND so we don't burn tokens for
                    the ~80% of creators that never reach those stages. The
                    reminder cron pings the operator when each is due; the
                    operator clicks "Gerar" here, the LLM produces just that
                    single email merged into the existing dmSequence. */}
                <p style={{ ...sectionTitleStyle, marginTop: 24 }}>Emails</p>

                {seq.email_day1?.body && (
                  <MessageCard label="Day 1 — Email" type="email" content={`Subject: ${seq.email_day1.subject || ""}\n\n${seq.email_day1.body}`} />
                )}

                {seq.email_day7?.body ? (
                  <MessageCard label="Day 7 — Email" type="email" content={`Subject: ${seq.email_day7.subject || ""}\n\n${seq.email_day7.body}`} />
                ) : (
                  <PendingEmailCard label="Day 7 — Email" hint="Gera quando estiver na altura de mandar (~7 dias após o cold DM)." loading={dmLoading} onClick={() => generateDM('followup_7')} />
                )}

                {seq.email_day14?.body ? (
                  <MessageCard label="Day 14 — Email" type="email" content={`Subject: ${seq.email_day14.subject || ""}\n\n${seq.email_day14.body}`} />
                ) : (
                  <PendingEmailCard label="Day 14 — Email" hint="Gera quando estiver na altura de mandar (~14 dias após o cold DM). Último toque." loading={dmLoading} onClick={() => generateDM('followup_14')} />
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
          {/* Top-level view switch — sits ABOVE the wizard panels so the
              operator can flip between the offer-generation flow and the
              revenue projection without scrolling. Blind Spot Audit +
              Objection Playbook were removed in this rev; system prompt
              also trimmed to drop sections N+O. */}
          <div className="sl-tabs sl-hscroll" style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 24 }}>
            {OFFER_TABS.map(t => (
              <button key={t.key} onClick={() => setOfferTab(t.key)} style={{
                padding: "10px 18px",
                border: "none",
                background: "transparent",
                color: offerTab === t.key ? "#f5f5f5" : "#444",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                borderBottom: offerTab === t.key ? "2px solid #7A0E18" : "2px solid transparent",
                marginBottom: -1,
              }}>{t.label}</button>
            ))}
          </div>

          {offerTab === "offer" && (<>
          {/* Phase 4 · 5-Checkpoint Wizard.
              Stitches Phase 1+2+3 internal_metadata into the actual offer
              (client_facing_output). The stepper shows lock state; the active
              checkpoint expands below it. CP panels are stubs for now —
              individual CPs ship in follow-up commits. */}
          <WizardStepper creator={creator} />
          {/* Active checkpoint panel — dispatched on progress.current.
              Each CP commit replaces its stub with the real component.
              CP1 (Strategic Frame) is built; CP2-5 are still stubs. */}
          {(() => {
            const prog = readCheckpointProgress(creator?.offer?.internal_metadata);
            const cp = CHECKPOINTS.find(c => c.id === prog.current) || CHECKPOINTS[0];
            if (prog.current === 1) {
              return (
                <StrategicFramePanel
                  creator={creator}
                  setCreator={setCreator}
                  running={frameRunning}
                  setRunning={setFrameRunning}
                  error={frameError}
                  setError={setFrameError}
                  diag={frameDiag}
                  setDiag={setFrameDiag}
                />
              );
            }
            if (prog.current === 2) {
              return (
                <CoreOfferPanel
                  creator={creator}
                  setCreator={setCreator}
                  running={coreOfferRunning}
                  setRunning={setCoreOfferRunning}
                  error={coreOfferError}
                  setError={setCoreOfferError}
                  diag={coreOfferDiag}
                  setDiag={setCoreOfferDiag}
                />
              );
            }
            if (prog.current === 3) {
              return (
                <ModulesPanel
                  creator={creator}
                  setCreator={setCreator}
                  running={modulesRunning}
                  setRunning={setModulesRunning}
                  error={modulesError}
                  setError={setModulesError}
                  diag={modulesDiag}
                  setDiag={setModulesDiag}
                />
              );
            }
            if (prog.current === 4) {
              return (
                <ValueStackPanel
                  creator={creator}
                  setCreator={setCreator}
                  running={stackRunning}
                  setRunning={setStackRunning}
                  error={stackError}
                  setError={setStackError}
                  diag={stackDiag}
                  setDiag={setStackDiag}
                />
              );
            }
            // CP5 dispatch deliberately removed — see app/lib/offerSchema.js
            // header note. SalesCopyPanel is preserved at the bottom of this
            // file for the future launch-assets tool. If prog.current somehow
            // lands at 5 (legacy creator), fall through to the stub which
            // reads "Not yet implemented" — acceptable until cascade-unlock
            // brings it back to 4.
            return <CheckpointStubPanel checkpoint={cp} />;
          })()}

          {/* The legacy 5-step manual form was removed. The Phase 4 wizard
              above (Frame · Offer · Modules · Stack) is the canonical offer
              generator. Empty state below renders only when the wizard
              hasn't been started yet AND no legacy offer exists. The
              `generateOffer` handler + OFFER_STEPS + offerForm state are
              kept in the component for now (cheap to leave); a follow-up
              cleanup can purge them if no other path uses them. */}
          {!creator.offer && !offerLoading && (
            <div style={{ padding: "40px 24px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 10 }}>
              <div style={{ width: 44, height: 44, margin: "0 auto 16px", borderRadius: 10, background: "rgba(122,14,24,0.08)", border: "1px solid rgba(122,14,24,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#B11E2F", fontWeight: 700 }}>1</div>
              <p style={{ fontSize: 14, color: "#bbb", margin: "0 0 6px" }}>No offer yet for {creator.name}.</p>
              <p style={{ fontSize: 11, color: "#666", margin: 0, lineHeight: 1.55, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
                Run the wizard above — Strategic Frame → Core Offer → Modules → Value Stack.
                Each checkpoint locks before the next one runs so you can review the operator-language strategic decisions before they turn into creator-facing copy.
              </p>
            </div>
          )}
          {creator.offer && (
            <div>
              {/* Action buttons row. Re-parse stays for legacy offers
                  (re-extracts structured fields from creator.offer.raw
                  without burning a new API call). "Regenerar" removed —
                  the wizard's unlock-and-cascade flow is the canonical
                  way to regenerate; nuking the entire offer.offer object
                  would also wipe locked wizard checkpoints. */}
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 16, gap: 6 }}>
                <button onClick={reparseOffer} title="Re-extract structured fields from creator.offer.raw — no new AI call. Useful for legacy offers when pitch placeholders show up. Wizard-generated offers don't need this." style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", color: "#22c55e", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>↻ Re-parse</button>
              </div>
              {/* The structured offer summary — sourced from
                  client_facing_output (wizard) with legacy-parsed fallback
                  via readOfferState. Replaces the old markdown render. */}
              <OfferSummaryCard creator={creator} />
              <div style={{ marginTop: 8, fontSize: 10, color: "#444" }}>Gerado: {new Date(creator.offer.generatedAt).toLocaleString("pt-PT")}</div>
            </div>
          )}
          </>)}{/* end offerTab === "offer" */}

          {/* ─── Revenue Projector view ─────────────────────────────────────
              Top-level sibling to the offer-generation flow. Reads price
              from CP2 client_facing_output.target_price first (preserving
              creator-currency formatting like "€297/mo"), then falls back
              to the legacy RECOMMENDED MONTHLY PRICE markdown match, then
              to the niche-DB mid-tier. State shared with the rest of the
              page (revenuePrice / engagementRate / revenueCommission
              hooks at component top). */}
          {offerTab === "revenue" && (<>
            {!creator.offer ? (
              <div style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 10 }}>
                <div style={{ width: 40, height: 40, margin: "0 auto 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#444" }}>€</div>
                <p style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>Generate the Grand Slam Offer first.</p>
                <p style={{ fontSize: 11, color: "#444" }}>The Revenue Projector reads the price from the offer to project monthly recurring revenue across three scenarios.</p>
              </div>
            ) : (() => {
              // ─── Audience: scraped first, override if creator.revenueAudience set
              const scrapedF = igData?.followers || tkData?.followers || ytData?.subscribers || 10000;
              const primaryF = creator.revenueAudience ?? scrapedF;

              // ─── Price resolution (priority order):
              //   1. revenuePrice (operator slider override, lives in component state)
              //   2. creator.revenuePrice (persisted operator override)
              //   3. CP2 target_price (Phase 4 wizard) — strip € sign + suffix
              //   4. RECOMMENDED MONTHLY PRICE markdown match (legacy)
              //   5. niche DB mid-tier fallback
              const cfo = creator.offer?.client_facing_output || {};
              const cfoPriceMatch = cfo.target_price ? String(cfo.target_price).match(/[\d.,]+/) : null;
              const cfoPrice = cfoPriceMatch ? parseFloat(cfoPriceMatch[0].replace(/,/g, '')) : null;
              const nichePrice = dealScore?.nicheData?.mid || 39;
              const rawPriceMatch = creator.offer?.raw?.match(/RECOMMENDED MONTHLY PRICE:\s*€?\s*(\d+)/i);
              const defaultPrice = (Number.isFinite(cfoPrice) && cfoPrice > 0)
                ? Math.round(cfoPrice)
                : (rawPriceMatch ? parseInt(rawPriceMatch[1], 10) : nichePrice);
              const price = revenuePrice ?? creator.revenuePrice ?? defaultPrice;
              const fmt = (n) => "€" + Math.round(n).toLocaleString();
              const priceSource = (Number.isFinite(cfoPrice) && cfoPrice > 0) ? 'from CP2' : (rawPriceMatch ? 'from offer markdown' : 'niche DB');

              // ─── Engagement
              const rawEng = creator.engagement || igData?.engagementRate || "";
              const defaultEng = parseFloat(String(rawEng).replace(/[^0-9.]/g, "")) || 2.0;
              const eng = engagementRate ?? creator.revenueEngagement ?? defaultEng;

              // ─── Shared revenue lib (same scenarios + formula as the pitch deck).
              // Carry scenarioKey so tier-aware caps can be looked up downstream.
              const scenarios = [
                { key: 'conservador', ...REVENUE_SCENARIOS.conservador, label: "Conservative", color: "#888", border: "rgba(255,255,255,0.04)" },
                { key: 'moderado',    ...REVENUE_SCENARIOS.moderado,    label: "Moderate", color: "#f5f5f5", border: "rgba(122,14,24,0.2)" },
                { key: 'agressivo',   ...REVENUE_SCENARIOS.agressivo,   label: "Aggressive", color: "#7A0E18", border: "rgba(255,255,255,0.04)" },
              ];
              // Tier bucket from CP2 pricing_tier × the operator's current price slider.
              // Without this, mid/high recurring offers project as if they were low-ticket.
              const tierBucket = classifyTierBucket(cfo.pricing_tier, price, cfo.pricing_model);
              const calcSteady = (s) => sharedCalcMRR({ audience: primaryF, price, engagementRate: eng, scenario: s, scenarioKey: s.key, tierBucket, paymentPlan: revenuePaymentPlan });
              const calcClients = (s) => calcSteady(s).activeMembers;
              const engMultiplier = sharedCalcMRR({ audience: primaryF, price, engagementRate: eng, scenario: scenarios[1], scenarioKey: 'moderado', tierBucket }).engMultiplier;
              const modScenario = scenarios[1];
              const modSteady = calcSteady(modScenario);
              const modClients = modSteady.activeMembers;
              const modRevenue = modSteady.monthlyRevenue;

              return (
                <div style={{ padding: 20, background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10 }}>
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
                        {price === defaultPrice && <span style={{ fontSize: 8, fontWeight: 600, color: "#7A0E18", letterSpacing: "0.06em", padding: "1px 5px", borderRadius: 2, border: "1px solid rgba(122,14,24,0.2)", textTransform: "uppercase" }}>{priceSource}</span>}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>{fmt(price)}</span>
                    </div>
                    <input type="range" min={5} max={1500} step={1} value={price}
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

                    {/* Projection-only toggles. Stored at creator level so
                        they survive offer regeneration. Launches/year only
                        makes sense for one-time / hybrid; hidden otherwise. */}
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      {(cfo.pricing_model === 'one_time' || cfo.pricing_model === 'hybrid') && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#555", letterSpacing: "0.05em", textTransform: "uppercase" }}>Launches / year</span>
                          <input
                            type="number"
                            min="1"
                            max="12"
                            value={revenueLaunches ?? ''}
                            placeholder="auto"
                            onChange={e => setRevenueLaunches(e.target.value === '' ? null : Number(e.target.value))}
                            style={{ width: 64, padding: "5px 8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "#f5f5f5", fontSize: 11, fontFamily: "inherit", textAlign: "right", outline: "none" }}
                            title="How many launches/year for this one-time offer. Leave blank for the tier-based suggested default (low=6, mid=3, high=2, premium=1)."
                          />
                        </div>
                      )}
                      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 10, fontWeight: 600, color: revenuePaymentPlan ? "#22c55e" : "#555", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        <input
                          type="checkbox"
                          checked={revenuePaymentPlan}
                          onChange={e => setRevenuePaymentPlan(e.target.checked)}
                          style={{ accentColor: "#22c55e", cursor: "pointer" }}
                          title="Payment plan availability lifts conversion ~20-30% (source: learningrevolution). Multiplies projected buyers by 1.25× when checked."
                        />
                        Payment plan available <span style={{ color: "#444", fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>(+25% CVR)</span>
                      </label>
                    </div>
                  </div>

                  {/* Scenario cards */}
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
                        <div style={{ marginTop: 10, fontSize: 10, color: "#555" }}>
                          Benchmark: 2% (avg Instagram creator). Tier cap ({tierBucket}): {(((TIER_CONVERSION_CAP[tierBucket]?.[mod.key]) ?? mod.cap) * 100).toFixed(2)}% of followers · Price: {fmt(defaultPrice)}/mês ({priceSource}).
                        </div>
                      </div>
                    );
                  })()}

                  {/* ────────── Ecosystem revenue panel ──────────
                      v1 of the offer-aware projector. Pulls existing products
                      from the audit, estimates current buyers conservatively
                      from audience × tier %, projects the NEW offer revenue
                      using the right formula per pricing_model (recurring /
                      one_time / hybrid), and applies upgrade flows when
                      CP1 confirmed_role is entry_point or premium_upsell.
                      No cannibalization / refunds / niche tuning in v1 —
                      see project_revenue_model_deferred memory. */}
                  {(() => {
                    const audit = creator.offer?.internal_metadata?.ecosystem_audit;
                    const frame = creator.offer?.internal_metadata?.strategic_frame;
                    if (!audit) return null;
                    const existingProducts = [
                      ...(audit.ecosystem_map?.products_found || []),
                      ...(audit.ecosystem_map?.existing_communities || []).map(c => ({ ...c, tier: c.tier || 'recurring' })),
                    ].filter(p => p && p.tier && p.tier !== 'lead_magnet');
                    const offerForCalc = {
                      ...cfo,
                      target_price: cfo.target_price || `€${price}/mo`,
                      launches_per_year: revenueLaunches ?? cfo.launches_per_year,
                      payment_plan_available: revenuePaymentPlan,
                    };
                    const ecoByScenario = scenarios.map(s => projectEcosystemRevenue({
                      creator: { ...creator, engagement: String(eng) },
                      offer: offerForCalc,
                      existingProducts,
                      scenarioKey: s.key,
                      confirmedRole: frame?.confirmed_role,
                    }));
                    const fmtBig = (n) => "€" + Math.round(n).toLocaleString();
                    return (
                      <div style={{ marginTop: 20, padding: "18px 20px", background: "#141414", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 10 }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", letterSpacing: "0.18em", textTransform: "uppercase" }}>Ecosystem Revenue</div>
                          <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.06em" }}>preview · v1 (no cannibalization)</div>
                        </div>
                        <p style={{ fontSize: 11, color: "#666", margin: "0 0 14px", lineHeight: 1.5 }}>
                          Total annual revenue across the creator's existing products plus the new offer. Pulls existing buyers from a conservative estimate (% of audience by tier), and applies upgrade flows for {frame?.confirmed_role ? <code style={{ color: "#888" }}>{frame.confirmed_role}</code> : 'standalone'} role.
                          {offerForCalc.pricing_model && <> Mode: <strong style={{ color: "#888" }}>{offerForCalc.pricing_model}</strong>.</>}
                        </p>

                        {/* 3 scenario cards: status quo / with new / delta */}
                        <div className="sl-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                          {ecoByScenario.map((eco, i) => {
                            const s = scenarios[i];
                            return (
                              <div key={s.key} style={{ padding: 14, borderRadius: 8, background: "#0a0a0a", border: `1px solid ${s.border}` }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{s.label}</div>
                                <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>Status quo (annual)</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "#888", marginBottom: 8 }}>{fmtBig(eco.headline.statusQuoAnnual)}</div>
                                <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>With new offer</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: "#22c55e", marginBottom: 8 }}>{fmtBig(eco.headline.withNewOfferAnnual)}</div>
                                <div style={{ paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>Δ from new offer</div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: eco.headline.deltaAnnual >= 0 ? "#22c55e" : "#ef4444" }}>
                                    {eco.headline.deltaAnnual >= 0 ? '+' : ''}{fmtBig(eco.headline.deltaAnnual)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Per-product breakdown (moderado view) */}
                        {(() => {
                          const eco = ecoByScenario[1];
                          if (!eco) return null;
                          return (
                            <div style={{ padding: "12px 14px", background: "#0a0a0a", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)" }}>
                              <div style={{ fontSize: 9, fontWeight: 600, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Breakdown (Moderate scenario)</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {eco.existing.map((r, i) => (
                                  <div key={i} className="sl-grid-4" style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 1fr 1fr", gap: 8, fontSize: 11, color: "#888", padding: "4px 0" }}>
                                    <span style={{ color: "#ccc" }}>{r.name}</span>
                                    <span style={{ color: "#666", fontSize: 10 }}>{r.tier}</span>
                                    <span>{r.buyers.toLocaleString()} buyers · {fmtBig(r.price)}{r.tier === 'recurring' ? '/mo' : ''}</span>
                                    <span style={{ color: "#f5f5f5", textAlign: "right" }}>
                                      {fmtBig(r.statusQuoAnnual)} → <strong>{fmtBig(r.withNewOfferAnnual)}</strong>
                                      {r.upgradeBuyers > 0 && <span style={{ color: "#22c55e", fontSize: 9, marginLeft: 6 }}>+{r.upgradeBuyers}</span>}
                                    </span>
                                  </div>
                                ))}
                                <div className="sl-grid-4" style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 1fr 1fr", gap: 8, fontSize: 11, padding: "8px 0 4px", borderTop: "1px solid rgba(34,197,94,0.15)", marginTop: 4 }}>
                                  <span style={{ color: "#22c55e", fontWeight: 700 }}>+ NEW · {eco.newOffer.name}</span>
                                  <span style={{ color: "#22c55e", fontSize: 10 }}>{eco.newOffer.tierBucket}</span>
                                  <span style={{ color: "#22c55e" }}>{eco.newOffer.baseBuyers}{eco.newOffer.upgradeBuyers > 0 ? `+${eco.newOffer.upgradeBuyers}` : ''} buyers · {fmtBig(eco.newOffer.projection.priceNumeric || 0)}</span>
                                  <span style={{ color: "#22c55e", textAlign: "right", fontWeight: 700 }}>{fmtBig(eco.newOffer.annualRevenue)}/yr</span>
                                </div>
                              </div>
                              <div style={{ marginTop: 10, fontSize: 10, color: "#444", lineHeight: 1.5 }}>
                                Buyer counts for existing products are conservative estimates from audience × tier %. Edit them in the audit when you have real numbers. Upgrade rate ({(eco.upgradeRate * 100).toFixed(0)}% moderate) applies only when role is <em>entry_point</em> or <em>premium_upsell</em>.
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </>)}{/* end offerTab === "revenue" */}
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

// ─────────────────────────────────────────────────────────────────
// Phase 1 · Ecosystem Audit viewer (internal use only).
//
// Renders the structured output of the audit endpoint with operator-facing
// labels. Every value here is from `creator.offer.internal_metadata.ecosystem_audit`
// and is NOT rendered anywhere the creator sees.
// ─────────────────────────────────────────────────────────────────

function EcosystemAuditPanel({ creator, setCreator, running, error, diag, onRun }) {
  const audit = creator?.offer?.internal_metadata?.ecosystem_audit || null;
  const runAt = creator?.offer?.internal_metadata?.generation_timestamps?.ecosystem_audit || null;

  const TIER_COLORS = {
    lead_magnet: { bg: 'rgba(120,120,120,0.08)', border: 'rgba(120,120,120,0.25)', color: '#aaa' },
    low_ticket:  { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', color: '#3b82f6' },
    mid_ticket:  { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.25)', color: '#a855f7' },
    high_ticket: { bg: 'rgba(177,30,47,0.10)', border: 'rgba(177,30,47,0.35)', color: '#B11E2F' },
    recurring:   { bg: 'rgba(31,138,76,0.08)', border: 'rgba(31,138,76,0.25)', color: '#1F8A4C' },
    service:     { bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.25)', color: '#eab308' },
    physical_product: { bg: 'rgba(245,245,245,0.04)', border: 'rgba(245,245,245,0.12)', color: '#ccc' },
  };
  const ROLE_LABELS = {
    entry_point:    'Entry point · warm-up funnel into existing high-ticket',
    continuity:    'Continuity · keeps mid-ticket buyers paying monthly',
    premium_upsell: 'Premium upsell · top of low-ticket catalog',
    standalone:    'Standalone · first real offer in the funnel',
  };
  const TIER_OPTIONS = ['lead_magnet', 'low_ticket', 'mid_ticket', 'high_ticket', 'recurring', 'service', 'physical_product'];

  // ── Local edit state — operator can fix audit mistakes (wrong-creator
  // products, missing items, bad prices, wrong tiers) without a full
  // re-run. Saved via PATCH endpoint. Synced from `audit` on prop change
  // so a fresh re-run replaces local edits.
  const [localProducts, setLocalProducts] = useState([]);
  const [localCommunities, setLocalCommunities] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  useEffect(() => {
    setLocalProducts(audit?.ecosystem_map?.products_found || []);
    setLocalCommunities(audit?.ecosystem_map?.existing_communities || []);
    setDirty(false);
    setSaveErr(null);
  }, [audit]);

  const editProduct = (i, key, val) => {
    setLocalProducts(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: val };
      return next;
    });
    setDirty(true);
  };
  const addProduct = () => {
    setLocalProducts(prev => [...prev, { name: '', tier: 'low_ticket', format: 'product', price_eur: null, url: '', transformation_offered: '' }]);
    setDirty(true);
  };
  const deleteProduct = (i) => {
    setLocalProducts(prev => prev.filter((_, j) => j !== i));
    setDirty(true);
  };
  const editCommunity = (i, key, val) => {
    setLocalCommunities(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: val };
      return next;
    });
    setDirty(true);
  };
  const addCommunity = () => {
    setLocalCommunities(prev => [...prev, { name: '', tier: 'recurring', format: 'Skool community', price_eur: null, url: '' }]);
    setDirty(true);
  };
  const deleteCommunity = (i) => {
    setLocalCommunities(prev => prev.filter((_, j) => j !== i));
    setDirty(true);
  };
  const saveEdits = async () => {
    if (!creator?.id || saving) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/ecosystem-audit/patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products_found: localProducts.filter(p => p.name?.trim()), // drop empty rows
          existing_communities: localCommunities.filter(c => c.name?.trim()),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.errors?.join('; ') || data.error || 'Save failed');
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            ecosystem_audit: data.ecosystem_audit,
          },
        },
      }) : prev);
      setDirty(false);
    } catch (e) {
      setSaveErr(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginBottom: 28, padding: "18px 20px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>● Phase 1 · Internal</div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>Ecosystem Audit</h3>
          <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0" }}>
            Maps existing products + decides the strategic role of the community in the funnel. Operator-only — never shown to the creator.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Save changes — appears only when operator has unsaved edits */}
          {dirty && (
            <button
              onClick={saveEdits}
              disabled={saving}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid rgba(34,197,94,0.45)",
                background: saving ? "rgba(255,255,255,0.02)" : "rgba(34,197,94,0.10)",
                color: saving ? "#555" : "#22c55e",
                fontSize: 11,
                fontWeight: 700,
                cursor: saving ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {saving ? "A guardar..." : "● Save changes"}
            </button>
          )}
          <button
            onClick={onRun}
            disabled={running}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid rgba(122,14,24,0.4)",
              background: running ? "rgba(255,255,255,0.02)" : "rgba(122,14,24,0.08)",
              color: running ? "#555" : "#B11E2F",
              fontSize: 11,
              fontWeight: 600,
              cursor: running ? "wait" : "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            {running ? "A correr audit..." : audit ? "↻ Re-run audit" : "Run audit"}
          </button>
        </div>
      </div>
      {saveErr && (
        <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 11, marginBottom: 12 }}>{saveErr}</div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 11, marginBottom: 12, whiteSpace: "pre-wrap" }}>{error}</div>
      )}
      {diag && !running && (
        <div style={{ fontSize: 10, color: "#444", marginBottom: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
          {diag.seed_urls} seed urls · {diag.aggregators_resolved} aggregators resolved · {diag.final_urls_inspected} urls inspected · {diag.retries} retries
        </div>
      )}

      {!audit && !running && (
        <div style={{ padding: "20px 16px", textAlign: "center", color: "#444", fontSize: 12, border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 6 }}>
          No audit yet. Click <strong style={{ color: "#888" }}>Run audit</strong> to inspect the creator's product ecosystem (~60-90s, uses web_search).
        </div>
      )}

      {audit && (
        <div>
          {/* Strategic role + completeness header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, marginBottom: 16, padding: "14px 16px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>Strategic role</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 4 }}>{ROLE_LABELS[audit.strategic_role] || audit.strategic_role}</div>
              <p style={{ fontSize: 12, color: "#888", margin: 0, lineHeight: 1.55 }}>{audit.strategic_role_reasoning}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Completeness</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#f5f5f5", lineHeight: 1, letterSpacing: "-0.02em" }}>{audit.ecosystem_map?.ecosystem_completeness_score ?? 0}</div>
              <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>/ 100</div>
            </div>
          </div>

          {/* Tier flags */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { k: 'has_high_ticket', label: 'High-ticket' },
              { k: 'has_mid_ticket', label: 'Mid-ticket' },
              { k: 'has_recurring', label: 'Recurring' },
            ].map(({ k, label }) => {
              const on = !!audit.ecosystem_map?.[k];
              return (
                <span key={k} style={{
                  fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 4,
                  background: on ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)",
                  color: on ? "#22c55e" : "#444",
                  border: `1px solid ${on ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.04)"}`,
                }}>{on ? "✓" : "○"} {label}</span>
              );
            })}
          </div>

          {/* Products found — INLINE EDITABLE.
              Operator can edit name/price/tier/format/URL/transformation
              directly, add new products manually, and delete wrong ones
              (e.g. when the audit hallucinates a product from a
              same-first-name creator). Saved via the "Save changes"
              button at the top of the panel. */}
          {(() => {
            const inputStyle = {
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 4,
              color: "#f5f5f5",
              fontFamily: "inherit",
              fontSize: 12,
              padding: "5px 9px",
              outline: "none",
            };
            return (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    Products found · {localProducts.length}
                    {dirty && <span style={{ color: "#eab308", marginLeft: 8, fontWeight: 700 }}>● edited</span>}
                  </div>
                  <button
                    onClick={addProduct}
                    style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(122,14,24,0.4)", background: "rgba(122,14,24,0.06)", color: "#B11E2F", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    + Add product
                  </button>
                </div>
                {localProducts.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#444", padding: "12px 14px", background: "#0a0a0a", borderRadius: 6, border: "1px dashed rgba(255,255,255,0.04)" }}>No products. Click "+ Add product" to add one manually.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {localProducts.map((p, i) => {
                      const tc = TIER_COLORS[p.tier] || TIER_COLORS.physical_product;
                      return (
                        <div key={i} style={{ padding: "10px 12px", background: "#0a0a0a", borderRadius: 6, border: `1px solid ${tc.border}` }}>
                          {/* Row 1: name (flex) · tier · price · delete */}
                          <div className="sl-grid-4" style={{ display: "grid", gridTemplateColumns: "1fr 140px 90px 28px", gap: 8, marginBottom: 6, alignItems: "center" }}>
                            <input
                              type="text"
                              value={p.name || ''}
                              placeholder="Product name"
                              onChange={e => editProduct(i, 'name', e.target.value)}
                              style={{ ...inputStyle, fontWeight: 600 }}
                            />
                            <select
                              value={p.tier || 'low_ticket'}
                              onChange={e => editProduct(i, 'tier', e.target.value)}
                              style={{ ...inputStyle, color: tc.color, fontWeight: 700, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}
                            >
                              {TIER_OPTIONS.map(t => (
                                <option key={t} value={t} style={{ background: "#0a0a0a", color: "#f5f5f5" }}>{t.replace('_', ' ')}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={p.price_eur ?? ''}
                              placeholder="€ price"
                              onChange={e => editProduct(i, 'price_eur', e.target.value === '' ? null : Number(e.target.value))}
                              style={{ ...inputStyle, textAlign: "right" }}
                            />
                            <button
                              onClick={() => deleteProduct(i)}
                              title="Delete this product"
                              style={{ padding: "5px 0", borderRadius: 4, border: "1px solid rgba(239,68,68,0.25)", background: "transparent", color: "#ef4444", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                            >
                              ✕
                            </button>
                          </div>
                          {/* Row 2: format · URL */}
                          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, marginBottom: 6 }}>
                            <input
                              type="text"
                              value={p.format || ''}
                              placeholder="format (course, ebook…)"
                              onChange={e => editProduct(i, 'format', e.target.value)}
                              style={{ ...inputStyle, fontSize: 11 }}
                            />
                            <input
                              type="text"
                              value={p.url || ''}
                              placeholder="https://…"
                              onChange={e => editProduct(i, 'url', e.target.value)}
                              style={{ ...inputStyle, fontSize: 11, color: "#7A0E18" }}
                            />
                          </div>
                          {/* Row 3: transformation */}
                          <textarea
                            value={p.transformation_offered || ''}
                            placeholder="What transformation does it offer? (1 sentence)"
                            onChange={e => editProduct(i, 'transformation_offered', e.target.value)}
                            rows={2}
                            style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "vertical", fontSize: 11, color: "#aaa", fontFamily: "inherit" }}
                          />
                          {/* Row 4: revenue-projector overrides — buyer count + retire toggle */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 6, alignItems: "center" }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ fontSize: 9, fontWeight: 600, color: "#444", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Current buyers</span>
                              <input
                                type="number"
                                min="0"
                                value={p.estimated_buyers ?? ''}
                                placeholder="auto-estimate"
                                onChange={e => editProduct(i, 'estimated_buyers', e.target.value === '' ? null : Number(e.target.value))}
                                style={{ ...inputStyle, width: 130, fontSize: 11, textAlign: "right" }}
                                title="Operator estimate of current paying customers. Leave blank for a conservative auto-estimate (audience × tier %)."
                              />
                            </div>
                            <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 10, color: p.retire_on_launch ? "#ef4444" : "#666" }}>
                              <input
                                type="checkbox"
                                checked={!!p.retire_on_launch}
                                onChange={e => editProduct(i, 'retire_on_launch', e.target.checked)}
                                style={{ accentColor: "#ef4444", cursor: "pointer" }}
                                title="Mark this product as retired when the new offer launches. Its revenue drops to 0 in the ecosystem projection."
                              />
                              Retire on launch
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Existing communities — INLINE EDITABLE.
              Separate from products because this is the cannibalization-risk
              signal. Operator can add a community the audit missed
              (theaiincomelabs.com style) or delete a wrong-creator
              false-positive (Mariah Coz vs Mariah Brunner). */}
          {(() => {
            const inputStyle = {
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 4,
              color: "#f5f5f5",
              fontFamily: "inherit",
              fontSize: 12,
              padding: "5px 9px",
              outline: "none",
            };
            return (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#eab308", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    Existing communities · {localCommunities.length}
                    {localCommunities.length > 0 && <span style={{ marginLeft: 8, color: "#888", fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>cannibalization risk feeder</span>}
                  </div>
                  <button
                    onClick={addCommunity}
                    style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid rgba(234,179,8,0.4)", background: "rgba(234,179,8,0.06)", color: "#eab308", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    + Add community
                  </button>
                </div>
                {localCommunities.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#444", padding: "12px 14px", background: "#0a0a0a", borderRadius: 6, border: "1px dashed rgba(255,255,255,0.04)" }}>
                    None detected. If the creator already runs a community (Skool / Whop / paid Discord / custom domain), click "+ Add community" — the wizard uses this to avoid pricing-tier overlap.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {localCommunities.map((c, i) => (
                      <div key={i} style={{ padding: "10px 12px", background: "rgba(234,179,8,0.04)", borderRadius: 6, border: "1px solid rgba(234,179,8,0.25)" }}>
                        <div className="sl-grid-4" style={{ display: "grid", gridTemplateColumns: "1fr 140px 90px 28px", gap: 8, marginBottom: 6, alignItems: "center" }}>
                          <input
                            type="text"
                            value={c.name || ''}
                            placeholder="Community name"
                            onChange={e => editCommunity(i, 'name', e.target.value)}
                            style={{ ...inputStyle, fontWeight: 600 }}
                          />
                          <select
                            value={c.tier || 'recurring'}
                            onChange={e => editCommunity(i, 'tier', e.target.value)}
                            style={{ ...inputStyle, color: "#eab308", fontWeight: 700, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}
                          >
                            {TIER_OPTIONS.map(t => (
                              <option key={t} value={t} style={{ background: "#0a0a0a", color: "#f5f5f5" }}>{t.replace('_', ' ')}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={c.price_eur ?? ''}
                            placeholder="€/mo"
                            onChange={e => editCommunity(i, 'price_eur', e.target.value === '' ? null : Number(e.target.value))}
                            style={{ ...inputStyle, textAlign: "right" }}
                          />
                          <button
                            onClick={() => deleteCommunity(i)}
                            title="Delete this community"
                            style={{ padding: "5px 0", borderRadius: 4, border: "1px solid rgba(239,68,68,0.25)", background: "transparent", color: "#ef4444", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                          >
                            ✕
                          </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
                          <input
                            type="text"
                            value={c.format || ''}
                            placeholder="format (Skool, Whop…)"
                            onChange={e => editCommunity(i, 'format', e.target.value)}
                            style={{ ...inputStyle, fontSize: 11 }}
                          />
                          <input
                            type="text"
                            value={c.url || ''}
                            placeholder="https://…"
                            onChange={e => editCommunity(i, 'url', e.target.value)}
                            style={{ ...inputStyle, fontSize: 11, color: "#7A0E18" }}
                          />
                        </div>
                        {/* Buyer count + retire toggle — same as products row */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 6, alignItems: "center" }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <span style={{ fontSize: 9, fontWeight: 600, color: "#444", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Current members</span>
                            <input
                              type="number"
                              min="0"
                              value={c.estimated_buyers ?? ''}
                              placeholder="auto-estimate"
                              onChange={e => editCommunity(i, 'estimated_buyers', e.target.value === '' ? null : Number(e.target.value))}
                              style={{ ...inputStyle, width: 130, fontSize: 11, textAlign: "right" }}
                              title="Operator estimate of current paying members. Leave blank for a conservative auto-estimate."
                            />
                          </div>
                          <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 10, color: c.retire_on_launch ? "#ef4444" : "#666" }}>
                            <input
                              type="checkbox"
                              checked={!!c.retire_on_launch}
                              onChange={e => editCommunity(i, 'retire_on_launch', e.target.checked)}
                              style={{ accentColor: "#ef4444", cursor: "pointer" }}
                              title="Mark this community as retired when the new offer launches."
                            />
                            Retire on launch
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Cannibalization */}
          {(audit.cannibalization_constraints || []).length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#eab308", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Cannibalization constraints · {audit.cannibalization_constraints.length}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {audit.cannibalization_constraints.map((c, i) => (
                  <li key={i} style={{ fontSize: 12, color: "#ccc", lineHeight: 1.55, paddingLeft: 14, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: "#eab308" }}>!</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Synergies */}
          {(audit.synergy_opportunities || []).length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Synergy opportunities · {audit.synergy_opportunities.length}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {audit.synergy_opportunities.map((s, i) => (
                  <li key={i} style={{ fontSize: 12, color: "#ccc", lineHeight: 1.55, paddingLeft: 14, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: "#22c55e" }}>+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {runAt && (
            <div style={{ fontSize: 10, color: "#333", marginTop: 14, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              Last run: {new Date(runAt).toLocaleString("pt-PT")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Phase 2 · Archetype + Fame Tier viewer (internal use only).
//
// Reads from creator.offer.internal_metadata.archetype_classification.
// NEVER renders to the creator — operator-only insight that biases the
// downstream offer playbook (Checkpoint 1 of the wizard).
// ─────────────────────────────────────────────────────────────────

function ArchetypePanel({ creator, running, error, diag, onRun }) {
  const c = creator?.offer?.internal_metadata?.archetype_classification || null;
  const runAt = creator?.offer?.internal_metadata?.generation_timestamps?.archetype_classification || null;

  const ARCHETYPE_LABELS = {
    expert_educator: 'Expert / Educator',
    performer_practitioner: 'Performer / Practitioner',
    coach_transformation: 'Coach / Transformation',
    personality_entertainer: 'Personality / Entertainer',
    curator_aggregator: 'Curator / Aggregator',
    builder_operator: 'Builder / Operator',
  };
  const ARCHETYPE_DESC = {
    expert_educator: 'Teaches concrete knowledge — frameworks, lessons, how-tos.',
    performer_practitioner: 'Does the craft in public — process, skill, output.',
    coach_transformation: 'Sells measurable personal change — before/after.',
    personality_entertainer: 'Audience follows for the person, not the topic.',
    curator_aggregator: 'Trusted filter / taste — picks, reviews, finds.',
    builder_operator: 'Builds in public — revenue, ops, behind-the-scenes.',
  };
  const FAME_LABELS = {
    micro: 'Micro · known only to direct followers',
    niche_recognized: 'Niche-recognized · known inside their professional niche',
    cross_niche_recognized: 'Cross-niche · mainstream press / national TV / book',
    celebrity: 'Celebrity · household name',
  };

  // Confidence color: green ≥85, yellow 70-84, amber 50-69, red <50.
  const confColor = (n) => {
    if (n == null) return '#444';
    if (n >= 85) return '#22c55e';
    if (n >= 70) return '#3b82f6';
    if (n >= 50) return '#eab308';
    return '#ef4444';
  };
  const ambiguous = c && typeof c.primary_confidence === 'number' && c.primary_confidence < 70;

  return (
    <div style={{ marginBottom: 28, padding: "18px 20px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>● Phase 2 · Internal</div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>Archetype + Fame Tier</h3>
          <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0" }}>
            Classifies the creator into 1 of 6 archetypes + assesses fame outside their direct audience. Operator-only.
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid rgba(122,14,24,0.4)",
            background: running ? "rgba(255,255,255,0.02)" : "rgba(122,14,24,0.08)",
            color: running ? "#555" : "#B11E2F",
            fontSize: 11,
            fontWeight: 600,
            cursor: running ? "wait" : "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          {running ? "A classificar..." : c ? "↻ Re-run" : "Run classifier"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 11, marginBottom: 12, whiteSpace: "pre-wrap" }}>{error}</div>
      )}
      {diag && !running && (
        <div style={{ fontSize: 10, color: "#444", marginBottom: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
          {diag.captions_available} captions analysed · ecosystem audit {diag.ecosystem_audit_used ? 'used' : 'not yet run'} · {diag.retries} retries
        </div>
      )}

      {!c && !running && (
        <div style={{ padding: "20px 16px", textAlign: "center", color: "#444", fontSize: 12, border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 6 }}>
          No archetype yet. Click <strong style={{ color: "#888" }}>Run classifier</strong> (~30-60s, uses web_search for fame signals).
        </div>
      )}

      {c && (
        <div>
          {/* Ambiguity banner — surfaces when the model wasn't sure */}
          {ambiguous && (
            <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.25)", color: "#eab308", fontSize: 11, marginBottom: 12 }}>
              ⚠ <strong>Ambiguous classification</strong> · primary confidence below 70%. Both options shown — operator decides at Checkpoint 1.
            </div>
          )}

          {/* Primary + Secondary archetype cards */}
          <div style={{ display: "grid", gridTemplateColumns: c.secondary_archetype ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ padding: "14px 16px", background: "#0a0a0a", borderRadius: 8, border: `1px solid ${ambiguous ? 'rgba(234,179,8,0.25)' : 'rgba(122,14,24,0.35)'}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: ambiguous ? '#eab308' : '#7A0E18', letterSpacing: "0.16em", textTransform: "uppercase" }}>Primary</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: confColor(c.primary_confidence) }}>{c.primary_confidence}%</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f5", marginBottom: 4 }}>{ARCHETYPE_LABELS[c.primary_archetype] || c.primary_archetype}</div>
              <p style={{ fontSize: 11, color: "#888", margin: 0, lineHeight: 1.5 }}>{ARCHETYPE_DESC[c.primary_archetype]}</p>
            </div>
            {c.secondary_archetype && (
              <div style={{ padding: "14px 16px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.16em", textTransform: "uppercase" }}>Secondary</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: confColor(c.secondary_confidence) }}>{c.secondary_confidence}%</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#ccc", marginBottom: 4 }}>{ARCHETYPE_LABELS[c.secondary_archetype] || c.secondary_archetype}</div>
                <p style={{ fontSize: 11, color: "#666", margin: 0, lineHeight: 1.5 }}>{ARCHETYPE_DESC[c.secondary_archetype]}</p>
              </div>
            )}
          </div>

          {/* Classification evidence */}
          {(c.classification_evidence || []).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Evidence · {c.classification_evidence.length}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {c.classification_evidence.map((e, i) => (
                  <li key={i} style={{ fontSize: 12, color: "#ccc", lineHeight: 1.55, paddingLeft: 14, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: "#7A0E18" }}>›</span>{e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fame tier */}
          <div style={{ padding: "12px 14px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)", marginBottom: runAt ? 14 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#3b82f6", letterSpacing: "0.16em", textTransform: "uppercase" }}>Fame Tier</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 3, background: "rgba(59,130,246,0.08)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.25)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{(c.fame_tier || '').replace('_', ' ')}</span>
            </div>
            <div style={{ fontSize: 12, color: "#ccc", marginBottom: 6 }}>{FAME_LABELS[c.fame_tier] || c.fame_tier}</div>
            <p style={{ fontSize: 11, color: "#888", margin: 0, lineHeight: 1.55 }}>{c.fame_tier_evidence}</p>
          </div>

          {runAt && (
            <div style={{ fontSize: 10, color: "#333", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              Last run: {new Date(runAt).toLocaleString("pt-PT")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 3 · Uniqueness Extraction (internal-only)
// ──────────────────────────────────────────────────────────────────────────
// Renders the 5-8 unique elements + creator_voice_summary that live under
//   creator.offer.internal_metadata.uniqueness_extraction
// Each element carries category, monetization_potential, evidence_source,
// and a usable_in_modules flag. Phase 4 will pick the strongest elements and
// translate them into client-facing differentiator copy.
function UniquenessPanel({ creator, running, error, diag, onRun }) {
  const u = creator?.offer?.internal_metadata?.uniqueness_extraction || null;
  const runAt = creator?.offer?.internal_metadata?.generation_timestamps?.uniqueness_extraction || null;

  // Category visuals — kept aligned with the 7-enum in schemas/uniqueness.js
  const CATEGORY_LABELS = {
    story: 'Story',
    credential: 'Credential',
    viral_moment: 'Viral Moment',
    vocabulary: 'Vocabulary',
    contrarian_angle: 'Contrarian Angle',
    proprietary_method: 'Proprietary Method',
    behind_the_scenes_access: 'BTS Access',
  };
  const CATEGORY_COLORS = {
    story: '#a855f7',                  // purple
    credential: '#3b82f6',             // blue
    viral_moment: '#ef4444',           // red
    vocabulary: '#14b8a6',             // teal
    contrarian_angle: '#f97316',       // orange
    proprietary_method: '#7A0E18',     // brand red
    behind_the_scenes_access: '#eab308', // amber
  };

  // Monetization tier visuals — high = green, medium = blue, low = grey.
  const MON_COLORS = {
    high: '#22c55e',
    medium: '#3b82f6',
    low: '#666',
  };
  const MON_LABELS = {
    high: 'HIGH $',
    medium: 'MED $',
    low: 'LOW $',
  };

  const usableCount = u ? (u.unique_elements || []).filter(e => e.usable_in_modules).length : 0;

  return (
    <div style={{ marginBottom: 28, padding: "18px 20px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>● Phase 3 · Internal</div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>Uniqueness Extraction</h3>
          <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0" }}>
            5-8 elements that ONLY this creator can claim, each with concrete evidence. Phase 4 turns the strongest into sales copy.
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid rgba(122,14,24,0.4)",
            background: running ? "rgba(255,255,255,0.02)" : "rgba(122,14,24,0.08)",
            color: running ? "#555" : "#B11E2F",
            fontSize: 11,
            fontWeight: 600,
            cursor: running ? "wait" : "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          {running ? "A extrair..." : u ? "↻ Re-run" : "Run extractor"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 11, marginBottom: 12, whiteSpace: "pre-wrap" }}>{error}</div>
      )}
      {diag && !running && (
        <div style={{ fontSize: 10, color: "#444", marginBottom: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
          {diag.elements_returned} elements · {diag.captions_analysed} captions · archetype {diag.archetype_used ? '✓' : '—'} · ecosystem {diag.ecosystem_audit_used ? '✓' : '—'} · {diag.retries} retries
        </div>
      )}

      {!u && !running && (
        <div style={{ padding: "20px 16px", textAlign: "center", color: "#444", fontSize: 12, border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 6 }}>
          No uniqueness yet. Click <strong style={{ color: "#888" }}>Run extractor</strong> (~15-30s, Sonnet only, uses Phase 1+2 outputs).
        </div>
      )}

      {u && (
        <div>
          {/* Summary row — usable_in_modules count drives Phase 4 module generation */}
          <div style={{ fontSize: 10, color: "#666", marginBottom: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "0.04em" }}>
            {(u.unique_elements || []).length} elements · <span style={{ color: usableCount >= 3 ? '#22c55e' : '#eab308' }}>{usableCount} module-usable</span>
          </div>

          {/* Element cards — one per unique element */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {(u.unique_elements || []).map((el, i) => {
              const catColor = CATEGORY_COLORS[el.category] || '#666';
              const monColor = MON_COLORS[el.monetization_potential] || '#666';
              return (
                <div
                  key={i}
                  style={{
                    padding: "13px 15px",
                    background: "#0a0a0a",
                    borderRadius: 8,
                    border: `1px solid ${el.usable_in_modules ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  {/* Header row — number + category badge + monetization badge + module flag */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#444", fontFamily: "'JetBrains Mono', ui-monospace, monospace", minWidth: 18 }}>#{i + 1}</span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 3,
                        background: `${catColor}15`,
                        color: catColor,
                        border: `1px solid ${catColor}40`,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {CATEGORY_LABELS[el.category] || el.category}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 3,
                        background: `${monColor}15`,
                        color: monColor,
                        border: `1px solid ${monColor}40`,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {MON_LABELS[el.monetization_potential] || el.monetization_potential}
                    </span>
                    {el.usable_in_modules && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 3,
                          background: "rgba(34,197,94,0.08)",
                          color: "#22c55e",
                          border: "1px solid rgba(34,197,94,0.3)",
                          letterSpacing: "0.06em",
                          marginLeft: "auto",
                        }}
                      >
                        ✓ MODULE-USABLE
                      </span>
                    )}
                  </div>

                  {/* The element itself */}
                  <div style={{ fontSize: 13, color: "#f5f5f5", lineHeight: 1.5, marginBottom: 8, fontWeight: 500 }}>{el.element}</div>

                  {/* Evidence quote — italicised, indented, with corner mark */}
                  <div
                    style={{
                      fontSize: 11,
                      color: "#888",
                      lineHeight: 1.5,
                      fontStyle: "italic",
                      paddingLeft: 10,
                      borderLeft: "2px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", fontStyle: "normal", marginRight: 6 }}>Evidence:</span>
                    {el.evidence_source}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Creator voice summary — drives tone for every piece of generated copy in Phase 4 */}
          {u.creator_voice_summary && (
            <div style={{ padding: "13px 15px", background: "rgba(122,14,24,0.04)", borderRadius: 8, border: "1px solid rgba(122,14,24,0.18)", marginBottom: runAt ? 14 : 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Creator Voice</div>
              <p style={{ fontSize: 12, color: "#ddd", margin: 0, lineHeight: 1.55, fontStyle: "italic" }}>{u.creator_voice_summary}</p>
            </div>
          )}

          {runAt && (
            <div style={{ fontSize: 10, color: "#333", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              Last run: {new Date(runAt).toLocaleString("pt-PT")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 4 · Wizard Stepper
// ──────────────────────────────────────────────────────────────────────────
// Renders the 5-checkpoint progress bar above the active checkpoint panel.
// State source-of-truth is creator.offer.internal_metadata.checkpoint_progress.
// Visual states per checkpoint:
//   - locked        : green check, dim
//   - current       : highlighted brand-red, full opacity
//   - upcoming      : grey, dim, disabled
//   - invalidated   : (after unlock cascade) — treated same as upcoming
function WizardStepper({ creator }) {
  const prog = readCheckpointProgress(creator?.offer?.internal_metadata);

  const isLocked = (id) => !!prog.locked[id];
  const isCurrent = (id) => prog.current === id;

  // Required pre-flight signals (Phases 1-3) — operator should see at a
  // glance if anything's missing before the wizard can start producing
  // meaningful output. Doesn't block running CP1 (people may want a sketch
  // even with partial data) but surfaces the gap.
  const meta = creator?.offer?.internal_metadata || {};
  const haveAudit = !!meta.ecosystem_audit;
  const haveArchetype = !!meta.archetype_classification;
  const haveUniqueness = !!meta.uniqueness_extraction;
  const allReady = haveAudit && haveArchetype && haveUniqueness;

  return (
    <div style={{ marginBottom: 28, padding: "18px 20px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>● Phase 4 · Wizard</div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>Offer Generation · 5 Checkpoints</h3>
          <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0" }}>
            Stitches Phase 1+2+3 internal signals into the offer the creator sees. Each checkpoint locks before advancing.
          </p>
        </div>
        {/* Pre-flight readiness chips */}
        <div style={{ display: "flex", gap: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}>
          <span style={{ padding: "3px 8px", borderRadius: 3, background: haveAudit ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.06)", color: haveAudit ? "#22c55e" : "#666", border: `1px solid ${haveAudit ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}` }}>P1 {haveAudit ? '✓' : '—'}</span>
          <span style={{ padding: "3px 8px", borderRadius: 3, background: haveArchetype ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.06)", color: haveArchetype ? "#22c55e" : "#666", border: `1px solid ${haveArchetype ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}` }}>P2 {haveArchetype ? '✓' : '—'}</span>
          <span style={{ padding: "3px 8px", borderRadius: 3, background: haveUniqueness ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.06)", color: haveUniqueness ? "#22c55e" : "#666", border: `1px solid ${haveUniqueness ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}` }}>P3 {haveUniqueness ? '✓' : '—'}</span>
        </div>
      </div>

      {!allReady && (
        <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(234,179,8,0.05)", border: "1px solid rgba(234,179,8,0.18)", color: "#eab308", fontSize: 10.5, marginBottom: 14 }}>
          ⚠ Run Phase 1 + 2 + 3 first for full-quality wizard output. CP1 will still run but with weaker grounding.
        </div>
      )}

      {/* The stepper itself — 5 circles connected by line segments */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        {CHECKPOINTS.map((cp, idx) => {
          const locked = isLocked(cp.id);
          const current = isCurrent(cp.id);
          const dotBg = locked ? "rgba(34,197,94,0.12)" : current ? "rgba(122,14,24,0.18)" : "rgba(255,255,255,0.025)";
          const dotBorder = locked ? "rgba(34,197,94,0.5)" : current ? "rgba(122,14,24,0.6)" : "rgba(255,255,255,0.08)";
          const dotColor = locked ? "#22c55e" : current ? "#B11E2F" : "#444";
          const labelColor = locked ? "#888" : current ? "#f5f5f5" : "#444";
          return (
            <div key={cp.id} style={{ display: "flex", alignItems: "center", flex: idx === CHECKPOINTS.length - 1 ? "0 0 auto" : 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 80 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: dotBg,
                    border: `1.5px solid ${dotBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: dotColor,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  }}
                >
                  {locked ? "✓" : cp.id}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: labelColor }}>{cp.short}</div>
              </div>
              {idx !== CHECKPOINTS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: locked ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.06)",
                    margin: "0 4px",
                    marginTop: -22, // align with the circle midline
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Placeholder for un-built checkpoints. Each CP1-CP5 commit replaces the
// switch arm for its checkpoint with the real implementation. Keeping a
// single stub here means the wizard stepper + offer tab structure work end-
// to-end even when only some CPs are built.
function CheckpointStubPanel({ checkpoint }) {
  return (
    <div style={{ marginBottom: 28, padding: "20px 24px", background: "rgba(255,255,255,0.015)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 10, textAlign: "center" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>
        ● Checkpoint {checkpoint.id} of 5
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px", color: "#f5f5f5" }}>{checkpoint.name}</h3>
      <p style={{ fontSize: 11, color: "#666", margin: 0 }}>
        Not yet implemented — ships in the next commit.
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 4 · CP1 — Strategic Frame Panel
// ──────────────────────────────────────────────────────────────────────────
// Renders the strategic_frame from internal_metadata + handles three actions:
//   - Generate (POST /wizard/strategic-frame) — runs the LLM, populates frame
//   - Approve & Continue (POST /wizard/checkpoint/1/lock) — locks CP1, advances to CP2
//   - Unlock (POST /wizard/checkpoint/1/unlock) — wipes frame + cascades to CP2-5
//
// This panel stays internal — content is the operator's strategic commit,
// NOT the creator's sales copy. CP2 will pull these fields in as system
// context and translate them into client-facing language.
function StrategicFramePanel({ creator, setCreator, running, setRunning, error, setError, diag, setDiag }) {
  const meta = creator?.offer?.internal_metadata || {};
  const frame = meta.strategic_frame || null;
  const runAt = meta.generation_timestamps?.strategic_frame || null;
  const progress = readCheckpointProgress(meta);
  const cp1Locked = !!progress.locked[1];
  const [lockBusy, setLockBusy] = useState(false);

  const ROLE_LABELS = {
    entry_point: 'Entry Point',
    continuity: 'Continuity',
    premium_upsell: 'Premium Upsell',
    standalone: 'Standalone',
  };
  const ROLE_COLORS = {
    entry_point: '#22c55e',
    continuity: '#3b82f6',
    premium_upsell: '#a855f7',
    standalone: '#eab308',
  };

  const generate = async (instruction = null) => {
    // When bound directly as onClick={generate}, React passes the synthetic
    // event as the first arg. Coerce non-string values to null so the body
    // payload's JSON.stringify doesn't try to serialise a DOM event + its
    // React fiber (which is a circular structure).
    if (typeof instruction !== 'string') instruction = null;
    if (!creator?.id || running) return;
    setRunning(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/strategic-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(instruction ? { instruction } : {}),
      });
      const data = await r.json();
      if (!r.ok) {
        const detail = data.errors?.length ? '\n\n' + data.errors.join('\n') : '';
        throw new Error((data.error || 'Strategic frame failed') + detail);
      }
      setDiag(data._diagnostics || null);
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            strategic_frame: data.strategic_frame,
          },
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  const lockAndContinue = async () => {
    if (!creator?.id || lockBusy) return;
    setLockBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/checkpoint/1/lock`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Lock failed');
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            checkpoint_progress: data.checkpoint_progress,
          },
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Lock failed');
    } finally {
      setLockBusy(false);
    }
  };

  const unlock = async () => {
    if (!creator?.id || lockBusy) return;
    if (!confirm('Unlock CP1? This will clear CP2-5 if any have been generated.')) return;
    setLockBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/checkpoint/1/unlock`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Unlock failed');
      // Lazy refresh — re-fetch the creator so we get the cascade-cleared shape
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            checkpoint_progress: data.checkpoint_progress,
            // Per the spec, unlocking CP1 also wipes strategic_frame.
            strategic_frame: null,
          },
          client_facing_output: (() => {
            const c = (prev.offer || {}).client_facing_output || {};
            const cleared = { ...c };
            (data.cleared?.client || []).forEach(k => { cleared[k] = Array.isArray(c[k]) ? [] : null; });
            return cleared;
          })(),
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Unlock failed');
    } finally {
      setLockBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 28, padding: "18px 20px", background: "rgba(255,255,255,0.015)", border: `1px solid ${cp1Locked ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: cp1Locked ? "#22c55e" : "#7A0E18", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>
            ● Checkpoint 1 of 5 · {cp1Locked ? 'Locked ✓' : 'In Progress'}
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>Strategic Frame</h3>
          <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0" }}>
            Operator's strategic commit — internal language only, never shown to creator. CP2-5 use this as system context.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!cp1Locked && (
            <button
              onClick={generate}
              disabled={running || lockBusy}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(122,14,24,0.4)",
                background: running ? "rgba(255,255,255,0.02)" : "rgba(122,14,24,0.08)",
                color: running ? "#555" : "#B11E2F",
                fontSize: 11,
                fontWeight: 600,
                cursor: running ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {running ? "A gerar..." : frame ? "↻ Re-run" : "Generate (~$0.02)"}
            </button>
          )}
          {!cp1Locked && frame && (
            <button
              onClick={lockAndContinue}
              disabled={running || lockBusy}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(34,197,94,0.45)",
                background: "rgba(34,197,94,0.08)",
                color: "#22c55e",
                fontSize: 11,
                fontWeight: 600,
                cursor: lockBusy ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {lockBusy ? "..." : "✓ Approve & continue →"}
            </button>
          )}
          {cp1Locked && (
            <button
              onClick={unlock}
              disabled={lockBusy}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(234,179,8,0.4)",
                background: "rgba(234,179,8,0.06)",
                color: "#eab308",
                fontSize: 11,
                fontWeight: 600,
                cursor: lockBusy ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {lockBusy ? "..." : "↺ Unlock"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 11, marginBottom: 12, whiteSpace: "pre-wrap" }}>{error}</div>
      )}
      {diag && !running && (
        <div style={{ fontSize: 10, color: "#444", marginBottom: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
          audit role input: {diag.audit_role_input || '—'} · archetype {diag.archetype_used ? '✓' : '—'} · uniqueness elements: {diag.uniqueness_elements_input} · {diag.retries} retries
        </div>
      )}

      {!cp1Locked && frame && (
        <RegenWithInstructionBlock
          placeholder="Ex: 'torna o ecosystem_impact[0] menos numérico, mais diagnóstico', 'foca no mid-tier missing', etc."
          busy={running}
          onRegen={(inst) => generate(inst)}
        />
      )}

      {!frame && !running && (
        <div style={{ padding: "20px 16px", textAlign: "center", color: "#444", fontSize: 12, border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 6 }}>
          No frame yet. Click <strong style={{ color: "#888" }}>Generate</strong> (~10-20s, Sonnet only, uses Phase 1+2+3 as context).
        </div>
      )}

      {frame && (
        <div>
          {/* Top row: confirmed role badge + dominant transformation */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "start", marginBottom: 16 }}>
            <div style={{ padding: "14px 16px", background: "#0a0a0a", borderRadius: 8, border: `1px solid ${ROLE_COLORS[frame.confirmed_role] || '#444'}40`, minWidth: 130 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Role</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: ROLE_COLORS[frame.confirmed_role] || '#ccc' }}>{ROLE_LABELS[frame.confirmed_role] || frame.confirmed_role}</div>
            </div>
            <div style={{ padding: "14px 16px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Dominant Transformation</div>
              <div style={{ fontSize: 13, color: "#f5f5f5", lineHeight: 1.55, fontWeight: 500 }}>{frame.dominant_transformation}</div>
            </div>
          </div>

          {/* Audience segment */}
          <div style={{ padding: "13px 15px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Audience Segment</div>
            <div style={{ fontSize: 12, color: "#ddd", lineHeight: 1.55, marginBottom: 6 }}>{frame.audience_segment?.description}</div>
            <div style={{ fontSize: 10.5, color: "#888", fontStyle: "italic", lineHeight: 1.5 }}>
              <span style={{ fontStyle: "normal", color: "#555", fontWeight: 700, marginRight: 6, letterSpacing: "0.06em" }}>ANCHOR:</span>
              {frame.audience_segment?.demographics_anchor}
            </div>
          </div>

          {/* Negative qualifiers */}
          {(frame.negative_qualifiers || []).length > 0 && (
            <div style={{ padding: "13px 15px", background: "rgba(239,68,68,0.03)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.18)", marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Not For ({(frame.negative_qualifiers || []).length})</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {frame.negative_qualifiers.map((q, i) => (
                  <li key={i} style={{ fontSize: 12, color: "#ccc", lineHeight: 1.5, paddingLeft: 14, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: "#ef4444" }}>✕</span>{q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Positioning tension */}
          <div style={{ padding: "13px 15px", background: "rgba(122,14,24,0.04)", borderRadius: 8, border: "1px solid rgba(122,14,24,0.18)", marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Positioning Tension</div>
            <div style={{ fontSize: 12.5, color: "#f5f5f5", lineHeight: 1.55, fontStyle: "italic" }}>{frame.positioning_tension}</div>
          </div>

          {/* Rationale — collapsed under a subtle header so it doesn't dominate */}
          {(frame.rationale || []).length > 0 && (
            <div style={{ marginBottom: runAt ? 14 : 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Rationale ({(frame.rationale || []).length})</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {frame.rationale.map((r, i) => (
                  <li key={i} style={{ fontSize: 11.5, color: "#aaa", lineHeight: 1.55, paddingLeft: 14, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: "#666" }}>›</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {runAt && (
            <div style={{ fontSize: 10, color: "#333", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              Last run: {new Date(runAt).toLocaleString("pt-PT")}
              {cp1Locked && progress.locked[1] && (
                <> · Locked: {new Date(progress.locked[1]).toLocaleString("pt-PT")}</>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 4 · CP2 — Core Offer Panel
// ──────────────────────────────────────────────────────────────────────────
// First creator-facing checkpoint. Renders the offer spine from
// client_facing_output + lets the operator pick the pricing tier BEFORE
// generation (the tier shapes the entire output).
//
// Workflow:
//   1. (no offer yet) → operator picks Low/Mid/High → click Generate
//   2. Review the output (community name, transformation, pricing, mechanic)
//   3. Approve & Continue → locks CP2, advances to CP3
//   4. To edit → Unlock (cascades to CP3-5)
function CoreOfferPanel({ creator, setCreator, running, setRunning, error, setError, diag, setDiag }) {
  const meta = creator?.offer?.internal_metadata || {};
  const client = creator?.offer?.client_facing_output || {};
  const progress = readCheckpointProgress(meta);
  const cp2Locked = !!progress.locked[2];
  const runAt = meta.generation_timestamps?.core_offer || null;
  const frame = meta.strategic_frame || null;

  // Has CP2 produced its required fields? central_promise is the canonical
  // sentinel — if it exists, CP2 has run at least once.
  const hasOutput = !!client.central_promise;

  // Operator picks pricing_tier BEFORE generation. Default suggestion logic:
  //   1. CANNIBALIZATION-AWARE: if the ecosystem audit reports an existing
  //      community + community_cannibalization_risk ∈ {high, medium}, the
  //      default tier MUST land in a DIFFERENT band than the existing
  //      community's tier (otherwise we ship a competing offer).
  //      - existing low_ticket  → suggest 'mid' or 'high'  (premium upsell)
  //      - existing mid_ticket  → suggest 'low' or 'high'  (different segment)
  //      - existing high_ticket → suggest 'low'             (entry-point feeder)
  //   2. Otherwise, role-based defaults:
  //      - premium_upsell → high
  //      - continuity + fame ≥ niche_recognized → mid
  //      - else → low
  const archetype = meta.archetype_classification || {};
  const ecosystemMap = meta.ecosystem_audit?.ecosystem_map || {};
  const existingCommunities = Array.isArray(ecosystemMap.existing_communities) ? ecosystemMap.existing_communities : [];
  const cannibalRisk = ecosystemMap.community_cannibalization_risk || 'none';
  const suggestedTier = (() => {
    // (1) Cannibalization-aware default. Look at the highest-tier existing
    // community and pick the band that doesn't overlap.
    if (existingCommunities.length > 0 && (cannibalRisk === 'high' || cannibalRisk === 'medium')) {
      const tiers = existingCommunities.map(c => c.tier);
      if (tiers.includes('high_ticket') || tiers.includes('mid_ticket')) return 'low';
      if (tiers.includes('low_ticket') || tiers.includes('recurring')) return 'high';
    }
    // (2) Role-based default (unchanged).
    if (frame?.confirmed_role === 'premium_upsell') return 'high';
    if (frame?.confirmed_role === 'continuity' && ['niche_recognized', 'cross_niche_recognized', 'celebrity'].includes(archetype.fame_tier)) return 'mid';
    return 'low';
  })();
  // Default state: if CP2 already ran, show its tier. Otherwise, the suggestion.
  const [pendingTier, setPendingTier] = useState(client.pricing_tier || suggestedTier);
  // Operator override for pricing_model. 'auto' lets the model decide based
  // on confirmed_role (legacy behavior). 'monthly' / 'one_time' force the
  // model. Useful when creator already has a monthly community and the
  // operator wants to position the new offer as one-time (or vice versa).
  const [pendingModel, setPendingModel] = useState(client.pricing_model_override || 'auto');
  const [lockBusy, setLockBusy] = useState(false);

  const TIER_LABELS = {
    low: 'Low · €30-100/mo',
    mid: 'Mid · €200-500/mo',
    high: 'High · €1K+/mo or €3K+ one-time',
  };
  const MODEL_LABELS = {
    auto:     'Auto (model decides)',
    monthly:  'Monthly subscription',
    one_time: 'One-time payment',
    annual:   'Annual subscription',
    hybrid:   'Hybrid (initial + recurring)',
  };

  const generate = async (instruction = null) => {
    // When bound directly as onClick={generate}, React passes the synthetic
    // event as the first arg. Coerce non-string values to null so the body
    // payload's JSON.stringify doesn't try to serialise a DOM event + its
    // React fiber (which is a circular structure).
    if (typeof instruction !== 'string') instruction = null;
    if (!creator?.id || running) return;
    setRunning(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/core-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pricing_tier: pendingTier,
          // Only include pricing_model_override when operator picked something
          // other than 'auto'. The endpoint reads this and forces the model.
          ...(pendingModel !== 'auto' ? { pricing_model_override: pendingModel } : {}),
          ...(instruction ? { instruction } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        const detail = data.errors?.length ? '\n\n' + data.errors.join('\n') : '';
        throw new Error((data.error || 'Core offer failed') + detail);
      }
      setDiag(data._diagnostics || null);
      // Merge core_offer fields into client_facing_output, preserve everything else
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          client_facing_output: {
            ...((prev.offer || {}).client_facing_output || {}),
            ...data.core_offer,
          },
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  const lockAndContinue = async () => {
    if (!creator?.id || lockBusy) return;
    setLockBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/checkpoint/2/lock`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Lock failed');
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            checkpoint_progress: data.checkpoint_progress,
          },
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Lock failed');
    } finally {
      setLockBusy(false);
    }
  };

  const unlock = async () => {
    if (!creator?.id || lockBusy) return;
    if (!confirm('Unlock CP2? This will cascade-clear CP3-5 if any have been generated.')) return;
    setLockBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/checkpoint/2/unlock`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Unlock failed');
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            checkpoint_progress: data.checkpoint_progress,
          },
          client_facing_output: (() => {
            const c = (prev.offer || {}).client_facing_output || {};
            const cleared = { ...c };
            (data.cleared?.client || []).forEach(k => {
              // Reset to a sensible empty per field shape
              const empty = Array.isArray(c[k]) ? [] : (typeof c[k] === 'object' && c[k] !== null && !Array.isArray(c[k])) ? null : null;
              cleared[k] = empty;
            });
            return cleared;
          })(),
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Unlock failed');
    } finally {
      setLockBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 28, padding: "18px 20px", background: "rgba(255,255,255,0.015)", border: `1px solid ${cp2Locked ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: cp2Locked ? "#22c55e" : "#7A0E18", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>
            ● Checkpoint 2 of 5 · {cp2Locked ? 'Locked ✓' : 'In Progress'}
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>Core Offer</h3>
          <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0" }}>
            The offer spine — Big Idea, transformation, pricing, community name, weekly rhythm. First creator-facing checkpoint, voice matters.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!cp2Locked && hasOutput && (
            <button
              onClick={lockAndContinue}
              disabled={running || lockBusy}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(34,197,94,0.45)",
                background: "rgba(34,197,94,0.08)",
                color: "#22c55e",
                fontSize: 11,
                fontWeight: 600,
                cursor: lockBusy ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {lockBusy ? "..." : "✓ Approve & continue →"}
            </button>
          )}
          {cp2Locked && (
            <button
              onClick={unlock}
              disabled={lockBusy}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(234,179,8,0.4)",
                background: "rgba(234,179,8,0.06)",
                color: "#eab308",
                fontSize: 11,
                fontWeight: 600,
                cursor: lockBusy ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {lockBusy ? "..." : "↺ Unlock"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 11, marginBottom: 12, whiteSpace: "pre-wrap" }}>{error}</div>
      )}

      {/* Tier picker — only when editable */}
      {!cp2Locked && (
        <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
            Pricing tier {pendingTier === suggestedTier ? <span style={{ color: "#888", fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>· suggested based on frame + archetype</span> : null}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(['low', 'mid', 'high']).map(t => {
              const active = pendingTier === t;
              return (
                <button
                  key={t}
                  onClick={() => setPendingTier(t)}
                  disabled={running}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: `1px solid ${active ? 'rgba(122,14,24,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    background: active ? "rgba(122,14,24,0.12)" : "rgba(255,255,255,0.02)",
                    color: active ? "#B11E2F" : "#888",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: running ? "wait" : "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    letterSpacing: "0.02em",
                  }}
                >
                  {TIER_LABELS[t]}
                </button>
              );
            })}
          </div>
          {/* Pricing model override — Auto lets the model decide based on
              confirmed_role. The other four force a specific model. Useful
              when the creator already has a monthly community (force
              one-time) or vice versa. */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>
              Pricing model {pendingModel === 'auto' ? <span style={{ color: "#888", fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>· auto-picked from role</span> : <span style={{ color: "#B11E2F", fontWeight: 700, letterSpacing: 0, textTransform: "none" }}>· locked by operator</span>}
            </div>
            <select
              value={pendingModel}
              onChange={(e) => setPendingModel(e.target.value)}
              disabled={running}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: `1px solid ${pendingModel !== 'auto' ? 'rgba(122,14,24,0.5)' : 'rgba(255,255,255,0.08)'}`,
                background: pendingModel !== 'auto' ? "rgba(122,14,24,0.06)" : "rgba(255,255,255,0.02)",
                color: pendingModel !== 'auto' ? "#B11E2F" : "#bbb",
                fontSize: 11,
                fontWeight: 600,
                cursor: running ? "wait" : "pointer",
                fontFamily: "inherit",
                appearance: "none",
                WebkitAppearance: "none",
              }}
            >
              {Object.entries(MODEL_LABELS).map(([key, label]) => (
                <option key={key} value={key} style={{ background: "#0a0a0a", color: "#f5f5f5" }}>{label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={generate}
            disabled={running}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "10px 14px",
              borderRadius: 6,
              border: "1px solid rgba(122,14,24,0.4)",
              background: running ? "rgba(255,255,255,0.02)" : "rgba(122,14,24,0.08)",
              color: running ? "#555" : "#B11E2F",
              fontSize: 11,
              fontWeight: 600,
              cursor: running ? "wait" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {running ? "A gerar..." : hasOutput ? `↻ Re-run @ ${pendingTier}` : `Generate @ ${pendingTier}${pendingModel !== 'auto' ? ` · ${pendingModel}` : ''} (~$0.04)`}
          </button>
        </div>
      )}

      {diag && !running && (
        <div style={{ fontSize: 10, color: "#444", marginBottom: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
          tier: {diag.pricing_tier_input} · frame role: {diag.frame_role || '—'} · uniqueness elements: {diag.uniqueness_elements_input} · {diag.retries} retries
        </div>
      )}

      {!hasOutput && !running && (
        <div style={{ padding: "20px 16px", textAlign: "center", color: "#444", fontSize: 12, border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 6 }}>
          No core offer yet. Pick a tier above, then click <strong style={{ color: "#888" }}>Generate</strong> (~15-25s, Sonnet only).
        </div>
      )}

      {!cp2Locked && hasOutput && (
        <RegenWithInstructionBlock
          placeholder="Ex: 'community_name mais directo', 'audience_fit.not_for mais agressivo', 'transformation com prazo de 90 dias'..."
          busy={running}
          onRegen={(inst) => generate(inst)}
        />
      )}

      {hasOutput && (
        <div>
          {/* Community name + alternates */}
          <div style={{ padding: "14px 16px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(122,14,24,0.25)", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.14em", textTransform: "uppercase" }}>Community Name</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", letterSpacing: "0.06em", padding: "2px 8px", background: "rgba(59,130,246,0.08)", borderRadius: 3, border: "1px solid rgba(59,130,246,0.25)" }}>{client.platform}</div>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#f5f5f5", marginBottom: 6, fontFamily: "'Instrument Serif', Georgia, serif", letterSpacing: "-0.01em" }}>{client.community_name}</div>
            {Array.isArray(client.name_candidates) && client.name_candidates.length > 0 && (
              <div style={{ fontSize: 10.5, color: "#666", fontStyle: "italic" }}>
                <span style={{ fontStyle: "normal", color: "#555", fontWeight: 700, marginRight: 6, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9 }}>Alts:</span>
                {client.name_candidates.join(' · ')}
              </div>
            )}
          </div>

          {/* Central promise (Big Idea) */}
          <div style={{ padding: "14px 16px", background: "rgba(122,14,24,0.04)", borderRadius: 8, border: "1px solid rgba(122,14,24,0.18)", marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Central Promise · Big Idea</div>
            <div style={{ fontSize: 14, color: "#f5f5f5", lineHeight: 1.55, fontWeight: 500 }}>{client.central_promise}</div>
          </div>

          {/* Transformation */}
          {client.transformation && (
            <div style={{ padding: "14px 16px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Transformation</div>
              <div className="sl-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>From</div>
                  <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.5 }}>{client.transformation.from}</div>
                </div>
                <div style={{ fontSize: 16, color: "#666", fontWeight: 700 }}>→</div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>To</div>
                  <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.5 }}>{client.transformation.to}</div>
                </div>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "#888" }}>
                <span style={{ color: "#555", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9, marginRight: 6 }}>Timeframe:</span>
                {client.transformation.timeframe}
              </div>
            </div>
          )}

          {/* Pricing */}
          <div style={{ padding: "14px 16px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Pricing</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f5f5f5", fontFamily: "'Instrument Serif', Georgia, serif", letterSpacing: "-0.02em" }}>{client.target_price}</div>
              <div style={{ fontSize: 10, color: "#666", letterSpacing: "0.06em" }}>
                <span style={{ padding: "2px 8px", borderRadius: 3, background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontWeight: 700, marginRight: 6, textTransform: "uppercase" }}>{client.pricing_tier}</span>
                <span style={{ padding: "2px 8px", borderRadius: 3, background: "rgba(59,130,246,0.08)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.25)", fontWeight: 700, textTransform: "uppercase" }}>{(client.pricing_model || '').replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          {/* Audience fit — two columns */}
          {client.audience_fit && (
            <div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ padding: "13px 15px", background: "rgba(34,197,94,0.04)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.18)" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>For ({(client.audience_fit.for || []).length})</div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  {(client.audience_fit.for || []).map((s, i) => (
                    <li key={i} style={{ fontSize: 11.5, color: "#ccc", lineHeight: 1.5, paddingLeft: 14, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: "#22c55e" }}>✓</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ padding: "13px 15px", background: "rgba(239,68,68,0.03)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.18)" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Not For ({(client.audience_fit.not_for || []).length})</div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  {(client.audience_fit.not_for || []).map((s, i) => (
                    <li key={i} style={{ fontSize: 11.5, color: "#ccc", lineHeight: 1.5, paddingLeft: 14, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: "#ef4444" }}>✕</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Core mechanic + weekly rhythm */}
          <div style={{ padding: "14px 16px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", marginBottom: runAt ? 14 : 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Core Mechanic</div>
            <div style={{ fontSize: 12.5, color: "#ddd", lineHeight: 1.55, marginBottom: 12 }}>{client.core_mechanic}</div>
            {Array.isArray(client.weekly_rhythm) && client.weekly_rhythm.length > 0 && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Weekly Rhythm</div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  {client.weekly_rhythm.map((s, i) => (
                    <li key={i} style={{ fontSize: 11.5, color: "#ccc", lineHeight: 1.5, paddingLeft: 14, position: "relative", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                      <span style={{ position: "absolute", left: 0, color: "#7A0E18" }}>›</span>{s}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* High-tier structural panel — only renders for tier=high AND when at
              least one hardening field is present. Each block is an operator
              verification gate: cannibalisation check → does this offer not
              compete with existing low/recurring; qualification filter → who
              should NOT buy; mechanism → proprietary not borrowed; quantified
              transformation → outcome not deliverable; format justification →
              why the price is justified by delivery; ladder coherence → why
              this rung is distinct from the existing ladder. */}
          {client.pricing_tier === 'high' && (
            client.cannibalisation_check ||
            client.qualification_filter ||
            client.mechanism_name ||
            client.mechanism_logic ||
            client.quantified_transformation ||
            client.format_justification ||
            client.ladder_coherence
          ) && (
            <div style={{ padding: "14px 16px", background: "rgba(122,14,24,0.04)", borderRadius: 8, border: "1px solid rgba(122,14,24,0.18)", marginBottom: runAt ? 14 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.14em", textTransform: "uppercase" }}>High-tier structural checks</span>
                <span style={{ fontSize: 9, color: "#7A0E18", padding: "1px 6px", borderRadius: 2, border: "1px solid rgba(122,14,24,0.3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>operator-only</span>
              </div>

              {client.quantified_transformation && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Quantified outcome</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5", lineHeight: 1.5 }}>{client.quantified_transformation}</div>
                </div>
              )}

              {(client.mechanism_name || client.mechanism_logic) && (
                <div style={{ marginBottom: 12, padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Proprietary mechanism</div>
                  {client.mechanism_name && (
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", fontFamily: "'Instrument Serif', Georgia, serif", letterSpacing: "-0.01em", marginBottom: 4 }}>{client.mechanism_name}</div>
                  )}
                  {client.mechanism_logic && (
                    <div style={{ fontSize: 11.5, color: "#bbb", lineHeight: 1.55, fontStyle: "italic" }}>{client.mechanism_logic}</div>
                  )}
                </div>
              )}

              {client.cannibalisation_check && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Cannibalisation check</div>
                  <div style={{ fontSize: 11.5, color: "#ddd", lineHeight: 1.55 }}>{client.cannibalisation_check}</div>
                </div>
              )}

              {client.qualification_filter && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Qualification filter</div>
                  <div style={{ fontSize: 11.5, color: "#ddd", lineHeight: 1.55 }}>{client.qualification_filter}</div>
                </div>
              )}

              {client.format_justification && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Format ↔ price justification</div>
                  <div style={{ fontSize: 11.5, color: "#ddd", lineHeight: 1.55 }}>{client.format_justification}</div>
                </div>
              )}

              {client.ladder_coherence && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Ladder coherence</div>
                  <div style={{ fontSize: 11.5, color: "#ddd", lineHeight: 1.55 }}>{client.ladder_coherence}</div>
                </div>
              )}
            </div>
          )}

          {runAt && (
            <div style={{ fontSize: 10, color: "#333", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              Last run: {new Date(runAt).toLocaleString("pt-PT")}
              {cp2Locked && progress.locked[2] && (
                <> · Locked: {new Date(progress.locked[2]).toLocaleString("pt-PT")}</>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 4 · CP3 — Modules Panel
// ──────────────────────────────────────────────────────────────────────────
// Renders 4-8 module cards. Each card shows:
//   - format badge (live_call / recorded_module / doc / template / community_ritual)
//   - name (creator voice)
//   - description
//   - transformation_delivered
//   - linked uniqueness elements (the defensibility chain — what proves
//     this module isn't a generic course module)
//   - delivery_cadence
//   - per-card Regen button with optional operator instruction
//
// Single-module regen is the key UX feature here: you don't have to nuke
// the whole set when one card is wrong.
function ModulesPanel({ creator, setCreator, running, setRunning, error, setError, diag, setDiag }) {
  const meta = creator?.offer?.internal_metadata || {};
  const client = creator?.offer?.client_facing_output || {};
  const progress = readCheckpointProgress(meta);
  const cp3Locked = !!progress.locked[3];
  const runAt = meta.generation_timestamps?.modules || null;
  const modules = Array.isArray(client.modules) ? client.modules : [];
  const weeklyFormats = Array.isArray(client.weekly_formats) ? client.weekly_formats : [];
  const library = Array.isArray(client.library) ? client.library : [];
  const hasOutput = modules.length > 0;
  const uniqueElements = meta.uniqueness_extraction?.unique_elements || [];

  const [lockBusy, setLockBusy] = useState(false);
  // Per-index regen tracking: { [index]: { busy, instruction, showInput } }
  const [regenState, setRegenState] = useState({});

  const FORMAT_LABELS = {
    live_call: 'Live Call',
    recorded_module: 'Recorded',
    doc: 'Playbook',
    template: 'Template',
    community_ritual: 'Ritual',
  };
  const FORMAT_COLORS = {
    live_call: '#ef4444',
    recorded_module: '#3b82f6',
    doc: '#a855f7',
    template: '#14b8a6',
    community_ritual: '#eab308',
  };

  const generate = async (instruction = null) => {
    // When bound directly as onClick={generate}, React passes the synthetic
    // event as the first arg. Coerce non-string values to null so the body
    // payload's JSON.stringify doesn't try to serialise a DOM event + its
    // React fiber (which is a circular structure).
    if (typeof instruction !== 'string') instruction = null;
    if (!creator?.id || running) return;
    setRunning(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(instruction ? { instruction } : {}),
      });
      const data = await r.json();
      if (!r.ok) {
        const detail = data.errors?.length ? '\n\n' + data.errors.join('\n') : '';
        throw new Error((data.error || 'Modules failed') + detail);
      }
      setDiag(data._diagnostics || null);
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          client_facing_output: {
            ...((prev.offer || {}).client_facing_output || {}),
            modules: data.modules,
            weekly_formats: data.weekly_formats,
            library: data.library,
          },
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  const regenSingle = async (ix) => {
    if (!creator?.id) return;
    if ((regenState[ix] || {}).busy) return;
    setRegenState(s => ({ ...s, [ix]: { ...(s[ix] || {}), busy: true } }));
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/modules/${ix}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: (regenState[ix] || {}).instruction || null }),
      });
      const data = await r.json();
      if (!r.ok) {
        const detail = data.errors?.length ? '\n\n' + data.errors.join('\n') : '';
        throw new Error((data.error || 'Single-module regen failed') + detail);
      }
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          client_facing_output: {
            ...((prev.offer || {}).client_facing_output || {}),
            modules: (() => {
              const m = ((prev.offer || {}).client_facing_output?.modules || []).slice();
              m[ix] = data.module;
              return m;
            })(),
          },
        },
      }) : prev);
      // Collapse the instruction input on success
      setRegenState(s => ({ ...s, [ix]: { busy: false, instruction: '', showInput: false } }));
    } catch (e) {
      setError(e.message || 'Regen failed');
      setRegenState(s => ({ ...s, [ix]: { ...(s[ix] || {}), busy: false } }));
    }
  };

  const lockAndContinue = async () => {
    if (!creator?.id || lockBusy) return;
    setLockBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/checkpoint/3/lock`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Lock failed');
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            checkpoint_progress: data.checkpoint_progress,
          },
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Lock failed');
    } finally {
      setLockBusy(false);
    }
  };

  const unlock = async () => {
    if (!creator?.id || lockBusy) return;
    if (!confirm('Unlock CP3? This will cascade-clear CP4 + CP5 if any have been generated.')) return;
    setLockBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/checkpoint/3/unlock`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Unlock failed');
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            checkpoint_progress: data.checkpoint_progress,
          },
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Unlock failed');
    } finally {
      setLockBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 28, padding: "18px 20px", background: "rgba(255,255,255,0.015)", border: `1px solid ${cp3Locked ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: cp3Locked ? "#22c55e" : "#7A0E18", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>
            ● Checkpoint 3 of 5 · {cp3Locked ? 'Locked ✓' : 'In Progress'}
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>Modules</h3>
          <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0" }}>
            4-8 curriculum modules. Each must cite ≥1 Phase 3 uniqueness element — the defensibility chain that proves the offer isn't generic.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!cp3Locked && !hasOutput && (
            <button
              onClick={generate}
              disabled={running || lockBusy}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(122,14,24,0.4)",
                background: running ? "rgba(255,255,255,0.02)" : "rgba(122,14,24,0.08)",
                color: running ? "#555" : "#B11E2F",
                fontSize: 11,
                fontWeight: 600,
                cursor: running ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {running ? "A gerar..." : "Generate (~$0.05-0.08)"}
            </button>
          )}
          {!cp3Locked && hasOutput && (
            <>
              <button
                onClick={generate}
                disabled={running || lockBusy}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid rgba(122,14,24,0.4)",
                  background: running ? "rgba(255,255,255,0.02)" : "rgba(122,14,24,0.08)",
                  color: running ? "#555" : "#B11E2F",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: running ? "wait" : "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                {running ? "..." : "↻ Re-run all"}
              </button>
              <button
                onClick={lockAndContinue}
                disabled={running || lockBusy}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid rgba(34,197,94,0.45)",
                  background: "rgba(34,197,94,0.08)",
                  color: "#22c55e",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: lockBusy ? "wait" : "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                {lockBusy ? "..." : "✓ Approve & continue →"}
              </button>
            </>
          )}
          {cp3Locked && (
            <button
              onClick={unlock}
              disabled={lockBusy}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(234,179,8,0.4)",
                background: "rgba(234,179,8,0.06)",
                color: "#eab308",
                fontSize: 11,
                fontWeight: 600,
                cursor: lockBusy ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {lockBusy ? "..." : "↺ Unlock"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 11, marginBottom: 12, whiteSpace: "pre-wrap" }}>{error}</div>
      )}
      {diag && !running && (
        <div style={{ fontSize: 10, color: "#444", marginBottom: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
          {diag.modules_returned} modules · {diag.usable_elements_input} elements available · {diag.retries} retries
          {Array.isArray(diag.warnings) && diag.warnings.length > 0 && (
            <div style={{ marginTop: 6, color: "#eab308" }}>⚠ {diag.warnings.join(' · ')}</div>
          )}
        </div>
      )}

      {!cp3Locked && hasOutput && (
        <RegenWithInstructionBlock
          placeholder="Ex: 'mais módulos de implementação ao vivo', 'foca em templates e SOPs', 'menos teoria, mais acção'..."
          busy={running}
          onRegen={(inst) => generate(inst)}
        />
      )}

      {!hasOutput && !running && (
        <div style={{ padding: "20px 16px", textAlign: "center", color: "#444", fontSize: 12, border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 6 }}>
          No modules yet. Click <strong style={{ color: "#888" }}>Generate</strong> (~20-40s, Sonnet only).
        </div>
      )}

      {hasOutput && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {modules.map((m, ix) => {
            const fmtColor = FORMAT_COLORS[m.format] || '#666';
            const linkedEls = (m.linked_unique_elements || []).map(i => uniqueElements[i]).filter(Boolean);
            const rState = regenState[ix] || {};
            return (
              <div
                key={ix}
                style={{
                  padding: "14px 16px",
                  background: "#0a0a0a",
                  borderRadius: 8,
                  border: `1px solid ${rState.busy ? 'rgba(122,14,24,0.5)' : 'rgba(255,255,255,0.05)'}`,
                  opacity: rState.busy ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#444", fontFamily: "'JetBrains Mono', ui-monospace, monospace", minWidth: 22 }}>#{ix + 1}</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 3,
                      background: `${fmtColor}15`,
                      color: fmtColor,
                      border: `1px solid ${fmtColor}40`,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {FORMAT_LABELS[m.format] || m.format}
                  </span>
                  <span style={{ fontSize: 10, color: "#666", letterSpacing: "0.02em", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                    {m.delivery_cadence}
                  </span>
                  {!cp3Locked && (
                    <button
                      onClick={() => setRegenState(s => ({ ...s, [ix]: { ...(s[ix] || {}), showInput: !rState.showInput } }))}
                      disabled={rState.busy}
                      style={{
                        marginLeft: "auto",
                        padding: "3px 10px",
                        borderRadius: 4,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: rState.showInput ? "rgba(122,14,24,0.1)" : "transparent",
                        color: rState.busy ? "#555" : "#888",
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: rState.busy ? "wait" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {rState.busy ? "..." : rState.showInput ? "Cancel" : "↻ Regen"}
                    </button>
                  )}
                </div>

                {/* Per-module regen input (collapses by default) */}
                {!cp3Locked && rState.showInput && (
                  <div style={{ marginBottom: 10, display: "flex", gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Optional: 'make this a live ritual', 'more technical', etc."
                      value={rState.instruction || ''}
                      onChange={(e) => setRegenState(s => ({ ...s, [ix]: { ...(s[ix] || {}), instruction: e.target.value } }))}
                      disabled={rState.busy}
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 4,
                        color: "#ddd",
                        fontSize: 11,
                        fontFamily: "inherit",
                      }}
                    />
                    <button
                      onClick={() => regenSingle(ix)}
                      disabled={rState.busy}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 4,
                        border: "1px solid rgba(122,14,24,0.45)",
                        background: rState.busy ? "rgba(255,255,255,0.02)" : "rgba(122,14,24,0.08)",
                        color: rState.busy ? "#555" : "#B11E2F",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: rState.busy ? "wait" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {rState.busy ? "..." : "Regen"}
                    </button>
                  </div>
                )}

                <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5", marginBottom: 6, lineHeight: 1.4 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: "#bbb", lineHeight: 1.55, marginBottom: 10 }}>{m.description}</div>
                <div style={{ padding: "8px 12px", background: "rgba(34,197,94,0.04)", borderRadius: 6, border: "1px solid rgba(34,197,94,0.18)", marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Delivers</div>
                  <div style={{ fontSize: 11.5, color: "#ddd", lineHeight: 1.5 }}>{m.transformation_delivered}</div>
                </div>

                {/* Linked uniqueness elements — the defensibility chain */}
                {linkedEls.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>
                      Grounded in {linkedEls.length} uniqueness element{linkedEls.length === 1 ? '' : 's'}
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                      {(m.linked_unique_elements || []).map((eix, j) => {
                        const el = uniqueElements[eix];
                        if (!el) return null;
                        return (
                          <li key={j} style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5, paddingLeft: 18, position: "relative" }}>
                            <span style={{ position: "absolute", left: 0, color: "#444", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700 }}>[{eix}]</span>
                            {el.element}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Weekly formats + Library — the operational face of the modules.
          Renders as two-column block under the modules list. These are what
          the pitch deck system slide consumes (slide 5). */}
      {hasOutput && (weeklyFormats.length > 0 || library.length > 0) && (
        <div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          {weeklyFormats.length > 0 && (
            <div style={{ padding: "14px 16px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Weekly Cadence · {weeklyFormats.length}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {weeklyFormats.map((w, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 10, alignItems: "start" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#B11E2F", fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "0.06em", paddingTop: 2 }}>{w.day}</div>
                    <div>
                      <div style={{ fontSize: 12, color: "#f5f5f5", fontWeight: 600, marginBottom: 2 }}>
                        {w.name}
                        <span style={{ color: "#666", fontWeight: 500, marginLeft: 6, fontSize: 10, letterSpacing: "0.04em" }}>· {w.type}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5 }}>{w.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {library.length > 0 && (
            <div style={{ padding: "14px 16px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Library · {library.length}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {library.map((l, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 12, color: "#f5f5f5", fontWeight: 600, marginBottom: 2 }}>
                      {l.name}
                      <span style={{ color: "#3b82f6", fontWeight: 500, marginLeft: 6, fontSize: 10, letterSpacing: "0.04em" }}>· {l.format}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5 }}>{l.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {runAt && hasOutput && (
        <div style={{ fontSize: 10, color: "#333", paddingTop: 12, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          Last batch run: {new Date(runAt).toLocaleString("pt-PT")}
          {cp3Locked && progress.locked[3] && (
            <> · Locked: {new Date(progress.locked[3]).toLocaleString("pt-PT")}</>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 4 · CP4 — Value Stack + Pricing Panel
// ──────────────────────────────────────────────────────────────────────────
// The Hormozi step. Renders four coordinated outputs:
//   1. Mechanism card (named acronym with per-letter breakdown)
//   2. Value stack table (items + total vs actualPrice + multiple)
//   3. Pricing tiers (1-3 tier cards)
//   4. Unlocked bonuses (month-by-month drops)
//
// The "Total Value" → "Today's Price" delta is the Hormozi flex — operator
// should be able to eyeball whether the multiple is honest (5-10×).
function ValueStackPanel({ creator, setCreator, running, setRunning, error, setError, diag, setDiag }) {
  const meta = creator?.offer?.internal_metadata || {};
  const client = creator?.offer?.client_facing_output || {};
  const progress = readCheckpointProgress(meta);
  const cp4Locked = !!progress.locked[4];
  const runAt = meta.generation_timestamps?.value_stack || null;
  const [lockBusy, setLockBusy] = useState(false);

  const mechanism = client.mechanism;
  const stack = client.value_stack;
  const tiers = Array.isArray(client.pricing_tiers) ? client.pricing_tiers : [];
  const bonuses = Array.isArray(client.unlocked_bonuses) ? client.unlocked_bonuses : [];
  const hasOutput = !!(mechanism && stack && tiers.length > 0 && bonuses.length > 0);

  const generate = async (instruction = null) => {
    // When bound directly as onClick={generate}, React passes the synthetic
    // event as the first arg. Coerce non-string values to null so the body
    // payload's JSON.stringify doesn't try to serialise a DOM event + its
    // React fiber (which is a circular structure).
    if (typeof instruction !== 'string') instruction = null;
    if (!creator?.id || running) return;
    setRunning(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/value-stack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(instruction ? { instruction } : {}),
      });
      const data = await r.json();
      if (!r.ok) {
        const detail = data.errors?.length ? '\n\n' + data.errors.join('\n') : '';
        throw new Error((data.error || 'Value stack failed') + detail);
      }
      setDiag(data._diagnostics || null);
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          client_facing_output: {
            ...((prev.offer || {}).client_facing_output || {}),
            mechanism: data.mechanism,
            value_stack: data.value_stack,
            pricing_tiers: data.pricing_tiers,
            unlocked_bonuses: data.unlocked_bonuses,
          },
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  const lockAndContinue = async () => {
    if (!creator?.id || lockBusy) return;
    setLockBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/checkpoint/4/lock`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Lock failed');
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            checkpoint_progress: data.checkpoint_progress,
          },
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Lock failed');
    } finally {
      setLockBusy(false);
    }
  };

  const unlock = async () => {
    if (!creator?.id || lockBusy) return;
    if (!confirm('Unlock CP4? This will cascade-clear CP5 if it has been generated.')) return;
    setLockBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/checkpoint/4/unlock`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Unlock failed');
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            checkpoint_progress: data.checkpoint_progress,
          },
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Unlock failed');
    } finally {
      setLockBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 28, padding: "18px 20px", background: "rgba(255,255,255,0.015)", border: `1px solid ${cp4Locked ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: cp4Locked ? "#22c55e" : "#7A0E18", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>
            ● Checkpoint 4 of 5 · {cp4Locked ? 'Locked ✓' : 'In Progress'}
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>Value Stack + Pricing</h3>
          <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0" }}>
            Hormozi step: mechanism + stack with $ values + pricing tiers + month-by-month bonuses. Total should be 5-10× the actual price.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!cp4Locked && (
            <button
              onClick={generate}
              disabled={running || lockBusy}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(122,14,24,0.4)",
                background: running ? "rgba(255,255,255,0.02)" : "rgba(122,14,24,0.08)",
                color: running ? "#555" : "#B11E2F",
                fontSize: 11,
                fontWeight: 600,
                cursor: running ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {running ? "A gerar..." : hasOutput ? "↻ Re-run" : "Generate (~$0.08-0.12)"}
            </button>
          )}
          {!cp4Locked && hasOutput && (
            <button
              onClick={lockAndContinue}
              disabled={running || lockBusy}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(34,197,94,0.45)",
                background: "rgba(34,197,94,0.08)",
                color: "#22c55e",
                fontSize: 11,
                fontWeight: 600,
                cursor: lockBusy ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {/* CP4 is now the last checkpoint in the pitch-the-creator flow.
                  CP5 (audience-facing sales copy) is disconnected — comes back
                  in the post-close launch-assets tool. */}
              {lockBusy ? "..." : "✓ Lock & finalise offer"}
            </button>
          )}
          {cp4Locked && (
            <button
              onClick={unlock}
              disabled={lockBusy}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(234,179,8,0.4)",
                background: "rgba(234,179,8,0.06)",
                color: "#eab308",
                fontSize: 11,
                fontWeight: 600,
                cursor: lockBusy ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {lockBusy ? "..." : "↺ Unlock"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 11, marginBottom: 12, whiteSpace: "pre-wrap" }}>{error}</div>
      )}
      {diag && !running && (
        <div style={{ fontSize: 10, color: "#444", marginBottom: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
          modules input: {diag.modules_input} · target_price input: {diag.target_price_input} · {diag.retries} retries
          {Array.isArray(diag.warnings) && diag.warnings.length > 0 && (
            <div style={{ marginTop: 6, color: "#eab308" }}>⚠ {diag.warnings.join(' · ')}</div>
          )}
        </div>
      )}

      {!cp4Locked && hasOutput && (
        <RegenWithInstructionBlock
          placeholder="Ex: 'value_stack mais conservador (~5× actualPrice)', 'mechanism com acrónimo mais curto', 'mais bonuses tipo template'..."
          busy={running}
          onRegen={(inst) => generate(inst)}
        />
      )}

      {!hasOutput && !running && (
        <div style={{ padding: "20px 16px", textAlign: "center", color: "#444", fontSize: 12, border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 6 }}>
          No value stack yet. Click <strong style={{ color: "#888" }}>Generate</strong> (~30-50s, Sonnet only). Largest checkpoint output.
        </div>
      )}

      {hasOutput && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* ── Mechanism */}
          {mechanism && (
            <div style={{ padding: "16px 18px", background: "rgba(122,14,24,0.04)", borderRadius: 8, border: "1px solid rgba(122,14,24,0.25)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.14em", textTransform: "uppercase" }}>Mechanism</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#f5f5f5", fontFamily: "'Instrument Serif', Georgia, serif", letterSpacing: "0.06em" }}>{mechanism.name}</div>
              </div>
              <p style={{ fontSize: 12, color: "#ccc", lineHeight: 1.55, margin: "0 0 12px", fontStyle: "italic" }}>{mechanism.description}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(mechanism.letters || []).map((l, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 12, alignItems: "baseline" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#B11E2F", fontFamily: "'JetBrains Mono', ui-monospace, monospace", textAlign: "center" }}>{l.letter}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5", marginBottom: 2 }}>{l.word}</div>
                      <div style={{ fontSize: 11, color: "#999", lineHeight: 1.5 }}>{l.explanation}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Value Stack */}
          {stack && (
            <div style={{ padding: "16px 18px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase" }}>Value Stack · {(stack.items || []).length} items</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                  <div>
                    <span style={{ fontSize: 9, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 6 }}>Total value:</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#22c55e", fontFamily: "'Instrument Serif', Georgia, serif" }}>{stack.total}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 9, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 6 }}>Today:</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#B11E2F", fontFamily: "'Instrument Serif', Georgia, serif" }}>{stack.actualPrice}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(stack.items || []).map((it, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 6, alignItems: "start" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#444", fontFamily: "'JetBrains Mono', ui-monospace, monospace", paddingTop: 2 }}>#{i + 1}</div>
                    <div>
                      <div style={{ fontSize: 12, color: "#f5f5f5", fontWeight: 600, marginBottom: 4 }}>{it.solution}</div>
                      <div style={{ fontSize: 10.5, color: "#777", lineHeight: 1.5, marginBottom: 4 }}>
                        <span style={{ color: "#555", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 6, fontSize: 9 }}>Pain:</span>
                        {it.problem}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#999", lineHeight: 1.5, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                        <span style={{ color: "#555", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 6, fontSize: 9, fontFamily: "inherit" }}>How:</span>
                        {it.delivery}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", fontFamily: "'Instrument Serif', Georgia, serif", whiteSpace: "nowrap" }}>{it.dollarValue}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Pricing Tiers */}
          {tiers.length > 0 && (
            <div style={{ padding: "16px 18px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>Pricing · {tiers.length} {tiers.length === 1 ? 'tier' : 'tiers'}</div>
              <div className="sl-grid" className="sl-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tiers.length, 3)}, 1fr)`, gap: 10 }}>
                {tiers.map((t, i) => (
                  <div key={i} style={{ padding: "14px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>{t.name}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#f5f5f5", fontFamily: "'Instrument Serif', Georgia, serif", marginBottom: 8 }}>{t.price}</div>
                    <div style={{ fontSize: 11, color: "#999", lineHeight: 1.5 }}>{t.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Unlocked Bonuses */}
          {bonuses.length > 0 && (
            <div style={{ padding: "16px 18px", background: "rgba(234,179,8,0.04)", borderRadius: 8, border: "1px solid rgba(234,179,8,0.2)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#eab308", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Unlocked Bonuses · {bonuses.length} drops</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {bonuses.map((b, i) => (
                  <li key={i} style={{ fontSize: 11.5, color: "#ddd", lineHeight: 1.5, paddingLeft: 18, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: "#eab308" }}>★</span>{b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {runAt && hasOutput && (
        <div style={{ fontSize: 10, color: "#333", paddingTop: 12, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          Last run: {new Date(runAt).toLocaleString("pt-PT")}
          {cp4Locked && progress.locked[4] && (
            <> · Locked: {new Date(progress.locked[4]).toLocaleString("pt-PT")}</>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Phase 4 · CP5 — Sales Copy Panel (final assembly)
// ──────────────────────────────────────────────────────────────────────────
// After CP5 locks, the offer is "complete" — pitch deck, launch-plan PDF
// and PPTX export should all render from client_facing_output exclusively.
//
// Renders five blocks:
//   - Differentiator section (the "Why this isn't another X" prose)
//   - Strategic context line (single italic header line)
//   - Hero card (headline + sub + CTA button)
//   - Objections list (4-6 expandable cards)
//   - FAQ list (8-12 items)
//   - Social proof line (only if fame_tier ≥ niche_recognized)
function SalesCopyPanel({ creator, setCreator, running, setRunning, error, setError, diag, setDiag }) {
  const meta = creator?.offer?.internal_metadata || {};
  const client = creator?.offer?.client_facing_output || {};
  const progress = readCheckpointProgress(meta);
  const cp5Locked = !!progress.locked[5];
  const runAt = meta.generation_timestamps?.sales_copy || null;
  const [lockBusy, setLockBusy] = useState(false);

  const hero = client.hero;
  const diff = client.differentiator_section;
  const ctx = client.strategic_context_line;
  const objections = Array.isArray(client.objections) ? client.objections : [];
  const faq = Array.isArray(client.faq) ? client.faq : [];
  const social = client.social_proof_line;
  const hasOutput = !!(diff && hero && objections.length > 0 && faq.length > 0);

  const generate = async (instruction = null) => {
    // When bound directly as onClick={generate}, React passes the synthetic
    // event as the first arg. Coerce non-string values to null so the body
    // payload's JSON.stringify doesn't try to serialise a DOM event + its
    // React fiber (which is a circular structure).
    if (typeof instruction !== 'string') instruction = null;
    if (!creator?.id || running) return;
    setRunning(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/sales-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(instruction ? { instruction } : {}),
      });
      const data = await r.json();
      if (!r.ok) {
        const detail = data.errors?.length ? '\n\n' + data.errors.join('\n') : '';
        throw new Error((data.error || 'Sales copy failed') + detail);
      }
      setDiag(data._diagnostics || null);
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          client_facing_output: {
            ...((prev.offer || {}).client_facing_output || {}),
            differentiator_section: data.differentiator_section,
            strategic_context_line: data.strategic_context_line,
            hero: data.hero,
            objections: data.objections,
            faq: data.faq,
            social_proof_line: data.social_proof_line,
          },
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  const lock = async () => {
    if (!creator?.id || lockBusy) return;
    setLockBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/checkpoint/5/lock`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Lock failed');
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            checkpoint_progress: data.checkpoint_progress,
          },
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Lock failed');
    } finally {
      setLockBusy(false);
    }
  };

  const unlock = async () => {
    if (!creator?.id || lockBusy) return;
    if (!confirm('Unlock CP5? The offer will be marked incomplete until you re-lock.')) return;
    setLockBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/creators/${creator.id}/wizard/checkpoint/5/unlock`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Unlock failed');
      setCreator(prev => prev ? ({
        ...prev,
        offer: {
          ...(prev.offer || {}),
          internal_metadata: {
            ...((prev.offer || {}).internal_metadata || {}),
            checkpoint_progress: data.checkpoint_progress,
          },
        },
      }) : prev);
    } catch (e) {
      setError(e.message || 'Unlock failed');
    } finally {
      setLockBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 28, padding: "18px 20px", background: "rgba(255,255,255,0.015)", border: `1px solid ${cp5Locked ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: cp5Locked ? "#22c55e" : "#7A0E18", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>
            ● Checkpoint 5 of 5 · {cp5Locked ? 'Locked ✓ · Offer Complete' : 'In Progress'}
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>Sales Copy · Final Assembly</h3>
          <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0" }}>
            Differentiator, hero, objections, FAQ, social proof. After this locks, the pitch deck + launch-plan PDF render from client_facing_output.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!cp5Locked && (
            <button
              onClick={generate}
              disabled={running || lockBusy}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(122,14,24,0.4)",
                background: running ? "rgba(255,255,255,0.02)" : "rgba(122,14,24,0.08)",
                color: running ? "#555" : "#B11E2F",
                fontSize: 11,
                fontWeight: 600,
                cursor: running ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {running ? "A gerar..." : hasOutput ? "↻ Re-run" : "Generate (~$0.10-0.15)"}
            </button>
          )}
          {!cp5Locked && hasOutput && (
            <button
              onClick={lock}
              disabled={running || lockBusy}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(34,197,94,0.45)",
                background: "rgba(34,197,94,0.08)",
                color: "#22c55e",
                fontSize: 11,
                fontWeight: 600,
                cursor: lockBusy ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {lockBusy ? "..." : "✓ Lock & finalise offer"}
            </button>
          )}
          {cp5Locked && (
            <button
              onClick={unlock}
              disabled={lockBusy}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid rgba(234,179,8,0.4)",
                background: "rgba(234,179,8,0.06)",
                color: "#eab308",
                fontSize: 11,
                fontWeight: 600,
                cursor: lockBusy ? "wait" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {lockBusy ? "..." : "↺ Unlock"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 11, marginBottom: 12, whiteSpace: "pre-wrap" }}>{error}</div>
      )}
      {diag && !running && (
        <div style={{ fontSize: 10, color: "#444", marginBottom: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
          fame tier: {diag.fame_tier || '—'} · objections: {diag.objections_returned} · faq: {diag.faq_returned} · {diag.retries} retries
          {Array.isArray(diag.warnings) && diag.warnings.length > 0 && (
            <div style={{ marginTop: 6, color: "#eab308" }}>⚠ {diag.warnings.join(' · ')}</div>
          )}
        </div>
      )}

      {!cp5Locked && hasOutput && (
        <RegenWithInstructionBlock
          placeholder="Ex: 'hero mais directo', 'mais 2 objecções sobre tempo', 'FAQ menos formal', 'differentiator com mais prova'..."
          busy={running}
          onRegen={(inst) => generate(inst)}
        />
      )}

      {!hasOutput && !running && (
        <div style={{ padding: "20px 16px", textAlign: "center", color: "#444", fontSize: 12, border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 6 }}>
          No sales copy yet. Click <strong style={{ color: "#888" }}>Generate</strong> (~30-60s, Sonnet only, reads every previous CP).
        </div>
      )}

      {hasOutput && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* ── Hero card */}
          {hero && (
            <div style={{ padding: "18px 20px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(122,14,24,0.25)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Hero</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 10px", color: "#f5f5f5", fontFamily: "'Instrument Serif', Georgia, serif", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{hero.headline}</h2>
              <p style={{ fontSize: 13, color: "#bbb", margin: "0 0 14px", lineHeight: 1.55 }}>{hero.sub}</p>
              <button
                disabled
                style={{
                  padding: "9px 22px",
                  borderRadius: 6,
                  border: "1px solid rgba(122,14,24,0.45)",
                  background: "rgba(122,14,24,0.18)",
                  color: "#B11E2F",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "default",
                  fontFamily: "inherit",
                  letterSpacing: "0.04em",
                }}
              >
                {hero.cta}
              </button>
            </div>
          )}

          {/* ── Strategic context line */}
          {ctx && (
            <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Strategic Context</div>
              <p style={{ fontSize: 12, color: "#ccc", margin: 0, fontStyle: "italic", lineHeight: 1.55 }}>{ctx}</p>
            </div>
          )}

          {/* ── Differentiator section */}
          {diff && (
            <div style={{ padding: "16px 18px", background: "rgba(122,14,24,0.04)", borderRadius: 8, border: "1px solid rgba(122,14,24,0.22)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Differentiator · Why This Isn't Another X</div>
              <p style={{ fontSize: 13, color: "#ddd", margin: 0, lineHeight: 1.7, whiteSpace: "pre-line" }}>{diff}</p>
            </div>
          )}

          {/* ── Social proof line (only if present) */}
          {social && (
            <div style={{ padding: "12px 14px", background: "rgba(59,130,246,0.05)", borderRadius: 6, border: "1px solid rgba(59,130,246,0.2)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#3b82f6", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Social Proof</div>
              <p style={{ fontSize: 12, color: "#ccc", margin: 0, lineHeight: 1.55 }}>{social}</p>
            </div>
          )}

          {/* ── Objections */}
          {objections.length > 0 && (
            <div style={{ padding: "16px 18px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>Objections · {objections.length}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {objections.map((o, i) => (
                  <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 6, lineHeight: 1.5, fontWeight: 600 }}>
                      <span style={{ color: "#666", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 8, fontSize: 9 }}>Objection:</span>
                      {o.objection}
                    </div>
                    <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.55 }}>
                      <span style={{ color: "#22c55e", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 8, fontSize: 9 }}>Rebuttal:</span>
                      {o.rebuttal}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── FAQ */}
          {faq.length > 0 && (
            <div style={{ padding: "16px 18px", background: "#0a0a0a", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>FAQ · {faq.length}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {faq.map((f, i) => (
                  <div key={i} style={{ paddingBottom: 10, borderBottom: i === faq.length - 1 ? "none" : "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 12.5, color: "#f5f5f5", fontWeight: 600, marginBottom: 5, lineHeight: 1.45 }}>{f.q}</div>
                    <div style={{ fontSize: 11.5, color: "#999", lineHeight: 1.6 }}>{f.a}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {runAt && hasOutput && (
        <div style={{ fontSize: 10, color: "#333", paddingTop: 12, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          Last run: {new Date(runAt).toLocaleString("pt-PT")}
          {cp5Locked && progress.locked[5] && (
            <> · Locked: {new Date(progress.locked[5]).toLocaleString("pt-PT")}</>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// OfferSummaryCard — structured replacement for the old Grand Slam Offer
// markdown view.
// ──────────────────────────────────────────────────────────────────────────
// Reads client_facing_output (via readOfferState which derives a CFO on the
// fly from legacy parsed for back-compat). Renders a scannable summary so
// the operator can review the whole offer without scrolling through 4
// expanded wizard panels.
//
// Sections (each renders only when its data is present):
//   - Header              : community name + platform + price card
//   - Big Idea            : central_promise
//   - Transformation      : from → to + timeframe
//   - Mechanism           : named acronym + 1-line description
//   - Counts row          : modules / weekly_formats / library counts
//   - Value stack snapshot : item count + total vs actualPrice (multiple)
//   - Pricing tiers       : 1-3 tier cards
//
// If everything's empty (creator.offer exists but no wizard run yet, e.g.
// freshly migrated legacy), surfaces a "Run the wizard" hint.
function OfferSummaryCard({ creator }) {
  const { client_facing_output: c } = readOfferState(creator);

  const hasAnyContent = !!(
    c.community_name ||
    c.central_promise ||
    (c.modules && c.modules.length > 0) ||
    c.value_stack ||
    c.mechanism
  );

  if (!hasAnyContent) {
    return (
      <div style={{ padding: 20, background: "#141414", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 10, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
          No structured offer data yet. Run the wizard checkpoints above to populate this view.
        </p>
      </div>
    );
  }

  // Compute the value-stack multiple if both numbers parse cleanly.
  const multipleLine = (() => {
    if (!c.value_stack?.total || !c.value_stack?.actualPrice) return null;
    const num = (s) => {
      const m = String(s || '').match(/[\d.,]+/);
      if (!m) return null;
      const n = parseFloat(m[0].replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    };
    const t = num(c.value_stack.total);
    const a = num(c.value_stack.actualPrice);
    if (!t || !a || a <= 0) return null;
    return (t / a).toFixed(1);
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header — community name + platform + price */}
      <div style={{ padding: "16px 18px", background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>Community</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f5f5f5", fontFamily: "'Instrument Serif', Georgia, serif", letterSpacing: "-0.01em", marginBottom: 4 }}>
            {c.community_name || <span style={{ color: "#444", fontStyle: "italic" }}>(no name yet)</span>}
          </div>
          {c.platform && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", padding: "2px 8px", borderRadius: 3, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", letterSpacing: "0.06em" }}>{c.platform}</span>
          )}
        </div>
        {c.target_price && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>Price</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#B11E2F", fontFamily: "'Instrument Serif', Georgia, serif", letterSpacing: "-0.01em" }}>{c.target_price}</div>
            {(c.pricing_tier || c.pricing_model) && (
              <div style={{ fontSize: 10, color: "#666", marginTop: 3, letterSpacing: "0.04em" }}>
                {c.pricing_tier ? c.pricing_tier.toUpperCase() : ''}
                {c.pricing_tier && c.pricing_model ? ' · ' : ''}
                {c.pricing_model ? c.pricing_model.replace('_', ' ').toUpperCase() : ''}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Big Idea */}
      {c.central_promise && (
        <div style={{ padding: "13px 16px", background: "rgba(122,14,24,0.04)", border: "1px solid rgba(122,14,24,0.18)", borderRadius: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Big Idea</div>
          <p style={{ fontSize: 13, color: "#ddd", lineHeight: 1.55, margin: 0, fontWeight: 500 }}>{c.central_promise}</p>
        </div>
      )}

      {/* Transformation */}
      {c.transformation && (c.transformation.from || c.transformation.to) && (
        <div style={{ padding: "13px 16px", background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Transformation</div>
          <div className="sl-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>From</div>
              <div style={{ fontSize: 11.5, color: "#ccc", lineHeight: 1.45 }}>{c.transformation.from || '—'}</div>
            </div>
            <div style={{ fontSize: 16, color: "#666", fontWeight: 700 }}>→</div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>To</div>
              <div style={{ fontSize: 11.5, color: "#ccc", lineHeight: 1.45 }}>{c.transformation.to || '—'}</div>
            </div>
          </div>
          {c.transformation.timeframe && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "#888" }}>
              <span style={{ color: "#555", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9, marginRight: 6 }}>Timeframe:</span>
              {c.transformation.timeframe}
            </div>
          )}
        </div>
      )}

      {/* Mechanism */}
      {c.mechanism && c.mechanism.name && (
        <div style={{ padding: "13px 16px", background: "#141414", border: "1px solid rgba(122,14,24,0.18)", borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.14em", textTransform: "uppercase" }}>Mechanism</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#f5f5f5", fontFamily: "'Instrument Serif', Georgia, serif", letterSpacing: "0.04em" }}>{c.mechanism.name}</div>
          </div>
          {c.mechanism.description && (
            <p style={{ fontSize: 11.5, color: "#aaa", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>{c.mechanism.description}</p>
          )}
        </div>
      )}

      {/* Counts row — quick stats for modules / weekly_formats / library */}
      {(Array.isArray(c.modules) && c.modules.length > 0) ||
        (Array.isArray(c.weekly_formats) && c.weekly_formats.length > 0) ||
        (Array.isArray(c.library) && c.library.length > 0) ? (
        <div style={{ padding: "12px 16px", background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, display: "flex", gap: 24, flexWrap: "wrap" }}>
          {Array.isArray(c.modules) && c.modules.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 2 }}>Modules</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5" }}>{c.modules.length}</div>
            </div>
          )}
          {Array.isArray(c.weekly_formats) && c.weekly_formats.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 2 }}>Weekly Formats</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5" }}>{c.weekly_formats.length}</div>
            </div>
          )}
          {Array.isArray(c.library) && c.library.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 2 }}>Library</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5" }}>{c.library.length}</div>
            </div>
          )}
          {Array.isArray(c.unlocked_bonuses) && c.unlocked_bonuses.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 2 }}>Bonuses</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5" }}>{c.unlocked_bonuses.length}</div>
            </div>
          )}
        </div>
      ) : null}

      {/* Value stack snapshot */}
      {c.value_stack && c.value_stack.total && (
        <div style={{ padding: "13px 16px", background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Value Stack</div>
            <div style={{ fontSize: 11.5, color: "#888" }}>
              {(c.value_stack.items || []).length} items {multipleLine && <span style={{ color: multipleLine >= 5 ? "#22c55e" : "#eab308", fontWeight: 700, marginLeft: 6 }}>· {multipleLine}× value</span>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <div>
              <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 6 }}>Total value</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#22c55e", fontFamily: "'Instrument Serif', Georgia, serif" }}>{c.value_stack.total}</div>
            </div>
            <div style={{ color: "#444", fontSize: 14 }}>vs</div>
            <div>
              <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 6 }}>Today</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#B11E2F", fontFamily: "'Instrument Serif', Georgia, serif" }}>{c.value_stack.actualPrice}</div>
            </div>
          </div>
        </div>
      )}

      {/* Pricing tiers */}
      {Array.isArray(c.pricing_tiers) && c.pricing_tiers.length > 0 && (
        <div style={{ padding: "13px 16px", background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Pricing Tiers · {c.pricing_tiers.length}</div>
          <div className="sl-grid" className="sl-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(c.pricing_tiers.length, 3)}, 1fr)`, gap: 8 }}>
            {c.pricing_tiers.map((t, i) => (
              <div key={i} style={{ padding: "11px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#B11E2F", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>{t.name}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f5", fontFamily: "'Instrument Serif', Georgia, serif", marginBottom: 4 }}>{t.price}</div>
                <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.45 }}>{t.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
