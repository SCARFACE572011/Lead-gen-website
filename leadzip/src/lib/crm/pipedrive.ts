import type { CrmLead, CrmResult, CrmExportResult } from './types'

const BASE = 'https://api.pipedrive.com/v1'

async function createOrganization(apiKey: string, lead: CrmLead): Promise<CrmResult> {
  const res = await fetch(`${BASE}/organizations?api_token=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: lead.businessName,
      address: [lead.address, lead.city, lead.state].filter(Boolean).join(', '),
      ...(lead.category ? { label: lead.category } : {}),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { success: false, error: err.error ?? `HTTP ${res.status}` }
  }

  const org = await res.json()
  const orgId = org.data?.id

  // Add phone/website as a Person linked to the org
  const personRes = await fetch(`${BASE}/persons?api_token=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: lead.businessName,
      org_id: orgId,
      phone: lead.phone ? [{ value: lead.phone, primary: true }] : [],
      email: lead.email ? [{ value: lead.email, primary: true }] : [],
    }),
  })

  if (personRes.ok) {
    const person = await personRes.json()
    return { success: true, id: person.data?.id }
  }

  return { success: true, id: String(orgId) }
}

export async function exportToPipedrive(apiKey: string, leads: CrmLead[]): Promise<CrmExportResult> {
  const result: CrmExportResult = { total: leads.length, succeeded: 0, failed: 0, errors: [] }
  for (const lead of leads) {
    const r = await createOrganization(apiKey, lead)
    if (r.success) { result.succeeded++ } else { result.failed++; if (r.error) result.errors.push(`${lead.businessName}: ${r.error}`) }
  }
  return result
}

export async function validatePipedriveKey(apiKey: string): Promise<boolean> {
  const res = await fetch(`${BASE}/organizations?api_token=${encodeURIComponent(apiKey)}&limit=1`)
  return res.ok
}
