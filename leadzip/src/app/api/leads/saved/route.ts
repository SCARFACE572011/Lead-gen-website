import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/requireActiveUser'

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ leads: [] })
  }

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const auth = await requireActiveUser(supabase)
    if (!auth.ok) {
      // Signed-out callers keep the existing "empty list" answer (the saved page
      // renders it as a normal empty state). A deactivated account gets the 403.
      return auth.reason === 'unauthenticated'
        ? NextResponse.json({ leads: [] })
        : auth.response
    }
    const { user } = auth

    const { data: rows, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Saved leads fetch error:', error)
      return NextResponse.json({ leads: [] })
    }

    // Map snake_case DB columns back to camelCase Lead shape
    const leads = (rows ?? []).map((row) => ({
      id: row.id,
      businessName: row.business_name,
      category: row.category ?? '',
      address: row.address ?? '',
      city: row.city ?? '',
      state: row.state ?? '',
      zipCode: row.zip_code ?? '',
      phone: row.phone ?? '',
      website: row.website ?? '',
      rating: row.rating ?? null,
      reviewCount: row.review_count ?? null,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      distanceMiles: row.distance_miles ?? null,
      leadScore: row.lead_score ?? 0,
      status: row.status ?? 'new',
      notes: row.notes ?? '',
      savedAt: row.created_at,
      createdAt: row.created_at,
      userId: row.user_id,
      employeeCount: row.employee_count ?? null,
      revenueEstimate: row.revenue_estimate ?? null,
      facebookUrl: row.facebook_url ?? null,
      instagramUrl: row.instagram_url ?? null,
      linkedinUrl: row.linkedin_url ?? null,
    }))

    return NextResponse.json({ leads })
  } catch (error) {
    console.error('Saved leads error:', error)
    return NextResponse.json({ leads: [] })
  }
}
