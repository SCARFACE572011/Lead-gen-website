import { NextRequest, NextResponse } from 'next/server'
import { buildLeadsCsv } from '@/lib/export'
import { parseExportPreferences } from '@/lib/exportRequest'
import { getLeadEntitlements } from '@/lib/leadEntitlements'
import { mapSavedLeadRow } from '@/lib/savedLeadRows'
import { requireActiveUser } from '@/lib/requireActiveUser'
import { checkRateLimit, exportLimiter } from '@/lib/ratelimit'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveProductAccess } from '@/lib/productAccess'

const MAX_BODY_BYTES = 50_000
const DATABASE_PAGE_SIZE = 500

/**
 * Export the caller's saved list directly from Postgres.
 *
 * This avoids sending thousands of rows through the browser and removes the
 * generic result-export route's 2,000-row request ceiling for Saved > Export
 * All. Supabase still streams a bounded user-owned result set into one CSV;
 * Free is capped at 25 by product entitlement while paid plans receive every
 * saved row. The response is streamed in database pages, so an Agency account
 * does not need to load its full list into browser or function memory first.
 */
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
      console.warn('[leads/export/saved] rate limiter unavailable, allowing export', error)
    }

    let body: {
      fields?: unknown
      filename?: unknown
      bom?: unknown
    }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const entitlement = getLeadEntitlements(access.plan, access.role)
    const preferences = parseExportPreferences(body)

    // Count and order by leads.id, never leads.record_id: record_id is created
    // by 20260813_bulk_save_entitlements.sql, so selecting it before that
    // migration is applied fails with 42703 and takes the whole export down.
    // leads.id (the provider/place ID) exists in both schema states and is
    // unique within one user's list in both (globally before the migration,
    // per user after it), so created_at + id is a total order here either way.
    const { count: savedCount, error: countError } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
    if (countError) {
      console.error('[leads/export/saved] saved lead count failed:', countError.message)
      return NextResponse.json({ error: 'Could not load saved leads for export.' }, { status: 503 })
    }

    const totalSaved = savedCount ?? 0
    const exportCount = entitlement.maxExportRows === null
      ? totalSaved
      : Math.min(totalSaved, entitlement.maxExportRows)
    if (exportCount === 0) {
      return NextResponse.json({ error: 'No saved leads to export.' }, { status: 400 })
    }

    const planCapped = exportCount < totalSaved
    const upgradeNotice = planCapped
      ? `Upgrade to Pro to export more than ${entitlement.maxExportRows} saved leads.`
      : ''

    const encoder = new TextEncoder()
    let offset = 0
    let firstPage = true
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (offset >= exportCount) {
          controller.close()
          return
        }

        const pageEnd = Math.min(offset + DATABASE_PAGE_SIZE, exportCount) - 1
        const { data: rows, error } = await supabase
          .from('leads')
          .select('*')
          .eq('user_id', auth.user.id)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, pageEnd)

        if (error) {
          console.error('[leads/export/saved] saved lead page failed:', error.message)
          controller.error(new Error('Could not load saved leads for export.'))
          return
        }

        const leads = (rows ?? []).map(mapSavedLeadRow)
        if (leads.length === 0) {
          controller.close()
          return
        }

        let csv = buildLeadsCsv(leads, preferences.fields)
        if (!firstPage) {
          const headerEnd = csv.indexOf('\n')
          csv = headerEnd >= 0 ? csv.slice(headerEnd + 1) : ''
        } else if (preferences.bom) {
          csv = `\uFEFF${csv}`
        }

        firstPage = false
        offset += leads.length
        controller.enqueue(encoder.encode(offset < exportCount ? `${csv}\n` : csv))
        if (offset >= exportCount) controller.close()
      },
    })

    const headers: Record<string, string> = {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${preferences.filename}.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Lead-Plan': entitlement.plan,
      'X-Export-Count': String(exportCount),
      'X-Export-Plan-Capped': String(planCapped),
    }
    if (entitlement.maxExportRows !== null) {
      headers['X-Export-Limit'] = String(entitlement.maxExportRows)
    }
    if (upgradeNotice) headers['X-Upgrade-Notice'] = upgradeNotice

    return new NextResponse(stream, { status: 200, headers })
  } catch (error) {
    console.error('[leads/export/saved] export failed:', error)
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 })
  }
}
