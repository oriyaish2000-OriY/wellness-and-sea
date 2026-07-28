'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { generateTimeSlots } from '@/lib/booking-engine'
import { Venue } from '@/lib/supabase/types'
import { Lightbulb, Users, Maximize2, Shield, Clock } from 'lucide-react'

function getRecommendedHours(spaceSizeSqm?: number, capacity?: number): {
  hours: number; label: string; reason: string
} {
  const sqm = spaceSizeSqm ?? 0
  const cap = capacity ?? 0
  if (sqm > 80 || cap > 20) return { hours: 2,   label: '2 שעות',  reason: `חלל גדול (${sqm > 0 ? sqm + ' מ"ר' : cap + ' משתתפים'}) — אידיאלי לשיעורים ארוכים` }
  if (sqm >= 50 || cap >= 10) return { hours: 1.5, label: '1.5 שעות', reason: `חלל בינוני — הזמן המומלץ לשיעור מאוזן` }
  return { hours: 1, label: 'שעה אחת', reason: `חלל קטן — אינטנסיבי לקבוצות קטנות` }
}

const TIDE_HOURS = [
  { time: '07:00', label: 'שקיעת ירח', emoji: '🌙' },
  { time: '08:00', label: 'זריחה', emoji: '🌅' },
  { time: '09:00', label: 'גאות בוקר', emoji: '🌊' },
  { time: '10:00', label: 'שמש מלאה', emoji: '☀️' },
  { time: '11:00', label: 'אמצע היום', emoji: '🌤️' },
  { time: '12:00', label: 'צהריים', emoji: '🏖️' },
]

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
    { value: 1,   label: 'שעה' },
    { value: 1.5, label: '1.5 שעות' },
    { value: 2,   label: '2 שעות' },
  ]

  const getTideLabel = (startTime: string) => {
    return TIDE_HOURS.find(t => t.time === startTime)
  }

  return (
    <div
      className="overflow-hidden"
      style={{ borderRadius: 'var(--radius)', boxShadow: '0 8px 40px rgba(10,74,74,0.15)', background: 'white' }}
    >
      {/* ── Header gradient ── */}
      <div
        className="p-6 text-center"
        style={{ background: 'linear-gradient(145deg, #0a4a4a 0%, #0d6e6e 100%)' }}
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.60)' }}>מחיר לשעה</p>
        <div className="flex items-baseline justify-center gap-1">
          <span className="font-black text-white" style={{ fontSize: 38 }}>₪{venue.hourly_price}</span>
          <span style={{ color: 'rgba(255,255,255,0.60)', fontSize: 14 }}> / שעה</span>
        </div>

        {/* Quick stats */}
        <div className="flex justify-center gap-4 mt-3">
          {venue.capacity > 0 && (
            <div className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>
              <Users className="w-3.5 h-3.5" />
              עד {venue.capacity} משתתפים
            </div>
          )}
          {venue.space_size_sqm && (
            <div className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>
              <Maximize2 className="w-3.5 h-3.5" />
              {venue.space_size_sqm} מ&quot;ר
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-5 space-y-5">
        {/* Smart recommendation */}
        <div
          className="flex gap-2.5 p-3.5 rounded-xl"
          style={{ background: 'rgba(200,148,74,0.08)', border: '1px solid rgba(200,148,74,0.25)' }}
        >
          <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#c8944a' }} />
          <div>
            <p className="text-xs font-bold mb-0.5" style={{ color: '#c8944a' }}>
              המלצת הפלטפורמה: {recommended.label}
            </p>
            <p className="text-xs leading-snug text-gray-500">{recommended.reason}</p>
          </div>
        </div>

        {/* Duration selector */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-2.5" style={{ color: '#0a4a4a' }}>
            משך השיעור
          </label>
          <div className="flex gap-2">
            {durationOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setSelectedDuration(opt.value); setSelectedSlot(null) }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  border: selectedDuration === opt.value ? '2px solid #0d6e6e' : '1.5px solid #f0e6d3',
                  background: selectedDuration === opt.value ? '#0d6e6e' : '#faf5ee',
                  color: selectedDuration === opt.value ? 'white' : '#6b7c7c',
                }}
              >
                {opt.label}
                {opt.value === recommended.hours && (
                  <span className="block text-[9px] mt-0.5 opacity-70">מומלץ</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Date picker */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: '#0a4a4a' }}>
            תאריך האימון
          </label>
          <input
            type="date"
            value={selectedDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={e => { setSelectedDate(e.target.value); setSelectedSlot(null) }}
            className="w-full p-3 text-sm outline-none"
            style={{
              border: '1.5px solid #f0e6d3',
              borderRadius: 10,
              background: '#faf5ee',
              direction: 'rtl',
            }}
          />
        </div>

        {/* Time slots — "tide" style */}
        {selectedDate && (
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-2.5" style={{ color: '#0a4a4a' }}>
              🌊 שעות גאות פנויות
            </label>
            <div className="grid grid-cols-2 gap-2">
              {timeSlots.map(slot => {
                const tide = getTideLabel(slot.start)
                const isSelected = selectedSlot?.start === slot.start
                const isAvailable = slot.available
                return (
                  <button
                    key={slot.start}
                    disabled={!isAvailable}
                    onClick={() => setSelectedSlot(isAvailable ? { start: slot.start, end: slot.end } : null)}
                    className="text-xs p-2.5 rounded-xl transition-all text-right"
                    style={{
                      border: isSelected
                        ? '2px solid #0d6e6e'
                        : isAvailable ? '1.5px solid #f0e6d3' : '1.5px solid #f0e6d3',
                      background: isSelected ? '#0d6e6e' : isAvailable ? 'white' : '#faf5ee',
                      color: isSelected ? 'white' : isAvailable ? '#1a2a2a' : '#d4c5a9',
                      opacity: isAvailable ? 1 : 0.4,
                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <div className="font-bold">{slot.start} – {slot.end}</div>
                    {tide && (
                      <div className="mt-0.5" style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : '#6b7c7c', fontSize: 10 }}>
                        {tide.emoji} {tide.label}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Price summary */}
        {selectedSlot && (
          <div className="rounded-xl p-4 space-y-2" style={{ background: '#faf5ee' }}>
            <div className="flex justify-between text-sm text-gray-500">
              <span>
                ₪{venue.hourly_price} ×{' '}
                {selectedDuration === 1 ? 'שעה' : selectedDuration === 1.5 ? '1.5 שעות' : '2 שעות'}
              </span>
              <span>₪{totalPrice}</span>
            </div>
            <div
              className="flex justify-between font-black text-base pt-2"
              style={{ borderTop: '1px solid #f0e6d3', color: '#0a4a4a' }}
            >
              <span>סה&quot;כ לתשלום</span>
              <span>₪{totalPrice}</span>
            </div>
          </div>
        )}

        {/* CTA */}
        <Button
          className="w-full font-bold text-base text-white transition-all"
          style={{
            height: 52,
            borderRadius: 50,
            background: selectedSlot ? 'linear-gradient(135deg, #c8944a, #e8b870)' : '#d4c5a9',
            cursor: selectedSlot ? 'pointer' : 'not-allowed',
            border: 'none',
          }}
          disabled={!selectedSlot}
          asChild={!!selectedSlot}
        >
          {selectedSlot ? (
            <Link href={`/booking/${venue.id}?date=${selectedDate}&start=${selectedSlot.start}&end=${selectedSlot.end}`}>
              המשך להזמנה ←
            </Link>
          ) : (
            <span>{selectedDate ? 'בחרי שעה' : 'בחרי תאריך ושעה'}</span>
          )}
        </Button>

        {/* Trust signals */}
        <div className="flex flex-col gap-2 text-xs" style={{ color: '#6b7c7c' }}>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#5c8c6e' }} />
            <span>לא חויבת עדיין — אישור נדרש</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#5c8c6e' }} />
            <span>ביטול חינם עד 24 שעות לפני</span>
          </div>
        </div>
      </div>
    </div>
  )
}
