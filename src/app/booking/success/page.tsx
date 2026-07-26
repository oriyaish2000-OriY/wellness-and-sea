import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/supabase/queries'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/layout/navbar'
import { CheckCircle, Calendar, Clock, MapPin, Users, ArrowLeft } from 'lucide-react'

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string; transaction_id?: string }>
}) {
  const { booking_id, transaction_id } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  if (!booking_id) redirect('/instructor-dashboard/bookings')

  // Mark booking as confirmed if coming from Tranzila success redirect
  if (transaction_id) {
    await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        tranzila_transaction_id: transaction_id,
      })
      .eq('id', booking_id)
      .eq('status', 'pending')
  }

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
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-once">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-deep-ocean">התשלום בוצע בהצלחה!</h1>
            <p className="text-gray-500 mt-2">ההזמנה שלך אושרה. פרטים נשלחו לאימייל.</p>
          </div>

          <Card className="p-6 border-0 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-deep-ocean">
                {booking.venue?.title ?? 'פרטי הזמנה'}
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                מאושרת
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-gray-600">
                <Calendar className="w-4 h-4 text-ocean flex-shrink-0" />
                <span>{dateStr}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <Clock className="w-4 h-4 text-ocean flex-shrink-0" />
                <span>
                  {booking.start_time.slice(0, 5)} — {booking.end_time.slice(0, 5)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <MapPin className="w-4 h-4 text-ocean flex-shrink-0" />
                <span>
                  {booking.venue?.location_address}, {booking.venue?.location_city}
                </span>
              </div>
              {booking.participants_count && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Users className="w-4 h-4 text-ocean flex-shrink-0" />
                  <span>{booking.participants_count} משתתפות</span>
                </div>
              )}
            </div>

            <div className="border-t pt-4 flex items-center justify-between">
              <span className="text-gray-500 text-sm">סה&quot;כ שולם</span>
              <span className="text-xl font-bold text-deep-ocean">
                ₪{booking.total_price.toLocaleString('he-IL')}
              </span>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 space-y-1">
              <p className="font-medium">תזכורות חשובות לפני האימון:</p>
              <ul className="space-y-0.5 text-xs">
                <li>• יש להציג ביטוח מקצועי בתוקף במקום</li>
                <li>• כל משתתף חייב לחתום על הצהרת בריאות</li>
                <li>• יש לפנות את החלל 15 דקות לפני סיום ההזמנה</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <Button className="bg-ocean hover:bg-deep-ocean text-white" asChild>
                <Link href="/instructor-dashboard/bookings">
                  <ArrowLeft className="w-4 h-4 ml-2" />
                  ההזמנות שלי
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/venues">חיפוש חללים נוספים</Link>
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </>
  )
}
