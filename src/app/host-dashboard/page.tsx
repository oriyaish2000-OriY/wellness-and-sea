import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getHostStats, getHostBookings } from '@/lib/supabase/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  Building2,
  Clock,
  CalendarDays,
  Plus,
  Users,
  ArrowLeft,
} from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתינה',
  confirmed: 'מאושרת',
  cancelled: 'בוטלה',
  completed: 'הושלמה',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatPrice(amount: number) {
  return `₪${amount.toLocaleString('he-IL')}`
}

export default async function HostDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')
  if (user.user_metadata?.role !== 'host') redirect('/instructor-dashboard')

  const [stats, allBookings] = await Promise.all([
    getHostStats(user.id),
    getHostBookings(user.id),
  ])

  // Next 5 upcoming bookings sorted by date asc
  const today = new Date().toISOString().split('T')[0]
  const upcomingBookings = allBookings
    .filter((b) => b.booking_date >= today && b.status !== 'cancelled')
    .sort((a, b) => {
      const dateCmp = a.booking_date.localeCompare(b.booking_date)
      return dateCmp !== 0 ? dateCmp : a.start_time.localeCompare(b.start_time)
    })
    .slice(0, 5)

  const pendingCount = allBookings.filter((b) => b.status === 'pending').length

  const statsCards = [
    {
      label: 'הכנסות החודש',
      value: formatPrice(stats.thisMonthEarnings),
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'חללים פעילים',
      value: `${stats.activeVenues} / ${stats.totalVenues}`,
      icon: Building2,
      color: 'text-ocean',
      bg: 'bg-blue-50',
    },
    {
      label: 'הזמנות ממתינות',
      value: pendingCount.toString(),
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      label: 'הזמנות החודש',
      value: stats.thisMonthBookings.toString(),
      icon: CalendarDays,
      color: 'text-coral',
      bg: 'bg-red-50',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-deep-ocean">
            שלום, {user.user_metadata?.full_name?.split(' ')[0] ?? 'מארחת'} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">הנה סקירת הפעילות שלך</p>
        </div>
        <Button className="bg-ocean hover:bg-deep-ocean text-white self-start sm:self-auto" asChild>
          <Link href="/host/list-space">
            <Plus className="w-4 h-4 ml-1" />
            פרסמי חלל חדש
          </Link>
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming bookings */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-deep-ocean">
              הזמנות קרובות
            </CardTitle>
            <Link
              href="/host-dashboard/bookings"
              className="text-sm text-ocean hover:text-deep-ocean flex items-center gap-1 transition-colors"
            >
              כל ההזמנות
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {upcomingBookings.length === 0 ? (
            <div className="text-center py-12 px-6">
              <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">אין הזמנות קרובות</p>
              <p className="text-gray-400 text-xs mt-1">הזמנות חדשות יופיעו כאן</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-right text-xs font-medium text-gray-400 px-6 py-3">מדריכה</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-6 py-3">חלל</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-6 py-3">תאריך</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-6 py-3">שעות</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-6 py-3">סטטוס</th>
                    <th className="text-right text-xs font-medium text-gray-400 px-6 py-3">תשלום</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {upcomingBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full ocean-gradient flex items-center justify-center flex-shrink-0">
                            <Users className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="font-medium text-gray-900">
                            {(booking.instructor as { full_name?: string } | undefined)?.full_name ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {(booking.venue as { title?: string } | undefined)?.title ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(booking.booking_date)}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {booking.start_time}–{booking.end_time}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {STATUS_LABELS[booking.status] ?? booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-green-700">
                        {formatPrice(booking.host_payout)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
