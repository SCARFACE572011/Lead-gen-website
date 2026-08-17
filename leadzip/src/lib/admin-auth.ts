import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isPlatformAdminRecord } from '@/lib/adminPolicy'

type AuthUser = {
  id: string
  email?: string | null
}

type AdminResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse }

function platformAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) return null

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Platform-admin access is an explicit owner grant, never a subscription
 * entitlement. Both checks must pass:
 *
 *  1. the profile has the platform `admin` role and is active; and
 *  2. the account email is present in the locked-down admin_allowlist table.
 *
 * Agency workspace ownership is deliberately unrelated. A customer can be an
 * owner in workspace_members and still has no access to global users, billing,
 * sales, or analytics.
 */
export async function hasPlatformAdminAccess(
  user: AuthUser,
  adminDb: SupabaseClient | null = platformAdminClient(),
): Promise<boolean> {
  const email = (user.email ?? '').trim().toLowerCase()
  if (!adminDb || !email) return false

  const [profileResult, allowlistResult] = await Promise.all([
    adminDb
      .from('users_profile')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle(),
    adminDb
      .from('admin_allowlist')
      .select('email')
      .eq('email', email)
      .maybeSingle(),
  ])

  if (profileResult.error) return false

  return isPlatformAdminRecord(
    profileResult.data,
    allowlistResult.error ? null : allowlistResult.data?.email,
    email
  )
}

/**
 * Verify the current session belongs to a real admin owner.
 * Returns { ok:true, userId, email } or { ok:false, response } with the
 * appropriate 401/403 to return from the route.
 */
export async function requirePlatformAdmin(supabase: SupabaseClient): Promise<AdminResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const email = (user.email ?? '').trim().toLowerCase()
  if (!(await hasPlatformAdminAccess(user))) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { ok: true, userId: user.id, email }
}

// Backwards-compatible name for any route not yet migrated to the clearer
// platform-admin terminology.
export const requireAdmin = requirePlatformAdmin
