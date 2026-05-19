import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ crm: string }> }
) {
  const { crm } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await serviceClient()
    .from('crm_integrations')
    .delete()
    .eq('user_id', user.id)
    .eq('crm_type', crm)

  if (error) return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
