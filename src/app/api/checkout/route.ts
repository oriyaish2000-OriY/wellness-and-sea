import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  sendBookingConfirmedEmailToInstructor,
  sendNewBookingEmailToHost,
} from '@/lib/email'

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
      console.warn('[Grow] GROW_API_KEY not configured — confirming booking directly (no payment gateway)')
    }

    // ── No Grow configured: confirm booking server-side and redirect to confirm page ──
    // This is the correct behaviour when no payment gateway is set up (e.g. during
    // onboarding / testing). The booking is confirmed without charging — the operator
    // is responsible for collecting payment out-of-band.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceKey) {
      try {
        const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

        // Fetch full booking details for emails
        const { data: fullBooking } = await admin
          .from('bookings')
          .select(`
            *,
            venue:venues(title, location_address, location_city,
              host:profiles!venues_host_id_fkey(id, full_name)),
            instructor:profiles!bookings_instructor_id_fkey(id, full_name)
          `)
          .eq('id', bookingId)
          .single()

        await admin
          .from('bookings')
          .update({ status: 'confirmed' })
          .eq('id', bookingId)
          .eq('status', 'pending')

        // Send emails non-blocking
        if (fullBooking) {
          const venue = fullBooking.venue as {
            title?: string; location_address?: string; location_city?: string;
            host?: { id?: string; full_name?: string }
          } | null
          const instructor = fullBooking.instructor as { id?: string; full_name?: string } | null

          let instructorEmail = user.email ?? ''
          let hostEmail = ''
          if (venue?.host?.id) {
            const { data: hostUser } = await admin.auth.admin.getUserById(venue.host.id)
            hostEmail = hostUser?.user?.email ?? ''
          }

          const emailData = {
            instructorName: instructor?.full_name ?? '',
            instructorEmail,
            hostName: venue?.host?.full_name ?? '',
            hostEmail,
            venueName: venue?.title ?? '',
            venueAddress: venue?.location_address ?? '',
            venueCity: venue?.location_city ?? '',
            bookingDate: fullBooking.booking_date,
            startTime: fullBooking.start_time,
            endTime: fullBooking.end_time,
            totalPrice: fullBooking.total_price,
            hostPayout: fullBooking.host_payout,
            classType: fullBooking.class_type ?? undefined,
            participantsCount: fullBooking.participants_count ?? undefined,
            bookingId,
          }

          Promise.all([
            instructorEmail ? sendBookingConfirmedEmailToInstructor(emailData) : Promise.resolve(),
            hostEmail ? sendNewBookingEmailToHost(emailData) : Promise.resolve(),
          ]).catch(err => console.error('[checkout fallback] email error:', err))
        }

        console.log(`[checkout] Confirmed booking ${bookingId} via fallback (no Grow)`)
      } catch (fallbackErr) {
        console.error('[checkout] Fallback confirm failed:', fallbackErr)
      }
    }

    return NextResponse.json({
      checkout_url: `${appUrl}/booking/confirm/${bookingId}`,
    })

  } catch (e) {
    console.error('Checkout error:', e)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
