/**
 * Google Sheets API client — service-account auth, read + write a single cell.
 *
 * Used by syncEmailToSheet to push scraped contact emails into the operator's
 * outreach Google Sheet. Designed to be:
 *   - Fail-safe: every function returns null/false on failure, never throws.
 *     Callers can fire-and-forget without breaking the scrape on auth issues.
 *   - Cost-free: Google Sheets API is free at our volume (300 reads/min,
 *     60 writes/min) — well below the rate limits.
 *
 * Auth: signs a JWT with the service account's RS256 private key, exchanges
 * for an OAuth access token (1h TTL), caches it across requests. No external
 * dependency — uses the already-installed `jose` package.
 *
 * Required env:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — full JSON of the service account key,
 *                                 stringified. Contains client_email +
 *                                 private_key. The sheet must be shared
 *                                 with client_email (Editor permission).
 */

import { importPKCS8, SignJWT } from 'jose';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// In-memory token cache. The token TTL is 3600s; we refresh 60s early.
let cachedToken = null;
let cachedTokenExpiry = 0;

function getServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry - 60_000) return cachedToken;
  const sa = getServiceAccount();
  if (!sa?.private_key || !sa?.client_email) return null;
  try {
    const privateKey = await importPKCS8(sa.private_key, 'RS256');
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(sa.client_email)
      .setSubject(sa.client_email)
      .setAudience(TOKEN_URL)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (!data.access_token) return null;
    cachedToken = data.access_token;
    cachedTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    return cachedToken;
  } catch {
    return null;
  }
}

/**
 * Read a range from a sheet. Returns a 2D array of values, or null on failure.
 * Empty cells render as empty strings; missing trailing cells are clipped by
 * the API so each row's length can differ from the header row.
 *
 * @param {string} sheetId - the spreadsheet ID (the long token from the URL)
 * @param {string} range   - A1 notation, e.g. "Sheet1!A1:Z2000"
 */
export async function readSheet(sheetId, range) {
  if (!sheetId || !range) return null;
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const r = await fetch(`${SHEETS_API}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.values || [];
  } catch {
    return null;
  }
}

/**
 * Write a single value to a single cell. Returns true on success.
 *
 * @param {string} sheetId - the spreadsheet ID
 * @param {string} range   - A1 notation for a single cell, e.g. "Sheet1!E42"
 * @param {string|number} value - the value to write
 */
export async function writeCell(sheetId, range, value) {
  if (!sheetId || !range) return false;
  const token = await getAccessToken();
  if (!token) return false;
  try {
    const r = await fetch(
      `${SHEETS_API}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [[value]] }),
      }
    );
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Convert a 0-indexed column number to A1 letter notation.
 *   0 → "A", 25 → "Z", 26 → "AA", 27 → "AB", ...
 * Used to build the write-range from a column index discovered in the headers.
 */
export function colNumToLetter(n) {
  if (n < 0) return '';
  let s = '';
  let x = n;
  while (x >= 0) {
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26) - 1;
  }
  return s;
}

export function hasSheetsConfig() {
  return !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !!process.env.EMAIL_SYNC_SHEET_ID;
}
