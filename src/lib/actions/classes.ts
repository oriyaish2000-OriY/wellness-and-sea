'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEnrollmentConfirmationEmail } from '@/lib/email'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ============================================================
// INSTRUCTOR: open a confirmed booking to student enrollment
// ============================================================

export async function openClassToStudents(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'לא מחוברת.' }
  // M2: Read role from profiles table (source of truth)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'instructor') return { error: 'גישה נדחתה.' }

  const bookingId = formData.get('booking_id') as string
  const maxStudents = parseInt(formData.get('max_students') as string)
  const pricePerStudent = parseInt(formData.get('price_per_student') as string)

  if (!bookingId || isNaN(maxStudents) || isNaN(pricePerStudent)) {
    return { error: 'נא למלא את כל הפרטים.' }
  }
  if (maxStudents < 1 || maxStudents > 100) return { error: 'מספר תלמידות לא תקין.' }
  if (pricePerStudent < 0) return { error: 'מחיר לא תקין.' }

  // Verify booking belongs to this instructor
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, instructor_id')
    .eq('id', bookingId)
    .eq('instructor_id', user.id)
    .single()

  if (!booking) return { error: 'ההזמנה לא נמצאה.' }
  if (booking.status !== 'confirmed') return { error: 'ניתן לפתוח רק הזמנות מאושרות.' }

  const { error } = await supabase
    .from('bookings')
    .update({
      open_to_students: true,
      max_students: maxStudents,
      price_per_student: pricePerStudent,
    })
    .eq('id', bookingId)

  if (error) return { error: 'שגיאה בעדכון ההזמנה.' }

  revalidatePath('/instructor-dashboard/bookings')
  revalidatePath('/classes')
  return { success: true }
}

export async function closeClassToStudents(bookingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'גישה נדחתה.' }
  // M2: Read role from profiles table (source of truth)
  const { data: closeProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (closeProfile?.role !== 'instructor') return { error: 'גישה נדחתה.' }

  const { error } = await supabase
    .from('bookings')
    .update({ open_to_students: false })
    .eq('id', bookingId)
    .eq('instructor_id', user.id)

  if (error) return { error: 'שגיאה.' }
  revalidatePath('/instructor-dashboard/bookings')
  revalidatePath('/classes')
  return { success: true }
}

// ============================================================
// STUDENT: enroll in an open class (free enrollment, payment direct to instructor)
// ============================================================

export async function enrollInClass(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'נא להתחבר כדי להירשם.' }

  const bookingId = formData.get('booking_id') as string
  if (!bookingId) return { error: 'נתונים חסרים.' }

  // Fetch the booking — include details needed for confirmation email
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, open_to_students, max_students, price_per_student, instructor_id,
      booking_date, start_time, end_time, class_type,
      instructor:profiles!bookings_instructor_id_fkey(full_name),
      venue:venues(title, location_city)
    `)
    .eq('id', bookingId)
    .eq('open_to_students', true)
    .eq('status', 'confirmed')
    .single()

  if (!booking) return { error: 'השיעור לא נמצא או לא פתוח להרשמה.' }

  // Instructors cannot enroll in their own class
  if (booking.instructor_id === user.id) return { error: 'לא ניתן להירשם לשיעור שלך.' }

  // ── SUMIT verification: instructor must have a verified payment account ────
  {
    const db = adminClient()
    const { data: instructorConfig } = await db
      .from('vendor_payment_config')
      .select('onboarding_status')
      .eq('profile_id', booking.instructor_id)
      .maybeSingle()

    if (!instructorConfig || instructorConfig.onboarding_status !== 'verified') {
      return {
        error:
          'לא ניתן להירשם לשיעור זה כרגע — המדריכה טרם הגדירה חשבון תשלומים מאומת. ' +
          'אנא נסי שיעור אחר או צרי קשר עם התמיכה.',
      }
    }
  }

  // Check not already enrolled
  // (capacity is enforced atomically at the DB layer via trigger — no TOCTOU here)
  const { data: existing } = await supabase
    .from('class_enrollments')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('student_id', user.id)
    .neq('payment_status', 'cancelled')
    .single()

  if (existing) return { error: 'כבר נרשמת לשיעור זה.' }

  // Create enrollment (payment_status = 'pending_direct' — student pays instructor directly)
  const { error: enrollError } = await supabase
    .from('class_enrollments')
    .insert({
      booking_id: bookingId,
      student_id: user.id,
      payment_status: 'pending_direct',
      amount_paid: booking.price_per_student ?? 0,
      payment_method: 'direct',
    })

  if (enrollError) {
    if (enrollError.code === '23505') return { error: 'כבר נרשמת לשיעור זה.' }
    if (enrollError.code === 'P0001') return { error: 'השיעור מלא.' }
    return { error: 'שגיאה בהרשמה. נסי שוב.' }
  }

  // Send enrollment confirmation email (non-blocking — never fail the action over email)
  if (user.email) {
    const instructor = booking.instructor as { full_name?: string } | null
    const venue = booking.venue as { title?: string; location_city?: string } | null
    sendEnrollmentConfirmationEmail({
      studentName: user.user_metadata?.full_name ?? user.email.split('@')[0],
      studentEmail: user.email,
      instructorName: instructor?.full_name ?? 'המדריכה',
      classType: booking.class_type ?? undefined,
      venueName: venue?.title ?? '',
      venueCity: venue?.location_city ?? '',
      bookingDate: booking.booking_date,
      startTime: booking.start_time,
      endTime: booking.end_time,
      pricePerStudent: booking.price_per_student ?? 0,
      bookingId,
    }).catch(err => console.error('[email] enrollment confirmation failed:', err))
  }

  revalidatePath('/classes')
  revalidatePath('/student-dashboard')
  return { success: true }
}

// Student cancels enrollment
export async function cancelEnrollment(enrollmentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחוברת.' }

  const { error } = await supabase
    .from('class_enrollments')
    .update({ payment_status: 'cancelled' })
    .eq('id', enrollmentId)
    .eq('student_id', user.id)

  if (error) return { error: 'שגיאה בביטול.' }
  revalidatePath('/student-dashboard')
  return { success: true }
}

// NOTE: markStudentPaid was removed.
// Student payment status is set exclusively through:
//  - /api/enrollments/mark-paid (Bit/PayBox self-report, with token gate + commission charge)
//  - /api/cardcom/webhook (credit card, with token commission charge)
// Allowing instructors to mark enrollments as paid directly bypasses commission collection.
