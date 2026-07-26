'use client'

import { useState } from 'react'
import { VenueCard } from '@/components/venues/venue-card'
import { SearchFilters } from '@/components/venues/search-filters'
import { NearbySection } from '@/components/home/nearby-section'
import { mockVenues, NEW_VENUE_THRESHOLD_DAYS, RECOMMENDED_VENUE_IDS } from '@/lib/mock-data'
import { Venue } from '@/lib/supabase/types'

function getBadgeType(venue: Venue): 'new' | 'recommended' | undefined {
  const created = new Date(venue.created_at).getTime()
  const isNew = created > Date.now() - NEW_VENUE_THRESHOLD_DAYS * 86400000
  if (isNew) return 'new'
  if (RECOMMENDED_VENUE_IDS.includes(venue.id)) return 'recommended'
  return undefined
}

export function VenueSearch() {
  const [filteredVenues, setFilteredVenues] = useState<Venue[]>(mockVenues)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = (query: string, filters: string[]) => {
    setHasSearched(true)
    let results = mockVenues

    if (query) {
      const q = query.toLowerCase()
      results = results.filter(v =>
        v.title.toLowerCase().includes(q) ||
        v.location_city.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q)
      )
    }

    if (filters.length > 0) {
      results = results.filter(v =>
        filters.every(f => v.amenities[f as keyof typeof v.amenities])
      )
    }

    setFilteredVenues(results)
  }

  return (
    <>
      {/* Filters */}
      <div className="py-6">
        <SearchFilters onSearch={handleSearch} />
      </div>

      {/* Nearby section */}
      {!hasSearched && (
        <div className="mb-4">
          <NearbySection />
        </div>
      )}

      {/* Results */}
      <div className="pb-16">
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-500 text-sm">
            {filteredVenues.length} חללים נמצאו
          </p>
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-coral inline-block" /> חדש
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-ocean inline-block" /> מומלץ
            </span>
          </div>
        </div>

        {filteredVenues.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">לא נמצאו חללים התואמים את החיפוש</p>
            <p className="text-sm mt-2">נסי לשנות את הפילטרים</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVenues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                badgeType={getBadgeType(venue)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
