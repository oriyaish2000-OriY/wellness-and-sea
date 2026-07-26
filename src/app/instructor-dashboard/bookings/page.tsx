import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getInstructorBookings } from '@/lib/supabase/queries'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarDays, Search } from 'lucide-react'
import { InstructorBookingsClient } from './InstructorBookingsClient'

export default async function InstructorBookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')
  if (user.user_metadata?.role !== 'instructor') redirect('/host-dashboard')

  const bookings = await getInstructorBookings(user.id)

  if (bookings.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-deep-ocean">ההזמנות שלי</h1>
          <p className="text-gray-500 text-sm mt-1">אין הזמנות עדיין</p>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="py-20 text-center">
            <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">אין הזמנות עדיין</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
              כשתזמיני חלל, ההזמנות שלך יופיעו כאן
            </p>
            <Button className="bg-ocean hover:bg-deep-ocean text-white" asChild>
              <Link href="/venues">
                <Search className="w-4 h-4 ml-1" />
                חפשי חלל
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-deep-ocean">ההזמנות שלי</h1>
        <p className="text-gray-500 text-sm mt-1">סה&quot;כ {bookings.length} הזמנות</p>
      </div>
      <InstructorBookingsClient bookings={bookings} />
    </div>
  )
}
