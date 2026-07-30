import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getInstructorBookings,
  getSavedVenues,
  getRecentlyVisitedVenues,
  getRegularVenues,
} from '@/lib/supabase/queries'
import { Button } from '@/components/ui/button'
import { VenueCarousel } from '@/components/venues/venue-carousel'
import { RegularVenuesSection } from '@/components/instructor-dashboard/regular-venues-section'
import { NearbyInstructorSection } from '@/components/instructor-dashboard/nearby-instructor-section'
import {
  CalendarDays,
  MapPin,
  Search,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Flame,
  Waves,
  Star,
} from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתינה',
  confirmed: 'מאושרת',
  cancelled: 'בוטלה',
  completed: 'הושלמה',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:   { bg: 'rgba(200,148,74,0.12)',  color: '#c8944a' },
  confirmed: { bg: 'rgba(92,140,110,0.12)',  color: '#5c8c6e' },
  cancelled: { bg: 'rgba(224,122,95,0.12)',  color: '#e07a5f' },
  completed: { bg: 'rgba(13,110,110,0.12)',  color: '#0d6e6e' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('he-IL', {
    weekday: 'short', day: 'numeric', month: 'long',
  })
}

function getTimeGreeting(hour: number): { text: string; sub: string; icon: string } {
  if (hour >= 5 && hour < 10)  return { text: 'בוקר טוב', sub: 'זמן מושלם לשיעור אמצע-ים 🌅', icon: '🌅' }
  if (hour >= 10 && hour < 13) return { text: 'בוקר טוב', sub: 'שעות הגאות — החללים מלאים עכשיו 🌊', icon: '☀️' }
  if (hour >= 13 && hour < 17) return { text: 'צהריים טובים', sub: 'חלל עם גישה לים מחכה לך 🏖️', icon: '🌤️' }
  return { text: 'ערב טוב', sub: 'תכנני את שיעור הבוקר הבא שלך 🌙', icon: '🌊' }
}

