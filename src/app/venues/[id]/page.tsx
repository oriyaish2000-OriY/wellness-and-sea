import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, MapPin, Users, CheckCircle, Star, Gift, Clock, Waves } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { BookingWidget } from './BookingWidget'
import { ReviewSection } from '@/components/venues/ReviewSection'
import { ShareButton } from '@/components/ui/share-button'
import { getVenueById, getVenueReviews, getVenueRatingSummary, getInstructorBookings, hasReviewedBooking } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import { AMENITY_OPTIONS } from '@/lib/constants'

const amenityLabels = Object.fromEntries(AMENITY_OPTIONS.map(a => [a.key, { label: a.label, icon: a.icon }]))

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const venue = await getVenueById(id)
  if (!venue) return {}
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wellness-and-sea.vercel.app'
  return {
    title: `${venue.title} | WELLNESS&SEA`,
    description: `${venue.description} — ${venue.location_city}. ₪${venue.hourly_price} לשעה, עד ${venue.capacity} משתתפים.`,
    openGraph: {
      title: `🌊 ${venue.title} — WELLNESS&SEA`,
      description: `${venue.description} | ${venue.location_city} | ₪${venue.hourly_price}/שעה`,
      url: `${appUrl}/venues/${id}`,
      siteName: 'WELLNESS&SEA',
      images: venue.images?.[0]
        ? [{ url: venue.images[0], width: 1200, height: 630, alt: venue.title }]
        : [{ url: `${appUrl}/og-default.png`, width: 1200, height: 630 }],
      locale: 'he_IL',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${venue.title} | WELLNESS&SEA`,
      description: venue.description,
      images: venue.images?.[0] ? [venue.images[0]] : [],
    },
  }
}

export default async function VenueDetailPage({ params }: Props) {
  const { id } = await params

  const venue = await getVenueById(id)
  if (!venue) notFound()

  const [reviews, ratingSummary] = await Promise.all([
    getVenueReviews(id),
    getVenueRatingSummary(id),
  ])

  // Check if logged-in instructor has a completed booking eligible for review
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let eligibleBookingId: string | undefined

  if (user && user.user_metadata?.role === 'instructor') {
    const myBookings = await getInstructorBookings(user.id)
    const completedForVenue = myBookings.filter(
      b => b.venue_id === id && b.status === 'completed'
    )
    for (const b of completedForVenue) {
      const reviewed = await hasReviewedBooking(b.id)
      if (!reviewed) {
        eligibleBookingId = b.id
        break
      }
    }
  }

  const displayRating = ratingSummary.count > 0 ? ratingSummary.avg : null

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <div className="pt-16">
        {/* Hero Image */}
        <div className="relative h-72 md:h-96 ocean-gradient overflow-hidden">
          {venue.images && venue.images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={venue.images[0]}
              alt={venue.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Waves className="w-32 h-32 text-white/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-6 right-6 left-6 flex justify-between items-end">
            <Link
              href="/venues"
              className="flex items-center gap-1 text-white text-sm bg-black/30 backdrop-blur rounded-full px-3 py-1.5"
            >
              <ArrowRight className="w-4 h-4" />
              חזרה לחיפוש
            </Link>
            {displayRating !== null ? (
              <div className="flex items-center gap-1 bg-black/30 backdrop-blur text-white rounded-full px-3 py-1.5 text-sm">
                <Star className="w-4 h-4 fill-golden text-golden" />
                <span>{displayRating.toFixed(1)}</span>
                <span className="text-white/60">({ratingSummary.count} ביקורות)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-black/30 backdrop-blur text-white rounded-full px-3 py-1.5 text-sm">
                <Star className="w-4 h-4 text-white/60" />
                <span className="text-white/60">אין ביקורות עדיין</span>
              </div>
            )}
          </div>

          {/* Image gallery dots */}
          {venue.images && venue.images.length > 1 && (
            <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-1.5">
              {venue.images.slice(0, 8).map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-2xl md:text-3xl font-bold text-deep-ocean mb-2">
                    {venue.title}
                  </h1>
                  <ShareButton
                    url={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/venues/${venue.id}`}
                    title={`🌊 ${venue.title} — WELLNESS&SEA`}
                    description={`${venue.location_city} | ₪${venue.hourly_price}/שעה`}
                  />
                </div>
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>{venue.location_address}, {venue.location_city}</span>
                </div>
              </div>

              {venue.bonus_offer && (
                <Card className="p-4 bg-golden/10 border-golden/20 flex items-center gap-3">
                  <Gift className="w-5 h-5 text-golden flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">בונוס בלעדי לקבוצתך</p>
                    <p className="text-gray-600 text-sm">{venue.bonus_offer}</p>
                  </div>
                </Card>
              )}

              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: Users, label: 'קיבולת מקס', value: `${venue.capacity} משתתפים` },
                  { icon: Clock, label: 'מינימום שעות', value: 'שעה וחצי' },
                  { icon: MapPin, label: 'גודל החלל', value: `${venue.space_size_sqm ?? '?'} מ"ר` },
                ].map((item) => (
                  <Card key={item.label} className="p-3 text-center border-0 shadow-sm">
                    <item.icon className="w-5 h-5 text-ocean mx-auto mb-1" />
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="font-semibold text-sm text-gray-800">{item.value}</p>
                  </Card>
                ))}
              </div>

              <div>
                <h2 className="font-semibold text-lg text-deep-ocean mb-3">על המקום</h2>
                <p className="text-gray-600 leading-relaxed">{venue.description}</p>
              </div>

              <div>
                <h2 className="font-semibold text-lg text-deep-ocean mb-3">מה כלול?</h2>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(venue.amenities).map(([key, value]) => {
                    const amenity = amenityLabels[key]
                    if (!amenity) return null
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-2 p-2 rounded-lg ${
                          value ? 'text-gray-700' : 'text-gray-300'
                        }`}
                      >
                        <CheckCircle
                          className={`w-4 h-4 flex-shrink-0 ${value ? 'text-green-500' : 'text-gray-200'}`}
                        />
                        <span className={`text-sm ${!value ? 'line-through' : ''}`}>
                          {amenity.icon} {amenity.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {venue.accessibility_info && (
                <div>
                  <h2 className="font-semibold text-lg text-deep-ocean mb-3">נגישות</h2>
                  <p className="text-gray-600 text-sm leading-relaxed">{venue.accessibility_info}</p>
                </div>
              )}

              <Card className="p-4 bg-blue-50 border-blue-100">
                <h3 className="font-semibold text-blue-800 mb-2 text-sm">חשוב לדעת</h3>
                <ul className="text-blue-700 text-sm space-y-1">
                  <li>• כל מדריך חייב להציג ביטוח אחריות מקצועית בתוקף</li>
                  <li>• נדרשת הצהרת בריאות חתומה מכל משתתף לפני האימון</li>
                  <li>• יש לפנות את החלל 15 דקות לפני סיום הזמנתך</li>
                  <li>• איחורים מעל 30 דקות גוררים ביטול ההזמנה ללא החזר</li>
                </ul>
              </Card>

              {/* Reviews */}
              <ReviewSection
                venueId={venue.id}
                reviews={reviews}
                avg={ratingSummary.avg}
                count={ratingSummary.count}
                eligibleBookingId={eligibleBookingId}
              />
            </div>

            {/* Booking Widget */}
            <div className="lg:col-span-1">
              <div className="sticky top-20">
                <BookingWidget venue={venue} userRole={user?.user_metadata?.role ?? null} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
