/**
 * Sync a scraped contact email to a row in the operator's Google Sheet.
 *
 * Match key: Instagram handle. The handle is the only stable identifier
 * across our CRM and the operator's manual sheet (names match unreliably,
 * URLs may be stored as full URL OR bare @handle).
 *
 * Behaviour:
 *   - Only writes to EMPTY email cells. Manual entries are never overwritten.
 *   - Fire-and-forget: every failure mode returns a result object with
 *     `ok: false` and a `reason`. Callers should not await for blocking;
 *     this should never break a scrape.
 *   - Sheet read is cached for 60s in-process to avoid hammering the API
 *     when several creators are scraped in quick succession (bulk import).
 *
 * Required env:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — see googleSheets.js
 *   EMAIL_SYNC_SHEET_ID          — the spreadsheet ID (long token in URL)
 *   EMAIL_SYNC_SHEET_TAB         — tab name (NOT the gid number). Defaults
 *                                  to the first tab ("Sheet1") if unset.
 */

import { readSheet, writeCell, colNumToLetter, hasSheetsConfig } from './googleSheets';

const CACHE_TTL_MS = 60_000;
const READ_RANGE_LIMIT = 'A1:Z2000';

// In-memory cache of the last sheet read. Survives only within one serverless
// invocation lifetime (fine — bulk imports happen in a single warm instance).
let cache = { at: 0, rows: null, igCol: -1, emailCol: -1, headers: null };

function igHandleOf(input) {
  if (!input) return null;
  const v = String(input).trim();
  if (!v) return null;
  // Try URL form first
  const m = v.match(/instagram\.com\/([^/?#]+)/i);
  if (m) return m[1].toLowerCase().replace(/^@/, '');
  // Bare handle ("@nick" or "nick"). Treat as handle iff it has no spaces
  // and no path separators.
  if (!/[\s/]/.test(v)) return v.toLowerCase().replace(/^@/, '');
  return null;
}

// Find the column index whose header matches any of the candidate substrings.
// Case-insensitive partial match — handles headers like "IG URL", "Instagram",
// "Insta Handle", "E-mail Contacto", "Email Pessoal" etc.
function findHeaderColumn(headers, candidates) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').toLowerCase().trim();
    if (!h) continue;
    for (const c of candidates) {
      if (h.includes(c)) return i;
    }
  }
  return -1;
}

async function refreshCache() {
  const sheetId = process.env.EMAIL_SYNC_SHEET_ID;
  const tabName = process.env.EMAIL_SYNC_SHEET_TAB || 'Sheet1';
  if (!sheetId) return false;
  const rows = await readSheet(sheetId, `${tabName}!${READ_RANGE_LIMIT}`);
  if (!rows || rows.length === 0) return false;
  const headers = rows[0] || [];
  const igCol = findHeaderColumn(headers, ['instagram', 'ig url', 'ig handle', 'ig ', 'insta', 'handle']);
  const emailCol = findHeaderColumn(headers, ['email', 'e-mail', 'mail']);
  if (igCol < 0 || emailCol < 0) {
    // Headers don't match the expected schema. Cache the failure too so we
    // don't hit the sheet again for 60s.
    cache = { at: Date.now(), rows: null, igCol: -1, emailCol: -1, headers };
    return false;
  }
  cache = { at: Date.now(), rows, igCol, emailCol, headers };
  return true;
}

/**
 * Sync a (igHandle, email) pair to the configured sheet.
 *
 * @param {Object} params
 * @param {string} params.igHandle - cleaned Instagram handle, no @ prefix
 *                                   (we accept URL form too and clean it)
 * @param {string} params.email    - the contact email to write
 * @returns {Promise<{ok: boolean, reason: string, cellRange?: string, row?: number}>}
 */
export async function syncEmailToSheet({ igHandle, email }) {
  if (!hasSheetsConfig()) return { ok: false, reason: 'not-configured' };
  const handle = igHandleOf(igHandle);
  if (!handle) return { ok: false, reason: 'invalid-handle' };
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return { ok: false, reason: 'invalid-email' };
  }

  // Refresh cache if stale.
  if (Date.now() - cache.at > CACHE_TTL_MS || !cache.rows) {
    const ok = await refreshCache();
    if (!ok) return { ok: false, reason: 'sheet-unavailable-or-bad-headers' };
  }

  const { rows, igCol, emailCol } = cache;
  if (!rows || igCol < 0 || emailCol < 0) {
    return { ok: false, reason: 'cache-empty' };
  }

  // Scan from row 1 (skip header at row 0). Match on cleaned handle.
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const cellHandle = igHandleOf(row[igCol]);
    if (!cellHandle || cellHandle !== handle) continue;

    // Found the row. Check whether the email cell is empty before writing —
    // never overwrite a manually-entered value.
    const existing = String(row[emailCol] || '').trim();
    if (existing) {
      return { ok: false, reason: 'cell-already-filled', row: i + 1, existing };
    }

    const tabName = process.env.EMAIL_SYNC_SHEET_TAB || 'Sheet1';
    const colLetter = colNumToLetter(emailCol);
    const cellRange = `${tabName}!${colLetter}${i + 1}`;
    const wrote = await writeCell(process.env.EMAIL_SYNC_SHEET_ID, cellRange, email);
    // Invalidate cache so the next sync sees the freshly-written value.
    if (wrote) cache.at = 0;
    return { ok: wrote, reason: wrote ? 'written' : 'write-failed', cellRange, row: i + 1 };
  }

  return { ok: false, reason: 'no-match-in-sheet', handle };
}

/**
 * Convenience wrapper: pulls handle + email off a creator object and syncs.
 * Returns silently — used in fire-and-forget call sites after scrapes.
 */
export async function syncCreatorEmail(creator) {
  if (!creator?.contactEmail) return { ok: false, reason: 'no-email-on-creator' };
  const igUrl = creator.platforms?.instagram?.url || creator.externalUrl;
  if (!igUrl) return { ok: false, reason: 'no-ig-url' };
  return syncEmailToSheet({ igHandle: igUrl, email: creator.contactEmail });
}
