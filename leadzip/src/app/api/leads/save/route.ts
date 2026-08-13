import { NextRequest, NextResponse } from 'next/server'
import type { Lead } from '@/types/lead'
import { saveLimiter, checkRateLimit } from '@/lib/ratelimit'

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

interface AuthedUser {
  id: string
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
}

/**
 * Resolves the caller, or returns the response to send instead.
 *
 * Both handlers used to swallow this and answer {success:true} even with no
 * user, so the client could never tell a save had silently done nothing.
 * Now an unauthenticated or deactivated caller gets a real status code. The
 * client still keeps its localStorage copy, so a failure here is not data loss.
 */
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    }
  }

  // Deactivated accounts keep a valid session until it expires, so writes
  // re-check status instead of trusting middleware alone.
  const { data: profile } = await supabase
    .from('users_profile')
    .select('status')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.status === 'deactivated') {
    return {
      response: NextResponse.json(
        { success: false, error: 'Account deactivated' },
        { status: 403 }
      ),
    }
  }

  return { user: { id: user.id, supabase } }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { lead: Lead }
    const lead = body.lead

    if (!lead?.id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

    const auth = await requireUser()
    if ('response' in auth) return auth.response
    const { id: userId, supabase } = auth.user

    const { success, retryAfter } = await checkRateLimit(saveLimiter, userId)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const baseRow = {
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
      status: lead.status ?? 'new',
      notes: lead.notes ?? '',
    }

    // Enrichment fields (B2 email finder, socials, firmographics)
    const enrichedRow = {
      ...baseRow,
      email: lead.email ?? null,
      email_confidence: lead.emailConfidence ?? null,
      employee_count: lead.employeeCount ?? null,
      revenue_estimate: lead.revenueEstimate ?? null,
      facebook_url: lead.facebookUrl ?? null,
      instagram_url: lead.instagramUrl ?? null,
      linkedin_url: lead.linkedinUrl ?? null,
      digital_health_score: lead.digitalHealthScore ?? null,
    }

    const { error } = await supabase.from('leads').upsert(enrichedRow)
    if (error) {
      // Enrichment columns exist in prod, so this should normally succeed.
      // If it fails (e.g. a DB missing those columns — PGRST204 / 42703),
      // retry with core fields, and this time surface a real failure so the
      // client isn't told the save succeeded when it didn't.
      console.error('Lead save enriched upsert error:', error.message)
      const { error: fallbackError } = await supabase.from('leads').upsert(baseRow)
      if (fallbackError) {
        console.error('Lead save fallback upsert error:', fallbackError.message)
        return NextResponse.json(
          { success: false, error: 'Failed to save lead' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true, id: lead.id })
  } catch (error) {
    console.error('Lead save error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save lead' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json() as { leadId: string }
    const leadId = body.leadId

    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

    const auth = await requireUser()
    if ('response' in auth) return auth.response
    const { id: userId, supabase } = auth.user

    // DELETE shares POST's limiter: it is the same per-user write budget on the
    // same table, and it used to have no limit at all.
    const { success, retryAfter } = await checkRateLimit(saveLimiter, userId)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('user_id', userId)

    if (error) {
      console.error('Lead delete error:', error.message)
      return NextResponse.json({ success: false, error: 'Failed to delete lead' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: leadId })
  } catch (error) {
    console.error('Lead delete error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete lead' }, { status: 500 })
  }
}
