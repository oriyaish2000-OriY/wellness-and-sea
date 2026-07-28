import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Clock } from 'lucide-react'

export default async function InstructorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: instructor } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('role', 'instructor')
    .single()

  if (!instructor) notFound()

  const today = new Date().toISOString().split('T')[0]
  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select('id, booking_date, start_time, end_time, class_type, participants_count, venue:venues(id, title, location_city, images, hourly_price)')
    .eq('instructor_id', id)
    .eq('status', 'confirmed')
    .gte('booking_date', today)
    .order('booking_date')
    .limit(10)

  return (
    <div className="min-h-screen" style={{ background: '#faf5ee' }}>
      <Navbar />
      <div style={{ paddingTop: 68 }}>
        {/* Hero */}
        <div className="relative overflow-hidden" style={{ background: 'linear-gradient(145deg, #0a4a4a 0%, #0d6e6e 55%, #1a9090 100%)', padding: '48px 24px 72px' }}>
          <div className="relative z-10 max-w-2xl mx-auto text-center">
            {instructor.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={instructor.avatar_url} alt={instructor.full_name} className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-white/20" />
            ) : (
              <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl font-black text-white" style={{ background: 'rgba(255,255,255,0.15)', border: '3px solid rgba(255,255,255,0.25)' }}>
                {instructor.full_name?.charAt(0)}
              </div>
            )}
            <h1 className="font-black text-white text-3xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              {instructor.full_name}
            </h1>
            {instructor.bio && (
              <p className="text-white/70 text-sm leading-relaxed max-w-md mx-auto">{instructor.bio}</p>
            )}
            {instructor.specialties && instructor.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {instructor.specialties.map((s: string) => (
                  <span key={s} className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>{s}</span>
                ))}
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 48" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
              <path d="M0,24 C360,0 1080,48 1440,24 L1440,48 L0,48 Z" fill="#faf5ee" />
            </svg>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
          {/* Payment info */}
          {(instructor.bit_phone || instructor.paybox_phone) && (
            <div className="rounded-2xl p-6" style={{ background: 'white', boxShadow: '0 2px 16px rgba(10,74,74,0.08)' }}>
              <h2 className="font-bold text-lg mb-4" style={{ color: '#0a4a4a', fontFamily: "'Playfair Display', serif" }}>
                תשלום ישיר למדריכה
              </h2>
              <p className="text-sm mb-4" style={{ color: '#6b7c7c' }}>
                לאחר ההרשמה לשיעור, שלחי את התשלום ישירות למדריכה:
              </p>
              <div className="flex flex-wrap gap-3">
                {instructor.bit_phone && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(13,110,110,0.06)', border: '1px solid rgba(13,110,110,0.15)' }}>
                    <span className="text-2xl">💙</span>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b7c7c' }}>Bit</div>
                      <div className="font-bold" style={{ color: '#0d6e6e' }}>{instructor.bit_phone}</div>
                    </div>
                  </div>
                )}
                {instructor.paybox_phone && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(200,148,74,0.06)', border: '1px solid rgba(200,148,74,0.15)' }}>
                    <span className="text-2xl">💛</span>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6b7c7c' }}>PayBox</div>
                      <div className="font-bold" style={{ color: '#c8944a' }}>{instructor.paybox_phone}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upcoming classes */}
          <div>
            <h2 className="font-bold text-xl mb-5" style={{ color: '#0a4a4a', fontFamily: "'Playfair Display', serif" }}>
              שיעורים קרובים
            </h2>
            {!upcomingBookings || upcomingBookings.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: 'white', boxShadow: '0 2px 16px rgba(10,74,74,0.08)' }}>
                <div className="text-4xl mb-3">🌊</div>
                <p className="font-semibold" style={{ color: '#0a4a4a' }}>אין שיעורים מתוכננים כרגע</p>
                <p className="text-sm mt-1" style={{ color: '#6b7c7c' }}>בדקי שוב בקרוב!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingBookings.map((booking: {
                  id: string
                  booking_date: string
                  start_time: string
                  end_time: string
                  class_type?: string
                  participants_count?: number
                  venue?: { id?: string; title?: string; location_city?: string; images?: string[]; hourly_price?: number } | null
                }) => {
                  const venue = booking.venue as { id?: string; title?: string; location_city?: string; images?: string[]; hourly_price?: number } | null
                  const dateObj = new Date(booking.booking_date)
                  const dateStr = dateObj.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
                  return (
                    <div key={booking.id} className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 2px 16px rgba(10,74,74,0.08)' }}>
                      <div className="flex gap-4 p-4">
                        {/* Date badge */}
                        <div className="flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center text-white text-center" style={{ background: 'linear-gradient(145deg, #0a4a4a, #0d6e6e)' }}>
                          <div className="text-xl font-black leading-none">{dateObj.getDate()}</div>
                          <div className="text-[10px] opacity-80">{dateObj.toLocaleDateString('he-IL', { month: 'short' })}</div>
                        </div>
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#0d6e6e' }} />
                            <span className="text-sm font-semibold" style={{ color: '#0d6e6e' }}>{booking.start_time} — {booking.end_time}</span>
                          </div>
                          {booking.class_type && (
                            <div className="font-bold text-base mb-1" style={{ color: '#1a2a2a' }}>{booking.class_type}</div>
                          )}
                          {venue && (
                            <div className="flex items-center gap-1 text-xs" style={{ color: '#6b7c7c' }}>
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{venue.title}{venue.location_city ? ` · ${venue.location_city}` : ''}</span>
                            </div>
                          )}
                        </div>
                        {/* CTA */}
                        {venue?.id && (
                          <Link href={`/venues/${venue.id}`} className="flex-shrink-0 self-center px-4 py-2 rounded-full text-xs font-bold" style={{ background: '#0d6e6e', color: 'white' }}>
                            לחלל
                          </Link>
                        )}
                      </div>
                      <div className="px-4 pb-4 text-xs" style={{ color: '#6b7c7c' }}>{dateStr}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Instagram */}
          {instructor.instagram && (
            <div className="text-center">
              <a href={`https://instagram.com/${instructor.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm" style={{ background: 'rgba(13,110,110,0.08)', color: '#0d6e6e' }}>
                📸 @{instructor.instagram.replace('@', '')} באינסטגרם
              </a>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
