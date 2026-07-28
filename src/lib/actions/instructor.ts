'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function saveVenue(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחוברת.' }

  const { error } = await supabase
    .from('saved_venues')
    .insert({ instructor_id: user.id, venue_id: venueId })

  if (error && error.code !== '23505') return { error: 'שגיאה בשמירת החלל.' }

  revalidatePath('/instructor-dashboard/saved')
  revalidatePath(`/venues/${venueId}`)
  return { success: true }
}

export async function unsaveVenue(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחוברת.' }

  const { error } = await supabase
    .from('saved_venues')
    .delete()
    .eq('instructor_id', user.id)
    .eq('venue_id', venueId)

  if (error) return { error: 'שגיאה בהסרת החלל.' }

  revalidatePath('/instructor-dashboard/saved')
  revalidatePath(`/venues/${venueId}`)
  return { success: true }
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחוברת.' }

  const fullName = (formData.get('full_name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()
  const bio = (formData.get('bio') as string)?.trim()
  const certificationUrl = (formData.get('certification_url') as string)?.trim()
  const insuranceUrl = (formData.get('insurance_url') as string)?.trim()
  const avatarUrl = (formData.get('avatar_url') as string)?.trim()
  const bitPhone = (formData.get('bit_phone') as string)?.trim()
  const payboxPhone = (formData.get('paybox_phone') as string)?.trim()
  const bankAccount = (formData.get('bank_account') as string)?.trim()
  const instagram = (formData.get('instagram') as string)?.trim()
  const specialtiesText = (formData.get('specialties_text') as string)?.trim()
  const specialties = specialtiesText
    ? specialtiesText.split(',').map(s => s.trim()).filter(Boolean)
    : undefined

  if (!fullName || fullName.length < 2) {
    return { error: 'שם מלא חייב להכיל לפחות 2 תווים.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone: phone || null,
      bio: bio || null,
      avatar_url: avatarUrl || null,
      certification_url: certificationUrl || null,
      insurance_url: insuranceUrl || null,
      bit_phone: bitPhone || null,
      paybox_phone: payboxPhone || null,
      bank_account: bankAccount || null,
      instagram: instagram || null,
      specialties: specialties && specialties.length > 0 ? specialties : null,
    })
    .eq('id', user.id)

  if (error) return { error: 'שגיאה בעדכון הפרופיל.' }

  revalidatePath('/instructor-dashboard/profile')
  revalidatePath('/host-dashboard/profile')
  return { success: true }
}
