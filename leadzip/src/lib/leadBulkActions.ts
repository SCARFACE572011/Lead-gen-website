'use client'

import type { Lead } from '@/types/lead'
import { BULK_SAVE_CLIENT_BATCH_SIZE } from '@/lib/leadEntitlements'

const SAVED_IDS_KEY = 'leadzip_saved'
const SAVED_LEADS_KEY = 'leadzip_saved_leads'
const MAX_LOCAL_SAVED_LEAD_DETAILS = 200

export interface BulkSaveIssue {
  index: number
  id?: string
  reason: string
  message: string
}
interface SaveApiResponse {
  success?: boolean
  error?: string
  plan?: string
  receivedCount?: number
  savedCount?: number
  insertedCount?: number
  alreadySavedCount?: number
  duplicateCount?: number
  rejectedCount?: number
  requestLimitedCount?: number
  capacityRejectedCount?: number
  failedCount?: number
  savedIds?: string[]
  insertedIds?: string[]
  alreadySavedIds?: string[]
  failedIds?: string[]
  issues?: BulkSaveIssue[]
  remaining?: number | null
  savedLeadLimit?: number | null
  limitReached?: boolean
  upgradeRequired?: boolean
  migrationRequired?: boolean
}

export interface BulkSaveProgress {
  completed: number
  total: number
  saved: number
}

export interface BulkSaveResult {
  plan: string
  receivedCount: number
  savedCount: number
  insertedCount: number
  alreadySavedCount: number
  duplicateCount: number
  rejectedCount: number
  capacityRejectedCount: number
  failedCount: number
  savedIds: string[]
  insertedIds: string[]
  alreadySavedIds: string[]
  failedIds: string[]
  issues: BulkSaveIssue[]
  remaining: number | null
  savedLeadLimit: number | null
  limitReached: boolean
  upgradeRequired: boolean
  migrationRequired: boolean
}

export class LeadBulkActionError extends Error {
  readonly status: number
  readonly upgradeRequired: boolean
  readonly limitReached: boolean
  readonly migrationRequired: boolean

  constructor(status: number, payload: SaveApiResponse | { error?: string }) {
    super(payload.error || 'Lead action failed. Please try again.')
    this.name = 'LeadBulkActionError'
    this.status = status
    this.upgradeRequired = 'upgradeRequired' in payload && payload.upgradeRequired === true
    this.limitReached = 'limitReached' in payload && payload.limitReached === true
    this.migrationRequired = 'migrationRequired' in payload && payload.migrationRequired === true
  }
}

