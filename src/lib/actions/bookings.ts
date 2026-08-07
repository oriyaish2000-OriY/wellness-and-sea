'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { calculatePlatformFee } from '@/lib/constants'

// useActionState-compatible wrapper
export async function createPendingBookingAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  return createPendingBooking(formData)
}

export async function createPendingBooking(formData: FormData): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'לא מחוברת. אנא התחברי שוב.' }

  const role = user.user_metadata?.role
  if (role !== 'instructor') return { error: 'רק מדריכות יכולות לבצע הזמנות.' }

  const venueId = formData.get('venue_id') as string
  const bookingDate = formData.get('booking_date') as string
  const startTime = formData.get('start_time') as string
  const endTime = formData.get('end_time') as string
  const classType = formData.get('class_type') as string
  const participantsCount = parseInt(formData.get('participants_count') as string) || undefined
  const specialRequests = (formData.get('special_requests') as string)?.trim() || undefined

  if (!venueId || !bookingDate || !startTime || !endTime) {
    return { error: 'פרטי ההזמנה חסרים.' }
  }

  // Server-side availability re-validation (never trust client)
  // Overlap condition: existing.start < newEnd AND existing.end > newStart
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('venue_id', venueId)
    .eq('booking_date', bookingDate)
    .not('status', 'eq', 'cancelled')
    .lt('start_time', endTime)
    .gt('end_time', startTime)
    .limit(1)

  if (existingBookings && existingBookings.length > 0) {
    return { error: 'הזמן שנבחר כבר תפוס. אנא בחרי זמן אחר.' }
  }

  // Get venue for pricing
  const { data: venue } = await supabase
    .from('venues')
    .select('hourly_price, space_size_sqm, capacity, is_active, title')
    .eq('id', venueId)
    .single()

  if (!venue || !venue.is_active) {
    return { error: 'החלל אינו זמין להזמנה.' }
  }

  if (participantsCount && participantsCount > venue.capacity) {
    return { error: `מספר המשתתפים (${participantsCount}) עולה על קיבולת החלל (${venue.capacity}).` }
  }

  // Calculate pricing
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const durationHours = (endH * 60 + endM - (startH * 60 + startM)) / 60
  const totalPrice = Math.round(venue.hourly_price * durationHours)
  const platformFee = calculatePlatformFee(venue.space_size_sqm ?? 60)
  const hostPayout = totalPrice - platformFee

  // Create pending booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      venue_id: venueId,
      instructor_id: user.id,
      booking_date: bookingDate,
      start_time: startTime,
      end_time: endTime,
      total_price: totalPrice,
      platform_fee: platformFee,
      host_payout: hostPayout,
      status: 'pending',
      class_type: classType || null,
      participants_count: participantsCount ?? null,
      special_requests: specialRequests ?? null,
    })
    .select('id')
    .single()

  if (bookingError || !booking) {
    console.error('createPendingBooking error:', bookingError)
    if (bookingError?.code === '23505') {
      return { error: 'הזמן שנבחר כבר תפוס. אנא בחרי זמן אחר.' }
    }
    return { error: 'שגיאה ביצירת ההזמנה. אנא נסי שוב.' }
  }

  // Redirect to payment hub — user chooses Tranzila / Bit / PayBox
  redirect(`/booking/pay/${booking.id}`)
}

export async function cancelBooking(bookingId: string, reason?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחוברת.' }

  const { data: booking } = await supabase
    .from('bookings')
    .select('status, instructor_id, venue_id')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'ההזמנה לא נמצאה.' }

  // Instructors can cancel pending bookings; hosts can cancel confirmed
  const isInstructor = booking.instructor_id === user.id
  const canCancel = isInstructor && booking.status === 'pending'

  if (!canCancel) {
    return { error: 'לא ניתן לבטל הזמנה זו.' }
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason ?? null,
    })
    .eq('id', bookingId)

  if (error) return { error: 'שגיאה בביטול ההזמנה.' }

  revalidatePath('/instructor-dashboard/bookings')
  return { success: true }
}

/**
 * @deprecated Manual booking confirmation is DISABLED.
 * Bookings are confirmed automatically by the payment system (Cardcom webhook or mark-paid API).
 * Allowing hosts to confirm manually bypasses payment verification and commission collection.
 */
export async function hostConfirmBooking(_bookingId: string) {
  return {
    error: 'הזמנות מאושרות אוטומטית לאחר קבלת התשלום — אין צורך באישור ידני.',
  }
}

export async function hostCancelBooking(bookingId: string, reason?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחוברת.' }

  // Verify ownership
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, venue:venues(host_id)')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'ההזמנה לא נמצאה.' }
  const venue = booking.venue as { host_id?: string } | null
  if (venue?.host_id !== user.id) return { error: 'גישה נדחתה.' }

  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason ?? null,
    })
    .eq('id', bookingId)

  if (error) return { error: 'שגיאה בביטול ההזמנה.' }

  revalidatePath('/host-dashboard/bookings')
  return { success: true }
}

export async function completeBooking(bookingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחוברת.' }
  if (user.user_metadata?.role !== 'host') return { error: 'גישה נדחתה.' }

  // Verify the booking belongs to one of this host's venues
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, venue:venues(host_id)')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: 'ההזמנה לא נמצאה.' }
  const venue = booking.venue as { host_id?: string } | null
  if (venue?.host_id !== user.id) return { error: 'גישה נדחתה.' }
  if (booking.status !== 'confirmed') return { error: 'ניתן לסמן כהושלמה רק הזמנות מאושרות.' }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', bookingId)

  if (error) return { error: 'שגיאה בעדכון ההזמנה.' }

  revalidatePath('/host-dashboard/bookings')
  return { success: true }
}
