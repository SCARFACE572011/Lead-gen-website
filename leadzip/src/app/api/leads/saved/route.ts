import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/requireActiveUser'
import { mapSavedLeadRow } from '@/lib/savedLeadRows'

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

const DEFAULT_PAGE_SIZE = 200
const MAX_PAGE_SIZE = 250

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function nonNegativeInteger(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

export async function GET(request: NextRequest) {
  const requestedPage = positiveInteger(request.nextUrl.searchParams.get('page'), 1)
  const requestedPageSize = positiveInteger(
    request.nextUrl.searchParams.get('pageSize'),
    DEFAULT_PAGE_SIZE
  )
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE)
  const fallbackOffset = (requestedPage - 1) * pageSize
  const offset = nonNegativeInteger(request.nextUrl.searchParams.get('offset'), fallbackOffset)
  const page = Math.floor(offset / pageSize) + 1

  if (!isSupabaseConfigured) {
    return NextResponse.json({
      leads: [],
      pagination: { page, pageSize, offset, nextOffset: offset, total: 0, hasMore: false },
      pipelineMigrationNeeded: false,
    })
  }

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const auth = await requireActiveUser(supabase)
    if (!auth.ok) {
      // Signed-out callers keep the existing "empty list" answer (the saved page
      // renders it as a normal empty state). A deactivated account gets the 403.
      return auth.reason === 'unauthenticated'
        ? NextResponse.json({
            leads: [],
            pagination: { page, pageSize, offset, nextOffset: offset, total: 0, hasMore: false },
            pipelineMigrationNeeded: false,
          })
        : auth.response
    }
    const { user } = auth

    const from = offset
    const to = from + pageSize - 1

    // created_at alone is not a total order: leads saved in the same instant
    // (a Save All writes a whole page at once) can come back in a different
    // order per query, so "Load more" would silently skip some and repeat
    // others. leads.id is the provider ID and is unique within one user's list
    // in BOTH schema states (globally before 20260813, per user after it), so
    // it is a stable tiebreaker that does not depend on an unapplied migration.
    const { data: rows, error, count } = await supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Saved leads fetch error:', error)
      return NextResponse.json(
        { error: 'Could not load saved leads.' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
      )
    }

    const leads = (rows ?? []).map(mapSavedLeadRow)
    const total = count ?? 0
    const pipelineMigrationNeeded =
      rows !== null && rows.length > 0 && !('pipeline_stage' in rows[0])

    return NextResponse.json(
      {
        leads,
        pagination: {
          page,
          pageSize,
          offset,
          nextOffset: from + leads.length,
          total,
          hasMore: from + leads.length < total,
        },
        pipelineMigrationNeeded,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    console.error('Saved leads error:', error)
    return NextResponse.json(
      { error: 'Could not load saved leads.' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }
}
