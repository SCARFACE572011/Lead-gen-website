import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { paidPlanFromSubscription } from '@/lib/stripe/subscriptionSync'
import { PLAN_POLICY, type ProductPlan } from '@/lib/planPolicy'
import { isPlatformAdminRecord } from '@/lib/adminPolicy'
import {
  EMAIL_CREDIT_PACK_DEFINITIONS,
  EMAIL_CREDIT_TRIAL_ALLOWANCES,
  emailCreditPackDefinitionBySlug,
  type EmailCreditPackDefinition,
} from '@/lib/emailCreditPolicy'

export {
  EMAIL_CREDIT_PACK_DEFINITIONS,
  EMAIL_CREDIT_TRIAL_ALLOWANCES,
}
export type EmailCreditPlan = ProductPlan

export interface ConfiguredEmailCreditPack {
  slug: EmailCreditPackDefinition['slug']
  credits: number
  amountCents: number
  priceId: string | null
  configured: boolean
}

export interface EmailCreditContext {
  actorUserId: string
  ownerId: string
  plan: EmailCreditPlan
  isShared: boolean
  isPlatformAdmin: boolean
  allowanceKey: string
  allowanceSize: number
  allowanceEndsAt: string | null
  allowanceSourceVersion: number | null
}

export interface EmailCreditBalance {
  ownerId: string
  plan: EmailCreditPlan
  shared: boolean
  includedRemaining: number
  purchasedRemaining: number
  creditDebt: number
  totalRemaining: number
  allowanceSize: number
  allowanceEndsAt: string | null
}

interface ProfileRow {
  id: string
  email?: string | null
  plan?: string | null
  role?: string | null
  status?: string | null
  workspace_id?: string | null
}

interface SubscriptionRow {
  id: string
  stripe_subscription_id?: string | null
  plan?: string | null
  status?: string | null
  current_period_start?: string | null
  current_period_end?: string | null
}

interface BalanceRow {
  included_remaining?: number | null
  purchased_remaining?: number | null
  credit_debt?: number | null
  total_remaining?: number | null
  allowance_key?: string | null
  allowance_size?: number | null
  allowance_ends_at?: string | null
}

/**
 * Thrown when the email-credit migration has not been applied to this database
 * yet. Callers should treat the feature as not available rather than as broken,
 * and must never fall back to serving paid lookups without a ledger.
 */
export class EmailCreditSchemaMissingError extends Error {
  constructor(detail: string) {
    super(`Email credit schema is not migrated: ${detail}`)
    this.name = 'EmailCreditSchemaMissingError'
  }
}

/**
 * 42883 / PGRST202 = missing function, 42P01 / PGRST205 = missing table.
 * The credit RPCs and their tables ship in the same migration, so either code
 * means the same thing here.
 */
export function isMissingEmailCreditSchema(error: unknown): boolean {
  if (error instanceof EmailCreditSchemaMissingError) return true
  if (typeof error !== 'object' || error === null) return false
  const code = (error as { code?: unknown }).code
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    code === '42P01' ||
    code === 'PGRST205'
  )
}

function throwDatabaseError(error: { code?: string; message: string }): never {
  if (isMissingEmailCreditSchema(error)) {
    throw new EmailCreditSchemaMissingError(error.message)
  }
  throw new Error(error.message)
}

function normalizePlan(value: unknown): EmailCreditPlan {
  return value === 'pro' || value === 'agency' ? value : 'free'
}

function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data ?? null
}

function utcMonthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function nextUtcMonth(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString()
}

async function isLockedPlatformAdmin(
  db: SupabaseClient,
  profile: ProfileRow
): Promise<boolean> {
  const email = profile.email?.trim().toLowerCase()
  if (profile.role !== 'admin' || profile.status === 'deactivated' || !email) return false

  const { data, error } = await db
    .from('admin_allowlist')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  // The allowlist is service-role-only. Any lookup/configuration error fails
  // closed instead of treating a mutable profile role as owner authority.
  return !error && isPlatformAdminRecord(profile, data?.email, email)
}

export function emailCreditPacksEnabled(): boolean {
  // Commercial redistribution of provider data must be approved before this
  // flag is enabled. Checkout and the public pack list both fail closed.
  return process.env.EMAIL_CREDIT_PACKS_ENABLED === 'true'
}

export function configuredEmailCreditPacks(): ConfiguredEmailCreditPack[] {
  return EMAIL_CREDIT_PACK_DEFINITIONS.map((pack) => {
    const priceId = process.env[pack.envName]?.trim() || null
    return {
      slug: pack.slug,
      credits: pack.credits,
      amountCents: pack.amountCents,
      priceId,
      configured: Boolean(
        priceId && priceId.startsWith('price_') && !priceId.includes('placeholder')
      ),
    }
  })
}

