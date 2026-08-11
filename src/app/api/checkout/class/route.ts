/**
 * POST /api/checkout/class
 *
 * Flow 2 — Class Booking (Student → Instructor)
 *
 * Commission model (symmetric — platform earns 10% of base):
 *   Student pays:      base_price × 1.05  (5% markup — payer's commission)
 *   Instructor gets:   base_price × 0.95  (5% deduction — provider's commission)
 *   Platform earns:    10% of base_price total
 *
 * All money lands on PLATFORM's SUMIT account. Platform owes instructor base×0.95
 * (tracked in DB via vendor_payout_status = 'pending').
 *
 * Body: { enrollment_id: string }
 * Returns: { checkout_url: string } on success. Returns 4xx/5xx on failure — NO free confirmation fallback.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { calcClassBookingSplit } from '@/lib/payments/commissionUtils'
import {
  isSumitConfigured,
  createClassBookingPaymentUrl,
} from '@/lib/payments/SumitMarketplace'

// Service client for vendor_payment_config lookups (bypasses RLS)
function makeServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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
            id, full_name
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
      instructor?: { id?: string; full_name?: string }
    } | null

    const basePriceILS = booking?.price_per_student ?? 0

    if (basePriceILS <= 0) {
      return NextResponse.json({ error: 'Invalid class price' }, { status: 400 })
    }

    // ── Commission split ──────────────────────────────────────────────────────
    const split = calcClassBookingSplit(basePriceILS)

    // Load student profile for customer info
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // ── SUMIT check ───────────────────────────────────────────────────────────
    if (!isSumitConfigured()) {
      console.error('[checkout/class] SUMIT is not configured — cannot process payment')
      return NextResponse.json({ error: 'מערכת התשלומים אינה זמינה. אנא נסי שוב מאוחר יותר.' }, { status: 503 })
    }

    // ── Check instructor has a verified SUMIT account (trust check) ───────────
    const instructorId = booking?.instructor?.id
    if (!instructorId) {
      return NextResponse.json({ error: 'לא נמצאה המדריכה.' }, { status: 400 })
    }

    const svcClient = makeServiceClient()
    const { data: instructorPaymentConfig } = await svcClient
      .from('vendor_payment_config')
      .select('onboarding_status, sumit_company_id')
      .eq('profile_id', instructorId)
      .maybeSingle()

    if (!instructorPaymentConfig || instructorPaymentConfig.onboarding_status !== 'verified') {
      return NextResponse.json(
        {
          error:
            'המדריכה טרם חיברה חשבון SUMIT מאומת. ' +
            'לא ניתן להירשם לשיעור עד שהמדריכה תשלים את תהליך ההצטרפות.',
          code: 'INSTRUCTOR_SUMIT_NOT_VERIFIED',
        },
        { status: 422 }
      )
    }

    try {
      // Payment goes to PLATFORM's SUMIT account via platform credentials
      const { checkoutUrl } = await createClassBookingPaymentUrl({
        enrollmentId,
        studentId:        user.id,
        totalILS:         split.studentPays,
        instructorPayout: split.instructorPayout,
        className:        booking?.class_type ?? 'שיעור',
        bookingDate:      booking?.booking_date ?? '',
        customerName:     studentProfile?.full_name ?? '',
        customerEmail:    user.email ?? '',
      })
      // Store vendor SUMIT company ID on the enrollment for payout tracking
      await svcClient
        .from('class_enrollments')
        .update({ vendor_sumit_company_id: instructorPaymentConfig.sumit_company_id })
        .eq('id', enrollmentId)
      console.log(
        `[SUMIT Flow2] Payment URL created for enrollment ${enrollmentId}. ` +
        `Student pays ₪${split.studentPays} to PLATFORM account. Instructor (CompanyID ${instructorPaymentConfig.sumit_company_id}) payout pending.`
      )
      return NextResponse.json({ checkout_url: checkoutUrl })
    } catch (err) {
      console.error('[SUMIT Flow2] createClassBookingPaymentUrl failed:', err)
      return NextResponse.json({ error: 'שגיאה ביצירת דף התשלום. אנא נסי שוב.' }, { status: 502 })
    }
  } catch (e) {
    console.error('[checkout/class] Unhandled error:', e)
    return NextResponse.json({ error: 'Class checkout failed' }, { status: 500 })
  }
}
