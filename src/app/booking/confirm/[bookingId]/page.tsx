import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/supabase/queries'
import { getHealthDeclarations } from '@/lib/actions/health'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/layout/navbar'
import { HealthDeclarationForm } from '@/components/booking/HealthDeclarationForm'
import { CheckCircle, Clock, Calendar, MapPin, Users, Loader2, AlertCircle } from 'lucide-react'

export default async function BookingConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>
  searchParams: Promise<{ dev?: string }>
}) {
  const { bookingId } = await params
  const { dev } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const booking = await getBookingById(bookingId)
  if (!booking) notFound()

  // Ownership check — must come BEFORE any mutations
  if (booking.instructor_id !== user.id) redirect('/instructor-dashboard')

  // Dev-only shortcut: auto-confirm for local testing.
  // Disabled in production — NODE_ENV is always 'production' on Vercel.
  if (dev === 'true' && process.env.NODE_ENV !== 'production') {
    await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', bookingId)
      .eq('instructor_id', user.id)  // redundant safety check
      .eq('status', 'pending')
    redirect(`/booking/confirm/${bookingId}`)
  }

  const declarations = booking.status === 'confirmed'
    ? await getHealthDeclarations(bookingId)
    : []

  const dateStr = new Date(booking.booking_date).toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  // ─── CANCELLED ───────────────────────────────────────────────────────────
  if (booking.status === 'cancelled') {
    return (
      <>
        <Navbar />
        <main className="min-h-screen sand-gradient pt-20 pb-16 px-4">
          <div className="max-w-lg mx-auto text-center py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-deep-ocean mb-2">ההזמנה בוטלה</h1>
            <p className="text-gray-500 mb-6">
              {booking.cancellation_reason ?? 'ההזמנה בוטלה. ניתן ליצור הזמנה חדשה.'}
            </p>
            <Button className="bg-ocean hover:bg-deep-ocean text-white" asChild>
              <Link href="/venues">חיפוש חלל חלופי</Link>
            </Button>
          </div>
        </main>
      </>
    )
  }

  // ─── PENDING (payment not yet confirmed) ─────────────────────────────────
  if (booking.status === 'pending') {
    return (
      <>
        <Navbar />
        <main className="min-h-screen sand-gradient pt-20 pb-16 px-4">
          <div className="max-w-lg mx-auto text-center py-12">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-yellow-600 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-deep-ocean mb-2">ממתין לאישור תשלום</h1>
            <p className="text-gray-500 mb-2">
              התשלום נמצא בעיבוד. הדף יעודכן אוטומטית לאחר קבלת האישור.
            </p>
            <p className="text-xs text-gray-400 mb-6">
              אם ביצעת תשלום ועדיין לא קיבלת אישור, המתיני מספר שניות ורעננ/י את הדף.
            </p>
            <div className="flex flex-col gap-2">
              <Button className="bg-ocean hover:bg-deep-ocean text-white" asChild>
                <Link href={`/booking/pay/${bookingId}`}>חזרה לדף התשלום</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/instructor-dashboard/bookings">ההזמנות שלי</Link>
              </Button>
            </div>
          </div>
        </main>
      </>
    )
  }

  // ─── CONFIRMED ───────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />
      <main className="min-h-screen sand-gradient pt-20 pb-16 px-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-deep-ocean">ההזמנה אושרה!</h1>
            {process.env.RESEND_API_KEY && (
              <p className="text-gray-500 mt-2">אישור נשלח לאימייל שלך</p>
            )}
          </div>

          <Card className="p-6 border-0 shadow-xl space-y-4">
            <h2 className="font-semibold text-lg text-deep-ocean">{booking.venue?.title}</h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-gray-600">
                <Calendar className="w-4 h-4 text-ocean flex-shrink-0" />
                <span>{dateStr}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <Clock className="w-4 h-4 text-ocean flex-shrink-0" />
                <span>{booking.start_time.slice(0, 5)} — {booking.end_time.slice(0, 5)}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <MapPin className="w-4 h-4 text-ocean flex-shrink-0" />
                <span>{booking.venue?.location_address}, {booking.venue?.location_city}</span>
              </div>
              {booking.participants_count && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Users className="w-4 h-4 text-ocean flex-shrink-0" />
                  <span>{booking.participants_count} משתתפות</span>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between font-semibold text-deep-ocean">
                <span>סה&quot;כ שולם</span>
                <span>₪{booking.total_price}</span>
              </div>
            </div>

            <div className="border-t pt-4">
              <HealthDeclarationForm
                bookingId={bookingId}
                existingDeclarations={declarations.map(d => ({
                  id: d.id,
                  student_name: d.student_name,
                  student_phone: d.student_phone,
                  signed_at: d.signed_at,
                }))}
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button className="bg-ocean hover:bg-deep-ocean text-white" asChild>
                <Link href="/instructor-dashboard/bookings">ההזמנות שלי</Link>
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
