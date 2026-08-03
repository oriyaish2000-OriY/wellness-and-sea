import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowRight } from 'lucide-react'
import { ImageManagerClient } from './ImageManagerClient'

interface Props {
  searchParams: Promise<{ venue_id?: string }>
}

export default async function VenueImagesPage({ searchParams }: Props) {
  const { venue_id } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  if (user.user_metadata?.role !== 'host') redirect('/instructor-dashboard')
  if (!venue_id) redirect('/host-dashboard/venues')

  const { data: venue } = await supabase
    .from('venues')
    .select('id, title, images')
    .eq('id', venue_id)
    .eq('host_id', user.id)
    .single()

  if (!venue) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/host-dashboard/venues"
        className="inline-flex items-center gap-1.5 text-sm text-ocean hover:underline"
      >
        <ArrowRight className="w-4 h-4" />
        חזרה לחללים שלי
      </Link>

      <ImageManagerClient
        venueId={venue.id}
        initialImages={(venue.images as string[]) ?? []}
        venueName={venue.title}
      />
    </div>
  )
}
