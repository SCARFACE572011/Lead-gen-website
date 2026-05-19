import { NextRequest, NextResponse } from 'next/server'
import type { Lead } from '@/types/lead'

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
          await supabase.from('leads').upsert({
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
          })
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
