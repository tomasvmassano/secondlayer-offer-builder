"use client";

import { useState, useEffect } from "react";

const LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAAlCAAAAAAi6fkeAAAAAmJLR0QA/4ePzL8AAAAHdElNRQfqBAUPLQic+FFWAAAMFklEQVRYw9WZa5RVxZXHf1V17u3m0djIw+ahIMjwUERNWhF1RE2MGXVgotEYkYUzLsaMOk5MUNFgcAZxEoKDS8UHiHGJ6FLBKGrQJqCiYAMqKCgSlIciCA1N87qPc6r+8+He7ttgs2Y+gGtmf7nrVu29q/5Vu/brGAAwgmOP67D3q7VA2Q9eE4ebOp7QoWu/kwcNX3zYNTcnAyMX5CQlX0354TlzNx72BSzDazZIqq9k/LRp99gjhqP9PGnl9dUDzhpbJ+lJ3BFYpeyDOHkVNkrbj4R6AJN6U/6ZCICK2jj5JdHhX8OyROE27IdxvOYIAXHcqLiukpS1Nk11oqEc/rs3dNoVwmDMR9JfjxAQY1d6/aloTobVSSfMETitv5O+ag1HCEgERl36oG2msHnrP229ncPvteBCsXS/DYeaNhaDCAIwHLgF0/jXWEwjU2ncGhOBUYdyH3VSKE7tWI3zhx2Gt+dj5nMoIJZQXNOYwLcOsgmGL3BZqTTufKDwqnPB6azKBlOYbNhcOiQTMAql/whDCaU1zQeMNSEU2GjGhEPGxif0M34hh8IR6DLguM7Ubf1snWyw7QPZTGm6VTnUgw2+w2m9KxvWv7+9cCJt0mSy1qdOH3A0AG2/CXk93uiq2lcU99VoyaYJxkGrN70kA65p9iC2ohYzWmG1o+U3Yjn3pV2SJGUXXoCNFtXtWJoqTb+zo+4RnOP4R7+RJNVN7YzF8ciOHbcYrvlUhQtyPK58ooOcroV2Vz02b/59pxWQOKgaPePV15+4uMRw4p1P/3nB/T8qYLU9fjjmDykc7W947oVri/ANlP/kifl/voo5ITxI1CIQyzg1kpeuhtsUdG7xDCzVki4izZU7m9jWV2Mdz0i/ZZKUT7KFxXru9kms65ojcXS6p+GLu3/+mnLnYsHSe0b2g3F/f/Hrer7cgIGhNXrt2otuy2v+sRw9edHGjDSXNFfslaSbcYDF/OJrP2vUmH0//VQajmsJiOU6xcrX/G7M2IfXKBf2dKfr7jg8WgTi+H3wn0aWEQrKvjz+1gc+UV47+5HiKe+vv1yJ5HcUNV2l2CcaVUJi+elGPRJBt32ag8Nww26NBBiZaCzO0nqqchcDnJHVqnYV1/5mjbLJTyx36InfNuSSJRhwnLBAS3sDl2/drYbOmBaAGCq3x37FIADKpiqr0fC0/Ja2RYbU2qBxmIHZWO8MBEjflMupNoqYqfDoJu2bNqzvMY3Hf4fyPtHIRiSWCdJESEcDYl+Ds0xVdjA2cmUr49xbRHSr1e7vETmbYmGiu4Argt9Vxe27quElhbcwOM7eqoVlRJHrnFVYgGnpjTguC7nsyUQuiiKiTT5MgqHK67Lipf6tQrYXzJf/oA3OOQeX+byugZmKM/pk0AHK7lXeJ0VZHPdJL+NMxL9Kk0kzTRpBCijbKj2E6bJG4UpSQGSmBL/KlkX3hDCPK/aeQJmrCeExnOWsPVrfGYeh214f7iRqCUjEvdKaoo9I8ap0P859FMJsLOB4IIRX4Qx5fyYpAJNmpnytZabyYcfxpJwxJSQPK+999kwsOG5RXFeFtRy1wef7wW3ys4kAy/AFD1Wa9GKFWYXri/i9QkMnWCqN6JodQoqyTQXYvbYrOR8HlpO8D4OxtGhaJ5w39FRjXeQM8HHQFMr5N/ndVRig1cagy2Fy0HslkcEh5PsxSxmNI3WANsfTihNt6miM5XSf06+IHMyWboTTEp/p09yvTlK+oVvBHzseDWFvd3pmQqbL8luIDCcmyhyHS70nTScCHJdKm8qB/yFFKT91lnKaQoqqBq/RRDguVPiqDbwbwoPp1ul0Op1Ol6U7bg+6mmeV5PscFBaMtXOVxPojzrjl8l8flYJ2Lyh/MxFvKjzTGBCsSZlBSU6/a/KOrwdtO5prpNkTa4iIGK2whIjbFe/qYgwQMT6EWQWBFoCYFNDr4lunz1vrpbymEDmeCmEhBsf0oMmY8i/ld36x/osirc/m/XieldY2+SfT9Nt6uZIkGQBXKqOJEF2zTW8OIcU5inVRqUaxvKBkX49GyfR6hVp4MsRzVneyBsvzIUzEdG2IdV9ByvC2NOrQQBjwhw/2FgLE1rqkAOQchdzfYGm7JSSDoMNOeTWnoMd5VqHm25m6pU+Dz+lOzKIQZ87+0WNb9MbF4BzTQ9jerhniHplELxUVWE5K8mESrb5QJvkHHNB6s3QeTFCc74sFLL0yyh5f0NBSHPlVRlK8ftGsCVdVvSFNIcLYFUF3UMYwhXewVG6X37+zRPV1DQ/zjPRi0wHfVd24xYiJyoTn6JcPIfvRqjn/3B2wEH0mLaCZX/gXZZpiTsQvlQ/VnB7yerXwsM+WtlZQviFoUWNS8BuFZUUNLbjff5TXupsGtAHgraApRDhuUlhpHbOCriMi+qvC5I5VHYvUqaqqS3tmSi80AVlxYePlWHNKiPU6o5QNd3cBsA4MPbI+zChZlmNmiON+RSlDbdACuDXkfTUWIu4KYQ6crVy4gwgwps0mH+4tIv/2jVRsSZIPOwG4KGUXFIAYOu8K4Qw6bA91HTCWmqAHDzaiZkBsWdfyxsOWtu5z2kNfGTN3i3XOBI+JaF/mzdamG3GBXibauqGQyFoNqfaMgx+YaMkyE8BzPqYGhkhmGQKcbjg2MfNRi3Wn5dSq4P5je5kBnyShorCQ3LY/wQh+3JGXdjhZlsEQnClS+c9GjOzRvP6zXTqd3MxqnFhFJVZZg/cCqxhBs1TeizZoS7bxwdylaOq7dKyWeRoHRlXfM8lC6G5c+BKBTXqN96m65YSiEmGNbdyRcaZzMPrCxQIi9R2YFPYjpsMwO1z8ERF4xfhTzvGRJMnp9GeeerLNAUD6aFhj2WJN71bBzGMfgYpCrIxCu6vZmXWmW4HJWF1aQVZmT8GyIn/Zhfb9X0ecWcn+V/BgGdyWz9YaO1gu5BBWqYfXY2obnEYVIolRrNDkfWJlrDc9feQiZ5LU1LSXIgvBLP6QY0dV8/G7JhDMe+8bTa2MrXMuSrgziRd80ry6sf35/hU+Xdzk6BDV1LLCBDMs2Mg5khNX9ufrdehMgzUmUrhvrGe11BoBUXLcA2bd8IzlAlH7ZaEyO09aJD06yAd3DGkX9PqqT5zeMv6hc/MOQOnePUvUq2c2OE3olfeJ1xnzzzfOtErygA0zjL+vyswMFjDhdhuftHBI8N4nR0+/0KcmH2iij8TZb04Baw38PK/dfeHoOp/ffylAekw8gRRjtF+jAWj13Oq2MFRJfQdSLqJimVb0wGJXhFCoZwyLgkby8CsjlAkvAD2XLGZD0EX811JjDKz0sc82o73ZKS8rq/qZd429f1GszJrEb/73qzAYOtYHhX3dCxZkGa9Y4S8Tb/z1jM3KalohjW/yWvMlxTe0A6rGJ6q/AGsZISXJ8zdfP3Vb7hqcMeWLley/rXenAWM2v9EKY3lIeghg0FrNOApr6OsV+hf92Iokt/gva1qVfamc3po0W0vL2+3O599f+lEhFK3WwTS1544mU2u45HplYj2HA8cM7Q9zGp2qY2xSEprmbHRAHMk++7Pb31N2+fyVkub2L9RQV2+UJOUe64YDQ+WTWUnS5hvAgOHObfrg7jte3FFzHhgc/5TJ1JricuMkLWoP3/9MkjQpIr1S0outCyf7bn3dzua0beeD9J9diOtfP96P7mslPVKISGf4vC5pcvyW6ufqJUmZN4cDjsfq659sDAP/eTvQ75KhPbWxdt6yQk1vQ8V5/VI71yzf09T16DO4a/nOD99VsUFBxyGnVe79fOGGYj+jfWv21zda67CuH7+DQW1+3Dd8/vZWbOj/i71zl1CQrTw4YzSZ/eK4gcem937+UT3Ot7+kcsvb2wDnL3rNrB+QLT3oQNXAnq3iLavWFZS1LSe3p2nalTQ3pvWNDt8d3HdwB/2aQ7UkTVMSZ0sjh6QmNdY047O8Ik1o3oe29mCBkgrnC/IBc0Djp9QsKw2U5jHWgEoMzTtqrjHsOFNkMbYUib4NqMhhVGiGGAtBNjj1/CTtB645oBXWcoPu/zpNUph3BNrQ3ylVnJhufW0mrwuOyBeO74wMfbLrNimvuf/PL8TQW1LQx8eYw/9d4LsF0nVdLt72eOf//feN/waj4NX4IhohZQAAAB50RVh0aWNjOmNvcHlyaWdodABHb29nbGUgSW5jLiAyMDE2rAszOAAAABR0RVh0aWNjOmRlc2NyaXB0aW9uAHNSR0K2kHMHAAAAAElFTkSuQmCC";

