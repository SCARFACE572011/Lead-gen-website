'use client'

import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { EyeOff, MapPin, MessageCircle, Send, X } from 'lucide-react'

// Sales + support chat. It lives on the right, can be hidden persistently, and
// can be restored from Settings > Notifications.
const STORAGE_KEY = 'leadzipp_chat_v1'
export const CHAT_HIDDEN_KEY = 'leadzipp_chat_hidden_v1'
export const CHAT_VISIBILITY_EVENT = 'leadzipp:chat-visibility'
const LABEL_DELAY_MS = 4000
const SUPPORT_EMAIL = 'support@leadzipp.com'
const MAX_MESSAGE_CHARS = 1000
const HISTORY_SENT = 12

const GREETING =
  'Hi! I am the LeadZipp assistant. Ask me anything about pricing, finding leads, or your account and I will point you the right way.'

const QUICK_QUESTIONS = [
  'How does pricing work?',
  'How do I find leads?',
  'What is the free trial?',
]

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const { role, content } = value as { role?: unknown; content?: unknown }
  return (role === 'user' || role === 'assistant') && typeof content === 'string'
}

function loadStoredMessages(): ChatMessage[] {
  const fallback: ChatMessage[] = [{ role: 'assistant', content: GREETING }]
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(isChatMessage)
      if (valid.length > 0) return valid
    }
  } catch {
    // private mode or corrupted entry: start fresh
  }
  return fallback
}

function TypingIndicator({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div
      className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-md border border-sand bg-paper-2 px-3.5 py-3"
      aria-label="Assistant is typing"
    >
      {[0, 1, 2].map((i) =>
        reduceMotion ? (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-stone" />
        ) : (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-stone"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
          />
        )
      )}
    </div>
  )
}

