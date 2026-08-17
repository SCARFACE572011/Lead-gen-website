/**
 * Unit-test stand-in for @/lib/supabase/server. Route handlers pass the result
 * straight to the auth gate, which is itself stubbed, so an inert object is
 * enough and avoids pulling next/headers into the test process.
 */
export async function createClient(): Promise<unknown> {
  return {}
}
