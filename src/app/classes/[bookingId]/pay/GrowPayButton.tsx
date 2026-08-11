'use client'

/**
 * SUMIT payment form for class enrollment.
 * Replaces the previous Grow/redirect-based approach.
 * Uses SumitCardForm which tokenizes via payments.js → multivendorcharge split.
 */

import { SumitCardForm } from '@/components/payments/SumitCardForm'

export function GrowPayButton({
  enrollmentId,
  amount,
}: {
  enrollmentId: string
  amount: number
}) {
  return (
    <SumitCardForm
      action="/api/checkout/class/card"
      hiddenFields={{ enrollment_id: enrollmentId }}
      amountILS={amount}
    />
  )
}
