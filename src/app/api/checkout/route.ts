import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const bookingId: string = body.booking_id

    // Auth check — must be a logged-in user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing booking_id' }, { status: 400 })
    }

    // Fetch booking with venue — verify it belongs to this user and is still pending
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, total_price, host_payout, platform_fee, instructor_id, venue:venues(title)')
      .eq('id', bookingId)
      .eq('instructor_id', user.id)
      .eq('status', 'pending')
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Use server-verified values — never trust client-supplied amounts
    const verifiedTotal = booking.total_price
    const verifiedPayout = booking.host_payout

    if (!verifiedTotal) {
      return NextResponse.json({ error: 'Invalid booking amount' }, { status: 400 })
    }

    const growApiKey = process.env.GROW_API_KEY
    const growUserId = process.env.GROW_USER_ID
    const growPageCode = process.env.GROW_PAGE_CODE
    const growApiBase = process.env.GROW_API_BASE ?? 'http://sandboxapi.grow.link/api/light/server/1.0'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const venue = booking.venue as { title?: string } | null
    const venueName = venue?.title ?? 'חלל'

    if (growApiKey && growUserId && growPageCode) {
      try {
        // Build multipart/form-data — Grow requires server-side form-data
        const formData = new FormData()
        formData.append('userId', growUserId)
        formData.append('pageCode', growPageCode)
        formData.append('title', `WELLNESS&SEA — ${venueName}`)
        formData.append('products[data][0][name]', `הזמנת חלל: ${venueName}`)
        formData.append('products[data][0][price]', String(verifiedTotal * 100)) // agorot
        formData.append('products[data][0][quantity]', '1')
        formData.append('products[data][0][vatType]', '3') // VAT exempt for fitness
        formData.append('transactionType[0]', '1')  // credit card
        formData.append('transactionType[1]', '5')  // PayBox
        formData.append('transactionType[2]', '6')  // Bit
        formData.append('transactionType[3]', '13') // Apple Pay
        formData.append('transactionType[4]', '14') // Google Pay
        formData.append('paymentLinkType', '2')     // one-time link
        formData.append('isActive', '1')
        formData.append('successUrl', `${appUrl}/booking/confirm/${bookingId}`)
        formData.append('notifyUrl', `${appUrl}/api/webhooks/payment`)
        formData.append('cField1', bookingId)
        formData.append('cField2', booking.instructor_id)
        formData.append('cField3', String(verifiedPayout))

        const growRes = await fetch(`${growApiBase}/CreatePaymentLink`, {
          method: 'POST',
          headers: {
            'x-api-key': growApiKey,
          },
          body: formData,
        })

        if (growRes.ok) {
          const growData = await growRes.json()
          // Grow may return the URL under different keys — try all known variants
          const checkoutUrl: string | undefined =
            growData?.data?.url ??
            growData?.data?.link ??
            growData?.url ??
            growData?.link ??
            growData?.paymentLink ??
            growData?.data?.paymentLink

          if (checkoutUrl) {
            console.log(`[Grow] Payment link created for booking ${bookingId}: ${checkoutUrl}`)
            return NextResponse.json({ checkout_url: checkoutUrl })
          } else {
            console.error('[Grow] Unexpected response shape:', JSON.stringify(growData))
          }
        } else {
          const errText = await growRes.text()
          console.error(`[Grow] API error ${growRes.status}:`, errText)
        }
      } catch (growErr) {
        console.error('[Grow] Request failed:', growErr)
      }
    } else {
      if (!growApiKey) console.warn('[Grow] GROW_API_KEY not set — using dev fallback')
    }

    // Fallback for dev / Grow unavailable — jump straight to confirm page
    console.log(`[Grow] Falling back to dev confirm for booking ${bookingId}`)
    return NextResponse.json({
      checkout_url: `${appUrl}/booking/confirm/${bookingId}?dev=true`,
    })

  } catch (e) {
    console.error('Checkout error:', e)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
