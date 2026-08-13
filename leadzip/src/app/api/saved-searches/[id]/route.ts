import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SavedSearch } from '@/types/saved-search'
import { savedSearchesLimiter, checkRateLimit } from '@/lib/ratelimit'
import { requireActiveUser } from '@/lib/requireActiveUser'

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
  const auth = await requireActiveUser(supabase, { columns: ['plan'] })
  if (!auth.ok) return auth.response
  const { user } = auth

  const limited = await overLimit(user.id)
  if (limited) return limited

  const body = await request.json() as { alertEnabled: boolean }

  if (body.alertEnabled && ((auth.profile?.plan as string | undefined) ?? 'free') === 'free') {
    return NextResponse.json({ error: 'upgrade_required' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('saved_searches')
    .update({ alert_enabled: body.alertEnabled })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
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
    return NextResponse.json({ error: 'Failed to delete saved search' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
