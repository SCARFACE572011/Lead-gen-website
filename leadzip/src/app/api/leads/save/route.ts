import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

    // TODO: Save to Supabase leads table
    // const supabase = createClient()
    // const { data, error } = await supabase.from('leads').upsert({
    //   id: body.id,
    //   user_id: session.user.id,
    //   business_name: body.businessName,
    //   ...
    // })

    // For now, return success (client handles localStorage)
    return NextResponse.json({ success: true, id: body.id })
  } catch (error) {
    console.error('Lead save error:', error)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 })
    }

    // TODO: Delete from Supabase
    // const supabase = createClient()
    // await supabase.from('leads').delete().eq('id', id).eq('user_id', session.user.id)

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('Lead delete error:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
