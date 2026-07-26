'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { generateTimeSlots } from '@/lib/booking-engine'
import { Venue } from '@/lib/supabase/types'
import { Lightbulb, Users, Maximize2 } from 'lucide-react'

// ─── Recommended rental duration based on venue size + capacity ──────────────
function getRecommendedHours(spaceSizeSqm?: number, capacity?: number): {
  hours: number
  label: string
  reason: string
} {
  const sqm = spaceSizeSqm ?? 0
  const cap = capacity ?? 0

  // Combined score: size takes precedence, capacity as tiebreaker
  if (sqm > 80 || cap > 20) {
    return {
      hours: 2,
      label: '2 שעות',
      reason: `חלל גדול (${sqm > 0 ? sqm + ' מ"ר' : cap + ' משתתפים'}) — אידיאלי לשיעורים ארוכים עם קבוצות גדולות`,
    }
  }
  if (sqm >= 50 || cap >= 10) {
    return {
      hours: 1.5,
      label: '1.5 שעות',
      reason: `חלל בינוני (${sqm > 0 ? sqm + ' מ"ר' : cap + ' משתתפים'}) — הזמן המומלץ לשיעור מאוזן`,
    }
  }
  return {
    hours: 1,
    label: 'שעה אחת',
    reason: `חלל קטן (${sqm > 0 ? sqm + ' מ"ר' : cap + ' משתתפים'}) — מתאים לשיעורים אינטנסיביים וקבוצות קטנות`,
  }
}

export function BookingWidget({ venue }: { venue: Venue }) {
  const recommended = getRecommendedHours(venue.space_size_sqm, venue.capacity)

  const [selectedDate, setSelectedDate] = useState('')
  const [selectedDuration, setSelectedDuration] = useState(recommended.hours)
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null)

  const timeSlots = selectedDate
    ? generateTimeSlots('07:00', '13:00', [], selectedDuration)
    : []

  const totalPrice = selectedSlot ? venue.hourly_price * selectedDuration : 0

  const durationOptions = [
    { value: 1, label: 'שעה' },
    { value: 1.5, label: '1.5 שעות' },
    { value: 2, label: '2 שעות' },
  ]

  return (
    <Card className="p-6 border-0 shadow-xl">
      <div className="text-center mb-4">
        <span className="text-3xl font-bold text-ocean">₪{venue.hourly_price}</span>
        <span className="text-gray-400 text-sm"> / שעה</span>
      </div>

      <div className="space-y-4">
        {/* Recommended hours smart banner */}
        <div className="bg-ocean/5 border border-ocean/15 rounded-xl p-3 flex gap-2.5">
          <Lightbulb className="w-4 h-4 text-ocean flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-ocean mb-0.5">
              המלצת הפלטפורמה: {recommended.label}
            </p>
            <p className="text-xs text-gray-500 leading-snug">{recommended.reason}</p>
          </div>
        </div>

        {/* Venue quick stats */}
        <div className="flex gap-3 text-xs text-gray-500">
          {venue.capacity > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-ocean" />
              עד {venue.capacity} משתתפים
            </span>
          )}
          {venue.space_size_sqm && (
            <span className="flex items-center gap-1">
              <Maximize2 className="w-3.5 h-3.5 text-ocean" />
              {venue.space_size_sqm} מ&quot;ר
            </span>
          )}
        </div>

        {/* Duration selector */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            משך השיעור
          </label>
          <div className="flex gap-2">
            {durationOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setSelectedDuration(opt.value)
                  setSelectedSlot(null)
                }}
                className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                  selectedDuration === opt.value
                    ? 'bg-ocean text-white border-ocean'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-ocean hover:text-ocean'
                }`}
              >
                {opt.label}
                {opt.value === recommended.hours && (
                  <span className="block text-[9px] opacity-70">מומלץ</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Date picker */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            תאריך האימון
          </label>
          <input
            type="date"
            value={selectedDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => {
              setSelectedDate(e.target.value)
              setSelectedSlot(null)
            }}
            className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-ocean"
          />
        </div>

        {selectedDate && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              שעות פנויות
            </label>
            <div className="grid grid-cols-2 gap-2">
              {timeSlots.map((slot) => (
                <button
                  key={slot.start}
                  disabled={!slot.available}
                  onClick={() => setSelectedSlot(slot.available ? { start: slot.start, end: slot.end } : null)}
                  className={`text-xs p-2 rounded-lg border transition-all ${
                    !slot.available
                      ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                      : selectedSlot?.start === slot.start
                      ? 'bg-ocean text-white border-ocean'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-ocean hover:text-ocean'
                  }`}
                >
                  {slot.start} – {slot.end}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedSlot && (
          <div className="bg-cream rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>
                שכ&quot;ד חלל ({selectedDuration === 1 ? 'שעה' : selectedDuration === 1.5 ? '1.5 שעות' : '2 שעות'})
              </span>
              <span>₪{totalPrice}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-800 pt-1 border-t border-sand">
              <span>סה&quot;כ לתשלום</span>
              <span>₪{totalPrice}</span>
            </div>
          </div>
        )}

        <Button
          className="w-full bg-coral hover:bg-coral/90 text-white h-12 text-base"
          disabled={!selectedSlot}
          asChild={!!selectedSlot}
        >
          {selectedSlot ? (
            <Link href={`/booking/${venue.id}?date=${selectedDate}&start=${selectedSlot.start}&end=${selectedSlot.end}`}>
              המשך להזמנה
            </Link>
          ) : (
            <span>בחרי תאריך ושעה</span>
          )}
        </Button>

        <p className="text-center text-xs text-gray-400">
          לא חויבת עדיין. ניתן לבטל עד 24 שעות לפני
        </p>
      </div>
    </Card>
  )
}
