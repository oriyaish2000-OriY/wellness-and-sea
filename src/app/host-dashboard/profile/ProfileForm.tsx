'use client'

import { useActionState } from 'react'
import { updateProfile } from '@/lib/actions/instructor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, AlertCircle, Loader2, Save } from 'lucide-react'

interface ProfileFormProps {
  initialData: {
    full_name: string
    phone: string
    bio: string
    avatar_url: string
    bank_account?: string
    bit_phone?: string
    paybox_phone?: string
  }
}

type ActionState = { error?: string; success?: boolean } | null

async function updateProfileAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return updateProfile(formData)
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, null)

  return (
    <form action={formAction} className="space-y-5">
      <h2 className="font-semibold text-gray-900 text-base border-b border-gray-100 pb-3">
        עריכת פרטים אישיים
      </h2>

      {state?.success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          הפרופיל עודכן בהצלחה!
        </div>
      )}

      {state?.error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="full_name" className="text-sm font-medium text-gray-700">
          שם מלא <span className="text-red-500">*</span>
        </Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={initialData.full_name}
          placeholder="שם פרטי ושם משפחה"
          required
          className="text-right"
          dir="rtl"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
          טלפון
        </Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={initialData.phone}
          placeholder="05X-XXXXXXX"
          className="text-right"
          dir="rtl"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio" className="text-sm font-medium text-gray-700">
          אודות
        </Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={initialData.bio}
          placeholder="ספרי על העסק שלך, המיקום, ומה מייחד את החלל..."
          rows={4}
          className="text-right resize-none"
          dir="rtl"
        />
      </div>

      <input type="hidden" name="avatar_url" value={initialData.avatar_url} />

      {/* Payment details */}
      <div className="space-y-4 pt-2 border-t border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm pt-2">פרטי תשלום</h3>

        <div className="space-y-1.5">
          <Label htmlFor="bank_account" className="text-sm font-medium text-gray-700">
            מספר חשבון בנק / IBAN
          </Label>
          <Input
            id="bank_account"
            name="bank_account"
            type="text"
            defaultValue={initialData.bank_account ?? ''}
            placeholder="IL000000000000000000"
            className="text-right"
            dir="rtl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bit_phone" className="text-sm font-medium text-gray-700">
            מספר Bit
          </Label>
          <Input
            id="bit_phone"
            name="bit_phone"
            type="tel"
            defaultValue={initialData.bit_phone ?? ''}
            placeholder="05X-XXXXXXX"
            className="text-right"
            dir="rtl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="paybox_phone" className="text-sm font-medium text-gray-700">
            מספר PayBox
          </Label>
          <Input
            id="paybox_phone"
            name="paybox_phone"
            type="tel"
            defaultValue={initialData.paybox_phone ?? ''}
            placeholder="05X-XXXXXXX"
            className="text-right"
            dir="rtl"
          />
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-ocean hover:bg-deep-ocean text-white min-w-32"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 ml-2" />
              שמירת שינויים
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
