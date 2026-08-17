/**
 * Minimal in-memory stand-in for the service-role Supabase client used by the
 * email-credit money paths.
 *
 * Two deliberate choices:
 *
 *   1. `.rpc()` is a recorder with scripted answers, NOT a re-implementation of
 *      the PL/pgSQL in supabase/migrations/20260818_email_credits.sql. Rewriting
 *      that arithmetic in JavaScript and then asserting on it would only prove
 *      the copy matches itself. What these tests pin is the TypeScript side of
 *      the boundary: which RPC is called, with exactly which arguments, and how
 *      each answer (including each PostgREST error code) is handled.
 *   2. Anything the test did not configure throws. An unscripted table read or
 *      RPC is a bug in the test, and returning an empty result instead would
 *      quietly turn a real assertion into a no-op.
 */

function normalizeResult(value) {
  if (value && typeof value === 'object' && ('data' in value || 'error' in value)) {
    return { data: value.data ?? null, error: value.error ?? null }
  }
  return { data: value ?? null, error: null }
}

export function createStubDatabase({ tables = {}, rpc = {} } = {}) {
  const rpcCalls = []
  const tableCalls = []

  function readTable(tableName, filters, inFilters) {
    if (!Object.hasOwn(tables, tableName)) {
      throw new Error(`Stub database has no configuration for table "${tableName}".`)
    }
    const configured = tables[tableName]
    if (configured && !Array.isArray(configured) && configured.error) {
      return { data: null, error: configured.error }
    }
    const rows = Array.isArray(configured) ? configured : configured.rows ?? []
    const match = rows.find(
      (row) =>
        filters.every(([column, value]) => row[column] === value) &&
        inFilters.every(([column, values]) => values.includes(row[column]))
    )
    return { data: match ? { ...match } : null, error: null }
  }

  function builder(tableName) {
    const filters = []
    const inFilters = []
    const chain = {
      select: () => chain,
      eq: (column, value) => {
        filters.push([column, value])
        return chain
      },
      in: (column, values) => {
        inFilters.push([column, values])
        return chain
      },
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => {
        tableCalls.push({ table: tableName, filters: [...filters] })
        return readTable(tableName, filters, inFilters)
      },
    }
    return chain
  }

  const client = {
    from(tableName) {
      return { select: () => builder(tableName) }
    },
    async rpc(name, args) {
      rpcCalls.push({ name, args })
      const handler = rpc[name]
      if (!handler) {
        throw new Error(`Stub database has no handler for RPC "${name}".`)
      }
      return normalizeResult(await handler(args))
    },
  }

  return {
    client,
    rpcCalls,
    tableCalls,
    /** Arguments of every call to one RPC, oldest first. */
    rpcArgs(name) {
      return rpcCalls.filter((call) => call.name === name).map((call) => call.args)
    },
  }
}

/** PostgREST/Postgres errors that mean "20260818_email_credits.sql has not run". */
export const SCHEMA_MISSING_ERRORS = [
  { code: '42883', message: 'function public.sync_email_credit_allowance(...) does not exist' },
  { code: 'PGRST202', message: 'Could not find the function in the schema cache' },
  { code: '42P01', message: 'relation "public.email_credit_accounts" does not exist' },
  { code: 'PGRST205', message: "Could not find the table 'public.email_credit_accounts'" },
]
