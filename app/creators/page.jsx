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
  const [crmTab, setCrmTab] = useState("novos");
  const [discoveryQueue, setDiscoveryQueue] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [acceptTiktok, setAcceptTiktok] = useState("");
  const [acceptYoutube, setAcceptYoutube] = useState("");
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [blacklist, setBlacklist] = useState({ dismissed: [], outOfRange: [] });
  const [seedUrls, setSeedUrls] = useState("");
  const [showSeedInput, setShowSeedInput] = useState(false);
  const [showAutopilot, setShowAutopilot] = useState(false);
  const [persistentSeeds, setPersistentSeeds] = useState([]);
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [recentRuns, setRecentRuns] = useState([]);
  const [newSeedInput, setNewSeedInput] = useState("");
  const [newSeedNiche, setNewSeedNiche] = useState("Fitness");
  const [newSeedCountry, setNewSeedCountry] = useState("PT");
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

  const fetchDiscoveryQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/discovery");
      const data = await res.json();
      setDiscoveryQueue(data.queue || []);
    } catch {
      setDiscoveryQueue([]);
    }
  }, []);

  useEffect(() => {
    fetchCreators();
    fetchDiscoveryQueue();
  }, [fetchCreators, fetchDiscoveryQueue]);

  const runDiscovery = async () => {
    if (discovering) return;
    if (!confirm("Correr discovery em todos os creators? Custo estimado: ~€1.50 (10 candidatos). Continuar?")) return;
    setDiscovering(true);
    setDiscoveryStatus("A pesquisar creators similares...");
    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max: 10 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      const d = data.drops || {};
      const parts = [`${data.queued || 0} qualificados`];
      if (data.dismissedNiche) parts.push(`${data.dismissedNiche} fora do nicho`);
      if (data.dismissedLanguage) parts.push(`${data.dismissedLanguage} idioma errado`);
      if (data.dismissedNoBusiness) parts.push(`${data.dismissedNoBusiness} sem monetização`);
      if (data.dismissedLowTier) parts.push(`${data.dismissedLowTier} C/D tier`);
      if (data.dismissedOutOfRange) {
        const rangeParts = [];
        if (data.tooSmall) rangeParts.push(`${data.tooSmall} <50K`);
        if (data.tooBig) rangeParts.push(`${data.tooBig} too big`);
        parts.push(`${data.dismissedOutOfRange} fora do range (${rangeParts.join(", ")})`);
      }
      if (data.failed) parts.push(`${data.failed} falharam`);
      let msg = `Resultado: ${parts.join(" · ")}`;

      const totalDismissed = (data.dismissedLowTier || 0) + (data.dismissedOutOfRange || 0) + (data.dismissedLanguage || 0) + (data.dismissedNiche || 0) + (data.dismissedNoBusiness || 0);
      if ((data.queued || 0) === 0 && totalDismissed === 0) {
        const reasons = [];
        if (d.totalRelated === 0) reasons.push(`nenhum creator tem dados de similares (precisa re-scrape)`);
        else {
          reasons.push(`${d.totalRelated} similares encontrados`);
          if (d.inCRM) reasons.push(`${d.inCRM} já no CRM`);
          if (d.dismissed) reasons.push(`${d.dismissed} blacklist`);
          if (d.inQueue) reasons.push(`${d.inQueue} já em queue`);
          if (d.outOfRange) reasons.push(`${d.outOfRange} fora do range`);
        }
        msg = `Sem candidatos: ${reasons.join(", ")}`;
      }
      setDiscoveryStatus(msg);
      fetchDiscoveryQueue();
      setTimeout(() => setDiscoveryStatus(""), 20000);
    } catch (err) {
      setDiscoveryStatus(`Erro: ${err.message}`);
    } finally {
      setDiscovering(false);
    }
  };

  const fetchAutopilotData = async () => {
    try {
      const [seedsRes, statusRes, runsRes] = await Promise.all([
        fetch("/api/discovery/seeds").then(r => r.json()),
        fetch("/api/discovery/autopilot").then(r => r.json()),
        fetch("/api/discovery/runs?limit=10").then(r => r.json()),
      ]);
      setPersistentSeeds(seedsRes.seeds || []);
      setAutopilotEnabled(!!statusRes.enabled);
      setRecentRuns(runsRes.runs || []);
    } catch {}
  };

  const toggleAutopilotPanel = () => {
    if (!showAutopilot) fetchAutopilotData();
    setShowAutopilot(!showAutopilot);
  };

  const addPersistentSeed = async () => {
    const urls = newSeedInput.split(/\n|,/).map(s => s.trim()).filter(s => s.length > 0);
    if (urls.length === 0) return;
    try {
      const res = await fetch("/api/discovery/seeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, niche: newSeedNiche, country: newSeedCountry }),
      });
      const data = await res.json();
      setPersistentSeeds(data.seeds || []);
      setNewSeedInput("");
    } catch {}
  };

  const removePersistentSeed = async (url) => {
    try {
      const res = await fetch("/api/discovery/seeds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      setPersistentSeeds(data.seeds || []);
    } catch {}
  };

  const toggleAutopilot = async () => {
    try {
      const res = await fetch("/api/discovery/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !autopilotEnabled }),
      });
      const data = await res.json();
      setAutopilotEnabled(!!data.enabled);
    } catch {}
  };

  const runSeedDiscovery = async () => {
    if (discovering) return;
    const urls = seedUrls.split(/\n|,/).map(s => s.trim()).filter(s => s.length > 0);
    if (urls.length === 0) {
      setDiscoveryStatus("Cola pelo menos um URL de Instagram");
      setTimeout(() => setDiscoveryStatus(""), 3000);
      return;
    }
    const estCost = (urls.length * 0.25 + urls.length * 10 * 0.15).toFixed(2);
    if (!confirm(`Descobrir a partir de ${urls.length} seed(s)? Custo estimado: ~€${estCost} (€0.25 por seed + €0.15 por candidato scaneado).`)) return;

    setDiscovering(true);
    setDiscoveryStatus("A scrapear seeds e candidatos...");
    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seeds: urls, max: 15 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");

      const parts = [`${data.queued || 0} qualificados de ${data.scanned} scanned`];
      if (data.dismissedNiche) parts.push(`${data.dismissedNiche} fora do nicho`);
      if (data.dismissedLanguage) parts.push(`${data.dismissedLanguage} idioma errado`);
      if (data.dismissedNoBusiness) parts.push(`${data.dismissedNoBusiness} sem monetização`);
      if (data.dismissedLowTier) parts.push(`${data.dismissedLowTier} C/D tier`);
      if (data.dismissedOutOfRange) parts.push(`${data.dismissedOutOfRange} fora do range`);

      let msg = `Resultado: ${parts.join(" · ")}`;
      // Report seed-level issues
      const failedSeeds = (data.seedResults || []).filter(s => s.status !== 'ok');
      if (failedSeeds.length > 0) {
        msg += ` | Seeds com problemas: ${failedSeeds.map(s => `@${s.handle || s.url} (${s.status})`).join(", ")}`;
      }

      setDiscoveryStatus(msg);
      fetchDiscoveryQueue();
      setTimeout(() => setDiscoveryStatus(""), 30000);
      // Clear input on success
      if ((data.queued || 0) > 0) {
        setSeedUrls("");
        setShowSeedInput(false);
      }
    } catch (err) {
      setDiscoveryStatus(`Erro: ${err.message}`);
    } finally {
      setDiscovering(false);
    }
  };

  const fetchBlacklist = async () => {
    try {
      const res = await fetch("/api/discovery?view=blacklist");
      const data = await res.json();
      setBlacklist({ dismissed: data.dismissed || [], outOfRange: data.outOfRange || [] });
    } catch {
      setBlacklist({ dismissed: [], outOfRange: [] });
    }
  };

  const toggleBlacklist = () => {
    if (!showBlacklist) fetchBlacklist();
    setShowBlacklist(!showBlacklist);
  };

  const unblock = async (handle) => {
    try {
      await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unblock", handle }),
      });
      fetchBlacklist();
    } catch {}
  };

  const resetRangeFilter = async () => {
    if (!confirm("Limpar TODA a blacklist (incluindo runs antigas)? Vão poder ser re-avaliados na próxima discovery. Útil depois de mudar o range ICP.")) return;
    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_all" }),
      });
      const data = await res.json();
      setDiscoveryStatus(`Reset: ${data.cleared || 0} handles libertados`);
      setTimeout(() => setDiscoveryStatus(""), 5000);
    } catch (err) {
      setDiscoveryStatus(`Erro: ${err.message}`);
    }
  };

  const acceptCandidate = async (id) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/discovery/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiktokUrl: acceptTiktok.trim() || null,
          youtubeUrl: acceptYoutube.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      if (data.duplicate) {
        alert("Creator já existia no CRM. Adicionado/actualizado apenas o registo existente.");
      }
      // Reset acceptance form state
      setAcceptingId(null);
      setAcceptTiktok("");
      setAcceptYoutube("");
      fetchDiscoveryQueue();
      fetchCreators(search);
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const startAccepting = (id) => {
    setAcceptingId(id);
    setAcceptTiktok("");
    setAcceptYoutube("");
  };

  const cancelAccepting = () => {
    setAcceptingId(null);
    setAcceptTiktok("");
    setAcceptYoutube("");
  };

  const dismissCandidate = async (id) => {
    setProcessingId(id);
    try {
      await fetch(`/api/discovery/${id}`, { method: "DELETE" });
      fetchDiscoveryQueue();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

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

        {/* Tabs */}
        {(() => {
          const warm = creators.filter(c => c.hasOffer);
          const cold = creators.filter(c => !c.hasOffer);
          const activeList = crmTab === "novos" ? cold : crmTab === "contacto" ? warm : [];

          return (
            <div>
              <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  { key: "novos", label: "Novos", count: cold.length },
                  { key: "contacto", label: "Em contacto", count: warm.length },
                  { key: "discovery", label: "Discovery", count: discoveryQueue.length },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setCrmTab(t.key)}
                    style={{
                      padding: "12px 20px",
                      background: "transparent",
                      border: "none",
                      borderBottom: crmTab === t.key ? "2px solid #f5f5f5" : "2px solid transparent",
                      color: crmTab === t.key ? "#f5f5f5" : "#555",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "color 0.15s, border-color 0.15s",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {t.label}
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: crmTab === t.key ? "#888" : "#333",
                      minWidth: 20,
                      textAlign: "center",
                    }}>{t.count}</span>
                  </button>
                ))}
              </div>

              {/* Discovery Tab */}
              {crmTab === "discovery" ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div>
                      <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                        Creators similares descobertos automaticamente a partir dos teus creators existentes. Apenas A/B tier.
                      </p>
                      {discoveryStatus && (
                        <p style={{ fontSize: 11, color: discoveryStatus.startsWith("Erro") ? "#ef4444" : "#22c55e", margin: "6px 0 0" }}>{discoveryStatus}</p>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={toggleBlacklist}
                        title="Ver handles previamente dispensados"
                        style={{
                          padding: "10px 14px",
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 8,
                          color: "#888",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {showBlacklist ? "Esconder blacklist" : "Ver blacklist"}
                      </button>
                      <button
                        onClick={resetRangeFilter}
                        disabled={discovering}
                        title="Liberta creators previamente filtrados por range de seguidores"
                        style={{
                          padding: "10px 14px",
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 8,
                          color: "#888",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: discovering ? "not-allowed" : "pointer",
                          fontFamily: "inherit",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Reset blacklist
                      </button>
                      <button
                        onClick={toggleAutopilotPanel}
                        title="Gerir autopilot: seeds persistentes, toggle on/off, histórico de runs"
                        style={{
                          padding: "10px 14px",
                          background: showAutopilot ? "rgba(34,197,94,0.15)" : (autopilotEnabled ? "rgba(34,197,94,0.08)" : "transparent"),
                          border: `1px solid ${showAutopilot ? "rgba(34,197,94,0.4)" : (autopilotEnabled ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)")}`,
                          borderRadius: 8,
                          color: autopilotEnabled ? "#22c55e" : "#888",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Autopilot{autopilotEnabled ? " · ON" : ""}
                      </button>
                      <button
                        onClick={() => setShowSeedInput(!showSeedInput)}
                        title="Descobrir a partir de URLs de Instagram que cola manualmente (seeds externos)"
                        style={{
                          padding: "10px 14px",
                          background: showSeedInput ? "rgba(122,14,24,0.2)" : "transparent",
                          border: `1px solid ${showSeedInput ? "rgba(122,14,24,0.4)" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: 8,
                          color: showSeedInput ? "#f5f5f5" : "#888",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {showSeedInput ? "Cancelar seeds" : "Com seeds"}
                      </button>
                      <button
                        onClick={runDiscovery}
                        disabled={discovering}
                        style={{
                          padding: "10px 18px",
                          background: discovering ? "#333" : "#7A0E18",
                          border: "none",
                          borderRadius: 8,
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: discovering ? "not-allowed" : "pointer",
                          fontFamily: "inherit",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {discovering ? "A descobrir..." : "Correr Discovery"}
                      </button>
                    </div>
                  </div>

                  {/* Seed input */}
                  {showSeedInput && (
                    <div style={{ marginBottom: 20, padding: "16px 18px", background: "#0f0f0f", border: "1px solid rgba(122,14,24,0.2)", borderRadius: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", marginBottom: 4 }}>
                        Discovery com seeds manuais
                      </div>
                      <div style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>
                        Cola URLs de Instagram de creators grandes que já conheces (um por linha ou separados por vírgula). O sistema vai scrapear cada um, extrair os seus similares, e filtrar pela tua ICP.
                      </div>
                      <textarea
                        value={seedUrls}
                        onChange={(e) => setSeedUrls(e.target.value)}
                        placeholder="https://instagram.com/cafyfabio&#10;https://instagram.com/liafarianutricionista&#10;https://instagram.com/outrohandle"
                        rows={5}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          background: "#1a1a1a",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 8,
                          color: "#f5f5f5",
                          fontSize: 12,
                          fontFamily: "monospace",
                          outline: "none",
                          resize: "vertical",
                          boxSizing: "border-box",
                          marginBottom: 10,
                        }}
                      />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontSize: 10, color: "#555" }}>
                          Até 15 candidatos por run. Cada seed pode dar ~15 candidatos para filtrar.
                        </div>
                        <button
                          onClick={runSeedDiscovery}
                          disabled={discovering || !seedUrls.trim()}
                          style={{
                            padding: "8px 16px",
                            background: (discovering || !seedUrls.trim()) ? "#333" : "#7A0E18",
                            border: "none",
                            borderRadius: 6,
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: (discovering || !seedUrls.trim()) ? "not-allowed" : "pointer",
                            fontFamily: "inherit",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {discovering ? "A descobrir..." : "Descobrir a partir de seeds"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Autopilot panel */}
                  {showAutopilot && (
                    <div style={{ marginBottom: 20, padding: "16px 18px", background: "#0f0f0f", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5" }}>Autopilot Discovery</div>
                          <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                            Corre automaticamente todos os dias às 6AM (Lisboa) · até 30 candidatos · notifica tomas@ + raul@informallabs.com
                          </div>
                        </div>
                        <button
                          onClick={toggleAutopilot}
                          disabled={persistentSeeds.length === 0 && !autopilotEnabled}
                          title={persistentSeeds.length === 0 ? "Adiciona pelo menos 1 seed antes de activar" : ""}
                          style={{
                            padding: "8px 18px",
                            background: autopilotEnabled ? "#22c55e" : (persistentSeeds.length === 0 ? "#222" : "#1a1a1a"),
                            border: `1px solid ${autopilotEnabled ? "#22c55e" : "rgba(255,255,255,0.1)"}`,
                            borderRadius: 8,
                            color: autopilotEnabled ? "#000" : (persistentSeeds.length === 0 ? "#444" : "#888"),
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: persistentSeeds.length === 0 && !autopilotEnabled ? "not-allowed" : "pointer",
                            fontFamily: "inherit",
                            whiteSpace: "nowrap",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {autopilotEnabled ? "ON" : "OFF"}
                        </button>
                      </div>

                      {/* Seeds list grouped by niche/country */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                          Seeds persistentes ({persistentSeeds.length})
                        </div>

                        {persistentSeeds.length === 0 ? (
                          <div style={{ fontSize: 11, color: "#555", padding: "8px 0 12px" }}>
                            Nenhum seed ainda. Adiciona creators grandes nos teus nichos target para o autopilot usar.
                          </div>
                        ) : (
                          <div style={{ marginBottom: 12 }}>
                            {(() => {
                              // Group by niche + country
                              const groups = {};
                              persistentSeeds.forEach(seed => {
                                const url = typeof seed === "string" ? seed : seed.url;
                                const niche = (typeof seed === "object" && seed.niche) || "Sem tag";
                                const country = (typeof seed === "object" && seed.country) || "";
                                const key = country ? `${niche} · ${country}` : niche;
                                if (!groups[key]) groups[key] = [];
                                groups[key].push(url);
                              });
                              const sortedKeys = Object.keys(groups).sort((a, b) => {
                                if (a === "Sem tag") return 1;
                                if (b === "Sem tag") return -1;
                                return a.localeCompare(b);
                              });
                              return sortedKeys.map(groupKey => (
                                <div key={groupKey} style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: "#7A0E18", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                                    {groupKey} <span style={{ color: "#444", fontWeight: 400 }}>({groups[groupKey].length})</span>
                                  </div>
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {groups[groupKey].map(url => {
                                      const handle = url.match(/instagram\.com\/([^/?]+)/i)?.[1] || url;
                                      return (
                                        <div key={url} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 7px 4px 10px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 5 }}>
                                          <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#aaa", textDecoration: "none" }}>@{handle}</a>
                                          <button onClick={() => removePersistentSeed(url)} title="Remover" style={{ fontSize: 11, color: "#555", background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", lineHeight: 1 }}>×</button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        )}

                        {/* Add form with niche + country tags */}
                        <div style={{ padding: "10px 12px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8 }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                            Adicionar novo seed
                          </div>
                          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                            <select
                              value={newSeedNiche}
                              onChange={(e) => setNewSeedNiche(e.target.value)}
                              style={{ flex: 1, padding: "6px 8px", background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 5, color: "#ccc", fontSize: 11, fontFamily: "inherit", outline: "none" }}
                            >
                              {["Fitness", "Empreendedorismo", "Nutrição", "Finanças", "Imobiliário", "Educação", "Culinária"].map(n => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                            <select
                              value={newSeedCountry}
                              onChange={(e) => setNewSeedCountry(e.target.value)}
                              style={{ flex: 1, padding: "6px 8px", background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 5, color: "#ccc", fontSize: 11, fontFamily: "inherit", outline: "none" }}
                            >
                              {["PT", "BR", "Dubai", "Other"].map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <input
                              type="text"
                              value={newSeedInput}
                              onChange={(e) => setNewSeedInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPersistentSeed(); } }}
                              placeholder="https://instagram.com/handle (um ou vários separados por vírgula)"
                              style={{
                                flex: 1,
                                padding: "6px 10px",
                                background: "#0f0f0f",
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: 5,
                                color: "#f5f5f5",
                                fontSize: 11,
                                fontFamily: "monospace",
                                outline: "none",
                              }}
                            />
                            <button
                              onClick={addPersistentSeed}
                              disabled={!newSeedInput.trim()}
                              style={{
                                padding: "6px 14px",
                                background: newSeedInput.trim() ? "#7A0E18" : "#1a1a1a",
                                border: "none",
                                borderRadius: 5,
                                color: newSeedInput.trim() ? "#fff" : "#444",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: newSeedInput.trim() ? "pointer" : "not-allowed",
                                fontFamily: "inherit",
                              }}
                            >
                              Adicionar
                            </button>
                          </div>
                          <div style={{ fontSize: 9, color: "#444", marginTop: 6 }}>
                            Todos os URLs adicionados nesta operação recebem o mesmo nicho e país. Adiciona nichos diferentes um de cada vez.
                          </div>
                        </div>
                      </div>

                      {/* Recent runs */}
                      {recentRuns.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                            Últimas runs ({recentRuns.length})
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {recentRuns.slice(0, 5).map((run, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 5 }}>
                                <span style={{ fontSize: 10, color: "#666", minWidth: 120 }}>
                                  {new Date(run.timestamp).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </span>
                                {run.status === 'ok' ? (
                                  <>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>{run.queued || 0}</span>
                                    <span style={{ fontSize: 10, color: "#666" }}>qualificados</span>
                                    <span style={{ fontSize: 10, color: "#444" }}>· {run.scanned} scaneados · {run.seeds} seeds</span>
                                  </>
                                ) : (
                                  <span style={{ fontSize: 10, color: "#eab308" }}>{run.status === 'skipped' ? `skipped (${run.reason})` : `error: ${run.error || 'unknown'}`}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Blacklist viewer */}
                  {showBlacklist && (
                    <div style={{ marginBottom: 20, padding: "14px 16px", background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 10 }}>
                        Blacklist — {blacklist.dismissed.length + blacklist.outOfRange.length} handles bloqueados
                      </div>
                      {blacklist.dismissed.length === 0 && blacklist.outOfRange.length === 0 ? (
                        <div style={{ fontSize: 11, color: "#555", padding: "6px 0" }}>Blacklist vazio.</div>
                      ) : (
                        <>
                          {blacklist.dismissed.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 9, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                                C/D Tier ({blacklist.dismissed.length}) — dispensados por baixa qualidade
                              </div>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {blacklist.dismissed.map(h => (
                                  <div key={h} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 6px 3px 8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 5 }}>
                                    <a href={`https://instagram.com/${h}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#999", textDecoration: "none" }}>@{h}</a>
                                    <button onClick={() => unblock(h)} title="Libertar" style={{ fontSize: 10, color: "#555", background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", lineHeight: 1 }}>×</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {blacklist.outOfRange.length > 0 && (
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                                Out of Range ({blacklist.outOfRange.length}) — fora do range de seguidores
                              </div>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {blacklist.outOfRange.map(h => (
                                  <div key={h} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 6px 3px 8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 5 }}>
                                    <a href={`https://instagram.com/${h}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#999", textDecoration: "none" }}>@{h}</a>
                                    <button onClick={() => unblock(h)} title="Libertar" style={{ fontSize: 10, color: "#555", background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", lineHeight: 1 }}>×</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {discoveryQueue.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 60, color: "#555" }}>
                      Queue vazio. Clica em "Correr Discovery" para encontrar creators similares.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                      {discoveryQueue.map((c) => {
                        const gradeColor = c.dealScoreGrade === 'A' ? "#22c55e" : "#3b82f6";
                        return (
                          <div key={c.id} style={{ padding: "18px 18px 14px", background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 12 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                              {c.profilePicUrl ? (
                                <img src={`/api/proxy-image?url=${encodeURIComponent(c.profilePicUrl)}`} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                              ) : (
                                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#555" }}>{(c.name || "?")[0].toUpperCase()}</div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#f5f5f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {c.name}
                                  </h3>
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", background: gradeColor + "20", color: gradeColor, borderRadius: 4 }}>
                                    {c.dealScoreGrade}
                                  </span>
                                </div>
                                <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#555", textDecoration: "none" }}>
                                  @{c.handle}
                                </a>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#7A0E18" }}>
                                {formatFollowers(c.followers)}
                              </span>
                            </div>

                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                              {c.engagement && <span style={{ fontSize: 10, color: "#888", padding: "2px 7px", background: "rgba(255,255,255,0.03)", borderRadius: 4 }}>Eng: {c.engagement}</span>}
                              {c.isVerified && <span style={{ fontSize: 10, color: "#3b82f6", padding: "2px 7px", background: "rgba(59,130,246,0.08)", borderRadius: 4 }}>✓ Verified</span>}
                              {c.isBusinessAccount && <span style={{ fontSize: 10, color: "#888", padding: "2px 7px", background: "rgba(255,255,255,0.03)", borderRadius: 4 }}>Business</span>}
                            </div>

                            {c.bio && (
                              <p style={{ fontSize: 11, color: "#888", margin: "0 0 10px", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                                {c.bio}
                              </p>
                            )}

                            <div style={{ fontSize: 10, color: "#444", marginBottom: 10 }}>
                              Descoberto de <span style={{ color: "#666" }}>@{c.sourceCreatorHandle || c.sourceCreatorName}</span>
                            </div>

                            {acceptingId === c.id ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8 }}>
                                <div style={{ fontSize: 9, fontWeight: 600, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                                  Plataformas adicionais (opcional)
                                </div>
                                <input
                                  type="text"
                                  value={acceptTiktok}
                                  onChange={(e) => setAcceptTiktok(e.target.value)}
                                  placeholder="TikTok URL (opcional)"
                                  style={{ padding: "6px 10px", background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, color: "#f5f5f5", fontSize: 10, fontFamily: "monospace", outline: "none" }}
                                />
                                <input
                                  type="text"
                                  value={acceptYoutube}
                                  onChange={(e) => setAcceptYoutube(e.target.value)}
                                  placeholder="YouTube URL (opcional)"
                                  style={{ padding: "6px 10px", background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, color: "#f5f5f5", fontSize: 10, fontFamily: "monospace", outline: "none" }}
                                />
                                <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                                  <button
                                    onClick={() => acceptCandidate(c.id)}
                                    disabled={processingId === c.id}
                                    style={{ flex: 1, padding: "6px 12px", background: processingId === c.id ? "#222" : "#22c55e", border: "none", borderRadius: 5, color: processingId === c.id ? "#666" : "#000", fontSize: 10, fontWeight: 700, cursor: processingId === c.id ? "wait" : "pointer", fontFamily: "inherit" }}
                                  >
                                    {processingId === c.id ? "A processar..." : "Confirmar"}
                                  </button>
                                  <button
                                    onClick={cancelAccepting}
                                    disabled={processingId === c.id}
                                    style={{ padding: "6px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, color: "#555", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  onClick={() => startAccepting(c.id)}
                                  disabled={processingId === c.id}
                                  style={{ flex: 1, padding: "8px 12px", background: processingId === c.id ? "#222" : "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, color: "#22c55e", fontSize: 11, fontWeight: 600, cursor: processingId === c.id ? "wait" : "pointer", fontFamily: "inherit" }}
                                >
                                  {processingId === c.id ? "A processar..." : "Aceitar"}
                                </button>
                                <button
                                  onClick={() => dismissCandidate(c.id)}
                                  disabled={processingId === c.id}
                                  style={{ padding: "8px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#555", fontSize: 11, fontWeight: 600, cursor: processingId === c.id ? "wait" : "pointer", fontFamily: "inherit" }}
                                >
                                  Dispensar
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : loading ? (
                <div style={{ textAlign: "center", padding: 60, color: "#555" }}>
                  A carregar...
                </div>
              ) : activeList.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#555" }}>
                  {search
                    ? "Nenhum creator encontrado."
                    : crmTab === "novos"
                      ? "Nenhum creator novo. Clica em \"+ Adicionar Creator\" para comecar."
                      : "Nenhum creator em contacto. Cria uma oferta para mover creators para aqui."
                  }
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  {activeList.map((c) => (
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
                        transition: "border-color 0.15s, background 0.15s, transform 0.15s",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#7A0E18";
                        e.currentTarget.style.background = "#181818";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)";
                        e.currentTarget.style.background = "#141414";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#f5f5f5" }}>
                          {c.name || "Unknown"}
                        </h3>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#7A0E18" }}>
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
            </div>
          );
        })()}

        {/* Footer */}
        <div style={{ marginTop: 60, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
          <p style={{ fontSize: 10, color: "#333", margin: 0 }}>Second Layer HQ &middot; Creator CRM</p>
        </div>
      </div>
    </div>
  );
}
