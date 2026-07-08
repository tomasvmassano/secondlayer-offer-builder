// ─────────────────────────────────────────────────────────────────
// Client-side fetch helpers — text-first JSON parsing.
//
// WHY: three infrastructure failure modes return NON-JSON bodies that
// `await r.json()` chokes on with the infamous
// "Unexpected token 'A', \"An error o\"... is not valid JSON":
//   1. Vercel kills a function at the 60s Hobby cap → plain-text
//      "An error occurred with your deployment" page
//   2. An expired session used to 302 → /signin HTML (now 401 JSON via
//      middleware, but stale deployments/edges may still redirect)
//   3. Proxies/CDN edges returning HTML error pages
//
// The fix pattern (read text → try parse → typed PT error) was
// hand-copied into CP1 and the kill-test panel; this centralizes it.
// ─────────────────────────────────────────────────────────────────

/**
 * Parse a fetch Response defensively. Returns the parsed JSON object.
 * Throws a readable PT-PT Error ONLY when the body is not valid JSON —
 * callers keep their own `if (!r.ok) throw new Error(data.error...)`
 * handling for well-formed API errors.
 */
export async function parseJsonSafe(r) {
  const rawText = await r.text();
  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch {
    if (r.status === 401) {
      throw new Error('Sessão expirada — faz login de novo');
    }
    if (r.status === 504 || r.status === 502 || r.status === 500) {
      throw new Error(`HTTP ${r.status} (provavelmente timeout do servidor — tenta de novo)`);
    }
    throw new Error(`HTTP ${r.status} — resposta inválida do servidor`);
  }
}

/**
 * fetch + parseJsonSafe + error extraction in one call.
 * Throws on network failure, non-JSON body, or !r.ok (using the API's
 * `error` + `errors[]` fields when present). Returns parsed data on 2xx.
 *
 *   const data = await fetchJsonSafe(`/api/creators/${id}`, { method: 'PATCH', ... }, 'Guardar criador');
 */
export async function fetchJsonSafe(url, opts = undefined, label = 'Pedido') {
  const r = await fetch(url, opts);
  const data = await parseJsonSafe(r);
  if (!r.ok) {
    const detail = Array.isArray(data?.errors) && data.errors.length
      ? '\n\n' + data.errors.join('\n')
      : '';
    throw new Error((data?.error || `${label} falhou · HTTP ${r.status}`) + detail);
  }
  return data;
}
