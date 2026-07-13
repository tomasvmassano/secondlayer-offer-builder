"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { STAGES, computeOutreachStage, groupByStage, stagePatch, stageStaleness } from "../lib/outreachStages";
import FollowUpTray from "../components/FollowUpTray";

const LOGO_B64 = "data:image/png;base64,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";

function formatFollowers(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

// Deal value → "€1.500" (pt-PT thousands). Returns "" for null/0 so callers
// can skip rendering the chip entirely when no value is set.
function formatEurValue(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "";
  return "€" + v.toLocaleString("pt-PT");
}

// Compare two timestamps, return the newer one (or null when both falsy).
// Used by mergeCreatorLists to detect locally-applied optimistic edits.
function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() > new Date(b).getTime() ? a : b;
}

// Smart merge for silent polls. The page state may have OPTIMISTIC edits
// (a drag just landed, we patched local state, the PATCH is still in flight
// and the server hasn't seen it yet on the next poll). A naive
// `setCreators(serverList)` would clobber those edits and the card would
// snap back to its old column for one render cycle.
//
// Heuristic: if any tracked timestamp on the LOCAL copy is newer than the
// server copy, the local copy has unsynced edits — keep it. Otherwise
// take the server copy.
function mergeCreatorLists(local, server) {
  if (!Array.isArray(local) || local.length === 0) return server;
  const byId = new Map(local.map(c => [c.id, c]));
  return server.map(s => {
    const l = byId.get(s.id);
    if (!l) return s;
    // Look at the latest "edit signal" on each side. If local is newer,
    // it has unsynced optimistic state — keep it.
    const lLatest = newer(newer(newer(l.dmSentAt, l.repliedAt), newer(l.loomSentAt, l.callBookedAt)), l.pitchSentAt);
    const sLatest = newer(newer(newer(s.dmSentAt, s.repliedAt), newer(s.loomSentAt, s.callBookedAt)), s.pitchSentAt);
    if (lLatest && (!sLatest || new Date(lLatest).getTime() > new Date(sLatest).getTime())) return l;
    return s;
  });
}

