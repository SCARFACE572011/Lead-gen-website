import type { CrmLead, CrmResult, CrmExportResult } from './types'

const BASE = 'https://api.hubapi.com'

async function createContact(apiKey: string, lead: CrmLead): Promise<CrmResult> {
  const res = await fetch(`${BASE}/crm/v3/objects/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        company: lead.businessName,
        phone: lead.phone ?? '',
        website: lead.website ?? '',
        address: lead.address ?? '',
        city: lead.city ?? '',
        state: lead.state ?? '',
        hs_lead_status: 'NEW',
        ...(lead.category ? { industry: lead.category } : {}),
      },
    }),
  })

  if (res.ok) {
    const data = await res.json()
    return { success: true, id: data.id }
  }

  const err = await res.json().catch(() => ({}))
  return { success: false, error: err.message ?? `HTTP ${res.status}` }
}

export async function exportToHubSpot(apiKey: string, leads: CrmLead[]): Promise<CrmExportResult> {
  const result: CrmExportResult = { total: leads.length, succeeded: 0, failed: 0, errors: [] }
  for (const lead of leads) {
    const r = await createContact(apiKey, lead)
    if (r.success) { result.succeeded++ } else { result.failed++; if (r.error) result.errors.push(`${lead.businessName}: ${r.error}`) }
  }
  return result
}

export async function validateHubSpotKey(apiKey: string): Promise<boolean> {
  const res = await fetch(`${BASE}/crm/v3/objects/contacts?limit=1`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  return res.ok
}