function uniqueLeads(leads: Lead[]): { leads: Lead[]; duplicateCount: number } {
  const unique = new Map<string, Lead>()
  let duplicateCount = 0
  for (const lead of leads) {
    if (!lead?.id) continue
    if (unique.has(lead.id)) {
      duplicateCount += 1
      continue
    }
    unique.set(lead.id, lead)
  }
  return { leads: [...unique.values()], duplicateCount }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

async function responseJson(response: Response): Promise<SaveApiResponse> {
  try {
    return (await response.json()) as SaveApiResponse
  } catch {
    return { error: response.statusText || 'Lead action failed. Please try again.' }
  }
}

async function downloadCsvResponse(response: Response, fallbackFilename: string): Promise<void> {
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const disposition = response.headers.get('content-disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/i)
  link.href = url
  link.download = match?.[1] ?? fallbackFilename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Keep the existing offline/local dashboard cache in sync with confirmed DB saves. */
export function cacheConfirmedSavedLeads(leads: Lead[], savedIds: Iterable<string>): void {
  if (typeof window === 'undefined') return
  const confirmed = new Set(savedIds)
  if (confirmed.size === 0) return

  try {
    let storedIds: string[] = []
    let storedLeads: Lead[] = []
    try {
      storedIds = JSON.parse(localStorage.getItem(SAVED_IDS_KEY) ?? '[]') as string[]
    } catch { /* use empty cache */ }
    try {
      storedLeads = JSON.parse(localStorage.getItem(SAVED_LEADS_KEY) ?? '[]') as Lead[]
    } catch { /* use empty cache */ }

    const idSet = new Set(storedIds.filter((id) => typeof id === 'string'))
    confirmed.forEach((id) => idSet.add(id))

    const leadMap = new Map(
      storedLeads
        .filter((lead) => lead && typeof lead.id === 'string')
        .map((lead) => [lead.id, lead])
    )
    const now = new Date().toISOString()
    for (const lead of leads) {
      if (!confirmed.has(lead.id)) continue
      const previous = leadMap.get(lead.id)
      leadMap.set(lead.id, {
        ...lead,
        // Do not overwrite pipeline work when a result is saved again.
        status: previous?.status ?? lead.status,
        notes: previous?.notes ?? lead.notes,
        pipelineStage: previous?.pipelineStage ?? lead.pipelineStage,
        stageUpdatedAt: previous?.stageUpdatedAt ?? lead.stageUpdatedAt,
        savedAt: previous?.savedAt ?? lead.savedAt ?? now,
      })
    }

    localStorage.setItem(SAVED_IDS_KEY, JSON.stringify([...idSet]))
    // The database is authoritative. Keep only a compact offline preview so a
    // high-volume Agency save cannot exhaust the browser's localStorage quota.
    localStorage.setItem(
      SAVED_LEADS_KEY,
      JSON.stringify([...leadMap.values()].slice(-MAX_LOCAL_SAVED_LEAD_DETAILS))
    )
  } catch {
    // Local cache is a convenience; the server save is authoritative.
  }
}

/**
 * Save selected/all already-returned results. Requests are sequential 200-row
 * chunks, so this never starts searches, website probes, or AI/enrichment work.
 */
export async function saveReturnedLeads(
  inputLeads: Lead[],
  onProgress?: (progress: BulkSaveProgress) => void
): Promise<BulkSaveResult> {
  const deduped = uniqueLeads(inputLeads)
  const leads = deduped.leads
  const aggregate: BulkSaveResult = {
    plan: 'free',
    receivedCount: inputLeads.length,
    savedCount: 0,
    insertedCount: 0,
    alreadySavedCount: 0,
    duplicateCount: deduped.duplicateCount,
    rejectedCount: 0,
    capacityRejectedCount: 0,
    failedCount: 0,
    savedIds: [],
    insertedIds: [],
    alreadySavedIds: [],
    failedIds: [],
    issues: [],
    remaining: null,
    savedLeadLimit: null,
    limitReached: false,
    upgradeRequired: false,
    migrationRequired: false,
  }
  if (leads.length === 0) return aggregate

  onProgress?.({ completed: 0, total: leads.length, saved: 0 })

  for (let offset = 0; offset < leads.length; offset += BULK_SAVE_CLIENT_BATCH_SIZE) {
    const batch = leads.slice(offset, offset + BULK_SAVE_CLIENT_BATCH_SIZE)
    const response = await fetch('/api/leads/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: batch }),
    })
    const payload = await responseJson(response)

    // Capacity conflicts carry useful partial information and are merged below.
    // Auth, plan, rate, migration, and infrastructure failures stop the action.
    if (!response.ok && !(response.status === 409 && payload.limitReached)) {
      throw new LeadBulkActionError(response.status, payload)
    }

    aggregate.plan = payload.plan ?? aggregate.plan
    aggregate.savedCount += payload.savedCount ?? 0
    aggregate.insertedCount += payload.insertedCount ?? 0
    aggregate.alreadySavedCount += payload.alreadySavedCount ?? 0
    aggregate.duplicateCount += payload.duplicateCount ?? 0
    aggregate.rejectedCount += payload.rejectedCount ?? 0
    aggregate.capacityRejectedCount += payload.capacityRejectedCount ?? 0
    aggregate.failedCount += payload.failedCount ?? 0
    aggregate.savedIds.push(...stringArray(payload.savedIds))
    aggregate.insertedIds.push(...stringArray(payload.insertedIds))
    aggregate.alreadySavedIds.push(...stringArray(payload.alreadySavedIds))
    aggregate.failedIds.push(...stringArray(payload.failedIds))
    aggregate.issues.push(...(payload.issues ?? []))
    aggregate.remaining = payload.remaining ?? aggregate.remaining
    aggregate.savedLeadLimit = payload.savedLeadLimit ?? aggregate.savedLeadLimit
    aggregate.limitReached ||= payload.limitReached === true
    aggregate.upgradeRequired ||= payload.upgradeRequired === true
    aggregate.migrationRequired ||= payload.migrationRequired === true

    const completed = Math.min(offset + batch.length, leads.length)
    onProgress?.({ completed, total: leads.length, saved: aggregate.savedCount })

    if (aggregate.limitReached) break
  }

  aggregate.savedIds = [...new Set(aggregate.savedIds)]
  aggregate.insertedIds = [...new Set(aggregate.insertedIds)]
  aggregate.alreadySavedIds = [...new Set(aggregate.alreadySavedIds)]
  aggregate.failedIds = [...new Set(aggregate.failedIds)]
  cacheConfirmedSavedLeads(leads, aggregate.savedIds)
  return aggregate
}

export interface ExportReturnedLeadsOptions {
  filename?: string
  fields?: string[]
  bom?: boolean
}

export interface ExportReturnedLeadsResult {
  plan: string
  receivedCount: number
  normalizedCount: number
  exportedCount: number
  partial: boolean
  planCapped: boolean
  requestCapped: boolean
  duplicateCount: number
  invalidCount: number
  requestLimitedCount: number
  exportLimit: number | null
  upgradeNotice: string | null
}

function numberHeader(response: Response, name: string): number {
  const value = Number(response.headers.get(name) ?? 0)
  return Number.isFinite(value) ? value : 0
}

function booleanHeader(response: Response, name: string): boolean {
  return response.headers.get(name) === 'true'
}

/** Download a CSV through the plan-enforcing server route. */
export async function exportReturnedLeadsCsv(
  leads: Lead[],
  options: ExportReturnedLeadsOptions = {}
): Promise<ExportReturnedLeadsResult> {
  if (leads.length === 0) throw new Error('Select at least one lead to export.')

  const response = await fetch('/api/leads/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leads,
      fields: options.fields,
      filename: options.filename,
      bom: options.bom,
    }),
  })

  if (!response.ok) {
    const payload = await responseJson(response)
    throw new LeadBulkActionError(response.status, payload)
  }

  await downloadCsvResponse(response, `${options.filename || 'leadzipp-export'}.csv`)

  const rawLimit = response.headers.get('x-export-limit')
  return {
    plan: response.headers.get('x-lead-plan') ?? 'free',
    receivedCount: numberHeader(response, 'x-export-received'),
    normalizedCount: numberHeader(response, 'x-export-normalized'),
    exportedCount: numberHeader(response, 'x-export-count'),
    partial: booleanHeader(response, 'x-export-partial'),
    planCapped: booleanHeader(response, 'x-export-plan-capped'),
    requestCapped: booleanHeader(response, 'x-export-request-capped'),
    duplicateCount: numberHeader(response, 'x-export-duplicates'),
    invalidCount: numberHeader(response, 'x-export-invalid'),
    requestLimitedCount: numberHeader(response, 'x-export-request-limited'),
    exportLimit: rawLimit === null ? null : Number(rawLimit),
    upgradeNotice: response.headers.get('x-upgrade-notice'),
  }
}

