"use client";

import { useState, useEffect, useCallback } from "react";

const LOGO_B64 = "data:image/png;base64,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";

function formatFollowers(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export default function CreatorsPage() {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addInstagramUrl, setAddInstagramUrl] = useState("");
  const [addTiktokUrl, setAddTiktokUrl] = useState("");
  const [addYoutubeUrl, setAddYoutubeUrl] = useState("");
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const fetchCreators = useCallback(async (q) => {
    try {
      const url = q ? `/api/creators?q=${encodeURIComponent(q)}&status=prospect` : "/api/creators?status=prospect";
      const res = await fetch(url);
      const data = await res.json();
      setCreators(data.creators || []);
    } catch {
      setCreators([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCreators(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchCreators]);

  const handleAdd = async () => {
    if (!addInstagramUrl.trim() && !addTiktokUrl.trim() && !addYoutubeUrl.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramUrl: addInstagramUrl.trim() || undefined,
          tiktokUrl: addTiktokUrl.trim() || undefined,
          youtubeUrl: addYoutubeUrl.trim() || undefined,
          name: addName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao adicionar");
      setAddInstagramUrl("");
      setAddTiktokUrl("");
      setAddYoutubeUrl("");
      setAddName("");
      setShowAdd(false);
      fetchCreators(search);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <img src={LOGO_B64} alt="Second Layer" style={{ height: 16, opacity: 0.85 }} />
          </a>
          <span style={{ color: "#333", fontSize: 14 }}>|</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555" }}>CRM</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/pipeline" style={{ fontSize: 11, color: "#555", textDecoration: "none", padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>Pipeline</a>
          <a href="/" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}>HQ</a>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Title */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Creators
          </h1>
          <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
            Base de dados de todos os criadores. Perfil, pesquisa, notas de reuniao e ferramentas.
          </p>
        </div>

        {/* Search + Add */}
        <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
          <input
            type="text"
            placeholder="Pesquisar por nome ou nicho..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              padding: "14px 16px",
              background: "#141414",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 10,
              color: "#f5f5f5",
              fontSize: 14,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => setShowAdd(!showAdd)}
            style={{
              padding: "14px 24px",
              background: "#7A0E18",
              border: "none",
              borderRadius: 10,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            + Adicionar Creator
          </button>
        </div>

        {/* Add Creator Form */}
        {showAdd && (
          <div style={{
            padding: 24,
            background: "#141414",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            marginBottom: 24,
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Adicionar Novo Creator</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <input
                  type="text"
                  placeholder="https://instagram.com/username"
                  value={addInstagramUrl}
                  onChange={(e) => setAddInstagramUrl(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    color: "#f5f5f5",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <input
                  type="text"
                  placeholder="Nome (opcional)"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    color: "#f5f5f5",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <input
                  type="text"
                  placeholder="https://tiktok.com/@username (opcional)"
                  value={addTiktokUrl}
                  onChange={(e) => setAddTiktokUrl(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    color: "#f5f5f5",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <input
                  type="text"
                  placeholder="https://youtube.com/@channel (opcional)"
                  value={addYoutubeUrl}
                  onChange={(e) => setAddYoutubeUrl(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    color: "#f5f5f5",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={handleAdd}
                disabled={adding || (!addInstagramUrl.trim() && !addTiktokUrl.trim() && !addYoutubeUrl.trim())}
                style={{
                  padding: "10px 20px",
                  background: adding ? "#333" : "#7A0E18",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: adding ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {adding ? "A pesquisar..." : "Pesquisar e Guardar"}
              </button>
              <button
                onClick={() => { setShowAdd(false); setAddError(""); }}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  color: "#888",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancelar
              </button>
              {addError && <span style={{ color: "#ef4444", fontSize: 12 }}>{addError}</span>}
            </div>
            {adding && (
              <p style={{ fontSize: 12, color: "#888", margin: "12px 0 0" }}>
                A pesquisar informacoes do creator com IA... pode demorar 15-30 segundos.
              </p>
            )}
          </div>
        )}

        {/* Creators Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#555" }}>
            A carregar...
          </div>
        ) : creators.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#555" }}>
            {search ? "Nenhum creator encontrado." : "Nenhum creator adicionado. Clica em \"+ Adicionar Creator\" para comecar."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {creators.map((c) => (
              <a
                key={c.id}
                href={`/creators/${c.id}`}
                style={{
                  display: "block",
                  padding: "22px 20px",
                  background: "#141414",
                  border: "1px solid rgba(255,255,255,0.04)",
                  borderRadius: 12,
                  textDecoration: "none",
                  color: "inherit",
                  transition: "border-color 0.15s, background 0.15s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#7A0E18";
                  e.currentTarget.style.background = "#181818";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.background = "#141414";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>
                    {c.name || "Unknown"}
                  </h3>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#7A0E18",
                  }}>
                    {formatFollowers(c.followers)}
                  </span>
                </div>
                {c.niche && (
                  <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>{c.niche}</p>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#555",
                    padding: "3px 8px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 6,
                  }}>
                    {c.primaryPlatform || "Instagram"}
                  </span>
                  <span style={{ fontSize: 11, color: "#555" }}>
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-PT") : ""}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 60, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
          <p style={{ fontSize: 10, color: "#333", margin: 0 }}>Second Layer HQ &middot; Creator CRM</p>
        </div>
      </div>
    </div>
  );
}
