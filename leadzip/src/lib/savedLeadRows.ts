import type { Lead, LeadStatus, PipelineStage } from '@/types/lead'

type SavedLeadRow = Record<string, unknown>

const LEAD_STATUSES = new Set<LeadStatus>([
  'new',
  'contacted',
  'interested',
  'not_interested',
  'follow_up',
  'converted',
])

const PIPELINE_STAGES = new Set<PipelineStage>([
  'new',
  'contacted',
  'replied',
  'meeting',
  'proposal',
  'won',
  'lost',
])

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function optionalText(value: unknown): string | undefined {
  const result = text(value)
  return result || undefined
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}

/** Convert a user-owned `public.leads` row into the app's stable Lead shape. */
export function mapSavedLeadRow(row: SavedLeadRow): Lead {
  const rawStatus = text(row.status) as LeadStatus
  const rawPipelineStage = text(row.pipeline_stage) as PipelineStage
  const rawConfidence = text(row.email_confidence)

  return {
    id: text(row.id),
    businessName: text(row.business_name),
    category: text(row.category),
    address: text(row.address),
    city: text(row.city),
    state: text(row.state),
    zipCode: text(row.zip_code),
    phone: text(row.phone),
    website: text(row.website),
    rating: nullableNumber(row.rating),
    reviewCount: nullableNumber(row.review_count),
    latitude: nullableNumber(row.latitude),
    longitude: nullableNumber(row.longitude),
    distanceMiles: nullableNumber(row.distance_miles),
    leadScore: nullableNumber(row.lead_score) ?? 0,
    status: LEAD_STATUSES.has(rawStatus) ? rawStatus : 'new',
    notes: text(row.notes),
    savedAt: optionalText(row.saved_at) ?? optionalText(row.created_at),
    createdAt: optionalText(row.created_at),
    userId: optionalText(row.user_id),
    employeeCount: nullableNumber(row.employee_count),
    revenueEstimate: optionalText(row.revenue_estimate),
    facebookUrl: optionalText(row.facebook_url),
    instagramUrl: optionalText(row.instagram_url),
    linkedinUrl: optionalText(row.linkedin_url),
    email: optionalText(row.email),
    emailConfidence:
      rawConfidence === 'verified' || rawConfidence === 'likely' || rawConfidence === 'guessed'
        ? rawConfidence
        : undefined,
    digitalHealthScore: nullableNumber(row.digital_health_score) ?? undefined,
    pipelineStage: PIPELINE_STAGES.has(rawPipelineStage) ? rawPipelineStage : 'new',
    stageUpdatedAt: optionalText(row.stage_updated_at),
  }
}
