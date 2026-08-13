/**
 * GET /api/admin/sumit-debug
 *
 * Temporary diagnostic endpoint — calls the SUMIT credential-validation endpoint
 * from Vercel's server and returns the raw HTTP status + body, so we can see
 * exactly what SUMIT returns (HTML? JSON? redirect?) from production IPs.
 *
 * REMOVE THIS FILE once the SUMIT endpoint issue is resolved.
 *
 * Security: Authorization: Bearer <ADMIN_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { makeAdminSessionToken } from '@/app/api/admin/session/route'

function checkAdminAuth(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) return false
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  return token === makeAdminSessionToken(adminSecret) || token === adminSecret
}

const SUMIT_BASE = 'https://api.sumit.co.il'

async function probeEndpoint(url: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      redirect: 'manual', // don't auto-follow redirects — we want to SEE them
    })
    const text = await res.text()
    return {
      url,
      httpStatus: res.status,
      httpStatusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      bodyFirst500: text.slice(0, 500),
      bodyLength: text.length,
      isJson: (() => { try { JSON.parse(text); return true } catch { return false } })(),
    }
  } catch (err) {
    return { url, error: String(err) }
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = parseInt(process.env.SUMIT_COMPANY_ID ?? '0', 10)
  const apiKey    = process.env.SUMIT_API_PRIVATE_KEY ?? ''

  if (!companyId || !apiKey) {
    return NextResponse.json({ error: 'SUMIT env vars not set' }, { status: 500 })
  }

  const creds = { Credentials: { CompanyID: companyId, APIKey: apiKey } }

  // Probe multiple SUMIT endpoints to find which ones work
  const results = await Promise.all([
    probeEndpoint(`${SUMIT_BASE}/accounting/customers/search/`, {
      ...creds,
      Filter: { PageSize: 1 },
    }),
    probeEndpoint(`${SUMIT_BASE}/accounting/documents/list/`, {
      ...creds,
      Filter: { PageSize: 1 },
    }),
    probeEndpoint(`${SUMIT_BASE}/billing/payments/list/`, {
      ...creds,
      Filter: { PageSize: 1 },
    }),
    probeEndpoint(`${SUMIT_BASE}/users/api/authenticate/`, {
      Credentials: { CompanyID: companyId, APIKey: apiKey },
    }),
    probeEndpoint(`${SUMIT_BASE}/accounting/company/get/`, creds),
  ])

  return NextResponse.json({ probes: results })
}
