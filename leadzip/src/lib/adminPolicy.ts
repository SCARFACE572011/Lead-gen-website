export interface PlatformAdminProfile {
  role?: unknown
  status?: unknown
}

function normalizedEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/** Pure policy decision kept separate so owner access can be regression-tested. */
export function isPlatformAdminRecord(
  profile: PlatformAdminProfile | null | undefined,
  allowlistedEmail: unknown,
  requestedEmail: unknown
): boolean {
  const email = normalizedEmail(requestedEmail)
  return (
    email.length > 0 &&
    profile?.role === 'admin' &&
    profile?.status !== 'deactivated' &&
    normalizedEmail(allowlistedEmail) === email
  )
}
