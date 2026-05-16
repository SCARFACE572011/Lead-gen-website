'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clock,
  RotateCcw,
  Trash2,
  MapPin,
  Hash,
  SearchX,
} from 'lucide-react'
import { SearchHistory } from '@/types/lead'
import { createClient } from '@/lib/supabase/client'

const HISTORY_KEY = 'leadzip_search_history'
const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

const MOCK_HISTORY: SearchHistory[] = [
  {
    id: 'h1',
    userId: 'demo',
    zipCode: '10019',
    radius: 10,
    category: 'Restaurants',
    keyword: '',
    resultCount: 18,
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'h2',
    userId: 'demo',
    zipCode: '90210',
    radius: 25,
    category: 'Hair & Beauty Salons',
    keyword: 'blowout',
    resultCount: 7,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'h3',
    userId: 'demo',
    zipCode: '60601',
    radius: 15,
    category: 'Contractors',
    keyword: '',
    resultCount: 12,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'h4',
    userId: 'demo',
    zipCode: '77001',
    radius: 25,
    category: 'Plumbers',
    keyword: '',
    resultCount: 9,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'h5',
    userId: 'demo',
    zipCode: '85001',
    radius: 50,
    category: 'HVAC Services',
    keyword: 'repair',
    resultCount: 15,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'h6',
    userId: 'demo',
    zipCode: '30301',
    radius: 10,
    category: 'Dentists',
    keyword: '',
    resultCount: 22,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'h7',
    userId: 'demo',
    zipCode: '98101',
    radius: 25,
    category: 'Gyms & Fitness',
    keyword: 'crossfit',
    resultCount: 5,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'h8',
    userId: 'demo',
    zipCode: '33101',
    radius: 15,
    category: 'Auto Shops',
    keyword: '',
    resultCount: 11,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'h9',
    userId: 'demo',
    zipCode: '75201',
    radius: 25,
    category: 'Landscaping',
    keyword: '',
    resultCount: 8,
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'h10',
    userId: 'demo',
    zipCode: '19101',
    radius: 10,
    category: 'Law Firms',
    keyword: 'real estate',
    resultCount: 4,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function loadFromLocalStorage(): SearchHistory[] {
  const raw = localStorage.getItem(HISTORY_KEY)
  if (raw) {
    try {
      const stored = JSON.parse(raw) as SearchHistory[]
      if (stored.length) return stored
    } catch {
      // ignore
    }
  }
  // Seed with mock data on first visit
  localStorage.setItem(HISTORY_KEY, JSON.stringify(MOCK_HISTORY))
  return MOCK_HISTORY
}

export default function SearchHistoryPage() {
  const router = useRouter()
  const [history, setHistory] = useState<SearchHistory[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)

    async function loadHistory() {
      if (isSupabaseConfigured) {
        try {
          const supabase = createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (user) {
            const { data } = await supabase
              .from('search_history')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(50)

            if (data && data.length > 0) {
              setHistory(
                data.map((h) => ({
                  id: h.id,
                  userId: h.user_id,
                  zipCode: h.zip_code,
                  radius: h.radius ?? 25,
                  category: h.category ?? '',
                  keyword: h.keyword ?? '',
                  resultCount: h.result_count ?? 0,
                  createdAt: h.created_at,
                }))
              )
              return
            }
          }
        } catch {
          // Non-fatal — fall back to localStorage
        }
      }

      // Fallback to localStorage
      setHistory(loadFromLocalStorage())
    }

    loadHistory()
  }, [])

  const handleRerun = (entry: SearchHistory) => {
    const params = new URLSearchParams({
      zip: entry.zipCode,
      radius: String(entry.radius),
      category: entry.category,
      ...(entry.keyword ? { keyword: entry.keyword } : {}),
    })
    router.push(`/search?${params.toString()}`)
  }

  const handleDelete = (id: string) => {
    const updated = history.filter((h) => h.id !== id)
    setHistory(updated)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  }

  const handleClearAll = () => {
    setHistory([])
    localStorage.setItem(HISTORY_KEY, JSON.stringify([]))
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Search History</h1>
            <p className="text-sm text-slate-500 mt-0.5">Rerun past searches or review previous results</p>
          </div>
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="inline-flex items-center gap-2 text-sm text-red-500 border border-red-200 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Clear History
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <SearchX className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F172A] mb-1">No search history</h3>
              <p className="text-sm text-slate-500 max-w-xs">
                Your past searches will appear here so you can quickly rerun them.
              </p>
              <a
                href="/search"
                className="mt-5 inline-flex items-center gap-2 bg-[#0369A1] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#0F172A] transition-colors"
              >
                Start Searching
              </a>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">ZIP Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Radius</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Keyword</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Results</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#0369A1]/10 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-[#0369A1]" />
                          </div>
                          <span className="font-semibold text-[#0F172A] text-sm">{entry.zipCode}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-slate-700">{entry.category}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">
                          {entry.radius} mi
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {entry.keyword ? (
                          <div className="flex items-center gap-1">
                            <Hash className="w-3 h-3 text-slate-400" />
                            <span className="text-sm text-slate-600 italic">{entry.keyword}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${entry.resultCount >= 10 ? 'bg-emerald-50 text-emerald-700' : entry.resultCount >= 5 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {entry.resultCount} found
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <div>
                            <div className="text-xs font-medium text-slate-600">{formatRelativeTime(entry.createdAt)}</div>
                            <div className="text-xs text-slate-400">{formatDate(entry.createdAt)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRerun(entry)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#0369A1] text-white px-3 py-1.5 rounded-lg hover:bg-[#0F172A] transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Rerun
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400">{history.length} searches in history</span>
              <span className="text-xs text-slate-400">Last 30 days</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
