'use client'

import { COOKIE_PREFERENCES_EVENT } from '@/components/CookieConsent'

/**
 * The one interactive element in the marketing footer, isolated in its own
 * client file so SiteFooter itself stays server-renderable.
 */
export function CookiePreferencesButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT))}
      className="inline-flex min-h-11 items-center hover:text-white md:min-h-0 md:py-1"
    >
      Cookie preferences
    </button>
  )
}
