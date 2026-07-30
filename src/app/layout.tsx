import type { Metadata } from 'next'
import './globals.css'
import { ChatWidget } from '@/components/ai/ChatWidget'
import { WaveTransition } from '@/components/ui/wave-transition'
import { SeaAmbience } from '@/components/ui/sea-ambience'
import { NativeProvider } from '@/components/native/NativeProvider'

export const metadata: Metadata = {
  title: 'WELLNESS&SEA | השכרת חללים למדריכי יוגה ופילאטיס',
  description: 'פלטפורמה המחברת מסעדות חוף עם מדריכי יוגה ופילאטיס. השכרי את החלל שלך בשעות הבוקר וצרי הכנסה פסיבית.',
  keywords: ['יוגה', 'פילאטיס', 'השכרת חלל', 'מסעדות חוף', 'ישראל'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <SeaAmbience />
        {/*
         * NativeProvider wraps the entire app to:
         *   • Initialise push notifications on iOS (no-op on web)
         *   • Show offline banner on all platforms
         *   • Handle app lifecycle events (auth refresh on foreground)
         * It is a Client Component but has zero rendering impact on web.
         */}
        <NativeProvider>
          {children}
          <ChatWidget />
          <WaveTransition />
        </NativeProvider>
      </body>
    </html>
  )
}
