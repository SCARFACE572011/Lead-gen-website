import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, extractBearerKey } from '@/lib/api-key'
import { searchLeads } from '@/lib/providers/leadDataProvider'
import { apiKeyLimiterFree, apiKeyLimiterPro, apiKeyLimiterAgency, checkRateLimit } from '@/lib/ratelimit'
import type { SearchParams } from '@/types/lead'

export async function POST(request: NextRequest) {
  const raw = extractBearerKey(request.headers.get('authorization'))
  if (!raw) {
    return NextResponse.json({ error: 'Missing API key. Pass Authorization: Bearer <key>' }, { status: 401 })
  }

  const validated = await validateApiKey(raw)
  if (!validated) {
    return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 })
  }

  // Rate limit by plan
  const limiter = validated.plan === 'agency' ? apiKeyLimiterAgency
    : validated.plan === 'pro' ? apiKeyLimiterPro
    : apiKeyLimiterFree
  const { success, retryAfter } = await checkRateLimit(limiter, validated.userId)
  if (!success) {
    return NextResponse.json(
      { error: 'Daily API limit reached', retryAfter, plan: validated.plan },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  let body: Partial<SearchParams>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.zipCode || body.zipCode.length < 5) {
    return NextResponse.json({ error: 'zipCode (5-digit) is required' }, { status: 400 })
  }
  if (!body.category) {
    return NextResponse.json({ error: 'category is required' }, { status: 400 })
  }

  const params: SearchParams = {
    zipCode: body.zipCode,
    radiusMiles: body.radiusMiles ?? 10,
    category: body.category,
    keyword: body.keyword,
    minRating: body.minRating,
    hasWebsite: body.hasWebsite,
    hasPhone: body.hasPhone,
  }

  try {
    const results = await searchLeads(params)
    return NextResponse.json({
      leads: results.leads,
      total: results.total,
      meta: {
        zipCode: params.zipCode,
        radiusMiles: params.radiusMiles,
        category: params.category,
        plan: validated.plan,
      },
    })
  } catch (err) {
    console.error('[v1/search]', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
