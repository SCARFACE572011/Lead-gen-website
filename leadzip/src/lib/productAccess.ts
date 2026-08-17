import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeProductPlan, type ProductPlan } from '@/lib/planPolicy'

export interface ProductAccess {
  userId: string
  plan: ProductPlan
  role: 'user' | 'admin'
  /** User whose shared allowance/rate-limit bucket should be charged. */
  quotaSubjectUserId: string
  workspaceId: string | null
}

type ProfileRow = {
  plan?: unknown
  role?: unknown
  status?: unknown
  workspace_id?: unknown
  email?: unknown
}

async function isAllowlistedPlatformAdmin(
  db: SupabaseClient,
  userId: string,
  profile: ProfileRow
): Promise<boolean> {
  if (profile.role !== 'admin' || profile.status === 'deactivated') return false

  let email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : ''
  if (!email) {
    const { data } = await db
      .from('users_profile')
      .select('email')
      .eq('id', userId)
      .maybeSingle()
    email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : ''
  }
  if (!email) return false

  const { data, error } = await db
    .from('admin_allowlist')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  return !error && data?.email === email
}

async function ownSubscriptionPlan(
  db: SupabaseClient,
  userId: string
): Promise<ProductPlan> {
  const { data } = await db
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .in('plan', ['pro', 'agency'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return normalizeProductPlan(data?.plan)
}

/**
 * Resolve effective product access without trusting a copied workspace plan.
 *
 * Agency members charge the active owner's shared allowance. If that owner is
 * no longer active on Agency, the member immediately falls back to their own
 * active subscription (or Free), even before background/profile cleanup runs.
 */
export async function resolveProductAccess(
  db: SupabaseClient,
  userId: string,
  knownProfile?: ProfileRow | null
): Promise<ProductAccess | null> {
  let profile = knownProfile ?? null
  if (!profile) {
    const { data, error } = await db
      .from('users_profile')
      .select('plan, role, status, workspace_id')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) return null
    profile = data
  }

  if (profile.status === 'deactivated') return null

  const role = (await isAllowlistedPlatformAdmin(db, userId, profile))
    ? 'admin'
    : 'user'
  const workspaceId =
    typeof profile.workspace_id === 'string' ? profile.workspace_id : null

  if (role === 'admin') {
    return {
      userId,
      plan: 'agency',
      role,
      quotaSubjectUserId: userId,
      workspaceId,
    }
  }

  if (workspaceId) {
    const [{ data: workspace }, { data: membership }] = await Promise.all([
      db
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .maybeSingle(),
      db
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .maybeSingle(),
    ])

    if (workspace?.owner_id && membership && workspace.owner_id !== userId) {
      const { data: owner } = await db
        .from('users_profile')
        .select('plan, role, status, email')
        .eq('id', workspace.owner_id)
        .maybeSingle()

      const ownerIsPlatformAdmin = owner
        ? await isAllowlistedPlatformAdmin(db, workspace.owner_id, owner)
        : false

      let ownerHasAgencySubscription = false
      if (owner?.status === 'active' && owner.plan === 'agency' && !ownerIsPlatformAdmin) {
        const { data: ownerSubscription } = await db
          .from('subscriptions')
          .select('id')
          .eq('user_id', workspace.owner_id)
          .eq('plan', 'agency')
          .in('status', ['active', 'trialing'])
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        ownerHasAgencySubscription = !!ownerSubscription
      }

      if (
        owner?.status === 'active' &&
        (ownerIsPlatformAdmin || ownerHasAgencySubscription)
      ) {
        return {
          userId,
          plan: 'agency',
          role,
          quotaSubjectUserId: workspace.owner_id,
          workspaceId,
        }
      }

      return {
        userId,
        plan: await ownSubscriptionPlan(db, userId),
        role,
        quotaSubjectUserId: userId,
        workspaceId,
      }
    }

    // A dangling workspace link must not preserve a copied Agency plan.
    if (!workspace?.owner_id || !membership) {
      return {
        userId,
        plan: await ownSubscriptionPlan(db, userId),
        role,
        quotaSubjectUserId: userId,
        workspaceId,
      }
    }
  }

  // A profile plan is a denormalized display/cache value updated by Stripe
  // webhooks. Do not treat it as billing authority: delayed or failed webhook
  // cleanup must not preserve paid access after a subscription ends.
  return {
    userId,
    plan: await ownSubscriptionPlan(db, userId),
    role,
    quotaSubjectUserId: userId,
    workspaceId,
  }
}
