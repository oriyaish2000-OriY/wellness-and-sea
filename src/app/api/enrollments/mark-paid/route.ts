import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { enrollment_id } = await request.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify the enrollment belongs to this student
    const { data: enrollment } = await supabase
      .from('class_enrollments')
      .select('id, student_id, payment_status')
      .eq('id', enrollment_id)
      .eq('student_id', user.id)
      .single()

    if (!enrollment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (enrollment.payment_status === 'paid') return NextResponse.json({ ok: true })

    const { error } = await supabase
      .from('class_enrollments')
      .update({ payment_status: 'paid', payment_method: 'direct' })
      .eq('id', enrollment_id)
      .eq('student_id', user.id)

    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
