'use client'

import { useState, useTransition } from 'react'
import { ChevronRight, ChevronLeft, Trash2, Loader2, CheckCircle2, GripVertical, Star } from 'lucide-react'
import { ImageUpload } from '@/components/ui/image-upload'
import { updateVenueImages } from '@/lib/actions/venues'
import { Button } from '@/components/ui/button'

interface Props {
  venueId: string
  initialImages: string[]
  venueName: string
}

export function ImageManagerClient({ venueId, initialImages, venueName }: Props) {
  const [images, setImages] = useState<string[]>(initialImages)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Move image left (lower index = displayed earlier / cover photo)
  const moveLeft = (i: number) => {
    if (i === 0) return
    setImages(prev => {
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      return next
    })
    setSaved(false)
  }

  // Move image right
  const moveRight = (i: number) => {
    if (i === images.length - 1) return
    setImages(prev => {
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      return next
    })
    setSaved(false)
  }

  const remove = (i: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== i))
    setSaved(false)
  }

  const handleUpload = (url: string) => {
    setImages(prev => [...prev, url])
    setSaved(false)
  }

  const save = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateVenueImages(venueId, images)
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-deep-ocean">ניהול תמונות — {venueName}</h1>
        <p className="text-sm text-gray-500 mt-1">
          גרור / הזז תמונות לקביעת סדר. התמונה הראשונה תוצג כתמונת שער.
        </p>
      </div>

      {/* Image grid with order controls */}
      {images.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center text-gray-400 text-sm">
          אין תמונות עדיין — העלי את הראשונה 👇
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((url, i) => (
            <div
              key={url}
              className="relative rounded-xl overflow-hidden border-2 border-transparent hover:border-ocean/40 transition-all group"
              style={{ aspectRatio: '4/3' }}
            >
              <img src={url} alt={`תמונה ${i + 1}`} className="w-full h-full object-cover" />

              {/* Cover badge */}
              {i === 0 && (
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-ocean text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                  <Star className="w-2.5 h-2.5 fill-white" />
                  שער
                </div>
              )}

              {/* Order number */}
              <div className="absolute top-2 left-2 bg-black/55 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {i + 1}
              </div>

              {/* Controls overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2 gap-1.5">
                <button
                  onClick={() => moveLeft(i)}
                  disabled={i === 0}
                  aria-label="הזז שמאלה"
                  className="w-7 h-7 rounded-full bg-white/90 hover:bg-white disabled:opacity-30 flex items-center justify-center transition"
                >
                  <ChevronRight className="w-4 h-4 text-gray-800" />
                </button>
                <button
                  onClick={() => remove(i)}
                  aria-label="מחק"
                  className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
                <button
                  onClick={() => moveRight(i)}
                  disabled={i === images.length - 1}
                  aria-label="הזז ימינה"
                  className="w-7 h-7 rounded-full bg-white/90 hover:bg-white disabled:opacity-30 flex items-center justify-center transition"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-800" />
                </button>
              </div>

              {/* Mobile controls — always visible at bottom */}
              <div className="sm:hidden absolute bottom-0 left-0 right-0 flex justify-center gap-1 p-1.5 bg-black/50">
                <button onClick={() => moveLeft(i)} disabled={i === 0} className="w-6 h-6 rounded-full bg-white/80 disabled:opacity-30 flex items-center justify-center">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-800" />
                </button>
                <button onClick={() => remove(i)} className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                  <Trash2 className="w-3 h-3 text-white" />
                </button>
                <button onClick={() => moveRight(i)} disabled={i === images.length - 1} className="w-6 h-6 rounded-full bg-white/80 disabled:opacity-30 flex items-center justify-center">
                  <ChevronLeft className="w-3.5 h-3.5 text-gray-800" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload more images */}
      {images.length < 20 && (
        <div>
          <p className="text-xs text-gray-500 mb-2 font-medium">הוסיפי תמונות ({images.length}/20)</p>
          <ImageUpload
            bucket="venue-images"
            folder={venueId}
            onUpload={handleUpload}
            existingUrls={images}
            maxFiles={20}
            label="העלי תמונות נוספות"
          />
        </div>
      )}

      {/* Legend */}
      {images.length > 1 && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5" />
          ערבבי את הסדר עם חצי ← → ואז לחצי שמירה
        </p>
      )}

      {/* Save */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={save}
          disabled={isPending}
          className="bg-ocean hover:bg-deep-ocean text-white px-8"
        >
          {isPending ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> שומרת…</span>
          ) : (
            'שמירת סדר ותמונות'
          )}
        </Button>

        {saved && (
          <span className="flex items-center gap-1.5 text-green-700 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            נשמר בהצלחה!
          </span>
        )}
      </div>
    </div>
  )
}
