'use client'

import { useState, useTransition } from 'react'
import { submitHealthDeclaration } from '@/lib/actions/health'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, AlertCircle, Loader2, UserPlus, Shield } from 'lucide-react'

interface Declaration {
  id: string
  student_name: string
  student_phone: string
  signed_at: string
}

interface HealthDeclarationFormProps {
  bookingId: string
  existingDeclarations?: Declaration[]
}

export function HealthDeclarationForm({ bookingId, existingDeclarations = [] }: HealthDeclarationFormProps) {
  const [declarations, setDeclarations] = useState<Declaration[]>(existingDeclarations)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) { setError('יש למלא שם וטלפון'); return }
    setError(null)
    setSuccess(false)

    const fd = new FormData()
    fd.set('booking_id', bookingId)
    fd.set('student_name', name.trim())
    fd.set('student_phone', phone.trim())

    startTransition(async () => {
      const result = await submitHealthDeclaration(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        setDeclarations(prev => [...prev, {
          id: Date.now().toString(),
          student_name: name.trim(),
          student_phone: phone.trim(),
          signed_at: new Date().toISOString(),
        }])
        setName('')
        setPhone('')
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-ocean" />
        <h3 className="font-semibold text-deep-ocean">הצהרות בריאות משתתפים</h3>
      </div>

      {declarations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">{declarations.length} הצהרות חתומות</p>
          {declarations.map((decl) => (
            <div key={decl.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{decl.student_name}</p>
                  <p className="text-xs text-gray-500">{decl.student_phone}</p>
                </div>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(decl.signed_at).toLocaleDateString('he-IL')}
              </span>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 bg-gray-50 rounded-xl p-4">
        <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <UserPlus className="w-4 h-4" />
          הוסף משתתף
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="hd-name" className="text-xs text-gray-600">שם מלא *</Label>
            <Input
              id="hd-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="שם פרטי ומשפחה"
              className="mt-1 h-9 text-sm text-right"
              dir="rtl"
            />
          </div>
          <div>
            <Label htmlFor="hd-phone" className="text-xs text-gray-600">טלפון *</Label>
            <Input
              id="hd-phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="05X-XXXXXXX"
              type="tel"
              className="mt-1 h-9 text-sm text-right"
              dir="rtl"
            />
          </div>
        </div>

        <div className="text-xs text-gray-400 bg-white border border-gray-100 rounded-lg p-2.5 leading-relaxed">
          <strong>נוסח ההצהרה:</strong> המשתתף מצהיר כי הוא בריא וכשיר לפעילות גופנית, אין לו מגבלה רפואית, ולוקח אחריות מלאה על השתתפותו.
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-red-600 text-xs">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-1.5 text-green-600 text-xs">
            <CheckCircle className="w-3.5 h-3.5" /> ההצהרה נשמרה בהצלחה
          </div>
        )}

        <Button
          type="submit"
          size="sm"
          className="bg-ocean hover:bg-deep-ocean text-white"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            'אשר הצהרת בריאות'
          )}
        </Button>
      </form>
    </div>
  )
}
