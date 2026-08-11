/**
 * /admin/payouts — Vendor Payout Dashboard (Server Component)
 *
 * Auth flow (secret never reaches client-side JS):
 *   1. First visit: /admin/payouts?secret=<ADMIN_SECRET>
 *      → server redirects to /api/admin/session which sets an HttpOnly cookie
 *      → then redirects back here (no secret in URL)
 *   2. Subsequent visits: cookie-only auth (no secret in URL or props)
 *
 * The mark-paid action is a Server Action (actions.ts) that re-checks the
 * cookie on the server — ADMIN_SECRET is never serialized into the HTML.
 */

import { redirect } from 'next/navigation'
import { cookies }  from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { PayoutsClient } from './PayoutsClient'
import { makeAdminSessionToken } from '@/app/api/admin/session/route'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string }>
}) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    return (
      <div className="p-8 text-red-600 font-medium">
        ADMIN_SECRET environment variable is not configured.
      </div>
    )
  }

  // ── Auth: check HttpOnly session cookie first ──────────────────────────────
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('admin_session')?.value
  // Compare against HMAC — raw secret is never stored in cookie (M-D)
  const hasCookie = sessionCookie === makeAdminSessionToken(adminSecret)

  if (!hasCookie) {
    // Fall back to query param — redirect to session handler which sets cookie
    const params = await searchParams
    if (params.secret === adminSecret) {
      redirect(`${APP_URL}/api/admin/session?secret=${encodeURIComponent(adminSecret)}&next=/admin/payouts`)
    }

    // Neither cookie nor valid secret → access denied
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl border shadow-sm p-8 max-w-sm w-full text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">גישה מוגבלת</h1>
          <p className="text-sm text-gray-500">
            גש לדף זה עם <code className="bg-gray-100 px-1 rounded">?secret=...</code>
          </p>
        </div>
      </div>
    )
  }

  const db = adminClient()

  // Fetch pending bookings payouts
  const { data: bookings } = await db
    .from('bookings')
    .select(`
      id, booking_date, start_time, end_time,
      total_price, host_payout, platform_fee,
      vendor_payout_status, vendor_payout_paid_at, vendor_payout_notes,
      vendor_sumit_company_id, tranzila_transaction_id,
      created_at, confirmed_at,
      venue:venues ( id, title, location_city ),
      instructor:profiles!bookings_instructor_id_fkey ( id, full_name )
    `)
    .eq('status', 'confirmed')
    .eq('vendor_payout_status', 'pending')
    .order('confirmed_at', { ascending: false })

  // Fetch pending enrollment payouts
  const { data: enrollments } = await db
    .from('class_enrollments')
    .select(`
      id, amount_paid,
      vendor_payout_status, vendor_payout_paid_at, vendor_payout_notes,
      vendor_sumit_company_id, tranzila_transaction_id, created_at,
      class:instructor_classes (
        id, title, instructor_id,
        instructor:profiles!instructor_classes_instructor_id_fkey ( id, full_name )
      ),
      student:profiles!class_enrollments_student_id_fkey ( id, full_name )
    `)
    .eq('payment_status', 'paid')
    .eq('vendor_payout_status', 'pending')
    .order('created_at', { ascending: false })

  const totalBookingsAmount    = (bookings ?? []).reduce(
    (s, b) => s + ((b.platform_fee as number | null) ?? ((b.total_price as number ?? 0) - (b.host_payout as number ?? 0))), 0
  )
  const totalEnrollmentsAmount = (enrollments ?? []).reduce(
    (s, e) => s + Math.round(((e.amount_paid as number | null) ?? 0) * (10 / 105)), 0
  )

  const summary = {
    total_pending_bookings:    bookings?.length    ?? 0,
    total_pending_enrollments: enrollments?.length ?? 0,
    total_amount_ils:          totalBookingsAmount + totalEnrollmentsAmount,
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <PayoutsClient
        summary={summary}
        bookings={(bookings ?? []) as unknown as Parameters<typeof PayoutsClient>[0]['bookings']}
        enrollments={(enrollments ?? []) as unknown as Parameters<typeof PayoutsClient>[0]['enrollments']}
      />
    </main>
  )
}
