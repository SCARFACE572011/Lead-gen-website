import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypeScriptModule, modulePath } from './helpers/load-typescript-module.mjs'

const sync = await loadTypeScriptModule(modulePath('src/lib/stripe/subscriptionSync.ts'), {
  stripe: modulePath('tests/helpers/stubs/stripe.ts'),
  '@supabase/supabase-js': modulePath('tests/helpers/stubs/supabase-js.ts'),
  '@/lib/stripe/pricePolicy': modulePath('src/lib/stripe/pricePolicy.ts'),
  '@/lib/stripe/subscriptionStatePolicy': modulePath(
    'src/lib/stripe/subscriptionStatePolicy.ts'
  ),
})

const policy = await loadTypeScriptModule(
  modulePath('src/lib/stripe/subscriptionStatePolicy.ts')
)

const VERSION_COLUMNS = ['stripe_state_version', 'stripe_subscription_created']

/**
 * In-memory stand-in for the subscriptions table. `hasVersionColumns: false`
 * reproduces production today: supabase/migrations/20260815_product_allowances
 * has not run, so PostgREST rejects any read (42703) or write (PGRST204) that
 * names stripe_state_version or stripe_subscription_created.
 */
function createStubSupabase({
  hasVersionColumns,
  // PostgREST answers a stale schema cache with PGRST204 on writes even when
  // the read path is happy, so the two are configurable independently.
  hasVersionColumnsOnWrite = hasVersionColumns,
  rows = [],
}) {
  const table = rows.map((row) => ({ ...row }))
  const operations = []
  let nextId = table.length + 1

  const isVersionColumn = (name) => VERSION_COLUMNS.includes(name)
  const namesVersionColumn = (columns) =>
    typeof columns === 'string' && VERSION_COLUMNS.some((name) => columns.includes(name))

  const undefinedColumnError = {
    code: '42703',
    message: 'column subscriptions.stripe_state_version does not exist',
  }
  const schemaCacheError = {
    code: 'PGRST204',
    message:
      "Could not find the 'stripe_state_version' column of 'subscriptions' in the schema cache",
  }

  function matches(row, filters) {
    return filters.every((filter) => {
      const value = row[filter.column]
      if (filter.op === 'eq') return value === filter.value
      if (filter.op === 'is') return (value ?? null) === filter.value
      if (filter.op === 'lte') return Number(value ?? 0) <= filter.value
      return false
    })
  }

  function run(state) {
    operations.push({
      operation: state.operation,
      columns: state.columns ?? null,
      filterColumns: state.filters.map((filter) => filter.column),
      values: state.values ? { ...state.values } : null,
    })

    if (state.operation === 'select') {
      if (!hasVersionColumns && namesVersionColumn(state.columns)) {
        return { data: null, error: undefinedColumnError }
      }
      const found = table.filter((row) => matches(row, state.filters))
      return { data: found[0] ? { ...found[0] } : null, error: null }
    }

    const writesVersionColumn =
      Object.keys(state.values ?? {}).some(isVersionColumn) ||
      state.filters.some((filter) => isVersionColumn(filter.column))
    if (!hasVersionColumnsOnWrite && writesVersionColumn) {
      return { data: null, error: schemaCacheError }
    }

    if (state.operation === 'update') {
      const target = table.filter((row) => matches(row, state.filters))
      for (const row of target) Object.assign(row, state.values)
      return { data: target[0] ? { id: target[0].id } : null, error: null }
    }

    table.push({ id: `row_${nextId++}`, ...state.values })
    return { data: null, error: null }
  }

  function builder(state) {
    const chain = {
      select(columns) {
        state.columns = columns
        return chain
      },
      eq(column, value) {
        state.filters.push({ op: 'eq', column, value })
        return chain
      },
      is(column, value) {
        state.filters.push({ op: 'is', column, value })
        return chain
      },
      lte(column, value) {
        state.filters.push({ op: 'lte', column, value })
        return chain
      },
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => Promise.resolve(run(state)),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(run(state)).then(onFulfilled, onRejected),
    }
    return chain
  }

  const client = {
    from(tableName) {
      assert.equal(tableName, 'subscriptions')
      return {
        select: (columns) => builder({ operation: 'select', filters: [], columns }),
        update: (values) => builder({ operation: 'update', filters: [], values }),
        insert: (values) => builder({ operation: 'insert', filters: [], values }),
      }
    },
  }

  return { client, table, operations }
}

function webhookSync(overrides = {}) {
  return {
    userId: 'user_1',
    customerId: 'cus_1',
    subscriptionId: 'sub_1',
    plan: 'pro',
    status: 'active',
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-09-01T00:00:00.000Z',
    stateVersion: 1500,
    subscriptionCreated: 900,
    ...overrides,
  }
}

/* ---------- migration applied: the versioned logic is unchanged ---------- */

test('with the migration applied a new subscription is stored with its ordering version', async () => {
  const db = createStubSupabase({ hasVersionColumns: true })

  const result = await sync.syncSubscriptionRow(db.client, webhookSync())

  assert.deepEqual(result, { error: null, applied: true })
  assert.equal(db.table.length, 1)
  assert.equal(db.table[0].stripe_state_version, policy.subscriptionOrderingVersion(1500, 'active'))
  assert.equal(db.table[0].stripe_subscription_created, 900)
  assert.equal(db.table[0].plan, 'pro')
})

