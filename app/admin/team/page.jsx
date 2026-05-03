"use client";

import { useEffect, useState } from "react";

export default function AdminTeamPage() {
  const [allowlist, setAllowlist] = useState(null);
  const [users, setUsers] = useState([]);
  const [me, setMe] = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const load = async () => {
    setError('');
    const [meRes, teamRes] = await Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/admin/team'),
    ]);
    setMe(meRes?.user || null);
    if (!teamRes.ok) {
      setError(teamRes.status === 401 ? 'Não autenticado.' : 'Erro a carregar a equipa.');
      return;
    }
    const data = await teamRes.json();
    setAllowlist(data.allowlist || []);
    setUsers(data.users || []);
  };

  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setWorking(true);
    setError('');
    const res = await fetch('/api/admin/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', email }) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Erro');
    } else {
      const d = await res.json();
      setAllowlist(d.allowlist);
      setUsers(d.users);
      setNewEmail('');
    }
    setWorking(false);
  };

  const remove = async (email) => {
    if (!confirm(`Remover ${email} da equipa?`)) return;
    setWorking(true);
    setError('');
    const res = await fetch('/api/admin/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove', email }) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Erro');
    } else {
      const d = await res.json();
      setAllowlist(d.allowlist);
      setUsers(d.users);
    }
    setWorking(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Geist', 'Helvetica Neue', Helvetica, Arial, sans-serif", padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <a href="/" style={{ fontSize: 11, color: "#666", textDecoration: "none", letterSpacing: "0.12em", textTransform: "uppercase" }}>← Hub</a>
          {me && <span style={{ fontSize: 11, color: "#666" }}>signed in as <strong style={{ color: "#aaa" }}>{me.email}</strong></span>}
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Team</h1>
        <p style={{ fontSize: 13, color: "#666", margin: "6px 0 32px" }}>Quem pode entrar como team. Adicionar = vai aparecer aqui mas só recebe acesso quando entrar via /signin com o email.</p>

        {error && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 16 }}>{error}</div>}

        {/* Add new */}
        <form onSubmit={add} style={{ display: "flex", gap: 8, marginBottom: 36 }}>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@informallabs.com"
            style={{ flex: 1, padding: "12px 14px", background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#f5f5f5", fontSize: 13, fontFamily: "inherit", outline: "none" }}
          />
          <button type="submit" disabled={working || !newEmail} style={{ padding: "12px 20px", background: "#B11E2F", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: (working || !newEmail) ? "default" : "pointer", fontFamily: "inherit", opacity: (working || !newEmail) ? 0.5 : 1 }}>
            Adicionar
          </button>
        </form>

        {/* Allowlist */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: "#666", letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 14px" }}>Allowlist · {allowlist?.length || 0}</h2>
          <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
            {allowlist?.length === 0 && <div style={{ padding: "20px 22px", fontSize: 13, color: "#666" }}>Nenhum email na allowlist (TEAM_EMAILS env var ainda não foi seedado).</div>}
            {allowlist?.map(email => {
              const user = users.find(u => u.email === email);
              const isMe = me?.email === email;
              return (
                <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{email} {isMe && <span style={{ fontSize: 9, color: "#1F8A4C", letterSpacing: "0.12em", textTransform: "uppercase", marginLeft: 8 }}>tu</span>}</span>
                    {user ? (
                      <span style={{ fontSize: 10, color: "#555" }}>last seen {new Date(user.lastSeenAt).toLocaleString('pt-PT')}</span>
                    ) : (
                      <span style={{ fontSize: 10, color: "#444" }}>nunca entrou</span>
                    )}
                  </div>
                  <button onClick={() => remove(email)} disabled={working || isMe} style={{ padding: "6px 12px", background: "transparent", color: isMe ? "#333" : "#aaa", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, fontSize: 11, cursor: isMe ? "default" : "pointer", fontFamily: "inherit" }}>
                    Remover
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Creator users (informational) */}
        <div>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: "#666", letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 14px" }}>Creators com portal</h2>
          <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
            {users.filter(u => u.role === 'creator').length === 0 && <div style={{ padding: "20px 22px", fontSize: 13, color: "#666" }}>Ainda nenhum creator com acesso ao portal.</div>}
            {users.filter(u => u.role === 'creator').map(u => (
              <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{u.email}</span>
                  <span style={{ fontSize: 10, color: "#555" }}>{u.creatorId ? `creatorId: ${u.creatorId}` : 'sem creatorId'} · last seen {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString('pt-PT') : '—'}</span>
                </div>
                {u.creatorId && <a href={`/creators/${u.creatorId}`} style={{ fontSize: 11, color: "#B11E2F", textDecoration: "none" }}>Ver creator →</a>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
