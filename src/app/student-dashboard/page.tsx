import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Waves, Calendar, MapPin, Clock, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getStudentEnrollments } from '@/lib/supabase/queries'

export default async function StudentDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single()

  const enrollments = await getStudentEnrollments(user.id)
  const now = new Date()
  const upcoming = enrollments.filter(e => {
    const b = e.booking as { booking_date?: string; status?: string } | null
    if (!b) return false
    return new Date(b.booking_date ?? '') >= now && b.status !== 'cancelled'
  })
  const past = enrollments.filter(e => {
    const b = e.booking as { booking_date?: string } | null
    return b && new Date(b.booking_date ?? '') < now
  })

  const hour = now.getHours()
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב'
  const firstName = profile?.full_name?.split(' ')[0] ?? 'תלמידה'

  return (
    <div className="min-h-screen" style={{ background: '#faf5ee' }} dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-sand/60 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 ocean-gradient rounded-full flex items-center justify-center">
              <Waves className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-deep-ocean hidden sm:block" style={{ fontFamily: "'Playfair Display', serif" }}>
              WELLNESS<span className="text-coral">&amp;</span>SEA
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/classes" className="text-ocean hover:underline">חיפוש שיעורים</Link>
            <Link href="/instructors" className="text-gray-500 hover:text-ocean">מדריכות</Link>
            <form action="/auth/signout" method="POST">
              <button type="submit" className="text-gray-400 hover:text-gray-600 text-xs">התנתקות</button>
            </form>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="ocean-gradient rounded-2xl p-6 text-white">
          <p className="text-white/70 text-sm mb-1">{greeting} 🌊</p>
          <h1 className="text-2xl font-black" style={{ fontFamily: "'Playfair Display', serif" }}>
            {firstName}
          </h1>
          <p className="text-white/80 text-sm mt-1">
            {upcoming.length > 0
              ? `יש לך ${upcoming.length} שיעור${upcoming.length > 1 ? 'ים' : ''} קרוב${upcoming.length > 1 ? 'ים' : ''}`
              : 'מצאי את השיעור הבא שלך'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'שיעורים קרובים', value: upcoming.length, icon: Calendar },
            { label: 'שיעורים שהשתתפת', value: past.length, icon: Users },
            { label: 'מדריכות שונות', value: new Set(enrollments.map(e => (e.booking as { instructor?: { id?: string } } | null)?.instructor?.id)).size, icon: Waves },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-xl p-4 text-center shadow-sm">
              <Icon className="w-5 h-5 text-ocean mx-auto mb-1" />
              <div className="text-2xl font-black text-deep-ocean">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Upcoming classes */}
        <section>
          <h2 className="text-lg font-bold text-deep-ocean mb-3">שיעורים קרובים</h2>
          {upcoming.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <Waves className="w-10 h-10 text-ocean/30 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">אין שיעורים קרובים</p>
              <Link href="/classes" className="bg-ocean text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-deep-ocean transition-colors">
                מצאי שיעור
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(e => {
                const b = e.booking as { id?: string; booking_date?: string; start_time?: string; end_time?: string; class_type?: string; venue?: { title?: string; location_city?: string; images?: string[] }; instructor?: { full_name?: string; id?: string } } | null
                if (!b) return null
                const date = new Date(b.booking_date ?? '').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
                return (
                  <div key={e.id} className="bg-white rounded-xl p-4 shadow-sm flex gap-4">
                    {b.venue?.images?.[0] && (
                      <img src={b.venue.images[0]} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-deep-ocean text-sm truncate">{b.venue?.title}</div>
                      {b.class_type && <div className="text-xs text-ocean mb-1">{b.class_type}</div>}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{date}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.start_time}–{b.end_time}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <MapPin className="w-3 h-3" />{b.venue?.location_city}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Past classes */}
        {past.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-3">שיעורים שעברו</h2>
            <div className="space-y-2">
              {past.slice(0, 5).map(e => {
                const b = e.booking as { booking_date?: string; start_time?: string; class_type?: string; venue?: { title?: string; location_city?: string }; instructor?: { full_name?: string } } | null
                if (!b) return null
                const date = new Date(b.booking_date ?? '').toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })
                return (
                  <div key={e.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-deep-ocean">{b.venue?.title}</div>
                      <div className="text-xs text-gray-500">{date} · {b.start_time} · {b.class_type ?? 'שיעור'}</div>
                    </div>
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">הושלם</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <h3 className="font-bold text-deep-ocean mb-2">מצאי את השיעור הבא שלך</h3>
          <p className="text-sm text-gray-500 mb-4">שיעורי יוגה ופילאטיס על קו החוף</p>
          <Link href="/classes" className="inline-block bg-ocean text-white px-8 py-2.5 rounded-full text-sm font-semibold hover:bg-deep-ocean transition-colors">
            לשיעורים פעילים
          </Link>
        </div>
      </main>
    </div>
  )
}
