"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * FollowUpTray — floating bottom-right widget on the CRM Kanban.
 *
 * Collapsed: a circular badge with a bubble count of follow-ups owed
 * by the signed-in operator.
 *
 * Expanded: a panel listing each due follow-up with:
 *   - Creator name + niche + how many days since DM
 *   - Milestone chip (Dia 3 / 7 / 14)
 *   - One-click "Copiar e abrir" button that:
 *       1. Copies the prefilled DM text to clipboard
 *       2. Opens Instagram in a new tab
 *       3. Records the follow-up server-side → card advances column
 *       4. Removes the item from the tray
 *
 * Filtering: server endpoint returns only the current user's creators,
 * so this component never sees data that doesn't belong to it.
 *
 * Polling: refreshes every 60s so a newly-aged creator surfaces without
 * a manual reload. Pauses while the panel is open + an action is in
 * flight to avoid races.
 */

const MILESTONE_STYLES = {
  softNudge: { label: "Dia 3",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  valueDrop: { label: "Dia 7",  color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)" },
  lastTouch: { label: "Dia 14", color: "#ea580c", bg: "rgba(234,88,12,0.12)",  border: "rgba(234,88,12,0.3)" },
};

export default function FollowUpTray({ onAfterCopy }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const pollingPausedRef = useRef(false);

  const fetchDue = useCallback(async () => {
    if (pollingPausedRef.current) return;
    try {
      const r = await fetch("/api/follow-ups/due");
      if (!r.ok) return;
      const data = await r.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  // No interval polling. We fetch:
  //   - once on mount (so the badge count shows up)
  //   - again every time the panel opens (so it's fresh when the
  //     operator actually looks at it)
  //   - again after a click (so the item that just got copied falls
  //     off the list and a new one surfaces if one is due)
  // This kills ~130K Redis reads/day vs the previous 60-second
  // interval, which was the biggest contributor to the Upstash
  // 500K/day cap incident.
  useEffect(() => { fetchDue(); }, [fetchDue]);
  useEffect(() => { if (open) fetchDue(); }, [open, fetchDue]);

  // Click → copy → open IG → record server-side → remove from list.
  // The full pipeline runs from this single handler so the operator
  // gets a tight "copiado ✓ a abrir IG" feedback loop and the Kanban
  // card auto-advances within one network round-trip.
  const doCopyAndAdvance = useCallback(async (item) => {
    if (busyId) return;
    setBusyId(item.id);
    pollingPausedRef.current = true;
    try {
      // 1. Copy text to clipboard.
      try { await navigator.clipboard.writeText(item.dmText || ""); }
      catch { /* permissions / non-HTTPS — still proceed */ }
      setCopiedId(item.id);

      // 2. Record server-side BEFORE opening IG so the column move is
      //    committed even if the operator never returns to the tab.
      const r = await fetch(`/api/creators/${item.id}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "dm", milestone: item.milestone }),
      });

      // 3. Open Instagram. Use window.open to avoid leaving the Kanban.
      if (item.igUrl) {
        try { window.open(item.igUrl, "_blank", "noopener,noreferrer"); }
        catch { window.location.href = item.igUrl; }
      }

      // 4. Optimistically drop the item from the tray, then re-fetch
      //    so a newly-aged creator surfaces in the same render.
      setItems(prev => prev.filter(i => i.id !== item.id));
      // Let the parent (Kanban) know to re-poll so the card moves to
      // the right column without waiting for the 10s tick.
      if (onAfterCopy) {
        try { onAfterCopy({ id: item.id, milestone: item.milestone }); } catch {}
      }
      if (r.ok) {
        // Brief pause so the "Copiado ✓" pill stays visible.
        setTimeout(() => { setCopiedId(null); }, 1200);
      }
    } finally {
      setBusyId(null);
      pollingPausedRef.current = false;
      // Re-fetch the due list in case the click cleared a milestone and
      // exposed a new one.
      setTimeout(fetchDue, 600);
    }
  }, [busyId, fetchDue, onAfterCopy]);

  const total = items.length;

  // Group counts for the expanded header.
  const counts = {
    lastTouch: items.filter(i => i.milestone === "lastTouch").length,
    valueDrop: items.filter(i => i.milestone === "valueDrop").length,
    softNudge: items.filter(i => i.milestone === "softNudge").length,
  };

  return (
    <>
      {/* Collapsed circle — always visible bottom-right. Clicking toggles
          the panel. The bubble disappears when total === 0 so the
          operator sees an empty-state pulse instead of an angry "0". */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Follow-ups pendentes"
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: total > 0 ? "#7A0E18" : "#1a1a1a",
          color: "#fff",
          border: total > 0 ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.06)",
          boxShadow: total > 0
            ? "0 8px 24px rgba(122,14,24,0.4), 0 2px 6px rgba(0,0,0,0.4)"
            : "0 4px 14px rgba(0,0,0,0.4)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "inherit",
          fontSize: 20,
          zIndex: 1000,
          transition: "transform 0.15s, background 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>↻</span>
        {total > 0 && (
          <span style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 22,
            height: 22,
            padding: "0 6px",
            borderRadius: 11,
            background: "#fff",
            color: "#7A0E18",
            fontSize: 11,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #0a0a0a",
            boxSizing: "border-box",
          }}>
            {total}
          </span>
        )}
      </button>

      {/* Expanded panel */}
      {open && (
        <div style={{
          position: "fixed",
          right: 24,
          bottom: 92,
          width: 380,
          maxWidth: "calc(100vw - 48px)",
          maxHeight: "calc(100vh - 120px)",
          background: "#0f0f0f",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5" }}>
                  Os teus follow-ups
                </div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                  {total === 0 ? "Tudo em dia ✓" : `${total} por fazer · só os teus`}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "transparent", border: "none", color: "#666", fontSize: 18, cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            {total > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => {
                  const m = MILESTONE_STYLES[k];
                  return (
                    <span key={k} style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: m.bg,
                      border: `1px solid ${m.border}`,
                      color: m.color,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}>
                      {m.label} · {n}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 12px" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 30, color: "#555", fontSize: 12 }}>
                A carregar…
              </div>
            ) : total === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 12, color: "#666" }}>Sem follow-ups pendentes</div>
                <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>Volta amanhã.</div>
              </div>
            ) : (
              items.map(item => {
                const m = MILESTONE_STYLES[item.milestone] || MILESTONE_STYLES.softNudge;
                const isBusy = busyId === item.id;
                const wasCopied = copiedId === item.id;
                return (
                  <div key={item.id} style={{
                    margin: "4px 4px 6px",
                    padding: "10px 12px",
                    background: "#161616",
                    border: "1px solid rgba(255,255,255,0.04)",
                    borderRadius: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      {item.profilePicUrl ? (
                        <img
                          src={`/api/proxy-image?url=${encodeURIComponent(item.profilePicUrl)}`}
                          alt=""
                          style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", background: "#262626",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: "#666", flexShrink: 0,
                        }}>
                          {(item.name || "?")[0].toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>
                          {item.niche ? `${item.niche} · ` : ""}DM há {item.daysSinceDM}d
                        </div>
                      </div>
                      <span style={{
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: m.bg,
                        border: `1px solid ${m.border}`,
                        color: m.color,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        flexShrink: 0,
                      }}>
                        {m.label}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <a
                        href={`/creators/${item.id}`}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 5,
                          border: "1px solid rgba(255,255,255,0.06)",
                          background: "transparent",
                          color: "#888",
                          fontSize: 10,
                          fontWeight: 600,
                          textDecoration: "none",
                          fontFamily: "inherit",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        Perfil
                      </a>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => doCopyAndAdvance(item)}
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          borderRadius: 5,
                          border: "none",
                          background: wasCopied ? "rgba(34,197,94,0.15)" : isBusy ? "#444" : "#7A0E18",
                          color: wasCopied ? "#22c55e" : "#fff",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: isBusy ? "wait" : "pointer",
                          fontFamily: "inherit",
                          letterSpacing: "0.03em",
                          textTransform: "uppercase",
                          transition: "background 0.15s, color 0.15s",
                        }}
                      >
                        {wasCopied ? "Copiado ✓ a abrir IG" : isBusy ? "…" : "Copiar e abrir Instagram"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}
