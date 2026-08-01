import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getVenueById } from '@/lib/supabase/queries'
import { Navbar } from '@/components/layout/navbar'
import { Card } from '@/components/ui/card'
import { MapPin, Calendar, Clock, ArrowRight } from 'lucide-react'
import { BookingForm } from './BookingForm'

interface Props {
  params: Promise<{ venueId: string }>
  searchParams: Promise<{ date?: string; start?: string; end?: string }>
}

export default async function BookingFormPage({ params, searchParams }: Props) {
  const { venueId } = await params
  const { date, start, end } = await searchParams

  if (!date || !start || !end) redirect(`/venues/${venueId}`)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?role=instructor&next=/booking/${venueId}?date=${date}&start=${start}&end=${end}`)

  const role = user.user_metadata?.role
  if (role === 'host') redirect('/host-dashboard')
  if (role !== 'instructor') redirect(`/venues/${venueId}`)

  const venue = await getVenueById(venueId)
  if (!venue) notFound()

  // Calculate price
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const durationHours = (endH * 60 + endM - (startH * 60 + startM)) / 60
  const totalPrice = Math.round(venue.hourly_price * durationHours)

  const dateFormatted = new Date(date).toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen" style={{ background: '#faf5ee' }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 pt-24">

        {/* Back link */}
        <Link
          href={`/venues/${venueId}`}
          className="inline-flex items-center gap-1.5 text-sm text-ocean mb-6 hover:underline"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה לדף החלל
        </Link>

        <h1 className="text-2xl font-black text-deep-ocean mb-1">סיום ההזמנה</h1>
        <p className="text-gray-500 text-sm mb-6">מלאי את הפרטים האחרונים לפני התשלום</p>

        {/* Booking summary card */}
        <Card className="p-5 mb-5 border-0" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h2 className="font-bold text-deep-ocean mb-3 text-base">סיכום הזמנה</h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-start gap-2.5 text-gray-600">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-ocean" />
              <div>
                <p className="font-semibold text-gray-900">{venue.title}</p>
                <p className="text-xs">{venue.location_address}, {venue.location_city}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-gray-600">
              <Calendar className="w-4 h-4 flex-shrink-0 text-ocean" />
              <span>{dateFormatted}</span>
            </div>
            <div className="flex items-center gap-2.5 text-gray-600">
              <Clock className="w-4 h-4 flex-shrink-0 text-ocean" />
              <span>{start} – {end} ({durationHours === 1 ? 'שעה אחת' : durationHours === 1.5 ? '1.5 שעות' : `${durationHours} שעות`})</span>
            </div>
          </div>
          <div
            className="flex justify-between items-center mt-4 pt-4 font-black text-ocean text-lg"
            style={{ borderTop: '1px solid #f0e6d3' }}
          >
            <span>סה&quot;כ לתשלום</span>
            <span>₪{totalPrice}</span>
          </div>
        </Card>

        {/* Booking details form */}
        <Card className="p-5 border-0" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h2 className="font-bold text-deep-ocean mb-4 text-base">פרטי השיעור</h2>
          <BookingForm
            venueId={venueId}
            date={date}
            startTime={start}
            endTime={end}
            capacity={venue.capacity}
          />
        </Card>
      </div>
    </div>
  )
}
