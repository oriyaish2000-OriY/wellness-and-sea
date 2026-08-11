'use client'

import { useState } from 'react'
import { markVendorPayoutPaid } from './actions'

interface BookingPayout {
  id: string
  booking_date: string
  start_time: string
  end_time: string
  total_price: number
  host_payout: number
  platform_fee: number
  vendor_sumit_company_id: number | null
  tranzila_transaction_id: string | null
  confirmed_at: string | null
  created_at: string
  venue: { id: string; title: string; location_city: string } | null
  instructor: { id: string; full_name: string } | null
}

interface EnrollmentPayout {
  id: string
  amount_paid: number
  vendor_sumit_company_id: number | null
  tranzila_transaction_id: string | null
  created_at: string
  class: {
    id: string
    title: string
    instructor: { id: string; full_name: string } | null
  } | null
  student: { id: string; full_name: string } | null
}

interface Summary {
  total_pending_bookings: number
  total_pending_enrollments: number
  total_amount_ils: number
}

interface Props {
  summary:     Summary
  bookings:    BookingPayout[]
  enrollments: EnrollmentPayout[]
}

function formatILS(amount: number) {
  return `₪${amount.toLocaleString('he-IL')}`
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export function PayoutsClient({ summary, bookings, enrollments }: Props) {
  const [localBookings, setLocalBookings]       = useState(bookings)
  const [localEnrollments, setLocalEnrollments] = useState(enrollments)
  const [markingId, setMarkingId]               = useState<string | null>(null)
  const [noteInputs, setNoteInputs]             = useState<Record<string, string>>({})
  const [errors, setErrors]                     = useState<Record<string, string>>({})

  const totalPending = localBookings.length + localEnrollments.length
  // Commission owed TO platform FROM vendor (platform_fee for bookings, 10% of base for enrollments)
  const totalAmount  = localBookings.reduce(
    (s, b) => s + (b.platform_fee ?? ((b.total_price ?? 0) - (b.host_payout ?? 0))), 0
  ) + localEnrollments.reduce(
    (s, e) => s + Math.round((e.amount_paid ?? 0) * (10 / 105)), 0
  )

  async function markPaid(entityType: 'booking' | 'enrollment', entityId: string) {
    setMarkingId(entityId)
    setErrors(prev => ({ ...prev, [entityId]: '' }))

    try {
      // Server action — ADMIN_SECRET stays server-side, never in browser
      const result = await markVendorPayoutPaid(entityType, entityId, noteInputs[entityId] ?? '')

      if (result.error) {
        setErrors(prev => ({ ...prev, [entityId]: result.error ?? 'שגיאה' }))
        return
      }

      // Remove from list on success
      if (entityType === 'booking') {
        setLocalBookings(prev => prev.filter(b => b.id !== entityId))
      } else {
        setLocalEnrollments(prev => prev.filter(e => e.id !== entityId))
      }
    } catch {
      setErrors(prev => ({ ...prev, [entityId]: 'שגיאת רשת' }))
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">גביית עמלות מספקים</h1>
        <p className="text-sm text-gray-500 mt-1">
          הכסף עבר ישירות לחשבון SUMIT של הספק. להלן עמלות הפלטפורמה שעדיין לא נגבו.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm text-center">
          <div className="text-3xl font-bold text-gray-900">{totalPending}</div>
          <div className="text-sm text-gray-500 mt-1">עמלות ממתינות</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm text-center">
          <div className="text-3xl font-bold text-orange-600">{formatILS(totalAmount)}</div>
          <div className="text-sm text-gray-500 mt-1">סה״כ עמלות לגבייה</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm text-center">
          <div className="text-3xl font-bold text-green-600">
            {formatILS(summary.total_amount_ils - totalAmount)}
          </div>
          <div className="text-sm text-gray-500 mt-1">נגבו (סה״כ)</div>
        </div>
      </div>

      {totalPending === 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center text-green-800 font-medium">
          ✓ אין עמלות ממתינות — כל הספקים שילמו
        </div>
      )}

      {/* Space rental bookings */}
      {localBookings.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            השכרת חללים ({localBookings.length})
          </h2>
          <div className="space-y-3">
            {localBookings.map(b => {
              // Commission = what platform is owed from host (total - host_net)
              const commission = b.platform_fee ?? ((b.total_price ?? 0) - (b.host_payout ?? 0))
              return (
                <div key={b.id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {b.venue?.title ?? 'חלל לא ידוע'} — {b.venue?.location_city ?? ''}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {b.booking_date} | {b.start_time}–{b.end_time} | מדריכה: {b.instructor?.full_name ?? '—'}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        אומת: {formatDate(b.confirmed_at)} | סה״כ: {formatILS(b.total_price)} | מארח מקבל: {formatILS(b.host_payout)}
                        {b.vendor_sumit_company_id && (
                          <span className="mr-2"> | SUMIT: {b.vendor_sumit_company_id}</span>
                        )}
                      </div>
                      {errors[b.id] && (
                        <div className="text-xs text-red-600 mt-1">{errors[b.id]}</div>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-left">
                      <div className="text-lg font-bold text-orange-600">{formatILS(commission)}</div>
                      <div className="text-xs text-gray-400">עמלת פלטפורמה</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="מספר אסמכתא (אופציונלי)"
                      value={noteInputs[b.id] ?? ''}
                      onChange={e => setNoteInputs(prev => ({ ...prev, [b.id]: e.target.value }))}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => markPaid('booking', b.id)}
                      disabled={markingId === b.id}
                      className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {markingId === b.id ? 'מעדכן…' : '✓ עמלה נגבתה'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Class enrollment payouts */}
      {localEnrollments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            הרשמות לשיעורים ({localEnrollments.length})
          </h2>
          <div className="space-y-3">
            {localEnrollments.map(e => {
              const vendorAmount = Math.floor((e.amount_paid ?? 0) * 0.95)
              const cls = e.class
              return (
                <div key={e.id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {cls?.title ?? 'שיעור לא ידוע'}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        מדריכה: {cls?.instructor?.full_name ?? '—'} | תלמידה: {e.student?.full_name ?? '—'}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        נוצר: {formatDate(e.created_at)} | ID: {e.id.slice(0, 8)}…
                        {e.vendor_sumit_company_id && (
                          <span className="mr-2">| SUMIT: {e.vendor_sumit_company_id}</span>
                        )}
                      </div>
                      {errors[e.id] && (
                        <div className="text-xs text-red-600 mt-1">{errors[e.id]}</div>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-left">
                      <div className="text-lg font-bold text-gray-900">{formatILS(vendorAmount)}</div>
                      <div className="text-xs text-gray-400">מתוך {formatILS(e.amount_paid ?? 0)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="מספר אסמכתא (אופציונלי)"
                      value={noteInputs[e.id] ?? ''}
                      onChange={el => setNoteInputs(prev => ({ ...prev, [e.id]: el.target.value }))}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => markPaid('enrollment', e.id)}
                      disabled={markingId === e.id}
                      className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {markingId === e.id ? 'מעדכן…' : '✓ עמלה נגבתה'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="border-t pt-4 text-xs text-gray-400 text-center">
        הכסף עובר ישירות לחשבון SUMIT של הספק. הפלטפורמה גובה עמלה נפרדת מכל ספק.
        לאחר גביית העמלה (בנק/Bit/PayBox), סמן כנגבה עם מספר אסמכתא.
      </div>
    </div>
  )
}
