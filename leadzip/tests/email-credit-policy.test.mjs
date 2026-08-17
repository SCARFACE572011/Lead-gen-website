import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypeScriptModule, modulePath } from './helpers/load-typescript-module.mjs'

const policy = await loadTypeScriptModule(modulePath('src/lib/emailCreditPolicy.ts'))
const plans = await loadTypeScriptModule(modulePath('src/lib/planPolicy.ts'))

test('included email credits come from the centralized plan policy', () => {
  assert.equal(plans.PLAN_POLICY.free.includedEmailCredits, 5)
  assert.equal(plans.PLAN_POLICY.pro.includedEmailCredits, 100)
  assert.equal(plans.PLAN_POLICY.agency.includedEmailCredits, 500)
})

test('trials use smaller non-renewing email credit allowances', () => {
  assert.deepEqual(policy.EMAIL_CREDIT_TRIAL_ALLOWANCES, {
    pro: 20,
    agency: 50,
  })
})

test('one-time packs use fixed server-owned quantities and prices', () => {
  assert.deepEqual(
    policy.EMAIL_CREDIT_PACK_DEFINITIONS.map(({ slug, credits, amountCents }) => ({
      slug,
      credits,
      amountCents,
    })),
    [
      { slug: '50', credits: 50, amountCents: 900 },
      { slug: '250', credits: 250, amountCents: 2_900 },
      { slug: '1000', credits: 1_000, amountCents: 7_900 },
    ]
  )
})

test('pack definitions require a distinct explicit Stripe Price variable', () => {
  const envNames = policy.EMAIL_CREDIT_PACK_DEFINITIONS.map((pack) => pack.envName)
  assert.equal(new Set(envNames).size, envNames.length)
  assert.deepEqual(envNames, [
    'STRIPE_PRICE_EMAIL_CREDITS_50',
    'STRIPE_PRICE_EMAIL_CREDITS_250',
    'STRIPE_PRICE_EMAIL_CREDITS_1000',
  ])
})
