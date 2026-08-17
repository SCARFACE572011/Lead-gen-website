import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypeScriptModule, modulePath } from './helpers/load-typescript-module.mjs'

const { mapPaidPlanFromPriceId } = await loadTypeScriptModule(
  modulePath('src/lib/stripe/pricePolicy.ts')
)

const catalog = {
  proMonthly: 'price_pro_monthly',
  proAnnual: 'price_pro_annual',
  agencyMonthly: 'price_agency_monthly',
  agencyAnnual: 'price_agency_annual',
}

test('subscription entitlements resolve from Stripe Price IDs', () => {
  assert.equal(mapPaidPlanFromPriceId('price_pro_monthly', catalog), 'pro')
  assert.equal(mapPaidPlanFromPriceId('price_pro_annual', catalog), 'pro')
  assert.equal(mapPaidPlanFromPriceId('price_agency_monthly', catalog), 'agency')
  assert.equal(mapPaidPlanFromPriceId('price_agency_annual', catalog), 'agency')
})

test('unknown, placeholder and duplicate Stripe Price mappings fail closed', () => {
  assert.equal(mapPaidPlanFromPriceId('price_attacker', catalog), null)
  assert.equal(
    mapPaidPlanFromPriceId('price_placeholder_create_me', {
      ...catalog,
      proMonthly: 'price_placeholder_create_me',
    }),
    null
  )
  assert.equal(
    mapPaidPlanFromPriceId('price_duplicate', {
      ...catalog,
      proMonthly: 'price_duplicate',
      agencyMonthly: 'price_duplicate',
    }),
    null
  )
})
