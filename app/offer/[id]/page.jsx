"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { renderMd, extractAudience } from "../../lib/shared";

const TABS = [
  { key: "offer", label: "Grand Slam Offer" },
  { key: "blindspots", label: "Blind Spot Audit" },
  { key: "objections", label: "Objection Playbook" },
  { key: "revenue", label: "Revenue Projector" },
];

function SliderInput({ label, value, onChange, min, max, step, suffix, prefix, recommended }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#4a4840", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</span>
          {recommended && <span style={{ fontSize: 8, fontWeight: 600, color: "#7A0E18", letterSpacing: "0.06em", padding: "1px 5px", borderRadius: 2, border: "1px solid #7A0E1833", textTransform: "uppercase" }}>Recommended</span>}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#E2E4DF" }}>{prefix || ""}{typeof value === "number" ? value.toLocaleString() : value}{suffix || ""}</span>
      </div>
      <input type="range" min={min} max={max} step={step || 1} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", height: 4, appearance: "none", background: "#1e1b17", borderRadius: 2, outline: "none", cursor: "pointer", accentColor: "#7A0E18" }} />
    </div>
  );
}

function RevenueProjector({ form }) {
  const platform = form.primary_platform || "Instagram";

  const getPlatformFollowers = () => {
    const p = (form.platforms || "").toLowerCase();
    const platformKey = platform.toLowerCase();
    const match = p.match(new RegExp(platformKey + "\\s*(\\d+(?:[.,]\\d+)?)\\s*([kKmM])?", "i"));
    if (match) {
      let v = parseFloat(match[1].replace(",", "."));
      if (/k/i.test(match[2] || "")) v *= 1000;
      if (/m/i.test(match[2] || "")) v *= 1000000;
      return Math.round(v);
    }
    return extractAudience(form.platforms) || 10000;
  };

  const F = getPlatformFollowers();

  const [price, setPrice] = useState(197);
  const [commission, setCommission] = useState(25);

  const scenarios = {
    conservative: { mult: 0.003, label: "Conservative", pctRange: "0.2% - 0.4%", churn: 0.10, color: "#6b6860", border: "#141210", VR: 0.10, LR: 0.02, CR: 0.05, P: 10 },
    moderate: { mult: 0.00675, label: "Moderate", pctRange: "0.5% - 1.0%", churn: 0.08, color: "#E2E4DF", border: "#7A0E1833", VR: 0.15, LR: 0.03, CR: 0.08, P: 15 },
    aggressive: { mult: 0.02, label: "Aggressive", pctRange: "1.0% - 3.0%", churn: 0.06, color: "#7A0E18", border: "#141210", VR: 0.22, LR: 0.05, CR: 0.12, P: 20 },
  };

  const calc = (s) => {
    const activeClients = Math.round(F * s.mult);
    const monthlyRevenue = activeClients * price;
    const year1 = monthlyRevenue * 12;
    const slComm = Math.round(year1 * (commission / 100));
    const ltv = s.churn > 0 ? Math.round(price / s.churn) : price * 12;
    const pctOfFollowers = F > 0 ? ((activeClients / F) * 100).toFixed(2) : "0";
    return { activeClients, monthlyRevenue, year1, slComm, ltv, pctOfFollowers };
  };

  const con = calc(scenarios.conservative);
  const mod = calc(scenarios.moderate);
  const agg = calc(scenarios.aggressive);
  const simplified = Math.round(F * 0.00675);
  const fmt = (n) => "\u20AC" + Math.round(n).toLocaleString();

  return (
    <div>
      <div style={{ textAlign: "center", padding: "32px 20px 28px", marginBottom: 24, background: "linear-gradient(180deg, #0f0806 0%, #080604 100%)", borderRadius: 6, border: "1px solid #1e1b1733" }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: "#4a4840", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Estimated Monthly Recurring Revenue</div>
        <div style={{ fontSize: 48, fontWeight: 200, color: "#7A0E18", letterSpacing: "-0.03em", lineHeight: 1.1 }}>{fmt(mod.monthlyRevenue)}</div>
        <div style={{ fontSize: 11, color: "#2a2720", marginTop: 6 }}>/month &middot; {mod.activeClients} active clients &middot; {platform} {F.toLocaleString()} followers</div>
        <div style={{ fontSize: 10, color: "#2a2720", marginTop: 3 }}>Simplified estimate: {simplified} active clients (F &times; 0.00675)</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {Object.entries(scenarios).map(([key, s]) => {
          const d = key === "conservative" ? con : key === "moderate" ? mod : agg;
          return (
            <div key={key} style={{ flex: 1, padding: "16px", borderRadius: 4, background: "#080604", border: `1px solid ${s.border}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: "#6b6860", marginBottom: 4 }}>Active clients: <span style={{ color: "#E2E4DF", fontWeight: 600 }}>{d.activeClients.toLocaleString()}</span></div>
              <div style={{ fontSize: 11, color: "#6b6860", marginBottom: 4 }}>% of followers: <span style={{ color: "#9a9890" }}>{d.pctOfFollowers}%</span></div>
              <div style={{ fontSize: 10, color: "#2a2720", marginBottom: 8 }}>Benchmark: {s.pctRange}</div>
              <div style={{ paddingTop: 8, borderTop: "1px solid #0f0d0a" }}>
                <div style={{ fontSize: 11, color: "#6b6860", marginBottom: 4 }}>Monthly: <span style={{ color: "#E2E4DF", fontWeight: 600 }}>{fmt(d.monthlyRevenue)}</span></div>
                <div style={{ fontSize: 11, color: "#6b6860", marginBottom: 4 }}>Year 1: <span style={{ color: "#E2E4DF", fontWeight: 600 }}>{fmt(d.year1)}</span></div>
                <div style={{ fontSize: 11, color: "#6b6860", marginBottom: 4 }}>LTV/client: <span style={{ color: "#9a9890" }}>{fmt(d.ltv)}</span></div>
                <div style={{ fontSize: 11, color: "#6b6860" }}>SL commission: <span style={{ color: "#7A0E18", fontWeight: 600 }}>{fmt(d.slComm)}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "20px 22px", borderRadius: 4, background: "#060503", border: "1px solid #141210", marginBottom: 24 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: "#4a4840", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Adjust Parameters</div>
        <SliderInput label="Monthly Price" value={price} onChange={setPrice} min={9} max={997} step={1} prefix={"\u20AC"} recommended={price === 197} />
        <SliderInput label="SL Commission" value={commission} onChange={setCommission} min={15} max={35} step={1} suffix="%" recommended={commission === 25} />
      </div>

      <div style={{ padding: "18px 22px", borderRadius: 4, background: "#060503", border: "1px solid #141210", marginBottom: 16 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: "#4a4840", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Core Formula</div>
        <p style={{ fontSize: 13, color: "#E2E4DF", margin: "0 0 12px", fontFamily: "monospace", letterSpacing: "0.02em" }}>Active Clients = (F &times; VR &times; LR &times; CR &times; P) / Churn</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#6b6860" }}><strong style={{ color: "#9a9890" }}>F</strong> = followers on primary platform</div>
          <div style={{ fontSize: 11, color: "#6b6860" }}><strong style={{ color: "#9a9890" }}>VR</strong> = visibility rate per post</div>
          <div style={{ fontSize: 11, color: "#6b6860" }}><strong style={{ color: "#9a9890" }}>LR</strong> = lead rate (enter funnel)</div>
          <div style={{ fontSize: 11, color: "#6b6860" }}><strong style={{ color: "#9a9890" }}>CR</strong> = conversion rate (become paying)</div>
          <div style={{ fontSize: 11, color: "#6b6860" }}><strong style={{ color: "#9a9890" }}>P</strong> = monetization posts/month</div>
          <div style={{ fontSize: 11, color: "#6b6860" }}><strong style={{ color: "#9a9890" }}>Churn</strong> = monthly subscriber loss %</div>
        </div>
        <div style={{ borderTop: "1px solid #141210", paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: "#4a4840", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Simplified Quick Estimate</div>
          <p style={{ fontSize: 13, color: "#E2E4DF", margin: "0 0 6px", fontFamily: "monospace" }}>Active Clients &asymp; F &times; 0.00675 = {F.toLocaleString()} &times; 0.00675 = <span style={{ color: "#7A0E18" }}>{simplified}</span></p>
          <p style={{ fontSize: 10, color: "#2a2720", margin: 0 }}>Based on: VR=15%, LR=3%, CR=8%, P=15 posts/mo, Churn=8%</p>
        </div>
      </div>

      <div style={{ padding: "18px 22px", borderRadius: 4, background: "#060503", border: "1px solid #141210", marginBottom: 16 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: "#4a4840", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Scenario Parameters</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr style={{ borderBottom: "1px solid #1e1b17" }}>
              {["", "VR", "LR", "CR", "Posts/mo", "Churn"].map(h => <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "#4a4840", fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>)}
            </tr></thead>
            <tbody>{Object.entries(scenarios).map(([key, s]) => (
              <tr key={key} style={{ borderBottom: "1px solid #0f0d0a" }}>
                <td style={{ padding: "6px 10px", color: s.color, fontWeight: 600, fontSize: 10 }}>{s.label}</td>
                <td style={{ padding: "6px 10px", color: "#9a9890" }}>{(s.VR * 100)}%</td>
                <td style={{ padding: "6px 10px", color: "#9a9890" }}>{(s.LR * 100)}%</td>
                <td style={{ padding: "6px 10px", color: "#9a9890" }}>{(s.CR * 100)}%</td>
                <td style={{ padding: "6px 10px", color: "#9a9890" }}>{s.P}</td>
                <td style={{ padding: "6px 10px", color: "#9a9890" }}>{(s.churn * 100)}%</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div style={{ padding: "14px 18px", borderRadius: 4, background: "#7A0E1808", border: "1px solid #7A0E1815", fontSize: 11, color: "#6b6860", lineHeight: 1.6 }}>
        <strong style={{ color: "#9a9890" }}>Note:</strong> Follower count alone is not enough. What drives revenue is reach quality, conversion strength, and retention. A creator with 20K highly engaged followers can outperform one with 200K passive followers. The formula reflects this — every variable matters.
      </div>
    </div>
  );
}

export default function OfferView() {
  const params = useParams();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("offer");

  useEffect(() => {
    fetch(`/api/offers/${params.id}`)
      .then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(data => { setOffer(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [params.id]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#010300", color: "#E2E4DF", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 20, height: 20, margin: "0 auto 12px", border: "2px solid #141210", borderTopColor: "#7A0E18", borderRadius: "50%", animation: "sl-spin 0.8s linear infinite" }} />
        <p style={{ fontSize: 12, color: "#4a4840" }}>Loading offer...</p>
      </div>
      <style>{`@keyframes sl-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: "#010300", color: "#E2E4DF", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "#dc2626", marginBottom: 16 }}>Offer not found</p>
        <a href="/" style={{ color: "#7A0E18", fontSize: 12, textDecoration: "none" }}>Back to Builder</a>
      </div>
    </div>
  );

  const parsed = offer.parsed || {};
  const formData = offer.formData || {};

  const promiseMatch = (offer.rawOutput || "").match(/(?:Core Promise|Promessa Central|Promessa Principal|B\.\s*(?:Core Promise|Promessa))[:\s]*"?([^"\n]+)"?/i);

  return (
    <div style={{ minHeight: "100vh", background: "#010300", color: "#E2E4DF", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <style>{`@keyframes sl-spin{to{transform:rotate(360deg)}} ::placeholder{color:#3a3830!important}`}</style>

      <div style={{ padding: "20px 28px", borderBottom: "1px solid #141210", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4a4840" }}>Offer Builder</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <a href="/" style={{ padding: "6px 14px", borderRadius: 3, border: "1px solid #1e1b17", background: "transparent", color: "#6b6860", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textDecoration: "none" }}>Back to Builder</a>
          <a href="/dashboard" style={{ padding: "6px 14px", borderRadius: 3, border: "1px solid #1e1b17", background: "transparent", color: "#6b6860", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textDecoration: "none" }}>Dashboard</a>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
        <div style={{ marginBottom: 28, padding: "28px 24px", borderRadius: 6, background: "#080604", border: "1px solid #141210" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 9, color: "#2a2720", letterSpacing: "0.08em", textTransform: "uppercase" }}>Offer Analysis</span>
            <span style={{ fontSize: 9, color: "#2a2720", letterSpacing: "0.08em" }}>{new Date(offer.createdAt).toLocaleDateString()}</span>
          </div>
          {offer.creatorName && offer.creatorName !== "Unknown" && (
            <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 10px", color: "#E2E4DF", letterSpacing: "-0.02em" }}>{offer.creatorName}</h2>
          )}
          {promiseMatch && <p style={{ fontSize: 14, color: "#7A0E18", margin: 0, fontWeight: 400, lineHeight: 1.5, maxWidth: 560 }}>{promiseMatch[1].trim().replace(/^[""]|[""]$/g, "")}</p>}
        </div>

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
            ? <RevenueProjector form={formData} />
            : renderMd(parsed[tab])}
        </div>
      </div>
    </div>
  );
}
