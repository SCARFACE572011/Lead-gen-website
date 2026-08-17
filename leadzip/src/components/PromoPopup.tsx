'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MapPin, X } from 'lucide-react'

// Fires once per browser. When claimed, CLAIM_KEY tells the pricing page to ask
// checkout to auto-apply the 15%-off coupon. DISMISS_KEY stops it reappearing.
const DISMISS_KEY = 'leadzipp_promo_v1_dismissed'
const CLAIM_KEY = 'leadzipp_promo15'
// Long enough that the hero lands first, short enough to catch a visitor who is
// still deciding. Most sessions that bounce are gone well before 30 seconds.
const DELAY_MS = 8_000

// The popup only belongs on marketing pages. Anything under the app or the auth
// flow is off-limits (a logged-in owner shouldn't be pitched a signup discount).
const APP_ROUTE_PREFIXES = [
  '/dashboard',
  '/admin',
  '/login',
  '/signup',
  '/onboarding',
  '/forgot-password',
  '/reset-password',
  '/verify',
  '/account',
  '/settings',
]

function isAppRoute(path: string | null): boolean {
  if (!path) return false
  return APP_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
}

function looksLoggedIn(): boolean {
  try {
    // Supabase drops an sb-<ref>-auth-token cookie once authenticated.
    return document.cookie.includes('-auth-token')
  } catch {
    return false
  }
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

export function PromoPopup() {
  const pathname = usePathname()
  const router = useRouter()
  const reduceMotion = useReducedMotion()

  const [ready, setReady] = useState(false)
  // Dismissal lives in state, not only in localStorage, because the stored flag
  // is read once on mount and so cannot stop a reveal that is already armed.
  const [dismissed, setDismissed] = useState(false)

  const audioRef = useRef<AudioContext | null>(null)
  const pingedRef = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  // Lazily build (and keep) an AudioContext, unlocked by a real user gesture so
  // the browser's autoplay policy lets the chime through when the popup lands.
  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current
    try {
      const Ctor = window.AudioContext || (window as WebkitWindow).webkitAudioContext
      if (!Ctor) return null
      audioRef.current = new Ctor()
      return audioRef.current
    } catch {
      return null
    }
  }, [])

  // A soft two-note chime. Gentle gain envelope, quick decay: a cute "ti-ding",
  // not an alarm.
  const playPing = useCallback(() => {
    const ctx = ensureAudio()
    if (!ctx) return
    const start = () => {
      const now = ctx.currentTime
      const master = ctx.createGain()
      master.gain.value = 0.5
      master.connect(ctx.destination)
      const notes = [
        { f: 987.77, t: 0 }, // B5
        { f: 1318.51, t: 0.09 }, // E6
      ]
      for (const { f, t } of notes) {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = f
        const s = now + t
        g.gain.setValueAtTime(0.0001, s)
        g.gain.exponentialRampToValueAtTime(0.12, s + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.34)
        osc.connect(g)
        g.connect(master)
        osc.start(s)
        osc.stop(s + 0.4)
      }
    }
    if (ctx.state === 'suspended') {
      ctx.resume().then(start).catch(() => {})
    } else {
      start()
    }
  }, [ensureAudio])

  // Start the reveal timer once, and pre-unlock audio on the first interaction.
  useEffect(() => {
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      // private mode — treat as not dismissed
    }
    if (dismissed || looksLoggedIn()) return

    const unlock = () => ensureAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })

    const timer = window.setTimeout(() => setReady(true), DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [ensureAudio])

  // Only surface on a marketing route. If the timer fired while the visitor was
  // deeper in the app, it waits and appears when they return to a public page.
  const shouldShow = ready && !dismissed && !isAppRoute(pathname)

  // Visibility is DERIVED from shouldShow, never mirrored into a second piece
  // of state. An earlier version kept an `open` state and set it from an effect
  // that also depended on `open`, so dismissing flipped it false and the same
  // effect immediately set it true again. The close button looked dead. Deriving
  // removes that whole class of bug rather than patching it.
  //
  // The effect below only talks to an external system (the audio context),
  // which is what effects are for.
  useEffect(() => {
    if (shouldShow && !pingedRef.current) {
      pingedRef.current = true
      playPing()
    }
  }, [shouldShow, playPing])

  // This popup appears unprompted on a timer, so nothing has told a keyboard
  // or screen-reader user it is there. Moving focus into it on reveal is what
  // makes the dialog role actually get announced, and stashing whatever was
  // focused before lets a dismissal put focus back exactly where it was.
  useEffect(() => {
    if (!shouldShow) return
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => panelRef.current?.focus(), 90)
    return () => window.clearTimeout(timer)
  }, [shouldShow])

  const restoreFocus = () => {
    window.setTimeout(() => previouslyFocusedRef.current?.focus?.(), 90)
  }

  const persist = (key: string) => {
    try {
      localStorage.setItem(key, '1')
    } catch {
      // ignore
    }
  }

  const dismiss = () => {
    persist(DISMISS_KEY)
    setDismissed(true)
    restoreFocus()
  }

  const claim = () => {
    persist(CLAIM_KEY)
    persist(DISMISS_KEY)
    setDismissed(true)
    router.push('/signup')
  }

  // Escape dismisses; Tab is trapped inside the panel while it is showing, the
  // same pattern the chat widget uses.
  const handlePanelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      dismiss()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    const focusables = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])"
      )
    ).filter((el) => el.offsetParent !== null)
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    // Initial focus lands on the panel itself (see the effect above), which is
    // not one of `focusables`, so it needs its own wrap case: Tab from there
    // should land on `first`, Shift+Tab should wrap to `last`.
    const onContainer = document.activeElement === panelRef.current
    if (e.shiftKey && (document.activeElement === first || onContainer)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (document.activeElement === last || onContainer)) {
      e.preventDefault()
      first.focus()
    }
  }

  const enter = { opacity: 1, y: 0, scale: 1 }
  const from = reduceMotion
    ? { opacity: 0, y: 0, scale: 1 }
    : { opacity: 0, y: 24, scale: 0.96 }

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          key="promo"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="New signup offer"
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
          initial={from}
          animate={enter}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
          transition={
            reduceMotion
              ? { duration: 0.15 }
              : { type: 'spring', stiffness: 360, damping: 30, mass: 0.9 }
          }
          // On phones this card spans the full width, so it is lifted clear of
          // the chat launcher (a 56px circle at bottom-4 left-4) instead of
          // covering it. From sm up the two sit in opposite corners.
          className="fixed bottom-24 right-4 left-4 z-[70] outline-none sm:bottom-4 sm:left-auto sm:w-[340px]"
        >
          <div className="relative overflow-hidden rounded-2xl border border-sand bg-white shadow-[0_12px_40px_-12px_rgba(23,19,14,0.35)]">
            {/* thin signal rule at the very top */}
            <div className="h-1 w-full bg-signal" />

            <button
              onClick={dismiss}
              aria-label="Dismiss offer"
              className="absolute right-2.5 top-3 flex h-7 w-7 items-center justify-center rounded-full text-stone transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="px-5 pb-5 pt-4">
              <div className="flex items-center gap-3">
                {/* pin beacon with a soft ping ring */}
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal text-white">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                  {!reduceMotion && (
                    <motion.span
                      className="absolute inset-0 rounded-xl ring-2 ring-signal"
                      initial={{ opacity: 0.5, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.55 }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                      aria-hidden="true"
                    />
                  )}
                </span>
                <div>
                  <span className="readout text-[11px] font-semibold uppercase tracking-[0.14em] text-signal">
                    Welcome offer
                  </span>
                  <p className="font-display text-[19px] font-extrabold leading-tight text-ink">
                    15% off your first month
                  </p>
                </div>
              </div>

              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
                New to LeadZipp? Sign up today and take 15% off your first month.
                It gets applied for you at checkout, so there is no code to
                remember.
              </p>

              <button
                onClick={claim}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-signal px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2"
              >
                Claim my 15% off
                <span aria-hidden="true">→</span>
              </button>

              <button
                onClick={dismiss}
                className="mt-2 w-full rounded-md text-center text-xs font-medium text-stone transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand"
              >
                Maybe later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
