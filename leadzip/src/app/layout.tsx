import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import { CookieConsent } from "@/components/CookieConsent"
import { AnalyticsScripts } from "@/components/AnalyticsScripts";
import { DeferredWidgets } from "@/components/landing/DeferredWidgets";
import StructuredData from "@/components/seo/StructuredData";
import { SITE_URL } from "@/components/seo/site";

// Both names are read because the deployed environment defines
// NEXT_PUBLIC_GA while the code was originally written against
// NEXT_PUBLIC_GA4_ID. Each must be referenced literally, since Next inlines
// NEXT_PUBLIC_* at build time and cannot resolve a computed lookup.
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || process.env.NEXT_PUBLIC_GA;
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const HAS_GOOGLE_ANALYTICS = Boolean(GTM_ID || GA4_ID);

// This tiny first-party bootstrap makes the privacy choice authoritative before
// any Google code can run. It queues Consent Mode locally but does not make a
// network request; AnalyticsScripts loads Google only after an explicit grant.
const GOOGLE_CONSENT_BOOTSTRAP = `(function(w){
w.dataLayer=w.dataLayer||[];
w.gtag=w.gtag||function(){w.dataLayer.push(arguments);};
var choice=null;
try{choice=w.localStorage.getItem('leadzip_cookie_consent');}catch(e){}
var granted=choice==='all';
w.gtag('consent','default',{
analytics_storage:granted?'granted':'denied',
ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'
});
${GA4_ID && !GTM_ID ? `if(granted){w.__leadzipGa4Configured=true;w.gtag('js',new Date());w.gtag('config',${JSON.stringify(GA4_ID)});}` : ""}
})(window);`;

const SITE_TITLE =
  "Local Business Leads by ZIP Code | LeadZipp";
const SITE_DESCRIPTION =
  "Find and score local business leads by ZIP code or city with live Google and Yelp data. Get phones, websites and emails, then export to your CRM.";
const OG_IMAGE = "/og?title=Find+local+business+leads.&subtitle=Scored+prospects+by+ZIP+code,+city,+category,+and+radius";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans overflow-x-hidden">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-signal focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
        >
          Skip to content
        </a>
        {HAS_GOOGLE_ANALYTICS && (
          <Script id="google-consent-default" strategy="beforeInteractive">
            {GOOGLE_CONSENT_BOOTSTRAP}
          </Script>
        )}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
        {/* SEO — JSON-LD structured data (Organization, WebSite, SoftwareApplication, FAQ) */}
        <StructuredData />

        {children}
        <Toaster richColors position="top-center" />
        <CookieConsent />
        <DeferredWidgets />
        <AnalyticsScripts />
        </ThemeProvider>
      </body>
    </html>
  );
}
