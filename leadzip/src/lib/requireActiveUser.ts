import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Shared authentication gate for API routes.
 *
 * WHY THIS EXISTS
 * ---------------
 * Deactivating an account (admin > Users > Deactivate) flips
 * `users_profile.status` to 'deactivated' and revokes the user's sessions, but
 * a session cookie already in flight stays cryptographically valid until it
 * expires. `src/proxy.ts` re-checks status on every PROTECTED PAGE, so the
 * browser UI is covered. It does NOT cover API routes: a deactivated caller
 * with a live cookie could still POST straight at the endpoints, including the
 * ones that spend money upstream (Google Places, Hunter.io, Anthropic, outbound
 * website probes, CRM exports, invitation email).
 *
 * So every authenticated route re-checks status server-side, through this one
 * helper rather than fifteen copies of the same query.
 *
 * ONE ROUND TRIP
 * --------------
 * Routes that already needed profile columns (plan, role, ...) pass them in
 * `columns` and get them back on `profile`, so the status check adds no extra
 * query. `supabase.auth.getUser()` is the only other call, and every route made
 * that already.
 *
 * FAIL-OPEN ON A READ ERROR, BY DESIGN
 * ------------------------------------
 * A failed profile read is an infrastructure problem, not evidence that the
 * account is deactivated. Locking every paying customer out of the product on a
 * transient PostgREST error (or on a database where the `status` column
 * predates 20260518_user_status.sql) would be far worse than the residual
 * window, which the proxy already closes for pages. We log and let the request
 * through. Only an explicit 'deactivated' blocks.
 */

/** users_profile row, narrowed to what this module guarantees. */
export interface ActiveUserProfile {
  status?: string | null
  [column: string]: unknown
}

export type RequireActiveUserResult =
  | { ok: true; user: User; profile: ActiveUserProfile | null }
  | {
      ok: false
      /** Lets a route keep a bespoke response for one case (see /api/leads/saved). */
      reason: 'unauthenticated' | 'deactivated'
      response: NextResponse
    }

export interface RequireActiveUserOptions {
  /**
   * Extra `users_profile` columns this route needs. They are fetched in the
   * SAME query as the status check and returned on `profile`.
   */
  columns?: readonly string[]
  /**
   * Merged into the error response body. Only for routes whose clients already
   * read a different shape, e.g. `{ success: false }` on /api/leads/save.
   */
  extraBody?: Record<string, unknown>
}

const UNAUTHORIZED_MESSAGE = 'Unauthorized'
/** User-facing: says what to do, names nothing internal. */
const DEACTIVATED_MESSAGE =
  'This account has been deactivated. Contact support if you think that is a mistake.'

/**
 * Resolve the caller and confirm the account is still active.
 *
 * Returns `{ ok: true, user, profile }`, or `{ ok: false, reason, response }`
 * with the 401/403 the route should return unchanged.
 */
export async function requireActiveUser(
  supabase: SupabaseClient,
  options: RequireActiveUserOptions = {}
): Promise<RequireActiveUserResult> {
  const { columns = [], extraBody } = options

  const deny = (
    reason: 'unauthenticated' | 'deactivated',
    message: string,
    status: number
  ): RequireActiveUserResult => ({
    ok: false,
    reason,
    response: NextResponse.json({ ...extraBody, error: message }, { status }),
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return deny('unauthenticated', UNAUTHORIZED_MESSAGE, 401)

  // Single round trip: 'status' plus whatever the route asked for.
  const select = ['status', ...columns.filter((c) => c !== 'status')].join(', ')

  const { data, error } = await supabase
    .from('users_profile')
    .select(select)
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.warn('[requireActiveUser] users_profile lookup failed', error.message)
    return { ok: true, user, profile: null }
  }

  const profile = (data ?? null) as ActiveUserProfile | null
  if (profile?.status === 'deactivated') {
    return deny('deactivated', DEACTIVATED_MESSAGE, 403)
  }

  return { ok: true, user, profile }
}
