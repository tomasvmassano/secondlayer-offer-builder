"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * /unfollow — end-of-cycle cleanup, deliberately OFF the CRM so it never
 * distracts from the sales workflow. Lists the operator's cold, never-replied
 * creators (past the full cadence). Each row opens the Instagram profile in a
 * new tab (unfollow by hand there) and marks it done so it drops off — the
 * same "button to their profile" flow as the DM tray.
 */
export default function UnfollowPage() {
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const fetchDue = useCallback(async () => {
    try {
      const r = await fetch("/api/unfollow/due");
      const d = await r.json();
      if (d.error) setError(d.error);
      else setItems(Array.isArray(d.items) ? d.items : []);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { fetchDue(); }, [fetchDue]);

  // Open IG (optional) → mark unfollowed → drop from the list.
  const mark = useCallback(async (item, openProfile) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      if (openProfile && item.igUrl) {
        try { window.open(item.igUrl, "_blank", "noopener,noreferrer"); }
        catch { window.location.href = item.igUrl; }
      }
      const r = await fetch(`/api/creators/${item.id}/unfollow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (r.ok) setItems(prev => (prev || []).filter(i => i.id !== item.id));
      else { const d = await r.json().catch(() => ({})); setError(d.error || "Erro ao marcar"); }
    } catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  }, [busyId]);

  const total = items?.length || 0;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--sl-bg)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 28px", borderBottom: "1px solid var(--sl-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/creators" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--sl-text-faint)", textDecoration: "none" }}>← CRM</a>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--sl-text)" }}>Deixar de seguir</span>
        </div>
        {items && <span style={{ fontSize: 12, color: "var(--sl-text-faint)" }}>{total} por limpar · só os teus</span>}
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 80px" }}>
        <p style={{ fontSize: 13, color: "var(--sl-text-muted)", lineHeight: 1.55, margin: "0 0 20px" }}>
          Criadores que nunca responderam e já passaram o ciclo completo. Abre o perfil, deixa de seguir no Instagram, e marca como feito para sair da lista.
        </p>

        {error && <div style={{ color: "var(--sl-danger)", fontSize: 13, padding: "12px 0" }}>Erro: {error}</div>}

        {!items && !error && (
          <div style={{ color: "var(--sl-text-faint)", fontSize: 13, padding: 40, textAlign: "center" }}>A carregar…</div>
        )}

        {items && total === 0 && (
          <div style={{ textAlign: "center", padding: "56px 20px" }}>
            <div style={{ fontSize: 34, opacity: 0.3, marginBottom: 10 }}>✓</div>
            <div style={{ fontSize: 13, color: "var(--sl-text-faint)" }}>Nada para limpar.</div>
            <div style={{ fontSize: 12, color: "var(--sl-text-faint)", marginTop: 4 }}>Aparece aqui quando um lead frio fecha o ciclo sem responder.</div>
          </div>
        )}

        {items && total > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(item => {
              const isBusy = busyId === item.id;
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--sl-surface)", border: "1px solid var(--sl-border)", borderRadius: 10 }}>
                  {item.profilePicUrl ? (
                    <img src={`/api/proxy-image?url=${encodeURIComponent(item.profilePicUrl)}`} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--sl-surface-raised)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--sl-text-faint)", flexShrink: 0 }}>
                      {(item.name || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sl-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "var(--sl-text-faint)", marginTop: 1 }}>
                      {item.handle ? `@${item.handle} · ` : item.niche ? `${item.niche} · ` : ""}frio há {item.daysCold ?? "?"}d
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => mark(item, false)}
                    title="Marcar como feito sem abrir (já deixaste de seguir)"
                    style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid var(--sl-border)", background: "transparent", color: "var(--sl-text-muted)", fontSize: 12, fontWeight: 600, cursor: isBusy ? "wait" : "pointer", fontFamily: "inherit", flexShrink: 0 }}
                  >
                    Feito
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => mark(item, true)}
                    style={{ padding: "7px 12px", borderRadius: 6, border: "none", background: isBusy ? "var(--sl-text-faint)" : "var(--sl-primary)", color: "var(--sl-primary-contrast, var(--sl-text))", fontSize: 12, fontWeight: 700, cursor: isBusy ? "wait" : "pointer", fontFamily: "inherit", letterSpacing: "0.03em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    {isBusy ? "…" : "Abrir perfil e marcar"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
