"use client";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/offers")
      .then(r => r.json())
      .then(data => { setOffers(data.offers || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#010300", color: "#E2E4DF", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <style>{`@keyframes sl-spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ padding: "20px 28px", borderBottom: "1px solid #141210", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4a4840" }}>Offer Builder</span>
          <span style={{ color: "#2a2720", fontSize: 14 }}>|</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4a4840" }}>Dashboard</span>
        </div>
        <a href="/" style={{ padding: "6px 14px", borderRadius: 3, border: "none", background: "#7A0E18", color: "#E2E4DF", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "none" }}>New Offer</a>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 20px 80px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 300, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Past Offers</h1>
        <p style={{ fontSize: 13, color: "#4a4840", margin: "0 0 32px" }}>All generated offer analyses.</p>

        {loading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 20, height: 20, margin: "0 auto 12px", border: "2px solid #141210", borderTopColor: "#7A0E18", borderRadius: "50%", animation: "sl-spin 0.8s linear infinite" }} />
            <p style={{ fontSize: 12, color: "#4a4840" }}>Loading...</p>
          </div>
        )}

        {!loading && offers.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", borderRadius: 6, background: "#080604", border: "1px solid #141210" }}>
            <p style={{ fontSize: 14, color: "#4a4840", marginBottom: 16 }}>No offers yet.</p>
            <a href="/" style={{ color: "#7A0E18", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>Build your first Grand Slam Offer</a>
          </div>
        )}

        {!loading && offers.length > 0 && (
          <div style={{ borderRadius: 6, border: "1px solid #141210", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#080604" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 9, fontWeight: 600, color: "#4a4840", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid #1e1b17" }}>Creator</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 9, fontWeight: 600, color: "#4a4840", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid #1e1b17" }}>Niche</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 9, fontWeight: 600, color: "#4a4840", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid #1e1b17" }}>Platform</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 9, fontWeight: 600, color: "#4a4840", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid #1e1b17" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o, i) => (
                  <tr key={o.id || i} style={{ borderBottom: "1px solid #0f0d0a", cursor: "pointer", transition: "background 0.1s" }}
                    onClick={() => window.location.href = `/offer/${o.id}`}
                    onMouseEnter={e => e.currentTarget.style.background = "#0a0806"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#E2E4DF", fontWeight: 500 }}>{o.creatorName || "Unknown"}</td>
                    <td style={{ padding: "14px 16px", fontSize: 12, color: "#9a9890" }}>{o.niche || "-"}</td>
                    <td style={{ padding: "14px 16px", fontSize: 12, color: "#6b6860" }}>{o.primaryPlatform || "-"}</td>
                    <td style={{ padding: "14px 16px", fontSize: 11, color: "#4a4840" }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
