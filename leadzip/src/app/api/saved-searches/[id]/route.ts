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

// country_code / radius_km are feature-detected: they are simply absent from the
// row until 20260812_saved_search_country.sql is applied by hand, and every
// consumer reads "absent" as a legacy US-intent row. Same mapping as the sibling
// collection route.
function toSavedSearch(row: Record<string, unknown>): SavedSearch {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    zip: row.zip as string,
    radius: row.radius as number,
    category: row.category as string,
    keyword: (row.keyword as string | null) ?? undefined,
    countryCode: ((row.country_code as string | null | undefined) ?? '') || undefined,
    radiusKm: (row.radius_km as number | null | undefined) ?? undefined,
    alertEnabled: row.alert_enabled as boolean,
    lastPlaceIds: row.last_place_ids as string[],
    lastRunAt: (row.last_run_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
  }
}

/**
 * Per-user budget for saved-search writes.
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  // Same round trip serves the deactivated check and the alerts plan fence below.
  const auth = await requireActiveUser(supabase, {
    columns: ['plan', 'role', 'workspace_id'],
  })
  if (!auth.ok) return auth.response
  const { user } = auth


  const access = await resolveProductAccess(serviceClient(), user.id, auth.profile)
  if (!access) {
    return NextResponse.json(
      { error: 'Could not verify your alert allowance. Please retry.' },
      { status: 503 }
    )
  }

  const limited = await overLimit(user.id)
  if (limited) return limited

  const body = await request.json() as { alertEnabled: boolean }

  const policy = getPlanPolicy(access.plan, access.role)
  if (body.alertEnabled && access.role !== 'admin') {
    if (policy.activeAlerts === 0) {
      return NextResponse.json(
        { error: 'New-business alerts are included with Pro and Agency.', upgradeRequired: true },
        { status: 403 }
      )
    }

    const { count } = await supabase
      .from('saved_searches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('alert_enabled', true)
      .neq('id', id)

    if ((count ?? 0) >= policy.activeAlerts) {
      return NextResponse.json(
        {
          error: `Your plan includes ${policy.activeAlerts} active alerts.`,
          limitReached: true,
          limit: policy.activeAlerts,
        },
        { status: 409 }
      )
    }
  }

  const { data, error } = await supabase
    .from('saved_searches')
    .update({ alert_enabled: body.alertEnabled })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    // Never echo the database message: it carries trigger and constraint
    // wording that means nothing to a customer. Log the detail, answer short.
    console.error(
      '[saved-searches] alert update failed:',
      error.code,
      error.message,
      error.details ?? ''
    )

    if (error.code === '23514') {
      // The database counts alerts across the whole shared workspace, so it can
      // reject a change the per-user count above allowed. Same limit, honest
      // wording, no constraint text.
      return NextResponse.json(
        policy.activeAlerts === 0
          ? {
              error: 'New-business alerts are included with Pro and Agency.',
              limitReached: true,
              limit: 0,
              upgradeRequired: true,
            }
          : {
              error: `Your plan includes ${policy.activeAlerts} active alerts.`,
              limitReached: true,
              limit: policy.activeAlerts,
            },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Failed to update saved search' }, { status: 500 })
  }

  return NextResponse.json({ search: toSavedSearch(data as Record<string, unknown>) })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const auth = await requireActiveUser(supabase)
  if (!auth.ok) return auth.response
  const { user } = auth

  const limited = await overLimit(user.id)
  if (limited) return limited

  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[saved-searches] delete failed:', error.message)
    return NextResponse.json({ error: 'Failed to delete saved search' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
