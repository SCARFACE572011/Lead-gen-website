import { SearchParams, SearchResult } from '@/types/lead'
import { searchLeadsGooglePlaces } from './googlePlacesProvider'
import { searchLeadsFoursquare } from './foursquareProvider'
import { searchLeadsOSM } from './osmProvider'

/**
 * Combined provider — tries each source in order, returns the first that succeeds with results.
 *
 * Priority:
 * 1. Google Places  (richest data — if GOOGLE_PLACES_API_KEY is set)
 * 2. Foursquare     (free 1,000/day — ratings, phone, website — if FOURSQUARE_API_KEY is set)
 * 3. OpenStreetMap  (free, no key — real businesses, sparse contact info)
 * 4. Dynamic        (always works — regional deterministic fallback, built into OSM provider)
 */
export async function searchLeadsCombined(params: SearchParams): Promise<SearchResult> {
  // 1. Google Places
  if (process.env.GOOGLE_PLACES_API_KEY) {
    try {
      const result = await searchLeadsGooglePlaces(params)
      if (result.leads.length > 0) return result
    } catch (err) {
      console.warn('[combinedProvider] Google Places failed:', err)
    }
  }

  // 2. Foursquare
  if (process.env.FOURSQUARE_API_KEY) {
    try {
      const result = await searchLeadsFoursquare(params)
      if (result.leads.length > 0) return result
    } catch (err) {
      console.warn('[combinedProvider] Foursquare failed:', err)
    }
  }

  // 3. OSM (falls back to dynamic internally)
  return searchLeadsOSM(params)
}
