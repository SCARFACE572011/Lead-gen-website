import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Defense-in-depth for admin API access. A caller must satisfy BOTH:
//   1. users_profile.role === 'admin' (the normal check), AND
//   2. their account email is on this owner allowlist.
// So even if the users_profile privileged-column lockdown migration
// (20260810) has not been applied yet — a window in which a user could set
// their own role to 'admin' via PostgREST — they still cannot reach any admin
// endpoint unless they are a real owner. Keep this list in sync with the
// handle_new_user trigger (supabase/schema.sql + 20260811_admin_emails.sql).
const ADMIN_EMAILS = new Set<string>([
  'scarface572011@live.com',
  'jezdangomez@gmail.com',
])

/** True only for a real owner email (case-insensitive). Use alongside the
 *  role==='admin' DB check for defense-in-depth on admin endpoints. */
export function isAdminEmail(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.has((email ?? '').trim().toLowerCase())
}

type AdminResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse }

/**
 * Verify the current session belongs to a real admin owner.
 * Returns { ok:true, userId, email } or { ok:false, response } with the
 * appropriate 401/403 to return from the route.
 */
export async function requireAdmin(supabase: SupabaseClient): Promise<AdminResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const email = (user.email ?? '').trim().toLowerCase()

  // `status` is read in the SAME query as `role`: an owner whose own account has
  // been deactivated must lose admin access too. Deactivation revokes sessions,
  // but a cookie already in flight stays valid until it expires and the proxy
  // only re-checks status on pages, never on these API routes.
  const { data: profile } = await supabase
    .from('users_profile')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin' || profile?.status === 'deactivated' || !ADMIN_EMAILS.has(email)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { ok: true, userId: user.id, email }
}
