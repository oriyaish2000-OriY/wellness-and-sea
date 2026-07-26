'use client'

import { useState, useTransition } from 'react'
import { Star, UserCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { submitReview } from '@/lib/actions/reviews'
import type { Review } from '@/lib/supabase/types'

function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
}: {
  value: number
  onChange?: (v: number) => void
  readonly?: boolean
  size?: 'sm' | 'md'
}) {
  const [hovered, setHovered] = useState(0)
  const sz = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'
  const active = hovered || value

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={readonly ? 'cursor-default' : 'cursor-pointer'}
        >
          <Star
            className={`${sz} transition-colors ${
              star <= active
                ? 'fill-golden text-golden'
                : 'text-gray-300 fill-gray-100'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

function ReviewCard({ review }: { review: Review }) {
  const instructor = review.instructor as { full_name?: string; avatar_url?: string } | undefined
  const date = new Date(review.created_at).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
  })

  return (
    <div className="py-4 border-b last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full ocean-gradient flex items-center justify-center flex-shrink-0">
          {instructor?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={instructor.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <UserCircle className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-medium text-gray-900 text-sm">
              {instructor?.full_name ?? 'מדריכה'}
            </p>
            <span className="text-xs text-gray-400">{date}</span>
          </div>
          <StarRating value={review.rating} readonly size="sm" />
          {review.comment && (
            <p className="text-gray-600 text-sm mt-1 leading-relaxed">{review.comment}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewForm({
  venueId,
  bookingId,
  onSuccess,
}: {
  venueId: string
  bookingId: string
  onSuccess: () => void
}) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) { setError('יש לבחור דירוג'); return }
    setError(null)

    const fd = new FormData()
    fd.set('venue_id', venueId)
    fd.set('booking_id', bookingId)
    fd.set('rating', String(rating))
    fd.set('comment', comment)

    startTransition(async () => {
      const result = await submitReview(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-sand/50 rounded-xl p-4 space-y-3 border border-ocean/10">
      <h4 className="font-semibold text-deep-ocean text-sm">כתוב ביקורת</h4>
      <div>
        <p className="text-xs text-gray-500 mb-1">דירוג *</p>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <Textarea
        placeholder="שתף את החוויה שלך במקום (אופציונלי)..."
        value={comment}
        onChange={e => setComment(e.target.value)}
        className="text-right text-sm min-h-[80px]"
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <Button
        type="submit"
        size="sm"
        className="bg-ocean hover:bg-deep-ocean text-white"
        disabled={isPending}
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שלח ביקורת'}
      </Button>
    </form>
  )
}

interface ReviewSectionProps {
  venueId: string
  reviews: Review[]
  avg: number
  count: number
  eligibleBookingId?: string // completed booking that hasn't been reviewed yet
}

export function ReviewSection({ venueId, reviews: initialReviews, avg, count, eligibleBookingId }: ReviewSectionProps) {
  const [reviews, setReviews] = useState(initialReviews)
  const [reviewCount, setReviewCount] = useState(count)
  const [avgRating, setAvgRating] = useState(avg)
  const [showForm, setShowForm] = useState(false)

  const handleReviewSuccess = () => {
    setShowForm(false)
    // Optimistic update — page will revalidate
    setReviewCount(c => c + 1)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg text-deep-ocean">ביקורות</h2>
        {reviewCount > 0 && (
          <div className="flex items-center gap-1.5">
            <StarRating value={Math.round(avgRating)} readonly size="sm" />
            <span className="font-bold text-gray-800">{avgRating.toFixed(1)}</span>
            <span className="text-gray-400 text-sm">({reviewCount})</span>
          </div>
        )}
      </div>

      {eligibleBookingId && !showForm && (
        <Button
          variant="outline"
          size="sm"
          className="mb-4 border-ocean text-ocean hover:bg-ocean/5"
          onClick={() => setShowForm(true)}
        >
          <Star className="w-4 h-4 ml-1" />
          כתוב ביקורת
        </Button>
      )}

      {showForm && eligibleBookingId && (
        <div className="mb-4">
          <ReviewForm
            venueId={venueId}
            bookingId={eligibleBookingId}
            onSuccess={handleReviewSuccess}
          />
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-gray-400 text-sm">אין ביקורות עדיין. היה הראשון לכתוב!</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  )
}
