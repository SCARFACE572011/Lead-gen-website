import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypeScriptModule, modulePath } from './helpers/load-typescript-module.mjs'

const policy = await loadTypeScriptModule(modulePath('src/lib/planPolicy.ts'))

test('public plan catalog keeps the value-first search and storage allowances aligned', () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(policy.PLAN_POLICY).map(([plan, value]) => [plan, {
        live: value.liveSearchesPerMonth,
        trialLive: value.trialLiveSearches,
        saved: value.savedLeads,
        bulk: value.bulkZipLimit,
        email: value.includedEmailCredits,
        seats: value.teamSeats,
      }])
    ),
    {
      free: { live: 25, trialLive: 25, saved: 25, bulk: 1, email: 5, seats: 1 },
      pro: { live: 100, trialLive: 25, saved: 1_000, bulk: 10, email: 100, seats: 1 },
      agency: { live: 300, trialLive: 75, saved: 10_000, bulk: 25, email: 500, seats: 5 },
    }
  )
})

test('automation and integration limits create clear upgrade steps', () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(policy.PLAN_POLICY).map(([plan, value]) => [plan, {
        savedSearches: value.savedSearches,
        alerts: value.activeAlerts,
        crm: value.crmConnections,
        api: value.apiRequestsPerDay,
      }])
    ),
    {
      free: { savedSearches: 3, alerts: 0, crm: 0, api: 0 },
      pro: { savedSearches: 25, alerts: 10, crm: 1, api: 0 },
      agency: { savedSearches: 100, alerts: 50, crm: 3, api: 500 },
    }
  )
})
