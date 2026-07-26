import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/supabase/queries'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/layout/navbar'
import { XCircle, Calendar, Clock, MapPin, RefreshCw } from 'lucide-react'

export default async function BookingCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string; reason?: string }>
}) {
  const { booking_id, reason } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  if (!booking_id) redirect('/instructor-dashboard/bookings')

  // Mark booking as cancelled
  await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason ?? 'תשלום נכשל',
    })
    .eq('id', booking_id)
    .eq('instructor_id', user.id)
    .eq('status', 'pending')

  const booking = await getBookingById(booking_id)
  if (!booking) redirect('/instructor-dashboard/bookings')
  if (booking.instructor_id !== user.id) redirect('/instructor-dashboard')

  const dateStr = new Date(booking.booking_date).toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      <Navbar />
      <main className="min-h-screen sand-gradient pt-20 pb-16 px-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-deep-ocean">התשלום לא הושלם</h1>
            <p className="text-gray-500 mt-2">
              ההזמנה בוטלה. לא חויבת בתשלום.
            </p>
          </div>

          <Card className="p-6 border-0 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-deep-ocean">
                {booking.venue?.title ?? 'פרטי הזמנה'}
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                בוטלה
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-gray-500">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>{dateStr}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-500">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>
                  {booking.start_time.slice(0, 5)} — {booking.end_time.slice(0, 5)}
                </span>
              </div>
              {booking.venue?.location_address && (
                <div className="flex items-center gap-3 text-gray-500">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {booking.venue.location_address}, {booking.venue.location_city}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-700">
              <p className="font-medium mb-1">מה אפשר לעשות?</p>
              <ul className="text-xs space-y-0.5">
                <li>• ניתן לנסות שוב עם כרטיס אחר</li>
                <li>• ייתכן שהחלל עדיין זמין לאותו מועד</li>
                <li>• לתמיכה: support@wellness-sea.co.il</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <Button className="bg-ocean hover:bg-deep-ocean text-white" asChild>
                <Link href={`/venues/${booking.venue_id}`}>
                  <RefreshCw className="w-4 h-4 ml-2" />
                  נסה שוב להזמין
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/venues">חיפוש חללים אחרים</Link>
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </>
  )
}