const ALL_LAUNCH_ASSETS = [
  { key: "launchTimeline", label: "Timeline" },
  { key: "salesPageCopy", label: "Sales Page" },
  { key: "emailSequence", label: "Emails" },
  { key: "leadMagnet", label: "Lead Magnet" },
  { key: "adCreative", label: "Ads" },
  { key: "socialContent", label: "Content" },
  { key: "communityActivation", label: "Community" },
  { key: "onboardingFlow", label: "Onboarding" },
  { key: "churnPrevention", label: "Churn" },
];

function formatFollowers(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export default function PipelinePage() {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch full creator data for signed creators
    fetch("/api/creators?status=signed").then(r => r.json()).then(async (data) => {
      const summaries = data.creators || [];
      // Load full data for each creator to get launch status
      const full = await Promise.all(summaries.map(s =>
        fetch(`/api/creators/${s.id}`).then(r => r.ok ? r.json() : null).catch(() => null)
      ));
      setCreators(full.filter(Boolean));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 20, height: 20, border: "2px solid #222", borderTopColor: "#7A0E18", borderRadius: "50%", animation: "sl-spin 0.8s linear infinite" }} />
      <style>{`@keyframes sl-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const totalFollowers = creators.reduce((sum, c) => sum + (c.platforms?.instagram?.followers || 0) + (c.platforms?.tiktok?.followers || 0) + (c.platforms?.youtube?.subscribers || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}><img src={LOGO_B64} alt="SL" style={{ height: 16, opacity: 0.85 }} /></a>
          <span style={{ color: "#333", fontSize: 14 }}>|</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888" }}>Pipeline</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/creators" style={{ fontSize: 11, color: "#555", textDecoration: "none", padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>CRM</a>
          <a href="/" style={{ fontSize: 11, color: "#555", textDecoration: "none" }}>HQ</a>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Title + stats */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Pipeline</h1>
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Creators fechados. Cada um com o seu workspace para gerir assets, estrategia e lançamento.</p>
        </div>

        {creators.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 32 }}>
            <div style={{ padding: "14px 16px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#f5f5f5" }}>{creators.length}</div>
              <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Signed</div>
            </div>
            <div style={{ padding: "14px 16px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#f5f5f5" }}>{formatFollowers(totalFollowers)}</div>
              <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Alcance Total</div>
            </div>
            <div style={{ padding: "14px 16px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#22c55e" }}>{creators.filter(c => Object.keys(c.launch || {}).length >= 5).length}</div>
              <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Em Launch</div>
            </div>
          </div>
        )}

        {/* Creator workspace cards */}
        {creators.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ width: 48, height: 48, margin: "0 auto 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#333" }}>&#128274;</div>
            <p style={{ fontSize: 15, color: "#666", marginBottom: 8 }}>Nenhum creator fechado</p>
            <p style={{ fontSize: 12, color: "#444", marginBottom: 24 }}>Vai ao CRM, pesquisa um creator, e clica "Fechar Deal" para o adicionar ao pipeline.</p>
            <a href="/creators" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 8, background: "#7A0E18", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>Ir para CRM</a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {creators.map(c => {
              const followers = (c.platforms?.instagram?.followers || 0) + (c.platforms?.tiktok?.followers || 0) + (c.platforms?.youtube?.subscribers || 0);
              const launchAssets = c.launch || {};
              const launchDone = Object.keys(launchAssets).length;
              const launchApproved = Object.values(launchAssets).filter(v => v?.status === 'approved' || v?.status === 'live').length;
              const hasDm = !!c.dmSequence;
              const hasOffer = !!c.offer;
              const signedDate = c.signedAt ? new Date(c.signedAt).toLocaleDateString("pt-PT") : null;

              return (
                <a key={c.id} href={`/creators/${c.id}`} style={{
                  display: "block", padding: "24px 28px", background: "#141414",
                  border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14,
                  textDecoration: "none", color: "inherit", transition: "border-color 0.2s, transform 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(122,14,24,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {/* Top row: photo, name, meta */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                    {c.profilePicUrl ? (
                      <img src={`/api/proxy-image?url=${encodeURIComponent(c.profilePicUrl)}`} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.06)" }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#555", border: "2px solid rgba(255,255,255,0.06)" }}>{(c.name || "?")[0].toUpperCase()}</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5" }}>{c.name}</span>
                        {c.niche && <span style={{ fontSize: 11, color: "#666" }}>{c.niche}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 2, alignItems: "center" }}>
                        {followers > 0 && <span style={{ fontSize: 11, color: "#888" }}>{formatFollowers(followers)} followers</span>}
                        {signedDate && <span style={{ fontSize: 11, color: "#444" }}>Signed {signedDate}</span>}
                        {(() => {
                          const ks = c.onboarding?.status;
                          if (!ks || ks === 'not_started') return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: "rgba(234,179,8,0.1)", color: "#eab308", border: "1px solid rgba(234,179,8,0.2)" }}>Form pending</span>;
                          if (ks === 'form_pending') return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: "rgba(234,179,8,0.1)", color: "#eab308", border: "1px solid rgba(234,179,8,0.2)" }}>Form in progress</span>;
                          if (ks === 'form_complete') return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>Form complete</span>;
                          if (ks === 'call_scheduled') return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}>Call scheduled</span>;
                          if (ks === 'brief_signed') return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: "rgba(168,85,247,0.1)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.2)" }}>Brief signed</span>;
                          return null;
                        })()}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: "#7A0E18", fontWeight: 600 }}>Abrir workspace &rarr;</span>
                  </div>

                  {/* Asset status row */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {/* DM */}
                    <div style={{ padding: "6px 12px", borderRadius: 6, background: hasDm ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${hasDm ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)"}`, display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: hasDm ? "#22c55e" : "rgba(255,255,255,0.1)" }} />
                      <span style={{ fontSize: 10, color: hasDm ? "#22c55e" : "#444", fontWeight: 600 }}>DMs</span>
                    </div>
                    {/* Offer */}
                    <div style={{ padding: "6px 12px", borderRadius: 6, background: hasOffer ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${hasOffer ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)"}`, display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: hasOffer ? "#22c55e" : "rgba(255,255,255,0.1)" }} />
                      <span style={{ fontSize: 10, color: hasOffer ? "#22c55e" : "#444", fontWeight: 600 }}>Oferta</span>
                    </div>
                    {/* Divider */}
                    <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.06)" }} />
                    {/* Launch assets mini dots */}
                    {ALL_LAUNCH_ASSETS.map(a => {
                      const la = launchAssets[a.key];
                      const st = la?.status || (la ? 'draft' : null);
                      const dotColor = st === 'approved' || st === 'live' ? '#22c55e' : st === 'reviewed' ? '#3b82f6' : st === 'draft' ? '#eab308' : 'rgba(255,255,255,0.08)';
                      return (
                        <div key={a.key} title={`${a.label}: ${st || 'pendente'}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: dotColor }} />
                          <span style={{ fontSize: 7, color: "#333" }}>{a.label}</span>
                        </div>
                      );
                    })}
                    {/* Summary */}
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <span style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>{launchDone}/{ALL_LAUNCH_ASSETS.length}</span>
                      {launchApproved > 0 && <span style={{ fontSize: 10, color: "#22c55e", marginLeft: 6 }}>{launchApproved} aprovados</span>}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 60, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
          <p style={{ fontSize: 9, color: "#333", margin: 0 }}>Second Layer HQ &middot; Pipeline</p>
        </div>
      </div>
    </div>
  );
}