test('with the migration applied an out-of-order active event cannot undo a cancellation', async () => {
  const db = createStubSupabase({
    hasVersionColumns: true,
    rows: [
      {
        id: 'row_1',
        user_id: 'user_1',
        stripe_customer_id: 'cus_1',
        stripe_subscription_id: 'sub_1',
        plan: 'free',
        status: 'cancelled',
        stripe_state_version: policy.subscriptionOrderingVersion(2000, 'canceled'),
        stripe_subscription_created: 900,
      },
    ],
  })

  const result = await sync.syncSubscriptionRow(
    db.client,
    webhookSync({ stateVersion: 1900, status: 'active' })
  )

  assert.deepEqual(result, { error: null, applied: false })
  assert.equal(db.table[0].status, 'cancelled')
  assert.equal(db.table[0].plan, 'free')
})

test('with the migration applied the update carries the compare-and-set version fence', async () => {
  const db = createStubSupabase({
    hasVersionColumns: true,
    rows: [
      {
        id: 'row_1',
        user_id: 'user_1',
        stripe_customer_id: 'cus_1',
        stripe_subscription_id: 'sub_1',
        plan: 'pro',
        status: 'active',
        stripe_state_version: policy.subscriptionOrderingVersion(1000, 'active'),
        stripe_subscription_created: 900,
      },
    ],
  })

  const result = await sync.syncSubscriptionRow(db.client, webhookSync())

  assert.deepEqual(result, { error: null, applied: true })
  const update = db.operations.find((entry) => entry.operation === 'update')
  assert.ok(update.filterColumns.includes('stripe_state_version'))
})

/* ---------- migration missing: fall back, never 500 the webhook ---------- */

test('without the migration a subscription webhook still activates the customer', async () => {
  const db = createStubSupabase({ hasVersionColumns: false })

  const result = await sync.syncSubscriptionRow(db.client, webhookSync())

  assert.deepEqual(result, { error: null, applied: true })
  assert.equal(db.table.length, 1)
  assert.equal(db.table[0].plan, 'pro')
  assert.equal(db.table[0].status, 'active')
  for (const column of VERSION_COLUMNS) {
    assert.equal(Object.hasOwn(db.table[0], column), false)
  }
  const selects = db.operations.filter((entry) => entry.operation === 'select')
  assert.equal(selects[0].columns.includes('stripe_state_version'), true)
  assert.deepEqual(selects.at(-1).columns, 'id, stripe_subscription_id, status')
})

test('without the migration an existing row is updated without any version filter', async () => {
  const db = createStubSupabase({
    hasVersionColumns: false,
    rows: [
      {
        id: 'row_1',
        user_id: 'user_1',
        stripe_customer_id: 'cus_1',
        stripe_subscription_id: 'sub_1',
        plan: 'pro',
        status: 'trialing',
      },
    ],
  })

  const result = await sync.syncSubscriptionRow(
    db.client,
    webhookSync({ plan: 'free', status: 'canceled', stateVersion: 2000 })
  )

  assert.deepEqual(result, { error: null, applied: true })
  assert.equal(db.table.length, 1)
  assert.equal(db.table[0].plan, 'free')
  const update = db.operations.find((entry) => entry.operation === 'update')
  for (const column of VERSION_COLUMNS) {
    assert.equal(update.filterColumns.includes(column), false)
    assert.equal(Object.hasOwn(update.values, column), false)
  }
})

test('without the migration a checkout return cannot re-grant an already-inactive subscription', async () => {
  const db = createStubSupabase({
    hasVersionColumns: false,
    rows: [
      {
        id: 'row_1',
        user_id: 'user_1',
        stripe_customer_id: 'cus_1',
        stripe_subscription_id: 'sub_1',
        plan: 'free',
        status: 'cancelled',
      },
    ],
  })

  const result = await sync.syncSubscriptionRow(
    db.client,
    webhookSync({ stateVersion: 0, status: 'active' })
  )

  assert.deepEqual(result, { error: null, applied: false })
  assert.equal(db.table[0].plan, 'free')
})

test('a PGRST204 write rejection also falls back instead of failing the webhook', async () => {
  const db = createStubSupabase({ hasVersionColumns: true, hasVersionColumnsOnWrite: false })

  const result = await sync.syncSubscriptionRow(db.client, webhookSync())

  assert.deepEqual(result, { error: null, applied: true })
  assert.equal(db.table.length, 1)
  for (const column of VERSION_COLUMNS) {
    assert.equal(Object.hasOwn(db.table[0], column), false)
  }
})

test('an unrelated database failure is still reported instead of being swallowed', async () => {
  const failing = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: null,
                error: { code: '42501', message: 'permission denied for table subscriptions' },
              }),
            }),
          }),
        }),
      }),
    }),
  }

  const result = await sync.syncSubscriptionRow(failing, webhookSync())

  assert.equal(result.applied, false)
  assert.equal(result.error, 'permission denied for table subscriptions')
})

/* ---------- churn metric and stored status agree ---------- */

test('the stored cancellation status matches what the admin churn metric filters on', async () => {
  assert.equal(policy.persistedSubscriptionStatus('canceled'), 'cancelled')
  assert.equal(policy.persistedSubscriptionStatus('past_due'), 'past_due')
  assert.equal(policy.isActiveSubscriptionStatus('cancelled'), false)

  const db = createStubSupabase({ hasVersionColumns: true })
  await sync.syncSubscriptionRow(
    db.client,
    webhookSync({ plan: 'free', status: 'canceled', stateVersion: 2000 })
  )

  assert.equal(db.table[0].status, 'cancelled')
})
