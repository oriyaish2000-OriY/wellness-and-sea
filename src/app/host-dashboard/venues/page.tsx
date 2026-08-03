import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getHostVenues } from '@/lib/supabase/queries'
import { publishVenue, pauseVenue } from '@/lib/actions/venues'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building2, Users, MapPin, Plus, Waves, Eye, EyeOff, Images } from 'lucide-react'
import { SharePanel } from '@/components/ui/share-button'

function formatPrice(amount: number) {
  return `₪${amount.toLocaleString('he-IL')}`
}

export default async function HostVenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; venue_id?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')
  if (user.user_metadata?.role !== 'host') redirect('/instructor-dashboard')

  const [venues, params] = await Promise.all([
    getHostVenues(user.id),
    searchParams,
  ])

  const justCreated = params.created === 'true'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wellness-and-sea.vercel.app'
  // Find the most recently created venue to get its ID for sharing
  const newestVenue = justCreated && venues.length > 0 ? venues[0] : null

  return (
    <div className="space-y-6">
      {/* Success banner + share panel */}
      {justCreated && newestVenue && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(92,140,110,0.08)', border: '1.5px solid rgba(92,140,110,0.25)' }}>
          <div className="flex items-center gap-3 px-5 py-4 text-sm font-medium" style={{ color: '#1a5c3a' }}>
            <span className="text-xl">🎉</span>
            <span className="font-semibold">החלל <strong>{newestVenue.title}</strong> פורסם בהצלחה! שתפי את הקישור ברשתות החברתיות:</span>
          </div>
          <div className="px-5 pb-5">
            <SharePanel
              url={`${appUrl}/venues/${newestVenue.id}`}
              title={`🌊 ${newestVenue.title} — WELLNESS&SEA`}
              description={`חלל יוגה ופילאטיס | ${newestVenue.location_city} | ₪${newestVenue.hourly_price}/שעה`}
            />
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-deep-ocean">החללים שלי</h1>
          <p className="text-gray-500 text-sm mt-1">
            {venues.length > 0
              ? `${venues.length} חללים רשומים`
              : 'טרם פרסמת חללים'}
          </p>
        </div>
        <Button className="bg-ocean hover:bg-deep-ocean text-white self-start sm:self-auto" asChild>
          <Link href="/host/list-space">
            <Plus className="w-4 h-4 ml-1" />
            פרסמי חלל חדש
          </Link>
        </Button>
      </div>

      {/* Empty state */}
      {venues.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-20 text-center">
            <div className="w-16 h-16 rounded-full ocean-gradient flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">אין חללים עדיין</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
              פרסמי את החלל שלך והתחילי לקבל הזמנות ממדריכי יוגה ופילאטיס
            </p>
            <Button className="bg-ocean hover:bg-deep-ocean text-white" asChild>
              <Link href="/host/list-space">
                <Plus className="w-4 h-4 ml-1" />
                פרסמי חלל חדש
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {venues.map((venue) => (
            <Card key={venue.id} className="border-0 shadow-sm overflow-hidden">
              {/* Image placeholder */}
              <div className="relative h-40 ocean-gradient overflow-hidden">
                {venue.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={venue.images[0]}
                    alt={venue.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Waves className="w-12 h-12 text-white/30" />
                  </div>
                )}
                {/* Status badge */}
                <div className="absolute top-3 right-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm ${
                      venue.is_active
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-500 text-white'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        venue.is_active ? 'bg-white' : 'bg-gray-300'
                      }`}
                    />
                    {venue.is_active ? 'פעיל' : 'טיוטה'}
                  </span>
                </div>
              </div>

              <CardContent className="p-5">
                <h3 className="font-semibold text-gray-900 text-base mb-1 line-clamp-1">
                  {venue.title}
                </h3>
                <div className="flex items-center gap-1 text-gray-500 text-xs mb-3">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">
                    {venue.location_address}, {venue.location_city}
                  </span>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-ocean" />
                    עד {venue.capacity} משתתפים
                  </span>
                  <span className="font-semibold text-ocean">
                    {formatPrice(venue.hourly_price)} / שעה
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" className="flex-1 text-sm border-ocean/30 text-ocean hover:bg-ocean/5" asChild>
                    <Link href={`/host-dashboard/venues/images?venue_id=${venue.id}`}>
                      <Images className="w-3.5 h-3.5 ml-1.5" />
                      תמונות
                      {venue.images && venue.images.length > 0 && (
                        <span className="mr-1 text-xs text-gray-400">({venue.images.length})</span>
                      )}
                    </Link>
                  </Button>
                </div>
                <div className="flex gap-2">
                  {venue.is_active ? (
                    <form
                      action={async () => {
                        'use server'
                        await pauseVenue(venue.id)
                      }}
                      className="flex-1"
                    >
                      <Button
                        type="submit"
                        variant="outline"
                        className="w-full text-sm border-gray-200 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
                      >
                        <EyeOff className="w-3.5 h-3.5 ml-1.5" />
                        השהה
                      </Button>
                    </form>
                  ) : (
                    <form
                      action={async () => {
                        'use server'
                        await publishVenue(venue.id)
                      }}
                      className="flex-1"
                    >
                      <Button
                        type="submit"
                        className="w-full text-sm bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Eye className="w-3.5 h-3.5 ml-1.5" />
                        פרסמי
                      </Button>
                    </form>
                  )}
                  <Button variant="outline" className="flex-1 text-sm border-gray-200" asChild>
                    <Link href={`/venues/${venue.id}`}>צפייה</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
