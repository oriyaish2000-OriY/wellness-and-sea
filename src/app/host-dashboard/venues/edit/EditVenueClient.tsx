'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { updateVenue } from '@/lib/actions/venues'
import { AMENITY_OPTIONS, ISRAELI_CITIES, DAYS } from '@/lib/constants'
import type { Venue } from '@/lib/supabase/types'

interface Props {
  venue: Venue & { availabilities?: Array<{ day_of_week: number; start_time: string; end_time: string }> }
}

export function EditVenueClient({ venue }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Derive initial availability from first slot (or defaults)
  const firstAvail = venue.availabilities?.[0]
  const initialDays = venue.availabilities?.map(a => a.day_of_week) ?? [0, 1, 2, 3, 4]
  const uniqueInitialDays = [...new Set(initialDays)]

  const [form, setForm] = useState({
    title: venue.title,
    description: venue.description,
    location_address: venue.location_address,
    location_city: venue.location_city,
    hourly_price: venue.hourly_price,
    capacity: venue.capacity,
    space_size_sqm: venue.space_size_sqm ?? 60,
    bonus_offer: venue.bonus_offer ?? '',
    accessibility_info: venue.accessibility_info ?? '',
    avail_start: firstAvail?.start_time ?? '07:00',
    avail_end: firstAvail?.end_time ?? '12:00',
  })
  const [amenities, setAmenities] = useState<Record<string, boolean>>(venue.amenities ?? {})
  const [availableDays, setAvailableDays] = useState<number[]>(uniqueInitialDays)

  const toggleAmenity = (key: string) => setAmenities(prev => ({ ...prev, [key]: !prev[key] }))
  const toggleDay = (day: number) =>
    setAvailableDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])

  const handleSubmit = () => {
    if (!form.title.trim()) { setError('יש למלא את שם המקום'); return }
    if (!form.location_address.trim()) { setError('יש למלא כתובת'); return }
    if (availableDays.length === 0) { setError('יש לבחור לפחות יום זמינות אחד'); return }
    if (!Object.values(amenities).some(Boolean)) { setError('יש לסמן לפחות מתקן אחד'); return }
    setError(null)

    const formData = new FormData()
    formData.set('title', form.title)
    formData.set('description', form.description)
    formData.set('location_address', form.location_address)
    formData.set('location_city', form.location_city)
    formData.set('hourly_price', String(form.hourly_price))
    formData.set('capacity', String(form.capacity))
    formData.set('space_size_sqm', String(form.space_size_sqm))
    formData.set('bonus_offer', form.bonus_offer)
    formData.set('accessibility_info', form.accessibility_info)
    formData.set('amenities', JSON.stringify(amenities))
    formData.set('images', JSON.stringify(venue.images ?? []))
    formData.set(
      'availabilities',
      JSON.stringify(
        availableDays.map(day => ({
          day_of_week: day,
          start_time: form.avail_start,
          end_time: form.avail_end,
        }))
      )
    )

    startTransition(async () => {
      const result = await updateVenue(venue.id, formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => router.push('/host-dashboard/venues'), 1500)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-deep-ocean">עריכת החלל</h1>
        <p className="text-gray-500 text-sm mt-1">{venue.title}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          השינויים נשמרו בהצלחה! מעביר אותך חזרה...
        </div>
      )}

      {/* Basic info */}
      <Card className="p-6 border-0 shadow-md space-y-4">
        <h2 className="font-semibold text-deep-ocean">פרטי המקום</h2>

        <div>
          <Label>שם המקום *</Label>
          <Input
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="mt-1 text-right"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>כתובת *</Label>
            <Input
              value={form.location_address}
              onChange={e => setForm(p => ({ ...p, location_address: e.target.value }))}
              className="mt-1 text-right"
            />
          </div>
          <div>
            <Label>עיר *</Label>
            <select
              value={form.location_city}
              onChange={e => setForm(p => ({ ...p, location_city: e.target.value }))}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-right"
            >
              {ISRAELI_CITIES.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label>תיאור החלל *</Label>
          <Textarea
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="mt-1 text-right min-h-[100px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>קיבולת מקסימלית</Label>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, capacity: Math.max(5, p.capacity - 5) }))}
                className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-50 text-lg font-bold"
              >
                –
              </button>
              <span className="font-bold text-ocean w-10 text-center">{form.capacity}</span>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, capacity: Math.min(200, p.capacity + 5) }))}
                className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-50 text-lg font-bold"
              >
                +
              </button>
            </div>
          </div>
          <div>
            <Label>גודל (מ&quot;ר)</Label>
            <Input
              type="number"
              value={form.space_size_sqm}
              onChange={e => setForm(p => ({ ...p, space_size_sqm: Number(e.target.value) }))}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label>מידע נגישות (אופציונלי)</Label>
          <Input
            value={form.accessibility_info}
            onChange={e => setForm(p => ({ ...p, accessibility_info: e.target.value }))}
            className="mt-1 text-right"
          />
        </div>
      </Card>

      {/* Amenities */}
      <Card className="p-6 border-0 shadow-md space-y-4">
        <h2 className="font-semibold text-deep-ocean">מה כלול במקום? *</h2>
        <div className="grid grid-cols-2 gap-2">
          {AMENITY_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.key}
              onClick={() => toggleAmenity(option.key)}
              className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-right ${
                amenities[option.key]
                  ? 'border-ocean bg-ocean/5 text-ocean'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <span>{option.icon}</span>
              <span className="text-sm font-medium">{option.label}</span>
              {amenities[option.key] && <Check className="w-4 h-4 mr-auto" />}
            </button>
          ))}
        </div>

        <div>
          <Label>בונוס לשוכרים (אופציונלי)</Label>
          <Input
            placeholder='לדוגמה: "קפה בוקר חינמי לכל המשתתפים"'
            value={form.bonus_offer}
            onChange={e => setForm(p => ({ ...p, bonus_offer: e.target.value }))}
            className="mt-1 text-right"
          />
        </div>
      </Card>

      {/* Availability & pricing */}
      <Card className="p-6 border-0 shadow-md space-y-5">
        <h2 className="font-semibold text-deep-ocean">שעות זמינות ומחיר</h2>

        <div>
          <Label className="mb-2 block">ימים פנויים להשכרה *</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day, i) => (
              <button
                type="button"
                key={i}
                onClick={() => toggleDay(i)}
                className={`px-3 py-1.5 rounded-full text-sm border-2 transition-all ${
                  availableDays.includes(i)
                    ? 'border-ocean bg-ocean text-white'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>משעה</Label>
            <Input
              type="time"
              value={form.avail_start}
              onChange={e => setForm(p => ({ ...p, avail_start: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label>עד שעה</Label>
            <Input
              type="time"
              value={form.avail_end}
              onChange={e => setForm(p => ({ ...p, avail_end: e.target.value }))}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label>מחיר לשעה (₪)</Label>
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, hourly_price: Math.max(100, p.hourly_price - 50) }))}
              className="w-10 h-10 border-2 border-gray-200 rounded-lg flex items-center justify-center hover:border-ocean text-lg font-bold"
            >
              –
            </button>
            <div className="flex-1 text-center">
              <span className="text-3xl font-bold text-ocean">₪{form.hourly_price}</span>
            </div>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, hourly_price: Math.min(1000, p.hourly_price + 50) }))}
              className="w-10 h-10 border-2 border-gray-200 rounded-lg flex items-center justify-center hover:border-ocean text-lg font-bold"
            >
              +
            </button>
          </div>
        </div>
      </Card>

      <div className="flex gap-3 pb-8">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push('/host-dashboard/venues')}
          disabled={isPending}
        >
          ביטול
        </Button>
        <Button
          className="flex-1 bg-ocean hover:bg-deep-ocean text-white h-12"
          onClick={handleSubmit}
          disabled={isPending || success}
        >
          {isPending ? 'שומר שינויים...' : 'שמור שינויים'}
        </Button>
      </div>
    </div>
  )
}
