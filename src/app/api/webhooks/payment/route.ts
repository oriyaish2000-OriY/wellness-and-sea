/**
 * POST /api/webhooks/payment
 *
 * Summit payment webhook handler for both flows.
 *
 * Flow discrimination via metadata.flowType (JSON) or flowType (form):
 *   'space_rental'  → update bookings.status
 *   'class_booking' → update class_enrollments.payment_status
 *
 * Security: HMAC-SHA256 verification via SUMMIT_WEBHOOK_SECRET.
 *
 * Summit may POST as application/json OR application/x-www-form-urlencoded.
 * Both are handled for maximum compatibility.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'
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

// ─── Payload parsing ──────────────────────────────────────────────────────────

function parsePayload(rawBody: string, contentType: string): Record<string, string> {
  const ct = contentType.toLowerCase()
  if (ct.includes('application/json')) {
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>
      // Flatten metadata into top-level for easier access
      const meta = parsed.metadata as Record<string, string> | undefined
      return { ...parsed, ...(meta ?? {}) } as Record<string, string>
    } catch { /* fall through */ }
  }
  if (ct.includes('urlencoded') || ct.includes('form-data')) {
    const out: Record<string, string> = {}
    new URLSearchParams(rawBody).forEach((v, k) => { out[k] = v })
    return out
  }
  // Last resort — try JSON then form
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>
    const meta = parsed.metadata as Record<string, string> | undefined
    return { ...parsed, ...(meta ?? {}) } as Record<string, string>
  } catch {
    const out: Record<string, string> = {}
    new URLSearchParams(rawBody).forEach((v, k) => { out[k] = v })
    return out
  }
}

// ─── Webhook signature verification ──────────────────────────────────────────

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.SUMMIT_WEBHOOK_SECRET
  if (!secret || !signatureHeader) return !secret  // skip if not configured

  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    const received = signatureHeader.replace(/^sha256=/, '')
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  } catch {
    return false
  }
}

// ─── Status detection ─────────────────────────────────────────────────────────

function isSuccess(p: Record<string, string>): boolean {
  const s = p.status ?? p.event ?? p.paymentStatus ?? ''
  return ['payment.completed', 'completed', 'success', 'paid', 'approved'].includes(s.toLowerCase())
}

function isFailed(p: Record<string, string>): boolean {
  const s = p.status ?? p.event ?? p.paymentStatus ?? ''
  return ['payment.failed', 'payment.cancelled', 'failed', 'cancelled', 'declined'].includes(s.toLowerCase())
}

// ─── Email helpers ────────────────────────────────────────────────────────────

async function getEmail(supabase: ReturnType<typeof adminClient>, userId: string): Promise<string> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email ?? ''
}

// ─── Flow 1: Space Rental ─────────────────────────────────────────────────────

async function handleSpaceRentalSuccess(
  supabase: ReturnType<typeof adminClient>,
  payload:  Record<string, string>
): Promise<void> {
  // bookingId comes from metadata.bookingId (flattened) or legacy cField1
  const bookingId     = payload.bookingId ?? payload.cField1
  const transactionId = payload.paymentId ?? payload.transactionCode ?? payload.transaction_id ?? null

  if (!bookingId) throw new Error('bookingId missing from space_rental webhook')

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', tranzila_transaction_id: transactionId })
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
    instructor?.id   ? getEmail(supabase, instructor.id)   : Promise.resolve(''),
    venue?.host?.id  ? getEmail(supabase, venue.host.id)   : Promise.resolve(''),
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
  const bookingId = payload.bookingId ?? payload.cField1
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
  const enrollmentId  = payload.enrollmentId ?? payload.cField1
  const transactionId = payload.paymentId ?? payload.transactionCode ?? payload.transaction_id ?? null

  if (!enrollmentId) throw new Error('enrollmentId missing from class_booking webhook')

  const { data: enrollment } = await supabase
    .from('class_enrollments')
    .select('id, booking_id, student_id, booking:bookings(price_per_student)')
    .eq('id', enrollmentId)
    .single()

  if (!enrollment) throw new Error(`Enrollment ${enrollmentId} not found`)

  // amount_paid = what the student actually paid (base × 1.05)
  const booking    = enrollment.booking as { price_per_student?: number } | null
  const basePrice  = booking?.price_per_student ?? 0
  const amountPaid = Math.round(basePrice * 1.05 * 100) / 100  // base + 5%

  const { error } = await supabase
    .from('class_enrollments')
    .update({
      payment_status: 'paid',
      payment_method: 'summit',
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

  console.log(`[webhook:class_booking] Enrollment ${enrollmentId} marked paid (₪${amountPaid}). Tx: ${transactionId ?? 'n/a'}`)
  // TODO: send student + instructor confirmation emails
}

async function handleClassBookingFailure(
  supabase: ReturnType<typeof adminClient>,
  payload:  Record<string, string>
): Promise<void> {
  const enrollmentId = payload.enrollmentId ?? payload.cField1
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
    const signature   = request.headers.get('x-summit-signature')
                     ?? request.headers.get('x-webhook-signature')
                     ?? null

    // ── Signature verification ───────────────────────────────────────────────
    if (!verifySignature(rawBody, signature)) {
      console.warn('[webhook] Invalid signature — rejecting')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload  = parsePayload(rawBody, contentType)

    // flowType comes from metadata (JSON) or direct field (form/legacy)
    const flowType = payload.flowType ?? payload.cField3 ?? 'space_rental'
    const succeeded = isSuccess(payload)
    const failed    = isFailed(payload)

    if (!succeeded && !failed) {
      console.log(`[webhook] Unhandled status: ${payload.status ?? 'unknown'} — acknowledging`)
      return NextResponse.json({ ok: true })
    }

    const supabase = adminClient()

    if (flowType === 'class_booking') {
      if (succeeded) await handleClassBookingSuccess(supabase, payload)
      if (failed)    await handleClassBookingFailure(supabase, payload)
    } else {
      if (succeeded) await handleSpaceRentalSuccess(supabase, payload)
      if (failed)    await handleSpaceRentalFailure(supabase, payload)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[webhook] Processing error:', e)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
