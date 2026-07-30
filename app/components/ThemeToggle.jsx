"use client";

import { useEffect, useState } from "react";

// Global light/dark switch. The actual theme is applied to <html data-theme>
// by the no-flash inline script in layout.jsx before first paint; this control
// just flips that attribute and persists the choice. Rendered once, fixed in
// the corner, so it is available on every page without a shared nav.
export default function ThemeToggle() {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("sl-theme", next); } catch { /* private mode */ }
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      data-sl-compact
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Tema escuro — clica para claro" : "Tema claro — clica para escuro"}
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 9998,
        width: 40,
        height: 40,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--sl-r-pill)",
        background: "var(--sl-surface)",
        color: "var(--sl-text-muted)",
        border: "1px solid var(--sl-border)",
        cursor: "pointer",
        transition: "color var(--sl-dur-hover) var(--sl-ease-snappy), border-color var(--sl-dur-hover) var(--sl-ease-snappy)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--sl-text)"; e.currentTarget.style.borderColor = "var(--sl-border-strong)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--sl-text-muted)"; e.currentTarget.style.borderColor = "var(--sl-border)"; }}
    >
      {isDark ? (
        // moon — current theme is dark
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // sun — current theme is light
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
    </button>
  );
}
