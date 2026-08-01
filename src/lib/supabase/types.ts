export type UserRole = 'host' | 'instructor' | 'student'
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type MessageRole = 'user' | 'assistant'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  avatar_url?: string
  phone?: string
  bio?: string
  certification_url?: string
  insurance_url?: string
  created_at: string
  updated_at?: string
  bit_phone?: string
  paybox_phone?: string
  bank_account?: string
  specialties?: string[]
  instagram?: string
}

export interface VenueAmenities {
  ac?: boolean
  shade?: boolean
  toilets?: boolean
  shower?: boolean
  speakers?: boolean
  wifi?: boolean
  parking?: boolean
  sea_view?: boolean
  natural_light?: boolean
  power_outlets?: boolean
  accessible?: boolean
  [key: string]: boolean | undefined
}

export interface Venue {
  id: string
  host_id: string
  title: string
  description: string
  location_address: string
  location_city: string
  location_lat?: number
  location_lng?: number
  hourly_price: number // in ILS
  capacity: number // max participants
  space_size_sqm?: number
  amenities: VenueAmenities
  images: string[]
  bonus_offer?: string
  accessibility_info?: string
  is_active: boolean
  created_at: string
  updated_at?: string
  // joined fields
  host?: Profile
  availabilities?: Availability[]
}

export interface Availability {
  id: string
  venue_id: string
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=Sunday (Israeli convention)
  start_time: string // HH:MM
  end_time: string // HH:MM
}

export interface Booking {
  id: string
  venue_id: string
  instructor_id: string
  booking_date: string // YYYY-MM-DD
  start_time: string // HH:MM
  end_time: string // HH:MM
  total_price: number // ILS — what instructor pays
  platform_fee: number // ILS — hidden, never shown to users
  host_payout: number // ILS — total_price - platform_fee
  status: BookingStatus
  class_type?: string
  participants_count?: number
  special_requests?: string
  tranzila_transaction_id?: string
  cancelled_at?: string
  cancellation_reason?: string
  created_at: string
  // student class fields
  open_to_students?: boolean
  max_students?: number | null
  price_per_student?: number | null
  // joined fields
  venue?: Venue
  instructor?: Profile
}

export interface HealthDeclaration {
  id: string
  booking_id: string
  student_name: string
  student_phone: string
  declaration_text: string
  signed_at: string
  ip_address?: string
}

export interface Message {
  id: string
  user_id: string
  role: MessageRole
  content: string
  tool_calls?: Record<string, unknown>
  tool_results?: Record<string, unknown>
  session_id: string
  created_at: string
}

export interface SavedVenue {
  instructor_id: string
  venue_id: string
  saved_at: string
  venue?: Venue
}

export interface ClassEnrollment {
  id: string
  booking_id: string
  student_id: string
  enrolled_at: string
  booking?: Booking
}

// Filters for venue search
export interface VenueFilters {
  city?: string
  minCapacity?: number
  amenities?: string[]
  date?: string // YYYY-MM-DD
  startTime?: string // HH:MM
  maxPrice?: number
  lat?: number
  lng?: number
  radiusKm?: number
}

export interface Review {
  id: string
  venue_id: string
  booking_id: string
  instructor_id: string
  rating: number // 1-5
  comment?: string
  created_at: string
  // joined
  instructor?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}
