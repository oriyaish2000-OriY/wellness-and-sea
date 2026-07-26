import Link from 'next/link'
import { ArrowLeft, Waves, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { VenueCard } from '@/components/venues/venue-card'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { InstructorHome } from '@/components/home/instructor-home'
import { WellnessWorldInsights } from '@/components/home/wellness-world-insights'
import { createClient } from '@/lib/supabase/server'
import { getInstructorBookings, getSavedVenues, getRecentlyVisitedVenues } from '@/lib/supabase/queries'
import { mockVenues } from '@/lib/mock-data'

export default async function HomePage() {
  // Check auth state — personalize if instructor
  let user = null
  let isInstructor = false

  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
    isInstructor = user?.user_metadata?.role === 'instructor'
  } catch {
    // not authenticated, render public marketing page
  }

  if (isInstructor && user) {
    // Personalized instructor home
    const [allBookings, savedVenues, recentlyVisited] = await Promise.all([
      getInstructorBookings(user.id),
      getSavedVenues(user.id),
      getRecentlyVisitedVenues(user.id),
    ])

    const today = new Date().toISOString().split('T')[0]
    const upcomingBookings = allBookings
      .filter(b => b.booking_date >= today && b.status !== 'cancelled')
      .sort((a, b) => {
        const d = a.booking_date.localeCompare(b.booking_date)
        return d !== 0 ? d : a.start_time.localeCompare(b.start_time)
      })

    const firstName = user.user_metadata?.full_name?.split(' ')[0] ?? 'מדריכה'

    return (
      <div className="min-h-screen bg-cream">
        <Navbar />
        <div className="pt-16">
          <InstructorHome
            firstName={firstName}
            upcomingBookings={upcomingBookings}
            recentlyVisited={recentlyVisited}
            savedVenues={savedVenues}
          />
        </div>
        <Footer />
      </div>
    )
  }

  // ── Public marketing home ──────────────────────────────────
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ paddingTop: '68px' }}>
        <div className="absolute inset-0 ocean-gradient" />
        {/* Orb blobs */}
        <div className="absolute" style={{ width: 500, height: 500, background: 'rgba(92,140,110,0.18)', borderRadius: '50%', filter: 'blur(80px)', top: -100, left: -100 }} />
        <div className="absolute" style={{ width: 400, height: 400, background: 'rgba(200,148,74,0.12)', borderRadius: '50%', filter: 'blur(80px)', bottom: -50, right: -50 }} />
        {/* Stripe texture */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'repeating-linear-gradient(15deg, transparent, transparent 20px, rgba(255,255,255,0.4) 20px, rgba(255,255,255,0.4) 22px)',
        }} />

        <div className="relative z-10 max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/20 text-white rounded-full px-5 py-2 text-sm mb-7 font-medium">
            <span style={{ width: 7, height: 7, background: '#e8b870', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            הפלטפורמה הראשונה מסוגה בישראל
          </div>

          <h1 className="font-black text-white mb-5 leading-tight" style={{ fontSize: 'clamp(38px, 6vw, 68px)', letterSpacing: '-1px', fontFamily: "'Heebo', sans-serif" }}>
            שעות מתות הן
            <br />
            <span style={{ color: '#e8b870' }}>הכנסה פסיבית</span>
            <br />
            שמחכה לך
          </h1>

          <p className="text-white/75 mb-10 leading-relaxed mx-auto" style={{ fontSize: 'clamp(16px, 2vw, 19px)', maxWidth: 580, lineHeight: 1.7 }}>
            WELLNESS&amp;SEA מחברת בין מסעדות חוף למדריכי יוגה ופילאטיס.
            השכר את החלל שלך בשעות הבוקר וצור הכנסה חדשה.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button size="lg" className="bg-golden hover:bg-gold-light text-white text-base px-9 h-13 rounded-full font-semibold" style={{ paddingTop: 16, paddingBottom: 16 }} asChild>
              <Link href="/venues">
                מצא חלל ליוגה
                <ArrowLeft className="mr-2 w-5 h-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              className="border border-white/30 text-white bg-white/15 hover:bg-white/25 text-base px-9 h-13 rounded-full font-semibold"
              style={{ paddingTop: 16, paddingBottom: 16 }}
              asChild
            >
              <Link href="/host">השכר את המסעדה שלך</Link>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-12">
            {[
              { value: '120+', label: 'חללים ברשת' },
              { value: '300+', label: 'מדריכים רשומים' },
              { value: '₪2,400', label: 'הכנסה ממוצעת לחודש' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-black text-white" style={{ fontSize: 30 }}>{stat.value}</div>
                <div className="text-white/60 text-xs mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave divider */}
      <div style={{ lineHeight: 0, background: '#faf5ee' }}>
        <svg viewBox="0 0 1440 60" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
          <path d="M0,60 C360,0 1080,60 1440,0 L1440,60 Z" fill="#0a4a4a" />
        </svg>
      </div>

      {/* How it works */}
      <section className="py-20 bg-cream">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-sage mb-3 block">תהליך פשוט</span>
            <h2 className="font-black text-deep-ocean mb-3" style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontFamily: "'Playfair Display', serif" }}>איך זה עובד?</h2>
            <p className="text-gray-500 max-w-md mx-auto leading-relaxed">שלושה שלבים פשוטים לחלל מושלם על קו החוף</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '1', icon: '🔍', title: 'מצאי את החלל', desc: 'חפשי לפי מיקום, שעות, קיבולת ותנאים – מיזוג, הצללה, נוף לים' },
              { step: '2', icon: '📅', title: 'הזמיני בקלות', desc: 'בחרי שעה, שלחי פרטי השיעור ושלמי בצורה מאובטחת' },
              { step: '3', icon: '🧘', title: 'העבירי את השיעור', desc: 'הגיעי לחלל מוכן, העבירי שיעור מרהיב, קבלי חוויה יוקרתית' },
            ].map((step) => (
              <Card key={step.step} className="p-8 text-center border-0 relative overflow-hidden transition-all duration-300 hover:-translate-y-1" style={{ boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius)' }}>
                <div className="absolute" style={{ top: -10, right: -10, fontSize: 80, fontWeight: 900, color: '#f0e6d3', lineHeight: 1, fontFamily: "'Playfair Display', serif", pointerEvents: 'none' }}>{step.step}</div>
                <div className="relative z-10">
                  <div className="w-16 h-16 ocean-gradient rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">{step.icon}</div>
                  <h3 className="font-bold text-lg text-deep-ocean mb-2">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Brand differentiators */}
      <section className="py-16 bg-deep-ocean">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { icon: '🌊', value: '120+', label: 'חללים על קו החוף' },
              { icon: '🧘', value: '300+', label: 'מדריכים רשומים' },
              { icon: '⭐', value: '4.9', label: 'דירוג ממוצע' },
              { icon: '💰', value: '₪2,400', label: 'הכנסה ממוצעת לחודש' },
            ].map(item => (
              <div key={item.label} className="text-center">
                <div className="text-4xl mb-2">{item.icon}</div>
                <div className="font-black text-white text-2xl">{item.value}</div>
                <div className="text-white/60 text-xs mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Venues */}
      <section className="py-20 bg-cream">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-deep-ocean">חללים מובילים</h2>
            <Button variant="ghost" className="text-ocean" asChild>
              <Link href="/venues">
                כל החללים
                <ArrowLeft className="mr-1 w-4 h-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockVenues.slice(0, 3).map((venue) => (
              <VenueCard key={venue.id} venue={venue} />
            ))}
          </div>
        </div>
      </section>

      {/* Wellness World Insights — research-based differentiation */}
      <WellnessWorldInsights />

      {/* For Hosts CTA */}
      <section className="py-20 bg-cream">
        <div className="max-w-5xl mx-auto px-6">
          <div className="ocean-gradient rounded-3xl p-10 md:p-16 relative overflow-hidden" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
            <div className="absolute" style={{ top: -60, left: -60, width: 300, height: 300, background: 'rgba(92,140,110,0.2)', borderRadius: '50%', filter: 'blur(60px)' }} />
            <div className="relative z-10">
              <p className="text-xs font-bold uppercase tracking-widest text-gold-light mb-4">לבעלי מסעדות</p>
              <h2 className="font-black text-white mb-4 leading-tight" style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontFamily: "'Playfair Display', serif" }}>
                יש לך מסעדה עם נוף לים?
              </h2>
              <p className="text-white/75 text-base leading-relaxed mb-7">
                הפוך את שעות הבוקר הריקות להכנסה של אלפי שקלים בחודש.
                בלי עלויות נוספות, בלי כוח אדם נוסף.
              </p>
              <ul className="space-y-2.5 mb-8">
                {['הכנסה פסיבית בשעות הבוקר', 'קהל יוקרתי ומכבד', 'ניהול הזמנות מלא במערכת'].map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-white/85 text-sm">
                    <span className="w-5 h-5 rounded-full bg-sage flex items-center justify-center text-white text-xs font-bold flex-shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Button size="lg" className="bg-golden hover:bg-gold-light text-white rounded-full px-9 font-semibold" asChild>
                <Link href="/host">רשם את המקום שלך – חינם</Link>
              </Button>
            </div>
            <div className="relative z-10 hidden md:flex flex-col gap-5">
              {[
                { icon: '💰', value: '₪2,400', label: 'הכנסה ממוצעת לחודש' },
                { icon: '📅', value: '8-12', label: 'הזמנות בחודש הראשון' },
                { icon: '⭐', value: '4.9★', label: 'שביעות רצון מדריכים' },
              ].map(stat => (
                <div key={stat.label} className="flex items-center gap-4 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <span className="text-3xl">{stat.icon}</span>
                  <div>
                    <div className="font-black text-white text-xl">{stat.value}</div>
                    <div className="text-white/60 text-xs">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
