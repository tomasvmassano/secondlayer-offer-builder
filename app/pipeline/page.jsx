"use client";

import { useState, useEffect, useMemo } from "react";
import { STAGES, STAGE_KEYS, computeOutreachStage, groupByStage, stageStaleness, nextAction, suggestedActions } from "../lib/outreachStages";

const LOGO_B64 = "data:image/png;base64,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";

const ALL_LAUNCH_ASSETS = [
  { key: "launchTimeline", label: "Timeline" },
  { key: "salesPageCopy", label: "Sales Page" },
  { key: "emailSequence", label: "Emails" },
  { key: "leadMagnet", label: "Lead Magnet" },
  { key: "adCreative", label: "Ads" },
  { key: "socialContent", label: "Content" },
  { key: "communityActivation", label: "Community" },
  { key: "onboardingFlow", label: "Onboarding" },
  { key: "churnPrevention", label: "Churn" },
];

function formatFollowers(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

// ─────────────────────────────────────────────────────────────────
// Phase tabs · top-of-page chrome that switches between:
//   • Sales — Outbound+Sales Kanban (default; replaces the old flat list)
//   • Delivery — current post-signed asset tracker (preserved as sub-tab)
//   • Live — placeholder for now (renewal / churn dashboard, next iteration)
// ─────────────────────────────────────────────────────────────────
const PHASES = [
  { key: 'sales',    label: 'Outbound + Sales' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'live',     label: 'Live' },
];

export default function PipelinePage() {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('sales');

  useEffect(() => {
    // Sales phase needs ALL pre-signed creators (any status). Delivery
    // needs signed-only. Fetch the full set, filter client-side per phase.
    fetch("/api/creators").then(r => r.json()).then(async (data) => {
      const summaries = data.creators || [];
      const full = await Promise.all(summaries.map(s =>
        fetch(`/api/creators/${s.id}`).then(r => r.ok ? r.json() : null).catch(() => null)
      ));
      setCreators(full.filter(Boolean));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}><img src={LOGO_B64} alt="SL" style={{ height: 16, opacity: 0.85 }} /></a>
          <span style={{ color: "#333", fontSize: 14 }}>|</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888" }}>Pipeline</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/creators" style={{ fontSize: 11, color: "#555", textDecoration: "none", padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>CRM</a>
          <a href="/" style={{ fontSize: 11, color: "#555", textDecoration: "none" }}>HQ</a>
        </div>
      </div>

      {/* Phase tabs */}
      <div style={{ padding: "16px 28px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 4, alignItems: "flex-end" }}>
        {PHASES.map(p => (
          <button key={p.key} onClick={() => setPhase(p.key)} style={{
            padding: "10px 16px", background: "transparent", border: 'none',
            borderBottom: phase === p.key ? "2px solid #B11E2F" : "2px solid transparent",
            color: phase === p.key ? "#f5f5f5" : "#666",
            fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
            cursor: "pointer", fontFamily: "inherit",
          }}>{p.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 80, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 20, height: 20, border: "2px solid #222", borderTopColor: "#7A0E18", borderRadius: "50%", animation: "sl-spin 0.8s linear infinite" }} />
          <style>{`@keyframes sl-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : phase === 'sales' ? (
        <SalesKanban creators={creators} setCreators={setCreators} />
      ) : phase === 'delivery' ? (
        <DeliveryList creators={creators.filter(c => c.pipelineStatus === 'signed')} />
      ) : (
        <LivePlaceholder />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SalesKanban · 7 columns (Outbound + Sales merged into one board) + a
// horizontal Cold lane below. Operator never drags — stages are derived
// from outreach data, cards auto-move forward when work happens.
// ─────────────────────────────────────────────────────────────────
function SalesKanban({ creators, setCreators }) {
  // Exclude signed (they live in Delivery) — groupByStage already does this.
  const grouped = useMemo(() => groupByStage(creators), [creators]);
  const activeStages = STAGES.filter(s => s.key !== 'cold');
  const coldCount = grouped.cold?.length || 0;

  // Aggregate counts for the header strip.
  const totals = useMemo(() => {
    const sourced     = grouped.sourced?.length || 0;
    const outreach    = grouped.outreach_ready?.length || 0;
    const dmOut       = grouped.dm_out?.length || 0;
    const inConv      = grouped.in_conversation?.length || 0;
    const loom        = grouped.loom_sent?.length || 0;
    const call        = grouped.call_booked?.length || 0;
    const pitch       = grouped.pitch_sent?.length || 0;
    const active      = sourced + outreach + dmOut + inConv + loom + call + pitch;
    return { active, dmOut, inConv, loom, call, pitch };
  }, [grouped]);

  return (
    <div style={{ padding: "24px 28px 80px" }}>
      {/* Header strip with quick funnel counts */}
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Sales Pipeline</h1>
          <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0" }}>
            {totals.active} ativos · {totals.dmOut} DM · {totals.inConv} conv · {totals.loom} loom · {totals.call} call · {totals.pitch} pitch · {coldCount} cold
          </p>
        </div>
        <a href="/creators" style={{ fontSize: 11, color: "#555", textDecoration: "none", padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>+ Add creator</a>
      </div>

      {/* Kanban — horizontal scroll on narrow screens. Each column is a
          fixed 280px so 7 columns = 2000px wide, which fits cleanly on a
          1920+ monitor and scrolls horizontally on laptops. */}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {activeStages.map(stage => {
          const items = grouped[stage.key] || [];
          return (
            <div key={stage.key} style={{ minWidth: 280, width: 280, flexShrink: 0 }}>
              {/* Column header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: stage.accent }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#f5f5f5", letterSpacing: "0.1em", textTransform: "uppercase" }}>{stage.label}</span>
                </div>
                <span style={{ fontSize: 11, color: "#555", fontWeight: 600 }}>{items.length}</span>
              </div>
              {/* Column body */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.length === 0 ? (
                  <div style={{ padding: "20px 12px", fontSize: 11, color: "#333", textAlign: "center", background: "rgba(255,255,255,0.01)", border: "1px dashed rgba(255,255,255,0.04)", borderRadius: 8 }}>
                    {stage.description}
                  </div>
                ) : items.map(c => (
                  <KanbanCard key={c.id} creator={c} setCreators={setCreators} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cold lane — below the active columns, full-width collapsible list. */}
      {coldCount > 0 && <ColdLane creators={grouped.cold} setCreators={setCreators} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// KanbanCard · compact creator card for the Sales board.
// Shows avatar + name + niche, stage-specific data row, age chip, and
// the stage's next-action CTA. Inline editors (Loom URL, Cal link, mark
// cold) live inside an expanded view triggered by clicking the card.
// ─────────────────────────────────────────────────────────────────
function KanbanCard({ creator, setCreators }) {
  const [expanded, setExpanded] = useState(false);
  const stage = computeOutreachStage(creator);
  const staleness = stageStaleness(creator);
  const action = nextAction(creator);
  const suggestions = suggestedActions(creator);
  const followers = (creator.platforms?.instagram?.followers || 0)
    + (creator.platforms?.tiktok?.followers || 0)
    + (creator.platforms?.youtube?.subscribers || 0);

  const ageChipColor = staleness.level === 'cold' ? '#7A0E18'
    : staleness.level === 'warn' ? '#eab308'
    : '#444';
  const ageChipBg = staleness.level === 'cold' ? 'rgba(122,14,24,0.15)'
    : staleness.level === 'warn' ? 'rgba(234,179,8,0.1)'
    : 'rgba(255,255,255,0.03)';

  return (
    <div style={{
      padding: 12, background: "#141414", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 8, transition: "border-color 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(122,14,24,0.4)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
    >
      {/* Top row · avatar + name + age chip */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {creator.profilePicUrl ? (
          <img src={`/api/proxy-image?url=${encodeURIComponent(creator.profilePicUrl)}`} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#555", border: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            {(creator.name || "?")[0].toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <a href={`/creators/${creator.id}`} style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5", textDecoration: "none", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{creator.name}</a>
          <div style={{ fontSize: 10, color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{creator.niche || '—'}</div>
        </div>
        {staleness.days >= 0 && (
          <span style={{ fontSize: 9, fontWeight: 700, color: ageChipColor, padding: "2px 6px", borderRadius: 3, background: ageChipBg, fontFamily: "ui-monospace, monospace" }}>
            {staleness.days}d
          </span>
        )}
      </div>

      {/* Stage data — what's relevant for THIS column. */}
      <StageData creator={creator} stage={stage} followers={followers} />

      {/* Auto-suggested action pills (e.g. "Send bump · Loom out 6d"). */}
      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
              padding: "3px 8px", borderRadius: 3,
              background: s.kind === 'cold' ? "rgba(122,14,24,0.15)" : "rgba(234,179,8,0.1)",
              color: s.kind === 'cold' ? "#f5b5bb" : "#eab308",
              border: `1px solid ${s.kind === 'cold' ? "rgba(122,14,24,0.3)" : "rgba(234,179,8,0.25)"}`,
              textAlign: "center",
            }}>{s.label}</div>
          ))}
        </div>
      )}

      {/* Next-action CTA */}
      {action && (
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          <a href={action.href(creator)} style={{
            flex: 1, padding: "6px 10px", background: "rgba(122,14,24,0.15)",
            border: "1px solid rgba(122,14,24,0.35)", borderRadius: 5,
            fontSize: 10, fontWeight: 700, color: "#f5b5bb", letterSpacing: "0.04em",
            textTransform: "uppercase", textDecoration: "none", textAlign: "center",
          }}>{action.label} →</a>
          <button onClick={() => setExpanded(e => !e)} style={{
            padding: "6px 10px", background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)", borderRadius: 5,
            fontSize: 10, color: "#888", cursor: "pointer", fontFamily: "inherit",
          }}>{expanded ? '×' : '⋯'}</button>
        </div>
      )}

      {/* Expanded — inline editors for Loom URL, Cal link, cold mark. */}
      {expanded && <ExpandedEditor creator={creator} setCreators={setCreators} stage={stage} />}
    </div>
  );
}

// Stage-specific data row. Shows the most relevant info for the current
// column — followers everywhere, plus stage-specific signals (DM count,
// Loom date, call date, etc.).
function StageData({ creator, stage, followers }) {
  const o = creator.outreach || {};
  const bullets = [];

  // Always show followers if known.
  if (followers > 0) bullets.push(`${formatFollowers(followers)} fol`);
  if (creator.dealScoreGrade) bullets.push(`Grade ${creator.dealScoreGrade}`);

  // Stage-specific.
  if (stage === 'dm_out') {
    const dmDate = o.dmSentAt ? new Date(o.dmSentAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) : null;
    if (dmDate) bullets.push(`DM ${dmDate}`);
    if (o.followUpsDone) bullets.push(`${o.followUpsDone}/3 follow-ups`);
  } else if (stage === 'in_conversation') {
    const r = o.repliedAt ? new Date(o.repliedAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) : null;
    if (r) bullets.push(`Replied ${r}`);
  } else if (stage === 'loom_sent') {
    const l = o.loomSentAt ? new Date(o.loomSentAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) : null;
    if (l) bullets.push(`Loom ${l}`);
    if (o.bumpSentAt) bullets.push('Bumped');
  } else if (stage === 'call_booked') {
    const c = o.callBookedAt || o.callAgreedAt;
    const d = c ? new Date(c).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) : null;
    if (d) bullets.push(`Call ${d}`);
    if (o.callHeldAt) bullets.push('✓ Held');
  } else if (stage === 'pitch_sent') {
    const p = creator.pitch?.sentAt ? new Date(creator.pitch.sentAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) : null;
    if (p) bullets.push(`Pitch ${p}`);
    if (creator.pitch?.openedAt) bullets.push('Opened');
  }

  if (bullets.length === 0) return null;
  return (
    <div style={{ fontSize: 10, color: "#888", lineHeight: 1.5 }}>
      {bullets.join(' · ')}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ExpandedEditor · inline pasteable fields. Each save PATCHes the creator
// and updates local state so the card recomputes its stage immediately
// (Loom URL pasted → card auto-moves to "Loom sent" column on re-render).
// ─────────────────────────────────────────────────────────────────
function ExpandedEditor({ creator, setCreators, stage }) {
  const [loomUrl, setLoomUrl] = useState(creator.outreach?.loomUrl || '');
  const [bookingLink, setBookingLink] = useState(creator.outreach?.callBookingLink || '');
  const [pitchUrl, setPitchUrl] = useState(creator.pitch?.url || `/pitch?creatorId=${creator.id}`);
  const [saving, setSaving] = useState(false);

  const patch = async (body) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/creators/${creator.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setCreators(prev => prev.map(c => c.id === creator.id ? updated : c));
      }
    } catch {}
    finally { setSaving(false); }
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Loom URL — record on Loom, paste link here. Card auto-moves to Loom column. */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Loom URL</div>
        <div style={{ display: "flex", gap: 4 }}>
          <input
            value={loomUrl}
            onChange={e => setLoomUrl(e.target.value)}
            placeholder="https://www.loom.com/share/..."
            style={{ flex: 1, padding: "5px 8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "#f5f5f5", fontSize: 10, fontFamily: "inherit", outline: "none" }}
          />
          <button disabled={saving || !loomUrl} onClick={() => patch({ outreach: { ...creator.outreach, loomUrl, loomSentAt: new Date().toISOString() } })} style={{
            padding: "5px 10px", background: loomUrl ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${loomUrl ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.06)"}`,
            borderRadius: 4, fontSize: 9, fontWeight: 700, color: loomUrl ? "#c896f5" : "#555", cursor: loomUrl ? "pointer" : "not-allowed", fontFamily: "inherit",
          }}>Save · sent now</button>
        </div>
      </div>

      {/* Cal/Calendly booking link */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Booking link</div>
        <div style={{ display: "flex", gap: 4 }}>
          <input
            value={bookingLink}
            onChange={e => setBookingLink(e.target.value)}
            placeholder="https://cal.com/..."
            style={{ flex: 1, padding: "5px 8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "#f5f5f5", fontSize: 10, fontFamily: "inherit", outline: "none" }}
          />
          <button disabled={saving || !bookingLink} onClick={() => patch({ outreach: { ...creator.outreach, callBookingLink: bookingLink, callBookedAt: new Date().toISOString() } })} style={{
            padding: "5px 10px", background: bookingLink ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${bookingLink ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.06)"}`,
            borderRadius: 4, fontSize: 9, fontWeight: 700, color: bookingLink ? "#86efac" : "#555", cursor: bookingLink ? "pointer" : "not-allowed", fontFamily: "inherit",
          }}>Save · booked</button>
        </div>
      </div>

      {/* Pitch URL + send marker — only relevant from call_booked onwards. */}
      {(stage === 'call_booked' || stage === 'pitch_sent' || creator.outreach?.callHeldAt) && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Pitch URL</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              value={pitchUrl}
              onChange={e => setPitchUrl(e.target.value)}
              placeholder="/pitch?creatorId=..."
              style={{ flex: 1, padding: "5px 8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "#f5f5f5", fontSize: 10, fontFamily: "inherit", outline: "none" }}
            />
            <button disabled={saving} onClick={() => patch({ pitch: { ...(creator.pitch || {}), url: pitchUrl, sentAt: new Date().toISOString() } })} style={{
              padding: "5px 10px", background: "rgba(122,14,24,0.18)",
              border: "1px solid rgba(122,14,24,0.4)",
              borderRadius: 4, fontSize: 9, fontWeight: 700, color: "#f5b5bb", cursor: "pointer", fontFamily: "inherit",
            }}>Mark sent</button>
          </div>
        </div>
      )}

      {/* Terminal-state buttons — mark cold / mark signed. */}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button onClick={() => patch({ pipelineStatus: 'cold', outreach: { ...creator.outreach, notInterestedAt: new Date().toISOString() } })} style={{
          flex: 1, padding: "5px 10px", background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4,
          fontSize: 9, fontWeight: 700, color: "#888", cursor: "pointer", fontFamily: "inherit",
        }}>Mark cold</button>
        {(stage === 'pitch_sent' || stage === 'call_booked') && (
          <button onClick={() => patch({ pipelineStatus: 'signed', signedAt: new Date().toISOString() })} style={{
            flex: 1, padding: "5px 10px", background: "rgba(34,197,94,0.15)",
            border: "1px solid rgba(34,197,94,0.4)", borderRadius: 4,
            fontSize: 9, fontWeight: 700, color: "#86efac", cursor: "pointer", fontFamily: "inherit",
          }}>Mark signed →</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ColdLane · collapsible horizontal strip below the active columns. Holds
// cold + not-interested creators. Operator can reactivate from here.
// ─────────────────────────────────────────────────────────────────
function ColdLane({ creators, setCreators }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 24, padding: 14, background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: 0, background: "transparent", border: "none", color: "#888", fontSize: 11, fontWeight: 700,
        letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
      }}>
        <span>❄️ Cold / Not interested · {creators.length}</span>
        <span style={{ fontSize: 14, color: "#555" }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
          {creators.map(c => (
            <a key={c.id} href={`/creators/${c.id}`} style={{
              padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 6, textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#555" }}>
                {(c.name || "?")[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{c.name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DeliveryList · the OLD post-signed asset tracker, preserved as a tab
// rather than the page default. Operator workflow: signed creators land
// here from the Sales board and stay through launch.
// ─────────────────────────────────────────────────────────────────
function DeliveryList({ creators }) {
  return (
    <div className="sl-page" style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="sl-h1" style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Delivery</h1>
        <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Creators fechados. Cada um com o seu workspace para gerir assets, estrategia e lançamento.</p>
      </div>

      {creators.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ width: 48, height: 48, margin: "0 auto 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#333" }}>&#128274;</div>
          <p style={{ fontSize: 15, color: "#666", marginBottom: 8 }}>Nenhum creator fechado</p>
          <p style={{ fontSize: 12, color: "#444", marginBottom: 24 }}>Marca um creator como signed para o adicionares ao pipeline.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {creators.map(c => {
            const followers = (c.platforms?.instagram?.followers || 0) + (c.platforms?.tiktok?.followers || 0) + (c.platforms?.youtube?.subscribers || 0);
            const launchAssets = c.launch || {};
            const launchDone = Object.keys(launchAssets).length;
            const launchApproved = Object.values(launchAssets).filter(v => v?.status === 'approved' || v?.status === 'live').length;
            const hasDm = !!c.dmSequence;
            const hasOffer = !!c.offer;
            const signedDate = c.signedAt ? new Date(c.signedAt).toLocaleDateString("pt-PT") : null;
            return (
              <a key={c.id} href={`/creators/${c.id}`} style={{
                display: "block", padding: "20px 24px", background: "#141414",
                border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14,
                textDecoration: "none", color: "inherit",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                  {c.profilePicUrl ? (
                    <img src={`/api/proxy-image?url=${encodeURIComponent(c.profilePicUrl)}`} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.06)" }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#555" }}>{(c.name || "?")[0].toUpperCase()}</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "#666" }}>
                      {c.niche || '—'}{followers > 0 ? ` · ${formatFollowers(followers)} fol` : ''}{signedDate ? ` · Signed ${signedDate}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "#7A0E18", fontWeight: 600 }}>workspace →</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[{ k: 'DM', has: hasDm }, { k: 'Oferta', has: hasOffer }].map(b => (
                    <div key={b.k} style={{ padding: "4px 9px", borderRadius: 4, background: b.has ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${b.has ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)"}`, fontSize: 10, color: b.has ? "#22c55e" : "#444", fontWeight: 600 }}>{b.k}</div>
                  ))}
                  <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.06)", alignSelf: "center" }} />
                  {ALL_LAUNCH_ASSETS.map(a => {
                    const la = launchAssets[a.key];
                    const st = la?.status || (la ? 'draft' : null);
                    const dot = st === 'approved' || st === 'live' ? '#22c55e' : st === 'reviewed' ? '#3b82f6' : st === 'draft' ? '#eab308' : 'rgba(255,255,255,0.08)';
                    return (
                      <div key={a.key} title={`${a.label}: ${st || 'pendente'}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 2, background: dot }} />
                        <span style={{ fontSize: 7, color: "#333" }}>{a.label}</span>
                      </div>
                    );
                  })}
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "#888", fontWeight: 600 }}>{launchDone}/{ALL_LAUNCH_ASSETS.length}{launchApproved > 0 ? ` · ${launchApproved} approved` : ''}</span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LivePlaceholder · stub for the post-launch phase. Filled in next round
// with MRR + retention + churn metrics. Render the empty state so the
// tab is discoverable.
// ─────────────────────────────────────────────────────────────────
function LivePlaceholder() {
  return (
    <div style={{ padding: 80, textAlign: "center", color: "#666" }}>
      <div style={{ width: 48, height: 48, margin: "0 auto 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#333" }}>📡</div>
      <p style={{ fontSize: 14, color: "#888", margin: "0 0 6px" }}>Live · post-launch tracking</p>
      <p style={{ fontSize: 12, color: "#444", margin: 0 }}>MRR, retention, renewals & churn dashboard. Coming in the next iteration.</p>
    </div>
  );
}
