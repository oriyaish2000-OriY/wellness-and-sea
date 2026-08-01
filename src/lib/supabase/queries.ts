import { createClient } from './server'
import type { Venue, Profile, Availability, Booking, VenueFilters, Review } from './types'

// ============================================================
// VENUES
// ============================================================

// Haversine distance in km between two lat/lng points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function getVenues(filters: VenueFilters = {}): Promise<Venue[]> {
  const supabase = await createClient()

  let query = supabase
    .from('venues')
    .select('*, host:profiles!venues_host_id_fkey(id, full_name, avatar_url)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (filters.city) {
    query = query.eq('location_city', filters.city)
  }

  if (filters.minCapacity) {
    query = query.gte('capacity', filters.minCapacity)
  }

  if (filters.maxPrice) {
    query = query.lte('hourly_price', filters.maxPrice)
  }

  if (filters.amenities && filters.amenities.length > 0) {
    for (const amenity of filters.amenities) {
      query = query.eq(`amenities->>${amenity}`, 'true')
    }
  }

  if (filters.date && filters.startTime) {
    const dayOfWeek = new Date(filters.date).getDay()
    const { data: availableVenueIds } = await supabase
      .from('availabilities')
      .select('venue_id')
      .eq('day_of_week', dayOfWeek)
      .lte('start_time', filters.startTime)

    if (availableVenueIds && availableVenueIds.length > 0) {
      const ids = availableVenueIds.map(a => a.venue_id)
      query = query.in('id', ids)
    }
  }

  const { data, error } = await query.limit(100)

  if (error) {
    console.error('getVenues error:', error)
    return []
  }

  let venues = (data as Venue[]) ?? []

  // Client-side radius filter using haversine (Supabase Free tier lacks PostGIS)
  if (filters.lat && filters.lng && filters.radiusKm) {
    const { lat, lng, radiusKm } = filters
    venues = venues.filter(v => {
      if (!v.location_lat || !v.location_lng) return true // include if no coordinates
      return haversineKm(lat, lng, v.location_lat, v.location_lng) <= radiusKm
    })
  }

  return venues.slice(0, 50)
}

export async function getNearbyVenues(
  lat: number,
  lng: number,
  radiusKm = 10,
  limit = 8
): Promise<Array<Venue & { distance_km: number }>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('is_active', true)
    .not('location_lat', 'is', null)
    .not('location_lng', 'is', null)

  if (error || !data) return []

  return (data as Venue[])
    .map(v => ({
      ...v,
      distance_km: haversineKm(lat, lng, v.location_lat!, v.location_lng!),
    }))
    .filter(v => v.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit)
}

export async function getVenueById(id: string): Promise<Venue | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('venues')
    .select(`
      *,
      host:profiles!venues_host_id_fkey(id, full_name, avatar_url, bio, phone),
      availabilities(*)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as Venue
}

export async function getHostVenues(hostId: string): Promise<Venue[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('venues')
    .select('*, availabilities(*)')
    .eq('host_id', hostId)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data as Venue[]) ?? []
}

export async function getVenueAvailabilities(venueId: string): Promise<Availability[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('availabilities')
    .select('*')
    .eq('venue_id', venueId)
    .order('day_of_week')
    .order('start_time')

  if (error) return []
  return (data as Availability[]) ?? []
}

// Venues added in the last N days
export async function getNewVenues(limit = 6, withinDays = 30): Promise<Venue[]> {
  const supabase = await createClient()
  const since = new Date(Date.now() - withinDays * 86400000).toISOString()

  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('is_active', true)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return (data as Venue[]) ?? []
}

// Curated recommended venues (featured = true or highest rated)
export async function getRecommendedVenues(limit = 6): Promise<Venue[]> {
  const supabase = await createClient()

  // In production this would filter by a `featured` flag or rating
  // For now: active venues ordered by capacity desc (proxy for "popular")
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('is_active', true)
    .order('capacity', { ascending: false })
    .limit(limit)

  if (error) return []
  return (data as Venue[]) ?? []
}

// Venues near a given city (exact city match for now; lat/lng sorting can be added)
export async function getVenuesByCity(city: string, limit = 8): Promise<Venue[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('is_active', true)
    .eq('location_city', city)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return (data as Venue[]) ?? []
}

// ============================================================
// BOOKINGS
// ============================================================

export async function getBookingsForVenueOnDate(
  venueId: string,
  date: string
): Promise<Booking[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('venue_id', venueId)
    .eq('booking_date', date)
    .not('status', 'eq', 'cancelled')

  if (error) return []
  return (data as Booking[]) ?? []
}

export async function getInstructorBookings(instructorId: string): Promise<Booking[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      venue:venues(id, title, location_address, location_city, images, hourly_price)
    `)
    .eq('instructor_id', instructorId)
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false })

  if (error) return []
  return (data as Booking[]) ?? []
}

