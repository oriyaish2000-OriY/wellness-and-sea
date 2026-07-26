'use client'

import Link from 'next/link'
import { Users, RepeatIcon, CalendarCheck, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Venue } from '@/lib/supabase/types'

interface RegularVenue extends Venue {
  visit_count: number
  last_visit: string
}

interface RegularVenuesSectionProps {
  venues: RegularVenue[]
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })
}

export function RegularVenuesSection({ venues }: RegularVenuesSectionProps) {
  if (venues.length === 0) return null

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-deep-ocean flex items-center gap-2">
            <RepeatIcon className="w-4 h-4 text-ocean" />
            החללים הקבועים שלי
          </CardTitle>
          <Link
            href="/venues"
            className="text-sm text-ocean hover:text-deep-ocean flex items-center gap-1 transition-colors"
          >
            גלי עוד חללים
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">חללים שחזרת אליהם יותר מפעם אחת</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {venues.map((venue, idx) => (
            <Link
              key={venue.id}
              href={`/venues/${venue.id}`}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50/40 transition-colors group"
            >
              {/* Rank badge */}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm
                ${idx === 0 ? 'bg-golden/20 text-golden' : idx === 1 ? 'bg-ocean/10 text-ocean' : 'bg-gray-100 text-gray-400'}`}
              >
                #{idx + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-ocean transition-colors">
                  {venue.title}
                </p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <CalendarCheck className="w-3 h-3" />
                    {venue.visit_count} ביקורים
                  </span>
                  <span>·</span>
                  <span>אחרון: {formatDate(venue.last_visit)}</span>
                </div>
              </div>

              {/* Capacity pill */}
              <span className="flex items-center gap-1 bg-ocean/8 text-ocean text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                <Users className="w-3 h-3" />
                {venue.capacity}
              </span>
            </Link>
          ))}
        </div>

        {/* Insight strip */}
        <div className="mt-3 bg-teal/5 border border-teal/20 rounded-xl p-3">
          <p className="text-xs text-teal font-medium">
            💡 מדריכות שחוזרות לאותו חלל מקבלות 30% יותר תלמידים בממוצע — הפלטפורמה מקדמת אותן אוטומטית
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
