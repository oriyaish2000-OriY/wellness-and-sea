import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getHostBookings } from '@/lib/supabase/queries'
import { HostBookingsClient } from './HostBookingsClient'

export default async function HostBookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')
  if (user.user_metadata?.role !== 'host') redirect('/instructor-dashboard')

  const bookings = await getHostBookings(user.id)

  return <HostBookingsClient bookings={bookings} />
}