// Venues the instructor has previously visited (distinct, from confirmed/completed bookings)
export async function getRecentlyVisitedVenues(
  instructorId: string,
  limit = 6
): Promise<Venue[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select('venue:venues(id, title, location_address, location_city, hourly_price, capacity, space_size_sqm, amenities, images, bonus_offer, is_active, created_at, host_id)')
    .eq('instructor_id', instructorId)
    .in('status', ['confirmed', 'completed'])
    .order('booking_date', { ascending: false })
    .limit(limit * 3) // fetch more to deduplicate

  if (error || !data) return []

  // Deduplicate by venue id, keep most recent
  const seen = new Set<string>()
  const venues: Venue[] = []
  for (const row of data) {
    const v = row.venue as unknown as Venue
    if (v && !seen.has(v.id)) {
      seen.add(v.id)
      venues.push(v)
      if (venues.length >= limit) break
    }
  }
  return venues
}

export async function getHostBookings(hostId: string): Promise<Booking[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      venue:venues(id, title, location_city),
      instructor:profiles(id, full_name, avatar_url, phone)
    `)
    .eq('venues.host_id', hostId)
    .order('booking_date', { ascending: false })

  if (error) {
    const { data: venues } = await supabase
      .from('venues')
      .select('id')
      .eq('host_id', hostId)

    if (!venues || venues.length === 0) return []

    const venueIds = venues.map(v => v.id)
    const { data: bookings } = await supabase
      .from('bookings')
      .select(`
        *,
        venue:venues(id, title, location_city),
        instructor:profiles(id, full_name, avatar_url, phone)
      `)
      .in('venue_id', venueIds)
      .order('booking_date', { ascending: false })

    return (bookings as Booking[]) ?? []
  }

  return (data as Booking[]) ?? []
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      venue:venues(*, host:profiles!venues_host_id_fkey(id, full_name, phone, bit_phone, paybox_phone)),
      instructor:profiles!bookings_instructor_id_fkey(id, full_name, avatar_url, phone, bit_phone, paybox_phone)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as Booking
}

// ============================================================
// PROFILES
// ============================================================

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data as Profile
}

export async function getCurrentUserProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return getProfile(user.id)
}

// ============================================================
// SAVED VENUES
// ============================================================

export async function getSavedVenues(instructorId: string): Promise<Venue[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('saved_venues')
    .select('venue:venues(*)')
    .eq('instructor_id', instructorId)
    .order('saved_at', { ascending: false })

  if (error) return []
  return (data?.map(sv => sv.venue).filter(Boolean) ?? []) as unknown as Venue[]
}

export async function isVenueSaved(
  instructorId: string,
  venueId: string
): Promise<boolean> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('saved_venues')
    .select('instructor_id')
    .eq('instructor_id', instructorId)
    .eq('venue_id', venueId)
    .single()

  return !!data
}

// Venues the instructor books repeatedly — "regular spots"
export async function getRegularVenues(
  instructorId: string,
  minVisits = 2,
  limit = 6
): Promise<Array<Venue & { visit_count: number; last_visit: string }>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select('venue_id, booking_date, venue:venues(id, title, location_address, location_city, hourly_price, capacity, space_size_sqm, amenities, images, bonus_offer, is_active, created_at, host_id)')
    .eq('instructor_id', instructorId)
    .in('status', ['confirmed', 'completed'])
    .order('booking_date', { ascending: false })

  if (error || !data) return []

  // Group by venue_id
  const map = new Map<string, { venue: Venue; count: number; lastVisit: string }>()
  for (const row of data) {
    const v = row.venue as unknown as Venue
    if (!v) continue
    const existing = map.get(v.id)
    if (existing) {
      existing.count++
      if (row.booking_date > existing.lastVisit) existing.lastVisit = row.booking_date
    } else {
      map.set(v.id, { venue: v, count: 1, lastVisit: row.booking_date })
    }
  }

  return Array.from(map.values())
    .filter((e) => e.count >= minVisits)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((e) => ({ ...e.venue, visit_count: e.count, last_visit: e.lastVisit }))
}

// Venues with confirmed bookings happening RIGHT NOW
export async function getHappeningNowVenues(limit = 6): Promise<Array<Venue & { current_class_type?: string }>> {
  const supabase = await createClient()

  const now = new Date()
  const todayDate = now.toISOString().split('T')[0]
  const currentTime = now.toTimeString().slice(0, 5) // HH:MM

  const { data, error } = await supabase
    .from('bookings')
    .select('class_type, venue:venues(id, title, location_address, location_city, hourly_price, capacity, space_size_sqm, amenities, images, bonus_offer, is_active, created_at, host_id)')
    .eq('booking_date', todayDate)
    .eq('status', 'confirmed')
    .lte('start_time', currentTime)
    .gte('end_time', currentTime)
    .limit(limit)

  if (error || !data) return []

  const seen = new Set<string>()
  const venues: Array<Venue & { current_class_type?: string }> = []
  for (const row of data) {
    const v = row.venue as unknown as Venue
    if (!v || seen.has(v.id)) continue
    seen.add(v.id)
    venues.push({ ...v, current_class_type: row.class_type ?? undefined })
  }
  return venues
}

// ============================================================
// REVIEWS
// ============================================================

export async function getVenueReviews(venueId: string): Promise<Review[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reviews')
    .select('*, instructor:profiles(id, full_name, avatar_url)')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return []
  return (data as Review[]) ?? []
}

export async function getVenueRatingSummary(venueId: string): Promise<{ avg: number; count: number }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('venue_id', venueId)

  if (error || !data || data.length === 0) return { avg: 0, count: 0 }

  const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length
  return { avg: Math.round(avg * 10) / 10, count: data.length }
}

// ============================================================
// STUDENT
// ============================================================

export async function getStudentEnrollments(studentId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('class_enrollments')
    .select(`
      *,
      booking:bookings(
        id, booking_date, start_time, end_time, status, class_type,
        venue:venues(id, title, location_city, images),
        instructor:profiles(id, full_name, avatar_url, instagram)
      )
    `)
    .eq('student_id', studentId)
    .order('enrolled_at', { ascending: false })
  if (error) return []
  return data ?? []
}

export async function getInstructorStudentRoster(instructorId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('health_declarations')
    .select(`
      student_name, student_phone, signed_at,
      booking:bookings(booking_date, class_type, start_time, end_time,
        venue:venues(title, location_city))
    `)
    .eq('bookings.instructor_id', instructorId)
    .order('signed_at', { ascending: false })
  if (error) return []
  return data ?? []
}

export async function getHealthDeclarationsForInstructor(instructorId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('health_declarations')
    .select('*, booking:bookings!inner(instructor_id, booking_date, start_time, venue:venues(title))')
    .eq('booking.instructor_id', instructorId)
  return data ?? []
}

export async function getBookingForReview(bookingId: string): Promise<Booking | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('bookings')
    .select('id, status, venue_id, instructor_id')
    .eq('id', bookingId)
    .eq('instructor_id', user.id)
    .eq('status', 'completed')
    .single()

  return data as Booking | null
}

export async function hasReviewedBooking(bookingId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('reviews')
    .select('id')
    .eq('booking_id', bookingId)
    .single()
  return !!data
}

export async function getOpenClasses(limit = 30) {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, booking_date, start_time, end_time, class_type,
      participants_count, max_students, price_per_student,
      venue:venues(id, title, location_city, location_address, images),
      instructor:profiles!bookings_instructor_id_fkey(id, full_name, avatar_url, bio, instagram, bit_phone, paybox_phone)
    `)
    .eq('open_to_students', true)
    .eq('status', 'confirmed')
    .gte('booking_date', today)
    .order('booking_date')
    .limit(limit)

  if (error) {
    console.error('getOpenClasses error:', error)
    return []
  }
  return data ?? []
}

