import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getClientIp } from '@/lib/clientIp'
import {
  checkRateLimit,
  territoryRequestLimiter,
} from '@/lib/ratelimit'

const MAX_NAME = 80
const MAX_EMAIL = 254
const MAX_TERRITORY = 120
const MAX_BUSINESS_TYPE = 100
const MAX_OFFER = 120
const MAX_NOTES = 600

interface TerritoryRequestBody {
  name?: unknown
  email?: unknown
  territory?: unknown
  businessType?: unknown
  offer?: unknown
  notes?: unknown
  companyWebsite?: unknown
}

function cleanText(value: unknown, maxLength: number, singleLine = true): string {
  if (typeof value !== 'string') return ''
  const withoutControls = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  const normalized = singleLine
    ? withoutControls.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ')
    : withoutControls.replace(/\r\n?/g, '\n')
  return normalized.trim().slice(0, maxLength)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function json(body: Record<string, unknown>, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  })
}

export async function POST(request: NextRequest) {
  let raw: TerritoryRequestBody
  try {
    const body = await request.text()
    if (body.length > 16_384) {
      return json({ error: 'Request body is too large.' }, 413)
    }
    const parsed: unknown = JSON.parse(body)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'Invalid request body.' }, 400)
    }
    raw = parsed as TerritoryRequestBody
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  // Hidden honeypot: make automated submissions look successful without
  // sending mail or revealing that they were detected.
  if (cleanText(raw.companyWebsite, 200)) {
    return json({ success: true })
  }

  const name = cleanText(raw.name, MAX_NAME)
  const email = cleanText(raw.email, MAX_EMAIL).toLowerCase()
  const territory = cleanText(raw.territory, MAX_TERRITORY)
  const businessType = cleanText(raw.businessType, MAX_BUSINESS_TYPE)
  const offer = cleanText(raw.offer, MAX_OFFER)
  const notes = cleanText(raw.notes, MAX_NOTES, false)

  if (!name || !territory || !businessType || !offer) {
    return json({ error: 'Complete every required field.' }, 400)
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Enter a valid email address.' }, 400)
  }

  try {
    const verdict = await checkRateLimit(territoryRequestLimiter, getClientIp(request))
    if (!verdict.success) {
      return json(
        { error: 'Too many requests. Please try again later.' },
        429,
        { 'Retry-After': String(verdict.retryAfter) }
      )
    }
  } catch (error) {
    console.warn(
      'territory-requests: rate limiter unavailable',
      error instanceof Error ? error.message : 'unknown error'
    )
    return json({ error: 'The request form is temporarily unavailable. Please try again shortly.' }, 503)
  }

  const gmailUser = process.env.GMAIL_USER
  const gmailPassword = process.env.GMAIL_APP_PASSWORD
  const destination = process.env.TERRITORY_REQUEST_EMAIL || gmailUser
  if (!gmailUser || !gmailPassword || !destination) {
    console.error('territory-requests: Gmail credentials or destination not configured')
    return json({ error: 'The request form is temporarily unavailable. Please email support@leadzipp.com.' }, 503)
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPassword },
    })

    await transporter.sendMail({
      from: `"LeadZipp Territory Requests" <${gmailUser}>`,
      to: destination,
      replyTo: email,
      subject: `First territory request: ${territory}`,
      text: [
        'New Build My First Territory request',
        '',
        `Name: ${name}`,
        `Email: ${email}`,
        `Territory: ${territory}`,
        `Business type: ${businessType}`,
        `Service sold: ${offer}`,
        `Notes: ${notes || 'None provided'}`,
      ].join('\n'),
      html: `
        <h1 style="font-family:Arial,sans-serif;font-size:22px;color:#17130E">New first territory request</h1>
        <table cellpadding="8" cellspacing="0" style="font-family:Arial,sans-serif;border-collapse:collapse;color:#423B32">
          <tr><th align="left">Name</th><td>${escapeHtml(name)}</td></tr>
          <tr><th align="left">Email</th><td>${escapeHtml(email)}</td></tr>
          <tr><th align="left">Territory</th><td>${escapeHtml(territory)}</td></tr>
          <tr><th align="left">Business type</th><td>${escapeHtml(businessType)}</td></tr>
          <tr><th align="left">Service sold</th><td>${escapeHtml(offer)}</td></tr>
          <tr><th align="left">Notes</th><td>${escapeHtml(notes || 'None provided')}</td></tr>
        </table>
      `,
    })

    return json({ success: true })
  } catch (error) {
    console.error(
      'territory-requests: email delivery failed',
      error instanceof Error ? error.message : 'unknown error'
    )
    return json({ error: 'We could not send your request. Please email support@leadzipp.com.' }, 503)
  }
}
