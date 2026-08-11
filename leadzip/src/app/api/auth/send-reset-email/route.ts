import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://leadzip.vercel.app'

// Log misconfiguration once per server instance instead of on every request
let loggedMissingGmailConfig = false
let loggedMissingSupabaseConfig = false

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: NextRequest) {
  let email: string
  try {
    const body = (await request.json()) as { email?: string }
    email = body.email ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    if (!loggedMissingGmailConfig) {
      console.error('send-reset-email: GMAIL_USER/GMAIL_APP_PASSWORD not configured')
      loggedMissingGmailConfig = true
    }
    return NextResponse.json({ error: 'Email not configured' }, { status: 503 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (!loggedMissingSupabaseConfig) {
      console.error('send-reset-email: Supabase URL/service role key not configured')
      loggedMissingSupabaseConfig = true
    }
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 })
  }

  try {
    // Use service role to generate a reset link — bypasses Supabase email entirely
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
      },
    })

    if (error || !data?.properties?.action_link) {
      // Don't reveal whether the email exists — but keep a server-side signal
      // so a broken key/config is distinguishable from an unknown account.
      console.error(
        'send-reset-email: generateLink failed',
        error?.message ?? 'no action_link returned'
      )
      return NextResponse.json({ success: true })
    }

    const resetLink = data.properties.action_link
    const safeEmail = escapeHtml(email)

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    await transporter.sendMail({
      from: `"LeadZip" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Reset your LeadZip password',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#1D4ED8;padding:28px 32px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 12px;">
                  <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">📍 LeadZip</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#17130E;">Reset your password</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#64748B;line-height:1.6;">
              We received a request to reset the password for your LeadZip account associated with <strong style="color:#17130E;">${safeEmail}</strong>.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#64748B;line-height:1.6;">
              Click the button below to set a new password. This link expires in <strong style="color:#17130E;">60 minutes</strong>.
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:#1D4ED8;border-radius:10px;">
                  <a href="${resetLink}" style="display:block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                    Reset Password →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;color:#94A3B8;line-height:1.6;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin:0;font-size:12px;color:#3B82F6;word-break:break-all;">
              <a href="${resetLink}" style="color:#3B82F6;">${resetLink}</a>
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 32px;"><div style="height:1px;background:#F1F5F9;"></div></td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px 28px;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;line-height:1.6;">
              If you didn't request a password reset, you can safely ignore this email. Your password will not change.
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#CBD5E1;">
              © ${new Date().getFullYear()} LeadZip · <a href="${siteUrl}" style="color:#CBD5E1;">leadzip.vercel.app</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Same generic response as the success path — SMTP/Supabase failures must
    // not be distinguishable client-side (account-enumeration side channel).
    console.error('send-reset-email: failed to send reset email', error)
    return NextResponse.json({ success: true })
  }
}
