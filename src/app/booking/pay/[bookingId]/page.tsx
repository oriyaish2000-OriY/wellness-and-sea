import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/supabase/queries'
import { Navbar } from '@/components/layout/navbar'
import { Card } from '@/components/ui/card'
import { MapPin, Calendar, Clock, ArrowRight, Shield } from 'lucide-react'
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

  // Only the booking instructor can pay
  if (booking.instructor_id !== user.id) redirect('/instructor-dashboard/bookings')

  // Already paid
  if (booking.status === 'confirmed' || booking.status === 'completed') {
    redirect(`/booking/confirm/${bookingId}`)
  }
  if (booking.status === 'cancelled') notFound()

  const venue = booking.venue as {
    id?: string; title?: string; location_city?: string; location_address?: string; hourly_price?: number;
    host?: { full_name?: string; bit_phone?: string; paybox_phone?: string } | null
  } | null

  const dateFormatted = new Date(booking.booking_date).toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const [startH, startM] = booking.start_time.split(':').map(Number)
  const [endH, endM] = booking.end_time.split(':').map(Number)
  const durationHours = (endH * 60 + endM - (startH * 60 + startM)) / 60

  const hostBit = venue?.host?.bit_phone
  const hostPaybox = venue?.host?.paybox_phone
  const hostName = venue?.host?.full_name

  // WhatsApp deep link with pre-filled message after payment
  const waMsg = encodeURIComponent(
    `היי ${hostName ?? 'בעל החלל'} 👋\nשלמתי ₪${booking.total_price} עבור הזמנה ב${venue?.title ?? 'החלל'}\nתאריך: ${dateFormatted}\nשעות: ${booking.start_time}–${booking.end_time}`
  )

  return (
    <div className="min-h-screen" style={{ background: '#faf5ee' }}>
      <Navbar />
      <div className="max-w-xl mx-auto px-4 py-8 pt-24">

        <Link href={`/instructor-dashboard/bookings`} className="inline-flex items-center gap-1.5 text-sm text-ocean mb-6 hover:underline">
          <ArrowRight className="w-4 h-4" />
          ההזמנות שלי
        </Link>

        <h1 className="text-2xl font-black text-deep-ocean mb-1">תשלום להזמנה</h1>
        <p className="text-sm text-gray-500 mb-6">בחרי את אמצעי התשלום המועדף עלייך</p>

        {/* Booking summary */}
        <Card className="p-5 border-0 mb-5" style={{ boxShadow: '0 2px 16px rgba(10,74,74,0.08)' }}>
          <h2 className="font-bold text-deep-ocean text-sm mb-3">סיכום ההזמנה</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 mt-0.5 text-ocean flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">{venue?.title}</p>
                <p className="text-xs">{venue?.location_address}, {venue?.location_city}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-ocean flex-shrink-0" />
              <span>{dateFormatted}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-ocean flex-shrink-0" />
              <span>{booking.start_time} – {booking.end_time} ({durationHours === 1 ? 'שעה' : durationHours === 1.5 ? '1.5 שעות' : `${durationHours} שעות`})</span>
            </div>
          </div>
          <div className="flex justify-between items-center mt-4 pt-4 font-black text-ocean text-xl" style={{ borderTop: '1px solid #f0e6d3' }}>
            <span>סה&quot;כ לתשלום</span>
            <span>₪{booking.total_price}</span>
          </div>
        </Card>

        {/* Payment options */}
        <div className="space-y-3">

          {/* Grow by Meshulam — credit card / Bit / PayBox / Apple Pay / Google Pay */}
          <PaymentActions
            bookingId={bookingId}
            totalPrice={booking.total_price}
            venueTitle={venue?.title ?? ''}
            hostPayout={booking.host_payout}
          />

          {/* Divider */}
          {(hostBit || hostPaybox) && (
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400">או שלמי ישירות לבעל החלל</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
          )}

          {/* Direct payment — Bit */}
          {hostBit && (
            <a
              href={`https://www.bitpay.co.il/app/pay?phone=${hostBit.replace(/\D/g,'')}&amount=${booking.total_price}&note=${encodeURIComponent(`WELLNESS&SEA - ${venue?.title}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 rounded-2xl transition-all hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg, #1a6ef5, #0d56d8)', boxShadow: '0 4px 16px rgba(26,110,245,0.3)' }}
            >
              <span className="text-3xl">💙</span>
              <div className="flex-1">
                <p className="font-black text-white text-base">שלמי ב-Bit</p>
                <p className="text-white/70 text-sm">לבעל החלל: {hostBit}</p>
                <p className="text-white/90 text-base font-bold mt-0.5">₪{booking.total_price}</p>
              </div>
              <div className="text-white/60 text-xs">פתח אפליקציה →</div>
            </a>
          )}

          {/* Direct payment — PayBox */}
          {hostPaybox && (
            <a
              href={`https://payboxapp.page.link/?phone=${hostPaybox.replace(/\D/g,'')}&amount=${booking.total_price}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 rounded-2xl transition-all hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg, #f5a623, #e8901a)', boxShadow: '0 4px 16px rgba(245,166,35,0.3)' }}
            >
              <span className="text-3xl">💛</span>
              <div className="flex-1">
                <p className="font-black text-white text-base">שלמי ב-PayBox</p>
                <p className="text-white/70 text-sm">לבעל החלל: {hostPaybox}</p>
                <p className="text-white/90 text-base font-bold mt-0.5">₪{booking.total_price}</p>
              </div>
              <div className="text-white/60 text-xs">פתח אפליקציה →</div>
            </a>
          )}

          {/* WhatsApp confirmation after direct pay */}
          {(hostBit || hostPaybox) && hostName && (
            <a
              href={`https://wa.me/?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#25D366', color: 'white' }}
            >
              <span className="text-xl">💬</span>
              <span>שלחי אישור תשלום ל{hostName} בוואטסאפ</span>
            </a>
          )}

          {/* Trust signal */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl text-xs mt-2" style={{ background: 'rgba(92,140,110,0.08)', color: '#1a5c3a' }}>
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>לאחר קבלת התשלום, בעל החלל יאשר את ההזמנה והיא תופיע ביומן שלך.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
