'use client'

import { useState, useActionState } from 'react'
import { updateProfile } from '@/lib/actions/instructor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImageUpload } from '@/components/ui/image-upload'
import { CheckCircle, AlertCircle, Loader2, Save, FileCheck, ExternalLink } from 'lucide-react'

interface ProfileFormProps {
  initialData: {
    full_name: string
    phone: string
    bio: string
    avatar_url: string
    certification_url?: string
    insurance_url?: string
  }
}

type ActionState = { error?: string; success?: boolean } | null

async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return updateProfile(formData)
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, null)
  const [certUrl, setCertUrl] = useState(initialData.certification_url ?? '')
  const [insuranceUrl, setInsuranceUrl] = useState(initialData.insurance_url ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatar_url ?? '')

  return (
    <form action={formAction} className="space-y-6">
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

      {/* Avatar */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">תמונת פרופיל</Label>
        <ImageUpload
          bucket="instructor-docs"
          folder={`avatars`}
          existingUrls={avatarUrl ? [avatarUrl] : []}
          onUpload={(url) => setAvatarUrl(url)}
          onRemove={() => setAvatarUrl('')}
          maxFiles={1}
          label="העלאת תמונת פרופיל"
        />
        <input type="hidden" name="avatar_url" value={avatarUrl} />
      </div>

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
        <Label htmlFor="phone" className="text-sm font-medium text-gray-700">טלפון</Label>
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
        <Label htmlFor="bio" className="text-sm font-medium text-gray-700">אודות (ביו)</Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={initialData.bio}
          placeholder="ספרי על עצמך, ניסיונך, והסגנון שלך..."
          rows={4}
          className="text-right resize-none"
          dir="rtl"
        />
        <p className="text-xs text-gray-400">תיאור קצר שיופיע בפרופיל שלך</p>
      </div>

      {/* Documents */}
      <div className="space-y-4 pt-2 border-t border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm pt-2">מסמכים מקצועיים</h3>
        <p className="text-xs text-gray-500">
          העלאת מסמכים תגביר את האמון של המארחים. קבצים פרטיים — לא מוצגים לציבור.
        </p>

        {/* Certification */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            <span className="flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-ocean" />
              תעודת הסמכה
            </span>
          </Label>
          {certUrl ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm text-green-700 flex-1">תעודה הועלתה</span>
              <a
                href={certUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-ocean hover:underline flex items-center gap-1"
              >
                צפה <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => setCertUrl('')}
                className="text-xs text-red-500 hover:underline"
              >
                הסר
              </button>
            </div>
          ) : (
            <ImageUpload
              bucket="instructor-docs"
              folder="certifications"
              existingUrls={[]}
              onUpload={(url) => setCertUrl(url)}
              maxFiles={1}
              accept="image/*,application/pdf"
              label="העלאת תעודת הסמכה (תמונה או PDF)"
            />
          )}
          <input type="hidden" name="certification_url" value={certUrl} />
        </div>

        {/* Insurance */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            <span className="flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-ocean" />
              ביטוח אחריות מקצועית
            </span>
          </Label>
          {insuranceUrl ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm text-green-700 flex-1">ביטוח הועלה</span>
              <a
                href={insuranceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-ocean hover:underline flex items-center gap-1"
              >
                צפה <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => setInsuranceUrl('')}
                className="text-xs text-red-500 hover:underline"
              >
                הסר
              </button>
            </div>
          ) : (
            <ImageUpload
              bucket="instructor-docs"
              folder="insurance"
              existingUrls={[]}
              onUpload={(url) => setInsuranceUrl(url)}
              maxFiles={1}
              accept="image/*,application/pdf"
              label="העלאת ביטוח מקצועי (תמונה או PDF)"
            />
          )}
          <input type="hidden" name="insurance_url" value={insuranceUrl} />
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-ocean hover:bg-deep-ocean text-white min-w-32"
        >
          {isPending ? (
            <><Loader2 className="w-4 h-4 ml-2 animate-spin" />שומר...</>
          ) : (
            <><Save className="w-4 h-4 ml-2" />שמירת שינויים</>
          )}
        </Button>
      </div>
    </form>
  )
}
