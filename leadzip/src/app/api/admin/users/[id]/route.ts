import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: targetId } = await params
  const body = await request.json()
  const { action } = body
  const now = new Date().toISOString()
  const db = serviceClient()

  if (action === 'set_status') {
    const { status } = body as { status: 'active' | 'deactivated' }
    if (!['active', 'deactivated'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    // Prevent self-deactivation
    if (status === 'deactivated' && targetId === user.id) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
    }

    const { error } = await db
      .from('users_profile')
      .update({ status, updated_at: now })
      .eq('id', targetId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Invalidate all active sessions for the deactivated user
    if (status === 'deactivated') {
      await db.auth.admin.signOut(targetId, 'global')
    }

    const { data: updated } = await db
      .from('users_profile')
      .select('id, email, plan, status')
      .eq('id', targetId)
      .maybeSingle()

    return NextResponse.json({ success: true, user: updated })
  }

  if (action === 'set_plan') {
    const { plan } = body as { plan: 'free' | 'pro' | 'agency' }
    if (!['free', 'pro', 'agency'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }
    // Prevent downgrading own plan to free
    if (plan === 'free' && targetId === user.id) {
      return NextResponse.json({ error: 'Cannot downgrade your own plan' }, { status: 400 })
    }

    const [profileUpdate, subUpdate] = await Promise.all([
      db.from('users_profile').update({ plan, updated_at: now }).eq('id', targetId),
      db.from('subscriptions').update({ plan, updated_at: now }).eq('user_id', targetId),
    ])

    if (profileUpdate.error) return NextResponse.json({ error: profileUpdate.error.message }, { status: 500 })

    const { data: updated } = await db
      .from('users_profile')
      .select('id, email, plan, status')
      .eq('id', targetId)
      .maybeSingle()

    return NextResponse.json({ success: true, user: updated })
  }

  if (action === 'reset_usage') {
    const { error } = await db
      .from('usage_limits')
      .update({
        searches_this_month: 0,
        exports_count: 0,
        last_reset_at: now,
        updated_at: now,
      })
      .eq('user_id', targetId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
