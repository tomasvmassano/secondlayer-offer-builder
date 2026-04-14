"use client";
import { useState, useEffect } from "react";

/**
 * Creator selector component — used across all tools.
 * Fetches creators from CRM and lets user pick one.
 * Calls onSelect(creatorObject) when a creator is chosen.
 */
export default function CreatorSelector({ onSelect, selectedId }) {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/creators")
      .then(r => r.json())
      .then(data => { setCreators(data.creators || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = search
    ? creators.filter(c => (c.name || "").toLowerCase().includes(search.toLowerCase()) || (c.niche || "").toLowerCase().includes(search.toLowerCase()))
    : creators;

  const fmt = (n) => {
    if (!n) return "0";
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  };

  const handleSelect = async (id) => {
    try {
      const res = await fetch(`/api/creators/${id}`);
      if (!res.ok) return;
      const creator = await res.json();
      onSelect(creator);
    } catch { /* ignore */ }
  };

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
        Selecionar Creator
      </div>

      <input
        type="text"
        placeholder="Pesquisar por nome ou nicho..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "10px 14px", marginBottom: 10,
          background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
          color: "#f5f5f5", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
        }}
      />

      {loading && <div style={{ padding: 20, textAlign: "center", color: "#555", fontSize: 12 }}>A carregar creators...</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", color: "#555", fontSize: 12 }}>
          {creators.length === 0 ? (
            <>Nenhum creator no CRM. <a href="/creators" style={{ color: "#7A0E18", textDecoration: "none" }}>Adicionar primeiro</a></>
          ) : "Nenhum resultado"}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderRadius: 8, border: "none",
                background: selectedId === c.id ? "rgba(122,14,24,0.15)" : "#141414",
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (selectedId !== c.id) e.currentTarget.style.background = "#1a1a1a"; }}
              onMouseLeave={e => { if (selectedId !== c.id) e.currentTarget.style.background = "#141414"; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5" }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                  {c.niche || "—"} · {c.primaryPlatform} · {fmt(c.followers)} followers
                </div>
              </div>
              {selectedId === c.id && <span style={{ fontSize: 10, color: "#7A0E18", fontWeight: 600 }}>SELECIONADO</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
