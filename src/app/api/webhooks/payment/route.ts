/**
 * POST /api/webhooks/payment
 *
 * Cardcom LowProfile webhook handler for both payment flows.
 *
 * Flow discrimination via ReturnValue field (set during LowProfile/Create):
 *   "space_rental:{bookingId}"    → update bookings.status
 *   "class_booking:{enrollmentId}" → update class_enrollments.payment_status
 *
 * Cardcom sends JSON POST to WebHookUrl after payment completes.
 * ResponseCode === 0 means success.
 * Your server must return HTTP 200.
 *
 * Docs: https://secure.cardcom.solutions/swagger/v11/swagger.json
 *       Schema: LowProfileResult
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

// ─── Email helpers ────────────────────────────────────────────────────────────

async function getEmail(supabase: ReturnType<typeof adminClient>, userId: string): Promise<string> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email ?? ''
}

// ─── Flow 1: Space Rental ─────────────────────────────────────────────────────

async function handleSpaceRentalSuccess(
  supabase:      ReturnType<typeof adminClient>,
  bookingId:     string,
  transactionId: number | null
): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      ...(transactionId ? { tranzila_transaction_id: String(transactionId) } : {}),
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

  console.log(`[webhook:space_rental] Booking ${bookingId} confirmed. Tx: ${transactionId ?? 'n/a'}`)
}

async function handleSpaceRentalFailure(
  supabase:  ReturnType<typeof adminClient>,
  bookingId: string
): Promise<void> {
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
  supabase:      ReturnType<typeof adminClient>,
  enrollmentId:  string,
  transactionId: number | null
): Promise<void> {
  const { data: enrollment } = await supabase
    .from('class_enrollments')
    .select('id, booking_id, student_id, booking:bookings(price_per_student)')
    .eq('id', enrollmentId)
    .single()

  if (!enrollment) throw new Error(`Enrollment ${enrollmentId} not found`)

  const booking    = enrollment.booking as { price_per_student?: number } | null
  const basePrice  = booking?.price_per_student ?? 0
  const amountPaid = Math.round(basePrice * 1.05 * 100) / 100   // base + 5%

  const { error } = await supabase
    .from('class_enrollments')
    .update({
      payment_status: 'paid',
      payment_method: 'cardcom',
      amount_paid:    amountPaid,
      ...(transactionId ? { grow_transaction_id: String(transactionId) } : {}),
    })
    .eq('id', enrollmentId)
    .neq('payment_status', 'cancelled')

  if (error) throw new Error(`DB update failed for enrollment ${enrollmentId}: ${error.message}`)

  if (transactionId) {
    await supabase
      .from('bookings')
      .update({ tranzila_transaction_id: String(transactionId) })
      .eq('id', enrollment.booking_id)
  }

  console.log(`[webhook:class_booking] Enrollment ${enrollmentId} marked paid (₪${amountPaid}). Tx: ${transactionId ?? 'n/a'}`)
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

  console.log(`[webhook:class_booking] Enrollment ${enrollmentId} cancelled (payment failed)`)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Cardcom sends JSON
    const body = await request.json() as Record<string, unknown>

    const responseCode  = body.ResponseCode  as number
    const returnValue   = (body.ReturnValue  as string) ?? ''
    const txInfo        = (body.TranzactionInfo ?? {}) as Record<string, unknown>
    const transactionId = (txInfo.TranzactionId as number ?? body.TranzactionId as number) ?? null

    // ── Parse ReturnValue: "flowType:id" ──────────────────────────────────────
    const colonIdx = returnValue.indexOf(':')
    if (colonIdx === -1) {
      console.warn('[webhook] ReturnValue has no colon separator:', returnValue)
      return NextResponse.json({ ok: true })
    }

    const flowType  = returnValue.substring(0, colonIdx)   // "space_rental" | "class_booking"
    const entityId  = returnValue.substring(colonIdx + 1)  // bookingId or enrollmentId

    if (!entityId) {
      console.warn('[webhook] Empty entityId in ReturnValue:', returnValue)
      return NextResponse.json({ ok: true })
    }

    const succeeded = responseCode === 0
    const failed    = responseCode !== 0 && responseCode !== undefined

    if (!succeeded && !failed) {
      console.log('[webhook] Unhandled responseCode:', responseCode, '— acknowledging')
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
      console.warn('[webhook] Unknown flowType:', flowType, '— acknowledging')
    }

    // Cardcom requires HTTP 200
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[webhook] Processing error:', e)
    // Still return 200 to prevent Cardcom retries on our own processing errors
    return NextResponse.json({ ok: true })
  }
}
