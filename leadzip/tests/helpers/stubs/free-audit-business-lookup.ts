/**
 * Unit-test stand-in for @/lib/businessLookup. The matcher itself is covered
 * by tests/business-lookup.test.mjs; the route tests only need to know whether
 * findBusiness was reached (a call equals one billable Places request) and to
 * choose what it returns. State lives on globalThis because the route loads
 * its own instance of this module.
 */

export class BusinessLookupError extends Error {
  readonly code: 'not_configured' | 'provider_error'

  constructor(message: string, code: 'not_configured' | 'provider_error') {
    super(message)
    this.name = 'BusinessLookupError'
    this.code = code
  }
}

interface LookupState {
  calls: Array<{ businessName: string; location: string }>
  result: unknown
}

function state(): LookupState {
  const g = globalThis as { __freeAuditLookupState?: LookupState }
  g.__freeAuditLookupState ??= { calls: [], result: null }
  return g.__freeAuditLookupState
}

export async function findBusiness(businessName: string, location: string): Promise<unknown> {
  const s = state()
  s.calls.push({ businessName, location })
  return s.result
}
