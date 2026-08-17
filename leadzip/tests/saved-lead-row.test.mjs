import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypeScriptModule, modulePath } from './helpers/load-typescript-module.mjs'

const { mapSavedLeadRow } = await loadTypeScriptModule(
  modulePath('src/lib/savedLeadRows.ts')
)

test('saved database rows retain enrichment and pipeline fields across pagination/export', () => {
  const lead = mapSavedLeadRow({
    id: 'provider-1',
    user_id: 'user-1',
    business_name: 'Example Dental',
    category: 'Dentists',
    rating: '4.8',
    review_count: 123,
    lead_score: 87,
    status: 'contacted',
    email: 'owner@example.com',
    email_confidence: 'verified',
    digital_health_score: 64,
    pipeline_stage: 'meeting',
    created_at: '2026-08-13T12:00:00.000Z',
  })

  assert.equal(lead.businessName, 'Example Dental')
  assert.equal(lead.rating, 4.8)
  assert.equal(lead.reviewCount, 123)
  assert.equal(lead.email, 'owner@example.com')
  assert.equal(lead.emailConfidence, 'verified')
  assert.equal(lead.digitalHealthScore, 64)
  assert.equal(lead.pipelineStage, 'meeting')
  assert.equal(lead.savedAt, '2026-08-13T12:00:00.000Z')
})

test('invalid legacy status values fail closed to stable defaults', () => {
  const lead = mapSavedLeadRow({ id: 'provider-2', business_name: 'Legacy Lead' })
  assert.equal(lead.status, 'new')
  assert.equal(lead.pipelineStage, 'new')
  assert.equal(lead.rating, null)
})
