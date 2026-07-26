import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { VenueSearch } from './VenueSearch'
import { HappeningNowSection } from '@/components/venues/happening-now-section'

export default function VenuesPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <div className="pt-20">
        {/* Header */}
        <div className="ocean-gradient py-10 text-center">
          <h1 className="text-3xl font-bold text-white mb-1">חיפוש חללים</h1>
          <p className="text-white/70 text-sm">מצאי את המקום המושלם לשיעור הבא שלך</p>
        </div>

        {/* Live now section — client, shows only if active bookings exist */}
        <HappeningNowSection />

        <div className="max-w-7xl mx-auto px-4">
          <VenueSearch />
        </div>
      </div>

      <Footer />
    </div>
  )
}
