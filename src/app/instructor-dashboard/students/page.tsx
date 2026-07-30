import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, MessageCircle, ExternalLink, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { buildWhatsAppLink, buildClassReminderMessage, buildInstagramProfileLink } from '@/lib/notifications'

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  if (user.user_metadata?.role !== 'instructor') redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, instagram')
    .eq('id', user.id)
    .single()

  // Fetch all health declarations for this instructor's confirmed bookings
  const { data: declarations } = await supabase
    .from('health_declarations')
    .select(`
      student_name, student_phone, signed_at,
      booking:bookings!inner(
        id, booking_date, start_time, end_time, class_type, instructor_id,
        venue:venues(title, location_city, location_address)
      )
    `)
    .eq('booking.instructor_id', user.id)
    .order('signed_at', { ascending: false })

  // Group by phone → count appearances
  const studentMap = new Map<string, {
    name: string
    phone: string
    appearances: number
    lastDate: string
    bookings: Array<{ date: string; classType?: string; venueName?: string; venueCity?: string; venueAddress?: string; startTime?: string; endTime?: string }>
  }>()

  for (const d of declarations ?? []) {
    const booking = d.booking as { booking_date?: string; class_type?: string; venue?: { title?: string; location_city?: string; location_address?: string }; start_time?: string; end_time?: string } | null
    const existing = studentMap.get(d.student_phone)
    const entry = {
      date: booking?.booking_date ?? '',
      classType: booking?.class_type,
      venueName: booking?.venue?.title,
      venueCity: booking?.venue?.location_city,
      venueAddress: booking?.venue?.location_address,
      startTime: booking?.start_time,
      endTime: booking?.end_time,
    }
    if (existing) {
      existing.appearances++
      existing.bookings.push(entry)
      if (entry.date > existing.lastDate) existing.lastDate = entry.date
    } else {
      studentMap.set(d.student_phone, {
        name: d.student_name,
        phone: d.student_phone,
        appearances: 1,
        lastDate: entry.date,
        bookings: [entry],
      })
    }
  }

  const students = Array.from(studentMap.values()).sort((a, b) => b.appearances - a.appearances)
  const regulars = students.filter(s => s.appearances >= 3)
  const occasional = students.filter(s => s.appearances < 3)

  return (
    <div className="min-h-screen" style={{ background: '#faf5ee' }} dir="rtl">
      <header className="bg-white border-b border-sand/60 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/instructor-dashboard" className="text-ocean hover:underline text-sm">← לוח בקרה</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-600">תלמידות</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-deep-ocean">תלמידות שלי</h1>
            <p className="text-sm text-gray-500 mt-0.5">{students.length} תלמידות סה&quot;כ</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="bg-gold/10 text-amber-700 px-2 py-1 rounded-full text-xs font-medium">{regulars.length} קבועות</span>
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">{occasional.length} מזדמנות</span>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <Users className="w-12 h-12 text-ocean/30 mx-auto mb-3" />
            <p className="text-gray-500">עדיין אין תלמידות רשומות</p>
            <p className="text-xs text-gray-400 mt-1">תלמידות יופיעו כאן לאחר מילוי הצהרת בריאות בשיעורים שלך</p>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map(student => {
              const isRegular = student.appearances >= 3
              const lastBooking = student.bookings[0]
              const waMessage = lastBooking ? buildClassReminderMessage({
                venueName: lastBooking.venueName ?? '',
                venueAddress: lastBooking.venueAddress ?? '',
                venueCity: lastBooking.venueCity ?? '',
                bookingDate: lastBooking.date,
                startTime: lastBooking.startTime ?? '',
                endTime: lastBooking.endTime ?? '',
                instructorName: profile?.full_name ?? 'המדריכה שלך',
                classType: lastBooking.classType,
              }) : ''
              const waLink = buildWhatsAppLink(student.phone, waMessage)
              const igLink = profile?.instagram ? buildInstagramProfileLink(profile.instagram) : null

              return (
                <div key={student.phone} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 ocean-gradient rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-deep-ocean text-sm">{student.name}</span>
                          {isRegular && (
                            <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                              <Star className="w-3 h-3 fill-current" />
                              קבועה
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{student.appearances} שיעורים · {student.phone}</div>
                        <div className="text-xs text-gray-400">
                          שיעור אחרון: {new Date(student.lastDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-full transition-colors"
                        title="שלחי תזכורת בWhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                      {igLink && (
                        <a
                          href={igLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-xs px-3 py-1.5 rounded-full transition-colors"
                          title="הפרופיל שלי באינסטגרם"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Instagram
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
