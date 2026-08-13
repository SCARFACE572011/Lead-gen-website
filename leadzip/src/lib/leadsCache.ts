/**
 * Single source of truth for the `leads_cache` pool: its key format and its TTL.
 *
 * WHY THIS MODULE EXISTS
 * Five call sites read or write leads_cache (the interactive search route, the v1
 * public API, Market Gaps, the alert-digest cron and the prefetch cron). Each one
 * used to hand-roll its own key builder and its own TTL constant, and they had
 * silently drifted apart:
 *   - prefetch wrote a 24h TTL into rows every other module treated as 12h, which
 *     also made the search route's "fetchedAt = expires_at - TTL" freshness badge
 *     report a cron-warmed row as 12 hours newer than it really was.
 *   - alert-digest only knew the legacy ZIP key shape, so an international saved
 *     search built "Berlin, Germany|Plumbers|6" — a key no interactive search can
 *     ever produce, so every nightly run re-billed the paid provider and shared
 *     nothing back.
 * Importing from here is the only supported way to touch leads_cache.
 *
 * BACKWARD COMPATIBILITY
 * buildCacheKey reproduces the legacy ZIP key byte for byte, so every warmed row in
 * production stays readable. Do not change the ZIP branch without a cache flush.
 */

/**
 * Cache TTL for the leads_cache pool. Every cache MISS hits the paid Google Places
 * API (~$0.10/search), so a longer TTL directly protects gross margin. 12h keeps
 * repeat prospecting and saved-search workflows on cached data for a full work day
 * while staying fresh enough that listings do not go stale.
 *
 * This value is load-bearing beyond expiry: the search route derives a row's
 * fetched-at time as `expires_at - CACHE_TTL_MS` for the UI freshness badge
 * (leads_cache has no fetched_at column), so every writer must use this constant
 * or that derived timestamp lies.
 */
export const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

/**
 * Structural subset of SearchParams that determines a cache key. Declared as its
 * own interface so callers that only have a ZIP and a category (Market Gaps, the
 * prefetch cron) can build a key without fabricating a full SearchParams.
 */
export interface CacheKeyParams {
  zipCode?: string
  /** Free-text location for worldwide search, e.g. "Berlin, Germany". */
  location?: string
  /** ISO 3166-1 alpha-2, e.g. "DE". Namespaces the international key. */
  countryCode?: string
  radiusMiles?: number
  /** Radius in km (international mode). Preferred over radiusMiles when set. */
  radiusKm?: number
  category?: string
  keyword?: string
}

/**
 * Build the leads_cache key for a search.
 *
 * The key is deliberately FILTER-AGNOSTIC: refinement filters (minRating,
 * hasWebsite, noWebsite, hasPhone, minReviews) are NOT part of it, because the
 * cached value is the raw provider POOL and those filters are applied to that pool
 * per request. That is what makes refining a search a cache HIT instead of a new
 * billable fetch — and it is why callers must never send those filters to the
 * provider on a path whose results get cached, or the "raw" pool is pre-narrowed
 * and every later reader of the key silently inherits someone else's filter.
 *
 * EXCEPTION: for a "Custom Keyword" search the keyword IS the query — providers
 * fetch a completely different pool per keyword — so it MUST be part of the key,
 * or a "sushi" pool would be served for a later "plumbers" search on the same ZIP.
 * Normal category keys stay keyword-free so existing cache entries still hit.
 *
 * Two shapes, which can never collide:
 *   legacy ZIP  `{zip}|{category}|{radiusMiles}`            e.g. `30301|Plumbers|25`
 *   worldwide   `intl:{cc}:{location}|{category}|{km}km`    e.g. `intl:de:berlin,germany|Plumbers|10km`
 * plus `|{keyword}` appended to either when category is "Custom Keyword".
 *
 * The worldwide key is derived from the normalized request text alone (no
 * geocoding needed to check the cache) and the "intl:" prefix keeps it out of the
 * legacy ZIP namespace.
 */
export function buildCacheKey(params: CacheKeyParams): string {
  const cat = (params.category || '').trim()
  const kwSuffix =
    cat === 'Custom Keyword' ? `|${(params.keyword || '').trim().toLowerCase()}` : ''

  const location = (params.location ?? '').trim()
  if (location) {
    const norm = location.toLowerCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',')
    const cc = (params.countryCode ?? '').trim().toLowerCase()
    const km = params.radiusKm ?? Math.round((params.radiusMiles ?? 25) * 1.60934)
    return `intl:${cc}:${norm}|${cat}|${km}km${kwSuffix}`
  }

  const zip = (params.zipCode ?? '').trim()
  const radius = params.radiusMiles ?? 25
  return `${zip}|${cat}|${radius}${kwSuffix}`
}
