import { createClient } from '@supabase/supabase-js'
import { resolveProductAccess } from '@/lib/productAccess'
import type { ProductPlan } from '@/lib/planPolicy'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface GeneratedKey {
  raw: string
  hash: string
  prefix: string
}

export async function generateApiKey(): Promise<GeneratedKey> {
  const secret = randomHex(24) // 48 hex chars
  const raw = `lz_live_${secret}`
  const hash = await sha256Hex(raw)
  const prefix = raw.slice(0, 16) // "lz_live_xxxxxxxx"
  return { raw, hash, prefix }
}

export interface ValidatedKey {
  userId: string
  quotaSubjectUserId: string
  plan: ProductPlan
  role: 'user' | 'admin'
  keyId: string
  /** When the key was issued. Decides legacy access, see resolveApiAccess. */
  createdAt: string | null
}

/**
 * The outcome of authenticating a bearer key.
 *
 * 'invalid' is a statement of fact about the key (unknown, revoked, or the
 * owning account is deactivated). 'unavailable' means we could not check right
 * now, which is a very different thing to tell a paying customer: a Redis or
 * Postgres blip must not be reported as "your key was revoked".
 */
export type ApiKeyAuthResult =
  | { status: 'valid'; key: ValidatedKey }
  | { status: 'invalid' }
  | { status: 'unavailable' }

/**
 * API v1 is an Agency feature. /api-docs states this, and POST /api/api-keys
 * only issues keys to Agency accounts.
 *
 * It used to be included on every plan (Free 100, Pro 1,000 requests a day), so
 * keys that already existed when the policy shipped keep the daily quota that
 * was published when they were issued until the sunset date below. That keeps
 * integrations that work today working on the day this deploys, and every
 * grandfathered response carries Deprecation and Sunset headers saying exactly
 * what changes and when. Keys issued after the cutoff are Agency only.
 *
 * The cutoff is the day after this shipped so that a key created earlier on
 * release day, while the old rules were still live, is still treated as
 * pre-existing.
 */
const AGENCY_ONLY_FROM = Date.parse('2026-08-18T00:00:00Z')
export const LEGACY_API_ACCESS_ENDS = Date.parse('2026-10-16T00:00:00Z')
const LEGACY_SUNSET_HTTP_DATE = new Date(LEGACY_API_ACCESS_ENDS).toUTCString()
const LEGACY_SUNSET_LABEL = '16 October 2026'

const PLAN_LABEL: Record<ProductPlan, string> = {
  free: 'Free',
  pro: 'Pro',
  agency: 'Agency',
}

export type ApiAccessDecision =
  | { allowed: true; quotaPlan: ProductPlan; legacy: boolean }
  | { allowed: false; message: string }

/**
 * Decide whether a key may call v1, and which daily quota it is held to.
 *
 * `quotaPlan` names the published quota to apply: Agency keys (and platform
 * owners) get the current Agency allowance, grandfathered keys keep the Free or
 * Pro allowance they were sold until the sunset date.
 */
export function resolveApiAccess(
  key: Pick<ValidatedKey, 'plan' | 'role' | 'createdAt'>,
  now: number = Date.now()
): ApiAccessDecision {
  if (key.role === 'admin' || key.plan === 'agency') {
    return { allowed: true, quotaPlan: 'agency', legacy: false }
  }

  // An unreadable or absent timestamp is treated as pre-existing: during the
  // transition the safe direction is to keep a working integration working.
  const issuedAt = key.createdAt ? Date.parse(key.createdAt) : Number.NaN
  const issuedBeforeCutoff = !(Number.isFinite(issuedAt) && issuedAt >= AGENCY_ONLY_FROM)

  if (issuedBeforeCutoff && now < LEGACY_API_ACCESS_ENDS) {
    return { allowed: true, quotaPlan: key.plan, legacy: true }
  }

  const label = PLAN_LABEL[key.plan]
  return {
    allowed: false,
    message: issuedBeforeCutoff
      ? `API access is included with the Agency plan. This key kept working on ${label} until ${LEGACY_SUNSET_LABEL}, and that transition period has ended. Upgrade to Agency at https://leadzipp.com/pricing to turn it back on.`
      : `API access is included with the Agency plan. This key belongs to a ${label} account, so it cannot call the LeadZipp API. Upgrade to Agency at https://leadzipp.com/pricing to enable it.`,
  }
}

/** Headers that tell a grandfathered integration what changes and when. */
export function legacyApiAccessHeaders(): Record<string, string> {
  return {
    Deprecation: 'true',
    Sunset: LEGACY_SUNSET_HTTP_DATE,
    'X-Api-Deprecation-Notice': `API access moves to the Agency plan on ${LEGACY_SUNSET_LABEL}. This key keeps working until then. See https://leadzipp.com/api-docs`,
  }
}

export async function validateApiKey(raw: string): Promise<ApiKeyAuthResult> {
  if (!raw?.startsWith('lz_live_')) return { status: 'invalid' }

  const hash = await sha256Hex(raw)
  const db = serviceClient()

  const { data: keyRow, error: keyError } = await db
    .from('api_keys')
    .select('id, user_id, created_at')
    .eq('key_hash', hash)
    .maybeSingle()

  if (keyError) {
    console.error('[api-key] key lookup failed:', keyError.message)
    return { status: 'unavailable' }
  }
  if (!keyRow) return { status: 'invalid' }

  const { data: profile, error: profileError } = await db
    .from('users_profile')
    .select('plan, role, status, workspace_id')
    .eq('id', keyRow.user_id)
    .maybeSingle()

  if (profileError) {
    console.error('[api-key] profile lookup failed:', profileError.message)
    return { status: 'unavailable' }
  }
  if (!profile) {
    // api_keys.user_id cascades when the account is deleted, so a key with no
    // profile row is a data anomaly, not a revoked key. Do not call it invalid.
    console.error('[api-key] no profile row for key owner', keyRow.user_id)
    return { status: 'unavailable' }
  }
  if (profile.status === 'deactivated') return { status: 'invalid' }

  const access = await resolveProductAccess(db, keyRow.user_id, profile)
  if (!access) {
    console.error('[api-key] could not resolve product access for', keyRow.user_id)
    return { status: 'unavailable' }
  }

  // Update last_used_at without blocking the request
  db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id).then(() => {})

  return {
    status: 'valid',
    key: {
      userId: keyRow.user_id,
      quotaSubjectUserId: access.quotaSubjectUserId,
      plan: access.plan,
      role: access.role,
      keyId: keyRow.id,
      createdAt: typeof keyRow.created_at === 'string' ? keyRow.created_at : null,
    },
  }
}

export function extractBearerKey(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim() || null
}
