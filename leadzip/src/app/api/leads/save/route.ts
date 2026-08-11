import { NextRequest, NextResponse } from 'next/server'
import type { Lead } from '@/types/lead'
import { saveLimiter, checkRateLimit } from '@/lib/ratelimit'

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { lead: Lead }
    const lead = body.lead

    if (!lead?.id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

    // Dual-write: save to Supabase if configured and user is authenticated
    if (isSupabaseConfigured) {
      try {
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const { success, retryAfter } = await checkRateLimit(saveLimiter, user.id)
          if (!success) {
            return NextResponse.json(
              { error: 'Too many requests', retryAfter },
              { status: 429, headers: { 'Retry-After': String(retryAfter) } }
            )
          }

          const baseRow = {
            id: lead.id,
            user_id: user.id,
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
            // DBs without the enrichment columns reject the whole row
            // (PGRST204 / 42703) — retry with core fields so the save is
            // never lost.
            console.error('Lead save enriched upsert error:', error.message)
            await supabase.from('leads').upsert(baseRow)
          }
        }
      } catch {
        // Non-fatal — fall back to localStorage-only on client
      }
    }

    // Always return success; client handles localStorage as well
    return NextResponse.json({ success: true, id: lead.id })
  } catch (error) {
    console.error('Lead save error:', error)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json() as { leadId: string }
    const leadId = body.leadId

    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

    // Remove from Supabase if configured and user is authenticated
    if (isSupabaseConfigured) {
      try {
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          await supabase
            .from('leads')
            .delete()
            .eq('id', leadId)
            .eq('user_id', user.id)
        }
      } catch {
        // Non-fatal — fall back to localStorage-only on client
      }
    }

    return NextResponse.json({ success: true, id: leadId })
  } catch (error) {
    console.error('Lead delete error:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
