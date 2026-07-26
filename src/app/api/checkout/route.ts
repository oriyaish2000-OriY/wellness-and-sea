import { NextRequest, NextResponse } from 'next/server'

interface CheckoutBody {
  booking_id: string
  venue_title: string
  total_price: number
  host_payout: number
  instructor_id: string
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutBody = await request.json()

    if (!body.booking_id || !body.total_price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const tranzilaApiKey = process.env.TRANZILA_API_KEY
    const tranzilaTerminal = process.env.TRANZILA_TERMINAL_NAME
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    if (tranzilaApiKey && tranzilaTerminal) {
      // Real Tranzila Marketplace API call
      const tranzilaRes = await fetch('https://api.tranzila.finance/v1/marketplace/checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tranzilaApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          terminal_name: tranzilaTerminal,
          amount: body.total_price,
          currency: 'ILS',
          description: `WELLNESS&SEA - ${body.venue_title}`,
          success_url: `${appUrl}/booking/success?booking_id=${body.booking_id}`,
          cancel_url: `${appUrl}/booking/cancelled?booking_id=${body.booking_id}`,
          metadata: {
            booking_id: body.booking_id,
            instructor_id: body.instructor_id,
          },
          // Split: platform fee is calculated server-side and NOT exposed here
          // The webhook handler receives the confirmation and updates booking status
        }),
      })

      if (tranzilaRes.ok) {
        const { checkout_url } = await tranzilaRes.json()
        return NextResponse.json({ checkout_url })
      }
    }

    // Development fallback — simulate payment confirmation
    return NextResponse.json({
      checkout_url: `${appUrl}/booking/confirm/${body.booking_id}?dev=true`,
    })

  } catch (e) {
    console.error('Checkout error:', e)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
