import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "LeadZip Owner Portal",
  description: "Owner management portal for LeadZip",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#F8FAFC] font-sans">
        {children}
      </body>
    </html>
  )
}
