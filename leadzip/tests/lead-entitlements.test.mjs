import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypeScriptModule, modulePath } from './helpers/load-typescript-module.mjs'

const policy = await loadTypeScriptModule(modulePath('src/lib/leadEntitlements.ts'), {
  '@/lib/planPolicy': modulePath('src/lib/planPolicy.ts'),
})

test('Free is individual-save only with 25-row storage and export limits', () => {
  assert.deepEqual(policy.getLeadEntitlements('free'), {
    plan: 'free',
    canBulkSave: false,
    canExportAll: false,
    maxSavedLeads: 25,
    maxExportRows: 25,
  })
})

test('Pro enables bulk actions while keeping its 1,000 saved-lead ceiling', () => {
  assert.deepEqual(policy.getLeadEntitlements('pro'), {
    plan: 'pro',
    canBulkSave: true,
    canExportAll: true,
    maxSavedLeads: 1_000,
    maxExportRows: null,
  })
})

test('Agency receives its fair-use saved-lead allowance and full exports', () => {
  assert.deepEqual(policy.getLeadEntitlements('agency'), {
    plan: 'agency',
    canBulkSave: true,
    canExportAll: true,
    maxSavedLeads: 10_000,
    maxExportRows: null,
  })
})

test('unknown plans fail closed to Free while a protected admin role gets owner product access', () => {
  assert.equal(policy.getLeadEntitlements('made-up').plan, 'free')
  assert.deepEqual(policy.getLeadEntitlements('free', 'admin'), {
    plan: 'agency',
    canBulkSave: true,
    canExportAll: true,
    maxSavedLeads: null,
    maxExportRows: null,
  })
})
