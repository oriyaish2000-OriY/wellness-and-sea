/**
 * Step 2: Create Test Vendors (as SUMIT Customers)
 * Creates two test vendors:
 *   1. Yoga Instructor — "דניאל כהן יוגה"
 *   2. Restaurant Space Owner — "מסעדת הים הכחול"
 *
 * Run: node scripts/sumit-create-vendors.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
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

const SUMIT_BASE  = 'https://api.sumit.co.il';
const Credentials = {
  CompanyID: Number(process.env.SUMIT_COMPANY_ID),
  APIKey: process.env.SUMIT_API_PRIVATE_KEY,
};

async function sumitPost(path, body) {
  const res = await fetch(`${SUMIT_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Credentials, ...body }),
  });
  return res.json();
}

// ─── Vendor Definitions (Israeli mock data) ──────────────────────────────────

const vendors = [
  {
    label: 'Yoga Instructor',
    envKey: 'SUMIT_VENDOR_INSTRUCTOR_ID',
    Details: {
      Name: 'דניאל כהן יוגה',
      Phone: '0521234567',
      EmailAddress: 'daniel.cohen.yoga@gmail.com',
      City: 'תל אביב',
      Address: 'רחוב דיזנגוף 85',
      CompanyNumber: '315678901',   // ע.מ. mock
      ExternalIdentifier: 'vendor-instructor-001',
    },
  },
  {
    label: 'Restaurant Space Owner',
    envKey: 'SUMIT_VENDOR_RESTAURANT_ID',
    Details: {
      Name: 'מסעדת הים הכחול',
      Phone: '0529876543',
      EmailAddress: 'hayam.hakachol@restaurant.co.il',
      City: 'תל אביב',
      Address: 'טיילת תל אביב 12',
      CompanyNumber: '512345678',   // ח.פ. mock
      ExternalIdentifier: 'vendor-restaurant-001',
    },
  },
];

// ─── Create ──────────────────────────────────────────────────────────────────

async function createVendor(vendor) {
  console.log(`\n[Creating] ${vendor.label}: ${vendor.Details.Name}`);

  const result = await sumitPost('/accounting/customers/create/', {
    Details: vendor.Details,
  });

  if (result.Status !== 0) {
    console.log('Status  : ERROR');
    console.log('Message :', result.UserErrorMessage);
    console.log('Full    :', JSON.stringify(result, null, 2));
    return null;
  }

  const id = result.Data?.ID ?? result.Data;
  console.log('Status  : SUCCESS');
  console.log('SUMIT Customer ID:', id);
  return { ...vendor, sumitId: id };
}

// ─── Run ─────────────────────────────────────────────────────────────────────

console.log('\n=== Step 2: SUMIT Vendor Creation ===');

const created = [];
for (const vendor of vendors) {
  const result = await createVendor(vendor);
  if (result) created.push(result);
}

console.log('\n=== Vendor Summary ===');
for (const v of created) {
  console.log(`${v.label}`);
  console.log(`  Name     : ${v.Details.Name}`);
  console.log(`  SUMIT ID : ${v.sumitId}`);
  console.log(`  Ext ID   : ${v.Details.ExternalIdentifier}`);
}

// Save for Step 3
const output = {
  yogaInstructor: created.find(v => v.label === 'Yoga Instructor') ?? null,
  restaurantOwner: created.find(v => v.label === 'Restaurant Space Owner') ?? null,
  createdAt: new Date().toISOString(),
};

writeFileSync(
  resolve(__dirname, 'sumit-vendor-ids.json'),
  JSON.stringify(output, null, 2)
);

console.log('\n[Saved] scripts/sumit-vendor-ids.json');
if (created.length === 2) {
  console.log('[OK] Both vendors created — ready for Step 3: Split Payment');
}
