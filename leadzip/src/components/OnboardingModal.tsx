'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LEAD_CATEGORIES } from '@/types/lead'
import { MapPin, Target, Zap, ArrowRight, CheckCircle } from 'lucide-react'

const STORAGE_KEY = 'leadzip_onboarding_complete'

interface Preset {
  id: string
  icon: React.ReactNode
  label: string
  description: string
  params: Record<string, string>
}

const PRESETS: Preset[] = [
  {
    id: 'no_website',
    icon: <span className="text-2xl">🚫</span>,
    label: 'No Website',
    description: 'Businesses with no online presence — perfect for web design & local SEO agencies.',
    params: { noWebsite: 'true' },
  },
  {
    id: 'needs_seo',
    icon: <span className="text-2xl">📈</span>,
    label: 'Needs SEO',
    description: 'Established businesses with a website but weak digital marketing.',
    params: { hasWebsite: 'true', minRating: '3.5' },
  },
  {
    id: 'established',
    icon: <span className="text-2xl">⭐</span>,
    label: 'Established',
    description: 'High-rated businesses with lots of reviews — ideal for premium services.',
    params: { minRating: '4', minReviews: '25' },
  },
  {
    id: 'all',
    icon: <span className="text-2xl">🔍</span>,
    label: 'Show Everything',
    description: 'No filters — see all businesses in the area.',
    params: {},
  },
]

export function OnboardingModal() {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [zipCode, setZipCode] = useState('')
  const [category, setCategory] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string>('all')
  const [zipError, setZipError] = useState('')
  const [catError, setCatError] = useState('')

  useEffect(() => {
    // Legitimate post-hydration setState: localStorage is only readable on the client,
    // and a lazy initializer here would cause a hydration mismatch (modal is in the root layout).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  function handleStep1Next() {
    let valid = true
    if (!zipCode.trim() || zipCode.trim().length < 5) {
      setZipError('Enter a valid 5-digit ZIP code')
      valid = false
    } else {
      setZipError('')
    }
    if (!category) {
      setCatError('Pick a category to continue')
      valid = false
    } else {
      setCatError('')
    }
    if (valid) setStep(1)
  }

  function handleLaunch() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)

    const preset = PRESETS.find((p) => p.id === selectedPreset)
    const params = new URLSearchParams({
      zip: zipCode.trim(),
      category,
      radius: '25',
      ...preset?.params,
    })
    router.push(`/search?${params.toString()}`)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="flex gap-1.5 p-5 pb-0">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-blue-600' : 'bg-slate-100'
              }`}
            />
          ))}
        </div>

        {/* Step 1: ZIP + Category */}
        {step === 0 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Welcome to LeadZip 👋</h2>
              <p className="mt-1 text-sm text-slate-500">Let&apos;s find your first batch of leads. Takes 30 seconds.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <MapPin className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                  Target ZIP code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={zipCode}
                  onChange={(e) => {
                    setZipCode(e.target.value.replace(/\D/g, ''))
                    setZipError('')
                  }}
                  placeholder="e.g. 90210"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {zipError && <p className="mt-1 text-xs text-red-500">{zipError}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <Target className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                  Business category
                </label>
                <select
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setCatError('') }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                >
                  <option value="">Select a category…</option>
                  {LEAD_CATEGORIES.filter((c) => c !== 'Custom Keyword').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {catError && <p className="mt-1 text-xs text-red-500">{catError}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button onClick={dismiss} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                Skip setup
              </button>
              <button
                onClick={handleStep1Next}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Use case preset */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">What kind of leads?</h2>
              <p className="mt-1 text-sm text-slate-500">Pick your focus — you can always change filters later.</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id)}
                  className={`relative rounded-xl border-2 p-3.5 text-left transition-all ${
                    selectedPreset === preset.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {selectedPreset === preset.id && (
                    <CheckCircle className="absolute top-2.5 right-2.5 h-4 w-4 text-blue-500" />
                  )}
                  <div className="mb-1.5">{preset.icon}</div>
                  <p className="text-sm font-semibold text-slate-900">{preset.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500 leading-snug">{preset.description}</p>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setStep(0)} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                ← Back
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Launch */}
        {step === 2 && (
          <div className="p-6 space-y-5 text-center">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
                <Zap className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">You&apos;re all set!</h2>
              <p className="mt-1 text-sm text-slate-500">Here&apos;s what we&apos;ll search for:</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Category</span>
                <span className="font-semibold text-slate-900">{category}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">ZIP code</span>
                <span className="font-semibold text-slate-900">{zipCode}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Radius</span>
                <span className="font-semibold text-slate-900">25 miles</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Focus</span>
                <span className="font-semibold text-slate-900">
                  {PRESETS.find((p) => p.id === selectedPreset)?.label}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setStep(1)} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                ← Back
              </button>
              <button
                onClick={handleLaunch}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
              >
                Find My First Leads <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
