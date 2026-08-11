/**
 * POST /api/admin/vendor-payouts/mark-paid
 *
 * Marks a booking or class enrollment vendor payout as completed after
 * a manual bank transfer has been executed.
 *
 * Body: {
 *   entity_type: 'booking' | 'enrollment',
 *   entity_id:   string,   // booking.id or class_enrollment.id
 *   notes?:      string,   // e.g. bank transfer reference number
 * }
 *
 * Security: Authorization: Bearer <ADMIN_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function checkAdminAuth(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) return false
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  return token === adminSecret
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { entity_type?: unknown; entity_id?: unknown; notes?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { entity_type, entity_id, notes } = body

  if (entity_type !== 'booking' && entity_type !== 'enrollment') {
    return NextResponse.json({ error: 'entity_type must be "booking" or "enrollment"' }, { status: 400 })
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (typeof entity_id !== 'string' || !UUID_RE.test(entity_id)) {
    return NextResponse.json({ error: 'entity_id must be a valid UUID v4' }, { status: 400 })
  }

  const db = adminClient()
  const now = new Date().toISOString()
  const table = entity_type === 'booking' ? 'bookings' : 'class_enrollments'

  const { data, error } = await db
    .from(table)
    .update({
      vendor_payout_status:   'paid',
      vendor_payout_paid_at:  now,
      vendor_payout_notes:    typeof notes === 'string' ? notes.trim() || null : null,
    })
    .eq('id', entity_id)
    .eq('vendor_payout_status', 'pending') // idempotency: only update if still pending
    .select('id, vendor_payout_status, vendor_payout_paid_at')
    .single()

  if (error) {
    console.error('[admin/vendor-payouts/mark-paid] DB error:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Record not found or already marked as paid' },
      { status: 404 }
    )
  }

  console.log(`[admin/vendor-payouts/mark-paid] ${table} ${entity_id} marked as paid`)

  return NextResponse.json({
    success:          true,
    entity_type,
    entity_id:        data.id,
    payout_status:    data.vendor_payout_status,
    payout_paid_at:   data.vendor_payout_paid_at,
  })
}
