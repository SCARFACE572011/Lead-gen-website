'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LEAD_CATEGORIES } from '@/types/lead'
import { MapPin, Target, Zap, ArrowRight, CheckCircle, Bell } from 'lucide-react'

const STORAGE_KEY = 'leadzip_onboarding_complete'

// Only surface onboarding inside the app — never over the marketing landing,
// auth, or legal pages (the landing hero already carries a search widget).
const APP_PREFIXES = ['/dashboard', '/search', '/saved', '/history', '/exports', '/settings', '/admin', '/saved-searches']

interface Preset {
  id: string
  icon: React.ReactNode
  label: string
  description: string
  params: Record<string, string>
}

const PRESETS: Preset[] = [
  { id: 'no_website', icon: <span className="text-2xl">🚫</span>, label: 'No Website', description: 'Businesses with no online presence — perfect for web design & local SEO agencies.', params: { noWebsite: 'true' } },
  { id: 'needs_seo', icon: <span className="text-2xl">📈</span>, label: 'Needs SEO', description: 'Established businesses with a website but weak digital marketing.', params: { hasWebsite: 'true', minRating: '3.5' } },
  { id: 'established', icon: <span className="text-2xl">⭐</span>, label: 'Established', description: 'High-rated businesses with lots of reviews — ideal for premium services.', params: { minRating: '4', minReviews: '25' } },
  { id: 'all', icon: <span className="text-2xl">🔍</span>, label: 'Show Everything', description: 'No filters — see all businesses in the area.', params: {} },
]

export function OnboardingModal() {
  const router = useRouter()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [zipCode, setZipCode] = useState('')
  const [category, setCategory] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string>('all')
  const [zipError, setZipError] = useState('')
  const [catError, setCatError] = useState('')

  useEffect(() => {
    const inApp = APP_PREFIXES.some((p) => pathname?.startsWith(p))
    // Legitimate post-hydration setState: localStorage is client-only and a lazy
    // initializer would cause a hydration mismatch (modal lives in the root layout).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (inApp && !localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [pathname])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  function handleStep1Next() {
    let valid = true
    if (!zipCode.trim() || zipCode.trim().length < 5) { setZipError('Enter a valid 5-digit ZIP code'); valid = false } else setZipError('')
    if (!category) { setCatError('Pick a category to continue'); valid = false } else setCatError('')
    if (valid) setStep(1)
  }

  function handleLaunch() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
    const preset = PRESETS.find((p) => p.id === selectedPreset)
    const params = new URLSearchParams({ zip: zipCode.trim(), category, radius: '25', ...preset?.params })
    router.push(`/search?${params.toString()}`)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/70 backdrop-blur-sm">
      <div className="grain relative w-full max-w-lg overflow-hidden rounded-3xl bg-paper shadow-2xl ring-1 ring-black/5">
        {/* Progress bar */}
        <div className="relative flex gap-1.5 p-5 pb-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-signal' : 'bg-sand'}`} />
          ))}
        </div>

        {/* Step 1: ZIP + Category */}
        {step === 0 && (
          <div className="relative space-y-5 p-6">
            <div>
              <h2 className="font-display text-xl font-extrabold text-ink">Welcome to LeadZipp 👋</h2>
              <p className="mt-1 text-sm text-stone">Let&apos;s find your first batch of leads. Takes 30 seconds.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-soft">
                  <MapPin className="mr-1 inline h-3.5 w-3.5 text-signal" /> Target ZIP code
                </label>
                <input
                  type="text" inputMode="numeric" maxLength={5} value={zipCode}
                  onChange={(e) => { setZipCode(e.target.value.replace(/\D/g, '')); setZipError('') }}
                  placeholder="e.g. 90210"
                  className="w-full rounded-xl border border-sand bg-white px-3 py-2.5 font-mono text-sm text-ink placeholder:text-stone/50 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
                />
                {zipError && <p className="mt-1 text-xs text-signal-600">{zipError}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-soft">
                  <Target className="mr-1 inline h-3.5 w-3.5 text-signal" /> Business category
                </label>
                <select
                  value={category} onChange={(e) => { setCategory(e.target.value); setCatError('') }}
                  className="w-full rounded-xl border border-sand bg-white px-3 py-2.5 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
                >
                  <option value="">Select a category…</option>
                  {LEAD_CATEGORIES.filter((c) => c !== 'Custom Keyword').map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
                {catError && <p className="mt-1 text-xs text-signal-600">{catError}</p>}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <button onClick={dismiss} className="text-sm text-stone transition-colors hover:text-ink">Skip setup</button>
              <button onClick={handleStep1Next} className="flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-600">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Use case preset */}
        {step === 1 && (
          <div className="relative space-y-4 p-6">
            <div>
              <h2 className="font-display text-xl font-extrabold text-ink">What kind of leads?</h2>
              <p className="mt-1 text-sm text-stone">Pick your focus — you can always change filters later.</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id} onClick={() => setSelectedPreset(preset.id)}
                  className={`relative rounded-2xl border-2 p-3.5 text-left transition-all ${selectedPreset === preset.id ? 'border-signal bg-signal-50' : 'border-sand bg-white hover:border-stone/40'}`}
                >
                  {selectedPreset === preset.id && (<CheckCircle className="absolute right-2.5 top-2.5 h-4 w-4 text-signal" />)}
                  <div className="mb-1.5">{preset.icon}</div>
                  <p className="text-sm font-semibold text-ink">{preset.label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-stone">{preset.description}</p>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setStep(0)} className="text-sm text-stone transition-colors hover:text-ink">← Back</button>
              <button onClick={() => setStep(2)} className="flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-600">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Launch */}
        {step === 2 && (
          <div className="relative space-y-5 p-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-forest">
                <Zap className="h-8 w-8 text-lime" />
              </div>
            </div>
            <div>
              <h2 className="font-display text-xl font-extrabold text-ink">You&apos;re all set!</h2>
              <p className="mt-1 text-sm text-stone">Here&apos;s what we&apos;ll search for:</p>
            </div>
            <div className="space-y-2 rounded-2xl border border-sand bg-paper-2 p-4 text-left">
              {[['Category', category], ['ZIP code', zipCode], ['Radius', '25 miles'], ['Focus', PRESETS.find((p) => p.id === selectedPreset)?.label]].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between text-sm">
                  <span className="text-stone">{k}</span>
                  <span className="font-semibold text-ink">{v}</span>
                </div>
              ))}
            </div>
            {/* Retention hook: surface the saved-search + email-alert monitoring
                feature so new users discover it right after their first search */}
            <div className="flex items-start gap-2.5 rounded-2xl border border-forest/20 bg-forest/5 p-3.5 text-left">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
              <p className="text-xs leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">We&apos;ll watch this territory for you.</span>{' '}
                Save any search and we&apos;ll email you when new businesses appear — so you reach
                them before your competitors do.
              </p>
            </div>
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setStep(1)} className="text-sm text-stone transition-colors hover:text-ink">← Back</button>
              <button onClick={handleLaunch} className="flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-600">
                Find my first leads <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
