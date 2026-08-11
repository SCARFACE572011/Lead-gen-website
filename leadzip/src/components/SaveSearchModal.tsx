// src/components/SaveSearchModal.tsx
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { SavedSearch } from '@/types/saved-search'

interface SaveSearchModalProps {
  isOpen: boolean
  onClose: () => void
  defaultName: string
  zip: string
  radius: number
  category: string
  keyword?: string
  savedCount: number
  isPaidUser: boolean
  onSaved: (search: SavedSearch) => void
}

export function SaveSearchModal({
  isOpen,
  onClose,
  defaultName,
  zip,
  radius,
  category,
  keyword,
  savedCount,
  isPaidUser,
  onSaved,
}: SaveSearchModalProps) {
  const [name, setName] = useState(defaultName)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prevDefaultName, setPrevDefaultName] = useState(defaultName)

  // Sync name when defaultName changes (new search performed) — adjust state during render
  if (prevDefaultName !== defaultName) {
    setPrevDefaultName(defaultName)
    setName(defaultName)
    setError(null)
  }

  if (!isOpen) return null

  const atLimit = !isPaidUser && savedCount >= 8

  async function handleSave() {
    if (atLimit || !name.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), zip, radius, category, keyword }),
      })
      const data = await res.json() as { search?: SavedSearch; error?: string }
      if (!res.ok) {
        if (data.error === 'limit_reached') {
          setError("You've reached the 8 search limit on the free plan.")
        } else {
          setError('Failed to save search. Please try again.')
        }
        return
      }
      onSaved(data.search!)
      onClose()
    } catch {
      setError('Failed to save search. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-3xl border border-sand bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-bold text-ink">Save this search</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-stone hover:bg-paper-2 hover:text-ink transition-colors"
          >
            <X className="h-4 w-4 shrink-0" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="save-search-name"
              className="block text-sm font-medium text-ink-soft mb-1.5"
            >
              Name
            </label>
            <input
              id="save-search-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink placeholder:text-stone focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
              placeholder="e.g. HVAC contractors near 90210"
            />
          </div>

          {!isPaidUser && (
            <p className="text-xs text-stone">
              <span className="font-mono">{savedCount}</span> of <span className="font-mono">8</span> searches used on free plan
            </p>
          )}

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-full border border-sand px-4 py-2 text-sm font-medium text-ink-soft hover:bg-paper-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim() || atLimit}
              className="flex-1 rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving…' : 'Save search'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
