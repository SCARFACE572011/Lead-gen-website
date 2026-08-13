import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { requirePlatformAdmin } from '@/lib/admin-auth'

/**
 * Lightweight entitlement check for navigation. The UI must use this endpoint
 * instead of treating an Agency plan or a client-readable profile role as
 * sufficient proof of access. Sensitive admin routes repeat the same check.
 */
export async function GET() {
  const supabase = await createServerClient()
  const admin = await requirePlatformAdmin(supabase)
  if (!admin.ok) return admin.response

  return NextResponse.json({ isPlatformAdmin: true })
}
