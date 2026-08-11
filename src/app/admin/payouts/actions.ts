'use server'

/**
 * Server Actions for the admin payouts dashboard.
 *
 * These run on the server only — ADMIN_SECRET is never sent to the browser.
 * Auth is verified by checking the HttpOnly `admin_session` cookie (set via
 * /api/admin/session when the admin first logs in with the correct secret).
 */

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { makeAdminSessionToken } from '@/app/api/admin/session/route'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function checkAdminAuth(): Promise<boolean> {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) return false
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  // Compare against HMAC — raw secret is never stored in cookie (M-D)
  return session === makeAdminSessionToken(adminSecret)
}

export async function markVendorPayoutPaid(
  entityType: 'booking' | 'enrollment',
  entityId:   string,
  notes:      string
): Promise<{ success?: boolean; error?: string }> {
  if (!(await checkAdminAuth())) {
    return { error: 'Unauthorized' }
  }

  if (!UUID_RE.test(entityId)) {
    return { error: 'Invalid entity_id format' }
  }

  const db    = adminClient()
  const table = entityType === 'booking' ? 'bookings' : 'class_enrollments'

  const { data, error } = await db
    .from(table)
    .update({
      vendor_payout_status:  'paid',
      vendor_payout_paid_at: new Date().toISOString(),
      vendor_payout_notes:   notes.trim() || null,
    })
    .eq('id', entityId)
    .eq('vendor_payout_status', 'pending')
    .select('id')
    .single()

  if (error) {
    console.error('[admin/markVendorPayoutPaid] DB error:', error.message)
    return { error: 'Database error' }
  }

  if (!data) {
    return { error: 'Record not found or already marked as paid' }
  }

  console.log(`[admin] ${table} ${entityId} marked as paid via server action`)
  return { success: true }
}
