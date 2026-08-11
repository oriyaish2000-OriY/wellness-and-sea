'use client'

import { SumitCardForm } from '@/components/payments/SumitCardForm'

interface Props {
  bookingId:  string
  totalPrice: number
  venueTitle: string
  hostPayout: number
}

export function PaymentActions({ bookingId, totalPrice }: Props) {
  return (
    <SumitCardForm
      action="/api/checkout/card"
      hiddenFields={{ booking_id: bookingId }}
      amountILS={totalPrice}
    />
  )
}
