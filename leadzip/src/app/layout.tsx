import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import { CookieConsent } from "@/components/CookieConsent"
import { OnboardingModal } from "@/components/OnboardingModal";
import { PromoPopup } from "@/components/PromoPopup";
import { ChatWidget } from "@/components/chat/ChatWidget";
import StructuredData from "@/components/seo/StructuredData";
import { SITE_URL } from "@/components/seo/site";

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

const SITE_TITLE =
  "Local Business Lead Generation for Agencies by ZIP Code | LeadZipp";
const SITE_DESCRIPTION =
  "Find local businesses without websites and turn them into clients. LeadZipp builds scored lead lists by ZIP code from live Google Places and Yelp data, with phones and owner emails, for web design agencies, freelancers, and sales teams.";
const OG_IMAGE = "/og?title=Drop+a+pin.+Fill+your+pipeline.&subtitle=Scored+local+business+leads,+by+ZIP+code";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | LeadZipp",
  },
  description: SITE_DESCRIPTION,
  applicationName: "LeadZipp",
  keywords: [
    "local business lead generation",
    "lead generation for agencies",
    "find businesses without a website",
    "local business leads",
    "ZIP code business search",
    "web design leads",
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
    url: SITE_URL,
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
  alternates: { canonical: SITE_URL },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
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
        <PromoPopup />
        <ChatWidget />

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
