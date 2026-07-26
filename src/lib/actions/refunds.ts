'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendBookingCancelledEmailToInstructor, sendBookingCancelledEmailToHost } from '@/lib/email'

async function issueTranzilaRefund(transactionId: string, amount: number): Promise<boolean> {
  const apiKey = process.env.TRANZILA_API_KEY
  if (!apiKey) {
    console.log(`[REFUND DEV] Would refund transaction ${transactionId} — ₪${amount}`)
    return true // Dev mode: pretend it worked
  }

  try {
    const res = await fetch(`https://api.tranzila.finance/v1/transactions/${transactionId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, currency: 'ILS' }),
    })
    return res.ok
  } catch (e) {
    console.error('[REFUND] Tranzila refund failed:', e)
    return false
  }
}

export async function requestRefund(bookingId: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחוברת.' }

  // Fetch booking with relations
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      *,
      venue:venues(id, title, location_address, location_city, host:profiles(id, full_name)),
      instructor:profiles(id, full_name)
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'הזמנה לא נמצאה.' }

  // Only instructor can request refund for their own confirmed booking
  if (booking.instructor_id !== user.id) return { error: 'גישה נדחתה.' }
  if (booking.status !== 'confirmed') {
    return { error: 'ניתן לבטל ולקבל החזר רק להזמנות מאושרות.' }
  }

  // Check cancellation window: must be at least 24h before booking
  const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`)
  const hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / 3600000
  if (hoursUntilBooking < 24) {
    return { error: 'לא ניתן לבטל פחות מ-24 שעות לפני האימון. אנא צרי קשר עם התמיכה.' }
  }

  // Issue refund if there's a transaction ID
  let refundIssued = false
  if (booking.tranzila_transaction_id) {
    refundIssued = await issueTranzilaRefund(
      booking.tranzila_transaction_id,
      booking.total_price
    )
    if (!refundIssued) {
      return { error: 'שגיאה בעיבוד ההחזר. אנא פני לתמיכה: support@wellness-sea.co.il' }
    }
  }

  // Update booking status
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq('id', bookingId)

  if (updateError) return { error: 'שגיאה בביטול ההזמנה.' }

  // Send cancellation emails (non-blocking)
  try {
    const venue = booking.venue as { title?: string; location_address?: string; location_city?: string; host?: { id?: string; full_name?: string } } | null
    const instructor = booking.instructor as { full_name?: string } | null

    // Fetch emails via auth.admin (server-side only)
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const [instructorAuth, hostAuth] = await Promise.all([
      serviceSupabase.auth.admin.getUserById(booking.instructor_id),
      venue?.host?.id
        ? serviceSupabase.auth.admin.getUserById(venue.host.id)
        : Promise.resolve({ data: { user: null } }),
    ])

    const emailData = {
      instructorName: instructor?.full_name ?? 'מדריכה',
      instructorEmail: instructorAuth.data.user?.email ?? '',
      hostName: venue?.host?.full_name ?? 'מארח',
      hostEmail: hostAuth.data.user?.email ?? '',
      venueName: venue?.title ?? '',
      venueAddress: venue?.location_address ?? '',
      venueCity: venue?.location_city ?? '',
      bookingDate: booking.booking_date,
      startTime: booking.start_time,
      endTime: booking.end_time,
      totalPrice: booking.total_price,
      hostPayout: booking.host_payout,
      bookingId,
    }

    await Promise.all([
      emailData.instructorEmail
        ? sendBookingCancelledEmailToInstructor(emailData, reason)
        : Promise.resolve(),
      emailData.hostEmail
        ? sendBookingCancelledEmailToHost(emailData, reason)
        : Promise.resolve(),
    ])
  } catch (e) {
    console.error('Email error (non-fatal):', e)
  }

  revalidatePath('/instructor-dashboard/bookings')
  return {
    success: true,
    refundIssued,
    message: refundIssued
      ? 'ההזמנה בוטלה וההחזר יופיע בחשבונך תוך 3-5 ימי עסקים'
      : 'ההזמנה בוטלה. ההחזר יטופל ידנית על ידי הצוות שלנו.',
  }
}
