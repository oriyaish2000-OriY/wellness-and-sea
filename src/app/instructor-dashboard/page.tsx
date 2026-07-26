import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getInstructorBookings,
  getSavedVenues,
  getRecentlyVisitedVenues,
  getRegularVenues,
} from '@/lib/supabase/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Users,
  TrendingUp,
  CheckCircle2,
  History,
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
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
}

export default async function InstructorDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')
  if (user.user_metadata?.role !== 'instructor') redirect('/host-dashboard')

  const [allBookings, savedVenues, recentlyVisited, regularVenues] = await Promise.all([
    getInstructorBookings(user.id),
    getSavedVenues(user.id),
    getRecentlyVisitedVenues(user.id),
    getRegularVenues(user.id),
  ])

  const today = new Date().toISOString().split('T')[0]

  const upcomingBookings = allBookings
    .filter((b) => b.booking_date >= today && b.status !== 'cancelled')
    .sort((a, b) => {
      const dateCmp = a.booking_date.localeCompare(b.booking_date)
      return dateCmp !== 0 ? dateCmp : a.start_time.localeCompare(b.start_time)
    })
    .slice(0, 3)

  const pastBookings = allBookings
    .filter((b) => b.booking_date < today || b.status === 'completed')
    .slice(0, 6)

  // Session stats
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

  const recentSaved = savedVenues.slice(0, 4)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-deep-ocean">
            שלום, {user.user_metadata?.full_name?.split(' ')[0] ?? 'מדריכה'} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">הנה סיכום הפעילות שלך</p>
        </div>
        <Button className="bg-ocean hover:bg-deep-ocean text-white self-start sm:self-auto" asChild>
          <Link href="/venues">
            <Search className="w-4 h-4 ml-1" />
            חיפוש חלל חדש
          </Link>
        </Button>
      </div>

      {/* Activity stats strip */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-ocean">{upcomingBookings.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">שיעורים קרובים</div>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-teal">{totalCompleted}</div>
          <div className="text-xs text-gray-500 mt-0.5">שיעורים הועברו</div>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-golden">{Math.round(totalHours)}</div>
          <div className="text-xs text-gray-500 mt-0.5">שעות פעילות</div>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-coral">{totalVenuesVisited}</div>
          <div className="text-xs text-gray-500 mt-0.5">חללים ביקרתי</div>
        </Card>
      </div>

      {/* Upcoming bookings */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-deep-ocean flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-ocean" />
              הזמנות קרובות
            </CardTitle>
            <Link
              href="/instructor-dashboard/bookings"
              className="text-sm text-ocean hover:text-deep-ocean flex items-center gap-1 transition-colors"
            >
              כל ההזמנות
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <div className="text-center py-10">
              <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">אין הזמנות קרובות</p>
              <Button className="mt-4 bg-ocean hover:bg-deep-ocean text-white text-sm" asChild>
                <Link href="/venues">
                  <Search className="w-3.5 h-3.5 ml-1.5" />
                  חפשי חלל עכשיו
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center gap-4 p-3.5 rounded-xl bg-gray-50 hover:bg-blue-50/40 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl ocean-gradient flex flex-col items-center justify-center flex-shrink-0 text-white shadow-sm">
                    <span className="text-[10px] font-medium leading-tight">
                      {new Date(booking.booking_date).toLocaleDateString('he-IL', { month: 'short' })}
                    </span>
                    <span className="text-lg font-bold leading-tight">
                      {new Date(booking.booking_date).getDate()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {(booking.venue as { title?: string } | undefined)?.title ?? 'חלל'}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {booking.start_time}–{booking.end_time}
                      </span>
                      {booking.class_type && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {booking.class_type}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                      STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {STATUS_LABELS[booking.status] ?? booking.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regular venues — customer base */}
      <RegularVenuesSection venues={regularVenues} />

      {/* Class history — זיכרון שיעורים */}
      {pastBookings.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-deep-ocean flex items-center gap-2">
                <History className="w-4 h-4 text-teal" />
                היסטוריית שיעורים
              </CardTitle>
              <Link
                href="/instructor-dashboard/bookings"
                className="text-sm text-ocean hover:text-deep-ocean flex items-center gap-1 transition-colors"
              >
                היסטוריה מלאה
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pastBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {booking.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <CalendarDays className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {(booking.venue as { title?: string } | undefined)?.title ?? 'חלל'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(booking.booking_date)} · {booking.start_time}–{booking.end_time}
                      {booking.class_type ? ` · ${booking.class_type}` : ''}
                    </p>
                  </div>
                  <Link
                    href={`/venues/${booking.venue_id}`}
                    className="text-xs text-ocean hover:underline flex-shrink-0"
                  >
                    הזמן שוב
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nearby venues by geolocation */}
      <div>
        <h2 className="text-lg font-semibold text-deep-ocean flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-ocean" />
          חללים קרובים אליך
        </h2>
        <NearbyInstructorSection />
      </div>

      {/* Recently visited venues carousel */}
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

      {/* Saved venues */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-deep-ocean flex items-center gap-2">
            <MapPin className="w-4 h-4 text-coral" />
            חללים שמורים
          </h2>
          <Link
            href="/instructor-dashboard/saved"
            className="text-sm text-ocean hover:text-deep-ocean flex items-center gap-1 transition-colors"
          >
            כל השמורים
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentSaved.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">אין חללים שמורים עדיין</p>
              <Button className="mt-4 bg-ocean hover:bg-deep-ocean text-white text-sm" asChild>
                <Link href="/venues">
                  <Search className="w-3.5 h-3.5 ml-1.5" />
                  גלי חללים
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <VenueCarousel title="" venues={recentSaved} seeAllHref="/instructor-dashboard/saved" />
        )}
      </div>

      {/* Tip strip */}
      <Card className="border-0 bg-ocean/5 shadow-none">
        <CardContent className="py-4 flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-ocean flex-shrink-0" />
          <p className="text-sm text-deep-ocean">
            <strong>טיפ:</strong> חללים עם נוף לים מקבלים פי 2 יותר תלמידים. חפשי לפי פילטר &quot;נוף לים&quot; לתוצאות הטובות ביותר.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
