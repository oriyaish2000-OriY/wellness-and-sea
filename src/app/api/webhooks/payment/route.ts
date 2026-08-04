/**
 * POST /api/webhooks/payment
 *
 * Grow (Meshulam) webhook handler for both payment flows.
 *
 * Distinguishes flows via cField3:
 *   cField3 = 'space_rental'  → Flow 1: update bookings.status
 *   cField3 = 'class_booking' → Flow 2: update class_enrollments.payment_status
 *
 * Security: validates webhookKey header/field against GROW_WEBHOOK_KEY env var.
 *
 * Grow may POST as application/json OR application/x-www-form-urlencoded.
 * Both are handled.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  sendBookingConfirmedEmailToInstructor,
  sendNewBookingEmailToHost,
  sendBookingCancelledEmailToInstructor,
  sendBookingCancelledEmailToHost,
} from '@/lib/email'

// ─── Supabase service client (bypasses RLS) ───────────────────────────────────

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Payload parsing ──────────────────────────────────────────────────────────

function parsePayload(rawBody: string, contentType: string): Record<string, string> {
  const ct = contentType.toLowerCase()
  if (ct.includes('application/json')) {
    try { return JSON.parse(rawBody) as Record<string, string> } catch { /* fall */ }
  }
  if (ct.includes('urlencoded') || ct.includes('form-data')) {
    const out: Record<string, string> = {}
    new URLSearchParams(rawBody).forEach((v, k) => { out[k] = v })
    return out
  }
  // Last resort
  try { return JSON.parse(rawBody) as Record<string, string> }
  catch {
    const out: Record<string, string> = {}
    new URLSearchParams(rawBody).forEach((v, k) => { out[k] = v })
    return out
  }
}

// ─── Status detection helpers ─────────────────────────────────────────────────

function isSuccess(p: Record<string, string>): boolean {
  const s = p.status ?? p.event ?? p.paymentStatus ?? ''
  return ['payment.completed', 'completed', 'success', 'paid'].includes(s)
}

function isFailed(p: Record<string, string>): boolean {
  const s = p.status ?? p.event ?? p.paymentStatus ?? ''
  return ['payment.failed', 'payment.cancelled', 'failed', 'cancelled'].includes(s)
}

// ─── Email helpers ────────────────────────────────────────────────────────────

async function getEmail(supabase: ReturnType<typeof adminClient>, userId: string): Promise<string> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email ?? ''
}

// ─── Flow 1: Space Rental ─────────────────────────────────────────────────────

async function handleSpaceRentalSuccess(
  supabase:      ReturnType<typeof adminClient>,
  payload:       Record<string, string>
): Promise<void> {
  const bookingId     = payload.cField1
  const transactionId = payload.transactionCode ?? payload.transaction_id ?? null

  if (!bookingId) throw new Error('cField1 (bookingId) missing from space_rental webhook')

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', tranzila_transaction_id: transactionId })
    .eq('id', bookingId)
    .eq('status', 'pending')

  if (error) throw new Error(`DB update failed for booking ${bookingId}: ${error.message}`)

  // Fetch full booking for emails
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
    instructor?.id ? getEmail(supabase, instructor.id) : Promise.resolve(''),
    venue?.host?.id ? getEmail(supabase, venue.host.id) : Promise.resolve(''),
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

  console.log(`[webhook:space_rental] Booking ${bookingId} confirmed. Tx: ${transactionId ?? 'n/a'}`)
}

async function handleSpaceRentalFailure(
  supabase: ReturnType<typeof adminClient>,
  payload:  Record<string, string>
): Promise<void> {
  const bookingId = payload.cField1
  if (!bookingId) return

  await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'תשלום נכשל' })
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
    hostEmail       ? sendBookingCancelledEmailToHost(emailData,       'תשלום נכשל') : Promise.resolve(),
  ])

  console.log(`[webhook:space_rental] Booking ${bookingId} cancelled (payment failed)`)
}

// ─── Flow 2: Class Booking ────────────────────────────────────────────────────

async function handleClassBookingSuccess(
  supabase: ReturnType<typeof adminClient>,
  payload:  Record<string, string>
): Promise<void> {
  const enrollmentId  = payload.cField1
  const transactionId = payload.transactionCode ?? payload.transaction_id ?? null

  if (!enrollmentId) throw new Error('cField1 (enrollmentId) missing from class_booking webhook')

  // Fetch enrollment to get amount
  const { data: enrollment } = await supabase
    .from('class_enrollments')
    .select('id, booking_id, student_id, booking:bookings(price_per_student)')
    .eq('id', enrollmentId)
    .single()

  if (!enrollment) throw new Error(`Enrollment ${enrollmentId} not found`)

  const booking    = enrollment.booking as { price_per_student?: number } | null
  const amountPaid = booking?.price_per_student ?? 0

  const { error } = await supabase
    .from('class_enrollments')
    .update({
      payment_status: 'paid',
      payment_method: 'grow',
      amount_paid:    amountPaid,
    })
    .eq('id', enrollmentId)
    .neq('payment_status', 'cancelled')

  if (error) throw new Error(`DB update failed for enrollment ${enrollmentId}: ${error.message}`)

  // Optionally store grow transaction ID on the parent booking
  if (transactionId) {
    await supabase
      .from('bookings')
      .update({ tranzila_transaction_id: transactionId })
      .eq('id', enrollment.booking_id)
  }

  console.log(`[webhook:class_booking] Enrollment ${enrollmentId} marked paid. Tx: ${transactionId ?? 'n/a'}`)
  // TODO: send student + instructor confirmation emails
}

async function handleClassBookingFailure(
  supabase: ReturnType<typeof adminClient>,
  payload:  Record<string, string>
): Promise<void> {
  const enrollmentId = payload.cField1
  if (!enrollmentId) return

  await supabase
    .from('class_enrollments')
    .update({ payment_status: 'cancelled' })
    .eq('id', enrollmentId)
    .eq('payment_status', 'pending_direct')

  console.log(`[webhook:class_booking] Enrollment ${enrollmentId} cancelled (payment failed)`)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rawBody     = await request.text()
    const contentType = request.headers.get('content-type') ?? ''
    const payload     = parsePayload(rawBody, contentType)

    // ── Webhook key verification ─────────────────────────────────────────
    const expectedKey = process.env.GROW_WEBHOOK_KEY
    if (expectedKey) {
      const receivedKey = payload.webhookKey ?? payload.webhook_key ?? ''
      if (receivedKey !== expectedKey) {
        console.warn('[webhook] Invalid webhookKey — rejecting')
        return NextResponse.json({ error: 'Invalid webhook key' }, { status: 401 })
      }
    }

    const supabase  = adminClient()
    const flowType  = payload.cField3 ?? 'space_rental' // default for legacy webhooks
    const succeeded = isSuccess(payload)
    const failed    = isFailed(payload)

    if (!succeeded && !failed) {
      // Unknown event — acknowledge without processing (e.g. 'pending' status)
      console.log(`[webhook] Unhandled status: ${payload.status ?? 'unknown'} — ignoring`)
      return NextResponse.json({ ok: true })
    }

    if (flowType === 'class_booking') {
      if (succeeded) await handleClassBookingSuccess(supabase, payload)
      if (failed)    await handleClassBookingFailure(supabase, payload)
    } else {
      // space_rental (default, covers legacy webhooks without cField3)
      if (succeeded) await handleSpaceRentalSuccess(supabase, payload)
      if (failed)    await handleSpaceRentalFailure(supabase, payload)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[webhook] Processing error:', e)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
