/**
 * GET /api/admin/vendor-payouts
 *
 * Returns all confirmed bookings and class enrollments where vendor payout
 * is still pending — i.e., money collected by platform but not yet transferred
 * to the vendor's bank account.
 *
 * Since payments go directly to the vendor's SUMIT account, the platform
 * must separately collect its commission from each vendor.
 * This endpoint powers the admin commission collection dashboard.
 *
 * Security: Authorization: Bearer <ADMIN_SECRET>
 *
 * Response:
 * {
 *   summary: { total_pending_bookings, total_pending_enrollments, total_amount_ils }
 *   bookings: [...]
 *   enrollments: [...]
 * }
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

function checkAdminAuth(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) return false
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  return token === makeAdminSessionToken(adminSecret) || token === adminSecret
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Rate-limit by IP — 20 per hour
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await checkRateLimitDB(`admin_bearer:${ip}`, 20, 3600)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = adminClient()

  // Confirmed bookings with pending vendor payout
  const { data: bookings, error: bookingsError } = await db
    .from('bookings')
    .select(`
      id,
      booking_date,
      start_time,
      end_time,
      total_price,
      host_payout,
      platform_fee,
      vendor_payout_status,
      vendor_payout_paid_at,
      vendor_payout_notes,
      vendor_sumit_company_id,
      tranzila_transaction_id,
      created_at,
      confirmed_at,
      venue:venues ( id, title, location_city ),
      instructor:profiles!bookings_instructor_id_fkey ( id, full_name )
    `)
    .eq('status', 'confirmed')
    .eq('vendor_payout_status', 'pending')
    .order('confirmed_at', { ascending: false })

  if (bookingsError) {
    console.error('[admin/vendor-payouts] bookings query error:', bookingsError.message)
    return NextResponse.json({ error: 'Database error', detail: bookingsError.message }, { status: 500 })
  }

  // Confirmed class enrollments with pending vendor payout
  const { data: enrollments, error: enrollmentsError } = await db
    .from('class_enrollments')
    .select(`
      id,
      payment_status,
      amount_paid,
      vendor_payout_status,
      vendor_payout_paid_at,
      vendor_payout_notes,
      vendor_sumit_company_id,
      tranzila_transaction_id,
      created_at,
      booking:bookings (
        id, price_per_student, class_type,
        instructor:profiles!bookings_instructor_id_fkey ( id, full_name )
      ),
      student:profiles!class_enrollments_student_id_fkey ( id, full_name )
    `)
    .eq('payment_status', 'paid')
    .eq('vendor_payout_status', 'pending')
    .order('created_at', { ascending: false })

  if (enrollmentsError) {
    console.error('[admin/vendor-payouts] enrollments query error:', enrollmentsError.message)
    return NextResponse.json({ error: 'Database error', detail: enrollmentsError.message }, { status: 500 })
  }

  const totalBookingsAmount = (bookings ?? []).reduce((sum, b) => sum + (b.host_payout ?? 0), 0)
  const totalEnrollmentsAmount = (enrollments ?? []).reduce((sum, e) => {
    // Instructor receives base * 0.95 — compute from price_per_student (base price)
    const basePriceILS = (e.booking as { price_per_student?: number } | null)?.price_per_student ?? 0
    const instructorPayout = basePriceILS > 0
      ? Math.floor(basePriceILS * 0.95)  // base * 0.95
      : Math.floor((e.amount_paid ?? 0) * 0.95 / 1.05)  // fallback: reverse the markup
    return sum + instructorPayout
  }, 0)

  return NextResponse.json({
    summary: {
      total_pending_bookings:   bookings?.length ?? 0,
      total_pending_enrollments: enrollments?.length ?? 0,
      total_amount_ils: totalBookingsAmount + totalEnrollmentsAmount,
    },
    bookings:    bookings ?? [],
    enrollments: enrollments ?? [],
  })
}
