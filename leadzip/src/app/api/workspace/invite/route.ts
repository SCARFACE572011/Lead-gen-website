import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://leadzipp.com'

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function mailer() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const email = (body.email as string)?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 422 })
  }

  const db = serviceClient()

  // Verify requester owns a workspace
  const { data: workspace } = await db
    .from('workspaces')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()

  if (!workspace) return NextResponse.json({ error: 'Create a workspace first' }, { status: 403 })

  // Upsert invitation (re-send if already pending)
  const { data: invitation, error } = await db
    .from('workspace_invitations')
    .upsert(
      { workspace_id: workspace.id, email, invited_by: user.id, expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(), accepted_at: null },
      { onConflict: 'workspace_id,email', ignoreDuplicates: false }
    )
    .select('token')
    .single()

  if (error || !invitation) return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })

  const inviteUrl = `${siteUrl}/invite/${invitation.token}`

  // Send invite email (best-effort)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const { data: inviterProfile } = await db
        .from('users_profile')
        .select('full_name, email')
        .eq('id', user.id)
        .single()

      const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'Someone'

      await mailer().sendMail({
        from: `"LeadZipp" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `${inviterName} invited you to join ${workspace.name} on LeadZipp`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;">
        <tr>
          <td style="background:#FF4D23;padding:28px 32px;text-align:center;">
            <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">📍 LeadZipp</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#17130E;">You're invited to join a team</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#64748B;line-height:1.6;">
              <strong style="color:#17130E;">${inviterName}</strong> has invited you to join
              <strong style="color:#17130E;">${workspace.name}</strong> on LeadZipp — the local SMB lead generation platform.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:#FF4D23;border-radius:10px;">
                  <a href="${inviteUrl}" style="display:block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Accept Invitation →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#94A3B8;">This invitation expires in 7 days.</p>
            <p style="margin:0;font-size:12px;color:#3B82F6;word-break:break-all;">
              <a href="${inviteUrl}" style="color:#3B82F6;">${inviteUrl}</a>
            </p>
          </td>
        </tr>
        <tr><td style="padding:0 32px;"><div style="height:1px;background:#F1F5F9;"></div></td></tr>
        <tr>
          <td style="padding:20px 32px 28px;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;">If you didn't expect this invitation, you can safely ignore it.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      })
    } catch {
      // Non-fatal — invitation row exists, user can copy the link manually
    }
  }

  return NextResponse.json({ ok: true, inviteUrl }, { status: 201 })
}

// DELETE — cancel a pending invitation
export async function DELETE(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const inviteId = body.id as string
  if (!inviteId) return NextResponse.json({ error: 'id required' }, { status: 422 })

  const db = serviceClient()
  const { data: workspace } = await db.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.from('workspace_invitations').delete().eq('id', inviteId).eq('workspace_id', workspace.id)
  return new NextResponse(null, { status: 204 })
}
