/**
 * Unit-test stand-in for @/lib/requireActiveUser. The authentication gate has
 * its own coverage; the money-handling route tests only need a caller identity.
 */
export async function requireActiveUser(): Promise<unknown> {
  const installed = (globalThis as { __leadzipAuthStub?: unknown }).__leadzipAuthStub
  if (!installed) throw new Error('No auth stub is installed for this test.')
  return installed
}
