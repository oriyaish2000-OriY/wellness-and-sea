'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Shield, Loader2 } from 'lucide-react'
import { createPendingBooking } from '@/lib/actions/bookings'

const CLASS_TYPES = [
  'יוגה',
  'פילאטיס',
  'מדיטציה',
  'כושר פונקציונלי',
  'ריקוד',
  'אימון קבוצתי',
  'אחר',
]

interface Props {
  venueId: string
  date: string
  startTime: string
  endTime: string
  capacity: number
}

export function BookingForm({ venueId, date, startTime, endTime, capacity }: Props) {
  const [state, action, isPending] = useActionState(createPendingBooking, null)

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="venue_id" value={venueId} />
      <input type="hidden" name="booking_date" value={date} />
      <input type="hidden" name="start_time" value={startTime} />
      <input type="hidden" name="end_time" value={endTime} />

      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 text-right">
          {state.error}
        </div>
      )}

      {/* Class type */}
      <div>
        <Label htmlFor="class_type" className="text-sm font-semibold text-deep-ocean">
          סוג השיעור
        </Label>
        <select
          id="class_type"
          name="class_type"
          required
          disabled={isPending}
          className="w-full mt-1.5 p-3 text-sm rounded-lg outline-none"
          style={{ border: '1.5px solid #f0e6d3', background: '#faf5ee', direction: 'rtl' }}
        >
          <option value="">בחרי סוג שיעור...</option>
          {CLASS_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Participants */}
      <div>
        <Label htmlFor="participants_count" className="text-sm font-semibold text-deep-ocean">
          מספר משתתפים משוער
        </Label>
        <div className="relative mt-1.5">
          <Users className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
          <Input
            id="participants_count"
            name="participants_count"
            type="number"
            min={1}
            max={capacity}
            placeholder={`עד ${capacity} משתתפים`}
            disabled={isPending}
            className="pr-9 text-right"
            style={{ background: '#faf5ee', border: '1.5px solid #f0e6d3' }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">קיבולת מרבית של החלל: {capacity} אנשים</p>
      </div>

      {/* Special requests */}
      <div>
        <Label htmlFor="special_requests" className="text-sm font-semibold text-deep-ocean">
          בקשות מיוחדות (אופציונלי)
        </Label>
        <textarea
          id="special_requests"
          name="special_requests"
          rows={3}
          disabled={isPending}
          placeholder="לדוגמה: נדרש מיזוג, גישה לחשמל, חניה..."
          className="w-full mt-1.5 p-3 text-sm rounded-lg resize-none outline-none text-right"
          style={{ border: '1.5px solid #f0e6d3', background: '#faf5ee' }}
        />
      </div>

      {/* Trust signal */}
      <div
        className="flex items-start gap-2.5 p-3.5 rounded-xl text-xs"
        style={{ background: 'rgba(92,140,110,0.08)', color: '#1a5c3a' }}
      >
        <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          לא תחויבי עד לאישור תשלום. ניתן לבטל ולקבל החזר מלא עד 24 שעות לפני מועד השיעור.
        </span>
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full text-white font-bold text-base"
        style={{
          height: 52,
          borderRadius: 50,
          background: 'linear-gradient(135deg, #c8944a, #e8b870)',
          border: 'none',
        }}
      >
        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'המשך לתשלום ←'}
      </Button>
    </form>
  )
}
