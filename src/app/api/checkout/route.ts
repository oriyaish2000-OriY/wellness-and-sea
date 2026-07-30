import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Auth check — must be a logged-in user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the booking belongs to this user and is still pending
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, total_price, host_payout, platform_fee, instructor_id')
      .eq('id', body.booking_id)
      .eq('instructor_id', user.id)
      .eq('status', 'pending')
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Use server-verified values — never trust client-supplied amounts
    const verifiedTotal = booking.total_price
    const verifiedPayout = booking.host_payout

    if (!body.booking_id || !verifiedTotal) {
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
          amount: verifiedTotal,
          currency: 'ILS',
          description: `WELLNESS&SEA - ${body.venue_title}`,
          success_url: `${appUrl}/booking/success?booking_id=${body.booking_id}`,
          cancel_url: `${appUrl}/booking/cancelled?booking_id=${body.booking_id}`,
          metadata: {
            booking_id: body.booking_id,
            instructor_id: booking.instructor_id,
            host_payout: verifiedPayout,
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
