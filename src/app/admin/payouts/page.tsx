/**
 * /admin/payouts — Vendor Payout Dashboard (Server Component)
 *
 * Protected by ADMIN_SECRET cookie or query param for browser access.
 * Shows all confirmed bookings/enrollments where vendor payment is pending.
 *
 * Access: /admin/payouts?secret=<ADMIN_SECRET>
 * The secret is stored in a session cookie on first valid access.
 */

import { createClient } from '@supabase/supabase-js'
import { PayoutsClient } from './PayoutsClient'

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

  const params = await searchParams

  if (params.secret !== adminSecret) {
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

  // Commission owed to platform (platform_fee for bookings, ~10% of base for enrollments)
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
        bookings={(bookings ?? []) as Parameters<typeof PayoutsClient>[0]['bookings']}
        enrollments={(enrollments ?? []) as Parameters<typeof PayoutsClient>[0]['enrollments']}
        adminSecret={adminSecret}
      />
    </main>
  )
}
