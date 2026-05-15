import { SearchParams, SearchResult } from '@/types/lead'
import { searchLeadsGooglePlaces } from './googlePlacesProvider'
import { searchLeadsOSM } from './osmProvider'

/**
 * Combined provider: tries Google Places first (richest data — ratings, phone, website),
 * falls back to OSM (real businesses, sparse contact info),
 * which itself falls back to the dynamic regional generator.
 *
 * Activate Google Places by setting GOOGLE_PLACES_API_KEY in env.
 */
export async function searchLeadsCombined(params: SearchParams): Promise<SearchResult> {
  if (process.env.GOOGLE_PLACES_API_KEY) {
    try {
      const result = await searchLeadsGooglePlaces(params)
      if (result.leads.length > 0) return result
      // Zero results — fall through to OSM
    } catch (err) {
      console.warn('[combinedProvider] Google Places failed, falling back to OSM:', err)
    }
  }

  // OSM provider already falls back to dynamic internally when results are sparse
  return searchLeadsOSM(params)
}
