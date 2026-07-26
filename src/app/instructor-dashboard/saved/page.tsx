import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSavedVenues } from '@/lib/supabase/queries'
import { unsaveVenue } from '@/lib/actions/instructor'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { VenueCard } from '@/components/venues/venue-card'
import { Heart, Search, Trash2 } from 'lucide-react'

export default async function SavedVenuesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')
  if (user.user_metadata?.role !== 'instructor') redirect('/host-dashboard')

  const venues = await getSavedVenues(user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-deep-ocean">חללים שמורים</h1>
        <p className="text-gray-500 text-sm mt-1">
          {venues.length > 0
            ? `${venues.length} חללים שמורים`
            : 'לא שמרת חללים עדיין'}
        </p>
      </div>

      {venues.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-gray-300" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">אין חללים שמורים</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
              לחצי על לב בדף החלל כדי לשמור אותו לרשימה שלך
            </p>
            <Button className="bg-ocean hover:bg-deep-ocean text-white" asChild>
              <Link href="/venues">
                <Search className="w-4 h-4 ml-1" />
                גלי חללים
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {venues.map((venue) => (
            <div key={venue.id} className="relative">
              <VenueCard venue={venue} />
              {/* Unsave button overlay */}
              <div className="absolute top-3 left-3">
                <form
                  action={async () => {
                    'use server'
                    await unsaveVenue(venue.id)
                  }}
                >
                  <button
                    type="submit"
                    title="הסר מהשמורים"
                    className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-colors text-gray-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
