"use client";

import { useEffect, useState } from "react";

// Full team-activity log. Every tracked event (post-reset), newest first,
// grouped by Lisbon day so the team can see WHEN work happened. Read-only;
// middleware gates the route to a valid session.

const ACCENT = "var(--sl-primary)";
const TEXT_HI = "var(--sl-text)";
const TEXT_MID = "var(--sl-text-muted)";
const TEXT_LO = "var(--sl-text-faint)";
const GREEN = "var(--sl-success)";
const AMBER = "var(--sl-warning)";
const BORDER = "color-mix(in srgb, var(--sl-text) 5%, transparent)";
const SURFACE_0 = "var(--sl-bg)";
const SURFACE_1 = "var(--sl-surface)";

const LABELS = {
  added:           { label: "adicionou",                  color: TEXT_MID },
  dm_sent:         { label: "enviou DM a",                color: ACCENT },
  email_sent:      { label: "enviou email a",             color: ACCENT },
  follow_up:       { label: "fez follow-up a",            color: AMBER },
  replied:         { label: "recebeu resposta de",        color: "var(--sl-info)" },
  signed:          { label: "fechou",                     color: GREEN },
};

const TZ = "Europe/Lisbon";
const clock = (iso) => { try { return new Date(iso).toLocaleTimeString("pt-PT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const dayKey = (iso) => { try { return new Date(iso).toLocaleDateString("pt-PT", { timeZone: TZ }); } catch { return ""; } };
const dayHeading = (iso) => {
  const k = dayKey(iso);
  const today = new Date().toLocaleDateString("pt-PT", { timeZone: TZ });
  const yest = new Date(Date.now() - 86_400_000).toLocaleDateString("pt-PT", { timeZone: TZ });
  const weekday = new Date(iso).toLocaleDateString("pt-PT", { timeZone: TZ, weekday: "long" });
  if (k === today) return `Hoje · ${k}`;
  if (k === yest) return `Ontem · ${k}`;
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${k}`;
};

export default function AtividadePage() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/team-activity?limit=300")
      .then(r => r.json())
      .then(d => { if (!cancelled) { if (d.error) setError(d.error); else setEvents(d.events || []); } })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  // Group by Lisbon day, preserving the newest-first order the API returns.
  const groups = [];
  if (events) {
    let cur = null;
    for (const e of events) {
      const k = dayKey(e.at);
      if (!cur || cur.key !== k) { cur = { key: k, heading: dayHeading(e.at), items: [] }; groups.push(cur); }
      cur.items.push(e);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: SURFACE_0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 28px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/equipa" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: TEXT_LO, textDecoration: "none" }}>← Equipa</a>
          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_HI }}>Atividade da equipa</span>
        </div>
        {events && <span style={{ fontSize: 12, color: TEXT_LO }}>{events.length} eventos</span>}
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 28px 80px" }}>
        {error && <div style={{ color: "var(--sl-danger)", fontSize: 13, padding: 40, textAlign: "center" }}>Erro: {error}</div>}
        {!events && !error && <div style={{ color: TEXT_LO, fontSize: 13, padding: 40, textAlign: "center" }}>A carregar…</div>}
        {events && events.length === 0 && <div style={{ color: TEXT_LO, fontSize: 13, padding: 40, textAlign: "center" }}>Sem atividade registada.</div>}

        {groups.map(g => (
          <div key={g.key} style={{ marginBottom: 28 }}>
            <div style={{ position: "sticky", top: 0, background: SURFACE_0, padding: "6px 0 10px", fontSize: 12, fontWeight: 700, color: TEXT_LO, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {g.heading} <span style={{ color: "var(--sl-text-faint)", fontWeight: 400 }}>· {g.items.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.items.map((e, i) => {
                const cfg = LABELS[e.type] || { label: e.type, color: TEXT_MID };
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: SURFACE_1, border: `1px solid ${BORDER}`, borderRadius: 10 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: TEXT_LO, fontVariantNumeric: "tabular-nums", flexShrink: 0, minWidth: 44 }}>{clock(e.at)}</span>
                    <div style={{ flex: 1, fontSize: 13, color: TEXT_MID, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <strong style={{ color: TEXT_HI }}>{e.firstName || "—"}</strong>
                      <span style={{ color: TEXT_LO, margin: "0 5px" }}>{cfg.label}</span>
                      <a href={`/creators/${e.creatorId}`} style={{ color: TEXT_HI, textDecoration: "none" }}>{e.creator || "criador"}</a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
