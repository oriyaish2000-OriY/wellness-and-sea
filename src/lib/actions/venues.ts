'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { calculatePlatformFee, MANDATORY_VENUE_FIELDS } from '@/lib/constants'

interface VenueFormData {
  title: string
  description: string
  location_address: string
  location_city: string
  hourly_price: number
  capacity: number
  space_size_sqm: number
  amenities: Record<string, boolean>
  images: string[]
  bonus_offer?: string
  accessibility_info?: string
  availabilities: Array<{
    day_of_week: number
    start_time: string
    end_time: string
  }>
}

function parseVenueFormData(formData: FormData): VenueFormData {
  const amenitiesRaw = formData.get('amenities') as string
  const imagesRaw = formData.get('images') as string
  const availabilitiesRaw = formData.get('availabilities') as string

  return {
    title: (formData.get('title') as string)?.trim(),
    description: (formData.get('description') as string)?.trim(),
    location_address: (formData.get('location_address') as string)?.trim(),
    location_city: (formData.get('location_city') as string)?.trim(),
    hourly_price: parseInt(formData.get('hourly_price') as string) || 0,
    capacity: parseInt(formData.get('capacity') as string) || 0,
    space_size_sqm: parseInt(formData.get('space_size_sqm') as string) || 0,
    amenities: amenitiesRaw ? JSON.parse(amenitiesRaw) : {},
    images: imagesRaw ? JSON.parse(imagesRaw) : [],
    bonus_offer: (formData.get('bonus_offer') as string)?.trim() || undefined,
    accessibility_info: (formData.get('accessibility_info') as string)?.trim() || undefined,
    availabilities: availabilitiesRaw ? JSON.parse(availabilitiesRaw) : [],
  }
}

function validateVenueData(data: VenueFormData): string | null {
  for (const field of MANDATORY_VENUE_FIELDS) {
    const value = data[field as keyof VenueFormData]
    if (!value || (typeof value === 'number' && value <= 0)) {
      const fieldNames: Record<string, string> = {
        title: 'שם המקום',
        description: 'תיאור',
        location_address: 'כתובת',
        location_city: 'עיר',
        hourly_price: 'מחיר לשעה',
        capacity: 'קיבולת',
        space_size_sqm: 'גודל החלל',
      }
      return `שדה חובה חסר: ${fieldNames[field] ?? field}`
    }
  }

  if (data.availabilities.length === 0) {
    return 'יש להגדיר לפחות יום זמינות אחד עם שעות'
  }

  const hasAmenity = Object.values(data.amenities).some(Boolean)
  if (!hasAmenity) {
    return 'יש לסמן לפחות מתקן אחד'
  }

  return null
}

export async function createVenue(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'לא מחוברת. אנא התחברי שוב.' }

  const role = user.user_metadata?.role
  if (role !== 'host') return { error: 'רק בעלי עסקים יכולים לפרסם חללים.' }

  const venueData = parseVenueFormData(formData)
  const validationError = validateVenueData(venueData)
  if (validationError) return { error: validationError }

  const { availabilities, ...venueFields } = venueData

  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .insert({
      ...venueFields,
      host_id: user.id,
      is_active: false, // starts as draft
    })
    .select('id')
    .single()

  if (venueError || !venue) {
    console.error('createVenue error:', venueError)
    return { error: 'שגיאה ביצירת החלל. אנא נסי שוב.' }
  }

  // Insert availabilities
  if (availabilities.length > 0) {
    const { error: availError } = await supabase
      .from('availabilities')
      .insert(availabilities.map(a => ({ ...a, venue_id: venue.id })))

    if (availError) {
      console.error('availabilities error:', availError)
      // Don't fail — venue was created, user can add availability later
    }
  }

  revalidatePath('/host-dashboard')
  redirect(`/host-dashboard/venues/${venue.id}?created=true`)
}

export async function updateVenue(venueId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'לא מחוברת.' }

  const venueData = parseVenueFormData(formData)
  const { availabilities, ...venueFields } = venueData

  const { error } = await supabase
    .from('venues')
    .update(venueFields)
    .eq('id', venueId)
    .eq('host_id', user.id)

  if (error) return { error: 'שגיאה בעדכון החלל.' }

  // Replace availabilities
  if (availabilities.length > 0) {
    await supabase.from('availabilities').delete().eq('venue_id', venueId)
    await supabase
      .from('availabilities')
      .insert(availabilities.map(a => ({ ...a, venue_id: venueId })))
  }

  revalidatePath(`/host-dashboard/venues/${venueId}`)
  revalidatePath(`/venues/${venueId}`)
  return { success: true }
}

export async function publishVenue(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחוברת.' }

  // Verify all mandatory fields before publishing
  const { data: venue } = await supabase
    .from('venues')
    .select('*, availabilities(*)')
    .eq('id', venueId)
    .eq('host_id', user.id)
    .single()

  if (!venue) return { error: 'החלל לא נמצא.' }

  const validationError = validateVenueData({
    ...venue,
    availabilities: venue.availabilities ?? [],
  })
  if (validationError) return { error: `לא ניתן לפרסם: ${validationError}` }

  if (!venue.images || venue.images.length === 0) {
    return { error: 'לא ניתן לפרסם ללא תמונות. יש להעלות לפחות תמונה אחת.' }
  }

  const { error } = await supabase
    .from('venues')
    .update({ is_active: true })
    .eq('id', venueId)
    .eq('host_id', user.id)

  if (error) return { error: 'שגיאה בפרסום החלל.' }

  revalidatePath('/host-dashboard/venues')
  revalidatePath('/venues')
  return { success: true }
}

export async function pauseVenue(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחוברת.' }

  const { error } = await supabase
    .from('venues')
    .update({ is_active: false })
    .eq('id', venueId)
    .eq('host_id', user.id)

  if (error) return { error: 'שגיאה בהשהיית החלל.' }

  revalidatePath('/host-dashboard/venues')
  revalidatePath('/venues')
  return { success: true }
}

export async function deleteVenue(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחוברת.' }

  // Check for active bookings
  const { data: activeBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('venue_id', venueId)
    .in('status', ['pending', 'confirmed'])
    .limit(1)

  if (activeBookings && activeBookings.length > 0) {
    return { error: 'לא ניתן למחוק חלל עם הזמנות פעילות. יש לבטל אותן תחילה.' }
  }

  const { error } = await supabase
    .from('venues')
    .delete()
    .eq('id', venueId)
    .eq('host_id', user.id)

  if (error) return { error: 'שגיאה במחיקת החלל.' }

  revalidatePath('/host-dashboard/venues')
  redirect('/host-dashboard/venues')
}

// For platform fee calculation (used in booking actions too)
export { calculatePlatformFee }
