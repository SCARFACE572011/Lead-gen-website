import { NextRequest, NextResponse } from 'next/server'
import { searchLeads } from '@/lib/providers/leadDataProvider'
import type { SearchParams } from '@/types/lead'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SearchParams

    // Validate required fields
    if (!body.zipCode) {
      return NextResponse.json({ error: 'ZIP code is required' }, { status: 400 })
    }

    if (body.zipCode.length < 5) {
      return NextResponse.json({ error: 'Invalid ZIP code' }, { status: 400 })
    }

    const results = await searchLeads(body)

    // Log search to Supabase if configured — non-fatal, search always succeeds
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co') {
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          await supabase.from('search_history').insert({
            user_id: user.id,
            zip_code: body.zipCode,
            radius: body.radiusMiles,
            category: body.category || '',
            keyword: body.keyword || '',
            result_count: results.total,
          })

          // Increment searches_this_month — try RPC first, fall back to read-then-write
          const { error: rpcError } = await supabase.rpc('increment_searches', { uid: user.id })
          if (rpcError) {
            const { data } = await supabase
              .from('usage_limits')
              .select('searches_this_month')
              .eq('user_id', user.id)
              .single()
            if (data) {
              await supabase
                .from('usage_limits')
                .update({
                  searches_this_month: (data.searches_this_month ?? 0) + 1,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id)
            }
          }
        }
      }
    } catch {
      // Non-fatal — search result is still returned
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Lead search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
