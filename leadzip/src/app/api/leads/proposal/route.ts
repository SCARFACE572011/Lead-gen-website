import { NextRequest, NextResponse } from 'next/server'
import {
  generateProposalTemplates,
  detectAngle,
  type ProposalLeadInput,
  type ProposalOutput,
} from '@/lib/proposalTemplates'
import { proposalLimiter, checkRateLimit } from '@/lib/ratelimit'

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'

// Small fast model: proposal copy is short-form generation, latency matters in a modal.
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['coldEmailSubject', 'coldEmail', 'proposal', 'whatsapp', 'linkedin', 'callScript'],
  properties: {
    coldEmailSubject: { type: 'string' },
    coldEmail: { type: 'string' },
    proposal: { type: 'string' },
    whatsapp: { type: 'string' },
    linkedin: { type: 'string' },
    callScript: { type: 'string' },
  },
} as const

const SYSTEM_PROMPT = `You write outreach copy for freelancers and small agencies selling digital services (websites, reputation management, local SEO) to local businesses.

You will receive one lead as JSON: business name, category, location, website (may be missing), Google rating, and review count, plus a precomputed "angle" naming the lead's biggest digital gap.

Write five pieces of outreach, all personalized to this specific business and its gap:
1. coldEmailSubject: a curiosity-driven subject line under 60 characters, plus coldEmail: a cold email under 160 words. Conversational, specific, one clear ask for a short call. Sign off with the placeholders [Your name], [Your company], [Your phone].
2. proposal: a detailed mini proposal with plain-text section headers (THE SITUATION, WHAT WE FOUND, RECOMMENDED PLAN, TIMELINE, INVESTMENT, NEXT STEP). Use [Your pricing] and [Your phone] placeholders. Under 350 words.
3. whatsapp: a casual WhatsApp message under 55 words that opens with who you are and ends with a low-pressure question.
4. linkedin: a connection note under 75 words, peer to peer in tone, referencing the specific gap.
5. callScript: a phone script with labeled sections (OPENER, REASON, VALUE, ASK, OBJECTIONS, CLOSE), including responses to the two most likely objections for this type of business.

Rules:
- Lead with the gap: if they have no website, that is the story; if the rating is low, reputation is the story; if reviews are thin, credibility is the story.
- Cite their actual numbers (rating, review count) where they help.
- Plain text only. No markdown formatting symbols.
- Never use em dashes in any output. Use commas, periods, or colons instead.
- Do not invent facts about the business beyond the data given.
- Confident and helpful, never pushy or fear-mongering.`

function sanitize(text: string): string {
  // Product rule: no em dashes in outreach copy.
  return text.replace(/—/g, '-')
}

async function generateWithClaude(lead: ProposalLeadInput): Promise<ProposalOutput | null> {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic()

    const facts = {
      businessName: lead.businessName,
      category: lead.category,
      city: lead.city ?? null,
      state: lead.state ?? null,
      website: lead.website || null,
      rating: lead.rating ?? null,
      reviewCount: lead.reviewCount ?? null,
      angle: detectAngle(lead),
    }

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3500,
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
      },
      messages: [{ role: 'user', content: JSON.stringify(facts) }],
    })

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      return null
    }
    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    const parsed = JSON.parse(textBlock.text) as ProposalOutput
    const keys = [
      'coldEmailSubject',
      'coldEmail',
      'proposal',
      'whatsapp',
      'linkedin',
      'callScript',
    ] as const
    for (const k of keys) {
      if (typeof parsed[k] !== 'string' || parsed[k].length === 0) return null
    }
    return {
      coldEmailSubject: sanitize(parsed.coldEmailSubject),
      coldEmail: sanitize(parsed.coldEmail),
      proposal: sanitize(parsed.proposal),
      whatsapp: sanitize(parsed.whatsapp),
      linkedin: sanitize(parsed.linkedin),
      callScript: sanitize(parsed.callScript),
    }
  } catch (err) {
    console.warn('[proposal] Claude generation failed, falling back to templates:', err)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth guards the paid AI path (and casual scraping). It is deliberately
    // NOT nested inside `if (isSupabaseConfigured)`: when this block was
    // conditional, an unset or placeholder NEXT_PUBLIC_SUPABASE_URL turned the
    // route into a fully unauthenticated endpoint in front of the paid
    // Anthropic API. A misconfigured Supabase must deny, never open up.
    if (!isSupabaseConfigured) {
      console.error('proposal: Supabase is not configured, refusing to serve')
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }

    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Deactivated accounts keep a valid session until it expires, so the paid
    // path re-checks status instead of trusting middleware alone.
    const { data: profile } = await supabase
      .from('users_profile')
      .select('status')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.status === 'deactivated') {
      return NextResponse.json({ error: 'Account deactivated' }, { status: 403 })
    }

    const body = (await request.json()) as { lead?: Partial<ProposalLeadInput> }
    const raw = body.lead

    if (!raw?.businessName) {
      return NextResponse.json({ error: 'lead.businessName is required' }, { status: 400 })
    }

    const lead: ProposalLeadInput = {
      businessName: String(raw.businessName).slice(0, 200),
      category: String(raw.category ?? 'local business').slice(0, 100),
      city: raw.city ? String(raw.city).slice(0, 100) : undefined,
      state: raw.state ? String(raw.state).slice(0, 50) : undefined,
      website: raw.website ? String(raw.website).slice(0, 300) : undefined,
      phone: raw.phone ? String(raw.phone).slice(0, 40) : undefined,
      email: raw.email ? String(raw.email).slice(0, 200) : undefined,
      rating: typeof raw.rating === 'number' ? raw.rating : null,
      reviewCount: typeof raw.reviewCount === 'number' ? raw.reviewCount : null,
    }

    // Rate limit runs after the lead is built so the limiter-outage fallback
    // can still answer with a free template.
    try {
      const { success, retryAfter } = await checkRateLimit(proposalLimiter, user.id)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests', retryAfter },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }
    } catch {
      // Limiter outage: fail CLOSED only for the paid AI path; templates are free.
      if (process.env.ANTHROPIC_API_KEY) {
        const output = generateProposalTemplates(lead)
        return NextResponse.json({ output, source: 'template', angle: detectAngle(lead) })
      }
    }

    if (process.env.ANTHROPIC_API_KEY) {
      const aiOutput = await generateWithClaude(lead)
      if (aiOutput) {
        return NextResponse.json({ output: aiOutput, source: 'ai', angle: detectAngle(lead) })
      }
    }

    const output = generateProposalTemplates(lead)
    return NextResponse.json({ output, source: 'template', angle: detectAngle(lead) })
  } catch (error) {
    console.error('Proposal generation error:', error)
    return NextResponse.json({ error: 'Failed to generate outreach' }, { status: 500 })
  }
}
