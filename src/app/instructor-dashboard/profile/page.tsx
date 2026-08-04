import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserProfile } from '@/lib/supabase/queries'
import { ProfileForm } from './ProfileForm'
import { Card, CardContent } from '@/components/ui/card'
import { UserCircle, Camera, CreditCard } from 'lucide-react'
import { GrowKycForm } from '@/components/payments/GrowKycForm'

export default async function InstructorProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')
  if (user.user_metadata?.role !== 'instructor') redirect('/host-dashboard')

  const profile = await getCurrentUserProfile()

  if (!profile) redirect('/auth/login')

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-deep-ocean">הפרופיל שלי</h1>
        <p className="text-gray-500 text-sm mt-1">עדכני את פרטי הפרופיל שלך</p>
      </div>

      {/* Avatar section */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-ocean/20"
                />
              ) : (
                <div className="w-20 h-20 rounded-full ocean-gradient flex items-center justify-center ring-4 ring-ocean/20">
                  <UserCircle className="w-10 h-10 text-white" />
                </div>
              )}
              <div className="absolute -bottom-1 -left-1 w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center border border-gray-200">
                <Camera className="w-3.5 h-3.5 text-gray-500" />
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-lg">{profile.full_name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
              <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-ocean/10 text-ocean">
                מדריכה
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit form — client component */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <ProfileForm
            initialData={{
              full_name: profile.full_name,
              phone: profile.phone ?? '',
              bio: profile.bio ?? '',
              avatar_url: profile.avatar_url ?? '',
              certification_url: profile.certification_url ?? '',
              insurance_url: profile.insurance_url ?? '',
              bit_phone: profile.bit_phone ?? '',
              paybox_phone: profile.paybox_phone ?? '',
              instagram: profile.instagram ?? '',
              specialties: profile.specialties ?? [],
            }}
          />
        </CardContent>
      </Card>

      {/* Grow KYC — payment onboarding */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-ocean" />
            <h2 className="text-base font-bold text-deep-ocean">קבלת תשלומים בכרטיס אשראי</h2>
          </div>
          <GrowKycForm
            initialFullName={profile.full_name}
            initialPhone={profile.phone ?? ''}
            existingMerchantId={profile.grow_merchant_id}
          />
        </CardContent>
      </Card>
    </div>
  )
}
