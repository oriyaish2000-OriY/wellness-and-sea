/**
 * POST /api/checkout/class/card
 *
 * Flow 2 — Class Booking (Student → Instructor) — form POST handler.
 *
 * Called by SUMIT's payments.js after card tokenization. The form POSTs here
 * with `og-token` (SingleUseToken) + `enrollment_id` as form fields.
 *
 * Calls /billing/payments/multivendorcharge/ to split the charge:
 *   • Instructor's portion (base × 0.95) → instructor's own SUMIT account (direct)
 *   • Platform fee         (base × 0.10) → platform's SUMIT account
 *
 * On success: marks enrollment as paid, redirects to success page.
 * On failure: redirects back to pay page with ?error=... query param.
 *
 * Security:
 *   - Auth required (must be the enrolled student)
 *   - All amounts loaded server-side — never from form data
 *   - Vendor API key decrypted in memory only, never logged or persisted in plain text
 *   - Idempotency: already-paid enrollments redirect without re-charging
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { chargeMultiVendor }    from '@/lib/payments/SumitMarketplace'
import { calcClassBookingSplit } from '@/lib/payments/commissionUtils'
import { decryptApiKey, isEncrypted } from '@/lib/encryption'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getUserEmail(
  supabase: ReturnType<typeof adminClient>,
  userId: string
): Promise<string> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email ?? ''
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Parse form data ───────────────────────────────────────────────────────
    const formData     = await request.formData()
    const ogToken      = formData.get('og-token')      as string | null
    const enrollmentId = formData.get('enrollment_id') as string | null

    if (!ogToken || !enrollmentId) {
      console.warn('[checkout/class/card] Missing og-token or enrollment_id in form data')
      return NextResponse.redirect(`${APP_URL}/?error=invalid_request`)
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!UUID_RE.test(enrollmentId)) {
      return NextResponse.redirect(`${APP_URL}/?error=invalid_request`)
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${APP_URL}/auth/login`)
    }

    // ── Load enrollment + booking details ─────────────────────────────────────
    const { data: enrollment } = await supabase
      .from('class_enrollments')
      .select(`
        id, payment_status, booking_id, student_id,
        booking:bookings(
          id, booking_date, class_type, price_per_student,
          instructor:profiles!bookings_instructor_id_fkey(id, full_name)
        )
      `)
      .eq('id', enrollmentId)
      .eq('student_id', user.id)
      .neq('payment_status', 'cancelled')
      .single()

    if (!enrollment) {
      return NextResponse.redirect(`${APP_URL}/classes?error=not_found`)
    }

    // Idempotency: already paid
    if (enrollment.payment_status === 'paid') {
      const bookingId = enrollment.booking_id as string
      return NextResponse.redirect(`${APP_URL}/classes/${bookingId}/pay`)
    }

    const booking = enrollment.booking as unknown as {
      id: string
      booking_date: string
      class_type?: string
      price_per_student?: number
      instructor?: { id?: string; full_name?: string }
    } | null

    const basePriceILS = (booking?.price_per_student ?? 0) as number
    if (basePriceILS <= 0) {
      return NextResponse.redirect(`${APP_URL}/classes?error=invalid_price`)
    }

    // ── Compute split ──────────────────────────────────────────────────────────
    const split = calcClassBookingSplit(basePriceILS)

    // ── Verify instructor has a verified SUMIT account ─────────────────────────
    const instructorId = booking?.instructor?.id
    if (!instructorId) {
      return NextResponse.redirect(`${APP_URL}/classes/${booking?.id ?? ''}?error=instructor_not_found`)
    }

    const db = adminClient()
    const { data: instructorConfig } = await db
      .from('vendor_payment_config')
      .select('sumit_company_id, sumit_api_key, onboarding_status')
      .eq('profile_id', instructorId)
      .maybeSingle()

    if (!instructorConfig || instructorConfig.onboarding_status !== 'verified') {
      const bookingId = enrollment.booking_id as string
      return NextResponse.redirect(`${APP_URL}/classes/${bookingId}/pay?error=instructor_sumit_unverified`)
    }

    if (!instructorConfig.sumit_api_key || !isEncrypted(instructorConfig.sumit_api_key)) {
      console.error(`[checkout/class/card] Instructor ${instructorId} has no valid encrypted API key`)
      const bookingId = enrollment.booking_id as string
      return NextResponse.redirect(`${APP_URL}/classes/${bookingId}/pay?error=internal`)
    }

    // Decrypt vendor key in memory
    let instructorApiKey: string
    try {
      instructorApiKey = decryptApiKey(instructorConfig.sumit_api_key)
    } catch (err) {
      console.error('[checkout/class/card] Failed to decrypt instructor API key:', err)
      const bookingId = enrollment.booking_id as string
      return NextResponse.redirect(`${APP_URL}/classes/${bookingId}/pay?error=internal`)
    }

    // ── Call SUMIT multivendorcharge ──────────────────────────────────────────
    let chargeResult: Awaited<ReturnType<typeof chargeMultiVendor>>
    const bookingId = enrollment.booking_id as string

    try {
      chargeResult = await chargeMultiVendor({
        singleUseToken: ogToken,
        customerName:   user.email ?? 'תלמידה',
        customerEmail:  await getUserEmail(db, user.id),
        vendorItem: {
          name:        booking?.class_type ?? 'שיעור',
          description: `${booking?.class_type ?? 'שיעור'} — ${booking?.booking_date ?? ''}`,
          unitPrice:   split.instructorPayout,
          companyId:   instructorConfig.sumit_company_id,
          apiKey:      instructorApiKey,
        },
        platformCommissionILS: split.platformRevenue,
        documentDescription:   `${booking?.class_type ?? 'שיעור'} — ${booking?.booking_date ?? ''}`,
        externalIdentifier:    `class_booking:${enrollmentId}`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[checkout/class/card] chargeMultiVendor failed for enrollment ${enrollmentId}:`, msg)
      return NextResponse.redirect(`${APP_URL}/classes/${bookingId}/pay?error=payment_failed`)
    }

    if (!chargeResult.valid) {
      console.warn(`[checkout/class/card] Payment not valid for enrollment ${enrollmentId}`)
      return NextResponse.redirect(`${APP_URL}/classes/${bookingId}/pay?error=payment_invalid`)
    }

    // ── Update enrollment to paid ─────────────────────────────────────────────
    const { error: dbError } = await db
      .from('class_enrollments')
      .update({
        payment_status:          'paid',
        payment_method:          'sumit',
        amount_paid:             split.studentPays,
        tranzila_transaction_id: String(chargeResult.paymentId),
        vendor_sumit_company_id: instructorConfig.sumit_company_id,
      })
      .eq('id', enrollmentId)
      .eq('payment_status', 'pending_direct')

    if (dbError) {
      console.error(
        `[checkout/class/card] CRITICAL: Payment ${chargeResult.paymentId} charged but ` +
        `enrollment ${enrollmentId} DB update failed: ${dbError.message}`
      )
    }

    console.log(
      `[checkout/class/card] Enrollment ${enrollmentId} paid — ` +
      `SUMIT PaymentID ${chargeResult.paymentId}, ` +
      `₪${split.studentPays} charged (instructor ₪${split.instructorPayout} + platform ₪${split.platformRevenue}). ` +
      `Instructor (CompanyID ${instructorConfig.sumit_company_id}) received their share directly.`
    )

    return NextResponse.redirect(`${APP_URL}/classes/${bookingId}/pay`)

  } catch (err) {
    console.error('[checkout/class/card] Unhandled error:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(`${APP_URL}/?error=internal`)
  }
}
