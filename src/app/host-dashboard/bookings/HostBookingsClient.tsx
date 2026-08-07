'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarDays, Users, XCircle, Loader2 } from 'lucide-react'
import { hostCancelBooking } from '@/lib/actions/bookings'
import type { Booking } from '@/lib/supabase/types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתינה',
  confirmed: 'מאושרת',
  cancelled: 'בוטלה',
  completed: 'הושלמה',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200',
  confirmed: 'bg-green-100 text-green-800 ring-1 ring-green-200',
  cancelled: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  completed: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatPrice(amount: number) {
  return `₪${amount.toLocaleString('he-IL')}`
}

function BookingActions({ booking, onUpdate }: {
  booking: Booking
  onUpdate: (id: string, status: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<'cancel' | null>(null)

  // Pending bookings: show info that confirmation is automatic + cancel option
  // Confirmed bookings: cancel only
  if (booking.status !== 'pending' && booking.status !== 'confirmed') return null

  const handleCancel = () => {
    if (!confirm('לבטל את ההזמנה?')) return
    setAction('cancel')
    startTransition(async () => {
      const result = await hostCancelBooking(booking.id)
      if (!result?.error) onUpdate(booking.id, 'cancelled')
      setAction(null)
    })
  }

  return (
    <div className="flex items-center gap-2">
      {booking.status === 'pending' && (
        <span className="text-xs text-gray-400 whitespace-nowrap">ממתין לתשלום</span>
      )}
      {(booking.status === 'pending' || booking.status === 'confirmed') && (
        <Button
          size="sm"
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50 h-8 text-xs px-3"
          onClick={handleCancel}
          disabled={isPending}
        >
          {isPending && action === 'cancel' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <><XCircle className="w-3 h-3 ml-1" />בטל</>
          )}
        </Button>
      )}
    </div>
  )
}

export function HostBookingsClient({ bookings: initialBookings }: { bookings: Booking[] }) {
  const [bookings, setBookings] = useState(initialBookings)

  const handleUpdate = (id: string, newStatus: string) => {
    setBookings(prev =>
      prev.map(b => b.id === id ? { ...b, status: newStatus as Booking['status'] } : b)
    )
  }

  const grouped = {
    pending: bookings.filter(b => b.status === 'pending'),
    confirmed: bookings.filter(b => b.status === 'confirmed'),
    completed: bookings.filter(b => b.status === 'completed'),
    cancelled: bookings.filter(b => b.status === 'cancelled'),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-deep-ocean">הזמנות</h1>
        <p className="text-gray-500 text-sm mt-1">
          {bookings.length > 0 ? `סה"כ ${bookings.length} הזמנות` : 'אין הזמנות עדיין'}
        </p>
      </div>

      {bookings.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(grouped).map(([status, items]) =>
            items.length > 0 ? (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}
              >
                {STATUS_LABELS[status]}
                <span className="font-bold">{items.length}</span>
              </span>
            ) : null
          )}
        </div>
      )}

      {bookings.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">אין הזמנות עדיין</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              הזמנות ממדריכות יופיעו כאן לאחר שהחלל שלך יפורסם
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-0 pt-5 px-6">
            <CardTitle className="text-base font-semibold text-deep-ocean">כל ההזמנות</CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-4">
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    {['מדריכה', 'חלל', 'תאריך', 'שעות', 'משתתפים', 'סטטוס', 'תשלום', 'פעולות'].map(h => (
                      <th key={h} className="text-right text-xs font-medium text-gray-400 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full ocean-gradient flex items-center justify-center flex-shrink-0">
                            <Users className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {(booking.instructor as { full_name?: string } | undefined)?.full_name ?? '—'}
                            </p>
                            {(booking.instructor as { phone?: string } | undefined)?.phone && (
                              <p className="text-xs text-gray-400">
                                {(booking.instructor as { phone?: string }).phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-600 text-xs">
                        {(booking.venue as { title?: string } | undefined)?.title ?? '—'}
                      </td>
                      <td className="px-4 py-4 text-gray-600 whitespace-nowrap text-xs">
                        {formatDate(booking.booking_date)}
                      </td>
                      <td className="px-4 py-4 text-gray-600 whitespace-nowrap text-xs">
                        {booking.start_time.slice(0,5)}–{booking.end_time.slice(0,5)}
                      </td>
                      <td className="px-4 py-4 text-gray-600 text-center text-xs">
                        {booking.participants_count ?? '—'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[booking.status] ?? booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`font-semibold text-sm ${booking.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-green-700'}`}>
                          {formatPrice(booking.host_payout)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <BookingActions booking={booking} onUpdate={handleUpdate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {bookings.map((booking) => (
                <div key={booking.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full ocean-gradient flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {(booking.instructor as { full_name?: string } | undefined)?.full_name ?? '—'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {(booking.venue as { title?: string } | undefined)?.title ?? '—'}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[booking.status] ?? booking.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{formatDate(booking.booking_date)}</span>
                    <span>{booking.start_time.slice(0,5)}–{booking.end_time.slice(0,5)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-sm ${booking.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-green-700'}`}>
                      {formatPrice(booking.host_payout)}
                    </span>
                    <BookingActions booking={booking} onUpdate={handleUpdate} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
