import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, extractBearerKey } from '@/lib/api-key'
import { apiKeyLimiterFree, apiKeyLimiterPro, apiKeyLimiterAgency, checkRateLimit } from '@/lib/ratelimit'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(request: NextRequest) {
  const raw = extractBearerKey(request.headers.get('authorization'))
  if (!raw) {
    return NextResponse.json({ error: 'Missing API key. Pass Authorization: Bearer <key>' }, { status: 401 })
  }

  const validated = await validateApiKey(raw)
  if (!validated) {
    return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 })
  }

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

  const params = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '25', 10)))
  const offset = (page - 1) * limit

  const db = serviceClient()
  const { data, count, error } = await db
    .from('search_history')
    .select('*', { count: 'exact' })
    .eq('user_id', validated.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }

  return NextResponse.json({
    history: data ?? [],
    meta: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  })
}
