import { SearchParams, SearchResult } from '@/types/lead'
import { searchLeadsGooglePlaces } from './googlePlacesProvider'
import { searchLeadsYelp } from './yelpProvider'
import { searchLeadsHere } from './hereProvider'
import { searchLeadsTomTom } from './tomtomProvider'
import { searchLeadsOSM } from './osmProvider'

/**
 * Combined provider — tries each source in order, returns the first that succeeds with results.
 *
 * Priority:
 * 1. Google Places  (richest data — if GOOGLE_PLACES_API_KEY is set)
 * 2. Yelp           (high-quality local business data — if YELP_API_KEY is set)
 * 3. Here Places    (free 1,000/day — if HERE_API_KEY is set)
 * 4. TomTom         (free 2,500/day — if TOMTOM_API_KEY is set)
 * 5. OpenStreetMap  (free, no key — real businesses, sparse contact info)
 */
export async function searchLeadsCombined(params: SearchParams): Promise<SearchResult> {
  // 1. Google Places
  if (process.env.GOOGLE_PLACES_API_KEY) {
    try {
      const result = await searchLeadsGooglePlaces(params)
      if (result.leads.length > 0) return { ...result, source: 'google_places' }
    } catch (err) {
      console.warn('[combinedProvider] Google Places failed:', err)
    }
  }

  // 2. Yelp
  if (process.env.YELP_API_KEY) {
    try {
      const result = await searchLeadsYelp(params)
      if (result.leads.length > 0) return { ...result, source: 'yelp' }
    } catch (err) {
      console.warn('[combinedProvider] Yelp failed:', err)
    }
  }

  // 3. Here Places
  if (process.env.HERE_API_KEY) {
    try {
      const result = await searchLeadsHere(params)
      if (result.leads.length > 0) return { ...result, source: 'here' }
    } catch (err) {
      console.warn('[combinedProvider] Here failed:', err)
    }
  }

  // 4. TomTom
  if (process.env.TOMTOM_API_KEY) {
    try {
      const result = await searchLeadsTomTom(params)
      if (result.leads.length > 0) return { ...result, source: 'tomtom' }
    } catch (err) {
      console.warn('[combinedProvider] TomTom failed:', err)
    }
  }

  // 5. OSM (falls back to dynamic internally, which sets source: 'demo')
  return searchLeadsOSM(params)
}
