'use client'

import { useActionState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { enrollInClass } from '@/lib/actions/classes'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Props {
  bookingId: string
  isFull: boolean
  isLoggedIn: boolean
  alreadyEnrolled: boolean
}

export function EnrollButton({ bookingId, isFull, isLoggedIn, alreadyEnrolled }: Props) {
  const [state, formAction, isPending] = useActionState(enrollInClass, null)
  const router = useRouter()

  // Redirect to payment page after successful enrollment
  useEffect(() => {
    if (state?.success) {
      router.push(`/classes/${bookingId}/pay`)
    }
  }, [state?.success, bookingId, router])

  if (alreadyEnrolled) {
    return (
      <Link
        href={`/classes/${bookingId}/pay`}
        className="block w-full text-center py-3.5 rounded-full font-bold text-white text-base"
        style={{ background: 'linear-gradient(135deg, #c8944a, #e8b870)' }}
      >
        להמשיך לתשלום ←
      </Link>
    )
  }

  if (isFull) {
    return (
      <div className="p-4 rounded-xl text-center text-sm font-semibold text-gray-500" style={{ background: '#f5f5f5' }}>
        השיעור מלא
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="space-y-3">
        <Link
          href={`/auth/login?role=student&next=/classes/${bookingId}`}
          className="block w-full text-center py-3.5 rounded-full font-bold text-white text-base"
          style={{ background: 'linear-gradient(135deg, #c8944a, #e8b870)' }}
        >
          התחברי להרשמה
        </Link>
        <p className="text-xs text-center text-gray-400">
          אין לך חשבון?{' '}
          <Link href={`/auth/signup?role=student&next=/classes/${bookingId}`} className="text-ocean hover:underline">
            הירשמי בחינם
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="booking_id" value={bookingId} />
      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 text-center">{state.error}</p>
      )}
      <Button
        type="submit"
        disabled={isPending}
        className="w-full font-bold text-white text-base"
        style={{
          height: 52,
          borderRadius: 50,
          background: 'linear-gradient(135deg, #c8944a, #e8b870)',
          border: 'none',
        }}
      >
        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'הירשמי לשיעור'}
      </Button>
      <p className="text-xs text-center text-gray-400">
        לאחר ההרשמה תשלחי את התשלום ישירות למדריכה
      </p>
    </form>
  )
}
