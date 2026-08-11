'use client'

import { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="absolute top-3 right-3 p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  return (
    <div className="relative mt-3">
      <pre className="bg-slate-900 text-slate-200 rounded-lg p-4 text-sm overflow-x-auto font-mono leading-relaxed pr-12">
        <code>{code}</code>
      </pre>
      <CopyButton text={code} />
    </div>
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', color)}>
      {children}
    </span>
  )
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mb-8" id={id}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left mb-4"
      >
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <h2 className="text-lg font-semibold text-[#17130E]">{title}</h2>
      </button>
      {open && children}
    </div>
  )
}

function Endpoint({
  method,
  path,
  description,
  params,
  response,
  curl,
}: {
  method: 'GET' | 'POST'
  path: string
  description: string
  params?: { name: string; type: string; required?: boolean; desc: string }[]
  response: string
  curl: string
}) {
  const methodColor = method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
  return (
    <div className="border border-slate-200 rounded-xl mb-6 overflow-hidden">
      <div className="bg-slate-50 px-5 py-4 flex items-center gap-3 border-b border-slate-200">
        <Badge color={methodColor}>{method}</Badge>
        <code className="text-sm font-mono text-slate-800">{path}</code>
      </div>
      <div className="px-5 py-4 space-y-4">
        <p className="text-sm text-slate-600">{description}</p>

        {params && params.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Parameters</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-1.5 pr-4 font-medium text-slate-600 w-32">Name</th>
                    <th className="text-left py-1.5 pr-4 font-medium text-slate-600 w-20">Type</th>
                    <th className="text-left py-1.5 pr-4 font-medium text-slate-600 w-20">Required</th>
                    <th className="text-left py-1.5 font-medium text-slate-600">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {params.map(p => (
                    <tr key={p.name} className="border-b border-slate-50 last:border-0">
                      <td className="py-1.5 pr-4">
                        <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{p.name}</code>
                      </td>
                      <td className="py-1.5 pr-4 text-slate-500 text-xs">{p.type}</td>
                      <td className="py-1.5 pr-4">
                        {p.required ? (
                          <span className="text-xs text-rose-600 font-medium">required</span>
                        ) : (
                          <span className="text-xs text-slate-400">optional</span>
                        )}
                      </td>
                      <td className="py-1.5 text-slate-600 text-xs">{p.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Example request</h4>
          <CodeBlock code={curl} />
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Response</h4>
          <CodeBlock code={response} language="json" />
        </div>
      </div>
    </div>
  )
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-3xl font-bold text-[#17130E]">LeadZip API</h1>
            <Badge color="bg-emerald-100 text-emerald-700">v1</Badge>
          </div>
          <p className="text-slate-500 text-base">
            Programmatic access to your leads, search history, and search engine. All endpoints
            require an API key generated from{' '}
            <a href="/settings" className="text-[#FF4D23] hover:underline">
              Settings → API
            </a>
            .
          </p>
        </div>

        <Section title="Authentication" id="auth">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 mb-4">
            Keep your API key secret — it grants full access to your account data.
          </div>
          <p className="text-sm text-slate-600 mb-2">
            Pass your key as a Bearer token in the <code className="bg-slate-100 px-1 rounded">Authorization</code> header:
          </p>
          <CodeBlock code={`Authorization: Bearer lz_live_xxxxxxxxxxxxxxxxxxxx`} />
        </Section>

        <Section title="Rate Limits" id="rate-limits">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Plan</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Daily requests</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-700">Free</td>
                  <td className="px-4 py-2.5 text-slate-700">100</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-700">Pro</td>
                  <td className="px-4 py-2.5 text-slate-700">1,000</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-700">Agency</td>
                  <td className="px-4 py-2.5 text-slate-700">10,000</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            When rate limited, the API returns HTTP 429 with a <code className="bg-slate-100 px-1 rounded">retryAfter</code> timestamp (Unix seconds).
          </p>
        </Section>

        <Section title="Endpoints" id="endpoints">
          <Endpoint
            method="GET"
            path="/api/v1/leads"
            description="Retrieve your saved leads, paginated newest-first."
            params={[
              { name: 'page', type: 'integer', desc: 'Page number (default: 1)' },
              { name: 'limit', type: 'integer', desc: 'Results per page, max 100 (default: 25)' },
            ]}
            curl={`curl https://leadzip.com/api/v1/leads \\
  -H "Authorization: Bearer lz_live_xxxxxxxxxxxxxxxxxxxx"`}
            response={`{
  "leads": [
    {
      "id": "uuid",
      "name": "Joe's Plumbing",
      "address": "123 Main St, Austin TX 78701",
      "phone": "+15125551234",
      "website": "https://joesplumbing.com",
      "rating": 4.7,
      "review_count": 83,
      "category": "Plumber",
      "saved_at": "2026-05-19T12:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 25, "total": 142, "totalPages": 6 }
}`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/history"
            description="Retrieve your past searches, paginated newest-first."
            params={[
              { name: 'page', type: 'integer', desc: 'Page number (default: 1)' },
              { name: 'limit', type: 'integer', desc: 'Results per page, max 100 (default: 25)' },
            ]}
            curl={`curl https://leadzip.com/api/v1/history \\
  -H "Authorization: Bearer lz_live_xxxxxxxxxxxxxxxxxxxx"`}
            response={`{
  "history": [
    {
      "id": "uuid",
      "query": "plumbers",
      "location": "Austin, TX",
      "results_count": 18,
      "created_at": "2026-05-19T11:45:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 25, "total": 37, "totalPages": 2 }
}`}
          />

          <Endpoint
            method="POST"
            path="/api/v1/search"
            description="Run a new lead search programmatically. Counts against your plan's search quota."
            params={[
              { name: 'query', type: 'string', required: true, desc: 'Business type or keyword (e.g. "plumbers")' },
              { name: 'location', type: 'string', required: true, desc: 'City, state, or zip code' },
              { name: 'radius', type: 'integer', desc: 'Search radius in miles (default: 10, max: 50)' },
            ]}
            curl={`curl -X POST https://leadzip.com/api/v1/search \\
  -H "Authorization: Bearer lz_live_xxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "plumbers", "location": "Austin, TX", "radius": 15}'`}
            response={`{
  "results": [
    {
      "place_id": "ChIJ...",
      "name": "Joe's Plumbing",
      "address": "123 Main St, Austin TX 78701",
      "phone": "+15125551234",
      "website": "https://joesplumbing.com",
      "rating": 4.7,
      "review_count": 83,
      "category": "Plumber",
      "lat": 30.2672,
      "lng": -97.7431
    }
  ],
  "count": 18,
  "query": "plumbers",
  "location": "Austin, TX"
}`}
          />
        </Section>

        <Section title="Error codes" id="errors">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-20">Status</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['401', 'Missing or invalid API key'],
                  ['403', 'Account deactivated'],
                  ['422', 'Missing required parameters'],
                  ['429', 'Daily rate limit exceeded — check retryAfter'],
                  ['500', 'Internal server error — try again shortly'],
                ].map(([status, meaning]) => (
                  <tr key={status} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{status}</code>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="mt-10 pt-6 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-400">
            Need help?{' '}
            <a href="mailto:support@leadzip.com" className="text-[#FF4D23] hover:underline">
              support@leadzip.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
