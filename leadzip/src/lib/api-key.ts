import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface GeneratedKey {
  raw: string
  hash: string
  prefix: string
}

export async function generateApiKey(): Promise<GeneratedKey> {
  const secret = randomHex(24) // 48 hex chars
  const raw = `lz_live_${secret}`
  const hash = await sha256Hex(raw)
  const prefix = raw.slice(0, 16) // "lz_live_xxxxxxxx"
  return { raw, hash, prefix }
}

export interface ValidatedKey {
  userId: string
  plan: 'free' | 'pro' | 'agency'
  role: 'user' | 'admin'
  keyId: string
}

export async function validateApiKey(raw: string): Promise<ValidatedKey | null> {
  if (!raw?.startsWith('lz_live_')) return null

  const hash = await sha256Hex(raw)
  const db = serviceClient()

  const { data: keyRow } = await db
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', hash)
    .maybeSingle()

  if (!keyRow) return null

  const { data: profile } = await db
    .from('users_profile')
    .select('plan, role, status')
    .eq('id', keyRow.user_id)
    .maybeSingle()

  if (!profile || profile.status === 'deactivated') return null

  // Update last_used_at without blocking the request
  db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id).then(() => {})

  return {
    userId: keyRow.user_id,
    plan: profile.plan as 'free' | 'pro' | 'agency',
    role: profile.role as 'user' | 'admin',
    keyId: keyRow.id,
  }
}

export function extractBearerKey(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim() || null
}
