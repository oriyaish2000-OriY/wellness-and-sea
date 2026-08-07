import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserProfile } from '@/lib/supabase/queries'
import { Card, CardContent } from '@/components/ui/card'
import { UserCircle, Camera } from 'lucide-react'
import { ProfileForm } from './ProfileForm'
import { CardcomTokenSection } from '@/components/payments/CardcomTokenSection'

export default async function HostProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')
  if (user.user_metadata?.role !== 'host') redirect('/instructor-dashboard')

  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/auth/login')

  // Load Cardcom token fields
  const { data: tokenData } = await supabase
    .from('profiles')
    .select('cardcom_token, cardcom_token_card_month, cardcom_token_card_year')
    .eq('id', user.id)
    .single()

  const params = await searchParams
  const tokenSuccess = params.token === 'success'

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-deep-ocean">הפרופיל שלי</h1>
        <p className="text-gray-500 text-sm mt-1">עדכני את פרטי הפרופיל שלך</p>
      </div>

      {tokenSuccess && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800 font-medium">
          ✓ הכרטיס נרשם בהצלחה — העמלות ינוכו אוטומטית מעכשיו
        </div>
      )}

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
                מארחת
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit form */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <ProfileForm
            initialData={{
              full_name:    profile.full_name,
              phone:        profile.phone ?? '',
              bio:          profile.bio ?? '',
              avatar_url:   profile.avatar_url ?? '',
              bank_account: profile.bank_account ?? '',
              bit_phone:    profile.bit_phone ?? '',
              paybox_phone: profile.paybox_phone ?? '',
            }}
          />
        </CardContent>
      </Card>

      {/* Cardcom token registration — required for commission deduction */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <CardcomTokenSection
            hasToken={!!tokenData?.cardcom_token}
            cardMonth={tokenData?.cardcom_token_card_month}
            cardYear={tokenData?.cardcom_token_card_year}
            role="host"
          />
        </CardContent>
      </Card>
    </div>
  )
}
