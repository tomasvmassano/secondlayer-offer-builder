#!/usr/bin/env node
/**
 * Case-studies URL audit
 *
 * Pings every URL in app/lib/casesDb.js and reports status. Skool/Whop/
 * Substack slugs change as creators migrate; this catches dead links
 * before they appear on a live pitch deck.
 *
 * Usage:
 *   node scripts/audit-cases-urls.mjs
 *
 * Exit code: 0 if all URLs resolved (2xx/3xx); 1 if any returned 4xx/5xx
 * or failed to fetch. Final summary table is printed to stdout.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const casesPath = resolve(here, '..', 'app', 'lib', 'casesDb.js');
const src = readFileSync(casesPath, 'utf8');

// Extract every name + url pair from the file. The DB is JS not JSON, so a
// regex grab is simpler than dynamic import + esbuild.
const rowRegex = /name:\s*'([^']+)'[\s\S]*?url:\s*'([^']+)'/g;
const rows = [];
const seen = new Set();
let m;
while ((m = rowRegex.exec(src))) {
  const name = m[1].trim();
  const url = m[2].trim();
  const key = `${name}|${url}`;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push({ name, url });
}

console.log(`Auditing ${rows.length} unique URLs…\n`);

// Real browser UA to defeat bot-detection on hosts like Cloudflare. Some
// case-study URLs (aliabdaal.com, etc.) return 403 to a plain node-fetch UA
// even though the URL loads fine in a browser.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Hosts that gate ALL non-browser traffic behind a Cloudflare JS challenge.
// We can't pass it from a script — the URL is fine in real browsers, so we
// treat 403 from these hosts as "presumed good, verify manually". Listed
// explicitly so we don't silently whitelist any future 403s.
const PRESUMED_GOOD_403 = new Set([
  'aliabdaal.com',
  'academy.aliabdaal.com',
]);

async function check(row) {
  const start = Date.now();
  try {
    const headers = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' };
    // HEAD first (cheaper); some hosts reject HEAD → fall back to GET.
    let res = await fetch(row.url, { method: 'HEAD', redirect: 'follow', headers, signal: AbortSignal.timeout(10_000) });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(row.url, { method: 'GET', redirect: 'follow', headers, signal: AbortSignal.timeout(10_000) });
    }
    return { ...row, status: res.status, finalUrl: res.url, ms: Date.now() - start };
  } catch (err) {
    return { ...row, status: 'ERR', error: err.message || String(err), ms: Date.now() - start };
  }
}

const results = await Promise.all(rows.map(check));

const failures = [];
const redirected = [];
const presumedGood = [];
for (const r of results) {
  const host = (() => { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const isPresumedGood = r.status === 403 && PRESUMED_GOOD_403.has(host);
  const ok = (typeof r.status === 'number' && r.status >= 200 && r.status < 400) || isPresumedGood;
  const redir = r.finalUrl && r.finalUrl !== r.url && !r.finalUrl.startsWith(r.url);
  const tag = ok ? (isPresumedGood ? '?' : redir ? '↪' : '✓') : '✗';
  const status = typeof r.status === 'number' ? r.status : r.status;
  console.log(`  ${tag} ${String(status).padEnd(4)} ${r.ms}ms  ${r.name}`);
  console.log(`        ${r.url}`);
  if (isPresumedGood) console.log('        (Cloudflare bot-blocked — verify manually)');
  if (redir) console.log(`        → ${r.finalUrl}`);
  if (r.error) console.log(`        ! ${r.error}`);
  if (!ok) failures.push(r);
  else if (isPresumedGood) presumedGood.push(r);
  else if (redir) redirected.push(r);
}

console.log(`\n${results.length} checked · ${failures.length} failed · ${redirected.length} redirected · ${presumedGood.length} presumed good (bot-blocked)`);
process.exit(failures.length > 0 ? 1 : 0);
