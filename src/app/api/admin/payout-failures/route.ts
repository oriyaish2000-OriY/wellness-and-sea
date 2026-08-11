/**
 * GET /api/admin/payout-failures
 *
 * Returns all unresolved payout failures for admin monitoring.
 *
 * Security:
 *   - Protected by ADMIN_SECRET env var
 *   - Requires: Authorization: Bearer <ADMIN_SECRET>
 *   - Uses service role Supabase client (bypasses RLS)
 *   - No client-facing exposure — internal admin tool only
 *
 * Response: JSON array of unresolved payout_failures rows,
 *           newest first, with entity details.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimitDB } from '@/lib/rate-limit'
import { makeAdminSessionToken } from '@/app/api/admin/session/route'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Rate-limit by IP — 20 per hour ───────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await checkRateLimitDB(`admin_bearer:${ip}`, 20, 3600)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  // ── Auth: Bearer token must match HMAC of ADMIN_SECRET ───────────────────
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    console.error('[admin/payout-failures] ADMIN_SECRET env var not configured')
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const authHeader = request.headers.get('Authorization')
  const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  // Accept HMAC token (preferred) or raw secret (backward-compat for scripts)
  const validHmac = token === makeAdminSessionToken(adminSecret)
  const validRaw  = token === adminSecret
  if (!validHmac && !validRaw) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Query unresolved payout failures ─────────────────────────────────────
  const supabase = adminClient()

  const { data, error } = await supabase
    .from('payout_failures')
    .select(`
      id,
      entity_type,
      entity_id,
      vendor_sumit_company_id,
      amount_ils,
      failure_reason,
      payment_id,
      retry_count,
      created_at,
      updated_at
    `)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/payout-failures] DB query error:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({
    count:    data?.length ?? 0,
    failures: data ?? [],
  })
}
