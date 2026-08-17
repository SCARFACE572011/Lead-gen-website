import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SavedSearch } from '@/types/saved-search'
import { savedSearchesLimiter, checkRateLimit } from '@/lib/ratelimit'
import { requireActiveUser } from '@/lib/requireActiveUser'
import { getPlanPolicy } from '@/lib/planPolicy'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveProductAccess } from '@/lib/productAccess'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Row -> API shape. country_code and radius_km are FEATURE-DETECTED: the
 * 20260812_saved_search_country migration is applied by hand, so until it runs
 * those keys are simply absent from the `select('*')` row and both fields come
 * back undefined — which every consumer already reads as "legacy US-intent row,
 * use the miles radius".
 */
function toSavedSearch(row: Record<string, unknown>): SavedSearch {
  const countryCode = (row.country_code as string | null | undefined) ?? undefined
  const radiusKm = (row.radius_km as number | null | undefined) ?? undefined
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    zip: row.zip as string,
    radius: row.radius as number,
    category: row.category as string,
    keyword: (row.keyword as string | null) ?? undefined,
    countryCode: countryCode || undefined,
    radiusKm: radiusKm ?? undefined,
    alertEnabled: row.alert_enabled as boolean,
    lastPlaceIds: row.last_place_ids as string[],
    lastRunAt: (row.last_run_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
  }
}

/** PostgREST codes for "this column does not exist on the table". Used to detect
 *  that the country/radius_km migration has not been applied yet. */
function isMissingColumnError(error: { code?: string; message?: string }): boolean {
  if (error.code === 'PGRST204' || error.code === '42703') return true
  const msg = error.message ?? ''
  return /country_code|radius_km/.test(msg) && /does not exist|column/i.test(msg)
}

/** The saved-search allowance trigger raises 23514 with its own wording. Match
 *  it explicitly so the OTHER 23514s on this table (the country_code format and
 *  radius_km range checks) are never reported as a plan limit. */
function isSavedSearchLimitError(error: { code?: string; message?: string }): boolean {
  return error.code === '23514' && (error.message ?? '').includes('Saved search limit reached')
}

/**
 * Per-user budget for saved-search reads and writes.
 *
 * `savedSearchesLimiter` degrades to an in-process window on a Redis outage
 * rather than throwing, but the try/catch is here so a future policy change to
 * 'deny' cannot turn a Redis blip into a 500. These are the caller's own rows
 * and cost nothing upstream, so an unavailable limiter fails OPEN.
 */
async function overLimit(userId: string): Promise<NextResponse | null> {
  try {
    const { success, retryAfter } = await checkRateLimit(savedSearchesLimiter, userId)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }
  } catch (err) {
    console.warn('[saved-searches] rate limiter unavailable, allowing request', err)
  }
  return null
}

export async function GET() {
  const supabase = await createClient()
  const auth = await requireActiveUser(supabase)
  if (!auth.ok) return auth.response
  const { user } = auth

  const limited = await overLimit(user.id)
  if (limited) return limited

  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[saved-searches] fetch failed:', error.message)
    return NextResponse.json({ error: 'Failed to fetch saved searches' }, { status: 500 })
  }

  return NextResponse.json({ searches: (data ?? []).map(toSavedSearch) })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  // Same round trip serves the deactivated check and the free-plan fence below.
  const auth = await requireActiveUser(supabase, {
    columns: ['plan', 'role', 'workspace_id'],
  })
  if (!auth.ok) return auth.response
  const { user } = auth

  const access = await resolveProductAccess(serviceClient(), user.id, auth.profile)
  if (!access) {
    return NextResponse.json(
      { error: 'Could not verify your saved-search allowance. Please retry.' },
      { status: 503 }
    )
  }

  const limited = await overLimit(user.id)
  if (limited) return limited

  const body = await request.json() as {
    name: string
    zip: string
    radius: number
    category: string
    keyword?: string
    countryCode?: string
    radiusKm?: number
  }

  if (!body.name?.trim() || !body.zip || !body.radius || !body.category) {
    return NextResponse.json(
      { error: 'name, zip, radius, and category are required' },
      { status: 400 }
    )
  }

  // Worldwide extras. Both are optional and validated rather than rejected: a bad
  // value is dropped so the save still succeeds as a legacy (US-intent) row.
  const rawCountry = typeof body.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : ''
  const countryCode = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : null
  const radiusKm =
    typeof body.radiusKm === 'number' &&
    Number.isFinite(body.radiusKm) &&
    body.radiusKm > 0 &&
    body.radiusKm <= 500
      ? Math.round(body.radiusKm)
      : null

  const policy = getPlanPolicy(access.plan, access.role)
  if (access.role !== 'admin') {
    const { count } = await supabase
      .from('saved_searches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) >= policy.savedSearches) {
      return NextResponse.json(
        {
          error: `Your plan includes ${policy.savedSearches} saved searches.`,
          limitReached: true,
          limit: policy.savedSearches,
          upgradeRequired: access.plan === 'free',
        },
        { status: 409 }
      )
    }
  }

  const baseRow = {
    user_id: user.id,
    name: body.name.trim(),
    zip: body.zip,
    radius: body.radius,
    category: body.category,
    keyword: body.keyword ?? null,
    alert_enabled: false,
    last_place_ids: [],
  }

  // Worldwide columns are written only when there is something to write, and the
  // insert falls back to the legacy shape if the migration has not been applied.
  // The failed insert writes no row, so the retry cannot duplicate.
  const hasWorldwideFields = countryCode !== null || radiusKm !== null
  const row = hasWorldwideFields
    ? { ...baseRow, country_code: countryCode, radius_km: radiusKm }
    : baseRow

  let { data, error } = await supabase.from('saved_searches').insert(row).select().single()

  if (error && hasWorldwideFields && isMissingColumnError(error)) {
    console.warn(
      '[saved-searches] country_code/radius_km column missing — saving without them. Apply supabase/migrations/20260812_saved_search_country.sql.'
    )
    ;({ data, error } = await supabase.from('saved_searches').insert(baseRow).select().single())
  }

  if (error) {
    // Never echo the database message: it carries constraint and trigger
    // wording that means nothing to a customer. Log the detail, answer short.
    console.error(
      '[saved-searches] save failed:',
      error.code,
      error.message,
      error.details ?? ''
    )

    if (isSavedSearchLimitError(error)) {
      // The database counts the whole shared workspace, so it can reject a
      // save that the per-user count above allowed. Same limit, honest wording.
      return NextResponse.json(
        {
          error: `Your plan includes ${policy.savedSearches} saved searches.`,
          limitReached: true,
          limit: policy.savedSearches,
          upgradeRequired: access.plan === 'free',
        },
        { status: 409 }
      )
    }

    if (error.code === '23514') {
      return NextResponse.json(
        { error: 'We could not save that search. Please check the location and radius and try again.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ error: 'Failed to save search' }, { status: 500 })
  }

  return NextResponse.json({ search: toSavedSearch(data as Record<string, unknown>) }, { status: 201 })
}
