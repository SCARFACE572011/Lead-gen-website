import type { Lead, LeadStatus } from '@/types/lead'

export type LeadPayloadIssueReason =
  | 'invalid'
  | 'duplicate'
  | 'request_limit'
  | 'saved_limit'
  | 'database'

export interface LeadPayloadIssue {
  index: number
  id?: string
  reason: LeadPayloadIssueReason
  message: string
}

export interface NormalizedLeadPayload {
  leads: Lead[]
  issues: LeadPayloadIssue[]
  receivedCount: number
  invalidCount: number
  duplicateCount: number
  requestLimitedCount: number
  issuesTruncated: boolean
}

const MAX_REPORTED_ISSUES = 50
const VALID_STATUSES = new Set<LeadStatus>([
  'new',
  'contacted',
  'interested',
  'not_interested',
  'follow_up',
  'converted',
])

function stringValue(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  const result = stringValue(value, maxLength)
  return result || undefined
}

function nullableNumber(
  value: unknown,
  min: number,
  max: number
): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return null
  return Math.min(max, Math.max(min, number))
}

function nullableInteger(value: unknown, min: number, max: number): number | null {
  const number = nullableNumber(value, min, max)
  return number === null ? null : Math.round(number)
}

/**
 * Accept only the Lead fields the save/export workflows actually use. This
 * prevents a caller from making DB rows or CSV generation arbitrarily large.
 */
export function normalizeLeadPayload(value: unknown): Lead | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const id = stringValue(source.id, 512)
  const businessName = stringValue(source.businessName, 500)
  if (!id || !businessName) return null

  const rawStatus = stringValue(source.status, 32) as LeadStatus
  const status = VALID_STATUSES.has(rawStatus) ? rawStatus : 'new'
  const rawConfidence = stringValue(source.emailConfidence, 16)
  const emailConfidence =
    rawConfidence === 'verified' || rawConfidence === 'likely' || rawConfidence === 'guessed'
      ? rawConfidence
      : undefined

  return {
    id,
    businessName,
    category: stringValue(source.category, 300),
    address: stringValue(source.address, 1_000),
    city: stringValue(source.city, 300),
    state: stringValue(source.state, 150),
    zipCode: stringValue(source.zipCode, 40),
    countryCode: optionalString(source.countryCode, 2)?.toUpperCase(),
    phone: stringValue(source.phone, 100),
    website: stringValue(source.website, 2_048),
    rating: nullableNumber(source.rating, 0, 5),
    reviewCount: nullableInteger(source.reviewCount, 0, 10_000_000),
    latitude: nullableNumber(source.latitude, -90, 90),
    longitude: nullableNumber(source.longitude, -180, 180),
    distanceMiles: nullableNumber(source.distanceMiles, 0, 25_000),
    leadScore: nullableInteger(source.leadScore, 0, 100) ?? 0,
    status,
    notes: stringValue(source.notes, 10_000),
    savedAt: optionalString(source.savedAt, 64),
    createdAt: optionalString(source.createdAt, 64),
    employeeCount: nullableInteger(source.employeeCount, 0, 10_000_000),
    revenueEstimate: optionalString(source.revenueEstimate, 200),
    facebookUrl: optionalString(source.facebookUrl, 2_048),
    instagramUrl: optionalString(source.instagramUrl, 2_048),
    linkedinUrl: optionalString(source.linkedinUrl, 2_048),
    sourceZip: optionalString(source.sourceZip, 40),
    email: optionalString(source.email, 320),
    emailConfidence,
    digitalHealthScore: nullableInteger(source.digitalHealthScore, 0, 100) ?? undefined,
  }
}

/** Normalize, de-duplicate by provider lead ID, and bound work per request. */
export function normalizeLeadPayloadList(
  values: unknown[],
  requestLimit: number
): NormalizedLeadPayload {
  const leads: Lead[] = []
  const issues: LeadPayloadIssue[] = []
  const seen = new Set<string>()
  let invalidCount = 0
  let duplicateCount = 0
  const requestLimitedCount = Math.max(0, values.length - requestLimit)

  const addIssue = (issue: LeadPayloadIssue) => {
    if (issues.length < MAX_REPORTED_ISSUES) issues.push(issue)
  }

  for (let index = 0; index < Math.min(values.length, requestLimit); index += 1) {
    const normalized = normalizeLeadPayload(values[index])
    if (!normalized) {
      invalidCount += 1
      addIssue({
        index,
        reason: 'invalid',
        message: 'Lead ID and business name are required.',
      })
      continue
    }
    if (seen.has(normalized.id)) {
      duplicateCount += 1
      addIssue({
        index,
        id: normalized.id,
        reason: 'duplicate',
        message: 'Duplicate lead ID was ignored.',
      })
      continue
    }
    seen.add(normalized.id)
    leads.push(normalized)
  }

  if (requestLimitedCount > 0) {
    addIssue({
      index: requestLimit,
      reason: 'request_limit',
      message: `${requestLimitedCount} lead${requestLimitedCount === 1 ? '' : 's'} exceeded this request's safe processing limit.`,
    })
  }

  const totalIssueCount = invalidCount + duplicateCount + (requestLimitedCount > 0 ? 1 : 0)
  return {
    leads,
    issues,
    receivedCount: values.length,
    invalidCount,
    duplicateCount,
    requestLimitedCount,
    issuesTruncated: totalIssueCount > issues.length,
  }
}
