import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getVenueById } from '@/lib/supabase/queries'
import { createPendingBooking } from '@/lib/actions/bookings'
import { Navbar } from '@/components/layout/navbar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, Calendar, Clock, Users, ArrowRight, Shield } from 'lucide-react'

const CLASS_TYPES = [
  'יוגה',
  'פילאטיס',
  'מדיטציה',
  'כושר פונקציונלי',
  'ריקוד',
  'אימון קבוצתי',
  'אחר',
]

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
  if (!user) redirect(`/auth/login?next=/booking/${venueId}?date=${date}&start=${start}&end=${end}`)

  const role = user.user_metadata?.role
  if (role !== 'instructor') redirect('/instructor-dashboard')

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
          <form action={createPendingBooking} className="space-y-4">
            {/* Hidden fields */}
            <input type="hidden" name="venue_id" value={venueId} />
            <input type="hidden" name="booking_date" value={date} />
            <input type="hidden" name="start_time" value={start} />
            <input type="hidden" name="end_time" value={end} />

            {/* Class type */}
            <div>
              <Label htmlFor="class_type" className="text-sm font-semibold text-deep-ocean">
                סוג השיעור
              </Label>
              <select
                id="class_type"
                name="class_type"
                required
                className="w-full mt-1.5 p-3 text-sm rounded-lg outline-none"
                style={{ border: '1.5px solid #f0e6d3', background: '#faf5ee', direction: 'rtl' }}
              >
                <option value="">בחרי סוג שיעור...</option>
                {CLASS_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Participants */}
            <div>
              <Label htmlFor="participants_count" className="text-sm font-semibold text-deep-ocean">
                מספר משתתפים משוער
              </Label>
              <div className="relative mt-1.5">
                <Users className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  id="participants_count"
                  name="participants_count"
                  type="number"
                  min={1}
                  max={venue.capacity}
                  placeholder={`עד ${venue.capacity} משתתפים`}
                  className="pr-9 text-right"
                  style={{ background: '#faf5ee', border: '1.5px solid #f0e6d3' }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">קיבולת מרבית של החלל: {venue.capacity} אנשים</p>
            </div>

            {/* Special requests */}
            <div>
              <Label htmlFor="special_requests" className="text-sm font-semibold text-deep-ocean">
                בקשות מיוחדות (אופציונלי)
              </Label>
              <textarea
                id="special_requests"
                name="special_requests"
                rows={3}
                placeholder="לדוגמה: נדרש מיזוג, גישה לחשמל, חניה..."
                className="w-full mt-1.5 p-3 text-sm rounded-lg resize-none outline-none text-right"
                style={{ border: '1.5px solid #f0e6d3', background: '#faf5ee' }}
              />
            </div>

            {/* Trust signal */}
            <div
              className="flex items-start gap-2.5 p-3.5 rounded-xl text-xs"
              style={{ background: 'rgba(92,140,110,0.08)', color: '#1a5c3a' }}
            >
              <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                לא תחויבי עד לאישור תשלום. ניתן לבטל ולקבל החזר מלא עד 24 שעות לפני מועד השיעור.
              </span>
            </div>

            <Button
              type="submit"
              className="w-full text-white font-bold text-base"
              style={{
                height: 52,
                borderRadius: 50,
                background: 'linear-gradient(135deg, #c8944a, #e8b870)',
                border: 'none',
              }}
            >
              המשך לתשלום ←
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
