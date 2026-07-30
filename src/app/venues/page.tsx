import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { VenueSearch } from './VenueSearch'
import { HappeningNowSection } from '@/components/venues/happening-now-section'
import { getVenues } from '@/lib/supabase/queries'

export default async function VenuesPage() {
  const hour = new Date().getHours()
  const isMorning = hour >= 5 && hour < 13
  const venues = await getVenues()

  return (
    <div className="min-h-screen" style={{ background: '#faf5ee' }}>
      <Navbar />

      {/* ── Discovery Header ── */}
      <div style={{ paddingTop: 68 }}>
        <div
          className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #0a4a4a 0%, #0d6e6e 55%, #1a9090 100%)',
            padding: '52px 24px 72px',
          }}
        >
          {/* Orbs */}
          <div className="absolute" style={{ width: 300, height: 300, background: 'rgba(92,140,110,0.18)', borderRadius: '50%', filter: 'blur(70px)', top: -80, left: -80 }} />
          <div className="absolute" style={{ width: 200, height: 200, background: 'rgba(200,148,74,0.12)', borderRadius: '50%', filter: 'blur(60px)', bottom: -40, right: -40 }} />

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e8b870', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              <span className="text-white text-xs font-semibold">
                {isMorning ? '🌅 שעות הגאות — הבוקר הטוב ביותר לשיעור' : '🌊 גלה את החלל המושלם שלך'}
              </span>
            </div>

            <h1 className="font-black text-white mb-3" style={{ fontSize: 'clamp(30px, 5vw, 52px)', fontFamily: "'Playfair Display', serif", lineHeight: 1.15, letterSpacing: '-0.5px' }}>
              חללי יוגה על<br />
              <span style={{ color: '#e8b870' }}>קו הים</span>
            </h1>
            <p className="mb-8" style={{ color: 'rgba(255,255,255,0.70)', fontSize: 15, lineHeight: 1.7 }}>
              מצאי את המקום המושלם לשיעור הבא שלך — נוף לים, אוויר ים, חוויה שאי אפשר לשכוח
            </p>

            {/* Category pills — MOVE style */}
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { icon: '🧘', label: 'יוגה' },
                { icon: '🏋️', label: 'פילאטיס' },
                { icon: '🧘‍♂️', label: 'מדיטציה' },
                { icon: '🌊', label: 'כושר ים' },
                { icon: '🏖️', label: 'עם גישה לחוף' },
                { icon: '❄️', label: 'מיזוג' },
              ].map(cat => (
                <button
                  key={cat.label}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer' }}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Wave bottom */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 48" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
              <path d="M0,24 C360,0 1080,48 1440,24 L1440,48 L0,48 Z" fill="#faf5ee" />
            </svg>
          </div>
        </div>

        {/* Live now section */}
        <HappeningNowSection />

        {/* Search + results */}
        <div className="max-w-7xl mx-auto px-4">
          <VenueSearch initialVenues={venues} />
        </div>
      </div>

      <Footer />
    </div>
  )
}
