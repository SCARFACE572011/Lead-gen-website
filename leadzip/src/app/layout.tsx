import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import { CookieConsent } from "@/components/CookieConsent"
import { OnboardingModal } from "@/components/OnboardingModal";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LeadZip — Find Local Business Leads by ZIP Code",
  description:
    "Search by location, industry, and radius. Find businesses that need your services. Export and outreach — all in one place.",
  keywords: ["lead generation", "local business leads", "ZIP code search", "B2B leads", "sales prospecting"],
  metadataBase: new URL("https://leadzip.vercel.app"),
  openGraph: {
    title: "LeadZip — Find Local Business Leads by ZIP Code",
    description: "Search by location, industry, and radius. Find businesses that need your services.",
    url: "https://leadzip.vercel.app",
    siteName: "LeadZip",
    images: [{ url: "/og?title=Find+Local+Business+Leads+by+ZIP+Code", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadZip — Find Local Business Leads by ZIP Code",
    description: "Search by location, industry, and radius. Find businesses that need your services.",
    images: ["/og?title=Find+Local+Business+Leads+by+ZIP+Code"],
  },
  alternates: { canonical: "https://leadzip.vercel.app" },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {/* GTM noscript fallback */}
        {process.env.NEXT_PUBLIC_GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${process.env.NEXT_PUBLIC_GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}

        {children}
        <Toaster richColors position="top-center" />
        <CookieConsent />
        <OnboardingModal />

        {/* GTM script */}
        {process.env.NEXT_PUBLIC_GTM_ID && (
          <Script id="gtm" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${process.env.NEXT_PUBLIC_GTM_ID}');`}
          </Script>
        )}

        {/* GA4 fallback (only when no GTM) */}
        {process.env.NEXT_PUBLIC_GA4_ID && !process.env.NEXT_PUBLIC_GTM_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA4_ID}');`}
            </Script>
          </>
        )}
        </ThemeProvider>
      </body>
    </html>
  );
}
