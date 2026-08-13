import { NextRequest, NextResponse } from 'next/server'
import type { Lead } from '@/types/lead'
import { saveLimiter, checkRateLimit } from '@/lib/ratelimit'
import { requireActiveUser } from '@/lib/requireActiveUser'
import {
  getLeadEntitlements,
  MAX_BULK_SAVE_REQUEST,
} from '@/lib/leadEntitlements'
import {
  normalizeLeadPayloadList,
  type LeadPayloadIssue,
} from '@/lib/leadPayload'

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

const MAX_BODY_BYTES = 2_000_000
const DB_BATCH_SIZE = 100
const MAX_RESPONSE_ISSUES = 50

interface DatabaseError {
  code?: string
  message?: string
}

interface AuthedUser {
  id: string
  plan: unknown
  role: unknown
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
}

async function requireUser(): Promise<{ user: AuthedUser } | { response: NextResponse }> {
  if (!isSupabaseConfigured) {
    console.error('leads/save: Supabase is not configured, cannot persist')
    return {
      response: NextResponse.json(
        { success: false, error: 'Saving is unavailable right now.' },
        { status: 503 }
      ),
    }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  // The plan fence shares the status lookup instead of trusting the browser's
  // copy of users_profile.
  const auth = await requireActiveUser(supabase, {
    columns: ['plan', 'role'],
    extraBody: { success: false },
  })
  if (!auth.ok) return { response: auth.response }

  return {
    user: {
      id: auth.user.id,
      plan: auth.profile?.plan,
      role: auth.profile?.role,
      supabase,
    },
  }
}

async function overSaveLimit(userId: string): Promise<NextResponse | null> {
  try {
    const { success, retryAfter } = await checkRateLimit(saveLimiter, userId)
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }
  } catch (error) {
    // Saving costs no upstream API tokens. The limiter itself has a local
    // outage backstop, and this final fail-open prevents loss of customer work.
    console.warn('[leads/save] rate limiter unavailable, allowing this write', error)
  }
  return null
}

function coreRow(lead: Lead, userId: string) {
  return {
    id: lead.id,
    user_id: userId,
    business_name: lead.businessName,
    category: lead.category,
    address: lead.address,
    city: lead.city,
    state: lead.state,
    zip_code: lead.zipCode,
    phone: lead.phone,
    website: lead.website,
    rating: lead.rating,
    review_count: lead.reviewCount,
    latitude: lead.latitude,
    longitude: lead.longitude,
    distance_miles: lead.distanceMiles,
    lead_score: lead.leadScore,
    status: lead.status,
    notes: lead.notes,
  }
}

function enrichedRow(lead: Lead, userId: string) {
  return {
    ...coreRow(lead, userId),
    email: lead.email ?? null,
    email_confidence: lead.emailConfidence ?? null,
    employee_count: lead.employeeCount ?? null,
    revenue_estimate: lead.revenueEstimate ?? null,
    facebook_url: lead.facebookUrl ?? null,
    instagram_url: lead.instagramUrl ?? null,
    linkedin_url: lead.linkedinUrl ?? null,
    digital_health_score: lead.digitalHealthScore ?? null,
  }
}

function isMissingColumn(error: DatabaseError): boolean {
  return error.code === '42703' || error.code === 'PGRST204'
}

function needsCompositeKeyMigration(error: DatabaseError): boolean {
  return (
    error.code === '23505' ||
    error.code === '42501' ||
    (error.message ?? '').toLowerCase().includes('row-level security')
  )
}

function isDatabaseSavedLimit(error: DatabaseError): boolean {
  return error.code === '23514' && (error.message ?? '').includes('Saved lead limit reached')
}

/**
 * Insert only genuinely new leads. Existing IDs are detected before this call
 * and counted as already saved, so an ON CONFLICT upsert cannot accidentally
 * consume a second quota slot under concurrent requests.
 */