export default function CreatorsPage() {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  // Holds the actual server error message ("ERR max requests limit
  // exceeded...", "Redis not configured", etc.) so the UI can surface it
  // instead of silently rendering an empty Kanban that looks like the
  // CRM lost all its data.
  const [fetchError, setFetchError] = useState(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addInstagramUrl, setAddInstagramUrl] = useState("");
  const [addTiktokUrl, setAddTiktokUrl] = useState("");
  const [addYoutubeUrl, setAddYoutubeUrl] = useState("");
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  // Default tab moved from "novos" → "por-contactar" so the no-DM-sent
  // pile is what loads first. Legacy "novos" still routes to the same
  // list via the filter logic below.
  const [crmTab, setCrmTab] = useState("por-contactar");
  // CRM is Kanban-only. The legacy tabbed list view was removed once the
  // operator confirmed Kanban as the primary surface. crmTab still drives
  // the Discovery tab (which sits outside the Kanban as a separate mode).
  const crmView = 'kanban';
  // Filters — persisted to localStorage so they survive a reload.
  // addedBy: null | "Tomás" | "Raúl" | etc.  (string match against summary.addedByFirstName)
  // dealScore: null | "A" | "B" | "C" | "D"
  // hasAudit: null | true | false
  const [filters, setFilters] = useState({ addedBy: null, dealScore: null, hasAudit: null });
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sl_crm_filters_v1') || 'null');
      if (stored && typeof stored === 'object') setFilters(f => ({ ...f, ...stored }));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('sl_crm_filters_v1', JSON.stringify(filters)); } catch {}
  }, [filters]);
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

  const fetchCreators = useCallback(async (q, opts = {}) => {
    try {
      // Load ALL creators (no status filter). The previous `?status=prospect`
      // excluded cold creators entirely — they never reached the page, which
      // looked like the Frio column was auto-deleting them. Cold leads now
      // load and land in the Frio column via groupByStage. Signed creators
      // also load, but the Kanban filters them out client-side (they belong
      // to the Delivery page).
      const url = q ? `/api/creators?q=${encodeURIComponent(q)}` : "/api/creators";
      const res = await fetch(url);
      const data = await res.json();
      // Surface server-side errors loudly instead of silently rendering an
      // empty board. The previous `data.creators || []` fallback made an
      // Upstash quota outage look identical to "no creators", which led to
      // a panicked "all my data is gone!" — when in fact the data is fine,
      // just temporarily unreachable.
      if (!res.ok || data.error) {
        if (!opts.silent) {
          setFetchError(data.error || `HTTP ${res.status}`);
          setCreators([]);
        }
        return;
      }
      if (!opts.silent) setFetchError(null);
      // Silent polls preserve any locally-applied optimistic edits — if the
      // server hasn't caught up yet, don't blow away the operator's
      // just-completed drag move.
      if (opts.silent) {
        setCreators(prev => mergeCreatorLists(prev, data.creators || []));
      } else {
        setCreators(data.creators || []);
      }
    } catch (e) {
      if (!opts.silent) {
        setFetchError(e?.message || 'Falha de rede');
        setCreators([]);
      }
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  // Real-time sync via polling. Every 10 seconds we silently refetch the
  // creators list so teammate changes (DM sent, replied, stage moved, etc.)
  // appear without anyone hitting reload. Paused during drag so a poll
  // doesn't overwrite the optimistic state mid-move. Also paused when the
  // tab is hidden to save Vercel function invocations.
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  // Quick-view modal — holds the summary of the card being previewed (or null
  // when closed). Opened by a plain click on a Kanban card; shows notas +
  // valor + link do Loom without loading the full profile page.
  const [quickView, setQuickView] = useState(null);
  const [syncTick, setSyncTick] = useState(0); // increments after every silent poll for the live pill animation
  useEffect(() => {
    let intervalId = null;
    const tick = () => {
      if (isDraggingRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchCreators(search, { silent: true });
      setSyncTick(t => t + 1);
    };
    // Was 10s — dropped to 60s (2026-06-18) to stay under the Upstash
    // 500K/day cap. Each tick triggers a creators-index zrange + summary
    // reads; at 10s × 3 operators that was ~25K reads/day from idle tabs
    // alone. 60s keeps the "feels live" UX (teammates' drags still show
    // up within a minute) at 6× lower cost.
    intervalId = setInterval(tick, 60_000);
    return () => clearInterval(intervalId);
  }, [search, fetchCreators]);

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
      // Server-side duplicate: same IG handle is already in the CRM. Don't pretend
      // we saved — tell the operator and offer a jump-link so they can find the
      // existing creator (often hidden in a tab like "Frio" they weren't viewing).
      if (data.duplicate && data.id) {
        const existingName = data.creator?.name || "este creator";
        const existingStatus = data.creator?.pipelineStatus || "prospect";
        const goNow = window.confirm(
          `${existingName} já está no CRM (status: ${existingStatus}).\n\nQueres abrir a página dele agora?`
        );
        if (goNow) { window.location.href = `/creators/${data.id}`; return; }
        setAddError(`Já existe — ${existingName} (status ${existingStatus})`);
        setAdding(false);
        return;
      }
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
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", boxSizing: "border-box", width: "100%" }}>
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

      {/* Full-width page so the Kanban can use every column the viewport
          gives it. Sections that want a narrower reading width (forms,
          discovery view) constrain themselves with their own max-width.
          box-sizing ensures the 24px side padding doesn't push the wrapper
          past 100% viewport width and overflow the header. */}
      <div className="sl-page" style={{ width: "100%", maxWidth: "100%", padding: "40px 24px 80px", boxSizing: "border-box" }}>
        {/* Title */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 className="sl-h1" style={{ fontSize: 28, fontWeight: 600, margin: 0, letterSpacing: "-0.02em" }}>
              Creators
            </h1>
            {/* Live-sync pill — visible signal that the page is polling
                teammate changes every 10s. Pulses on every successful poll
                (syncTick increments). Pauses during drag so the operator
                knows their move won't be clobbered. */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: isDragging ? "rgba(234,179,8,0.1)" : "rgba(34,197,94,0.08)", border: `1px solid ${isDragging ? "rgba(234,179,8,0.25)" : "rgba(34,197,94,0.2)"}` }} title={isDragging ? "Sync pausado durante drag" : `A sincronizar a cada 10s · última: ${syncTick > 0 ? `${syncTick} polls` : 'em breve'}`}>
              <span key={syncTick} className="sl-live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: isDragging ? "#eab308" : "#22c55e" }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isDragging ? "#eab308" : "#22c55e" }}>
                {isDragging ? "Drag" : "Live"}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#888", margin: "6px 0 0" }}>
            Base de dados de todos os criadores. Perfil, pesquisa, notas de reuniao e ferramentas.
          </p>
          <style>{`
            @keyframes sl-live-pulse {
              0% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.6); opacity: 0.4; }
              100% { transform: scale(1); opacity: 1; }
            }
            .sl-live-dot { animation: sl-live-pulse 0.6s ease-out; }
          `}</style>
        </div>

        {/* Search + Add */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
          <input
            type="text"
            placeholder="Pesquisar por nome ou nicho..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: "1 1 200px",
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
          <a
            href="/creators/import"
            title="Importa uma lista de creators a partir de um CSV (Name, Instagram, TikTok, YouTube). Lean scrape sequencial com filtro de Deal Score."
            style={{
              padding: "14px 18px",
              background: "transparent",
              border: "1px solid rgba(177,30,47,0.4)",
              borderRadius: 10,
              color: "#B11E2F",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ↑ Bulk Import
          </a>
          <a
            href="/creators/audit-queue"
            title="Corre ecosystem audit em creators já no CRM que ainda não foram auditados. Worker paced para respeitar o limite Anthropic."
            style={{
              padding: "14px 18px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              color: "#888",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ⚙ Bulk Audit
          </a>
        </div>

        {/* Visible error banner. Surfaces server-side failures (Upstash
            quota exhaustion, Redis unconfigured, etc.) so an empty
            Kanban doesn't look like the CRM lost everyone's data. */}
        {fetchError && (
          <div style={{
            margin: "0 0 20px",
            padding: "14px 18px",
            background: "rgba(122,14,24,0.10)",
            border: "1px solid rgba(122,14,24,0.35)",
            borderRadius: 10,
            color: "#f5b3b8",
            fontSize: 13,
            lineHeight: 1.55,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#ef4444", marginBottom: 6 }}>
              Dados temporariamente indisponíveis
            </div>
            <div style={{ color: "#ddd", marginBottom: 6 }}>
              {/[Mm]ax requests limit/i.test(fetchError)
                ? "Atingimos o limite diário de leituras do Upstash Redis (500K/dia). Os teus dados ESTÃO no Redis — só não podem ser lidos até ao reset, à meia-noite UTC. Volta amanhã ou faz upgrade do plano no dashboard do Upstash."
                : "O servidor devolveu um erro a tentar ler os criadores. Os dados estão no Redis; quando a leitura voltar a passar, a página enche outra vez."}
            </div>
            <div style={{ fontSize: 11, color: "#888", fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>
              {fetchError}
            </div>
            <button
              type="button"
              onClick={() => fetchCreators(search)}
              style={{
                marginTop: 10, padding: "6px 14px", borderRadius: 6,
                border: "1px solid rgba(239,68,68,0.4)", background: "transparent",
                color: "#ef4444", fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

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

        {/* Tabs.
            "Por contactar" = active prospect, no DM sent yet — the "to-do" pile.
            "Em outreach"   = DM sent, no reply yet — waiting on the creator.
            "Em contacto"   = creator replied to outreach — outreach.repliedAt
                              is set. This is the engaged-conversation tab.
            "Frio"          = pipelineStatus === 'cold' — set by the
                              dm-reminders cron after 21 days, or manually
                              via the "Marcar frio" button.
            "Discovery"     = candidates from the discovery queue (not yet
                              added to the CRM). */}
        {(() => {
          const isFrio = (c) => c.pipelineStatus === 'cold';
          const isSigned = (c) => c.pipelineStatus === 'signed';
          const isActive = (c) => !isFrio(c) && !isSigned(c);
          // Apply filters BEFORE tab classification so counts reflect what
          // the operator will actually see. Empty filter = no constraint.
          const matchesFilters = (c) => {
            if (filters.addedBy && c.addedByFirstName !== filters.addedBy) return false;
            if (filters.dealScore && c.dealScoreGrade !== filters.dealScore) return false;
            if (filters.hasAudit === true && !c.hasAudit) return false;
            if (filters.hasAudit === false && c.hasAudit) return false;
            return true;
          };
          const filtered = creators.filter(matchesFilters);
          const warm = filtered.filter(c => isActive(c) && c.repliedAt);
          // Em outreach = at least one channel sent (DM or Email) and no
          // reply yet. Email-only outreach now counts the same as DM-only.
          const outreach = filtered.filter(c => isActive(c) && !c.repliedAt && (c.dmSentAt || c.emailSentAt));
          const porContactar = filtered.filter(c => isActive(c) && !c.repliedAt && !c.dmSentAt && !c.emailSentAt);
          const frio = filtered.filter(isFrio);
          const activeList = crmTab === "por-contactar" ? porContactar
            : crmTab === "novos" ? porContactar // legacy alias
            : crmTab === "outreach" ? outreach
            : crmTab === "contacto" ? warm
            : crmTab === "frio" ? frio
            : [];

          // Unique operator names for the filter dropdown — derived from
          // the actual data so the dropdown reflects who has actually
          // added creators (no hardcoded list to maintain).
          const operatorOptions = Array.from(new Set(
            creators.map(c => c.addedByFirstName).filter(Boolean)
          )).sort();
          const filterCount = (filters.addedBy ? 1 : 0) + (filters.dealScore ? 1 : 0) + (filters.hasAudit !== null ? 1 : 0);

          return (
            <div>
              {/* Filter chips row — sits above the tab bar so it applies to ALL tabs. */}
              {creators.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 0" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#555", letterSpacing: "0.10em", textTransform: "uppercase", marginRight: 4 }}>Filtros</span>

                  {/* Adicionado por */}
                  <FilterDropdown
                    label="Adicionado por"
                    value={filters.addedBy}
                    options={operatorOptions.map(o => ({ value: o, label: o }))}
                    onChange={(v) => setFilters(f => ({ ...f, addedBy: v }))}
                  />

                  {/* Deal Score */}
                  <FilterDropdown
                    label="Deal Score"
                    value={filters.dealScore}
                    options={[
                      { value: 'A', label: 'A' },
                      { value: 'B', label: 'B' },
                      { value: 'C', label: 'C' },
                      { value: 'D', label: 'D' },
                    ]}
                    onChange={(v) => setFilters(f => ({ ...f, dealScore: v }))}
                  />

                  {/* Audit */}
                  <FilterDropdown
                    label="Audit"
                    value={filters.hasAudit === true ? 'yes' : filters.hasAudit === false ? 'no' : null}
                    options={[
                      { value: 'yes', label: '✓ tem audit' },
                      { value: 'no',  label: '✗ sem audit' },
                    ]}
                    onChange={(v) => setFilters(f => ({ ...f, hasAudit: v === 'yes' ? true : v === 'no' ? false : null }))}
                  />

                  {filterCount > 0 && (
                    <button
                      onClick={() => setFilters({ addedBy: null, dealScore: null, hasAudit: null })}
                      style={{ padding: "5px 11px", borderRadius: 4, background: "transparent", border: "1px solid rgba(177,30,47,0.3)", color: "#B11E2F", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Limpar ({filterCount})
                    </button>
                  )}
                </div>
              )}

              {/* Single mode toggle — Pipeline (Kanban) vs Discovery queue.
                  The old per-stage tab strip is gone: stages are now columns
                  of the Kanban, so tabs would be redundant. */}
              <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
                {[
                  { key: 'pipeline',  label: 'Pipeline',  count: filtered.filter(c => c.pipelineStatus !== 'signed').length },
                  { key: 'discovery', label: 'Discovery', count: discoveryQueue.length },
                ].map(m => {
                  const isActive = (m.key === 'discovery' && crmTab === 'discovery')
                    || (m.key === 'pipeline'  && crmTab !== 'discovery');
                  return (
                    <button
                      key={m.key}
                      onClick={() => setCrmTab(m.key === 'discovery' ? 'discovery' : 'por-contactar')}
                      style={{
                        padding: "8px 16px",
                        background: isActive ? "rgba(122,14,24,0.18)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isActive ? "rgba(122,14,24,0.45)" : "rgba(255,255,255,0.06)"}`,
                        borderRadius: 6,
                        color: isActive ? "#f5f5f5" : "#666",
                        fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                        cursor: "pointer", fontFamily: "inherit",
                        display: "flex", alignItems: "center", gap: 8,
                      }}
                    >
                      {m.label}
                      <span style={{ fontSize: 11, color: isActive ? "#888" : "#444", fontWeight: 700 }}>{m.count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Discovery Tab */}
              {crmTab === "discovery" ? (
                <div>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                        Creators similares descobertos automaticamente a partir dos teus creators existentes. Apenas A/B tier.
                      </p>
                      {discoveryStatus && (
                        <p style={{ fontSize: 11, color: discoveryStatus.startsWith("Erro") ? "#ef4444" : "#22c55e", margin: "6px 0 0" }}>{discoveryStatus}</p>
                      )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
                    <div className="sl-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
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
              ) : (
                <>
                  <CrmKanban
                    creators={filtered.filter(c => c.pipelineStatus !== 'signed')}
                    setCreators={setCreators}
                    onDragChange={setIsDragging}
                    onQuickView={setQuickView}
                  />
                  {/* Floating follow-up tray — bottom-right, Kanban only.
                      Calls fetchCreators after each click so the card
                      animates to its new column without waiting for the
                      next 10s poll. */}
                  <FollowUpTray onAfterCopy={() => fetchCreators(search, { silent: true })} />
                </>
              )}
            </div>
          );
        })()}

        {/* Footer */}
        <div style={{ marginTop: 60, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
          <p style={{ fontSize: 10, color: "#333", margin: 0 }}>Second Layer HQ &middot; Creator CRM</p>
        </div>
      </div>

      {/* Quick-view modal — GHL-style. Centralises notas + valor + link do
          Loom so a DM-sender sees the essentials (and copies the Loom)
          before opening the full profile. Optimistically writes the card's
          summary fields back on save so the chip/indicators update at once. */}
      {quickView && (
        <QuickViewModal
          summary={quickView}
          onClose={() => setQuickView(null)}
          onSaved={(fields) => {
            setCreators(prev => prev.map(c => c.id === quickView.id ? {
              ...c,
              dealValue: fields.dealValue ?? null,
              hasLoom:  !!(fields.loomUrl && String(fields.loomUrl).trim()),
              hasNotes: !!(fields.notes && String(fields.notes).trim()),
            } : c));
          }}
        />
      )}
    </div>
  );
}

// Filter dropdown chip — single-select. Native <select> for now to keep
// the keyboard / touch behaviour predictable across desktop + mobile.
// Active state (non-null value) gets the brand-red tint so it's obvious
// what's filtering the list. Clearing routes through the same dropdown
// via the "Todos" sentinel option (value="").
function FilterDropdown({ label, value, options, onChange }) {
  const active = value !== null && value !== '';
  return (
    <label style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 4px 4px 10px",
      borderRadius: 4,
      border: `1px solid ${active ? "rgba(177,30,47,0.4)" : "rgba(255,255,255,0.08)"}`,
      background: active ? "rgba(177,30,47,0.06)" : "transparent",
      fontSize: 11, fontFamily: "inherit",
      cursor: "pointer",
    }}>
      <span style={{ fontSize: 10, color: active ? "#B11E2F" : "#666", fontWeight: 600 }}>{label}:</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        style={{
          background: "transparent", border: "none", outline: "none",
          color: active ? "#f5f5f5" : "#888",
          fontSize: 11, fontWeight: 600, fontFamily: "inherit",
          padding: "2px 4px", cursor: "pointer",
          appearance: "none", WebkitAppearance: "none",
        }}
      >
        <option value="" style={{ background: "#141414" }}>Todos</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value} style={{ background: "#141414" }}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────
// CrmKanban — 8-column drag-and-drop board for the outreach pipeline.
// Stages: Por contactar → Em outreach → Contacto feito → Pediu Loom →
//         Loom enviado → Reunião marcada → Apresentação enviada → Frio
//
// Cards are draggable (HTML5 native). Dropping on a column patches the
// creator with the field-set that produces that stage (stagePatch helper).
// Cards ALSO auto-move when the operator does the work elsewhere — e.g.
// recording a Loom on the creator detail page sets loomSentAt, and the
// card automatically re-classifies on next render.
// ─────────────────────────────────────────────────────────────────
function CrmKanban({ creators, setCreators, onDragChange, onQuickView }) {
  const grouped = useMemo(() => groupByStage(creators), [creators]);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const onDragStart = (id) => (e) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch {}
    if (onDragChange) onDragChange(true);
    console.log('[kanban] dragstart', id);
  };
  const onDragEnd = () => {
    setDragId(null); setDragOver(null);
    if (onDragChange) onDragChange(false);
  };
  const onDragOverCol = (key) => (e) => {
    e.preventDefault();
    // Setting dropEffect on the dragover event is what tells the browser
    // "this is a valid drop target". Without it, some browsers fall back
    // to dropEffect='none' which silently rejects the drop without
    // firing onDrop. That was making backward drags appear to do nothing.
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    setDragOver(key);
  };
  const onDropCol = (stageKey) => async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const id = dragId || (e.dataTransfer?.getData('text/plain') || '');
    setDragOver(null); setDragId(null);
    if (onDragChange) onDragChange(false);
    if (!id) { console.warn('[kanban] drop without id'); return; }
    const creator = creators.find(c => c.id === id);
    if (!creator) { console.warn('[kanban] drop on unknown creator', id); return; }
    const fromStage = computeOutreachStage(creator);
    if (fromStage === stageKey) { console.log('[kanban] drop same column, no-op', stageKey); return; }
    console.log('[kanban] drop', { id, from: fromStage, to: stageKey });
    const patch = stagePatch(creator, stageKey);
    if (!patch) { console.warn('[kanban] no patch for', stageKey); return; }
    console.log('[kanban] patch', patch);
    // Optimistic — update local state immediately so the card snaps to
    // the new column without waiting for the network round-trip.
    //
    // CRITICAL: stagePatch returns `null` for fields to CLEAR (backward
    // moves). The previous `??` operator treated null as "no value" and
    // kept the old timestamp, so backward drags appeared to do nothing.
    // We now use explicit "in" checks so null is honored as a real value.
    setCreators(prev => prev.map(c => {
      if (c.id !== id) return c;
      const o = patch.outreach || {};
      const p = patch.pitch || {};
      const updated = { ...c };
      if ('pipelineStatus' in patch) updated.pipelineStatus = patch.pipelineStatus;
      // Flatten outreach fields onto the summary's top level. Any key
      // present in patch.outreach gets applied (null included → clears).
      for (const k of ['dmSentAt', 'emailSentAt', 'repliedAt', 'repliedChannel',
                       'loomRequestedAt', 'proposalReadyAt', 'loomSentAt',
                       'callBookedAt', 'callAgreedAt', 'callHeldAt',
                       'notInterestedAt']) {
        if (k in o) updated[k] = o[k];
      }
      // Mirror onto a nested outreach object too so any consumer reading
      // the canonical shape sees the same data.
      updated.outreach = { ...(c.outreach || {}), ...o };
      // Pitch is its own block: only sentAt is exposed on the summary as
      // pitchSentAt, but we also mirror the full pitch object.
      if ('sentAt' in p) updated.pitchSentAt = p.sentAt;
      updated.pitch = { ...(c.pitch || {}), ...p };
      return updated;
    }));
    try {
      await fetch(`/api/creators/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch {}
  };

  return (
    <>
    {/* Thin dark scrollbar for the per-column overflow. The default browser
        scrollbar is too chunky on Windows / fights the dark theme on Mac.
        Per-column scrolling so an operator hunting for a creator at the
        bottom of a 40-card "Em outreach" column doesn't have to scroll
        the whole page. */}
    <style>{`
      .sl-kanban-col::-webkit-scrollbar { width: 6px; }
      .sl-kanban-col::-webkit-scrollbar-track { background: transparent; }
      .sl-kanban-col::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.08);
        border-radius: 3px;
      }
      .sl-kanban-col::-webkit-scrollbar-thumb:hover {
        background: rgba(122,14,24,0.4);
      }
      .sl-kanban-col { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }
    `}</style>
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 12, marginBottom: 32, width: "100%", maxWidth: "100%" }}>
      {STAGES.map(stage => {
        const items = grouped[stage.key] || [];
        const isDropTarget = dragOver === stage.key;
        return (
          <div
            key={stage.key}
            onDragOver={onDragOverCol(stage.key)}
            onDragLeave={() => setDragOver(o => o === stage.key ? null : o)}
            onDrop={onDropCol(stage.key)}
            style={{
              minWidth: 240, width: 240, flexShrink: 0,
              background: isDropTarget ? "rgba(122,14,24,0.08)" : "transparent",
              border: isDropTarget ? "1px dashed rgba(122,14,24,0.4)" : "1px dashed transparent",
              borderRadius: 8, padding: 4, transition: "background 0.1s, border-color 0.1s",
              // Column wraps a sticky-style header + scrollable body. The
              // total column height is capped so a creator at the bottom
              // of a long column can be reached by scrolling the column
              // alone, without scrolling the whole page.
              display: "flex", flexDirection: "column",
              maxHeight: "calc(100vh - 260px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px 8px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: stage.accent }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: "#f5f5f5", letterSpacing: "0.08em", textTransform: "uppercase" }}>{stage.label}</span>
              </div>
              <span style={{ fontSize: 11, color: "#555", fontWeight: 600 }}>{items.length}</span>
            </div>
            <div
              className="sl-kanban-col"
              style={{
                display: "flex", flexDirection: "column", gap: 8, minHeight: 60,
                // Inner card list scrolls vertically within the capped
                // column height. Tiny native scrollbar is hidden / restyled
                // via the .sl-kanban-col rule below.
                flex: 1, overflowY: "auto", overflowX: "hidden",
                paddingRight: 2,
              }}
            >
              {items.length === 0 ? (
                <div style={{ padding: "20px 10px", fontSize: 10, color: "#333", textAlign: "center", background: "rgba(255,255,255,0.01)", border: "1px dashed rgba(255,255,255,0.04)", borderRadius: 6 }}>
                  {stage.description}
                </div>
              ) : items.map(c => (
                <KanbanCard
                  key={c.id}
                  creator={c}
                  isDragging={dragId === c.id}
                  onDragStart={onDragStart(c.id)}
                  onDragEnd={onDragEnd}
                  onQuickView={onQuickView}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

// CrmKanban card — same visual shape as the list view's card (name +
// followers, niche, platform chip + date) but compact + draggable.
function KanbanCard({ creator, isDragging, onDragStart, onDragEnd, onQuickView }) {
  const stale = stageStaleness(creator);
  const ageColor = stale.level === 'cold' ? '#7A0E18' : stale.level === 'warn' ? '#eab308' : '#444';
  const ageBg    = stale.level === 'cold' ? 'rgba(122,14,24,0.15)' : stale.level === 'warn' ? 'rgba(234,179,8,0.1)' : 'rgba(255,255,255,0.03)';
  const valueLabel = formatEurValue(creator.dealValue);
  return (
    <a
      href={`/creators/${creator.id}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        // Cmd / Ctrl / middle-click keeps the native "open full profile in a
        // new tab". A plain left-click opens the quick-view modal (notas +
        // valor + link do Loom) so the operator sees the essentials — and
        // grabs the Loom — before loading the heavy profile page.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        onQuickView?.(creator);
      }}
      style={{
        display: "block", padding: "12px 14px", background: "#141414",
        border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8,
        textDecoration: "none", color: "inherit",
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.4 : 1,
        transition: "border-color 0.15s, transform 0.1s, opacity 0.1s",
      }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.borderColor = "rgba(122,14,24,0.4)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "#f5f5f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, paddingRight: 8 }}>
          {creator.name || "Unknown"}
        </h3>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#7A0E18", flexShrink: 0 }}>
          {formatFollowers(creator.followers)}
        </span>
      </div>
      {creator.niche && (
        <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{creator.niche}</p>
      )}
      {/* Quick-view signals — deal value + loom/notes flags. Only rendered
          when there's something to show, so untouched cards stay clean. */}
      {(valueLabel || creator.hasLoom || creator.hasNotes) && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
          {valueLabel && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", padding: "2px 7px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.22)", borderRadius: 5, fontFamily: "ui-monospace, monospace" }}>
              {valueLabel}
            </span>
          )}
          {creator.hasLoom && (
            <span title="Loom disponível" style={{ fontSize: 9, fontWeight: 700, color: "#f5f5f5", padding: "2px 6px", background: "rgba(122,14,24,0.22)", border: "1px solid rgba(122,14,24,0.45)", borderRadius: 5, letterSpacing: "0.05em" }}>
              LOOM
            </span>
          )}
          {creator.hasNotes && (
            <span title="Tem notas" style={{ fontSize: 9, fontWeight: 600, color: "#999", padding: "2px 6px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 5 }}>
              Nota
            </span>
          )}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <span style={{
          fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
          color: "#555", padding: "2px 7px", background: "rgba(255,255,255,0.03)", borderRadius: 5,
        }}>{creator.primaryPlatform || "Instagram"}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {stale.days >= 0 && (
            <span style={{ fontSize: 9, fontWeight: 700, color: ageColor, padding: "2px 6px", borderRadius: 3, background: ageBg, fontFamily: "ui-monospace, monospace" }}>
              {stale.days}d
            </span>
          )}
          <span style={{ fontSize: 10, color: "#555" }}>
            {creator.createdAt ? new Date(creator.createdAt).toLocaleDateString("pt-PT", { day: '2-digit', month: '2-digit' }) : ""}
          </span>
        </div>
      </div>
    </a>
  );
}

// Shared field styles for the quick-view modal. Declared before the
// component so there's no use-before-define lint noise (they're only read
// at render time regardless).
const qvLabel = { display: 'block', fontSize: 10, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 };
const qvInput = { width: '100%', padding: '10px 12px', background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#f5f5f5', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const qvMiniBtn = { padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#ccc', fontSize: 11, fontWeight: 600, cursor: 'pointer' };

// ─────────────────────────────────────────────────────────────────
// QuickViewModal — GHL-style quick view opened by a plain click on a
// Kanban card. Centralises the three things a DM-sender needs before
// loading the heavy profile page: the deal value (por quanto vamos
// fechar), the Loom link (so they stop hopping across Loom/Drive/Slack
// to find it), and free-text notes. The card summary only carries the
// dealValue + hasLoom/hasNotes flags, so we fetch the full record on
// open to get the notes text + actual Loom URL, edit inline, and PATCH
// on save. onSaved writes the summary fields back so the card's chip +
// indicators update immediately without a refetch.
// ─────────────────────────────────────────────────────────────────
function QuickViewModal({ summary, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [loomUrl, setLoomUrl] = useState("");

  // Load the full record on open.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`/api/creators/${summary.id}`);
        const text = await res.text();               // text-first: Vercel 504s return HTML, not JSON
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (!alive) return;
        setNotes(data.notes || "");
        setDealValue(data.dealValue != null ? String(data.dealValue) : "");
        setLoomUrl(data.loomUrl || "");
      } catch (e) {
        if (alive) setError(e.message || "Falha a carregar o criador");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [summary.id]);

  // Esc closes.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    // Parse the value leniently: "1.500" / "€1500" / "1 500" all land as 1500
    // (pt-PT uses "." for thousands). Empty → null, which clears the value.
    const digits = String(dealValue).replace(/[^\d]/g, '');
    const parsedValue = digits ? Number(digits) : null;
    const payload = { notes, dealValue: parsedValue, loomUrl: loomUrl.trim() };
    try {
      const res = await fetch(`/api/creators/${summary.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSaved(true);
      onSaved?.(payload);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e.message || 'Falha a guardar');
    } finally {
      setSaving(false);
    }
  };

  const loomValid = /^https?:\/\//i.test(loomUrl.trim());
  const copyLoom = async () => {
    try { await navigator.clipboard.writeText(loomUrl.trim()); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#f5f5f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.name || 'Criador'}</h2>
            <div style={{ fontSize: 11, color: '#666', marginTop: 3 }}>{summary.niche || '—'}{summary.followers ? ` · ${formatFollowers(summary.followers)}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ flexShrink: 0, background: 'transparent', border: 'none', color: '#777', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 0 }} aria-label="Fechar">×</button>
        </div>

        {loading ? (
          <div style={{ padding: 44, textAlign: 'center', color: '#555', fontSize: 12 }}>A carregar…</div>
        ) : (
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Valor a fechar */}
            <div>
              <label style={qvLabel}>Valor a fechar</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>€</span>
                <input
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  inputMode="numeric"
                  placeholder="Ex: 1500"
                  style={{ ...qvInput, fontFamily: 'ui-monospace, monospace', fontSize: 16 }}
                />
              </div>
            </div>

            {/* Link do Loom */}
            <div>
              <label style={qvLabel}>Link do Loom</label>
              <input
                value={loomUrl}
                onChange={(e) => setLoomUrl(e.target.value)}
                placeholder="https://www.loom.com/share/…"
                style={qvInput}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <a
                  href={loomValid ? loomUrl.trim() : undefined}
                  target="_blank" rel="noopener noreferrer"
                  onClick={(e) => { if (!loomValid) e.preventDefault(); }}
                  style={{ ...qvMiniBtn, textDecoration: 'none', color: '#f5f5f5', background: 'rgba(122,14,24,0.25)', border: '1px solid rgba(122,14,24,0.5)', opacity: loomValid ? 1 : 0.4, pointerEvents: loomValid ? 'auto' : 'none' }}
                >
                  Abrir Loom
                </a>
                <button onClick={copyLoom} disabled={!loomValid} style={{ ...qvMiniBtn, opacity: loomValid ? 1 : 0.4, cursor: loomValid ? 'pointer' : 'not-allowed' }}>
                  {copied ? 'Copiado ✓' : 'Copiar link'}
                </button>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label style={qvLabel}>Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contexto, objeções, próximos passos…"
                rows={5}
                style={{ ...qvInput, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
              />
            </div>

            {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <a href={`/creators/${summary.id}`} style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}>Abrir perfil completo →</a>
            <button
              onClick={save}
              disabled={saving}
              style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: saved ? '#22c55e' : '#7A0E18', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', transition: 'background 0.15s' }}
            >
              {saving ? 'A guardar…' : saved ? 'Guardado ✓' : 'Guardar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
