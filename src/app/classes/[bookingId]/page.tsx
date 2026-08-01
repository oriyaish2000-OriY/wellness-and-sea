import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { createClient } from '@/lib/supabase/server'
import { getOpenClassById, getEnrollmentCountForBooking } from '@/lib/supabase/queries'
import { MapPin, Clock, Users, ArrowRight, Calendar } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { EnrollButton } from './EnrollButton'

interface Props {
  params: Promise<{ bookingId: string }>
}

export default async function ClassDetailPage({ params }: Props) {
  const { bookingId } = await params
  const cls = await getOpenClassById(bookingId)
  if (!cls) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const enrolledCount = await getEnrollmentCountForBooking(bookingId)
  const spotsLeft = cls.max_students != null ? cls.max_students - enrolledCount : null
  const isFull = spotsLeft !== null && spotsLeft <= 0

  // Check if already enrolled
  let alreadyEnrolled = false
  if (user) {
    const { data: existing } = await supabase
      .from('class_enrollments')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('student_id', user.id)
      .neq('payment_status', 'cancelled')
      .single()
    alreadyEnrolled = !!existing
  }

  const venue = cls.venue as { id?: string; title?: string; location_city?: string; location_address?: string; images?: string[] } | null
  const instructor = cls.instructor as { id?: string; full_name?: string; avatar_url?: string; bio?: string; bit_phone?: string; paybox_phone?: string; instagram?: string } | null
  const dateObj = new Date(cls.booking_date)
  const dateStr = dateObj.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen" style={{ background: '#faf5ee' }}>
      <Navbar />
      <div style={{ paddingTop: 68 }}>
        {/* Hero image */}
        {venue?.images?.[0] && (
          <div className="relative h-56 md:h-72 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={venue.images[0]} alt={venue.title ?? ''} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        )}

        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href="/classes" className="inline-flex items-center gap-1.5 text-sm text-ocean mb-6 hover:underline">
            <ArrowRight className="w-4 h-4" />
            כל השיעורים
          </Link>

          {/* Class title */}
          <h1 className="text-2xl font-black text-deep-ocean mb-1">
            {cls.class_type ?? 'שיעור'}
          </h1>
          {venue && (
            <div className="flex items-center gap-1 text-gray-500 text-sm mb-6">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>{venue.title}{venue.location_city ? ` · ${venue.location_city}` : ''}</span>
            </div>
          )}

          {/* Details card */}
          <Card className="p-5 border-0 mb-5" style={{ boxShadow: '0 2px 16px rgba(10,74,74,0.08)' }}>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-ocean flex-shrink-0" />
                <span>{dateStr}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-ocean flex-shrink-0" />
                <span>{cls.start_time?.slice(0,5)} — {cls.end_time?.slice(0,5)}</span>
              </div>
              {cls.max_students != null && (
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-ocean flex-shrink-0" />
                  <span>
                    {enrolledCount} נרשמו · {spotsLeft} מקומות נותרו מתוך {cls.max_students}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Instructor card */}
          {instructor && (
            <Card className="p-5 border-0 mb-5" style={{ boxShadow: '0 2px 16px rgba(10,74,74,0.08)' }}>
              <div className="flex items-center gap-4 mb-3">
                {instructor.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={instructor.avatar_url} alt={instructor.full_name ?? ''} className="w-14 h-14 rounded-full object-cover border-2 border-ocean/20" />
                ) : (
                  <div className="w-14 h-14 rounded-full ocean-gradient flex items-center justify-center text-white text-xl font-black">
                    {instructor.full_name?.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-bold text-deep-ocean">{instructor.full_name}</p>
                  {instructor.instagram && (
                    <a
                      href={`https://instagram.com/${instructor.instagram.replace('@','')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-ocean hover:underline"
                    >
                      @{instructor.instagram.replace('@','')}
                    </a>
                  )}
                </div>
                <Link href={`/instructors/${instructor.id}`} className="mr-auto text-xs text-ocean hover:underline">
                  הפרופיל שלה
                </Link>
              </div>
              {instructor.bio && (
                <p className="text-sm text-gray-600 leading-relaxed">{instructor.bio}</p>
              )}
            </Card>
          )}

          {/* Payment & Enrollment */}
          <Card className="p-5 border-0" style={{ boxShadow: '0 2px 16px rgba(10,74,74,0.08)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-deep-ocean">הרשמה ותשלום</h2>
              {cls.price_per_student != null && (
                <div className="text-right">
                  <span className="font-black text-ocean text-2xl">₪{cls.price_per_student}</span>
                  <span className="text-xs text-gray-400 block">לשיעור</span>
                </div>
              )}
            </div>

            {/* Payment methods */}
            {(instructor?.bit_phone || instructor?.paybox_phone) && (
              <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(10,74,74,0.04)', border: '1px solid rgba(10,74,74,0.1)' }}>
                <p className="text-xs font-semibold text-gray-600 mb-2">לאחר ההרשמה, שלחי את התשלום ישירות למדריכה:</p>
                <div className="flex flex-wrap gap-2">
                  {instructor.bit_phone && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(13,110,110,0.06)', border: '1px solid rgba(13,110,110,0.15)' }}>
                      <span className="text-xl">💙</span>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Bit</div>
                        <div className="text-sm font-bold text-ocean">{instructor.bit_phone}</div>
                      </div>
                    </div>
                  )}
                  {instructor.paybox_phone && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(200,148,74,0.06)', border: '1px solid rgba(200,148,74,0.15)' }}>
                      <span className="text-xl">💛</span>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">PayBox</div>
                        <div className="text-sm font-bold" style={{ color: '#c8944a' }}>{instructor.paybox_phone}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <EnrollButton
              bookingId={bookingId}
              isFull={isFull}
              isLoggedIn={!!user}
              alreadyEnrolled={alreadyEnrolled}
            />
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  )
}
