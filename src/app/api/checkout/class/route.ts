/**
 * POST /api/checkout/class
 *
 * Flow 2 — Class Booking (Student → Instructor)
 *
 * Commission model (symmetric — platform earns 10% of base):
 *   Student pays:      base_price × 1.05  (5% service fee added)
 *   Instructor gets:   base_price × 0.95  (5% deducted from their payout)
 *   Platform earns:    10% of base_price  (not held — intermediary model)
 *
 * Platform issues an invoice only for its commission (10% of base),
 * NOT for the full transaction. The remainder is routed directly to the instructor.
 *
 * Body: { enrollment_id: string }
 * Returns: { checkout_url: string } on success
 *          { checkout_url: null, fallback: 'direct', studentPays, instructorPayout, ... }
 *          when instructor has not completed KYC or Summit is not configured.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isSummitConfigured,
  createClassBookingPayment,
} from '@/lib/payments/summitPaymentService'
import { calcClassBookingSplit } from '@/lib/payments/commissionUtils'

export async function POST(request: NextRequest) {
  try {
    const body         = await request.json()
    const enrollmentId = body.enrollment_id as string

    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user)        return NextResponse.json({ error: 'Unauthorized' },         { status: 401 })
    if (!enrollmentId) return NextResponse.json({ error: 'Missing enrollment_id' }, { status: 400 })

    // ── Load enrollment + class details ───────────────────────────────────────
    const { data: enrollment } = await supabase
      .from('class_enrollments')
      .select(`
        id, student_id, payment_status,
        booking:bookings(
          id, booking_date, class_type, price_per_student,
          instructor:profiles!bookings_instructor_id_fkey(
            id, full_name, grow_merchant_id
          )
        )
      `)
      .eq('id', enrollmentId)
      .eq('student_id', user.id)
      .neq('payment_status', 'cancelled')
      .single()

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    if (enrollment.payment_status === 'paid') {
      return NextResponse.json({ error: 'Already paid' }, { status: 409 })
    }

    const booking = enrollment.booking as unknown as {
      id: string
      booking_date: string
      class_type?: string
      price_per_student?: number
      instructor?: { id?: string; full_name?: string; grow_merchant_id?: string }
    } | null

    // base price = what the instructor set (price_per_student)
    const basePriceILS = booking?.price_per_student ?? 0

    if (basePriceILS <= 0) {
      return NextResponse.json({ error: 'Invalid class price' }, { status: 400 })
    }

    // ── Commission split ───────────────────────────────────────────────────────
    const split = calcClassBookingSplit(basePriceILS)
    // split.studentPays      = base × 1.05  (charged to student)
    // split.instructorPayout = base × 0.95  (routed to instructor)
    // split.platformRevenue  = base × 0.10  (kept by platform)

    const instructorMerchantId = booking?.instructor?.grow_merchant_id ?? ''

    // ── Summit + instructor onboarded → split payment ─────────────────────────
    if (isSummitConfigured() && instructorMerchantId) {
      try {
        const { checkoutUrl } = await createClassBookingPayment({
          enrollmentId,
          studentId:             user.id,
          studentPaysILS:        split.studentPays,
          instructorPayoutAgorot: split.instructorPayoutAgorot,
          instructorMerchantId,
          className:             booking?.class_type ?? 'שיעור',
          bookingDate:           booking?.booking_date ?? '',
        })

        console.log(
          `[Summit Flow2] Class payment created for enrollment ${enrollmentId}. ` +
          `Student pays ₪${split.studentPays} (incl. 5% fee), ` +
          `Instructor gets ₪${split.instructorPayout} (after 5% deduction), ` +
          `Platform earns ₪${split.platformRevenue}`
        )

        return NextResponse.json({ checkout_url: checkoutUrl })
      } catch (err) {
        console.error('[Summit Flow2] createClassBookingPayment failed:', err)
        // Fall through to direct fallback
      }
    }

    // ── Instructor not onboarded or Summit not configured → fallback ──────────
    console.warn(
      `[Summit Flow2] Instructor ${booking?.instructor?.id ?? 'unknown'} ` +
      (instructorMerchantId ? 'Summit call failed' : 'has no merchant ID') +
      ' — returning direct payment fallback'
    )

    return NextResponse.json({
      checkout_url:      null,
      fallback:          'direct',
      // Amounts for the client to display correctly
      basePriceILS,
      studentPays:       split.studentPays,        // what student should pay (base + 5%)
      instructorPayout:  split.instructorPayout,   // what instructor expects to receive
      platformRevenue:   split.platformRevenue,
      className:         booking?.class_type,
      bookingDate:       booking?.booking_date,
    })
  } catch (e) {
    console.error('[checkout/class] Unhandled error:', e)
    return NextResponse.json({ error: 'Class checkout failed' }, { status: 500 })
  }
}
