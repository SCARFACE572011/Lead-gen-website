'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import {
  ANALYTICS_CONSENT_EVENT,
  hasAnalyticsConsent,
  type AnalyticsConsent,
} from '@/lib/analytics'

// Keep these as literal NEXT_PUBLIC_* references so Next.js can inline them in
// the client bundle. GTM remains authoritative when both values are present.
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || process.env.NEXT_PUBLIC_GA

/**
 * Load Google only after analytics consent. The root layout has already queued
 * Consent Mode (plus direct GA4 config for a saved grant) without making a
 * network request, so the external script can safely consume the queue here.
 */
export function AnalyticsScripts() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const syncFromStorage = () => setEnabled(hasAnalyticsConsent())
    const syncFromChoice = (event: Event) => {
      const choice = (event as CustomEvent<AnalyticsConsent>).detail
      setEnabled(choice === 'all')
    }

    syncFromStorage()
    window.addEventListener(ANALYTICS_CONSENT_EVENT, syncFromChoice)
    window.addEventListener('storage', syncFromStorage)

    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, syncFromChoice)
      window.removeEventListener('storage', syncFromStorage)
    }
  }, [])

  if (!enabled) return null

  if (GTM_ID) {
    return (
      <Script id="gtm" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>
    )
  }

  if (GA4_ID) {
    return (
      <Script
        id="ga4-source"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
        strategy="afterInteractive"
      />
    )
  }

  return null
}
