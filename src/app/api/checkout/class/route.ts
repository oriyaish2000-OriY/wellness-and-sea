/**
 * POST /api/checkout/class
 *
 * Flow 2 — Class Booking (Student → Instructor)
 *
 * Commission model (symmetric — platform earns 10% of base):
 *   Student pays:      base_price × 1.05  (5% service fee)
 *   Instructor gets:   base_price × 0.95  (5% deducted via Cardcom Meaged dashboard)
 *   Platform earns:    10% of base_price
 *
 * Body: { enrollment_id: string }
 * Returns: { checkout_url: string } on success
 *          { checkout_url: null, fallback: 'direct', ... } when instructor has no Sapak
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  isCardcomConfigured,
  createClassBookingPayment,
} from '@/lib/payments/cardcomPaymentService'
import { calcClassBookingSplit } from '@/lib/payments/commissionUtils'

export async function POST(request: NextRequest) {
  try {
    const body         = await request.json()
    const enrollmentId = body.enrollment_id as string

    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user)         return NextResponse.json({ error: 'Unauthorized' },          { status: 401 })
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

    const basePriceILS = booking?.price_per_student ?? 0

    if (basePriceILS <= 0) {
      return NextResponse.json({ error: 'Invalid class price' }, { status: 400 })
    }

    // ── Commission split ──────────────────────────────────────────────────────
    const split = calcClassBookingSplit(basePriceILS)
    const instructorSapakNumber = booking?.instructor?.grow_merchant_id ?? ''

    // Load student profile for Document customer info
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // ── Cardcom + instructor has Sapak → LowProfile payment ──────────────────
    if (isCardcomConfigured() && instructorSapakNumber) {
      try {
        const { checkoutUrl, lowProfileId } = await createClassBookingPayment({
          enrollmentId,
          studentId:            user.id,
          studentPaysILS:       split.studentPays,
          instructorSapakNumber,
          className:            booking?.class_type ?? 'שיעור',
          bookingDate:          booking?.booking_date ?? '',
          customerName:         studentProfile?.full_name ?? '',
          customerEmail:        user.email ?? '',
        })

        // Save LowProfileId to DB — must be done before redirecting buyer
        if (lowProfileId) {
          const serviceClient = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          await serviceClient
            .from('class_enrollments')
            .update({ cardcom_low_profile_id: lowProfileId })
            .eq('id', enrollmentId)
        }

        console.log(
          `[Cardcom Flow2] LowProfile ${lowProfileId} created for enrollment ${enrollmentId}. ` +
          `Student pays ₪${split.studentPays}, ` +
          `Instructor gets ₪${split.instructorPayout}, ` +
          `Platform earns ₪${split.platformRevenue}`
        )

        return NextResponse.json({ checkout_url: checkoutUrl })
      } catch (err) {
        console.error('[Cardcom Flow2] createClassBookingPayment failed:', err)
        // Fall through to direct fallback
      }
    }

    // ── Instructor not onboarded or Cardcom not configured → fallback ─────────
    console.warn(
      `[Cardcom Flow2] Instructor ${booking?.instructor?.id ?? 'unknown'} ` +
      (instructorSapakNumber ? 'Cardcom call failed' : 'has no Sapak number') +
      ' — returning direct payment fallback'
    )

    return NextResponse.json({
      checkout_url:     null,
      fallback:         'direct',
      basePriceILS,
      studentPays:      split.studentPays,
      instructorPayout: split.instructorPayout,
      platformRevenue:  split.platformRevenue,
      className:        booking?.class_type,
      bookingDate:      booking?.booking_date,
    })
  } catch (e) {
    console.error('[checkout/class] Unhandled error:', e)
    return NextResponse.json({ error: 'Class checkout failed' }, { status: 500 })
  }
}
