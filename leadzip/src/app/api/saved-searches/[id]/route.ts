import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SavedSearch } from '@/types/saved-search'

function toSavedSearch(row: Record<string, unknown>): SavedSearch {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    zip: row.zip as string,
    radius: row.radius as number,
    category: row.category as string,
    keyword: (row.keyword as string | null) ?? undefined,
    alertEnabled: row.alert_enabled as boolean,
    lastPlaceIds: row.last_place_ids as string[],
    lastRunAt: (row.last_run_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { alertEnabled: boolean }

  if (body.alertEnabled) {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle()

    if ((profile?.plan ?? 'free') === 'free') {
      return NextResponse.json({ error: 'upgrade_required' }, { status: 403 })
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
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
