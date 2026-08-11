import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createSsrClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params
  const body = await request.json()

  // Get current user from session
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date().toISOString()
  const { action } = body

  if (action === 'set_status') {
    const { status } = body
    if (status === 'deactivated' && targetId === user.id) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
    }
    await db.from('users_profile').update({ status, updated_at: now }).eq('id', targetId)
    if (status === 'deactivated') {
      await db.auth.admin.signOut(targetId, 'global')
    }
  } else if (action === 'set_plan') {
    const { plan } = body
    await db.from('users_profile').update({ plan, updated_at: now }).eq('id', targetId)
    await db.from('subscriptions').update({ plan, updated_at: now }).eq('user_id', targetId)
  } else if (action === 'reset_usage') {
    await db.from('usage_limits')
      .update({ searches_this_month: 0, exports_count: 0, last_reset_at: now, updated_at: now })
      .eq('user_id', targetId)
  } else if (action === 'update_notes') {
    const { notes } = body
    await db.from('users_profile').update({ admin_notes: notes, updated_at: now }).eq('id', targetId)
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const { data: updatedUser } = await db
    .from('users_profile')
    .select('id, email, plan, status, admin_notes')
    .eq('id', targetId)
    .maybeSingle()

  return NextResponse.json({ success: true, user: updatedUser })
}
