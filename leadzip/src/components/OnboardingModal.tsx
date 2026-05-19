'use client'
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'leadzip_onboarding_complete'

const STEPS = [
  {
    icon: '🔍',
    title: 'Search for Leads',
    description: 'Enter any US ZIP code, choose a business category, and set your search radius. LeadZip scrapes real business data so every result is a potential client.',
    tip: 'Try: ZIP 10001 + Restaurants + 5 miles',
  },
  {
    icon: '⭐',
    title: 'Score & Filter',
    description: 'Every lead gets a score (0–100). Hot leads (80+) have phone numbers and no website — perfect targets for your outreach. Use filters to narrow by rating, distance, and more.',
    tip: 'Red = Hot Lead · Orange = Warm · Grey = Low Priority',
  },
  {
    icon: '💾',
    title: 'Save & Export',
    description: 'Bookmark leads to your Saved list, track their status (New → Contacted → Converted), and export to CSV, HubSpot, or Salesforce with one click.',
    tip: 'Export selected leads directly to your CRM',
  },
]

export function OnboardingModal() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  function complete() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0F172A] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Getting Started</span>
          <button onClick={complete} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
        </div>
        <div className="flex gap-2 px-6 pb-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-[#0369A1]' : 'bg-white/10'}`} />
          ))}
        </div>
        <div className="px-6 pb-4 text-center">
          <div className="text-5xl mb-4">{current.icon}</div>
          <h2 className="text-xl font-semibold text-white mb-2">{current.title}</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">{current.description}</p>
          <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs text-slate-300">
            💡 {current.tip}
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          <button onClick={complete} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Skip</button>
          <button
            onClick={() => isLast ? complete() : setStep(s => s + 1)}
            className="bg-[#0369A1] hover:bg-[#0284C7] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {isLast ? 'Get Started' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
