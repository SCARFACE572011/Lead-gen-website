import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypeScriptModule, modulePath } from './helpers/load-typescript-module.mjs'

const policy = await loadTypeScriptModule(
  modulePath('src/lib/stripe/subscriptionStatePolicy.ts')
)

test('newer inactive state beats an active event from the same Stripe second', () => {
  const canceledVersion = policy.subscriptionOrderingVersion(100, 'canceled')
  assert.equal(canceledVersion, 201)
  assert.equal(
    policy.shouldApplySubscriptionState(
      {
        subscriptionId: 'sub_1',
        status: 'canceled',
        orderingVersion: canceledVersion,
        subscriptionCreated: 10,
      },
      {
        subscriptionId: 'sub_1',
        status: 'active',
        eventCreated: 100,
        subscriptionCreated: 10,
      }
    ),
    false
  )
})

test('a legitimately newer replacement subscription supersedes an old tombstone', () => {
  assert.equal(
    policy.shouldApplySubscriptionState(
      {
        subscriptionId: 'sub_old',
        status: 'canceled',
        orderingVersion: policy.subscriptionOrderingVersion(500, 'canceled'),
        subscriptionCreated: 10,
      },
      {
        subscriptionId: 'sub_new',
        status: 'trialing',
        eventCreated: 501,
        subscriptionCreated: 20,
      }
    ),
    true
  )
})

test('late events from an older subscription cannot overwrite its replacement', () => {
  assert.equal(
    policy.shouldApplySubscriptionState(
      {
        subscriptionId: 'sub_new',
        status: 'active',
        orderingVersion: policy.subscriptionOrderingVersion(600, 'active'),
        subscriptionCreated: 20,
      },
      {
        subscriptionId: 'sub_old',
        status: 'canceled',
        eventCreated: 700,
        subscriptionCreated: 10,
      }
    ),
    false
  )
})
