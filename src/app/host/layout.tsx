import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      {children}
      <Footer />
    </div>
  )
}