export function emailCreditPackBySlug(slug: unknown): ConfiguredEmailCreditPack | null {
  if (typeof slug !== 'string') return null
  return configuredEmailCreditPacks().find((pack) => pack.slug === slug) ?? null
}

export function emailCreditPackByPriceId(priceId: string): ConfiguredEmailCreditPack | null {
  const matches = configuredEmailCreditPacks().filter(
    (pack) => pack.configured && pack.priceId === priceId
  )
  // Duplicate Price IDs in env are ambiguous and therefore unsafe to fulfill.
  return matches.length === 1 ? matches[0] : null
}

/** Resolve an Agency teammate to the workspace owner who actually pays. */
export async function resolveEmailCreditContext(
  db: SupabaseClient,
  actorUserId: string
): Promise<EmailCreditContext> {
  const { data: actorData, error: actorError } = await db
    .from('users_profile')
    .select('id, email, plan, role, status, workspace_id')
    .eq('id', actorUserId)
    .maybeSingle()

  if (actorError || !actorData) {
    throw new Error(actorError?.message || 'Email-credit profile was not found.')
  }

  const actor = actorData as ProfileRow
  const actorIsPlatformAdmin = await isLockedPlatformAdmin(db, actor)
  let ownerId = actorUserId

  if (actor.workspace_id && !actorIsPlatformAdmin) {
    const [workspaceResult, membershipResult] = await Promise.all([
      db
        .from('workspaces')
        .select('owner_id')
        .eq('id', actor.workspace_id)
        .maybeSingle(),
      db
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', actor.workspace_id)
        .eq('user_id', actorUserId)
        .maybeSingle(),
    ])

    if (workspaceResult.error) throw new Error(workspaceResult.error.message)
    if (membershipResult.error) throw new Error(membershipResult.error.message)
    const workspace = workspaceResult.data

    // workspace_id was historically client-writable. It is only a hint; an
    // actual membership row is the authority to consume a shared owner pool.
    if (workspace?.owner_id && membershipResult.data) {
      const candidateOwnerId = workspace.owner_id as string
      const [candidateProfileResult, candidateSubscriptionResult] = await Promise.all([
        db
          .from('users_profile')
          .select('id, email, plan, role, status, workspace_id')
          .eq('id', candidateOwnerId)
          .maybeSingle(),
        db
          .from('subscriptions')
          .select('id, stripe_subscription_id, plan, status, current_period_start, current_period_end')
          .eq('user_id', candidateOwnerId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (candidateProfileResult.error) throw new Error(candidateProfileResult.error.message)
      if (candidateSubscriptionResult.error) throw new Error(candidateSubscriptionResult.error.message)
      const candidateProfile = candidateProfileResult.data
      const candidateSubscription = candidateSubscriptionResult.data

      const candidateSubscriptionActive =
        candidateSubscription?.status === 'active' || candidateSubscription?.status === 'trialing'
      const candidateIsPlatformAdmin = candidateProfile
        ? await isLockedPlatformAdmin(db, candidateProfile as ProfileRow)
        : false
      const candidatePlan = candidateProfile?.status !== 'active'
        ? 'free'
        : candidateIsPlatformAdmin
          ? 'agency'
          : candidateSubscriptionActive
            ? normalizePlan(candidateSubscription?.plan)
            : 'free'

      // A stale workspace link must not make a former Agency owner's free
      // balance the entire team's balance. Only a currently-entitled Agency
      // owner supplies a shared pool; otherwise the member falls back to self.
      if (candidatePlan === 'agency') ownerId = candidateOwnerId
    }
  }

  let owner = actor
  if (ownerId !== actorUserId) {
    const { data: ownerData, error: ownerError } = await db
      .from('users_profile')
      .select('id, email, plan, role, status, workspace_id')
      .eq('id', ownerId)
      .maybeSingle()
    if (ownerError || !ownerData) {
      throw new Error(ownerError?.message || 'Workspace billing owner was not found.')
    }
    owner = ownerData as ProfileRow
  }

  const { data: subscriptionData, error: subscriptionError } = await db
    .from('subscriptions')
    .select(
      'id, stripe_subscription_id, plan, status, current_period_start, current_period_end'
    )
    .eq('user_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (subscriptionError) throw new Error(subscriptionError.message)
  const subscription = (subscriptionData ?? null) as SubscriptionRow | null

  // Paid customer access requires a live Stripe row. users_profile.plan is a
  // denormalized display/cache field and is never sufficient by itself. The
  // only subscription-free exception is a locked, allowlisted platform admin.
  const subscriptionIsActive =
    subscription?.status === 'active' || subscription?.status === 'trialing'
  const ownerIsPlatformAdmin = ownerId === actorUserId
    ? actorIsPlatformAdmin
    : await isLockedPlatformAdmin(db, owner)
  const subscriptionPlan = subscriptionIsActive ? normalizePlan(subscription?.plan) : 'free'
  const plan = ownerIsPlatformAdmin
    ? 'agency'
    : subscriptionPlan !== 'free'
      ? subscriptionPlan
      : 'free'

  if (ownerIsPlatformAdmin) {
    return {
      actorUserId,
      ownerId,
      plan: 'agency',
      isShared: false,
      isPlatformAdmin: true,
      allowanceKey: `agency:admin:${utcMonthKey()}`,
      allowanceSize: PLAN_POLICY.agency.includedEmailCredits,
      allowanceEndsAt: nextUtcMonth(),
      allowanceSourceVersion: null,
    }
  }

  if (plan === 'free') {
    return {
      actorUserId,
      ownerId,
      plan,
      isShared: ownerId !== actorUserId,
      isPlatformAdmin: false,
      allowanceKey: 'free:lifetime',
      allowanceSize: PLAN_POLICY.free.includedEmailCredits,
      allowanceEndsAt: null,
      allowanceSourceVersion: null,
    }
  }

  if (subscription && subscriptionIsActive) {
    const subscriptionKey = subscription.stripe_subscription_id || subscription.id
    if (subscription.status === 'trialing') {
      return {
        actorUserId,
        ownerId,
        plan,
        isShared: ownerId !== actorUserId,
        isPlatformAdmin: false,
        allowanceKey: `${plan}:trial:${subscriptionKey}`,
        allowanceSize: EMAIL_CREDIT_TRIAL_ALLOWANCES[plan],
        allowanceEndsAt: subscription.current_period_end || null,
        allowanceSourceVersion: null,
      }
    }

    // Included credits are a monthly allowance even when Stripe bills yearly.
    // Lazy balance preparation rolls this key on the first request each month.
    return {
      actorUserId,
      ownerId,
      plan,
      isShared: ownerId !== actorUserId,
      isPlatformAdmin: false,
      allowanceKey: `${plan}:month:${utcMonthKey()}`,
      allowanceSize: PLAN_POLICY[plan].includedEmailCredits,
      allowanceEndsAt: nextUtcMonth(),
      allowanceSourceVersion: null,
    }
  }

  throw new Error('Paid email-credit context has no active subscription.')
}

export async function syncEmailCreditAllowance(
  db: SupabaseClient,
  context: EmailCreditContext
): Promise<void> {
  const { error } = await db.rpc('sync_email_credit_allowance', {
    p_owner_id: context.ownerId,
    p_plan: context.plan,
    p_allowance_key: context.allowanceKey,
    p_allowance_size: context.allowanceSize,
    p_allowance_ends_at: context.allowanceEndsAt,
    p_source_version: context.allowanceSourceVersion,
  })
  if (error) throwDatabaseError(error)
}

/** Lock-free read of the current account row. Returns null when there is none. */
async function readEmailCreditAccountRow(
  db: SupabaseClient,
  ownerId: string
): Promise<BalanceRow | null> {
  const { data, error } = await db.rpc('get_email_credit_balance', {
    p_owner_id: ownerId,
  })
  if (error) throwDatabaseError(error)
  return firstRow(data as BalanceRow | BalanceRow[] | null)
}

function balanceFromRow(row: BalanceRow, context: EmailCreditContext): EmailCreditBalance {
  return {
    ownerId: context.ownerId,
    plan: context.plan,
    shared: context.isShared,
    includedRemaining: Number(row.included_remaining ?? 0),
    purchasedRemaining: Number(row.purchased_remaining ?? 0),
    creditDebt: Number(row.credit_debt ?? 0),
    totalRemaining: Number(row.total_remaining ?? 0),
    allowanceSize: Number(row.allowance_size ?? context.allowanceSize),
    allowanceEndsAt: row.allowance_ends_at ?? context.allowanceEndsAt,
  }
}

/**
 * Sync only when the stored period key is not the one this request resolved.
 *
 * sync_email_credit_allowance takes a platform-wide advisory lock, so calling
 * it on every request lets any signed-in user serialize every other tenant's
 * credit operations. When the key already matches, that RPC is a no-op for a
 * lazy (non-webhook) sync, so skipping it is behaviour-preserving and leaves
 * the lock for the once-a-month roll that actually needs it.
 */
async function ensureEmailCreditAllowance(
  db: SupabaseClient,
  context: EmailCreditContext
): Promise<BalanceRow | null> {
  const current = await readEmailCreditAccountRow(db, context.ownerId)
  if (current && current.allowance_key === context.allowanceKey) return current
  await syncEmailCreditAllowance(db, context)
  return null
}

export async function prepareEmailCreditAccount(
  db: SupabaseClient,
  actorUserId: string
): Promise<EmailCreditContext> {
  const context = await resolveEmailCreditContext(db, actorUserId)
  await ensureEmailCreditAllowance(db, context)
  return context
}

export async function readEmailCreditBalance(
  db: SupabaseClient,
  context: EmailCreditContext
): Promise<EmailCreditBalance> {
  const row = await readEmailCreditAccountRow(db, context.ownerId)
  if (!row) throw new Error('Email-credit balance was not found.')
  return balanceFromRow(row, context)
}

export async function prepareAndReadEmailCreditBalance(
  db: SupabaseClient,
  actorUserId: string
): Promise<EmailCreditBalance> {
  const context = await resolveEmailCreditContext(db, actorUserId)
  const current = await ensureEmailCreditAllowance(db, context)
  // Already on the current period: the read above is the whole request, and no
  // global lock was taken.
  if (current) return balanceFromRow(current, context)
  return readEmailCreditBalance(db, context)
}

/**
 * Sync a known Stripe subscription period without waiting for the lazy balance
 * route. Used by checkout/subscription/invoice webhooks.
 */
export async function syncEmailCreditsForSubscription(
  db: SupabaseClient,
  userId: string,
  planValue: unknown,
  subscription: Stripe.Subscription,
  sourceVersion: number | null = null
): Promise<void> {
  const requestedPlan = normalizePlan(planValue)
  if (requestedPlan === 'free') {
    await syncEmailCreditsForFreePlan(db, userId, sourceVersion)
    return
  }
  const plan = paidPlanFromSubscription(subscription)
  if (!plan || plan !== requestedPlan) {
    throw new Error('Stripe subscription Price does not match the requested email-credit plan.')
  }
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    throw new Error('Inactive Stripe subscription cannot receive email credits.')
  }

  const context = await resolveEmailCreditContext(db, userId)
  if (context.isPlatformAdmin) {
    await syncEmailCreditAllowance(db, {
      ...context,
      ownerId: userId,
      isShared: false,
    })
    return
  }
  const item = subscription.items.data[0]
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null

  const isTrial = subscription.status === 'trialing'

  await syncEmailCreditAllowance(db, {
    ...context,
    // Stripe subscription events always belong to the billed user. Do not let
    // a stale workspace membership redirect that user's subscription grant.
    ownerId: userId,
    isShared: false,
    plan,
    allowanceKey: isTrial
      ? `${plan}:trial:${subscription.id}`
      : `${plan}:month:${utcMonthKey()}`,
    allowanceSize: isTrial
      ? EMAIL_CREDIT_TRIAL_ALLOWANCES[plan]
      : PLAN_POLICY[plan].includedEmailCredits,
    allowanceEndsAt: isTrial ? periodEnd : nextUtcMonth(),
    allowanceSourceVersion: sourceVersion,
  })
}

export async function syncEmailCreditsForFreePlan(
  db: SupabaseClient,
  userId: string,
  sourceVersion: number | null = null
): Promise<void> {
  const context = await resolveEmailCreditContext(db, userId)
  if (context.isPlatformAdmin) {
    await syncEmailCreditAllowance(db, {
      ...context,
      ownerId: userId,
      isShared: false,
    })
    return
  }
  await syncEmailCreditAllowance(db, {
    ...context,
    // A canceled workspace owner must update their own allowance account, even
    // while a stale workspace relationship is being repaired elsewhere.
    ownerId: userId,
    isShared: false,
    plan: 'free',
    allowanceKey: 'free:lifetime',
    allowanceSize: PLAN_POLICY.free.includedEmailCredits,
    allowanceEndsAt: null,
    allowanceSourceVersion: sourceVersion,
  })
}

export interface PackFulfillmentResult {
  ok: boolean
  granted: boolean
  ignored?: boolean
  error?: string
}

/** Retrieve and verify every authoritative Stripe field before granting. */
export async function fulfillEmailCreditPackCheckout(
  stripe: Stripe,
  db: SupabaseClient,
  sessionId: string
): Promise<PackFulfillmentResult> {
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    })
  } catch {
    return { ok: false, granted: false, error: 'session_retrieve_failed' }
  }

  if (session.mode !== 'payment' || session.metadata?.kind !== 'email_credit_pack') {
    return { ok: true, granted: false, ignored: true }
  }
  // The feature flag gates creation of new Checkout Sessions. Once Stripe has
  // accepted payment, fulfillment must remain available even if sales are
  // disabled while the webhook is in flight.
  if (session.payment_status !== 'paid') {
    return { ok: false, granted: false, error: 'payment_not_paid' }
  }

  const items = session.line_items?.data ?? []
  if (items.length !== 1 || items[0]?.quantity !== 1) {
    return { ok: false, granted: false, error: 'invalid_line_items' }
  }

  const price = items[0]?.price
  const priceId = typeof price === 'string' ? price : price?.id
  if (!priceId) return { ok: false, granted: false, error: 'missing_price' }

  // Resolve from what was recorded when the customer paid, never from live env.
  // The slug was written into the Session metadata by our authenticated
  // checkout route, and the credits/amount for that slug live in code, so a
  // rotated or removed Price ID cannot strand a purchase Stripe already
  // charged. The amount check below still binds the grant to what was paid.
  const pack = emailCreditPackDefinitionBySlug(session.metadata?.pack_slug)
  if (!pack) return { ok: false, granted: false, error: 'unrecognized_pack' }

  if (
    session.amount_subtotal !== pack.amountCents ||
    session.amount_total !== pack.amountCents ||
    session.currency?.toLowerCase() !== 'usd'
  ) {
    return { ok: false, granted: false, error: 'price_amount_mismatch' }
  }

  // Not fatal: a mismatch here means the Price ID was rotated after the
  // customer paid. Worth an operator log, never a reason to withhold credits.
  const configuredPriceId = process.env[pack.envName]?.trim() || null
  if (configuredPriceId && configuredPriceId !== priceId) {
    console.warn(
      `[email-credits] fulfilling pack=${pack.slug} on a Price that is no longer configured`
    )
  }

  const actorUserId = session.metadata?.user_id
  const ownerId = session.metadata?.balance_owner_id
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id

  if (
    !actorUserId ||
    !ownerId ||
    !paymentIntentId ||
    session.client_reference_id !== actorUserId
  ) {
    return { ok: false, granted: false, error: 'missing_purchase_identity' }
  }

  // Pack checkout permits only the billing owner. Both values were written by
  // our authenticated server route and are covered by Stripe's webhook
  // signature; current workspace state may legitimately change while the buyer
  // is on Stripe, so do not make fulfillment depend on a later membership read.
  if (actorUserId !== ownerId) {
    return { ok: false, granted: false, error: 'purchase_owner_mismatch' }
  }

  const { data, error } = await db.rpc('grant_email_credit_pack', {
    p_owner_id: ownerId,
    p_actor_user_id: actorUserId,
    p_checkout_session_id: session.id,
    p_payment_intent_id: paymentIntentId,
    p_price_id: priceId,
    p_pack_slug: pack.slug,
    p_credits: pack.credits,
    p_amount_paid: pack.amountCents,
    p_currency: 'usd',
  })
  if (error) {
    // Surface the schema-missing case distinctly so an already-paid pack is
    // retried after migration rather than being treated as a hard failure.
    if (isMissingEmailCreditSchema(error)) throwDatabaseError(error)
    return { ok: false, granted: false, error: error.message }
  }
  return { ok: true, granted: data === true }
}

export async function adjustEmailCreditPack(
  db: SupabaseClient,
  input: {
    paymentIntentId: string
    eventKey: string
    sourceType: 'refund' | 'dispute'
    sourceId: string
    amountCents: number
    active: boolean
  }
): Promise<'adjusted' | 'duplicate' | 'not_pack'> {
  const { data, error } = await db.rpc('adjust_email_credit_pack', {
    p_payment_intent_id: input.paymentIntentId,
    p_event_key: input.eventKey,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_amount_cents: input.amountCents,
    p_active: input.active,
  })
  // throwDatabaseError, not a bare Error: a plain Error drops the PostgREST
  // code, and the webhook needs that code to tell "the credit schema is not
  // migrated yet" apart from a real failure. Without it the refund and
  // dispute handlers could never degrade gracefully.
  if (error) throwDatabaseError(error)
  return data as 'adjusted' | 'duplicate' | 'not_pack'
}
