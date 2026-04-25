"use client";

import { useState, useEffect, useCallback } from "react";

const LOGO_B64 = "data:image/png;base64,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";

const AREAS = [
  "DM Writer", "Offer Builder", "Launch Assets", "Pipeline",
  "Creator Profile", "Scraping", "Homepage", "Outro"
];

const PRIORITY_STYLES = {
  low: { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.06)", color: "#666", label: "Low" },
  medium: { bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.2)", color: "#eab308", label: "Medium" },
  high: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", color: "#ef4444", label: "High" },
};

const STATUS_STYLES = {
  new: { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.25)", color: "#3b82f6", label: "New" },
  reviewing: { bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.25)", color: "#eab308", label: "Reviewing" },
  building: { bg: "rgba(122,14,24,0.1)", border: "rgba(122,14,24,0.25)", color: "#7A0E18", label: "Building" },
  done: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", color: "#22c55e", label: "Done" },
  wont_do: { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.06)", color: "#555", label: "Won't Do" },
};

const STATUS_ORDER = ["new", "reviewing", "building", "done", "wont_do"];

const inputStyle = { width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "#f5f5f5", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "vertical" };

export default function SupportPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // list | new | detail
  const [expandedId, setExpandedId] = useState(null);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [filter, setFilter] = useState("all"); // all | new | reviewing | building | done | wont_do
  const [typeFilter, setTypeFilter] = useState("all"); // all | bug | suggestion
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    type: "suggestion",
    area: "DM Writer",
    title: "",
    why: "",
    suggestion: "",
    example: "",
    attachments: "",
    submitter: "",
    priority: "medium",
  });

  const fetchTickets = useCallback(async () => {
    try {
      const r = await fetch("/api/tickets");
      if (r.ok) setTickets(await r.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const submitTicket = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/tickets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (r.ok) {
        setForm({ type: "suggestion", area: "DM Writer", title: "", why: "", suggestion: "", example: "", attachments: "", submitter: form.submitter, priority: "medium" });
        setView("list");
        fetchTickets();
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      const r = await fetch(`/api/tickets/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (r.ok) {
        fetchTickets();
        if (expandedTicket?.id === id) setExpandedTicket({ ...expandedTicket, status: newStatus });
      }
    } catch { /* ignore */ }
  };

  const loadDetail = async (id) => {
    try {
      const r = await fetch(`/api/tickets/${id}`);
      if (r.ok) {
        const t = await r.json();
        setExpandedTicket(t);
        setExpandedId(id);
        setView("detail");
      }
    } catch { /* ignore */ }
  };

  const deleteTicket = async (id) => {
    if (!window.confirm("Eliminar este ticket?")) return;
    try {
      const r = await fetch(`/api/tickets/${id}`, { method: "DELETE" });
      if (r.ok) {
        setView("list");
        setExpandedTicket(null);
        fetchTickets();
      }
    } catch { /* ignore */ }
  };

  const HIDDEN_FROM_ALL = ["done", "wont_do"];
  const filtered = tickets.filter(t => {
    if (filter === "all" && HIDDEN_FROM_ALL.includes(t.status)) return false;
    if (filter !== "all" && t.status !== filter) return false;
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    return true;
  });

  const counts = {
    all: tickets.filter(t => t.status !== "wont_do").length,
    new: tickets.filter(t => t.status === "new").length,
    reviewing: tickets.filter(t => t.status === "reviewing").length,
    building: tickets.filter(t => t.status === "building").length,
    done: tickets.filter(t => t.status === "done").length,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}><img src={LOGO_B64} alt="SL" style={{ height: 16, opacity: 0.85 }} /></a>
          <span style={{ color: "#333", fontSize: 14 }}>|</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888" }}>Feedback & Support</span>
        </div>
        <a href="/" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}>Voltar</a>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* ═══ NEW TICKET FORM ═══ */}
        {view === "new" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Novo Ticket</h1>
              <button onClick={() => setView("list")} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#888", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
            </div>

            {/* Type */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[
                { key: "suggestion", label: "Sugestão" },
                { key: "bug", label: "Bug Report" },
              ].map(t => (
                <button key={t.key} onClick={() => setForm(f => ({ ...f, type: t.key }))}
                  style={{ flex: 1, padding: "14px 16px", borderRadius: 8, border: `1px solid ${form.type === t.key ? "rgba(122,14,24,0.3)" : "rgba(255,255,255,0.06)"}`, background: form.type === t.key ? "rgba(122,14,24,0.08)" : "#141414", color: form.type === t.key ? "#f5f5f5" : "#888", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Row: Area + Priority + Submitter */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Área</label>
                <select style={inputStyle} value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Prioridade</label>
                <select style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>O teu nome</label>
                <input type="text" style={inputStyle} placeholder="Ex: Raul" value={form.submitter} onChange={e => setForm(f => ({ ...f, submitter: e.target.value }))} />
              </div>
            </div>

            {/* 1. What */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {form.type === "bug" ? "O que está partido?" : "O que queres mudar?"} <span style={{ color: "#7A0E18" }}>*</span>
              </label>
              <input type="text" style={inputStyle} placeholder={form.type === "bug" ? "Ex: O DM Writer não gera a segunda DM" : "Ex: Adicionar campo de email ao perfil do criador"} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            {/* 2. Why */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {form.type === "bug" ? "O que deveria acontecer?" : "Porquê?"}
              </label>
              <textarea style={{ ...inputStyle, minHeight: 70 }} placeholder={form.type === "bug" ? "Descreve o comportamento esperado vs. o que acontece" : "Porque é que isto é importante para o workflow?"} value={form.why} onChange={e => setForm(f => ({ ...f, why: e.target.value }))} />
            </div>

            {/* 3. How */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {form.type === "bug" ? "Passos para reproduzir" : "Como farias?"}
              </label>
              <textarea style={{ ...inputStyle, minHeight: 70 }} placeholder={form.type === "bug" ? "1. Abrir o creator X\n2. Clicar em DM Writer\n3. ..." : "Descreve como imaginas que deveria funcionar"} value={form.suggestion} onChange={e => setForm(f => ({ ...f, suggestion: e.target.value }))} />
            </div>

            {/* 4. Example */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {form.type === "bug" ? "Screenshot ou erro" : "Exemplo real ou resultado esperado"}
              </label>
              <textarea style={{ ...inputStyle, minHeight: 70 }} placeholder={form.type === "bug" ? "Cola aqui o erro ou descreve o que vês no ecrã" : "Mostra um exemplo concreto do resultado final que esperas"} value={form.example} onChange={e => setForm(f => ({ ...f, example: e.target.value }))} />
            </div>

            {/* 5. Attachments */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Anexos <span style={{ fontWeight: 400, color: "#333" }}>(links para docs, screenshots, etc.)</span></label>
              <input type="text" style={inputStyle} placeholder="https://drive.google.com/... ou https://notion.so/..." value={form.attachments} onChange={e => setForm(f => ({ ...f, attachments: e.target.value }))} />
            </div>

            <button onClick={submitTicket} disabled={saving || !form.title.trim()}
              style={{ padding: "14px 32px", borderRadius: 8, border: "none", background: form.title.trim() ? "#7A0E18" : "#333", color: form.title.trim() ? "#fff" : "#666", fontSize: 14, fontWeight: 600, cursor: saving ? "wait" : form.title.trim() ? "pointer" : "default", fontFamily: "inherit", width: "100%" }}>
              {saving ? "A enviar..." : "Submeter Ticket"}
            </button>
          </div>
        )}

        {/* ═══ TICKET DETAIL ═══ */}
        {view === "detail" && expandedTicket && (() => {
          const t = expandedTicket;
          const pri = PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium;
          const sts = STATUS_STYLES[t.status] || STATUS_STYLES.new;
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <button onClick={() => { setView("list"); setExpandedTicket(null); }} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#888", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>← Voltar</button>
                <button onClick={() => deleteTicket(t.id)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)", background: "transparent", color: "#ef4444", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Eliminar</button>
              </div>

              {/* Header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.type === "bug" ? "#ef4444" : "#3b82f6", padding: "2px 6px", background: t.type === "bug" ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)", borderRadius: 4, textTransform: "uppercase" }}>{t.type === "bug" ? "Bug" : "Idea"}</span>
                  <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: pri.bg, border: `1px solid ${pri.border}`, color: pri.color, letterSpacing: "0.06em", textTransform: "uppercase" }}>{pri.label}</span>
                  <span style={{ fontSize: 9, color: "#555" }}>{t.area}</span>
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>{t.title}</h1>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#555" }}>
                  <span>{t.submitter || "Anónimo"}</span>
                  <span>·</span>
                  <span>{new Date(t.createdAt).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              </div>

              {/* Status bar */}
              <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
                {STATUS_ORDER.map(s => {
                  const st = STATUS_STYLES[s];
                  const active = t.status === s;
                  return (
                    <button key={s} onClick={() => updateStatus(t.id, s)}
                      style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${active ? st.border : "rgba(255,255,255,0.06)"}`, background: active ? st.bg : "transparent", color: active ? st.color : "#555", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em" }}>
                      {st.label}
                    </button>
                  );
                })}
              </div>

              {/* Content sections */}
              {[
                { label: t.type === "bug" ? "O que deveria acontecer" : "Porquê", value: t.why },
                { label: t.type === "bug" ? "Passos para reproduzir" : "Sugestão de como fazer", value: t.suggestion },
                { label: t.type === "bug" ? "Screenshot / Erro" : "Exemplo / Resultado esperado", value: t.example },
              ].filter(s => s.value).map((s, i) => (
                <div key={i} style={{ marginBottom: 16, padding: "16px 18px", borderRadius: 8, background: "#141414", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>{s.label}</p>
                  <p style={{ fontSize: 13, color: "#ccc", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{s.value}</p>
                </div>
              ))}

              {t.attachments && (
                <div style={{ marginBottom: 16, padding: "12px 18px", borderRadius: 8, background: "#141414", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Anexos</p>
                  <a href={t.attachments} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#3b82f6", wordBreak: "break-all" }}>{t.attachments}</a>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ TICKET LIST ═══ */}
        {view === "list" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Feedback & Support</h1>
              <button onClick={() => setView("new")}
                style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#7A0E18", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                + Novo Ticket
              </button>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 4, marginRight: 12 }}>
                {["all", "suggestion", "bug"].map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${typeFilter === t ? "rgba(122,14,24,0.3)" : "rgba(255,255,255,0.06)"}`, background: typeFilter === t ? "rgba(122,14,24,0.08)" : "transparent", color: typeFilter === t ? "#f5f5f5" : "#555", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {t === "all" ? "Todos" : t === "suggestion" ? "Sugestões" : "Bugs"}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {["all", ...STATUS_ORDER].map(s => {
                  const st = s === "all" ? null : STATUS_STYLES[s];
                  return (
                    <button key={s} onClick={() => setFilter(s)}
                      style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${filter === s ? (st?.border || "rgba(122,14,24,0.3)") : "rgba(255,255,255,0.06)"}`, background: filter === s ? (st?.bg || "rgba(122,14,24,0.08)") : "transparent", color: filter === s ? (st?.color || "#f5f5f5") : "#555", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      {s === "all" ? "All" : st?.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ width: 20, height: 20, margin: "0 auto 12px", border: "2px solid #222", borderTopColor: "#7A0E18", borderRadius: "50%", animation: "sl-spin 0.8s linear infinite" }} />
                <style>{`@keyframes sl-spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>✓</div>
                <p style={{ fontSize: 14, color: "#555", margin: "0 0 4px" }}>Sem tickets</p>
                <p style={{ fontSize: 11, color: "#333" }}>{filter !== "all" || typeFilter !== "all" ? "Nenhum ticket com estes filtros." : "Ninguém reportou nada ainda."}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {filtered.map(t => {
                  const pri = PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium;
                  const sts = STATUS_STYLES[t.status] || STATUS_STYLES.new;
                  return (
                    <div key={t.id} onClick={() => loadDetail(t.id)}
                      style={{ padding: "14px 18px", borderRadius: 8, background: "#141414", border: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "border-color 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: t.type === "bug" ? "#ef4444" : "#3b82f6", padding: "2px 6px", background: t.type === "bug" ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)", borderRadius: 4, textTransform: "uppercase" }}>{t.type === "bug" ? "Bug" : "Idea"}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#f5f5f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "#555" }}>
                            <span>{t.area}</span>
                            <span>·</span>
                            <span>{t.submitter || "Anónimo"}</span>
                            <span>·</span>
                            <span>{new Date(t.createdAt).toLocaleDateString("pt-PT", { day: "numeric", month: "short" })}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 8, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: pri.bg, border: `1px solid ${pri.border}`, color: pri.color, letterSpacing: "0.06em", textTransform: "uppercase" }}>{pri.label}</span>
                          <span style={{ fontSize: 8, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: sts.bg, border: `1px solid ${sts.border}`, color: sts.color, letterSpacing: "0.06em", textTransform: "uppercase" }}>{sts.label}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
