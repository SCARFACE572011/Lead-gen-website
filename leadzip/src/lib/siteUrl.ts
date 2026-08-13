/**
 * Canonical public origin for LeadZipp.
 *
 * NEXT_PUBLIC_SITE_URL is trusted only when it names a real branded host.
 * Deployment hostnames (*.vercel.app) are rejected because they leak into
 * places where the wrong origin is not merely cosmetic:
 *   - Stripe success/cancel and billing-portal return URLs. Auth cookies are
 *     scoped to leadzipp.com, so bouncing a paying customer to the deployment
 *     host lands them on a logged-out dashboard right after they pay.
 *   - Password reset and workspace invite links sent by email.
 *   - Canonical/OG URLs and the sitemap, which would split ranking signals
 *     across two domains.
 *
 * Production env carried the legacy leadzip.vercel.app value long after
 * leadzipp.com went live, so the fallback is the safe default rather than the
 * exception.
 */
const CANONICAL_ORIGIN = 'https://leadzipp.com'

function resolveSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '')
  if (!raw) return CANONICAL_ORIGIN

  let host: string
  try {
    host = new URL(raw).hostname
  } catch {
    return CANONICAL_ORIGIN
  }

  // Keep localhost usable for local development.
  if (host === 'localhost' || host === '127.0.0.1') return raw

  if (!raw.startsWith('https://')) return CANONICAL_ORIGIN
  if (/\.vercel\.app$/i.test(host)) return CANONICAL_ORIGIN

  return raw
}

export const SITE_URL = resolveSiteUrl()