async function insertRows(
  supabase: AuthedUser['supabase'],
  leads: Lead[],
  userId: string
): Promise<{
  error: DatabaseError | null
  migrationRequired: boolean
  limitReached: boolean
}> {
  const enriched = leads.map((lead) => enrichedRow(lead, userId))
  let { error } = await supabase.from('leads').insert(enriched)

  if (!error) return { error: null, migrationRequired: false, limitReached: false }

  if (isMissingColumn(error)) {
    const fallback = await supabase
      .from('leads')
      .insert(leads.map((lead) => coreRow(lead, userId)))
    error = fallback.error
    if (!error) return { error: null, migrationRequired: false, limitReached: false }
  }

  return {
    error,
    migrationRequired: needsCompositeKeyMigration(error),
    limitReached: isDatabaseSavedLimit(error),
  }
}

function pushIssues(target: LeadPayloadIssue[], additions: LeadPayloadIssue[]) {
  const available = Math.max(0, MAX_RESPONSE_ISSUES - target.length)
  target.push(...additions.slice(0, available))
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Save request is too large.' },
        { status: 413 }
      )
    }

    let body: { lead?: unknown; leads?: unknown[] }
    try {
      body = (await request.json()) as { lead?: unknown; leads?: unknown[] }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body.' },
        { status: 400 }
      )
    }

    const rawLeads = Array.isArray(body.leads)
      ? body.leads
      : body.lead !== undefined
        ? [body.lead]
        : []
    if (rawLeads.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one lead is required.' },
        { status: 400 }
      )
    }

    const auth = await requireUser()
    if ('response' in auth) return auth.response
    const { id: userId, plan, role, supabase } = auth.user
    const entitlement = getLeadEntitlements(plan, role)

    // Free remains intentionally simple: individual saves only. This is
    // checked server-side so changing a disabled button cannot unlock Save All.
    if (rawLeads.length > 1 && !entitlement.canBulkSave) {
      return NextResponse.json(
        {
          success: false,
          error: 'Save All is available on Pro and Agency.',
          upgradeRequired: true,
          plan: entitlement.plan,
        },
        { status: 403 }
      )
    }

    const limited = await overSaveLimit(userId)
    if (limited) return limited

    const normalized = normalizeLeadPayloadList(rawLeads, MAX_BULK_SAVE_REQUEST)
    if (normalized.leads.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid leads were provided.',
          issues: normalized.issues,
          invalidCount: normalized.invalidCount,
        },
        { status: 400 }
      )
    }

    // Read failures fail closed: treating a failed count as zero would unlock
    // more saved rows than the customer purchased.
    const { count: savedCount, error: countError } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (countError) {
      console.error('[leads/save] saved lead count failed:', countError.message)
      return NextResponse.json(
        { success: false, error: 'Could not verify your saved-lead limit. Please retry.' },
        { status: 503 }
      )
    }

    const candidateIds = normalized.leads.map((lead) => lead.id)
    const { data: existingRows, error: existingError } = await supabase
      .from('leads')
      .select('id')
      .eq('user_id', userId)
      .in('id', candidateIds)
    if (existingError) {
      console.error('[leads/save] existing lead lookup failed:', existingError.message)
      return NextResponse.json(
        { success: false, error: 'Could not verify existing leads. Please retry.' },
        { status: 503 }
      )
    }

    const existingIds = new Set((existingRows ?? []).map((row) => String(row.id)))
    let availableNew = entitlement.maxSavedLeads === null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, entitlement.maxSavedLeads - (savedCount ?? 0))
    const acceptedNew: Lead[] = []
    const alreadySavedLeads: Lead[] = []
    const capacityRejected: LeadPayloadIssue[] = []

    normalized.leads.forEach((lead, index) => {
      if (existingIds.has(lead.id)) {
        alreadySavedLeads.push(lead)
      } else if (availableNew > 0) {
        acceptedNew.push(lead)
        availableNew -= 1
      } else {
        capacityRejected.push({
          index,
          id: lead.id,
          reason: 'saved_limit',
          message: `${entitlement.plan === 'free' ? 'Free' : 'Pro'} saved-lead limit reached.`,
        })
      }
    })

    const savedIds: string[] = alreadySavedLeads.map((lead) => lead.id)
    const failedIds: string[] = []
    const databaseLimitIds: string[] = []
    const issues = [...normalized.issues]
    pushIssues(issues, capacityRejected)
    let migrationRequired = false

    for (let offset = 0; offset < acceptedNew.length; offset += DB_BATCH_SIZE) {
      const batch = acceptedNew.slice(offset, offset + DB_BATCH_SIZE)
      const result = await insertRows(supabase, batch, userId)
      if (!result.error) {
        savedIds.push(...batch.map((lead) => lead.id))
        continue
      }

      console.error('[leads/save] batch upsert failed:', result.error.message)
      migrationRequired ||= result.migrationRequired
      if (result.limitReached) {
        databaseLimitIds.push(...batch.map((lead) => lead.id))
        pushIssues(
          issues,
          batch.map((lead, index) => ({
            index: offset + index,
            id: lead.id,
            reason: 'saved_limit' as const,
            message: `${entitlement.plan === 'free' ? 'Free' : 'Pro'} saved-lead limit reached.`,
          }))
        )
        continue
      }
      failedIds.push(...batch.map((lead) => lead.id))
      pushIssues(
        issues,
        batch.map((lead, index) => ({
          index: offset + index,
          id: lead.id,
          reason: 'database' as const,
          message: result.migrationRequired
            ? 'Lead storage needs its multi-user key migration.'
            : 'Database save failed for this lead.',
        }))
      )
    }

    const successful = new Set(savedIds)
    const alreadySavedIds = savedIds.filter((id) => existingIds.has(id))
    const insertedIds = savedIds.filter((id) => !existingIds.has(id))
    const capacityRejectedCount = capacityRejected.length + databaseLimitIds.length
    const rejectedCount =
      normalized.invalidCount +
      normalized.requestLimitedCount +
      capacityRejectedCount +
      failedIds.length
    const newSavedCount = (savedCount ?? 0) + insertedIds.length
    const remaining = entitlement.maxSavedLeads === null
      ? null
      : Math.max(0, entitlement.maxSavedLeads - newSavedCount)
    const partial = rejectedCount > 0 || normalized.duplicateCount > 0
    const limitReached = capacityRejectedCount > 0

    const responseBody = {
      success: successful.size > 0,
      partial,
      plan: entitlement.plan,
      receivedCount: normalized.receivedCount,
      savedCount: savedIds.length,
      insertedCount: insertedIds.length,
      alreadySavedCount: alreadySavedIds.length,
      duplicateCount: normalized.duplicateCount,
      rejectedCount,
      requestLimitedCount: normalized.requestLimitedCount,
      capacityRejectedCount,
      failedCount: failedIds.length,
      savedIds,
      insertedIds,
      alreadySavedIds,
      failedIds,
      issues,
      issuesTruncated:
        normalized.issuesTruncated ||
        normalized.issues.length + capacityRejected.length + databaseLimitIds.length + failedIds.length > issues.length,
      savedLeadLimit: entitlement.maxSavedLeads,
      savedLeadCount: newSavedCount,
      remaining,
      limitReached,
      upgradeRequired: limitReached && entitlement.plan !== 'agency',
      migrationRequired,
      // Preserve the original single-save response contract.
      id: rawLeads.length === 1 && savedIds.length === 1 ? savedIds[0] : undefined,
    }

    if (savedIds.length === 0) {
      return NextResponse.json(
        {
          ...responseBody,
          error: migrationRequired
            ? 'Lead storage needs a one-time database migration.'
            : limitReached
              ? `Your ${entitlement.plan} saved-lead limit has been reached.`
              : 'No leads could be saved.',
        },
        { status: migrationRequired || limitReached ? 409 : 500 }
      )
    }

    return NextResponse.json(responseBody, { status: partial ? 207 : 200 })
  } catch (error) {
    console.error('Lead save error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save lead.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let body: { leadId?: unknown }
    try {
      body = (await request.json()) as { leadId?: unknown }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
    }
    const leadId = typeof body.leadId === 'string' ? body.leadId.trim().slice(0, 512) : ''

    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Lead ID is required.' }, { status: 400 })
    }

    const auth = await requireUser()
    if ('response' in auth) return auth.response
    const { id: userId, supabase } = auth.user

    const limited = await overSaveLimit(userId)
    if (limited) return limited

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('user_id', userId)

    if (error) {
      console.error('Lead delete error:', error.message)
      return NextResponse.json(
        { success: false, error: 'Failed to delete lead.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, id: leadId })
  } catch (error) {
    console.error('Lead delete error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete lead.' },
      { status: 500 }
    )
  }
}
