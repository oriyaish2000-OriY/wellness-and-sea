import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getVenues, getHappeningNowVenues, getInstructorBookings, getRecentlyVisitedVenues } from '@/lib/supabase/queries'
import type { Venue } from '@/lib/supabase/types'

export const runtime = 'nodejs'

// ─── Intent detection ────────────────────────────────────────────────────────

type Intent =
  | 'happening_now'
  | 'nearby'
  | 'morning'
  | 'my_history'
  | 'recommendation'
  | 'small_group'
  | 'large_group'
  | 'budget'
  | 'all'

function detectIntent(msg: string): Intent {
  const m = msg.toLowerCase()
  if (/עכשיו|פעיל|מתרחש|קורה/.test(m)) return 'happening_now'
  if (/קרוב|ליד|מיקום|סביב/.test(m)) return 'nearby'
  if (/בוקר|morning|07|08|09|06/.test(m)) return 'morning'
  if (/היסטוריה|הזמנות שלי|ביקרתי|קודם/.test(m)) return 'my_history'
  if (/המלצ|בשביל|מתאים|אישי/.test(m)) return 'recommendation'
  if (/קטנ|עד 10|עד 8|עד 5|2 אנשים|3 אנשים|5 אנשים/.test(m)) return 'small_group'
  if (/גדול|20\+|30\+|קבוצה גדול|הרבה אנשים/.test(m)) return 'large_group'
  if (/זול|תקציב|מחיר נוח|저렴|cheap|budget/.test(m)) return 'budget'
  return 'all'
}

// ─── Personalization helpers ─────────────────────────────────────────────────

async function getUserProfile(userId: string): Promise<{ preferredCity?: string; typicalCapacity?: number }> {
  try {
    const bookings = await getInstructorBookings(userId)
    if (!bookings.length) return {}

    // Most frequent city from bookings
    const cityCounts: Record<string, number> = {}
    const capacities: number[] = []

    for (const b of bookings) {
      const city = (b.venue as unknown as Venue)?.location_city
      if (city) cityCounts[city] = (cityCounts[city] ?? 0) + 1

      // Estimate group size from class type or just track booking counts
      const cap = (b.venue as unknown as Venue)?.capacity
      if (cap) capacities.push(cap)
    }

    const preferredCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    const typicalCapacity = capacities.length
      ? Math.round(capacities.reduce((a, b) => a + b, 0) / capacities.length)
      : undefined

    return { preferredCity, typicalCapacity }
  } catch {
    return {}
  }
}

// ─── Intent handlers ─────────────────────────────────────────────────────────

async function handleHappeningNow(): Promise<{ reply: string; venues: Venue[] }> {
  const venues = await getHappeningNowVenues(6)
  if (!venues.length) {
    return { reply: 'כרגע אין שיעורים פעילים. נסי לחפש חלל לשיעור בשעות הבאות 🕐', venues: [] }
  }
  return {
    reply: `🔴 ${venues.length} שיעורים מתרחשים עכשיו:`,
    venues: venues as Venue[],
  }
}

async function handleNearby(userCity?: string): Promise<{ reply: string; venues: Venue[] }> {
  if (!userCity) {
    return { reply: 'כדי למצוא חללים קרובים אלייך, לחצי על כפתור המיקום 📍 בראש החלון.', venues: [] }
  }
  const venues = await getVenues({ city: userCity })
  if (!venues.length) {
    return { reply: `לא נמצאו חללים ב${userCity} כרגע. נסי עיר אחרת?`, venues: [] }
  }
  return {
    reply: `📍 ${venues.length} חללים ב${userCity}:`,
    venues: venues.slice(0, 6),
  }
}

async function handleMorning(): Promise<{ reply: string; venues: Venue[] }> {
  const today = new Date().toISOString().split('T')[0]
  const venues = await getVenues({ date: today, startTime: '07:00' })
  if (!venues.length) {
    const allVenues = await getVenues()
    return {
      reply: 'לא נמצאו חללים פנויים לשיעורי בוקר מוקדם. הנה חללים שיכולים להתאים:',
      venues: allVenues.slice(0, 5),
    }
  }
  return {
    reply: `🌅 ${venues.length} חללים זמינים לשיעורי בוקר:`,
    venues: venues.slice(0, 6),
  }
}

