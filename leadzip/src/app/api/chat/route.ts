import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { chatLimiter, chatDailyLimiter, checkRateLimit } from '@/lib/ratelimit'
import { SYSTEM_PROMPT, answerFromFaq } from './knowledge'

// Cheap, fast model for a support chat: short replies, low latency.
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_MESSAGE_CHARS = 1000
const MAX_HISTORY_MESSAGES = 12
const MAX_REPLY_TOKENS = 300

interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

// Best-effort client IP for keying the rate limiters (same pattern as the
// anonymous search route): first x-forwarded-for value, then x-real-ip, then a
// shared 'anon' bucket so a missing IP fails safe rather than open.
function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'anon'
}

// Whitelist roles and cap both count and per-message length so a hostile
// client cannot stuff the prompt. Leading assistant turns are dropped because
// the API requires the first message to be from the user.
function sanitizeHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return []
  const turns: ChatTurn[] = []
  for (const item of raw.slice(-MAX_HISTORY_MESSAGES)) {
    if (!item || typeof item !== 'object') continue
    const { role, content } = item as { role?: unknown; content?: unknown }
    if (role !== 'user' && role !== 'assistant') continue
    if (typeof content !== 'string' || !content.trim()) continue
    turns.push({ role, content: content.trim().slice(0, MAX_MESSAGE_CHARS) })
  }
  while (turns.length > 0 && turns[0].role === 'assistant') turns.shift()
  return turns
}

async function askClaude(apiKey: string, history: ChatTurn[], message: string): Promise<string | null> {
  const client = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 })
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_REPLY_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [...history, { role: 'user', content: message }],
  })
  if (response.stop_reason === 'refusal') return null
  const reply = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()
  return reply || null
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  const burst = await checkRateLimit(chatLimiter, ip)
  if (!burst.success) {
    return NextResponse.json(
      { error: 'Too many messages. Please wait a moment.', retryAfter: burst.retryAfter },
      { status: 429, headers: { 'Retry-After': String(burst.retryAfter) } }
    )
  }
  const daily = await checkRateLimit(chatDailyLimiter, ip)
  if (!daily.success) {
    return NextResponse.json(
      { error: 'Daily chat limit reached. Please email support instead.', retryAfter: daily.retryAfter },
      { status: 429, headers: { 'Retry-After': String(daily.retryAfter) } }
    )
  }

  let body: { message?: unknown; history?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.message !== 'string' || !body.message.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }
  const message = body.message.trim().slice(0, MAX_MESSAGE_CHARS)
  const history = sanitizeHistory(body.history)

  // AI mode when a key is configured; keyword FAQ engine otherwise. Any API
  // failure (bad key, outage, refusal, empty reply) degrades to the FAQ engine
  // instead of erroring, so the widget always answers.
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey) {
    try {
      const reply = await askClaude(apiKey, history, message)
      if (reply) {
        return NextResponse.json({ reply, source: 'ai' })
      }
    } catch (err) {
      // Never surface provider error details (they can include request config).
      console.error('[chat] Claude API call failed:', err instanceof Error ? err.message : 'unknown error')
    }
  }

  return NextResponse.json({ reply: answerFromFaq(message), source: 'faq' })
}
