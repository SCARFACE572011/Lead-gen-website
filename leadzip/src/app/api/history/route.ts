import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { requireActiveUser } from '@/lib/requireActiveUser'

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

// Service-role client. The 20260812_lock_usage_counters migration locks
// search_history to SELECT + INSERT for authenticated users (no UPDATE/DELETE),
// so a user's "Clear History" can only be honored by the service role — after
// we verify their session and scope every write to their own user_id.
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// The session client verifies WHO is calling and that the account is still
// active; the service client above then does the work on their own rows only.
async function getAuthedUser() {
  const supabase = await createServerClient()
  return requireActiveUser(supabase)
}

// GET /api/history — the caller's search history, newest first.
export async function GET() {
  if (!isSupabaseConfigured) return NextResponse.json({ history: [] })

  const auth = await getAuthedUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const { data, error } = await serviceClient()
    .from('search_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }

  return NextResponse.json({ history: data ?? [] })
}

// DELETE /api/history — remove one row ({ id }) or clear the caller's whole
// history (no body). Always scoped to the authenticated user's own rows.
export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.json({ ok: true })

  const auth = await getAuthedUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const body = await request.json().catch(() => ({}))
  const id = typeof body?.id === 'string' ? body.id : null

  let query = serviceClient().from('search_history').delete().eq('user_id', user.id)
  if (id) query = query.eq('id', id)

  const { error } = await query
  if (error) {
    return NextResponse.json({ error: 'Failed to delete history' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
