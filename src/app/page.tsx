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
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 ocean-gradient opacity-95" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur text-white rounded-full px-4 py-2 text-sm mb-6">
            <Waves className="w-4 h-4" />
            <span>הפלטפורמה הראשונה מסוגה בישראל</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            שעות מתות הן
            <br />
            <span className="text-golden">הכנסה פסיבית</span>
            <br />
            שמחכה לך
          </h1>

          <p className="text-white/80 text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
            WELLNESS&amp;SEA מחברת בין מסעדות חוף למדריכי יוגה ופילאטיס.
            השכר את החלל שלך בשעות הבוקר וצור הכנסה חדשה.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-coral hover:bg-coral/90 text-white text-lg px-8 h-14" asChild>
              <Link href="/venues">
                מצא חלל ליוגה
                <ArrowLeft className="mr-2 w-5 h-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-ocean text-lg px-8 h-14 bg-white/10"
              asChild
            >
              <Link href="/host">השכר את המסעדה שלך</Link>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-8 mt-16">
            {[
              { value: '120+', label: 'חללים ברשת' },
              { value: '300+', label: 'מדריכים רשומים' },
              { value: '₪2,400', label: 'הכנסה ממוצעת לחודש' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-white/60 text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-cream">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-deep-ocean mb-4">איך זה עובד?</h2>
            <p className="text-gray-600 max-w-xl mx-auto">שלושה שלבים פשוטים לחלל מושלם</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '🔍',
                title: 'מצאי את החלל',
                desc: 'חפשי לפי מיקום, שעות, קיבולת ותנאים – מיזוג, הצללה, נוף לים',
              },
              {
                icon: '📅',
                title: 'הזמיני בקלות',
                desc: 'בחרי שעה, שלחי פרטי השיעור ושלמי בצורה מאובטחת',
              },
              {
                icon: '🧘',
                title: 'העבירי את השיעור',
                desc: 'הגיעי לחלל מוכן, העבירי שיעור מרהיב, קבלי חוויה יוקרתית',
              },
            ].map((step, i) => (
              <Card key={i} className="p-6 text-center border-0 shadow-md hover:shadow-lg transition-shadow">
                <div className="text-4xl mb-4">{step.icon}</div>
                <h3 className="font-semibold text-lg text-deep-ocean mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Brand differentiators */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-deep-ocean mb-2">למה WELLNESS&SEA?</h2>
            <p className="text-gray-500 text-sm">הבידול שלנו – לא רק חלל, אלא חוויה שלמה</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: '🌊', title: 'נוף לים', desc: 'כל החללים על קו החוף' },
              { icon: '☕', title: 'בונוסים ייחודיים', desc: 'קפה, ארוחות, הנחות' },
              { icon: '🏖️', title: 'גישה לחוף', desc: 'המשיכי את השיעור בחול' },
              { icon: '🛡️', title: 'מאומת ובטוח', desc: 'כל מקום נבדק אישית' },
            ].map(item => (
              <div key={item.title} className="text-center p-4">
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="font-semibold text-deep-ocean text-sm mb-1">{item.title}</div>
                <div className="text-gray-500 text-xs">{item.desc}</div>
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
      <section className="py-20 bg-sand">
        <div className="max-w-5xl mx-auto px-4">
          <div className="ocean-gradient rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
            <TrendingUp className="w-12 h-12 text-golden mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              יש לך מסעדה עם נוף לים?
            </h2>
            <p className="text-white/80 text-lg max-w-xl mx-auto mb-8">
              הפוך את שעות הבוקר הריקות להכנסה של אלפי שקלים בחודש.
              בלי עלויות נוספות, בלי כוח אדם נוסף.
            </p>
            <Button size="lg" className="bg-golden hover:bg-golden/90 text-white text-lg px-10 h-14" asChild>
              <Link href="/host">רשם את המקום שלך – חינם</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
