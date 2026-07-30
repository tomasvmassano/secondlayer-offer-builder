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

  const [migResult, setMigResult] = useState(null);
  const migrateSecondLayer = async () => {
    if (!confirm("Migrar tomas@ / raul@ / carolina@informallabs.com → @secondlayerhq.com?\n\nMantém o mesmo userId e nome de cada pessoa, por isso todos os dados e permissões ficam iguais. Os emails antigos deixam de dar acesso.")) return;
    setWorking(true);
    setError('');
    setMigResult(null);
    const res = await fetch('/api/admin/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'migrate-secondlayer' }) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Erro na migração');
    } else {
      const d = await res.json();
      setAllowlist(d.allowlist);
      setUsers(d.users);
      setMigResult(d.migration || []);
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
    <div style={{ minHeight: "100vh", background: "var(--sl-bg)", color: "var(--sl-text)", fontFamily: "'Geist', 'Helvetica Neue', Helvetica, Arial, sans-serif", padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div className="sl-page" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 32 }}>
          <a href="/" style={{ fontSize: 12, color: "var(--sl-text-faint)", textDecoration: "none", letterSpacing: "0.12em", textTransform: "uppercase" }}>← Hub</a>
          {me && <span style={{ fontSize: 12, color: "var(--sl-text-faint)" }}>signed in as <strong style={{ color: "var(--sl-text-muted)" }}>{me.email}</strong></span>}
        </div>

        <h1 className="sl-h1" style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Team</h1>
        <p style={{ fontSize: 13, color: "var(--sl-text-faint)", margin: "6px 0 32px" }}>Quem pode entrar como team. Adicionar = vai aparecer aqui mas só recebe acesso quando entrar via /signin com o email.</p>

        {error && <div style={{ fontSize: 12, color: "var(--sl-danger)", marginBottom: 16 }}>{error}</div>}

        {/* One-time migration to the official @secondlayerhq.com emails.
            Preserves each userId + name, so all data + capabilities carry over. */}
        <div style={{ marginBottom: 36, padding: "18px 20px", background: "color-mix(in srgb, var(--sl-primary) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--sl-primary) 20%, transparent)", borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sl-text)", marginBottom: 4 }}>Migrar emails da equipa → @secondlayerhq.com</div>
          <p style={{ fontSize: 12, color: "var(--sl-text-muted)", margin: "0 0 14px", lineHeight: 1.6 }}>
            Troca tomas@ / raul@ / carolina@informallabs.com pelos oficiais tom@ / raul@ / carolina@secondlayerhq.com,
            <strong style={{ color: "var(--sl-text-muted)" }}> mantendo o mesmo userId e nome</strong> — os dados e permissões ficam iguais. Os emails antigos deixam de dar acesso. Podes correr mais que uma vez (é idempotente).
          </p>
          <button onClick={migrateSecondLayer} disabled={working} style={{ padding: "10px 18px", background: "var(--sl-primary)", color: "var(--sl-primary-contrast)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: working ? "default" : "pointer", fontFamily: "inherit", opacity: working ? 0.5 : 1 }}>
            {working ? "A migrar…" : "Migrar equipa"}
          </button>
          {migResult && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              {migResult.map((r, i) => {
                const ok = r.status === 'migrated' || r.status === 'already';
                const color = ok ? "var(--sl-success)" : r.status === 'allowlisted-only' ? "var(--sl-warning)" : "var(--sl-danger)";
                const label = r.status === 'migrated' ? "migrado" : r.status === 'already' ? "já estava migrado" : r.status === 'allowlisted-only' ? "sem user antigo — só adicionado ao allowlist" : r.status === 'conflict' ? `conflito: ${r.message}` : `erro: ${r.message || ''}`;
                return (
                  <div key={i} style={{ fontSize: 12, color: "var(--sl-text-muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                    <span style={{ color: "var(--sl-text-faint)" }}>{r.oldEmail || '—'} → </span>
                    <strong style={{ color: "var(--sl-text)" }}>{r.newEmail}</strong>
                    <span style={{ color, marginLeft: 8 }}>· {label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add new */}
        <form onSubmit={add} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 36 }}>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@secondlayerhq.com"
            style={{ flex: 1, padding: "12px 14px", background: "var(--sl-surface)", border: "1px solid var(--sl-border)", borderRadius: 8, color: "var(--sl-text)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
          />
          <button type="submit" disabled={working || !newEmail} style={{ padding: "12px 20px", background: "var(--sl-primary)", color: "var(--sl-primary-contrast)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: (working || !newEmail) ? "default" : "pointer", fontFamily: "inherit", opacity: (working || !newEmail) ? 0.5 : 1 }}>
            Adicionar
          </button>
        </form>

        {/* Allowlist */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--sl-text-faint)", letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 14px" }}>Allowlist · {allowlist?.length || 0}</h2>
          <div style={{ background: "var(--sl-surface)", border: "1px solid var(--sl-border)", borderRadius: 10, overflow: "hidden" }}>
            {allowlist?.length === 0 && <div style={{ padding: "20px 22px", fontSize: 13, color: "var(--sl-text-faint)" }}>Nenhum email na allowlist (TEAM_EMAILS env var ainda não foi seedado).</div>}
            {allowlist?.map(email => {
              const user = users.find(u => u.email === email);
              const isMe = me?.email === email;
              return (
                <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px", borderBottom: "1px solid var(--sl-border)", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{email} {isMe && <span style={{ fontSize: 12, color: "var(--sl-success)", letterSpacing: "0.12em", textTransform: "uppercase", marginLeft: 8 }}>tu</span>}</span>
                    {user ? (
                      <span style={{ fontSize: 12, color: "var(--sl-text-faint)" }}>last seen {new Date(user.lastSeenAt).toLocaleString('pt-PT')}</span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--sl-text-faint)" }}>nunca entrou</span>
                    )}
                  </div>
                  <button onClick={() => remove(email)} disabled={working || isMe} style={{ padding: "6px 12px", background: "transparent", color: isMe ? "var(--sl-border-strong)" : "var(--sl-text-muted)", border: "1px solid var(--sl-border)", borderRadius: 6, fontSize: 12, cursor: isMe ? "default" : "pointer", fontFamily: "inherit" }}>
                    Remover
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Creator users (informational) */}
        <div>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--sl-text-faint)", letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 14px" }}>Creators com portal</h2>
          <div style={{ background: "var(--sl-surface)", border: "1px solid var(--sl-border)", borderRadius: 10, overflow: "hidden" }}>
            {users.filter(u => u.role === 'creator').length === 0 && <div style={{ padding: "20px 22px", fontSize: 13, color: "var(--sl-text-faint)" }}>Ainda nenhum creator com acesso ao portal.</div>}
            {users.filter(u => u.role === 'creator').map(u => (
              <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px", borderBottom: "1px solid var(--sl-border)", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{u.email}</span>
                  <span style={{ fontSize: 12, color: "var(--sl-text-faint)" }}>{u.creatorId ? `creatorId: ${u.creatorId}` : 'sem creatorId'} · last seen {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString('pt-PT') : '—'}</span>
                </div>
                {u.creatorId && <a href={`/creators/${u.creatorId}`} style={{ fontSize: 12, color: "var(--sl-accent-text)", textDecoration: "none" }}>Ver creator →</a>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
