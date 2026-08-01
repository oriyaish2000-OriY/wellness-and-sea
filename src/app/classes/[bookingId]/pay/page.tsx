import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOpenClassById } from '@/lib/supabase/queries'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Card } from '@/components/ui/card'
import { MapPin, Clock, Calendar, CheckCircle, ArrowRight } from 'lucide-react'
import { MarkPaidButton } from './MarkPaidButton'

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

  const venue = cls.venue as { id?: string; title?: string; location_city?: string; location_address?: string } | null
  const instructor = cls.instructor as { id?: string; full_name?: string; avatar_url?: string; bit_phone?: string; paybox_phone?: string; instagram?: string } | null

  const dateFormatted = new Date(cls.booking_date).toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const amount = cls.price_per_student ?? 0

  // Deep links for payment apps
  const bitLink = instructor?.bit_phone
    ? `https://www.bitpay.co.il/app/pay?phone=${instructor.bit_phone.replace(/\D/g,'')}&amount=${amount}&note=${encodeURIComponent(`שיעור ${cls.class_type ?? ''} - WELLNESS&SEA`)}`
    : null

  const payboxLink = instructor?.paybox_phone
    ? `https://payboxapp.page.link/?phone=${instructor.paybox_phone.replace(/\D/g,'')}&amount=${amount}`
    : null

  const waConfirm = instructor?.bit_phone || instructor?.paybox_phone
    ? `https://wa.me/?text=${encodeURIComponent(`היי ${instructor?.full_name ?? 'מדריכה'} 👋\nשלמתי ₪${amount} עבור שיעור ${cls.class_type ?? ''}\nתאריך: ${dateFormatted}\nשעות: ${cls.start_time}–${cls.end_time}`)}`
    : null

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
            <p className="text-gray-500 text-sm mb-6">המדריכה קיבלה את התשלום. נתראה בשיעור!</p>
            <Link href="/student-dashboard" className="inline-block px-8 py-3 rounded-full font-bold text-white text-sm" style={{ background: '#0d6e6e' }}>
              לפאנל האישי שלי
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-deep-ocean mb-1">תשלום לשיעור</h1>
            <p className="text-sm text-gray-500 mb-6">שלחי את התשלום ישירות למדריכה</p>

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
              <div className="flex justify-between items-center mt-4 pt-4 font-black text-ocean text-xl" style={{ borderTop: '1px solid #f0e6d3' }}>
                <span>לתשלום</span>
                <span>₪{amount}</span>
              </div>
            </Card>

            {/* Payment methods */}
            <div className="space-y-3">
              {bitLink && (
                <a
                  href={bitLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl hover:scale-[1.01] transition-all"
                  style={{ background: 'linear-gradient(135deg, #1a6ef5, #0d56d8)', boxShadow: '0 4px 16px rgba(26,110,245,0.3)' }}
                >
                  <span className="text-3xl">💙</span>
                  <div className="flex-1">
                    <p className="font-black text-white text-base">שלמי ב-Bit</p>
                    <p className="text-white/70 text-sm">למדריכה: {instructor?.bit_phone}</p>
                    <p className="text-white/90 text-base font-bold mt-0.5">₪{amount}</p>
                  </div>
                  <span className="text-white/60 text-xs">פתח אפליקציה →</span>
                </a>
              )}

              {payboxLink && (
                <a
                  href={payboxLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl hover:scale-[1.01] transition-all"
                  style={{ background: 'linear-gradient(135deg, #f5a623, #e8901a)', boxShadow: '0 4px 16px rgba(245,166,35,0.3)' }}
                >
                  <span className="text-3xl">💛</span>
                  <div className="flex-1">
                    <p className="font-black text-white text-base">שלמי ב-PayBox</p>
                    <p className="text-white/70 text-sm">למדריכה: {instructor?.paybox_phone}</p>
                    <p className="text-white/90 text-base font-bold mt-0.5">₪{amount}</p>
                  </div>
                  <span className="text-white/60 text-xs">פתח אפליקציה →</span>
                </a>
              )}

              {!bitLink && !payboxLink && (
                <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(10,74,74,0.05)', border: '1.5px dashed rgba(10,74,74,0.2)' }}>
                  <p className="text-sm font-semibold text-gray-700 mb-1">תשלום בהעברה בנקאית / מזומן</p>
                  <p className="text-xs text-gray-500">פנה למדריכה ישירות לפרטי תשלום</p>
                  {instructor?.id && (
                    <Link href={`/instructors/${instructor.id}`} className="inline-block mt-3 text-sm text-ocean hover:underline">
                      הפרופיל של {instructor.full_name}
                    </Link>
                  )}
                </div>
              )}

              {/* WhatsApp confirmation */}
              {waConfirm && (
                <a
                  href={waConfirm}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: '#25D366', color: 'white' }}
                >
                  <span className="text-xl">💬</span>
                  <span>שלחי אישור תשלום למדריכה בוואטסאפ</span>
                </a>
              )}

              {/* Mark as paid manually */}
              <div style={{ borderTop: '1px solid #f0e6d3', paddingTop: 16, marginTop: 8 }}>
                <p className="text-xs text-gray-400 text-center mb-3">לאחר ששלחת את התשלום, סמני כאן:</p>
                <MarkPaidButton enrollmentId={enrollment.id} />
              </div>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  )
}
