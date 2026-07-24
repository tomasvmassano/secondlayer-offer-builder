"use client";

import { useEffect, useState, useCallback } from "react";

// ── tokens (match the dark hub aesthetic) ──
const BG = "#0a0a0a", SURFACE = "#141414", BORDER = "rgba(255,255,255,0.06)";
const HI = "#f5f5f5", MID = "#aaa", LO = "#666", DIM = "#444";
const ACCENT = "#B11E2F", GREEN = "#22c55e", AMBER = "#eab308", RED = "#ef4444";
const mono = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };

const TABS = [
  { key: "saude", label: "Saúde" },
  { key: "automacoes", label: "Automações" },
  { key: "equipa", label: "Equipa" },
  { key: "config", label: "Config & Dados" },
];

const usd = (n) => "$" + (Number(n) || 0).toFixed(2);
const ago = (iso) => {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)}m`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)}d`;
};

export default function AdminPage() {
  const [tab, setTab] = useState("saude");
  const [ov, setOv] = useState(null);
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState("");

  const loadOverview = useCallback(async () => {
    setErr("");
    const r = await fetch("/api/admin/overview");
    if (!r.ok) { setErr(r.status === 401 ? "Não autenticado." : "Erro a carregar."); return; }
    setOv(await r.json());
  }, []);
  useEffect(() => { loadOverview(); }, [loadOverview]);

  const toast = (m) => { setFlash(m); setTimeout(() => setFlash(""), 3000); };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: HI, fontFamily: "'Geist','Helvetica Neue',Helvetica,Arial,sans-serif", padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <a href="/" style={{ fontSize: 11, color: LO, textDecoration: "none", letterSpacing: "0.12em", textTransform: "uppercase" }}>← Hub</a>
          <button onClick={loadOverview} style={{ ...btnGhost }}>↻ Atualizar</button>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Admin</h1>
        <p style={{ fontSize: 13, color: LO, margin: "0 0 24px" }}>Centro de controlo da infraestrutura · só para a equipa.</p>

        {err && <div style={{ fontSize: 12, color: RED, marginBottom: 16 }}>{err}</div>}
        {flash && <div style={{ fontSize: 12, color: GREEN, marginBottom: 16 }}>{flash}</div>}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${BORDER}`, marginBottom: 24, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "10px 16px", background: "transparent", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              color: tab === t.key ? HI : DIM,
              borderBottom: tab === t.key ? `2px solid ${ACCENT}` : "2px solid transparent",
            }}>{t.label}</button>
          ))}
        </div>

        {!ov && !err && <div style={{ color: LO, fontSize: 13 }}>A carregar…</div>}
        {ov && tab === "saude" && <SaudePanel ov={ov} />}
        {ov && tab === "automacoes" && <AutomacoesPanel ov={ov} reload={loadOverview} toast={toast} />}
        {ov && tab === "equipa" && <EquipaPanel toast={toast} />}
        {ov && tab === "config" && <ConfigPanel ov={ov} reload={loadOverview} toast={toast} />}
      </div>
    </div>
  );
}

// ───────────────────────── SAÚDE ─────────────────────────
function SaudePanel({ ov }) {
  const o = ov.obs || {};
  const perRoute = Object.entries(o.perRoute || {}).sort((a, b) => b[1].cost - a[1].cost);
  const trend = ov.costTrend || [];
  const maxCost = Math.max(0.0001, ...trend.map(d => d.cost));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Spend headline */}
      <Section title="Custo LLM">
        {!o.available ? <Muted>Sem métricas ainda (obs.js não configurado ou sem gastos).</Muted> : (
          <>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 18 }}>
              <Stat label="Hoje" value={usd(o.costToday)} />
              <Stat label="Ontem" value={usd(o.costYesterday)} />
              <Stat label="Erros hoje" value={o.errorsToday || 0} accent={o.errorsToday > 0 ? RED : null} />
            </div>
            {/* 30-day trend */}
            <div style={{ fontSize: 10, fontWeight: 600, color: LO, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Últimos 30 dias</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60 }}>
              {trend.map((d, i) => (
                <div key={i} title={`${d.day} · ${usd(d.cost)}`} style={{
                  flex: 1, height: `${Math.max(2, (d.cost / maxCost) * 100)}%`,
                  background: d.cost > 0 ? `linear-gradient(180deg, ${ACCENT}, ${ACCENT}55)` : "rgba(255,255,255,0.04)",
                  borderRadius: 2,
                }} />
              ))}
            </div>
            {/* Per-route */}
            {perRoute.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: LO, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Por rota · hoje</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {perRoute.map(([route, v]) => (
                    <div key={route} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ ...mono, color: MID }}>{route}</span>
                      <span style={{ color: LO }}>{v.calls} calls · <strong style={{ color: HI }}>{usd(v.cost)}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      {/* Errors */}
      <Section title={`Erros recentes${o.recentErrors?.length ? ` · ${o.recentErrors.length}` : ""}`}>
        {!o.recentErrors?.length ? <Muted>Sem erros registados. ✓</Muted> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
            {o.recentErrors.map((e, i) => (
              <div key={i} style={{ fontSize: 11, padding: "8px 10px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ ...mono, color: ACCENT }}>{e.route || "?"}</span>
                  <span style={{ color: DIM }}>{ago(e.at)}</span>
                </div>
                <div style={{ color: MID, marginTop: 3, wordBreak: "break-word" }}>{e.message || e.raw || "—"}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Env + Redis */}
      <div className="sl-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Section title="Configuração (env)">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(ov.env || []).map(e => (
              <div key={e.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <span style={{ color: MID }}>{e.label} {!e.required && <span style={{ color: DIM, fontSize: 10 }}>(opcional)</span>}</span>
                <span style={{ fontWeight: 700, color: e.set ? GREEN : (e.required ? RED : DIM) }}>{e.set ? "✓" : "✗"}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Dados (Redis)">
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Stat label="Criadores" value={ov.data?.creators ?? "—"} />
            <Stat label="Versão índice" value={`v${ov.data?.summaryVersion ?? "?"}`} />
            <Stat label="Reindex" value={ov.data?.rebuilding ? "a correr" : "idle"} accent={ov.data?.rebuilding ? AMBER : null} />
          </div>
        </Section>
      </div>
    </div>
  );
}

// ───────────────────────── AUTOMAÇÕES ─────────────────────────
function AutomacoesPanel({ ov, reload, toast }) {
  const [busy, setBusy] = useState("");
  const runNow = async (cron) => {
    if (!confirm(`Correr "${cron.label}" agora? Envia emails reais.`)) return;
    setBusy(cron.name);
    try {
      const r = await fetch(cron.path, { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      toast(r.ok ? `${cron.label}: executado.` : `${cron.label}: ${d.error || "erro"}`);
    } catch { toast(`${cron.label}: falhou.`); }
    setBusy(""); reload();
  };
  const toggleAutopilot = async () => {
    setBusy("autopilot");
    try {
      const r = await fetch("/api/discovery/autopilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !ov.autopilotEnabled }) });
      const d = await r.json().catch(() => ({}));
      toast(r.ok ? `Autopilot ${d.enabled ? "ligado" : "desligado"}.` : "Erro no autopilot.");
    } catch { toast("Erro no autopilot."); }
    setBusy(""); reload();
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Section title="Crons de email">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(ov.crons || []).map(c => (
            <div key={c.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: HI }}>{c.label}</div>
                <div style={{ fontSize: 11, color: LO, marginTop: 2 }}>{c.scheduleLabel} · <span style={mono}>{c.schedule}</span></div>
                <div style={{ fontSize: 11, marginTop: 3, color: c.lastRun ? (c.lastRun.ok ? GREEN : RED) : DIM }}>
                  {c.lastRun ? `última: ${ago(c.lastRun.at)} · ${c.lastRun.summary || (c.lastRun.ok ? "ok" : "falhou")}` : "sem registo de execução"}
                </div>
              </div>
              <button onClick={() => runNow(c)} disabled={busy === c.name} style={{ ...btnPrimary, opacity: busy === c.name ? 0.5 : 1 }}>
                {busy === c.name ? "A correr…" : "Correr agora"}
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Autopilot Discovery">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, color: MID }}>Descoberta automática de candidatos · todos os dias 06:00.</div>
            <div style={{ fontSize: 11, color: LO, marginTop: 3 }}>Estado: <strong style={{ color: ov.autopilotEnabled ? GREEN : DIM }}>{ov.autopilotEnabled ? "ligado" : "desligado"}</strong></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/creators" style={{ ...btnGhost, textDecoration: "none", display: "inline-block" }}>Ver Discovery →</a>
            <button onClick={toggleAutopilot} disabled={busy === "autopilot"} style={{ ...(ov.autopilotEnabled ? btnGhost : btnPrimary), opacity: busy === "autopilot" ? 0.5 : 1 }}>
              {ov.autopilotEnabled ? "Desligar" : "Ligar"}
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ───────────────────────── EQUIPA ─────────────────────────
function EquipaPanel({ toast }) {
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [mig, setMig] = useState(null);

  const load = useCallback(async () => {
    const [meRes, teamRes] = await Promise.all([fetch("/api/auth/me").then(r => r.json()).catch(() => ({})), fetch("/api/admin/team")]);
    setMe(meRes?.user || null);
    if (teamRes.ok) setData(await teamRes.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const post = async (payload) => {
    setBusy(true);
    const r = await fetch("/api/admin/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { toast(d.error || "Erro"); return null; }
    if (d.allowlist) setData(d);
    return d;
  };
  const add = async (e) => { e.preventDefault(); const email = newEmail.trim().toLowerCase(); if (!email) return; if (await post({ action: "add", email })) { setNewEmail(""); toast("Adicionado."); } };
  const remove = async (email) => { if (!confirm(`Remover ${email}? Isto apaga o registo do user.`)) return; if (await post({ action: "remove", email })) toast("Removido."); };
  const migrate = async () => {
    if (!confirm("Migrar tomas@/raul@/carolina@informallabs.com → @secondlayerhq.com?\nMantém o mesmo userId e nome — dados e permissões iguais.")) return;
    const d = await post({ action: "migrate-secondlayer" });
    if (d?.migration) { setMig(d.migration); toast("Migração concluída."); }
  };

  if (!data) return <Muted>A carregar equipa…</Muted>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Section title="Migrar emails → @secondlayerhq.com" accentBorder>
        <p style={{ fontSize: 12, color: MID, margin: "0 0 12px", lineHeight: 1.6 }}>
          Troca os 3 operadores para os emails oficiais <strong style={{ color: MID }}>mantendo o mesmo userId e nome</strong>. Idempotente. Os emails antigos deixam de dar acesso.
        </p>
        <button onClick={migrate} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>Migrar equipa</button>
        {mig && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
            {mig.map((r, i) => (
              <div key={i} style={{ fontSize: 11, ...mono, color: MID }}>
                <span style={{ color: LO }}>{r.oldEmail || "—"} → </span><strong style={{ color: HI }}>{r.newEmail}</strong>
                <span style={{ color: r.status === "migrated" || r.status === "already" ? GREEN : AMBER, marginLeft: 8 }}>· {r.status}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Allowlist · ${data.allowlist?.length || 0}`}>
        <form onSubmit={add} style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@secondlayerhq.com"
            style={{ flex: 1, minWidth: 200, padding: "10px 12px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: HI, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          <button type="submit" disabled={busy || !newEmail} style={{ ...btnPrimary, opacity: (busy || !newEmail) ? 0.5 : 1 }}>Adicionar</button>
        </form>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {(data.allowlist || []).map(email => {
            const user = (data.users || []).find(u => u.email === email);
            const isMe = me?.email === email;
            return (
              <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${BORDER}`, gap: 12, flexWrap: "wrap" }}>
                <div>
                  <span style={{ ...mono, fontSize: 13 }}>{email} {isMe && <span style={{ fontSize: 9, color: GREEN, marginLeft: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>tu</span>}</span>
                  <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{user ? `last seen ${ago(user.lastSeenAt)}` : "nunca entrou"}</div>
                </div>
                <button onClick={() => remove(email)} disabled={busy || isMe} style={{ ...btnGhost, color: isMe ? DIM : MID, cursor: isMe ? "default" : "pointer" }}>Remover</button>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ───────────────────────── CONFIG & DADOS ─────────────────────────
function ConfigPanel({ ov, reload, toast }) {
  const s = ov.sales || {};
  const [form, setForm] = useState({
    monthlyGoal: s.monthlyGoal ?? 50000, ticket: s.ticket ?? 6000,
    dailyTarget: s.dailyTarget ?? 30, workDays: s.workDays ?? 21, quarterlyQuota: s.quarterlyQuota ?? 50000,
  });
  const [busy, setBusy] = useState("");
  const save = async () => {
    setBusy("save");
    const r = await fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setBusy("");
    toast(r.ok ? "Config guardada." : "Erro a guardar.");
    reload();
  };
  const runAction = async (action, label, warn) => {
    if (warn && !confirm(warn)) return;
    setBusy(action);
    const r = await fetch("/api/admin/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    toast(r.ok ? (d.message || `${label} ok`) : (d.error || "Erro"));
    reload();
  };
  const FIELDS = [
    { key: "monthlyGoal", label: "Objetivo mensal (€)" },
    { key: "ticket", label: "Ticket médio (€)" },
    { key: "dailyTarget", label: "Meta diária (toques)" },
    { key: "workDays", label: "Dias úteis / mês" },
    { key: "quarterlyQuota", label: "Quota trimestral (€)" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Section title="Alvos de vendas">
        <p style={{ fontSize: 12, color: LO, margin: "0 0 16px" }}>Valores usados pela calculadora de alvos e pelas metas do dashboard de equipa.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
          {FIELDS.map(f => (
            <div key={f.key}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: LO, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{f.label}</label>
              <input type="number" min={0} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: Number(e.target.value) || 0 }))}
                style={{ width: "100%", padding: "10px 12px", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: HI, fontSize: 14, ...mono, outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
        </div>
        <button onClick={save} disabled={busy === "save"} style={{ ...btnPrimary, opacity: busy === "save" ? 0.5 : 1 }}>{busy === "save" ? "A guardar…" : "Guardar alvos"}</button>
      </Section>

      <Section title="Operações de dados">
        <p style={{ fontSize: 12, color: LO, margin: "0 0 16px" }}>Manutenção do índice de criadores. Normalmente auto-cura sozinho — usa só se algo parecer dessincronizado.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => runAction("flush-cache", "Cache limpa")} disabled={!!busy} style={btnGhost}>Limpar cache de leitura</button>
          <button onClick={() => runAction("rebuild-index", "Reindex", "Forçar reindex de TODOS os criadores? Pode demorar alguns segundos.")} disabled={!!busy} style={btnGhost}>
            {busy === "rebuild-index" ? "A reindexar…" : "Forçar reindex"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: DIM, marginTop: 12 }}>
          {ov.data?.creators ?? "—"} criadores · índice v{ov.data?.summaryVersion} {ov.data?.rebuilding && <span style={{ color: AMBER }}>· reindex a correr</span>}
        </div>
      </Section>
    </div>
  );
}

// ───────────────────────── shared bits ─────────────────────────
function Section({ title, children, accentBorder }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${accentBorder ? "rgba(177,30,47,0.25)" : BORDER}`, borderRadius: 12, padding: "18px 20px" }}>
      <h2 style={{ fontSize: 11, fontWeight: 700, color: LO, letterSpacing: "0.16em", textTransform: "uppercase", margin: "0 0 16px" }}>{title}</h2>
      {children}
    </div>
  );
}
function Stat({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: LO, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: accent || HI, lineHeight: 1 }}>{value}</div>
    </div>
  );
}
const Muted = ({ children }) => <div style={{ fontSize: 12, color: LO }}>{children}</div>;
const btnPrimary = { padding: "9px 16px", background: ACCENT, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const btnGhost = { padding: "9px 14px", background: "transparent", color: MID, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