export async function getOpenClassById(bookingId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, booking_date, start_time, end_time, class_type,
      participants_count, max_students, price_per_student,
      special_requests,
      venue:venues(id, title, location_city, location_address, images, hourly_price),
      instructor:profiles!bookings_instructor_id_fkey(id, full_name, avatar_url, bio, instagram, bit_phone, paybox_phone)
    `)
    .eq('id', bookingId)
    .eq('open_to_students', true)
    .eq('status', 'confirmed')
    .single()

  if (error || !data) return null
  return data
}

export async function getEnrollmentCountForBooking(bookingId: string): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('class_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .neq('payment_status', 'cancelled')
  return count ?? 0
}

// ============================================================
// STATS (for dashboards)
// ============================================================

export async function getHostStats(hostId: string) {
  const supabase = await createClient()

  const [venuesRes, bookingsRes] = await Promise.all([
    supabase
      .from('venues')
      .select('id, is_active')
      .eq('host_id', hostId),
    supabase
      .from('bookings')
      .select('host_payout, status, created_at')
      .in(
        'venue_id',
        (await supabase.from('venues').select('id').eq('host_id', hostId)).data?.map(v => v.id) ?? []
      ),
  ])

  const venues = venuesRes.data ?? []
  const bookings = bookingsRes.data ?? []

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed')
  const thisMonthBookings = confirmedBookings.filter(b => b.created_at >= thisMonthStart)

  return {
    totalVenues: venues.length,
    activeVenues: venues.filter(v => v.is_active).length,
    totalBookings: confirmedBookings.length,
    thisMonthBookings: thisMonthBookings.length,
    thisMonthEarnings: thisMonthBookings.reduce((sum, b) => sum + (b.host_payout ?? 0), 0),
    totalEarnings: confirmedBookings.reduce((sum, b) => sum + (b.host_payout ?? 0), 0),
  }
}
