'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function submitHealthDeclaration(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחוברת.' }

  const bookingId = formData.get('booking_id') as string
  const studentName = (formData.get('student_name') as string)?.trim()
  const studentPhone = (formData.get('student_phone') as string)?.trim()

  if (!bookingId || !studentName || !studentPhone) {
    return { error: 'יש למלא את כל השדות.' }
  }
  if (studentPhone.length < 9) {
    return { error: 'מספר טלפון לא תקין.' }
  }

  // Verify the booking belongs to this instructor
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, instructor_id')
    .eq('id', bookingId)
    .eq('instructor_id', user.id)
    .single()

  if (!booking) return { error: 'הזמנה לא נמצאה.' }
  if (!['confirmed', 'completed'].includes(booking.status)) {
    return { error: 'ניתן להוסיף הצהרות רק להזמנות מאושרות.' }
  }

  // Get client IP for audit trail
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] ??
              headersList.get('x-real-ip') ??
              null

  const declarationText = `אני מצהיר/ה כי אני בריא/ה וכשיר/ה להשתתף בפעילות גופנית. אין לי מגבלה רפואית, מחלה כרונית, או כל מצב רפואי שעלול להשפיע על יכולתי להשתתף באימון. אני לוקח/ת אחריות מלאה על השתתפותי בפעילות. תאריך: ${new Date().toLocaleDateString('he-IL')}`

  const { error } = await supabase.from('health_declarations').insert({
    booking_id: bookingId,
    student_name: studentName,
    student_phone: studentPhone,
    declaration_text: declarationText,
    ip_address: ip,
  })

  if (error) {
    console.error('submitHealthDeclaration error:', error)
    return { error: 'שגיאה בשמירת ההצהרה.' }
  }

  revalidatePath(`/instructor-dashboard/bookings`)
  return { success: true }
}

export async function getHealthDeclarations(bookingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('health_declarations')
    .select('*')
    .eq('booking_id', bookingId)
    .order('signed_at', { ascending: false })

  return data ?? []
}
