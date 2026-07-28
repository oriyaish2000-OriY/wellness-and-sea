'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(
  _prevState: { error?: string } | null,
  formData: FormData
) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'אימייל או סיסמה שגויים. אנא נסי שוב.' }
  }

  const role = data.user?.user_metadata?.role as string | undefined
  if (role === 'host') redirect('/host-dashboard')
  else if (role === 'instructor') redirect('/instructor-dashboard')
  else redirect('/classes')
}

export async function signUp(
  _prevState: { error?: string } | null,
  formData: FormData
) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as 'host' | 'instructor' | 'student'

  if (!fullName || fullName.trim().length < 2) {
    return { error: 'נא להזין שם מלא (לפחות 2 תווים).' }
  }
  if (password.length < 8) {
    return { error: 'הסיסמה חייבת להכיל לפחות 8 תווים.' }
  }
  if (!['host', 'instructor', 'student'].includes(role)) {
    return { error: 'נא לבחור סוג משתמש.' }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, full_name: fullName },
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: 'כתובת האימייל הזו כבר רשומה. נסי להתחבר.' }
    }
    return { error: 'שגיאה בהרשמה. אנא נסי שוב.' }
  }

  if (role === 'host') redirect('/host-dashboard')
  else if (role === 'instructor') redirect('/instructor-dashboard')
  else redirect('/classes')
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const role = formData.get('role') as string | null

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      queryParams: role ? { role } : undefined,
    },
  })

  if (!error && data.url) {
    redirect(data.url)
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function resetPassword(
  _prevState: { error?: string; success?: string } | null,
  formData: FormData
) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/update-password`,
  })

  if (error) {
    return { error: 'לא הצלחנו לשלוח אימייל לאיפוס. בדקי שהכתובת נכונה.' }
  }

  return { success: 'שלחנו אליך אימייל לאיפוס הסיסמה. בדקי את תיבת הדואר שלך.' }
}

export async function updatePassword(
  _prevState: { error?: string } | null,
  formData: FormData
) {
  const supabase = await createClient()
  const password = formData.get('password') as string

  if (password.length < 8) {
    return { error: 'הסיסמה חייבת להכיל לפחות 8 תווים.' }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: 'שגיאה בעדכון הסיסמה. אנא נסי שוב.' }
  }

  redirect('/instructor-dashboard')
}
