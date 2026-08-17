'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Copy, Check, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SiteHeader, SiteFooter } from '@/components/marketing/MarketingChrome'

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
      aria-label={copied ? 'Copied to clipboard' : 'Copy code'}
      className="absolute top-3 right-3 rounded-lg bg-white/10 p-1.5 text-paper transition-colors hover:bg-white/20"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-lime" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function CodeBlock({ code }: { code: string; language?: string }) {
  return (
    <div className="relative mt-3">
      <pre className="overflow-x-auto rounded-xl bg-forest p-4 pr-12 font-mono text-sm leading-relaxed text-paper">
        <code>{code}</code>
      </pre>
      <CopyButton text={code} />
    </div>
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', color)}>
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
        className="mb-4 flex w-full items-center gap-2 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-stone" /> : <ChevronRight className="h-4 w-4 text-stone" />}
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
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
  const methodColor =
    method === 'GET' ? 'bg-forest/10 text-forest' : 'bg-signal-50 text-signal-600'
  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-sand">
      <div className="flex items-center gap-3 border-b border-sand bg-paper-2 px-5 py-4">
        <Badge color={methodColor}>{method}</Badge>
        <code className="font-mono text-sm text-ink">{path}</code>
      </div>
      <div className="space-y-4 bg-white px-5 py-4">
        <p className="text-sm text-ink-soft">{description}</p>

        {params && params.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone">Parameters</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sand">
                    <th className="w-32 py-1.5 pr-4 text-left font-medium text-ink-soft">Name</th>
                    <th className="w-20 py-1.5 pr-4 text-left font-medium text-ink-soft">Type</th>
                    <th className="w-20 py-1.5 pr-4 text-left font-medium text-ink-soft">Required</th>
                    <th className="py-1.5 text-left font-medium text-ink-soft">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {params.map(p => (
                    <tr key={p.name} className="border-b border-sand last:border-0">
                      <td className="py-1.5 pr-4">
                        <code className="rounded bg-paper-2 px-1.5 py-0.5 text-xs text-ink">{p.name}</code>
                      </td>
                      <td className="py-1.5 pr-4 text-xs text-stone">{p.type}</td>
                      <td className="py-1.5 pr-4">
                        {p.required ? (
                          <span className="text-xs font-medium text-signal">required</span>
                        ) : (
                          <span className="text-xs text-stone">optional</span>
                        )}
                      </td>
                      <td className="py-1.5 text-xs text-ink-soft">{p.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone">Example request</h4>
          <CodeBlock code={curl} />
        </div>

        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone">Response</h4>
          <CodeBlock code={response} language="json" />
        </div>
      </div>
    </div>
  )
}

export default function ApiDocsPage() {
  return (
    <div className="grain relative flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-stone transition-colors hover:text-signal"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>

          <div className="mb-10">
            <div className="mb-3 flex items-center gap-3">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">LeadZipp API</h1>
              <Badge color="bg-lime text-forest">v1</Badge>
            </div>
            <p className="text-base text-ink-soft">
              Agency programmatic access to your leads, search history, and search engine. All endpoints
              require an API key generated from{' '}
              <Link href="/settings" className="font-medium text-signal hover:underline">
                Settings → API
              </Link>
              .
            </p>
          </div>

          <Section title="Authentication" id="auth">
            <div className="mb-4 rounded-lg border border-signal/20 bg-signal-50 px-4 py-3 text-sm text-ink">
              Keep your API key secret. It grants full access to your account data.
            </div>
            <p className="mb-2 text-sm text-ink-soft">
              Pass your key as a Bearer token in the <code className="rounded bg-paper-2 px-1 text-ink">Authorization</code> header:
            </p>
            <CodeBlock code={`Authorization: Bearer lz_live_xxxxxxxxxxxxxxxxxxxx`} />
          </Section>

          <Section title="Rate Limits" id="rate-limits">
            <div className="overflow-x-auto">
              <table className="w-full overflow-hidden rounded-lg border border-sand text-sm">
                <thead className="bg-paper-2">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-ink-soft">Plan</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-ink-soft">Access</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-sand">
                    <td className="px-4 py-2.5 text-ink-soft">Free</td>
                    <td className="px-4 py-2.5 text-stone">Not included</td>
                  </tr>
                  <tr className="border-t border-sand">
                    <td className="px-4 py-2.5 text-ink-soft">Pro</td>
                    <td className="px-4 py-2.5 text-stone">Not included</td>
                  </tr>
                  <tr className="border-t border-sand">
                    <td className="px-4 py-2.5 text-ink-soft">Agency</td>
                    <td className="px-4 py-2.5 text-ink-soft">500 requests/day</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-stone">
              Live search cache misses also share the Agency workspace&apos;s 300-search monthly allowance. Cached API search responses consume an API request but no live-search allowance. When rate limited, the API returns HTTP 429.
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
              curl={`curl https://leadzipp.com/api/v1/leads \\
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
              curl={`curl https://leadzipp.com/api/v1/history \\
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
              description="Run a new lead search programmatically. A cache miss spends one live search from the workspace's 300 monthly allowance; a cached response spends none."
              params={[
                { name: 'query', type: 'string', required: true, desc: 'Business type or keyword (e.g. "plumbers")' },
                { name: 'location', type: 'string', required: true, desc: 'City, state, or zip code' },
                { name: 'radius', type: 'integer', desc: 'Search radius in miles (default: 10, max: 50)' },
              ]}
              curl={`curl -X POST https://leadzipp.com/api/v1/search \\
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
              <table className="w-full overflow-hidden rounded-lg border border-sand text-sm">
                <thead className="bg-paper-2">
                  <tr>
                    <th className="w-20 px-4 py-2.5 text-left font-semibold text-ink-soft">Status</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-ink-soft">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['401', 'Missing or invalid API key'],
                    ['403', 'Account deactivated'],
                    ['422', 'Missing required parameters'],
                    ['429', 'Daily rate limit exceeded. Check retryAfter'],
                    ['500', 'Internal server error. Try again shortly'],
                  ].map(([status, meaning]) => (
                    <tr key={status} className="border-t border-sand">
                      <td className="px-4 py-2.5">
                        <code className="rounded bg-paper-2 px-1.5 py-0.5 text-xs text-ink">{status}</code>
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="mt-10 border-t border-sand pt-6 text-center">
            <p className="text-sm text-stone">
              Need help?{' '}
              <a href="mailto:support@leadzipp.com" className="font-medium text-signal hover:underline">
                support@leadzipp.com
              </a>
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
