'use client'

import { useState, useEffect } from 'react'

const CONSENT_KEY = 'leadzip_cookie_consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisible(true)
      }
    } catch {
      // SSR / privacy mode guard
    }
  }, [])

  if (!visible) return null

  const accept = (type: 'all' | 'necessary') => {
    try {
      localStorage.setItem(CONSENT_KEY, type)
    } catch {
      // ignore
    }
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-sand bg-white px-5 py-4 shadow-2xl md:bottom-4 md:left-4 md:right-auto md:max-w-sm md:rounded-xl md:border md:border-sand"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal/10">
          <svg
            className="h-4 w-4 text-signal"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink">Cookie Preferences</p>
          <p className="mt-1 text-xs leading-relaxed text-stone">
            We use cookies for analytics and to improve your experience. See our{' '}
            <a
              href="/privacy"
              className="font-medium text-signal hover:text-signal-600 transition-colors underline underline-offset-2"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => accept('all')}
          className="flex-1 rounded-lg bg-signal px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          Accept All
        </button>
        <button
          onClick={() => accept('necessary')}
          className="flex-1 rounded-lg border border-sand px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-stone hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand"
        >
          Necessary Only
        </button>
      </div>
    </div>
  )
}
