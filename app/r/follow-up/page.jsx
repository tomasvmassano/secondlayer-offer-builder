"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * /r/follow-up?cid=<creatorId>&milestone=<key>&channel=<dm|email>
 *
 * Tiny client page that runs the "click → copy → open" flow when the
 * operator clicks a follow-up link from the daily reminder email.
 *
 * Flow:
 *   1. Mount → fetch text + openUrl from /api/r/follow-up-payload
 *   2. Copy text to clipboard via navigator.clipboard.writeText
 *   3. Redirect to openUrl (Instagram profile OR mailto:creator@...)
 *
 * Why a separate page instead of just a JS handler in the email:
 * email clients don't run JS. The cron email link must point at a real
 * URL; this page is that URL, and the JS runs in the operator's browser
 * after the click. Auth gate handles the "operator must be logged in"
 * requirement automatically.
 */
function FollowUpRedirectInner() {
  const params = useSearchParams();
  const cid = params.get("cid");
  const milestone = params.get("milestone") || "softNudge";
  const channel = params.get("channel") === "email" ? "email" : "dm";

  const [phase, setPhase] = useState("loading"); // loading | copied | opening | error
  const [creatorName, setCreatorName] = useState("");
  const [text, setText] = useState("");
  const [openUrl, setOpenUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!cid) {
      setPhase("error");
      setErrorMsg("Missing creator id (cid). Open the email link again.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/r/follow-up-payload?cid=${encodeURIComponent(cid)}&milestone=${encodeURIComponent(milestone)}&channel=${encodeURIComponent(channel)}`);
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        setCreatorName(data.creatorName || "");
        setText(data.text || "");
        setOpenUrl(data.openUrl || "");
        // 1. Copy
        try {
          await navigator.clipboard.writeText(data.text || "");
          setPhase("copied");
        } catch {
          // Clipboard might be blocked (permissions, http) — still open.
          setPhase("copied");
        }
        // 2. Brief pause so the operator sees the "copied ✓" state, then open.
        setTimeout(() => {
          if (cancelled) return;
          if (data.openUrl) {
            setPhase("opening");
            window.location.href = data.openUrl;
          } else {
            // No openUrl (e.g. email without contactEmail) — leave the
            // operator on this page with the copied text + a hint.
            setPhase("copied-no-open");
          }
        }, 700);
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setErrorMsg(err?.message || String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [cid, milestone, channel]);

  const channelLabel = channel === "email" ? "email" : "DM Instagram";

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      padding: 24,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{
        maxWidth: 520, width: "100%", padding: "28px 32px",
        background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#7A0E18", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
          Follow-up · {channelLabel}
        </div>
        {creatorName && (
          <div style={{ fontSize: 20, fontWeight: 700, color: "#f5f5f5", marginBottom: 12 }}>{creatorName}</div>
        )}

        {phase === "loading" && (
          <div style={{ fontSize: 13, color: "#888" }}>
            <span style={{ animation: "pulse 1.4s ease-in-out infinite" }}>● A preparar o texto…</span>
          </div>
        )}

        {(phase === "copied" || phase === "opening") && (
          <>
            <div style={{ fontSize: 13, color: "#22c55e", fontWeight: 600, marginBottom: 6 }}>
              ✓ Copiado para o clipboard
            </div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
              {phase === "opening"
                ? `A abrir ${channelLabel}…`
                : `A abrir ${channelLabel} num instante.`}
            </div>
            <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 12, color: "#aaa", whiteSpace: "pre-wrap", lineHeight: 1.55, fontFamily: "ui-monospace, monospace" }}>
              {text}
            </div>
          </>
        )}

        {phase === "copied-no-open" && (
          <>
            <div style={{ fontSize: 13, color: "#22c55e", fontWeight: 600, marginBottom: 6 }}>
              ✓ Copiado para o clipboard
            </div>
            <div style={{ fontSize: 12, color: "#eab308", marginBottom: 16 }}>
              ⚠ Sem email do criador no perfil. Texto está copiado — cola onde quiseres.
            </div>
            <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 12, color: "#aaa", whiteSpace: "pre-wrap", lineHeight: 1.55, fontFamily: "ui-monospace, monospace" }}>
              {text}
            </div>
          </>
        )}

        {phase === "error" && (
          <div style={{ fontSize: 13, color: "#ef4444" }}>
            Falhou: {errorMsg}
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: 11, color: "#555" }}>
          <a href={cid ? `/creators/${cid}` : "/creators"} style={{ color: "#888", textDecoration: "none" }}>
            ← Abrir perfil do criador
          </a>
        </div>
      </div>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

export default function FollowUpRedirectPage() {
  return (
    <Suspense fallback={null}>
      <FollowUpRedirectInner />
    </Suspense>
  );
}
