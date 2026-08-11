/**
 * POST /api/webhooks/payment
 *
 * Cardcom LowProfile webhook handler for both payment flows.
 *
 * Security:
 *   1. TerminalNumber in payload must match CARDCOM_TERMINAL_NUMBER env var
 *   2. Optional CARDCOM_WEBHOOK_TOKEN in query string (?token=SECRET) for
 *      extra replay protection — set the WebHookUrl in LowProfile/Create to
 *      include this token: /api/webhooks/payment?token=CARDCOM_WEBHOOK_TOKEN
 *
 * Flow discrimination via ReturnValue field (set during LowProfile/Create):
 *   "space_rental:{bookingId}"     → update bookings.status
 *   "class_booking:{enrollmentId}" → update class_enrollments.payment_status
 *
 * Cardcom sends JSON POST; ResponseCode === 0 means success.
 * Your server must return HTTP 200.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calcClassBookingSplit } from '@/lib/payments/commissionUtils'
import {
  sendBookingConfirmedEmailToInstructor,
  sendNewBookingEmailToHost,
  sendBookingCancelledEmailToInstructor,
  sendBookingCancelledEmailToHost,
} from '@/lib/email'

// ─── Supabase admin client (bypasses RLS) ─────────────────────────────────────

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Security constants ───────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_FLOW_TYPES = new Set(['space_rental', 'class_booking'])

function isValidUUID(value: string): boolean {
  return UUID_RE.test(value)
}

// ─── Webhook verification ─────────────────────────────────────────────────────
//
// Cardcom does NOT use HMAC-SHA256 header signatures like Stripe.
// Instead, Cardcom webhooks are validated via two mechanisms:
//
//  1. TerminalNumber in the JSON payload must match CARDCOM_TERMINAL_NUMBER.
//     This is the primary guard against spoofed payloads.
//
//  2. Optional shared-secret token (CARDCOM_WEBHOOK_TOKEN).
//     Set the WebHookUrl in Cardcom dashboard (or LowProfile/Create) to include
//     this token: /api/webhooks/payment?token=CARDCOM_WEBHOOK_TOKEN
//     If the env var is set, the token must appear in the query string.
//     This provides replay-attack protection without HMAC overhead.
//
// If CARDCOM_WEBHOOK_TOKEN is not set, the token check is skipped (backwards
// compatible — safe to enable incrementally without breaking existing setups).

function verifyWebhook(
  request:  NextRequest,
  payload:  Record<string, unknown>
): { ok: boolean; reason?: string } {
  const expectedTerminal = parseInt(process.env.CARDCOM_TERMINAL_NUMBER ?? '0', 10)
  const payloadTerminal  = payload.TerminalNumber as number | undefined

  // 1. Terminal number must match (primary verification)
  if (expectedTerminal > 0 && payloadTerminal !== expectedTerminal) {
    return { ok: false, reason: `Terminal mismatch: got ${payloadTerminal}, expected ${expectedTerminal}` }
  }

  // 2. Optional URL token check (CARDCOM_WEBHOOK_TOKEN)
  // Accept token from query param (?token=...) or from POST body field "token"
  const expectedToken = process.env.CARDCOM_WEBHOOK_TOKEN
  if (!expectedToken) {
    console.warn('[webhook] SECURITY: CARDCOM_WEBHOOK_TOKEN not configured — webhook token check skipped')
  }
  if (expectedToken) {
    const queryToken = request.nextUrl.searchParams.get('token')
    const bodyToken  = typeof payload['token'] === 'string' ? payload['token'] : undefined
    const receivedToken = queryToken ?? bodyToken
    if (receivedToken !== expectedToken) {
      return { ok: false, reason: 'Invalid webhook token' }
    }
  }

  return { ok: true }
}

// ─── Email helpers ────────────────────────────────────────────────────────────

async function getEmail(
  supabase: ReturnType<typeof adminClient>,
  userId:   string
): Promise<string> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email ?? ''
}

// ─── Flow 1: Space Rental ─────────────────────────────────────────────────────

async function handleSpaceRentalSuccess(
  supabase:      ReturnType<typeof adminClient>,
  bookingId:     string,
  transactionId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      ...(transactionId ? { tranzila_transaction_id: transactionId } : {}),
    })
    .eq('id', bookingId)
    .eq('status', 'pending')

  if (error) throw new Error(`DB update failed for booking ${bookingId}: ${error.message}`)

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      *,
      venue:venues(title, location_address, location_city,
        host:profiles!venues_host_id_fkey(id, full_name)),
      instructor:profiles!bookings_instructor_id_fkey(id, full_name)
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) return

  const venue      = booking.venue      as { title?: string; location_address?: string; location_city?: string; host?: { id?: string; full_name?: string } } | null
  const instructor = booking.instructor as { id?: string; full_name?: string } | null

  const [instructorEmail, hostEmail] = await Promise.all([
    instructor?.id  ? getEmail(supabase, instructor.id)  : Promise.resolve(''),
    venue?.host?.id ? getEmail(supabase, venue.host.id)  : Promise.resolve(''),
  ])

  const emailData = {
    instructorName:    instructor?.full_name ?? '',
    instructorEmail,
    hostName:          venue?.host?.full_name ?? '',
    hostEmail,
    venueName:         venue?.title ?? '',
    venueAddress:      venue?.location_address ?? '',
    venueCity:         venue?.location_city ?? '',
    bookingDate:       booking.booking_date,
    startTime:         booking.start_time,
    endTime:           booking.end_time,
    totalPrice:        booking.total_price,
    hostPayout:        booking.host_payout,
    classType:         booking.class_type ?? undefined,
    participantsCount: booking.participants_count ?? undefined,
    bookingId,
  }

  await Promise.all([
    instructorEmail ? sendBookingConfirmedEmailToInstructor(emailData) : Promise.resolve(),
    hostEmail       ? sendNewBookingEmailToHost(emailData)             : Promise.resolve(),
  ])

  console.log(`[webhook:space_rental] Booking ${bookingId} confirmed`)
}

async function handleSpaceRentalFailure(
  supabase:  ReturnType<typeof adminClient>,
  bookingId: string
): Promise<void> {
  await supabase
    .from('bookings')
    .update({
      status:              'cancelled',
      cancelled_at:        new Date().toISOString(),
      cancellation_reason: 'תשלום נכשל',
    })
    .eq('id', bookingId)
    .eq('status', 'pending')

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      *,
      venue:venues(title, location_address, location_city,
        host:profiles!venues_host_id_fkey(id, full_name)),
      instructor:profiles!bookings_instructor_id_fkey(id, full_name)
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) return

  const venue      = booking.venue      as { title?: string; location_address?: string; location_city?: string; host?: { id?: string; full_name?: string } } | null
  const instructor = booking.instructor as { id?: string; full_name?: string } | null

  const [instructorEmail, hostEmail] = await Promise.all([
    instructor?.id  ? getEmail(supabase, instructor.id)  : Promise.resolve(''),
    venue?.host?.id ? getEmail(supabase, venue.host.id)  : Promise.resolve(''),
  ])

  const emailData = {
    instructorName: instructor?.full_name ?? '',
    instructorEmail,
    hostName:       venue?.host?.full_name ?? '',
    hostEmail,
    venueName:      venue?.title ?? '',
    venueAddress:   venue?.location_address ?? '',
    venueCity:      venue?.location_city ?? '',
    bookingDate:    booking.booking_date,
    startTime:      booking.start_time,
    endTime:        booking.end_time,
    totalPrice:     booking.total_price,
    hostPayout:     booking.host_payout,
    bookingId,
  }

  await Promise.all([
    instructorEmail ? sendBookingCancelledEmailToInstructor(emailData, 'תשלום נכשל') : Promise.resolve(),
    hostEmail       ? sendBookingCancelledEmailToHost(emailData, 'תשלום נכשל')       : Promise.resolve(),
  ])

  console.log(`[webhook:space_rental] Booking ${bookingId} cancelled — payment failed`)
}

// ─── Flow 2: Class Booking ────────────────────────────────────────────────────

async function handleClassBookingSuccess(
  supabase:      ReturnType<typeof adminClient>,
  enrollmentId:  string,
  transactionId: string | null
): Promise<void> {
  const { data: enrollment } = await supabase
    .from('class_enrollments')
    .select('id, booking_id, student_id, booking:bookings(price_per_student)')
    .eq('id', enrollmentId)
    .single()

  if (!enrollment) throw new Error(`Enrollment ${enrollmentId} not found`)

  // Use canonical commission function — same rounding as checkout
  const booking    = enrollment.booking as { price_per_student?: number } | null
  const basePrice  = booking?.price_per_student ?? 0
  const amountPaid = basePrice > 0 ? calcClassBookingSplit(basePrice).studentPays : 0

  const { error } = await supabase
    .from('class_enrollments')
    .update({
      payment_status: 'paid',
      payment_method: 'cardcom',
      amount_paid:    amountPaid,
      ...(transactionId ? { grow_transaction_id: transactionId } : {}),
    })
    .eq('id', enrollmentId)
    .neq('payment_status', 'cancelled')

  if (error) throw new Error(`DB update failed for enrollment ${enrollmentId}: ${error.message}`)

  if (transactionId) {
    await supabase
      .from('bookings')
      .update({ tranzila_transaction_id: transactionId })
      .eq('id', enrollment.booking_id)
  }

  console.log(`[webhook:class_booking] Enrollment ${enrollmentId} marked paid`)
  // TODO: send student + instructor confirmation emails
}

async function handleClassBookingFailure(
  supabase:     ReturnType<typeof adminClient>,
  enrollmentId: string
): Promise<void> {
  await supabase
    .from('class_enrollments')
    .update({ payment_status: 'cancelled' })
    .eq('id', enrollmentId)
    .eq('payment_status', 'pending_direct')

  console.log(`[webhook:class_booking] Enrollment ${enrollmentId} cancelled — payment failed`)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>

    // ── Security verification ────────────────────────────────────────────────
    const { ok, reason } = verifyWebhook(request, body)
    if (!ok) {
      console.warn('[webhook] Rejected:', reason)
      // Return 200 to Cardcom (don't reveal rejection reason)
      return NextResponse.json({ ok: false })
    }

    const responseCode = body.ResponseCode as number
    const returnValue  = (body.ReturnValue as string) ?? ''
    const txInfo       = (body.TranzactionInfo ?? {}) as Record<string, unknown>
    const rawTxId      = (txInfo.TranzactionId ?? body.TranzactionId) as number | string | undefined
    const transactionId = rawTxId != null ? String(rawTxId) : null

    // ── Parse ReturnValue: "flowType:entityId" ───────────────────────────────
    // Strict validation: flowType must be a known enum, entityId must be UUID v4.
    const colonIdx = returnValue.indexOf(':')
    if (colonIdx === -1) {
      console.warn('[webhook] ReturnValue format invalid — missing colon separator')
      return NextResponse.json({ ok: true })
    }

    const flowType = returnValue.substring(0, colonIdx)
    const entityId = returnValue.substring(colonIdx + 1)

    if (!ALLOWED_FLOW_TYPES.has(flowType)) {
      console.warn('[webhook] Unknown or disallowed flowType in ReturnValue:', flowType)
      return NextResponse.json({ ok: true })
    }

    if (!entityId || !isValidUUID(entityId)) {
      console.warn('[webhook] entityId in ReturnValue is not a valid UUID v4:', entityId)
      return NextResponse.json({ ok: true })
    }

    const succeeded = responseCode === 0
    const failed    = typeof responseCode === 'number' && responseCode !== 0

    if (!succeeded && !failed) {
      return NextResponse.json({ ok: true })
    }

    const supabase = adminClient()

    if (flowType === 'class_booking') {
      if (succeeded) await handleClassBookingSuccess(supabase, entityId, transactionId)
      if (failed)    await handleClassBookingFailure(supabase, entityId)
    } else if (flowType === 'space_rental') {
      if (succeeded) await handleSpaceRentalSuccess(supabase, entityId, transactionId)
      if (failed)    await handleSpaceRentalFailure(supabase, entityId)
    } else {
      console.warn('[webhook] Unknown flowType:', flowType)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[webhook] Processing error:', e instanceof Error ? e.message : e)
    // Return 200 to prevent Cardcom retries on our own internal errors
    return NextResponse.json({ ok: true })
  }
}
