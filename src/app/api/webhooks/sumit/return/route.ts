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
 *   - Validate OG-ExternalIdentifier strictly: flowType must be known enum, entityId must be UUID v4
 *   - Verify Referer header comes from SUMIT's domain (best-effort CSRF guard)
 *   - On idempotency re-entry, verify paymentId matches stored transaction to prevent
 *     a different (lower) payment being accepted as "already confirmed"
 *
 * IDEMPOTENCY:
 *   - Check current status before updating to avoid double-confirm
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calcClassBookingSplit } from '@/lib/payments/commissionUtils'
import { verifySumitPayment, createCommissionInvoice } from '@/lib/payments/SumitMarketplace'
import {
  sendBookingConfirmedEmailToInstructor,
  sendNewBookingEmailToHost,
} from '@/lib/email'

// ─── Security helpers ─────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_FLOW_TYPES = new Set(['space_rental', 'class_booking'])

/** Returns true only for valid UUID v4 strings. */
function isValidUUID(value: string): boolean {
  return UUID_RE.test(value)
}

/**
 * Best-effort CSRF guard: verify the Referer came from SUMIT's domain.
 * SUMIT redirects the user's browser after payment, so Referer should be
 * from sumit.co.il. Absent Referer (some privacy settings strip it) is
 * allowed — main protection is verifySumitPayment (live API call).
 */
