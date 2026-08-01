'use client'

import { useState, useTransition, useActionState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cancelBooking } from '@/lib/actions/bookings'
import { requestRefund } from '@/lib/actions/refunds'
import { openClassToStudents, closeClassToStudents } from '@/lib/actions/classes'
import { CalendarDays, Clock, Users, MapPin, Loader2, Star, RotateCcw, GraduationCap, X } from 'lucide-react'
import type { Booking } from '@/lib/supabase/types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתינה לאישור',
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
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

type ExtendedBooking = Booking & { open_to_students?: boolean; max_students?: number | null; price_per_student?: number | null }

function OpenClassPanel({ booking }: { booking: ExtendedBooking }) {
  const [openPanel, setOpenPanel] = useState(false)
  const [closePending, startCloseTransition] = useTransition()
  const [state, formAction, isPending] = useActionState(openClassToStudents, null)

  if (booking.open_to_students) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <GraduationCap className="w-4 h-4" />
            <span className="font-semibold">פתוח לתלמידות</span>
            {booking.price_per_student != null && (
              <span className="text-xs text-gray-500">· ₪{booking.price_per_student} לשיעור</span>
            )}
            {booking.max_students != null && (
              <span className="text-xs text-gray-500">· עד {booking.max_students}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!confirm('לסגור את ההרשמה לתלמידות?')) return
              startCloseTransition(() => { void closeClassToStudents(booking.id) })
            }}
            disabled={closePending}
            className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
          >
            {closePending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            סגרי
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {!openPanel ? (
        <button
          type="button"
          onClick={() => setOpenPanel(true)}
          className="flex items-center gap-1.5 text-sm font-semibold text-ocean hover:underline"
        >
          <GraduationCap className="w-4 h-4" />
          פתחי לתלמידות
        </button>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="booking_id" value={booking.id} />
          <p className="text-xs font-semibold text-gray-700">פתחי את השיעור להרשמת תלמידות:</p>
          {state?.error && (
            <p className="text-xs text-red-600 bg-red-50 rounded p-2">{state.error}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">מחיר לתלמידה (₪)</label>
              <Input
                name="price_per_student"
                type="number"
                min={0}
                placeholder="80"
                required
                className="text-sm h-9"
                style={{ background: '#faf5ee', border: '1.5px solid #f0e6d3' }}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">מקסימום תלמידות</label>
              <Input
                name="max_students"
                type="number"
                min={1}
                max={100}
                placeholder="15"
                required
                className="text-sm h-9"
                style={{ background: '#faf5ee', border: '1.5px solid #f0e6d3' }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">התשלום יבוצע ישירות אלייך (Bit / PayBox) על פי פרטי התשלום בפרופיל שלך.</p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending} className="bg-ocean text-white text-xs h-8 px-3">
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'פרסמי שיעור'}
            </Button>
            <button type="button" onClick={() => setOpenPanel(false)} className="text-xs text-gray-400 hover:text-gray-600">
              ביטול
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function BookingCard({
  booking,
  onUpdate,
}: {
  booking: ExtendedBooking
  onUpdate: (id: string, status: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<'cancel' | 'refund' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const venue = booking.venue as { title?: string; location_city?: string; id?: string } | undefined

  const hoursUntilBooking = booking.booking_date
    ? (new Date(`${booking.booking_date}T${booking.start_time}`).getTime() - Date.now()) / 3600000
    : 0

  const canCancel = booking.status === 'pending'
  const canRefund = booking.status === 'confirmed' && hoursUntilBooking > 24
  const canReview = booking.status === 'completed'

  const handleCancel = () => {
    if (!confirm('לבטל את ההזמנה?')) return
    setAction('cancel')
    startTransition(async () => {
      const result = await cancelBooking(booking.id)
      if (!result?.error) onUpdate(booking.id, 'cancelled')
      setAction(null)
    })
  }

  const handleRefund = () => {
    const reason = prompt('סיבת הביטול (תופיע במייל לבעל המקום):') ?? 'ביטול מדריכה'
    if (reason === null) return
    setAction('refund')
    startTransition(async () => {
      const result = await requestRefund(booking.id, reason)
      if (result?.error) {
        setMessage(result.error)
      } else {
        onUpdate(booking.id, 'cancelled')
        setMessage(result.message ?? 'ההזמנה בוטלה')
      }
      setAction(null)
    })
  }

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{venue?.title ?? 'חלל'}</h3>
            {venue?.location_city && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                {venue.location_city}
              </p>
            )}
          </div>
          <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-gray-700'}`}>
            {STATUS_LABELS[booking.status] ?? booking.status}
          </span>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-ocean flex-shrink-0" />
            <span>{formatDate(booking.booking_date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-ocean flex-shrink-0" />
            <span>{booking.start_time.slice(0,5)}–{booking.end_time.slice(0,5)}</span>
            {booking.class_type && <span className="text-gray-400">· {booking.class_type}</span>}
          </div>
          {booking.participants_count && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-ocean flex-shrink-0" />
              <span>{booking.participants_count} משתתפים</span>
            </div>
          )}
        </div>

        {message && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">{message}</p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2 flex-wrap">
          <span className="font-bold text-ocean text-lg">
            ₪{booking.total_price.toLocaleString('he-IL')}
          </span>
          <div className="flex items-center gap-2">
            {canCancel && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs text-red-600 border-red-200 hover:bg-red-50 h-8 px-3"
                onClick={handleCancel}
                disabled={isPending}
              >
                {isPending && action === 'cancel' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ביטול'}
              </Button>
            )}
            {canRefund && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs text-orange-600 border-orange-200 hover:bg-orange-50 h-8 px-3"
                onClick={handleRefund}
                disabled={isPending}
              >
                {isPending && action === 'refund' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <><RotateCcw className="w-3 h-3 ml-1" />ביטול + החזר</>
                )}
              </Button>
            )}
            {canReview && venue?.id && (
              <Button size="sm" variant="outline" className="text-xs h-8 px-3 border-ocean text-ocean" asChild>
                <Link href={`/venues/${venue.id}`}>
                  <Star className="w-3 h-3 ml-1" />
                  כתוב ביקורת
                </Link>
              </Button>
            )}
            {booking.status === 'confirmed' && (
              <Button size="sm" className="text-xs h-8 px-3 bg-ocean text-white" asChild>
                <Link href={`/booking/confirm/${booking.id}`}>
                  הצהרות בריאות
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Open to students — for confirmed bookings only */}
        {booking.status === 'confirmed' && (
          <OpenClassPanel booking={booking} />
        )}
      </CardContent>
    </Card>
  )
}

export function InstructorBookingsClient({ bookings: initialBookings }: { bookings: ExtendedBooking[] }) {
  const [bookings, setBookings] = useState(initialBookings)

  const handleUpdate = (id: string, newStatus: string) => {
    setBookings(prev =>
      prev.map(b => b.id === id ? { ...b, status: newStatus as Booking['status'] } : b)
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const upcoming = bookings.filter(b => b.booking_date >= today && b.status !== 'cancelled')
  const past = bookings.filter(b => b.booking_date < today || b.status === 'cancelled' || b.status === 'completed')

  return (
    <>
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700">הזמנות קרובות</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map(b => <BookingCard key={b.id} booking={b} onUpdate={handleUpdate} />)}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700">הזמנות עבר</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {past.map(b => <BookingCard key={b.id} booking={b} onUpdate={handleUpdate} />)}
          </div>
        </section>
      )}
    </>
  )
}
