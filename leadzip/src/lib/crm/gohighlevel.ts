import type { CrmLead, CrmResult, CrmExportResult } from './types'

const BASE = 'https://rest.gohighlevel.com/v1'

async function createContact(apiKey: string, lead: CrmLead): Promise<CrmResult> {
  const res = await fetch(`${BASE}/contacts/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: lead.businessName,
      ...(lead.email ? { email: lead.email } : {}),
      phone: lead.phone ?? '',
      website: lead.website ?? '',
      address1: lead.address ?? '',
      city: lead.city ?? '',
      state: lead.state ?? '',
      tags: lead.category ? [lead.category, 'leadzip'] : ['leadzip'],
      source: 'LeadZipp',
    }),
  })

  if (res.ok) {
    const data = await res.json()
    return { success: true, id: data.contact?.id }
  }

  const err = await res.json().catch(() => ({}))
  return { success: false, error: err.message ?? `HTTP ${res.status}` }
}

export async function exportToGoHighLevel(apiKey: string, leads: CrmLead[]): Promise<CrmExportResult> {
  const result: CrmExportResult = { total: leads.length, succeeded: 0, failed: 0, errors: [] }
  for (const lead of leads) {
    const r = await createContact(apiKey, lead)
    if (r.success) { result.succeeded++ } else { result.failed++; if (r.error) result.errors.push(`${lead.businessName}: ${r.error}`) }
  }
  return result
}

export async function validateGoHighLevelKey(apiKey: string): Promise<boolean> {
  const res = await fetch(`${BASE}/contacts/?limit=1`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  return res.ok
}
