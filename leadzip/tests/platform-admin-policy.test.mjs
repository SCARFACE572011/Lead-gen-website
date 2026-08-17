import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTypeScriptModule, modulePath } from './helpers/load-typescript-module.mjs'

const { isPlatformAdminRecord } = await loadTypeScriptModule(
  modulePath('src/lib/adminPolicy.ts')
)

test('Agency/customer ownership never grants platform Owner access', () => {
  assert.equal(
    isPlatformAdminRecord(
      { role: 'user', status: 'active' },
      'agency@example.com',
      'agency@example.com'
    ),
    false
  )
})

test('an admin role still requires the private allowlist', () => {
  assert.equal(
    isPlatformAdminRecord(
      { role: 'admin', status: 'active' },
      null,
      'owner@example.com'
    ),
    false
  )
})

test('deactivated allowlisted admins are denied', () => {
  assert.equal(
    isPlatformAdminRecord(
      { role: 'admin', status: 'deactivated' },
      'owner@example.com',
      'owner@example.com'
    ),
    false
  )
})

test('active allowlisted admins are accepted with normalized email casing', () => {
  assert.equal(
    isPlatformAdminRecord(
      { role: 'admin', status: 'active' },
      ' Owner@Example.com ',
      'owner@example.com'
    ),
    true
  )
})
