"use client";
import { useState, useRef } from "react";

const LOGO_B64 = "data:image/png;base64,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";

const SYSTEM_PROMPT = `# OFFER BUILDER SYSTEM v2.0 (HORMOZI EDITION) - Second Layer HQ

## ROLE
You are a senior business strategist and offer architect trained in Alex Hormozi's frameworks from $100M Offers, $100M Leads, and $100M Money Models. You build Grand Slam Offers for content creators' audiences, identify blind spots, and prepare objection-handling scripts for Second Layer's sales team.

Second Layer is an agency that builds and operates the entire backend for creators (course platform, community, fulfillment, marketing assets, sales pages). The creator brings the audience. Second Layer earns 20-30% commission plus a one-time setup fee.

## SOCIAL MEDIA INTELLIGENCE
When social media profile data is provided, use it to estimate audience quality, content themes, monetization readiness, unique positioning, right price point, and which Core Four channels to prioritize. If URLs are provided without scraped data, make inferences and flag them.

## CORE FRAMEWORKS

### VALUE EQUATION ($100M Offers)
Value = (Dream Outcome x Perceived Likelihood) / (Time Delay x Effort & Sacrifice)
Score and optimize each variable explicitly.

### GRAND SLAM OFFER ($100M Offers)
1. Identify Dream Outcome 2. List All Problems (before/during/after purchase) 3. Solutions as Value (Problem > Solution > Sexy Name > Delivery Vehicle) 4. Trim & Stack (10x+ value-to-price ratio) 5. Enhance with Scarcity, Urgency, Bonuses, Guarantees

### MONEY MODEL ($100M Money Models)
Stage I: Get Cash (Attraction Offer - fund acquisition from day one)
Stage II: Get More Cash (Upsell & Downsell - maximize 30-day revenue)
Stage III: Get The Most Cash (Continuity - recurring revenue, maximize LTV)
Map the full sequence for every offer.

### LEAD GENERATION ($100M Leads)
Core Four: 1. Warm Outreach 2. Free Content 3. Cold Outreach 4. Paid Ads
Include Lead Magnet using "salty pretzel" strategy. Apply Rule of 100.

### MARKET SELECTION ($100M Offers)
Score: Massive Pain, Purchasing Power, Easy to Target, Growing Market.
Hierarchy: Starving Crowd > Offer Strength > Persuasion Skills.

## OUTPUT INSTRUCTIONS
Generate ALL THREE outputs. Use markdown.

### OUTPUT 1: THE GRAND SLAM OFFER
A. Market Evaluation (4 criteria, 1-10 each)
B. Core Promise (transformation sentence)
C. Value Equation Score (4 variables, 1-10 with explanations)
D. Unique Mechanism (branded name + explanation)
E. Problem-Solution Value Stack (Hormozi table format with perceived values, min 5-7 items, total 10x+ price)
F. Guarantee (matched to price/trust)
G. Pricing Strategy (value-based + anchoring + model)
H. Money Model Map (Attraction > Core > Upsell > Downsell > Continuity)
I. Lead Generation Plan (Core Four prioritized + Lead Magnet design)
J. Naming & Positioning (3 options + statement)

### OUTPUT 2: BLIND SPOT AUDIT
15 categories with GREEN/YELLOW/RED: Market Fit, Value Equation Balance, Pricing Disconnect, Money Model Gaps, Lead Magnet Quality, Fulfillment Bottleneck, Creator Dependency, Audience Mismatch, Competitive Exposure, Trust Gap, Guarantee Risk, Sales Channel Fit, Retention Risk, Legal/Compliance, Scalability Ceiling.

### OUTPUT 3: OBJECTION HANDLING PLAYBOOK
12 mandatory + 3-5 dynamic niche-specific. Use ACA Framework. Each: Objection | Psychology | Reframe | Proof Point | Closing Question.

## BENCHMARKS (EUR, flag when used)
Email conversion: 1-10% | Followers to opt-in: 1-15% | Webinar to purchase: 5-40% | DM close: 10-50% | Community churn: 3-20%/mo | Course completion: 5-60% | Refund rate: 1-10%
Pricing: Mini-course 27-497 | Course 197-2997 | Coaching 497-9997 | Community 9-297/mo | 1:1 997-25000+

## RULES
1. Reference the specific creator/niche. Nothing generic. 2. Name Hormozi frameworks explicitly. 3. Flag assumptions. 4. Conservative estimates. 5. Push back on weak markets. 6. Direct professional tone, zero filler. 7. Same structure every run.`;

