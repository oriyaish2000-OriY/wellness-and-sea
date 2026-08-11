/**
 * Step 1: SUMIT Authentication Test — PASSED
 * Credentials confirmed valid via /accounting/documents/list/ returning Status: 0
 * Run: node scripts/sumit-auth-test.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(filePath) {
  const lines = readFileSync(filePath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

loadEnv(resolve(__dirname, '../.env.local'));

const SUMIT_BASE = 'https://api.sumit.co.il';
const COMPANY_ID = Number(process.env.SUMIT_COMPANY_ID);
const API_KEY    = process.env.SUMIT_API_PRIVATE_KEY;

export const Credentials = { CompanyID: COMPANY_ID, APIKey: API_KEY };

export async function sumitPost(path, body) {
  const res = await fetch(`${SUMIT_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Credentials, ...body }),
  });
  const data = await res.json();
  return data;
}

// Quick auth check
const result = await sumitPost('/accounting/documents/list/', {
  DateFrom: '2024-01-01',
  DateTo: '2026-12-31',
});

console.log('\n=== SUMIT Authentication ===');
if (result.Status === 0) {
  console.log('[OK] Authenticated — Company ID:', COMPANY_ID);
} else {
  console.error('[FAIL]', result.UserErrorMessage);
  process.exit(1);
}
