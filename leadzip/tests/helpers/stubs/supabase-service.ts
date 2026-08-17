/**
 * Unit-test stand-in for @supabase/supabase-js when the code under test calls
 * createClient() itself (the Stripe webhook builds its own service-role
 * client). The test installs the in-memory database on globalThis first.
 */
export class SupabaseClient {}

export function createClient(): unknown {
  const installed = (globalThis as { __leadzipSupabaseStub?: unknown })
    .__leadzipSupabaseStub
  if (!installed) throw new Error('No Supabase stub is installed for this test.')
  return installed
}
