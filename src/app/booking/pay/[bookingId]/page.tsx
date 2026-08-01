import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/supabase/queries'
import { Navbar } from '@/components/layout/navbar'
import { Card } from '@/components/ui/card'
import { MapPin, Calendar, Clock, ArrowRight, ShieldCheck } from 'lucide-react'
import { PaymentActions } from './PaymentActions'

interface Props {
  params: Promise<{ bookingId: string }>
}

export default async function BookingPayPage({ params }: Props) {
  const { bookingId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?role=instructor&next=/booking/pay/${bookingId}`)

  const booking = await getBookingById(bookingId)
  if (!booking) notFound()

  // Ownership — only the booking instructor can access this page
  if (booking.instructor_id !== user.id) redirect('/instructor-dashboard/bookings')

  // Already confirmed/completed → go to confirm page
  if (booking.status === 'confirmed' || booking.status === 'completed') {
    redirect(`/booking/confirm/${bookingId}`)
  }
  // Cancelled → 404
  if (booking.status === 'cancelled') notFound()

  const venue = booking.venue as {
    title?: string; location_city?: string; location_address?: string
    host?: { bit_phone?: string; paybox_phone?: string; phone?: string }
  } | null

  const hostBitPhone = venue?.host?.bit_phone ?? venue?.host?.phone ?? null
  const hostPayboxPhone = venue?.host?.paybox_phone ?? venue?.host?.phone ?? null

  const dateFormatted = new Date(booking.booking_date).toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const [startH, startM] = booking.start_time.split(':').map(Number)
  const [endH, endM] = booking.end_time.split(':').map(Number)
  const durationHours = (endH * 60 + endM - (startH * 60 + startM)) / 60
  const durationLabel = durationHours === 1 ? 'שעה אחת' : durationHours === 1.5 ? 'שעה וחצי' : `${durationHours} שעות`

  return (
    <div className="min-h-screen" style={{ background: '#faf5ee' }}>
      <Navbar />
      <div className="max-w-xl mx-auto px-4 py-8 pt-24">

        <Link
          href="/instructor-dashboard/bookings"
          className="inline-flex items-center gap-1.5 text-sm text-ocean mb-6 hover:underline"
        >
          <ArrowRight className="w-4 h-4" />
          ההזמנות שלי
        </Link>

        <h1 className="text-2xl font-black text-deep-ocean mb-1">תשלום להזמנה</h1>
        <p className="text-sm text-gray-500 mb-6">
          לאחר השלמת התשלום ההזמנה תאושר אוטומטית ותופיע ביומן שלך
        </p>

        {/* Booking summary */}
        <Card className="p-5 border-0 mb-5" style={{ boxShadow: '0 2px 16px rgba(10,74,74,0.08)' }}>
          <h2 className="font-bold text-deep-ocean text-sm mb-3">סיכום ההזמנה</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 mt-0.5 text-ocean flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">{venue?.title}</p>
                <p className="text-xs text-gray-500">{venue?.location_address}, {venue?.location_city}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-ocean flex-shrink-0" />
              <span>{dateFormatted}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-ocean flex-shrink-0" />
              <span>
                {booking.start_time.slice(0, 5)} – {booking.end_time.slice(0, 5)}
                <span className="text-gray-400 mr-1">({durationLabel})</span>
              </span>
            </div>
          </div>
          <div
            className="flex justify-between items-center mt-4 pt-4 font-black text-ocean text-xl"
            style={{ borderTop: '1px solid #f0e6d3' }}
          >
            <span>סה&quot;כ לתשלום</span>
            <span>₪{booking.total_price.toLocaleString('he-IL')}</span>
          </div>
        </Card>

        {/* Payment — Grow by Meshulam handles ALL methods (credit, Bit, PayBox, Apple/Google Pay) */}
        <div className="space-y-3">
          <PaymentActions
            bookingId={bookingId}
            totalPrice={booking.total_price}
            venueTitle={venue?.title ?? ''}
            hostPayout={booking.host_payout}
            hostBitPhone={hostBitPhone}
            hostPayboxPhone={hostPayboxPhone}
          />

          {/* Confirmation flow explanation */}
          <div
            className="flex items-start gap-2.5 p-4 rounded-xl text-xs text-green-800"
            style={{ background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.15)' }}
          >
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-700" />
            <div className="space-y-1">
              <p className="font-semibold">כיצד עובד התהליך:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-green-700">
                <li>בחרי את אמצעי התשלום המועדף</li>
                <li>Bit / PayBox — פתחי את האפליקציה והעבירי ישירות, לאחר מכן לחצי ״העברתי את התשלום״</li>
                <li>כרטיס אשראי — תועברי לדף תשלום מאובטח, ההזמנה תאושר אוטומטית</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