const INTAKE_FIELDS = [
  { section: "Creator Profile", icon: "01", fields: [
    { key: "creator_name", label: "Creator Name", placeholder: "e.g. Rita Camoesas", type: "text" },
    { key: "niche", label: "Creator's Niche", placeholder: "e.g. Home workouts for busy moms, Street photography for beginners", type: "text" },
    { key: "platforms", label: "Platforms & Audience Size", placeholder: "e.g. Instagram 85K, YouTube 12K, TikTok 200K", type: "text" },
    { key: "engagement", label: "Engagement Rate / Avg Views", placeholder: "e.g. 4.2% IG engagement, 8K avg views on YouTube", type: "text" },
  ]},
  { section: "Social Profiles", icon: "02", fields: [
    { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/username", type: "text" },
    { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@username", type: "text" },
    { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@channelname", type: "text" },
  ]},
  { section: "Audience Analysis", icon: "03", fields: [
    { key: "audience_demo", label: "Core Audience Demographics", placeholder: "e.g. Women 25-35, US/UK, middle income", type: "text" },
    { key: "audience_problem", label: "Main Problem / Desire", placeholder: "What does this audience want that the creator solves for free?", type: "textarea" },
    { key: "past_sales", label: "Previous Sales History", placeholder: "e.g. Sold a 47 EUR ebook, 200 units. Or: Never sold anything.", type: "text" },
  ]},
  { section: "Business Parameters", icon: "04", fields: [
    { key: "format", label: "Delivery Format", placeholder: "Skool community, Course, Membership, Hybrid, or Undecided", type: "text" },
    { key: "price_range", label: "Target Price Range", placeholder: "e.g. 97-197 EUR, or 'let the system decide'", type: "text" },
    { key: "creator_capacity", label: "Creator Involvement", placeholder: "e.g. 2 hours/week, weekly live call, fully hands-off", type: "text" },
    { key: "credibility", label: "Unique Credibility Factor", placeholder: "Credentials, results, story, unique method", type: "textarea" },
  ]},
  { section: "Team Notes", icon: "05", fields: [
    { key: "guidelines", label: "Additional Context", placeholder: "Constraints, preferences, or notes from the team", type: "textarea" },
  ]},
];

function FieldInput({ field, value, onChange }) {
  const s = {
    width: "100%", padding: "11px 14px",
    background: "#080604", border: "1px solid #1e1b17", borderRadius: 5,
    color: "#E2E4DF", fontSize: 13, fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
    outline: "none", boxSizing: "border-box", resize: "vertical", letterSpacing: "0.01em",
    transition: "border-color 0.15s",
  };
  const focus = (e) => { e.target.style.borderColor = "#7A0E18"; };
  const blur = (e) => { e.target.style.borderColor = "#1e1b17"; };

  if (field.type === "textarea") return <textarea style={{ ...s, minHeight: 72 }} placeholder={field.placeholder} value={value} onChange={e => onChange(field.key, e.target.value)} onFocus={focus} onBlur={blur} />;
  return <input type="text" style={s} placeholder={field.placeholder} value={value} onChange={e => onChange(field.key, e.target.value)} onFocus={focus} onBlur={blur} />;
}

function Badge({ status }) {
  const c = { GREEN: "#22c55e", YELLOW: "#eab308", RED: "#dc2626" }[status] || "#eab308";
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", background: c + "14", color: c, border: "1px solid " + c + "33", textTransform: "uppercase" }}>{status}</span>;
}

function parseOutput(text) {
  const s = { offer: "", blindspots: "", objections: "" };
  const a = text.match(/#{1,3}\s*OUTPUT 1[:\s\-]*(?:THE )?(?:GRAND SLAM )?OFFER([\s\S]*?)(?=#{1,3}\s*OUTPUT 2|$)/i);
  const b = text.match(/#{1,3}\s*OUTPUT 2[:\s\-]*BLIND SPOT AUDIT([\s\S]*?)(?=#{1,3}\s*OUTPUT 3|$)/i);
  const c = text.match(/#{1,3}\s*OUTPUT 3[:\s\-]*OBJECTION HANDLING([\s\S]*?)$/i);
  if (a) s.offer = a[1].trim();
  if (b) s.blindspots = b[1].trim();
  if (c) s.objections = c[1].trim();
  if (!s.offer && !s.blindspots && !s.objections) s.offer = text;
  return s;
}

function renderInline(t) {
  if (typeof t !== "string") return t;
  const p = []; let r = t, k = 0;
  while (r.length > 0) {
    const m = r.match(/\*\*(.+?)\*\*/);
    if (m) { if (m.index > 0) p.push(<span key={k++}>{r.slice(0, m.index)}</span>); p.push(<strong key={k++} style={{ color: "#E2E4DF", fontWeight: 600 }}>{m[1]}</strong>); r = r.slice(m.index + m[0].length); }
    else { p.push(<span key={k++}>{r}</span>); break; }
  }
  return p;
}

function renderMd(md) {
  if (!md) return null;
  const lines = md.split("\n"), el = [];
  let tRows = [], inT = false, tK = 0;
  const flushT = () => {
    if (tRows.length > 0) {
      const h = tRows[0], d = tRows.slice(1);
      el.push(<div key={"t" + tK++} style={{ overflowX: "auto", margin: "14px 0", borderRadius: 4, border: "1px solid #1e1b17" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "#7A0E1808" }}>{h.map((c, i) => <th key={i} style={{ padding: "9px 12px", textAlign: "left", borderBottom: "1px solid #1e1b17", color: "#6b6860", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>{c}</th>)}</tr></thead>
          <tbody>{d.map((row, ri) => <tr key={ri} style={{ borderBottom: "1px solid #0f0d0a" }}>{row.map((cell, ci) => {
            const st = /\b(GREEN|YELLOW|RED)\b/.test(cell);
            return <td key={ci} style={{ padding: "9px 12px", color: "#c5c3be", verticalAlign: "top", fontSize: 12 }}>{st ? <><Badge status={cell.match(/\b(GREEN|YELLOW|RED)\b/)[1]} /> {cell.replace(/\b(GREEN|YELLOW|RED)\b/, "").trim()}</> : renderInline(cell)}</td>;
          })}</tr>)}</tbody>
        </table></div>);
      tRows = [];
    }
    inT = false;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim().startsWith("|") && l.trim().endsWith("|")) {
      const cells = l.split("|").slice(1, -1).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) continue;
      tRows.push(cells); inT = true; continue;
    }
    if (inT) flushT();
    if (/^####\s/.test(l)) el.push(<h4 key={i} style={{ fontSize: 13, fontWeight: 700, color: "#E2E4DF", margin: "16px 0 5px" }}>{renderInline(l.replace(/^####\s*/, ""))}</h4>);
    else if (/^###\s/.test(l)) el.push(<h3 key={i} style={{ fontSize: 14, fontWeight: 700, color: "#7A0E18", margin: "22px 0 7px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{renderInline(l.replace(/^###\s*/, ""))}</h3>);
    else if (/^##\s/.test(l)) el.push(<h2 key={i} style={{ fontSize: 16, fontWeight: 700, color: "#E2E4DF", margin: "26px 0 9px" }}>{renderInline(l.replace(/^##\s*/, ""))}</h2>);
    else if (/^---+$/.test(l.trim())) el.push(<hr key={i} style={{ border: "none", borderTop: "1px solid #1e1b17", margin: "18px 0" }} />);
    else if (/^\d+\.\s/.test(l)) {
      const c = l.replace(/^\d+\.\s*/, ""), sm = c.match(/^\*\*(GREEN|YELLOW|RED)\*\*/);
      el.push(<div key={i} style={{ padding: "7px 0 7px 12px", borderLeft: "2px solid #1e1b17", marginLeft: 4, marginBottom: 2 }}>{sm && <><Badge status={sm[1]} />{" "}</>}<span style={{ color: "#c5c3be", fontSize: 13, lineHeight: 1.6 }}>{renderInline(sm ? c.replace(/^\*\*(GREEN|YELLOW|RED)\*\*\s*[-:]?\s*/, "") : c)}</span></div>);
    }
    else if (/^[-*]\s/.test(l.trim())) el.push(<div key={i} style={{ padding: "2px 0 2px 16px", color: "#c5c3be", fontSize: 13 }}><span style={{ color: "#7A0E18", marginRight: 8, fontSize: 7 }}>&#9632;</span>{renderInline(l.trim().replace(/^[-*]\s*/, ""))}</div>);
    else if (l.trim() === "") el.push(<div key={i} style={{ height: 5 }} />);
    else el.push(<p key={i} style={{ margin: "3px 0", color: "#9a9890", fontSize: 13, lineHeight: 1.65 }}>{renderInline(l)}</p>);
  }
  if (inT) flushT();
  return el;
}

const TABS = [
  { key: "offer", label: "Grand Slam Offer" },
  { key: "blindspots", label: "Blind Spot Audit" },
  { key: "objections", label: "Objection Playbook" },
  { key: "revenue", label: "Revenue Projector" },
];

function extractAudience(platforms) {
  if (!platforms) return 0;
  const nums = platforms.match(/(\d+(?:[.,]\d+)?)\s*[kKmM]?/g) || [];
  let total = 0;
  nums.forEach(n => {
    let v = parseFloat(n.replace(",", "."));
    if (/k/i.test(n)) v *= 1000;
    if (/m/i.test(n)) v *= 1000000;
    total += v;
  });
  return Math.round(total);
}

const REVENUE_PROMPT = `You are a revenue analyst for Second Layer, an agency that builds monetization backends for content creators.

Given the creator's profile, audience data, niche, and revenue projection inputs, provide a sharp analysis in markdown:

## Niche Benchmarks
Compare their niche to typical conversion rates. Be specific — cite the niche, not generic stats.

## Risk Factors
3-5 specific risks that could reduce projected revenue (audience mismatch, price sensitivity, seasonality, etc.)

## Upside Opportunities
3-5 specific opportunities to exceed projections (viral potential, underserved niche, high pain point, etc.)

## Pricing Recommendation
Based on the niche and audience, recommend optimal price point with reasoning. Reference Hormozi's value equation.

## Comparison
Compare to similar creators who have monetized in this niche. What did they charge? What worked?

Be direct, specific to this creator, and use conservative estimates. No filler.`;

function SliderInput({ label, value, onChange, min, max, step, suffix, prefix }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#4a4840", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#E2E4DF" }}>{prefix || ""}{typeof value === "number" ? value.toLocaleString() : value}{suffix || ""}</span>
      </div>
      <input type="range" min={min} max={max} step={step || 1} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", height: 4, appearance: "none", background: "#1e1b17", borderRadius: 2, outline: "none", cursor: "pointer", accentColor: "#7A0E18" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#2a2720", marginTop: 3 }}>
        <span>{prefix || ""}{min.toLocaleString()}{suffix || ""}</span>
        <span>{prefix || ""}{max.toLocaleString()}{suffix || ""}</span>
      </div>
    </div>
  );
}

function ScenarioCard({ title, color, data }) {
  return (
    <div style={{ flex: 1, padding: "18px 16px", borderRadius: 4, background: "#080604", border: `1px solid ${color}22` }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color, marginBottom: 14 }}>{title}</div>
      {data.map((row, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < data.length - 1 ? "1px solid #0f0d0a" : "none" }}>
          <span style={{ fontSize: 11, color: "#6b6860" }}>{row.label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: row.highlight ? color : "#E2E4DF" }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function RevenueProjector({ form, scraped, systemPrompt }) {
  const [audience, setAudience] = useState(() => extractAudience(form.platforms) || 50000);
  const [optIn, setOptIn] = useState(5);
  const [conversion, setConversion] = useState(5);
  const [price, setPrice] = useState(197);
  const [churn, setChurn] = useState(8);
  const [upsellRate, setUpsellRate] = useState(10);
  const [upsellPrice, setUpsellPrice] = useState(497);
  const [commission, setCommission] = useState(25);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const calc = (optMult) => {
    const leads = Math.round(audience * (optIn / 100) * optMult);
    const customers = Math.round(leads * (conversion / 100) * optMult);
    const launchRev = customers * price;
    const upsellCustomers = Math.round(customers * (upsellRate / 100));
    const upsellRev = upsellCustomers * upsellPrice;
    const month1 = launchRev + upsellRev;
    const monthlyRecurring = Math.round(customers * (1 - churn / 100) * (price < 100 ? price : price * 0.15));
    const year1 = month1 + (monthlyRecurring * 11);
    const slCommission = Math.round(year1 * (commission / 100));
    const ltv = churn > 0 ? Math.round(price / (churn / 100)) : price * 12;
    return { leads, customers, month1, monthlyRecurring, year1, slCommission, ltv };
  };

  const conservative = calc(0.6);
  const moderate = calc(1.0);
  const aggressive = calc(1.5);

  const fmt = (n) => "\u20AC" + n.toLocaleString();

  const rows = (d) => [
    { label: "Leads (opt-ins)", value: d.leads.toLocaleString() },
    { label: "Customers", value: d.customers.toLocaleString() },
    { label: "Launch month", value: fmt(d.month1), highlight: true },
    { label: "Monthly recurring", value: fmt(d.monthlyRecurring) },
    { label: "Year 1 total", value: fmt(d.year1), highlight: true },
    { label: "SL commission", value: fmt(d.slCommission), highlight: true },
    { label: "LTV / customer", value: fmt(d.ltv) },
  ];

  const runAi = async () => {
    setAiLoading(true);
    try {
      const msg = `Creator: ${form.creator_name || "Unknown"}\nNiche: ${form.niche || "Unknown"}\nPlatforms: ${form.platforms || "Unknown"}\nAudience: ${audience.toLocaleString()}\nOpt-in rate: ${optIn}%\nConversion rate: ${conversion}%\nPrice: ${price} EUR\nChurn: ${churn}%/mo\nUpsell rate: ${upsellRate}% at ${upsellPrice} EUR\n\nProjections:\n- Conservative Y1: ${fmt(conservative.year1)}\n- Moderate Y1: ${fmt(moderate.year1)}\n- Aggressive Y1: ${fmt(aggressive.year1)}\n\n${scraped && Object.keys(scraped).length ? "Scraped intelligence:\n" + Object.entries(scraped).map(([p, d]) => `${p}: ${d}`).join("\n\n") : ""}\n\nAnalyze these projections for this specific creator and niche.`;
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: REVENUE_PROMPT, message: msg }),
      });
      if (!r.ok) throw new Error("API error");
      const d = await r.json();
      const text = d.content?.map(c => c.text || "").join("\n") || "";
      setAiAnalysis(text);
    } catch (e) { setAiAnalysis("Error: " + e.message); }
    finally { setAiLoading(false); }
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        <div>
          <SliderInput label="Total Audience" value={audience} onChange={setAudience} min={1000} max={1000000} step={1000} />
          <SliderInput label="Opt-in Rate" value={optIn} onChange={setOptIn} min={1} max={15} step={0.5} suffix="%" />
          <SliderInput label="Conversion Rate" value={conversion} onChange={setConversion} min={1} max={40} step={0.5} suffix="%" />
          <SliderInput label="Core Price" value={price} onChange={setPrice} min={27} max={2997} step={10} prefix={"\u20AC"} />
        </div>
        <div>
          <SliderInput label="Monthly Churn" value={churn} onChange={setChurn} min={1} max={25} step={0.5} suffix="%" />
          <SliderInput label="Upsell Rate" value={upsellRate} onChange={setUpsellRate} min={0} max={30} step={1} suffix="%" />
          <SliderInput label="Upsell Price" value={upsellPrice} onChange={setUpsellPrice} min={97} max={9997} step={50} prefix={"\u20AC"} />
          <SliderInput label="SL Commission" value={commission} onChange={setCommission} min={15} max={35} step={1} suffix="%" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        <ScenarioCard title="Conservative" color="#6b6860" data={rows(conservative)} />
        <ScenarioCard title="Moderate" color="#E2E4DF" data={rows(moderate)} />
        <ScenarioCard title="Aggressive" color="#7A0E18" data={rows(aggressive)} />
      </div>

      <div style={{ borderTop: "1px solid #141210", paddingTop: 20 }}>
        <button onClick={runAi} disabled={aiLoading} style={{
          padding: "10px 24px", borderRadius: 3, border: "none",
          background: aiLoading ? "#3a1015" : "#7A0E18", color: "#E2E4DF",
          fontSize: 12, fontWeight: 600, cursor: aiLoading ? "wait" : "pointer", fontFamily: "inherit",
        }}>
          {aiLoading ? "Analyzing..." : "Get AI Analysis"}
        </button>
        <span style={{ marginLeft: 12, fontSize: 11, color: "#2a2720" }}>Claude will analyze these projections for this specific niche</span>
      </div>

      {aiLoading && (
        <div style={{ marginTop: 20, textAlign: "center", padding: 20 }}>
          <div style={{ width: 20, height: 20, margin: "0 auto 10px", border: "2px solid #141210", borderTopColor: "#7A0E18", borderRadius: "50%", animation: "sl-spin 0.8s linear infinite" }} />
          <p style={{ fontSize: 11, color: "#4a4840" }}>Running revenue analysis...</p>
        </div>
      )}

      {aiAnalysis && !aiLoading && (
        <div style={{ marginTop: 20, padding: "20px 22px", borderRadius: 4, background: "#060503", border: "1px solid #141210" }}>
          {renderMd(aiAnalysis)}
        </div>
      )}
    </div>
  );
}

export default function OfferBuilder() {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("offer");
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState("");
  const ref = useRef(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const scrape = async () => {
    const urls = [["instagram", form.instagram], ["tiktok", form.tiktok], ["youtube", form.youtube]].filter(x => x[1]?.trim());
    if (!urls.length) return {};
    setPhase("Analyzing social profiles...");
    try {
      const r = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: urls.map(([platform, url]) => ({ platform, url })) }),
      });
      if (!r.ok) throw new Error("Scrape failed");
      const data = await r.json();
      const profiles = {};
      (data.results || []).forEach(r => { if (r.content) profiles[r.platform] = r.content; });
      return profiles;
    } catch { return {}; }
  };

  const submit = async () => {
    if (Object.values(form).filter(v => v?.trim()).length < 3) { setError("Fill in at least niche, platforms, and audience problem."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const scraped = await scrape();
      setPhase("Building Grand Slam Offer...");
      let msg = "## CREATOR INTAKE DATA\n\n";
      INTAKE_FIELDS.forEach(s => { msg += "### " + s.section + "\n"; s.fields.forEach(f => { msg += "**" + f.label + ":** " + (form[f.key]?.trim() || "(not provided)") + "\n"; }); msg += "\n"; });
      if (Object.keys(scraped).length) { msg += "\n## SCRAPED SOCIAL MEDIA INTELLIGENCE\n\n"; for (const [p, d] of Object.entries(scraped)) msg += "### " + p + "\n" + d + "\n\n"; }
      msg += "\n---\nGenerate all three outputs now. Follow system instructions and Hormozi frameworks exactly.";

      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: SYSTEM_PROMPT, message: msg }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error || "API error " + r.status); }
      const d = await r.json();
      const text = d.content?.map(c => c.text || "").join("\n") || d.text || "";
      setResult({ parsed: parseOutput(text), raw: text, scraped });
      setTab("offer");
      setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) { setError(e.message); } finally { setLoading(false); setPhase(""); }
  };

  const exportMd = () => {
    if (!result?.raw) return;
    const b = new Blob([result.raw], { type: "text/markdown" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href = u;
    a.download = "SL-offer-" + (form.creator_name?.replace(/\s+/g, "-")?.toLowerCase() || form.niche?.replace(/\s+/g, "-")?.toLowerCase() || "export") + ".md";
    a.click(); URL.revokeObjectURL(u);
  };

  const sec = INTAKE_FIELDS[step];

  return (
    <div style={{ minHeight: "100vh", background: "#010300", color: "#E2E4DF", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <style>{`@keyframes sl-spin{to{transform:rotate(360deg)}} ::placeholder{color:#3a3830!important} textarea::-webkit-scrollbar{width:4px} textarea::-webkit-scrollbar-thumb{background:#1e1b17;border-radius:2px}`}</style>

      <div style={{ padding: "20px 28px", borderBottom: "1px solid #141210", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={LOGO_B64} alt="Second Layer" style={{ height: 16, opacity: 0.85 }} />
          <span style={{ color: "#2a2720", fontSize: 14 }}>|</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4a4840" }}>Offer Builder</span>
        </div>
        {result && <div style={{ display: "flex", gap: 6 }}>
          <button onClick={exportMd} style={{ padding: "6px 14px", borderRadius: 3, border: "1px solid #1e1b17", background: "transparent", color: "#6b6860", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Export .md</button>
          <button onClick={() => { setResult(null); setForm({}); setStep(0); }} style={{ padding: "6px 14px", borderRadius: 3, border: "none", background: "#7A0E18", color: "#E2E4DF", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>New Offer</button>
        </div>}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
        {!result && <div>
          <div style={{ marginBottom: 36 }}>
            <h1 style={{ fontSize: 28, fontWeight: 300, margin: "0 0 8px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              Build a <span style={{ color: "#7A0E18", fontWeight: 600, fontStyle: "italic" }}>Grand Slam</span> Offer
            </h1>
            <p style={{ fontSize: 13, color: "#4a4840", margin: 0, maxWidth: 460 }}>
              Hormozi&apos;s Value Equation + Money Models + Core Four. Fill in the creator context, get three outputs.
            </p>
          </div>

          <div style={{ display: "flex", gap: 2, marginBottom: 32 }}>
            {INTAKE_FIELDS.map((_, i) => <button key={i} onClick={() => setStep(i)} style={{ flex: 1, height: 2, border: "none", cursor: "pointer", background: i <= step ? "#7A0E18" : "#141210", borderRadius: 1 }} />)}
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#7A0E18", letterSpacing: "0.06em" }}>{sec.icon}/{String(INTAKE_FIELDS.length).padStart(2, "0")}</span>
              <h2 style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{sec.section}</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {sec.fields.map(f => <div key={f.key}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#4a4840", marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>{f.label}</label>
                <FieldInput field={f} value={form[f.key] || ""} onChange={set} />
              </div>)}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{ padding: "10px 22px", borderRadius: 3, border: "1px solid #1e1b17", background: "transparent", color: step === 0 ? "#1e1b17" : "#6b6860", fontSize: 12, fontWeight: 500, cursor: step === 0 ? "default" : "pointer", fontFamily: "inherit" }}>Back</button>
            {step < INTAKE_FIELDS.length - 1
              ? <button onClick={() => setStep(step + 1)} style={{ padding: "10px 28px", borderRadius: 3, border: "1px solid #1e1b17", background: "transparent", color: "#E2E4DF", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Continue</button>
              : <button onClick={submit} disabled={loading} style={{ padding: "10px 32px", borderRadius: 3, border: "none", background: loading ? "#3a1015" : "#7A0E18", color: "#E2E4DF", fontSize: 12, fontWeight: 600, cursor: loading ? "wait" : "pointer", fontFamily: "inherit" }}>{loading ? "Generating..." : "Generate Offer"}</button>
            }
          </div>

          {loading && <div style={{ marginTop: 32, padding: 24, borderRadius: 4, background: "#080604", border: "1px solid #141210", textAlign: "center" }}>
            <div style={{ width: 20, height: 20, margin: "0 auto 12px", border: "2px solid #141210", borderTopColor: "#7A0E18", borderRadius: "50%", animation: "sl-spin 0.8s linear infinite" }} />
            <p style={{ fontSize: 12, color: "#4a4840", margin: 0 }}>{phase || "Processing..."}</p>
            <p style={{ fontSize: 10, color: "#2a2720", margin: "6px 0 0" }}>Takes 60-90 seconds with profile scraping.</p>
          </div>}

          {error && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 3, background: "#7A0E1812", border: "1px solid #7A0E1830", color: "#dc2626", fontSize: 11 }}>{error}</div>}
        </div>}

        {result && <div ref={ref}>
          <div style={{ marginBottom: 28, padding: "28px 24px", borderRadius: 6, background: "#080604", border: "1px solid #141210" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <img src={LOGO_B64} alt="Second Layer" style={{ height: 14, opacity: 0.6 }} />
              <span style={{ fontSize: 9, color: "#2a2720", letterSpacing: "0.08em", textTransform: "uppercase" }}>Offer Analysis</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 300, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
              {form.creator_name ? <><span style={{ color: "#7A0E18", fontWeight: 600 }}>{form.creator_name}</span> &mdash; </> : ""}Grand Slam Offer
            </h2>
            <p style={{ fontSize: 12, color: "#4a4840", margin: 0 }}>
              {form.niche || "Creator offer"}{form.platforms ? ` \u00B7 ${form.platforms}` : ""}
            </p>
          </div>

          {result.scraped && Object.keys(result.scraped).length > 0 && (
            <div style={{ marginBottom: 16, padding: "8px 14px", borderRadius: 3, background: "#7A0E1808", border: "1px solid #141210", fontSize: 11, color: "#4a4840" }}>
              Social intelligence gathered: {Object.keys(result.scraped).join(", ")}
            </div>
          )}

          <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid #141210" }}>
            {TABS.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "11px 18px", border: "none", background: "transparent",
              color: tab === t.key ? "#E2E4DF" : "#3a3830",
              fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              letterSpacing: "0.04em", textTransform: "uppercase",
              borderBottom: tab === t.key ? "2px solid #7A0E18" : "2px solid transparent",
              marginBottom: -1, transition: "all 0.15s",
            }}>{t.label}</button>)}
          </div>

          <div style={{ padding: "22px 24px", borderRadius: 4, background: "#080604", border: "1px solid #141210", minHeight: 280 }}>
            {tab === "revenue"
              ? <RevenueProjector form={form} scraped={result.scraped} systemPrompt={SYSTEM_PROMPT} />
              : renderMd(result.parsed[tab])}
          </div>
        </div>}
      </div>
    </div>
  );
}
