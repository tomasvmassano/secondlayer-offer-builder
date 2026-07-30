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

  const labelStyle = { fontSize: 12, fontWeight: 600, color: "var(--sl-text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" };
  const inputStyle = { padding: "14px 16px", borderRadius: "var(--sl-r-input)", fontSize: 15 };
  const primaryBtn = { marginTop: 8, padding: "15px 18px", fontSize: 15, fontWeight: 600, width: "100%" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--sl-bg)", color: "var(--sl-text)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo / wordmark — monochrome per brand (burgundy is reserved for the CTA) */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 26, letterSpacing: "0.01em" }}>
            <span style={{ fontFamily: "var(--sl-font-serif)", fontStyle: "italic" }}>Second</span><span style={{ fontWeight: 700, letterSpacing: "-0.015em" }}>Layer</span>
          </div>
          <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--sl-text-faint)", marginTop: 8, fontFamily: "var(--sl-font-mono)" }}>Hub · Entrar</div>
        </div>

        {stage === 'email' && (
          <form onSubmit={submitEmail} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h1 style={{ fontSize: 32, fontWeight: 600, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: 8 }}>Entrar</h1>
            <p style={{ fontSize: 15, color: "var(--sl-text-muted)", margin: "0 0 16px", lineHeight: 1.55 }}>Enviamos um link mágico para o teu email. Sem palavras-passe.</p>

            <label style={labelStyle}>Email</label>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@dominio.com"
              autoComplete="email"
              className="sl-input"
              style={inputStyle}
            />

            {error && <div style={{ fontSize: 13, color: "var(--sl-danger)", marginTop: 4 }}>{error}</div>}

            <button type="submit" disabled={submitting} className="sl-btn-primary" style={primaryBtn}>
              {submitting ? 'A enviar…' : 'Enviar link de acesso'}
            </button>
          </form>
        )}

        {stage === 'sent' && (
          <form onSubmit={submitCode} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: 8 }}>Vê o teu email</h1>
            <p style={{ fontSize: 15, color: "var(--sl-text-muted)", margin: "0 0 16px", lineHeight: 1.55 }}>
              Enviámos um link e um código de 6 dígitos para <strong style={{ color: "var(--sl-text)" }}>{email}</strong>.<br />
              Clica no link <em>ou</em> cola o código aqui.
            </p>

            <label style={labelStyle}>Código de 6 dígitos</label>
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]{6}"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              autoComplete="one-time-code"
              className="sl-input"
              style={{ padding: "16px 18px", borderRadius: "var(--sl-r-input)", fontSize: 24, fontFamily: "var(--sl-font-mono)", letterSpacing: "0.4em", textAlign: "center" }}
            />

            {error && <div style={{ fontSize: 13, color: "var(--sl-danger)", marginTop: 4 }}>{error}</div>}

            <button type="submit" disabled={submitting || code.length !== 6} className="sl-btn-primary" style={primaryBtn}>
              {submitting ? 'A verificar…' : 'Entrar'}
            </button>

            <button type="button" onClick={() => { setStage('email'); setCode(''); setError(''); }}
              style={{ marginTop: 4, padding: "10px", background: "transparent", color: "var(--sl-text-faint)", border: "none", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              ← Usar outro email
            </button>
          </form>
        )}

        <div style={{ fontSize: 11, color: "var(--sl-text-faint)", marginTop: 32, textAlign: "center", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--sl-font-mono)" }}>
          Second Layer · Lisboa · 2026
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--sl-bg)" }} />}>
      <SignInPageImpl />
    </Suspense>
  );
}
