export interface SavedSearch {
  id: string
  userId: string
  name: string
  /** US ZIP, or the free-text location of a worldwide search ("Berlin, Germany"). */
  zip: string
  /** Legacy radius column: always integer MILES. Kept for US ZIP searches. */
  radius: number
  category: string
  keyword?: string
  /** ISO 3166-1 alpha-2 the search was run with. Absent for legacy rows and for
   *  US ZIP searches, where "no country" already means US. Undefined whenever the
   *  saved_searches.country_code column has not been migrated in yet. */
  countryCode?: string
  /** Canonical radius in km for worldwide searches. Preferred over `radius` when
   *  present, because km -> integer miles -> km does not round-trip (25 km would
   *  come back as 26 km and miss the cache pool). Undefined until the
   *  saved_searches.radius_km column has been migrated in. */
  radiusKm?: number
  alertEnabled: boolean
  lastPlaceIds: string[]
  lastRunAt?: string
  createdAt: string
}
