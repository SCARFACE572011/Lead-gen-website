import { NextRequest, NextResponse } from 'next/server'
import { buildLeadsCsv } from '@/lib/export'
import { parseExportPreferences } from '@/lib/exportRequest'
import { requireActiveUser } from '@/lib/requireActiveUser'
import {
  getLeadEntitlements,
  MAX_EXPORT_REQUEST,
} from '@/lib/leadEntitlements'
import { normalizeLeadPayloadList } from '@/lib/leadPayload'
import { exportLimiter, checkRateLimit } from '@/lib/ratelimit'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveProductAccess } from '@/lib/productAccess'

const MAX_BODY_BYTES = 3_000_000

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Export request is too large.' }, { status: 413 })
    }

    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const auth = await requireActiveUser(supabase, {
      columns: ['plan', 'role', 'workspace_id'],
    })
    if (!auth.ok) return auth.response

    const access = await resolveProductAccess(
      createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      ),
      auth.user.id,
      auth.profile
    )
    if (!access) {
      return NextResponse.json(
        { error: 'Could not verify your export allowance. Please retry.' },
        { status: 503 }
      )
    }

    try {
      const { success, retryAfter } = await checkRateLimit(exportLimiter, auth.user.id)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many exports. Please wait a moment and try again.', retryAfter },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }
    } catch (error) {
      // Exporting returned rows has no external cost. The limiter normally
      // degrades locally; preserve the download on an unexpected limiter fault.
      console.warn('[leads/export] rate limiter unavailable, allowing export', error)
    }

    let body: {
      leads?: unknown[]
      fields?: unknown[]
      filename?: unknown
      bom?: unknown
    }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    if (!Array.isArray(body.leads) || body.leads.length === 0) {
      return NextResponse.json({ error: 'No leads to export.' }, { status: 400 })
    }

    const normalized = normalizeLeadPayloadList(body.leads, MAX_EXPORT_REQUEST)
    if (normalized.leads.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid leads to export.',
          invalidCount: normalized.invalidCount,
          issues: normalized.issues,
        },
        { status: 400 }
      )
    }

    const entitlement = getLeadEntitlements(access.plan, access.role)
    const planLimit = entitlement.maxExportRows
    const planCapped = planLimit !== null && normalized.leads.length > planLimit
    const exportLeads = planCapped
      ? normalized.leads.slice(0, planLimit)
      : normalized.leads

    const preferences = parseExportPreferences(body)
    const csv = buildLeadsCsv(exportLeads, preferences.fields)
    const output = preferences.bom ? `\uFEFF${csv}` : csv
    const requestCapped = normalized.requestLimitedCount > 0
    const partial =
      planCapped ||
      requestCapped ||
      normalized.invalidCount > 0 ||
      normalized.duplicateCount > 0
    const upgradeNotice = planCapped
      ? `Upgrade to Pro to export all ${normalized.leads.length} leads.`
      : ''

    const headers: Record<string, string> = {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${preferences.filename}.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Lead-Plan': entitlement.plan,
      'X-Export-Received': String(normalized.receivedCount),
      'X-Export-Normalized': String(normalized.leads.length),
      'X-Export-Count': String(exportLeads.length),
      'X-Export-Partial': String(partial),
      'X-Export-Plan-Capped': String(planCapped),
      'X-Export-Request-Capped': String(requestCapped),
      'X-Export-Duplicates': String(normalized.duplicateCount),
      'X-Export-Invalid': String(normalized.invalidCount),
      'X-Export-Request-Limited': String(normalized.requestLimitedCount),
    }
    if (planLimit !== null) headers['X-Export-Limit'] = String(planLimit)
    if (upgradeNotice) headers['X-Upgrade-Notice'] = upgradeNotice

    return new NextResponse(output, { status: 200, headers })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 })
  }
}
