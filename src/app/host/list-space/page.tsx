'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Minus, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { ImageUpload } from '@/components/ui/image-upload'
import { createVenue } from '@/lib/actions/venues'
import { AMENITY_OPTIONS, ISRAELI_CITIES, DAYS } from '@/lib/constants'

export default function ListSpacePage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(1)
  const [amenities, setAmenities] = useState<Record<string, boolean>>({})
  const [availableDays, setAvailableDays] = useState<number[]>([0, 1, 2, 3, 4])
  const [images, setImages] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    location_address: '',
    location_city: 'תל אביב',
    hourly_price: 280,
    capacity: 20,
    space_size_sqm: 60,
    bonus_offer: '',
    accessibility_info: '',
    avail_start: '07:00',
    avail_end: '12:00',
  })

  const steps = [
    { num: 1, label: 'פרטי המקום' },
    { num: 2, label: 'תמונות' },
    { num: 3, label: 'תנאים ושירותים' },
    { num: 4, label: 'שעות ומחיר' },
    { num: 5, label: 'סיום' },
  ]

  const toggleAmenity = (key: string) => {
    setAmenities(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleDay = (day: number) => {
    setAvailableDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!form.title.trim()) return 'יש למלא את שם המקום'
      if (!form.location_address.trim()) return 'יש למלא כתובת'
      if (!form.location_city) return 'יש לבחור עיר'
      if (!form.description.trim()) return 'יש למלא תיאור'
    }
    if (s === 2 && images.length === 0) return 'יש להעלות לפחות תמונה אחת'
    if (s === 3 && !Object.values(amenities).some(Boolean)) return 'יש לסמן לפחות מתקן אחד'
    if (s === 4 && availableDays.length === 0) return 'יש לבחור לפחות יום זמינות אחד'
    return null
  }

  const goNext = () => {
    const err = validateStep(step)
    if (err) { setError(err); return }
    setError(null)
    setStep(s => s + 1)
  }

  const handleSubmit = () => {
    const err = validateStep(step)
    if (err) { setError(err); return }
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
    formData.set('images', JSON.stringify(images))
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
      const result = await createVenue(formData)
      if (result?.error) {
        setError(result.error)
      }
      // On success, createVenue redirects — no need to handle here
    })
  }

  return (
    <div>
      <div className="pt-20 max-w-2xl mx-auto px-4 pb-16">
        {/* Header */}
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold text-deep-ocean">רישום החלל שלך</h1>
          <p className="text-gray-500 text-sm mt-1">5 שלבים פשוטים ואתה מוכן</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                s.num < step ? 'bg-green-500 text-white' :
                s.num === step ? 'bg-ocean text-white' :
                'bg-gray-200 text-gray-400'
              }`}>
                {s.num < step ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <div className={`text-xs mr-2 hidden md:block ${s.num === step ? 'text-ocean font-medium' : 'text-gray-400'}`}>
                {s.label}
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${s.num < step ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Step 1: Basic info */}
        {step === 1 && (
          <Card className="p-6 border-0 shadow-md space-y-4">
            <h2 className="font-semibold text-deep-ocean">פרטי המקום</h2>
            <div>
              <Label>שם המקום *</Label>
              <Input
                placeholder='לדוגמה: "דק ים רוטשילד בוקר"'
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="mt-1 text-right"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>כתובת *</Label>
                <Input
                  placeholder="רחוב ומספר"
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
                placeholder="ספר על החלל שלך – נוף, גודל, אווירה, מה שהופך אותו לייחודי..."
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="mt-1 text-right min-h-[100px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>קיבולת מקסימלית</Label>
                <div className="flex items-center gap-2 mt-1">
                  <button type="button" onClick={() => setForm(p => ({ ...p, capacity: Math.max(5, p.capacity - 5) }))}
                    className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-50">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-bold text-ocean w-8 text-center">{form.capacity}</span>
                  <button type="button" onClick={() => setForm(p => ({ ...p, capacity: Math.min(100, p.capacity + 5) }))}
                    className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-50">
                    <Plus className="w-3 h-3" />
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
                placeholder='לדוגמה: "גישה לנכים, מעלית זמינה"'
                value={form.accessibility_info}
                onChange={e => setForm(p => ({ ...p, accessibility_info: e.target.value }))}
                className="mt-1 text-right"
              />
            </div>
          </Card>
        )}

        {/* Step 2: Images */}
        {step === 2 && (
          <Card className="p-6 border-0 shadow-md space-y-4">
            <h2 className="font-semibold text-deep-ocean">תמונות המקום *</h2>
            <p className="text-sm text-gray-500">
              תמונות איכותיות מגדילות הזמנות ב-70%. העלה עד 8 תמונות.
            </p>
            <ImageUpload
              bucket="venue-images"
              folder={`venues/${Date.now()}`}
              existingUrls={images}
              onUpload={(url) => setImages(prev => [...prev, url])}
              onRemove={(url) => setImages(prev => prev.filter(u => u !== url))}
              maxFiles={8}
              label="העלאת תמונות המקום"
            />
            {images.length > 0 && (
              <p className="text-sm text-green-600">{images.length} תמונות הועלו בהצלחה</p>
            )}
          </Card>
        )}

        {/* Step 3: Amenities */}
        {step === 3 && (
          <Card className="p-6 border-0 shadow-md space-y-4">
            <h2 className="font-semibold text-deep-ocean">מה כלול במקום? *</h2>
            <p className="text-sm text-gray-500">בחר את כל השירותים הזמינים לשוכרים</p>
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
              <p className="text-xs text-gray-400 mt-1">בונוס מגדיל המרות ב-40%</p>
            </div>
          </Card>
        )}

        {/* Step 4: Availability & pricing */}
        {step === 4 && (
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
            <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
              המערכת שומרת 60 דקות חוצץ לפני פתיחת המסעדה אוטומטית
            </p>

            <div>
              <Label>מחיר לשעה (₪)</Label>
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, hourly_price: Math.max(100, p.hourly_price - 50) }))}
                  className="w-10 h-10 border-2 border-gray-200 rounded-lg flex items-center justify-center hover:border-ocean">
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1 text-center">
                  <span className="text-3xl font-bold text-ocean">₪{form.hourly_price}</span>
                  <p className="text-xs text-gray-400 mt-0.5">ממוצע באזורך: ₪280</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, hourly_price: Math.min(1000, p.hourly_price + 50) }))}
                  className="w-10 h-10 border-2 border-gray-200 rounded-lg flex items-center justify-center hover:border-ocean">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <Card className="p-6 border-0 shadow-md space-y-4">
            <h2 className="font-semibold text-deep-ocean">סיכום לפני פרסום</h2>
            <div className="space-y-3 text-sm">
              {[
                { label: 'שם המקום', value: form.title },
                { label: 'כתובת', value: `${form.location_address}, ${form.location_city}` },
                { label: 'קיבולת', value: `עד ${form.capacity} משתתפים` },
                { label: 'גודל', value: `${form.space_size_sqm} מ"ר` },
                { label: 'שעות', value: `${form.avail_start} – ${form.avail_end}` },
                { label: 'מחיר', value: `₪${form.hourly_price} לשעה` },
                { label: 'תמונות', value: `${images.length} תמונות` },
                { label: 'שירותים', value: `${Object.values(amenities).filter(Boolean).length} נבחרו` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b last:border-0">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium">{value || '—'}</span>
                </div>
              ))}
            </div>

            <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-green-700">
              <p className="font-medium mb-1">פרסום חינמי לחלוטין</p>
              <p>תשלם עמלה קטנה רק כשמתבצעת הזמנה מאושרת. ללא תשלום מראש.</p>
            </div>

            <Button
              className="w-full bg-ocean hover:bg-deep-ocean text-white h-12"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? 'שומר...' : 'פרסם את המקום עכשיו'}
            </Button>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <Button variant="outline" className="flex-1" onClick={() => { setError(null); setStep(s => s - 1) }}>
              חזרה
            </Button>
          )}
          {step < 5 && (
            <Button
              className="flex-1 bg-ocean hover:bg-deep-ocean text-white"
              onClick={goNext}
            >
              המשך
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