export default async function InstructorDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')
  if (user.user_metadata?.role !== 'instructor') redirect('/host-dashboard')

  const [allBookings, savedVenues, recentlyVisited, regularVenues] = await Promise.all([
    getInstructorBookings(user.id).catch(() => [] as Awaited<ReturnType<typeof getInstructorBookings>>),
    getSavedVenues(user.id).catch(() => [] as Awaited<ReturnType<typeof getSavedVenues>>),
    getRecentlyVisitedVenues(user.id).catch(() => [] as Awaited<ReturnType<typeof getRecentlyVisitedVenues>>),
    getRegularVenues(user.id).catch(() => [] as Awaited<ReturnType<typeof getRegularVenues>>),
  ])

  const today = new Date().toISOString().split('T')[0]
  const hour = new Date().getHours()
  const greeting = getTimeGreeting(hour)
  const firstName = user.user_metadata?.full_name?.split(' ')[0] ?? 'מדריכה'

  const upcomingBookings = allBookings
    .filter(b => b.booking_date >= today && b.status !== 'cancelled')
    .sort((a, b) => {
      const d = a.booking_date.localeCompare(b.booking_date)
      return d !== 0 ? d : a.start_time.localeCompare(b.start_time)
    })
    .slice(0, 3)

  const pastBookings = allBookings
    .filter(b => b.booking_date < today || b.status === 'completed')
    .slice(0, 5)

  const totalCompleted = allBookings.filter(b => b.status === 'completed').length
  const totalHours = allBookings
    .filter(b => b.status === 'completed' || b.status === 'confirmed')
    .reduce((sum, b) => {
      const [sh, sm] = b.start_time.split(':').map(Number)
      const [eh, em] = b.end_time.split(':').map(Number)
      return sum + (eh * 60 + em - sh * 60 - sm) / 60
    }, 0)
  const totalVenuesVisited = new Set(
    allBookings.filter(b => b.status === 'completed' || b.status === 'confirmed').map(b => b.venue_id)
  ).size

  // Streak calculation — consecutive weeks with at least 1 booking
  const weeksWithBooking = new Set(
    allBookings
      .filter(b => b.status === 'completed' || b.status === 'confirmed')
      .map(b => {
        const d = new Date(b.booking_date)
        const monday = new Date(d)
        monday.setDate(d.getDate() - d.getDay())
        return monday.toISOString().split('T')[0]
      })
  )
  const streak = Math.min(weeksWithBooking.size, 12)

  return (
    <div className="space-y-8">
      {/* ── Greeting hero ── */}
      <div className="rounded-2xl relative overflow-hidden" style={{
        background: 'linear-gradient(145deg, #0a4a4a 0%, #0d6e6e 60%, #1a9090 100%)',
        padding: '28px 28px 48px',
      }}>
        {/* Orb */}
        <div className="absolute" style={{ width: 200, height: 200, background: 'rgba(200,148,74,0.15)', borderRadius: '50%', filter: 'blur(50px)', top: -60, right: -60 }} />
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#e8b870' }}>
                {greeting.icon} {greeting.text}
              </p>
              <h1 className="text-2xl font-black text-white mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                {firstName}
              </h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{greeting.sub}</p>
            </div>
            <Button
              className="text-white font-semibold rounded-full flex items-center gap-2 flex-shrink-0"
              style={{ background: '#c8944a', border: 'none', padding: '10px 18px' }}
              asChild
            >
              <Link href="/venues">
                <Search className="w-4 h-4" />
                חפשי חלל
              </Link>
            </Button>
          </div>

          {/* Streak badge */}
          {streak > 0 && (
            <div
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <Flame className="w-4 h-4" style={{ color: '#e8b870' }} />
              <span className="text-white text-xs font-bold">{streak} שבועות ברצף 🔥</span>
            </div>
          )}
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 right-0 opacity-20">
          <svg viewBox="0 0 400 30" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
            <path d="M0,15 C100,0 200,30 300,15 C350,7 380,20 400,15 L400,30 L0,30 Z" fill="white" />
          </svg>
        </div>
      </div>

      {/* ── Activity stats ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'שיעורים קרובים', value: upcomingBookings.length, icon: '📅', color: '#0d6e6e' },
          { label: 'שיעורים הועברו', value: totalCompleted, icon: '✅', color: '#5c8c6e' },
          { label: 'שעות פעילות', value: Math.round(totalHours), icon: '⏱️', color: '#c8944a' },
          { label: 'חללים ביקרתי', value: totalVenuesVisited, icon: '📍', color: '#e07a5f' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-white p-4 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Upcoming bookings ── */}
      <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #f0e6d3' }}>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" style={{ color: '#0d6e6e' }} />
            <h2 className="font-bold text-base" style={{ color: '#0a4a4a' }}>הזמנות קרובות</h2>
          </div>
          <Link href="/instructor-dashboard/bookings" className="text-sm font-medium flex items-center gap-1" style={{ color: '#0d6e6e' }}>
            כל ההזמנות <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="p-4">
          {upcomingBookings.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-3">🌊</div>
              <p className="font-semibold text-gray-500 mb-1">אין שיעורים קרובים</p>
              <p className="text-xs text-gray-400 mb-4">הזמני חלל ותתחילי לייצר זרם</p>
              <Button className="rounded-full text-white font-semibold" style={{ background: '#0d6e6e' }} asChild>
                <Link href="/venues"><Search className="w-3.5 h-3.5 ml-1.5" /> חפשי חלל עכשיו</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map(booking => {
                const statusStyle = STATUS_STYLE[booking.status] ?? { bg: '#f1f5f9', color: '#64748b' }
                const venueName = (booking.venue as { title?: string } | undefined)?.title
                const d = new Date(booking.booking_date)
                const isToday = booking.booking_date === today
                return (
                  <div
                    key={booking.id}
                    className="flex items-center gap-4 p-4 rounded-xl transition-all"
                    style={{ background: isToday ? 'rgba(13,110,110,0.05)' : '#faf5ee', border: isToday ? '1.5px solid rgba(13,110,110,0.2)' : '1px solid #f0e6d3' }}
                  >
                    {/* Date badge */}
                    <div
                      className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-white"
                      style={{ background: 'linear-gradient(135deg, #0a4a4a, #0d6e6e)' }}
                    >
                      <span className="text-[10px] font-medium opacity-80 leading-tight">
                        {d.toLocaleDateString('he-IL', { month: 'short' })}
                      </span>
                      <span className="text-lg font-black leading-tight">{d.getDate()}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: '#1a2a2a' }}>{venueName ?? 'חלל'}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {booking.start_time.slice(0, 5)}–{booking.end_time.slice(0, 5)}
                        </span>
                        {isToday && (
                          <span className="font-bold" style={{ color: '#e07a5f' }}>היום!</span>
                        )}
                      </div>
                    </div>

                    <span
                      className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: statusStyle.bg, color: statusStyle.color }}
                    >
                      {STATUS_LABELS[booking.status]}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Regular venues ── */}
      <RegularVenuesSection venues={regularVenues} />

      {/* ── Class history ── */}
      {pastBookings.length > 0 && (
        <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #f0e6d3' }}>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4" style={{ color: '#c8944a' }} />
              <h2 className="font-bold text-base" style={{ color: '#0a4a4a' }}>היסטוריית שיעורים</h2>
            </div>
            <Link href="/instructor-dashboard/bookings" className="text-sm font-medium flex items-center gap-1" style={{ color: '#0d6e6e' }}>
              הכל <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="p-4 space-y-2">
            {pastBookings.map(booking => {
              const venueName = (booking.venue as { title?: string } | undefined)?.title
              return (
                <div key={booking.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#faf5ee' }}>
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: booking.status === 'completed' ? 'rgba(92,140,110,0.12)' : '#f1f5f9' }}
                  >
                    {booking.status === 'completed'
                      ? <CheckCircle2 className="w-4 h-4" style={{ color: '#5c8c6e' }} />
                      : <CalendarDays className="w-4 h-4 text-gray-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1a2a2a' }}>{venueName ?? 'חלל'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(booking.booking_date)} · {booking.start_time.slice(0, 5)}–{booking.end_time.slice(0, 5)}
                    </p>
                  </div>
                  <Link
                    href={`/venues/${booking.venue_id}`}
                    className="text-xs font-bold flex-shrink-0"
                    style={{ color: '#0d6e6e' }}
                  >
                    הזמן שוב
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Nearby section ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4" style={{ color: '#0d6e6e' }} />
          <h2 className="font-bold text-base" style={{ color: '#0a4a4a' }}>חללים קרובים אליך</h2>
        </div>
        <NearbyInstructorSection />
      </div>

      {/* ── Recently visited ── */}
      {recentlyVisited.length > 0 && (
        <VenueCarousel
          title="מקומות שביקרת בהם"
          subtitle="חזרי לחלל שאהבת"
          venues={recentlyVisited}
          badgeType="visited"
          seeAllHref="/venues"
          seeAllLabel="כל החללים"
        />
      )}

      {/* ── Saved venues ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4" style={{ color: '#e07a5f' }} />
            <h2 className="font-bold text-base" style={{ color: '#0a4a4a' }}>חללים שמורים</h2>
          </div>
          <Link href="/instructor-dashboard/saved" className="text-sm font-medium flex items-center gap-1" style={{ color: '#0d6e6e' }}>
            כל השמורים <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
        {savedVenues.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(13,110,110,0.04)', border: '1.5px dashed rgba(13,110,110,0.2)' }}
          >
            <div className="text-4xl mb-2">🌊</div>
            <p className="font-semibold text-gray-500 mb-1 text-sm">אין חללים שמורים עדיין</p>
            <Button className="mt-3 rounded-full text-white text-sm font-semibold" style={{ background: '#0d6e6e' }} asChild>
              <Link href="/venues"><Search className="w-3.5 h-3.5 ml-1.5" /> גלי חללים</Link>
            </Button>
          </div>
        ) : (
          <VenueCarousel title="" venues={savedVenues.slice(0, 4)} seeAllHref="/instructor-dashboard/saved" />
        )}
      </div>

      {/* ── Insight strip ── */}
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: 'rgba(92,140,110,0.06)', border: '1px solid rgba(92,140,110,0.20)' }}
      >
        <span className="text-2xl">🌊</span>
        <p className="text-sm" style={{ color: '#0a4a4a' }}>
          <strong>טיפ ים:</strong> חללים עם נוף לים מקבלים פי 2 יותר תלמידים. חפשי לפי פילטר &quot;נוף לים&quot; לתוצאות הטובות ביותר.
        </p>
      </div>
    </div>
  )
}
