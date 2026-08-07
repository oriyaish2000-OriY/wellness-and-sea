/**
 * POST /api/bookings/mark-paid — DISABLED
 *
 * Bit/PayBox self-report was removed. All payments now go through Cardcom.
 * Bookings are confirmed automatically by the Cardcom webhook after successful payment.
 */
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'שיטת תשלום זו אינה פעילה. כל התשלומים מתבצעים דרך כרטיס אשראי בלבד.' },
    { status: 410 }
  )
}
