import Link from 'next/link'
import { CalendarDays, Clock, ArrowLeft, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { VenueCarousel } from '@/components/venues/venue-carousel'
import { NearbySection } from '@/components/home/nearby-section'
import { Booking, Venue } from '@/lib/supabase/types'
import { mockVenues, RECOMMENDED_VENUE_IDS, NEW_VENUE_THRESHOLD_DAYS } from '@/lib/mock-data'

interface InstructorHomeProps {
  firstName: string
  upcomingBookings: Booking[]
  recentlyVisited: Venue[]
  savedVenues: Venue[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתינה לאישור',
  confirmed: 'מאושרת ✓',
  completed: 'הושלמה',
}

// Mock: in production these come from DB queries
const recommendedVenues = mockVenues.filter(v => RECOMMENDED_VENUE_IDS.includes(v.id))
const newVenues = mockVenues.filter(v => {
  const created = new Date(v.created_at).getTime()
  return created > Date.now() - NEW_VENUE_THRESHOLD_DAYS * 86400000
})

export function InstructorHome({ firstName, upcomingBookings, recentlyVisited, savedVenues }: InstructorHomeProps) {
  const nextClass = upcomingBookings[0]

  return (
    <div className="space-y-2">
      {/* Personalized greeting */}
      <section className="ocean-gradient py-10 px-4 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
          שלום, {firstName}! 🌊
        </h1>
        <p className="text-white/70 text-sm">
          {nextClass
            ? `השיעור הבא שלך: ${new Date(nextClass.booking_date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })} בשעה ${nextClass.start_time}`
            : 'בואי נמצא לך את החלל המושלם לשיעור הבא'}
        </p>

        {/* Quick search bar shortcut */}
        <Link
          href="/venues"
          className="inline-flex items-center gap-2 mt-5 bg-white/15 hover:bg-white/25 backdrop-blur text-white rounded-2xl px-5 py-3 text-sm font-medium transition-all border border-white/20"
        >
          🔍 חיפוש חלל לפי תאריך ושעה
        </Link>
      </section>

      {/* Next class card */}
      {nextClass && (
        <section className="px-4 md:px-0 max-w-7xl mx-auto pt-6">
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="flex items-center gap-0">
              {/* Color strip */}
              <div className="w-1.5 self-stretch bg-ocean rounded-r-full" />
              <div className="flex items-center gap-4 p-4 flex-1">
                {/* Date box */}
                <div className="w-14 h-14 rounded-xl ocean-gradient flex flex-col items-center justify-center flex-shrink-0 text-white shadow">
                  <span className="text-xs font-medium leading-tight">
                    {new Date(nextClass.booking_date).toLocaleDateString('he-IL', { month: 'short' })}
                  </span>
                  <span className="text-xl font-bold leading-tight">
                    {new Date(nextClass.booking_date).getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium mb-0.5">השיעור הקרוב שלך</p>
                  <p className="font-semibold text-gray-900 truncate">
                    {(nextClass.venue as { title?: string } | undefined)?.title ?? 'חלל'}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {nextClass.start_time}–{nextClass.end_time}
                    </span>
                    {nextClass.class_type && (
                      <span>{nextClass.class_type}</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[nextClass.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[nextClass.status] ?? nextClass.status}
                  </span>
                  <Link
                    href="/instructor-dashboard/bookings"
                    className="text-xs text-ocean hover:text-deep-ocean flex items-center gap-0.5"
                  >
                    כל ההזמנות <ArrowLeft className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        </section>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-2">
        {/* Recently visited */}
        {recentlyVisited.length > 0 && (
          <VenueCarousel
            title="המשיכי מאיפה שעצרת"
            subtitle="חללים שביקרת בהם לאחרונה"
            venues={recentlyVisited}
            badgeType="visited"
            seeAllHref="/instructor-dashboard/bookings"
            seeAllLabel="כל ההזמנות"
          />
        )}

        {/* Geolocation-based nearby (Client Component) */}
        <NearbySection />

        {/* Recommended by platform */}
        {recommendedVenues.length > 0 && (
          <VenueCarousel
            title="המומלצים שלנו"
            subtitle="נבחרו בקפידה על ידי הצוות שלנו"
            venues={recommendedVenues}
            badgeType="recommended"
            seeAllHref="/venues"
            seeAllLabel="כל החללים"
          />
        )}

        {/* New venues */}
        {newVenues.length > 0 && (
          <VenueCarousel
            title="חדשים ברשת ✨"
            subtitle="הצטרפו לאחרונה – היי הראשונה לנסות"
            venues={newVenues}
            badgeType="new"
            seeAllHref="/venues"
            seeAllLabel="גלי עוד"
          />
        )}

        {/* Saved venues */}
        {savedVenues.length > 0 && (
          <VenueCarousel
            title="החללים השמורים שלך"
            venues={savedVenues}
            seeAllHref="/instructor-dashboard/saved"
            seeAllLabel="כל השמורים"
          />
        )}

        {/* Empty state CTA */}
        {upcomingBookings.length === 0 && recentlyVisited.length === 0 && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-ocean/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-ocean" />
            </div>
            <h3 className="font-semibold text-deep-ocean mb-2">מוכנה להתחיל?</h3>
            <p className="text-gray-500 text-sm mb-4 max-w-xs mx-auto">
              גלי מאות חללי יוגה ופילאטיס על קו החוף בישראל
            </p>
            <Button className="bg-ocean hover:bg-deep-ocean text-white" asChild>
              <Link href="/venues">גלי חללים עכשיו</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
