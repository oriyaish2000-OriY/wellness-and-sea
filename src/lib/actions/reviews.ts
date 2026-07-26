'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function submitReview(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'לא מחוברת. אנא התחברי שוב.' }
  if (user.user_metadata?.role !== 'instructor') return { error: 'רק מדריכות יכולות לכתוב ביקורת.' }

  const venueId = formData.get('venue_id') as string
  const bookingId = formData.get('booking_id') as string
  const rating = parseInt(formData.get('rating') as string)
  const comment = (formData.get('comment') as string)?.trim() || undefined

  if (!venueId || !bookingId) return { error: 'פרטים חסרים.' }
  if (!rating || rating < 1 || rating > 5) return { error: 'יש לבחור דירוג בין 1 ל-5.' }

  // Verify booking belongs to this instructor and is completed
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, instructor_id')
    .eq('id', bookingId)
    .eq('instructor_id', user.id)
    .eq('status', 'completed')
    .single()

  if (!booking) return { error: 'ניתן לכתוב ביקורת רק לאחר השלמת ההזמנה.' }

  // Check if review already exists
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('booking_id', bookingId)
    .single()

  if (existing) return { error: 'כבר כתבת ביקורת עבור הזמנה זו.' }

  const { error } = await supabase.from('reviews').insert({
    venue_id: venueId,
    booking_id: bookingId,
    instructor_id: user.id,
    rating,
    comment: comment ?? null,
  })

  if (error) {
    console.error('submitReview error:', error)
    return { error: 'שגיאה בשמירת הביקורת. אנא נסי שוב.' }
  }

  revalidatePath(`/venues/${venueId}`)
  revalidatePath('/instructor-dashboard/bookings')
  return { success: true }
}

export async function deleteReview(reviewId: string, venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחוברת.' }

  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)
    .eq('instructor_id', user.id)

  if (error) return { error: 'שגיאה במחיקת הביקורת.' }

  revalidatePath(`/venues/${venueId}`)
  return { success: true }
}
