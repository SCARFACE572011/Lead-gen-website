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

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch saved searches' }, { status: 500 })
  }

  return NextResponse.json({ searches: (data ?? []).map(toSavedSearch) })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as {
    name: string
    zip: string
    radius: number
    category: string
    keyword?: string
  }

  if (!body.name?.trim() || !body.zip || !body.radius || !body.category) {
    return NextResponse.json(
      { error: 'name, zip, radius, and category are required' },
      { status: 400 }
    )
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle()

  if ((profile?.plan ?? 'free') === 'free') {
    const { count } = await supabase
      .from('saved_searches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) >= 8) {
      return NextResponse.json({ error: 'limit_reached' }, { status: 403 })
    }
  }

  const { data, error } = await supabase
    .from('saved_searches')
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      zip: body.zip,
      radius: body.radius,
      category: body.category,
      keyword: body.keyword ?? null,
      alert_enabled: false,
      last_place_ids: [],
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save search' }, { status: 500 })
  }

  return NextResponse.json({ search: toSavedSearch(data as Record<string, unknown>) }, { status: 201 })
}
