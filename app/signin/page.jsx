"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function SignInPageImpl() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState("email"); // email | sent | verifying
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const e = searchParams.get('error');
    if (e) setError(e);
  }, [searchParams]);

  const submitEmail = async (e) => {
    e.preventDefault();
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setError('Email inválido.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setStage('sent');
    } catch {
      setError('Algo correu mal. Tenta de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    const c = code.replace(/\D/g, '').slice(0, 6);
    if (c.length !== 6) {
      setError('O código tem 6 dígitos.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Código inválido ou expirado.');
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      router.push(data.redirectTo || '/');
    } catch {
      setError('Algo correu mal. Tenta de novo.');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "'Geist', 'Helvetica Neue', Helvetica, Arial, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo / wordmark */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 22, letterSpacing: "0.02em" }}>
            <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", color: "#B11E2F" }}>Second</span><span style={{ fontWeight: 700, letterSpacing: "-0.01em" }}>Layer</span>
          </div>
          <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#666", marginTop: 6, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>Hub · Sign in</div>
        </div>

        {stage === 'email' && (
          <form onSubmit={submitEmail} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: 8 }}>Entrar</h1>
            <p style={{ fontSize: 14, color: "#888", margin: "0 0 16px" }}>Enviamos um link mágico para o teu email. Sem palavras-passe.</p>

            <label style={{ fontSize: 11, fontWeight: 600, color: "#888", letterSpacing: "0.12em", textTransform: "uppercase" }}>Email</label>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@dominio.com"
              autoComplete="email"
              style={{ padding: "14px 16px", background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#f5f5f5", fontSize: 15, fontFamily: "inherit", outline: "none" }}
            />

            {error && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>{error}</div>}

            <button type="submit" disabled={submitting} style={{ marginTop: 8, padding: "14px 18px", background: submitting ? "#3a0a10" : "#B11E2F", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? "default" : "pointer", fontFamily: "inherit" }}>
              {submitting ? 'A enviar…' : 'Enviar link de acesso'}
            </button>
          </form>
        )}

        {stage === 'sent' && (
          <form onSubmit={submitCode} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: 8 }}>Vê o teu email</h1>
            <p style={{ fontSize: 14, color: "#888", margin: "0 0 16px" }}>
              Enviámos um link e um código de 6 dígitos para <strong style={{ color: "#f5f5f5" }}>{email}</strong>.<br />
              Clica no link <em>ou</em> cola o código aqui.
            </p>

            <label style={{ fontSize: 11, fontWeight: 600, color: "#888", letterSpacing: "0.12em", textTransform: "uppercase" }}>Código de 6 dígitos</label>
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]{6}"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              autoComplete="one-time-code"
              style={{ padding: "16px 18px", background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#f5f5f5", fontSize: 24, fontFamily: "'JetBrains Mono', ui-monospace, monospace", outline: "none", letterSpacing: "0.4em", textAlign: "center" }}
            />

            {error && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>{error}</div>}

            <button type="submit" disabled={submitting || code.length !== 6} style={{ marginTop: 8, padding: "14px 18px", background: (submitting || code.length !== 6) ? "#3a0a10" : "#B11E2F", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: (submitting || code.length !== 6) ? "default" : "pointer", fontFamily: "inherit" }}>
              {submitting ? 'A verificar…' : 'Entrar'}
            </button>

            <button type="button" onClick={() => { setStage('email'); setCode(''); setError(''); }}
              style={{ marginTop: 4, padding: "10px", background: "transparent", color: "#666", border: "none", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              ← Usar outro email
            </button>
          </form>
        )}

        <div style={{ fontSize: 10, color: "#444", marginTop: 32, textAlign: "center", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
          Second Layer · Lisboa · 2026
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0a0a0a" }} />}>
      <SignInPageImpl />
    </Suspense>
  );
}
