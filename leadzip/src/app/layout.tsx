import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import { CookieConsent } from "@/components/CookieConsent"
import { OnboardingModal } from "@/components/OnboardingModal";
import StructuredData from "@/components/seo/StructuredData";

// Display — characterful modern grotesque, used with restraint for headlines
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Body — warm, highly readable
const hanken = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Data — ZIP codes, coordinates, stats rendered like map readouts
const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const SITE_TITLE = "LeadZipp | Find local business leads by ZIP code";
const SITE_DESCRIPTION =
  "Drop a pin, fill your pipeline. LeadZipp turns any ZIP code into a scored list of real local businesses from live Google Places and Yelp data, with phones, websites, and owner emails, ready to export to CSV, PDF, or your CRM.";
const OG_IMAGE = "/og?title=Drop+a+pin.+Fill+your+pipeline.&subtitle=Scored+local+business+leads,+by+ZIP+code";

export const metadata: Metadata = {
  metadataBase: new URL("https://leadzipp.com"),
  title: {
    default: SITE_TITLE,
    template: "%s | LeadZipp",
  },
  description: SITE_DESCRIPTION,
  applicationName: "LeadZipp",
  keywords: [
    "lead generation",
    "local business leads",
    "ZIP code business search",
    "B2B leads",
    "sales prospecting",
    "local lead finder",
    "Google Places leads",
    "Yelp business data",
    "email finder",
    "lead scoring",
    "CSV lead export",
    "CRM lead export",
  ],
  authors: [{ name: "LeadZipp" }],
  creator: "LeadZipp",
  publisher: "LeadZipp",
  category: "business",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "https://leadzipp.com",
    siteName: "LeadZipp",
    locale: "en_US",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "LeadZipp: type a ZIP code, get the whole street",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  alternates: { canonical: "https://leadzipp.com" },
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
      className={`${bricolage.variable} ${hanken.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans overflow-x-hidden">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
        {/* SEO — JSON-LD structured data (Organization, WebSite, SoftwareApplication, FAQ) */}
        <StructuredData />

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
