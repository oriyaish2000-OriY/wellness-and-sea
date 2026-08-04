/**
 * POST /api/checkout/class
 *
 * Flow 2 — Class Booking (Student → Instructor)
 * Creates a Grow Marketplace payment link with split:
 *   - Instructor sub-merchant receives 90% of price_per_student
 *   - Platform main account receives 10%
 *
 * Body: { enrollment_id: string }
 *
 * On success returns { checkout_url: string }
 * On failure (Grow not configured / instructor not onboarded) returns
 * { checkout_url: null, fallback: 'direct' } so the client can show
 * the manual Bit/PayBox payment flow instead.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isGrowConfigured,
  createClassPaymentLink,
} from '@/lib/grow/growPaymentService'
import { calcClassBookingSplit } from '@/lib/grow/commissionUtils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const enrollmentId: string = body.enrollment_id

    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!enrollmentId) {
      return NextResponse.json({ error: 'Missing enrollment_id' }, { status: 400 })
    }

    // ── Load enrollment + class details ───────────────────────────────────
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

    const priceILS = booking?.price_per_student ?? 0

    if (priceILS <= 0) {
      return NextResponse.json({ error: 'Invalid class price' }, { status: 400 })
    }

    const split                  = calcClassBookingSplit(priceILS)
    const instructorGrowMerchantId = booking?.instructor?.grow_merchant_id ?? ''
    const appUrl                 = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // ── Grow configured + instructor onboarded → use split payment link ───
    if (isGrowConfigured() && instructorGrowMerchantId) {
      try {
        const { checkoutUrl } = await createClassPaymentLink({
          enrollmentId,
          studentId:                user.id,
          priceILS,
          priceAgorot:              split.studentPaysAgorot,
          instructorPayoutAgorot:   split.instructorPayoutAgorot,
          instructorGrowMerchantId,
          className:                booking?.class_type ?? 'שיעור',
          bookingDate:              booking?.booking_date ?? '',
        })

        console.log(
          `[Grow Flow2] Class payment link created for enrollment ${enrollmentId}. ` +
          `Student pays ₪${split.studentPays}, Instructor gets ₪${split.instructorPayout}, ` +
          `Platform gets ₪${split.platformRevenue}`
        )
        return NextResponse.json({ checkout_url: checkoutUrl })
      } catch (growErr) {
        console.error('[Grow Flow2] CreatePaymentLink failed:', growErr)
        // Fall through to manual fallback
      }
    }

    // ── Instructor not yet onboarded or Grow not configured ───────────────
    // Return fallback signal — client shows Bit/PayBox deep links
    console.warn(
      `[Grow Flow2] Instructor ${booking?.instructor?.id ?? 'unknown'} ` +
      (instructorGrowMerchantId ? 'Grow call failed' : 'has no grow_merchant_id') +
      ' — returning direct payment fallback'
    )

    return NextResponse.json({
      checkout_url: null,
      fallback: 'direct',
      // Client can use these to show Bit/PayBox links
      priceILS,
      className:   booking?.class_type,
      bookingDate: booking?.booking_date,
    })
  } catch (e) {
    console.error('[checkout/class] Unhandled error:', e)
    return NextResponse.json({ error: 'Class checkout failed' }, { status: 500 })
  }
}
