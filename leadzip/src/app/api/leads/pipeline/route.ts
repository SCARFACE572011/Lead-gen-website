import { NextRequest, NextResponse } from 'next/server'
import { PIPELINE_STAGES, type PipelineStage } from '@/types/lead'
import { pipelineLimiter, checkRateLimit } from '@/lib/ratelimit'
import { requireActiveUser } from '@/lib/requireActiveUser'

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

// Detect "column does not exist" from PostgREST/Postgres so the client can show
// the one-time-migration banner instead of a generic failure.
// 42703 = Postgres undefined_column; PGRST204 = column missing from schema cache.
function isMissingPipelineColumn(error: { code?: string; message?: string }): boolean {
  if (error.code === '42703' || error.code === 'PGRST204') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('pipeline_stage') || msg.includes('stage_updated_at')
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { leadId?: string; stage?: string }
    const leadId = body.leadId
    const stage = body.stage as PipelineStage | undefined

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }
    if (!stage || !PIPELINE_STAGES.includes(stage)) {
      return NextResponse.json(
        { error: `stage must be one of: ${PIPELINE_STAGES.join(', ')}` },
        { status: 400 }
      )
    }

    if (!isSupabaseConfigured) {
      // Local/dev mode: the client persists stages in localStorage.
      return NextResponse.json({ success: true, id: leadId, stage })
    }

    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const auth = await requireActiveUser(supabase)
    if (!auth.ok) return auth.response
    const { user } = auth

    try {
      const { success, retryAfter } = await checkRateLimit(pipelineLimiter, user.id)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests', retryAfter },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }
    } catch {
      // Limiter outage: stage moves are cheap own-row updates, fail open.
    }

    // RLS also protects this, but the explicit user_id filter is defense in depth
    // and makes "not found" vs "not yours" indistinguishable to the caller.
    const { data, error } = await supabase
      .from('leads')
      .update({ pipeline_stage: stage, stage_updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .eq('user_id', user.id)
      .select('id')

    if (error) {
      if (isMissingPipelineColumn(error)) {
        return NextResponse.json(
          {
            error: 'Pipeline needs a one-time database migration',
            migrationRequired: true,
          },
          { status: 409 }
        )
      }
      console.error('Pipeline stage update error:', error.message)
      return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, id: leadId, stage })
  } catch (error) {
    console.error('Pipeline update error:', error)
    return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 })
  }
}