async function handleMyHistory(userId: string): Promise<{ reply: string; venues: Venue[] }> {
  const visited = await getRecentlyVisitedVenues(userId, 5)
  if (!visited.length) {
    return { reply: 'עדיין אין לך היסטוריית הזמנות. בואי נמצא לך חלל ראשון! 🌊', venues: [] }
  }
  return {
    reply: `📋 החללים שהזמנת בעבר (${visited.length}):`,
    venues: visited,
  }
}

async function handleRecommendation(userId: string, userCity?: string): Promise<{ reply: string; venues: Venue[] }> {
  const profile = await getUserProfile(userId)
  const city = userCity ?? profile.preferredCity
  const minCap = profile.typicalCapacity ? Math.max(1, Math.round(profile.typicalCapacity * 0.5)) : undefined

  const venues = await getVenues({
    city,
    minCapacity: minCap,
  })

  if (!venues.length) {
    const fallback = await getVenues()
    return {
      reply: 'לא מצאתי חללים שמתאימים בדיוק, אבל אלה ימצאו חן בעינייך:',
      venues: fallback.slice(0, 5),
    }
  }

  const cityNote = city ? ` ב${city}` : ''
  const capNote = minCap ? ` לקבוצה של ${minCap}+ משתתפים` : ''
  return {
    reply: `⭐ המלצות אישיות בשבילייך${cityNote}${capNote}:`,
    venues: venues.slice(0, 5),
  }
}

async function handleSmallGroup(): Promise<{ reply: string; venues: Venue[] }> {
  const venues = await getVenues({ minCapacity: 1, maxPrice: 400 })
  const small = venues.filter(v => v.capacity <= 15).slice(0, 6)
  if (!small.length) {
    return { reply: 'לא נמצאו חללים לקבוצות קטנות כרגע.', venues: [] }
  }
  return {
    reply: `👥 ${small.length} חללים מתאימים לקבוצות קטנות (עד 15 משתתפים):`,
    venues: small,
  }
}

async function handleLargeGroup(): Promise<{ reply: string; venues: Venue[] }> {
  const venues = await getVenues({ minCapacity: 20 })
  if (!venues.length) {
    return { reply: 'לא נמצאו חללים לקבוצות גדולות כרגע. נסי לחפש בלי סינון קיבולת.', venues: [] }
  }
  return {
    reply: `👥👥 ${venues.length} חללים לקבוצות גדולות (20+ משתתפים):`,
    venues: venues.slice(0, 6),
  }
}

async function handleBudget(): Promise<{ reply: string; venues: Venue[] }> {
  const venues = await getVenues({ maxPrice: 250 })
  if (!venues.length) {
    return { reply: 'אין כרגע חללים מתחת ל-₪250 לשעה. הנה האפשרויות הזולות ביותר:',
      venues: (await getVenues()).sort((a, b) => a.hourly_price - b.hourly_price).slice(0, 5) }
  }
  return {
    reply: `💰 ${venues.length} חללים במחיר עד ₪250/שעה:`,
    venues: venues.sort((a, b) => a.hourly_price - b.hourly_price).slice(0, 6),
  }
}

async function handleAll(userCity?: string): Promise<{ reply: string; venues: Venue[] }> {
  const venues = await getVenues({ city: userCity })
  return {
    reply: venues.length
      ? `🌊 הנה כל החללים הזמינים (${venues.length}):`
      : 'לא נמצאו חללים פעילים כרגע.',
    venues: venues.slice(0, 6),
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const message: string = body.message ?? body.messages?.at(-1)?.content ?? ''
  const userCity: string | undefined = body.userCity
  const intentOverride: Intent | undefined = body.intent

  const intent = intentOverride ?? detectIntent(message)

  let result: { reply: string; venues: Venue[] }

  switch (intent) {
    case 'happening_now':
      result = await handleHappeningNow()
      break
    case 'nearby':
      result = await handleNearby(userCity)
      break
    case 'morning':
      result = await handleMorning()
      break
    case 'my_history':
      result = await handleMyHistory(user.id)
      break
    case 'recommendation':
      result = await handleRecommendation(user.id, userCity)
      break
    case 'small_group':
      result = await handleSmallGroup()
      break
    case 'large_group':
      result = await handleLargeGroup()
      break
    case 'budget':
      result = await handleBudget()
      break
    default:
      result = await handleAll(userCity)
  }

  return Response.json(result)
}
