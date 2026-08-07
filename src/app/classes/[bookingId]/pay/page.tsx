import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOpenClassById } from '@/lib/supabase/queries'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Card } from '@/components/ui/card'
import { MapPin, Clock, Calendar, CheckCircle, ArrowRight, ShieldCheck } from 'lucide-react'
import { GrowPayButton } from './GrowPayButton'
import { calcClassBookingSplit } from '@/lib/payments/commissionUtils'

interface Props {
  params: Promise<{ bookingId: string }>
}

export default async function ClassPayPage({ params }: Props) {
  const { bookingId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?role=student&next=/classes/${bookingId}/pay`)

  const cls = await getOpenClassById(bookingId)
  if (!cls) notFound()

  // Verify the student is actually enrolled
  const { data: enrollment } = await supabase
    .from('class_enrollments')
    .select('id, payment_status')
    .eq('booking_id', bookingId)
    .eq('student_id', user.id)
    .neq('payment_status', 'cancelled')
    .single()

  if (!enrollment) redirect(`/classes/${bookingId}`)

  const alreadyPaid = enrollment.payment_status === 'paid'

  const venue      = cls.venue      as { id?: string; title?: string; location_city?: string; location_address?: string } | null
  const instructor = cls.instructor as { id?: string; full_name?: string; avatar_url?: string } | null

  const dateFormatted = new Date(cls.booking_date).toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  // What the student actually pays = base + 5% platform service fee
  const basePriceILS = cls.price_per_student ?? 0
  const studentPays  = basePriceILS > 0 ? calcClassBookingSplit(basePriceILS).studentPays : 0

  return (
    <div className="min-h-screen" style={{ background: '#faf5ee' }}>
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-8 pt-24">

        <Link href={`/classes/${bookingId}`} className="inline-flex items-center gap-1.5 text-sm text-ocean mb-6 hover:underline">
          <ArrowRight className="w-4 h-4" />
          חזרה לשיעור
        </Link>

        {alreadyPaid ? (
          /* Already paid */
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(92,140,110,0.15)' }}>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-black text-deep-ocean mb-2">תשלום אושר!</h1>
            <p className="text-gray-500 text-sm mb-6">נרשמת בהצלחה לשיעור. נתראה!</p>
            <Link href="/student-dashboard" className="inline-block px-8 py-3 rounded-full font-bold text-white text-sm" style={{ background: '#0d6e6e' }}>
              לפאנל האישי שלי
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-deep-ocean mb-1">תשלום לשיעור</h1>
            <p className="text-sm text-gray-500 mb-6">תשלום מאובטח — ההרשמה תאושר אוטומטית לאחר התשלום</p>

            {/* Class summary */}
            <Card className="p-5 border-0 mb-5" style={{ boxShadow: '0 2px 16px rgba(10,74,74,0.08)' }}>
              <div className="flex items-center gap-3 mb-4">
                {instructor?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={instructor.avatar_url} alt={instructor.full_name ?? ''} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full ocean-gradient flex items-center justify-center text-white font-bold">
                    {instructor?.full_name?.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-bold text-deep-ocean">{instructor?.full_name}</p>
                  {cls.class_type && <p className="text-sm text-ocean">{cls.class_type}</p>}
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-ocean" />
                  <span>{dateFormatted}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-ocean" />
                  <span>{cls.start_time?.slice(0,5)} – {cls.end_time?.slice(0,5)}</span>
                </div>
                {venue && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-ocean" />
                    <span>{venue.title}{venue.location_city ? ` · ${venue.location_city}` : ''}</span>
                  </div>
                )}
              </div>
              <div
                className="flex justify-between items-center mt-4 pt-4 font-black text-ocean text-xl"
                style={{ borderTop: '1px solid #f0e6d3' }}
              >
                <span>לתשלום</span>
                <span>₪{studentPays.toLocaleString('he-IL')}</span>
              </div>
            </Card>

            {/* Payment */}
            <div className="space-y-3">
              <GrowPayButton enrollmentId={enrollment.id} amount={studentPays} />

              <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-500">
                {[['💳', 'כרטיס אשראי'], ['🍎', 'Apple Pay'], ['🔍', 'Google Pay']].map(([icon, label]) => (
                  <span key={label} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gray-50 border border-gray-200">
                    {icon} {label}
                  </span>
                ))}
              </div>

              <div
                className="flex items-start gap-2.5 p-4 rounded-xl text-xs text-green-800"
                style={{ background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.15)' }}
              >
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-700" />
                <p className="text-green-700">לחצי על הכפתור לעמוד תשלום מאובטח. לאחר השלמת התשלום ההרשמה תאושר אוטומטית.</p>
              </div>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  )
}