function isRefererTrusted(request: NextRequest): boolean {
  const referer = request.headers.get('referer') ?? ''
  if (!referer) return true  // absent referer: allow, API verification is the real guard
  try {
    const refUrl = new URL(referer)
    return refUrl.hostname === 'sumit.co.il' || refUrl.hostname.endsWith('.sumit.co.il')
  } catch {
    return false
  }
}

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
      tranzila_transaction_id,
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

  // Idempotency: already confirmed → verify paymentId matches, then redirect to success.
  // We must check the paymentId to prevent a different (potentially lower-amount) payment
  // from being silently accepted as "already confirmed".
  if (booking.status === 'confirmed') {
    const storedTxId = booking.tranzila_transaction_id as string | null
    if (storedTxId && storedTxId !== String(paymentId)) {
      console.error(
        `[SUMIT return:space_rental] Idempotency paymentId mismatch for booking ${bookingId}: ` +
        `stored=${storedTxId}, incoming=${paymentId} — rejecting`
      )
      return NextResponse.redirect(`${appUrl}/booking/${bookingId}?error=payment_mismatch`)
    }
    console.log(`[SUMIT return:space_rental] Booking ${bookingId} already confirmed — idempotent redirect`)
    return NextResponse.redirect(`${appUrl}/booking/${bookingId}?confirmed=true`)
  }

  // ── Guard: reject if this PaymentID was already used for ANY other confirmed booking ──
  const { data: existingPaymentUse } = await supabase
    .from('bookings')
    .select('id')
    .eq('tranzila_transaction_id', String(paymentId))
    .neq('id', bookingId)
    .limit(1)

  if (existingPaymentUse && existingPaymentUse.length > 0) {
    console.error(
      `[SUMIT return:space_rental] PaymentID ${paymentId} already used for booking ` +
      `${existingPaymentUse[0].id} — replay attack rejected for booking ${bookingId}`
    )
    return NextResponse.redirect(`${appUrl}/booking/${bookingId}?error=payment_already_used`)
  }

  // Verify payment using PLATFORM credentials (payment lives in platform's SUMIT account)
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
      vendor_payout_status:    'pending',
      confirmed_at:            new Date().toISOString(),
    })
    .eq('id', bookingId)
    .eq('status', 'pending')

  if (dbError) {
    console.error(`[SUMIT return:space_rental] DB update failed for booking ${bookingId}:`, dbError.message)
    return NextResponse.redirect(`${appUrl}/booking/${bookingId}?error=db_error`)
  }

  console.log(
    `[SUMIT return:space_rental] Booking ${bookingId} confirmed — PaymentID ${paymentId}, ₪${amount}. ` +
    `Money landed in PLATFORM's SUMIT account. Host payout ₪${booking.host_payout} pending.`
  )

  // ── Create commission invoice in PLATFORM's SUMIT (best-effort) ───────────
  // Money came to platform's account. Create invoice documenting the commission earned.
  try {
    const platformFee  = (booking.total_price as number) - (booking.host_payout as number)
    const venue        = booking.venue as { title?: string; host?: { full_name?: string } } | null
    const hostName     = venue?.host?.full_name ?? `host-booking-${bookingId}`
    const { success }  = await createCommissionInvoice({
      vendorName:    hostName,
      commissionILS: platformFee,
      referenceId:   `commission:space_rental:${bookingId}`,
      description:   `השכרת חלל — ${venue?.title ?? bookingId}`,
    })
    if (success) {
      console.log(`[SUMIT return:space_rental] Commission invoice ₪${platformFee} created for host "${hostName}"`)
    }
  } catch (commErr) {
    console.error('[SUMIT return:space_rental] Commission invoice failed (non-fatal):', commErr)
  }

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
      tranzila_transaction_id,
      booking:bookings(id, price_per_student, class_type)
    `)
    .eq('id', enrollmentId)
    .single()

  if (!enrollment) {
    console.warn(`[SUMIT return:class_booking] Enrollment ${enrollmentId} not found`)
    return NextResponse.redirect(`${appUrl}/classes?error=not_found`)
  }

  // Idempotency: already paid → verify paymentId matches, then redirect to success.
  if (enrollment.payment_status === 'paid') {
    const storedTxId = enrollment.tranzila_transaction_id as string | null
    if (storedTxId && storedTxId !== String(paymentId)) {
      console.error(
        `[SUMIT return:class_booking] Idempotency paymentId mismatch for enrollment ${enrollmentId}: ` +
        `stored=${storedTxId}, incoming=${paymentId} — rejecting`
      )
      return NextResponse.redirect(`${appUrl}/classes?error=payment_mismatch`)
    }
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

  // ── Guard: reject if this PaymentID was already used for any confirmed booking or paid enrollment ──
  const [{ data: existingBookingUse }, { data: existingEnrollmentUse }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id')
      .eq('tranzila_transaction_id', String(paymentId))
      .limit(1),
    supabase
      .from('class_enrollments')
      .select('id')
      .eq('tranzila_transaction_id', String(paymentId))
      .neq('id', enrollmentId)
      .limit(1),
  ])

  if ((existingBookingUse && existingBookingUse.length > 0) ||
      (existingEnrollmentUse && existingEnrollmentUse.length > 0)) {
    const usedIn = existingBookingUse?.length
      ? `booking ${existingBookingUse[0].id}`
      : `enrollment ${existingEnrollmentUse![0].id}`
    console.error(
      `[SUMIT return:class_booking] PaymentID ${paymentId} already used for ${usedIn} ` +
      `— replay attack rejected for enrollment ${enrollmentId}`
    )
    return NextResponse.redirect(`${appUrl}/classes?error=payment_already_used`)
  }

  // Verify payment using PLATFORM credentials (payment lives in platform's SUMIT account)
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
      payment_status:          'paid',
      payment_method:          'sumit',
      amount_paid:             studentPays,
      tranzila_transaction_id: String(paymentId),
      vendor_payout_status:    'pending',
    })
    .eq('id', enrollmentId)
    .eq('payment_status', 'pending_direct')

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
    `PaymentID ${paymentId}, ₪${amount}. Money landed in PLATFORM's SUMIT account. ` +
    `Instructor payout ₪${split.instructorPayout} pending.`
  )

  // ── Create commission invoice in PLATFORM's SUMIT (best-effort) ───────────
  try {
    const classType       = (booking as { class_type?: string } | null)?.class_type ?? 'שיעור'
    const commissionILS   = split.platformRevenue
    const { success }     = await createCommissionInvoice({
      vendorName:    `מדריכה — שיעור ${enrollmentId}`,
      commissionILS,
      referenceId:   `commission:class_booking:${enrollmentId}`,
      description:   classType,
    })
    if (success) {
      console.log(`[SUMIT return:class_booking] Commission invoice ₪${commissionILS} created`)
    }
  } catch (commErr) {
    console.error('[SUMIT return:class_booking] Commission invoice failed (non-fatal):', commErr)
  }

  return NextResponse.redirect(`${appUrl}/classes/${enrollmentId}/success`)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    // ── Best-effort CSRF guard: Referer must be SUMIT's domain ────────────────
    // SUMIT redirects the user's browser here after payment — Referer is typically
    // from sumit.co.il. An absent Referer is allowed (privacy settings may strip it).
    // Main protection is verifySumitPayment (live API call) below.
    if (!isRefererTrusted(request)) {
      console.warn('[SUMIT return] Suspicious Referer — not from sumit.co.il:', request.headers.get('referer'))
      return NextResponse.redirect(`${appUrl}/?error=invalid_return`)
    }

    const params = request.nextUrl.searchParams

    const rawPaymentId          = params.get('OG-PaymentID')
    const externalIdentifier    = params.get('OG-ExternalIdentifier') ?? ''

    // Parse paymentId — must be a positive integer
    const paymentId = rawPaymentId ? parseInt(rawPaymentId, 10) : NaN
    if (!rawPaymentId || isNaN(paymentId) || paymentId <= 0) {
      console.warn('[SUMIT return] Missing or invalid OG-PaymentID:', rawPaymentId)
      return NextResponse.redirect(`${appUrl}/?error=invalid_return`)
    }

    // Parse externalIdentifier: "{flowType}:{entityId}"
    // Strict validation: flowType must be a known enum, entityId must be UUID v4.
    // This prevents injection via crafted OG-ExternalIdentifier values.
    const colonIdx = externalIdentifier.indexOf(':')
    if (colonIdx === -1) {
      console.warn('[SUMIT return] OG-ExternalIdentifier missing colon separator')
      return NextResponse.redirect(`${appUrl}/?error=invalid_return`)
    }

    const flowType = externalIdentifier.substring(0, colonIdx)
    const entityId = externalIdentifier.substring(colonIdx + 1)

    if (!ALLOWED_FLOW_TYPES.has(flowType)) {
      console.warn('[SUMIT return] Unknown or disallowed flowType:', flowType)
      return NextResponse.redirect(`${appUrl}/?error=invalid_return`)
    }

    if (!entityId || !isValidUUID(entityId)) {
      console.warn('[SUMIT return] entityId is not a valid UUID v4:', entityId)
      return NextResponse.redirect(`${appUrl}/?error=invalid_return`)
    }

    const supabase = adminClient()

    if (flowType === 'space_rental') {
      return await handleSpaceRentalReturn(supabase, entityId, paymentId, appUrl)
    } else {
      // flowType === 'class_booking' (ALLOWED_FLOW_TYPES exhausted above)
      return await handleClassBookingReturn(supabase, entityId, paymentId, appUrl)
    }
  } catch (err) {
    console.error('[SUMIT return] Unhandled error:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(`${appUrl}/?error=internal`)
  }
}