/**
 * Download every saved lead allowed by the caller's plan. Rows are read and
 * streamed server-side, so high-volume Agency lists are not limited to what
 * the browser has paginated into view or the generic 2,000-row payload cap.
 */
export async function exportAllSavedLeadsCsv(
  options: ExportReturnedLeadsOptions = {}
): Promise<ExportReturnedLeadsResult> {
  const response = await fetch('/api/leads/export/saved', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: options.fields,
      filename: options.filename,
      bom: options.bom,
    }),
  })

  if (!response.ok) {
    const payload = await responseJson(response)
    throw new LeadBulkActionError(response.status, payload)
  }

  await downloadCsvResponse(response, `${options.filename || 'leadzipp-saved-export'}.csv`)

  const exportedCount = numberHeader(response, 'x-export-count')
  const rawLimit = response.headers.get('x-export-limit')
  return {
    plan: response.headers.get('x-lead-plan') ?? 'free',
    receivedCount: exportedCount,
    normalizedCount: exportedCount,
    exportedCount,
    partial: booleanHeader(response, 'x-export-plan-capped'),
    planCapped: booleanHeader(response, 'x-export-plan-capped'),
    requestCapped: false,
    duplicateCount: 0,
    invalidCount: 0,
    requestLimitedCount: 0,
    exportLimit: rawLimit === null ? null : Number(rawLimit),
    upgradeNotice: response.headers.get('x-upgrade-notice'),
  }
}