export function ChatWidget() {
  const reduceMotion = useReducedMotion()

  const [open, setOpen] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(loadStoredMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [humanOpen, setHumanOpen] = useState(false)
  const [hidden, setHidden] = useState(false)

  const openedOnceRef = useRef(false)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // "Need help?" nudge appears after a few seconds, once, until the chat is opened.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(window.localStorage.getItem(CHAT_HIDDEN_KEY) === 'true')
    } catch {
      // Storage can be unavailable in private browsing; keep help visible.
    }

    const syncVisibility = (event: Event) => {
      const detail = (event as CustomEvent<{ hidden?: boolean }>).detail
      setHidden(detail?.hidden === true)
    }
    window.addEventListener(CHAT_VISIBILITY_EVENT, syncVisibility)
    const timer = window.setTimeout(() => {
      if (!openedOnceRef.current) setShowLabel(true)
    }, LABEL_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(CHAT_VISIBILITY_EVENT, syncVisibility)
    }
  }, [])

  // Persist the conversation for the browsing session.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // ignore storage failures
    }
  }, [messages])

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading, open])

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 90)
    return () => window.clearTimeout(timer)
  }, [open])

  const openChat = () => {
    openedOnceRef.current = true
    setShowLabel(false)
    setOpen(true)
  }

  const closeChat = () => {
    setOpen(false)
    window.setTimeout(() => launcherRef.current?.focus(), 90)
  }

  const hideChat = () => {
    setOpen(false)
    setShowLabel(false)
    setHidden(true)
    try { window.localStorage.setItem(CHAT_HIDDEN_KEY, 'true') } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent(CHAT_VISIBILITY_EVENT, { detail: { hidden: true } }))
  }

  // Escape closes; Tab is trapped inside the panel while it is open.
  const handlePanelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      closeChat()
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
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const send = async (raw: string) => {
    const text = raw.trim().slice(0, MAX_MESSAGE_CHARS)
    if (!text || loading) return

    // History is the conversation before this message; the server gets the
    // new message separately and drops the leading assistant greeting itself.
    const history = messages.slice(-HISTORY_SENT).map(({ role, content }) => ({ role, content }))

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)

    let reply: string
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      const data = (await res.json().catch(() => null)) as { reply?: string } | null
      if (res.ok && data?.reply) {
        reply = data.reply
      } else if (res.status === 429) {
        reply =
          'You are sending messages a bit quickly. Give it a moment and try again, or email ' +
          SUPPORT_EMAIL +
          '.'
      } else {
        reply =
          'Something went wrong on my end. Please try again, or email ' + SUPPORT_EMAIL + '.'
      }
    } catch {
      reply =
        'I could not reach the server. Check your connection and try again, or email ' +
        SUPPORT_EMAIL +
        '.'
    }
    setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    setLoading(false)
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void send(input)
  }

  const showChips = messages.length <= 1 && !loading

  if (hidden) return null

  return (
    <>
      {/* Collapsed launcher, bottom-right. It rides above the measured consent
          banner on first visit and returns to the corner after a choice. */}
      {!open && (
        <div className="fixed bottom-[calc(0.75rem+var(--consent-banner-h,0px))] right-3 z-[55] flex items-center gap-2.5 sm:bottom-[calc(1rem+var(--consent-banner-h,0px))] sm:right-4">
          <AnimatePresence>
            {showLabel && (
              <motion.button
                onClick={openChat}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="hidden rounded-full border border-sand bg-white px-3.5 py-2 text-[13px] font-semibold text-ink shadow-card transition-colors hover:border-signal hover:text-signal sm:block"
              >
                Need help?
              </motion.button>
            )}
          </AnimatePresence>

          <div className="relative">
          <button
            ref={launcherRef}
            onClick={openChat}
            aria-label="Open LeadZipp support chat"
            aria-haspopup="dialog"
            className="relative flex h-12 w-12 items-center justify-center rounded-full bg-signal text-white sm:h-14 sm:w-14 shadow-[0_8px_24px_-6px_rgba(255,77,35,0.5)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2"
          >
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
            {!reduceMotion && (
              <motion.span
                className="absolute inset-0 rounded-full ring-2 ring-signal"
                initial={{ opacity: 0.45, scale: 1 }}
                animate={{ opacity: 0, scale: 1.45 }}
                transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.2, ease: 'easeOut' }}
                aria-hidden="true"
              />
            )}
          </button>
            <button
              onClick={hideChat}
              aria-label="Hide help button"
              title="Hide help button (restore it in Settings)"
              className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-sand bg-white text-stone shadow-sm transition-colors hover:border-signal hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Expanded panel: full-width sheet on mobile, card on desktop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="LeadZipp assistant chat"
            onKeyDown={handlePanelKeyDown}
            // `initial={false}` skips the entrance animation outright — the
            // panel mounts straight into its `animate` state — rather than
            // just shrinking the motion, so this matches how HeroMap and
            // PromoPopup degrade to no motion under prefers-reduced-motion.
            initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : { type: 'spring', stiffness: 360, damping: 30, mass: 0.9 }
            }
            className="fixed inset-x-0 bottom-0 z-[80] flex h-[75dvh] flex-col overflow-hidden rounded-t-2xl border border-sand bg-white shadow-[0_12px_40px_-12px_rgba(23,19,14,0.35)] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[560px] sm:max-h-[calc(100dvh-2rem)] sm:w-[380px] sm:rounded-2xl"
          >
            {/* thin signal rule, same motif as the promo popup */}
            <div className="h-1 w-full shrink-0 bg-signal" />

            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-sand px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal text-white">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[15px] font-extrabold leading-tight text-ink">
                  LeadZipp Assistant
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-stone">
                  <span className="h-1.5 w-1.5 rounded-full bg-lime ring-2 ring-lime/30" aria-hidden="true" />
                  Typically replies instantly
                </p>
              </div>
              <button
                onClick={hideChat}
                aria-label="Hide help widget"
                title="Hide help widget (restore it in Settings)"
                className="flex h-8 w-8 items-center justify-center rounded-full text-stone transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand"
              >
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                onClick={closeChat}
                aria-label="Close chat"
                className="flex h-8 w-8 items-center justify-center rounded-full text-stone transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              {messages.map((msg, i) =>
                msg.role === 'user' ? (
                  <p
                    key={i}
                    className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-signal px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white"
                  >
                    {msg.content}
                  </p>
                ) : (
                  <p
                    key={i}
                    className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-sand bg-paper-2 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink"
                  >
                    {msg.content}
                  </p>
                )
              )}
              {loading && <TypingIndicator reduceMotion={!!reduceMotion} />}
            </div>

            {/* Quick questions */}
            {showChips && (
              <div className="flex shrink-0 flex-wrap gap-2 px-4 pb-3">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => void send(q)}
                    className="rounded-full border border-sand bg-white px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-signal hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Composer */}
            <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-2 border-t border-sand p-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={MAX_MESSAGE_CHARS}
                placeholder="Ask about LeadZipp..."
                aria-label="Type your message"
                className="h-10 min-w-0 flex-1 rounded-full border border-sand bg-paper px-4 text-sm text-ink placeholder:text-stone focus:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-signal text-white transition-colors hover:bg-signal-600 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            {/* Human escape hatch */}
            <div className="shrink-0 border-t border-sand bg-paper px-4 py-2.5">
              {humanOpen ? (
                <p className="text-center text-xs text-ink-soft">
                  Email{' '}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="font-semibold text-signal hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>{' '}
                  and a real person will reply.
                </p>
              ) : (
                <button
                  onClick={() => setHumanOpen(true)}
                  className="mx-auto block text-xs font-medium text-stone transition-colors hover:text-ink"
                >
                  Talk to a human
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
