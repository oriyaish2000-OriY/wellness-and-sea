/**
 * GET /api/webhooks/sumit/return
 *
 * SUMIT payment return redirect handler.
 *
 * After a buyer completes (or abandons) the SUMIT hosted payment page,
 * SUMIT redirects them to this URL with query params:
 *   OG-PaymentID         — integer payment ID in SUMIT system
 *   OG-ExternalIdentifier — the value we set in beginredirect (e.g. "space_rental:uuid")
 *   OG-CustomerID        — SUMIT customer ID (informational)
 *
 * SECURITY:
 *   - Never trust the amount from query params — always verify via SUMIT API
 *   - Always call verifySumitPayment before confirming any booking
 *
 * IDEMPOTENCY:
 *   - Check current status before updating to avoid double-confirm
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calcClassBookingSplit } from '@/lib/payments/commissionUtils'
import { verifySumitPayment } from '@/lib/payments/SumitMarketplace'
import {
  sendBookingConfirmedEmailToInstructor,
  sendNewBookingEmailToHost,
} from '@/lib/email'

// ─── Supabase admin client (bypasses RLS) ─────────────────────────────────────

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Email helper ─────────────────────────────────────────────────────────────

async function getUserEmail(
  supabase: ReturnType<typeof adminClient>,
  userId:   string
): Promise<string> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email ?? ''
}

// ─── Flow 1: Space Rental ─────────────────────────────────────────────────────

async function handleSpaceRentalReturn(
  supabase:   ReturnType<typeof adminClient>,
  bookingId:  string,
  paymentId:  number,
  appUrl:     string
): Promise<NextResponse> {
  // Load booking to get the expected amount (never trust URL params)
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, total_price, host_payout, booking_date, start_time, end_time,
      class_type, participants_count, instructor_id,
      venue:venues(
        title, location_address, location_city,
        host:profiles!venues_host_id_fkey(id, full_name)
      ),
      instructor:profiles!bookings_instructor_id_fkey(id, full_name)
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) {
    console.warn(`[SUMIT return:space_rental] Booking ${bookingId} not found`)
    return NextResponse.redirect(`${appUrl}/booking/${bookingId}?error=not_found`)
  }

  // Idempotency: already confirmed → redirect to success
  if (booking.status === 'confirmed') {
    console.log(`[SUMIT return:space_rental] Booking ${bookingId} already confirmed — idempotent redirect`)
    return NextResponse.redirect(`${appUrl}/booking/${bookingId}?confirmed=true`)
  }

  // Verify payment with SUMIT API
  const expectedAmount = booking.total_price as number
  const { valid, amount } = await verifySumitPayment(paymentId, expectedAmount)

  if (!valid) {
    console.warn(
      `[SUMIT return:space_rental] Payment ${paymentId} invalid for booking ${bookingId}` +
      ` (amount: ₪${amount}, expected: ₪${expectedAmount})`
    )
    return NextResponse.redirect(`${appUrl}/booking/${bookingId}?error=payment_failed`)
  }

  // Update booking to confirmed
  const { error: dbError } = await supabase
    .from('bookings')
    .update({
      status:                  'confirmed',
      tranzila_transaction_id: String(paymentId),
    })
    .eq('id', bookingId)
    .eq('status', 'pending')

  if (dbError) {
    console.error(`[SUMIT return:space_rental] DB update failed for booking ${bookingId}:`, dbError.message)
    return NextResponse.redirect(`${appUrl}/booking/${bookingId}?error=db_error`)
  }

  console.log(`[SUMIT return:space_rental] Booking ${bookingId} confirmed — PaymentID ${paymentId}, ₪${amount}`)

  // Send confirmation emails (best-effort — don't fail redirect on email error)
  try {
    const venue      = booking.venue as { title?: string; location_address?: string; location_city?: string; host?: { id?: string; full_name?: string } } | null
    const instructor = booking.instructor as { id?: string; full_name?: string } | null

    const [instructorEmail, hostEmail] = await Promise.all([
      instructor?.id  ? getUserEmail(supabase, instructor.id)  : Promise.resolve(''),
      venue?.host?.id ? getUserEmail(supabase, venue.host.id)  : Promise.resolve(''),
    ])

    const emailData = {
      instructorName:    instructor?.full_name ?? '',
      instructorEmail:   instructorEmail,
      hostName:          venue?.host?.full_name ?? '',
      hostEmail:         hostEmail,
      venueName:         venue?.title ?? '',
      venueAddress:      venue?.location_address ?? '',
      venueCity:         venue?.location_city ?? '',
      bookingDate:       booking.booking_date as string,
      startTime:         booking.start_time as string,
      endTime:           booking.end_time as string,
      totalPrice:        booking.total_price as number,
      hostPayout:        booking.host_payout as number,
      classType:         (booking.class_type as string | undefined) ?? undefined,
      participantsCount: (booking.participants_count as number | undefined) ?? undefined,
      bookingId,
    }

    await Promise.all([
      instructorEmail ? sendBookingConfirmedEmailToInstructor(emailData) : Promise.resolve(),
      hostEmail       ? sendNewBookingEmailToHost(emailData)             : Promise.resolve(),
    ])
  } catch (emailErr) {
    console.error('[SUMIT return:space_rental] Email send failed (non-fatal):', emailErr)
  }

  return NextResponse.redirect(`${appUrl}/booking/${bookingId}?confirmed=true`)
}

// ─── Flow 2: Class Booking ────────────────────────────────────────────────────

async function handleClassBookingReturn(
  supabase:     ReturnType<typeof adminClient>,
  enrollmentId: string,
  paymentId:    number,
  appUrl:       string
): Promise<NextResponse> {
  // Load enrollment + booking to get expected amount
  const { data: enrollment } = await supabase
    .from('class_enrollments')
    .select(`
      id, payment_status, booking_id, student_id,
      booking:bookings(id, price_per_student)
    `)
    .eq('id', enrollmentId)
    .single()

  if (!enrollment) {
    console.warn(`[SUMIT return:class_booking] Enrollment ${enrollmentId} not found`)
    return NextResponse.redirect(`${appUrl}/classes?error=not_found`)
  }

  // Idempotency: already paid → redirect to success
  if (enrollment.payment_status === 'paid') {
    console.log(`[SUMIT return:class_booking] Enrollment ${enrollmentId} already paid — idempotent redirect`)
    return NextResponse.redirect(`${appUrl}/classes/${enrollmentId}/success`)
  }

  // Compute expected amount using canonical split (never trust query params)
  const booking      = enrollment.booking as { id?: string; price_per_student?: number } | null
  const basePriceILS = (booking?.price_per_student ?? 0) as number

  if (basePriceILS <= 0) {
    console.error(`[SUMIT return:class_booking] Invalid price for enrollment ${enrollmentId}`)
    return NextResponse.redirect(`${appUrl}/classes?error=invalid_price`)
  }

  const split      = calcClassBookingSplit(basePriceILS)
  const studentPays = split.studentPays

  // Verify payment with SUMIT API
  const { valid, amount } = await verifySumitPayment(paymentId, studentPays)

  if (!valid) {
    console.warn(
      `[SUMIT return:class_booking] Payment ${paymentId} invalid for enrollment ${enrollmentId}` +
      ` (amount: ₪${amount}, expected: ₪${studentPays})`
    )
    return NextResponse.redirect(`${appUrl}/classes?error=payment_failed`)
  }

  // Update enrollment to paid
  const { error: enrollmentError } = await supabase
    .from('class_enrollments')
    .update({
      payment_status: 'paid',
      payment_method: 'sumit',
      amount_paid:    studentPays,
    })
    .eq('id', enrollmentId)
    .neq('payment_status', 'cancelled')

  if (enrollmentError) {
    console.error(
      `[SUMIT return:class_booking] Enrollment DB update failed for ${enrollmentId}:`,
      enrollmentError.message
    )
    return NextResponse.redirect(`${appUrl}/classes?error=db_error`)
  }

  // Also store payment ID on the booking record
  const bookingId = (enrollment.booking_id as string | null) ?? booking?.id
  if (bookingId) {
    await supabase
      .from('bookings')
      .update({ tranzila_transaction_id: String(paymentId) })
      .eq('id', bookingId)
  }

  console.log(
    `[SUMIT return:class_booking] Enrollment ${enrollmentId} marked paid — ` +
    `PaymentID ${paymentId}, ₪${amount}`
  )

  return NextResponse.redirect(`${appUrl}/classes/${enrollmentId}/success`)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const params = request.nextUrl.searchParams

    const rawPaymentId          = params.get('OG-PaymentID')
    const externalIdentifier    = params.get('OG-ExternalIdentifier') ?? ''

    // Parse paymentId
    const paymentId = rawPaymentId ? parseInt(rawPaymentId, 10) : NaN
    if (!rawPaymentId || isNaN(paymentId)) {
      console.warn('[SUMIT return] Missing or invalid OG-PaymentID:', rawPaymentId)
      return NextResponse.redirect(`${appUrl}/?error=invalid_return`)
    }

    // Parse externalIdentifier: "{flowType}:{entityId}"
    const colonIdx = externalIdentifier.indexOf(':')
    if (colonIdx === -1) {
      console.warn('[SUMIT return] OG-ExternalIdentifier format invalid:', externalIdentifier)
      return NextResponse.redirect(`${appUrl}/?error=invalid_return`)
    }

    const flowType = externalIdentifier.substring(0, colonIdx)
    const entityId = externalIdentifier.substring(colonIdx + 1)

    if (!entityId) {
      console.warn('[SUMIT return] Empty entityId in OG-ExternalIdentifier')
      return NextResponse.redirect(`${appUrl}/?error=invalid_return`)
    }

    const supabase = adminClient()

    if (flowType === 'space_rental') {
      return await handleSpaceRentalReturn(supabase, entityId, paymentId, appUrl)
    } else if (flowType === 'class_booking') {
      return await handleClassBookingReturn(supabase, entityId, paymentId, appUrl)
    } else {
      console.warn('[SUMIT return] Unknown flowType:', flowType)
      return NextResponse.redirect(`${appUrl}/?error=unknown_flow`)
    }
  } catch (err) {
    console.error('[SUMIT return] Unhandled error:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(`${appUrl}/?error=internal`)
  }
}
