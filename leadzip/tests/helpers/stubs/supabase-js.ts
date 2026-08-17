/**
 * Unit-test stand-in for @supabase/supabase-js. The sync tests pass their own
 * in-memory stub client, so only the shape has to exist.
 */
export class SupabaseClient {}

export function createClient(): SupabaseClient {
  throw new Error('createClient is not available in unit tests.')
}
