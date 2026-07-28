import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getHostStats, getHostBookings } from '@/lib/supabase/queries'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  Building2,
  Clock,
  CalendarDays,
  Plus,
  Users,
  ArrowLeft,
  Waves,
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
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatPrice(amount: number) {
  return `₪${amount.toLocaleString('he-IL')}`
}

function getGreeting(hour: number) {
  if (hour < 12) return { text: 'בוקר טוב', icon: '🌅' }
  if (hour < 17) return { text: 'צהריים טובים', icon: '☀️' }
  return { text: 'ערב טוב', icon: '🌊' }
}

export default async function HostDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')
  if (user.user_metadata?.role !== 'host') redirect('/instructor-dashboard')

  const [stats, allBookings] = await Promise.all([
    getHostStats(user.id),
    getHostBookings(user.id),
  ])

  const today = new Date().toISOString().split('T')[0]
  const hour = new Date().getHours()
  const greeting = getGreeting(hour)
  const firstName = user.user_metadata?.full_name?.split(' ')[0] ?? 'מארחת'

  const upcomingBookings = allBookings
    .filter(b => b.booking_date >= today && b.status !== 'cancelled')
    .sort((a, b) => {
      const d = a.booking_date.localeCompare(b.booking_date)
      return d !== 0 ? d : a.start_time.localeCompare(b.start_time)
    })
    .slice(0, 5)

  const pendingCount = allBookings.filter(b => b.status === 'pending').length
  const todayCount = allBookings.filter(b => b.booking_date === today && b.status !== 'cancelled').length

  const statsCards = [
    {
      label: 'הכנסות החודש',
      value: formatPrice(stats.thisMonthEarnings),
      icon: TrendingUp,
      iconBg: 'rgba(92,140,110,0.10)',
      iconColor: '#5c8c6e',
      sub: 'שיעור ביצועים חודשי',
    },
    {
      label: 'חללים פעילים',
      value: `${stats.activeVenues} / ${stats.totalVenues}`,
      icon: Building2,
      iconBg: 'rgba(13,110,110,0.10)',
      iconColor: '#0d6e6e',
      sub: 'חללים מפורסמים',
    },
    {
      label: 'ממתינות לאישור',
      value: pendingCount.toString(),
      icon: Clock,
      iconBg: 'rgba(200,148,74,0.10)',
      iconColor: '#c8944a',
      sub: pendingCount > 0 ? '⚡ פעולה נדרשת' : 'הכל מאושר',
    },
    {
      label: 'שיעורים היום',
      value: todayCount.toString(),
      icon: CalendarDays,
      iconBg: 'rgba(224,122,95,0.10)',
      iconColor: '#e07a5f',
      sub: 'פעילות יומית',
    },
  ]

  return (
    <div className="space-y-8">
      {/* ── Greeting header ── */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{
        background: 'linear-gradient(145deg, #0a4a4a 0%, #0d6e6e 60%, #1a9090 100%)',
      }}>
        {/* Orb */}
        <div className="absolute" style={{ width: 200, height: 200, background: 'rgba(200,148,74,0.15)', borderRadius: '50%', filter: 'blur(50px)', top: -60, left: -60 }} />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#e8b870' }}>
              {greeting.icon} {greeting.text}
            </p>
            <h1 className="text-2xl font-black text-white mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
              {firstName}
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {pendingCount > 0
                ? `יש לך ${pendingCount} הזמנות ממתינות לאישורך`
                : 'הכל מסודר — אין הזמנות ממתינות'}
            </p>
          </div>
          <Button
            className="text-white font-semibold rounded-full flex items-center gap-2"
            style={{ background: '#c8944a', border: 'none', padding: '10px 20px' }}
            asChild
          >
            <Link href="/host/list-space">
              <Plus className="w-4 h-4" />
              פרסמי חלל
            </Link>
          </Button>
        </div>

        {/* Wave strip */}
        <div className="absolute bottom-0 left-0 right-0 opacity-20">
          <svg viewBox="0 0 400 30" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
            <path d="M0,15 C100,0 200,30 300,15 C350,7 380,20 400,15 L400,30 L0,30 Z" fill="white" />
          </svg>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map(({ label, value, icon: Icon, iconBg, iconColor, sub }) => (
          <div
            key={label}
            className="rounded-2xl p-5 bg-white"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
              style={{ background: iconBg }}
            >
              <Icon className="w-5 h-5" style={{ color: iconColor }} />
            </div>
            <p className="text-2xl font-black" style={{ color: '#1a2a2a' }}>{value}</p>
            <p className="text-xs font-medium text-gray-500 mt-1">{label}</p>
            <p className="text-[11px] mt-2 font-medium" style={{ color: iconColor }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Upcoming bookings ── */}
      <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #f0e6d3' }}>
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4" style={{ color: '#0d6e6e' }} />
            <h2 className="font-bold text-base" style={{ color: '#0a4a4a' }}>הזמנות קרובות</h2>
          </div>
          <Link
            href="/host-dashboard/bookings"
            className="flex items-center gap-1 text-sm font-medium"
            style={{ color: '#0d6e6e' }}
          >
            כל ההזמנות
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {upcomingBookings.length === 0 ? (
          <div className="text-center py-14 px-6">
            <div className="text-5xl mb-3">🌊</div>
            <p className="font-semibold text-gray-600 mb-1">אין הזמנות קרובות</p>
            <p className="text-xs text-gray-400">הזמנות חדשות יופיעו כאן</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#faf5ee' }}>
                  {['מדריכה', 'חלל', 'תאריך', 'שעות', 'סטטוס', 'תשלום'].map(h => (
                    <th
                      key={h}
                      className="text-right px-6 py-3 font-bold text-xs uppercase tracking-wider"
                      style={{ color: 'rgba(107,124,124,0.8)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upcomingBookings.map((booking, i) => {
                  const statusStyle = STATUS_STYLE[booking.status] ?? { bg: '#f1f5f9', color: '#64748b' }
                  const instructorName = (booking.instructor as { full_name?: string } | undefined)?.full_name
                  const initial = instructorName?.[0]?.toUpperCase() ?? '?'
                  return (
                    <tr
                      key={booking.id}
                      style={{ borderBottom: i < upcomingBookings.length - 1 ? '1px solid #f0e6d3' : 'none' }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                            style={{ background: 'linear-gradient(135deg, #0d6e6e, #1a9090)' }}
                          >
                            {initial}
                          </div>
                          <span className="font-semibold" style={{ color: '#1a2a2a' }}>
                            {instructorName ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {(booking.venue as { title?: string } | undefined)?.title ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{formatDate(booking.booking_date)}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {booking.start_time.slice(0, 5)}–{booking.end_time.slice(0, 5)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
                          style={{ background: statusStyle.bg, color: statusStyle.color }}
                        >
                          {STATUS_LABELS[booking.status] ?? booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold" style={{ color: '#5c8c6e' }}>
                        {formatPrice(booking.host_payout)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Quick links ── */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/host-dashboard/venues"
          className="flex items-center gap-3 rounded-2xl p-5 transition-all"
          style={{ background: 'rgba(13,110,110,0.06)', border: '1.5px solid rgba(13,110,110,0.15)' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(13,110,110,0.12)' }}>
            <Building2 className="w-5 h-5" style={{ color: '#0d6e6e' }} />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: '#0a4a4a' }}>ניהול חללים</p>
            <p className="text-xs text-gray-400 mt-0.5">הוספה ועריכת חללים</p>
          </div>
        </Link>
        <Link
          href="/host-dashboard/bookings"
          className="flex items-center gap-3 rounded-2xl p-5 transition-all"
          style={{ background: 'rgba(200,148,74,0.06)', border: '1.5px solid rgba(200,148,74,0.20)' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(200,148,74,0.12)' }}>
            <Users className="w-5 h-5" style={{ color: '#c8944a' }} />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: '#0a4a4a' }}>כל ההזמנות</p>
            <p className="text-xs text-gray-400 mt-0.5">סקירה ואישור</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
