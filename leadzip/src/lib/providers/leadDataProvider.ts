import { SearchParams, SearchResult } from '@/types/lead'
import { searchLeadsMock } from './mockProvider'
import { searchLeadsOSM } from './osmProvider'
import { searchLeadsDynamic } from './dynamicProvider'
import { searchLeadsGooglePlaces } from './googlePlacesProvider'
import { searchLeadsFoursquare } from './foursquareProvider'
import { searchLeadsCombined } from './combinedProvider'

export type ProviderName =
  | 'mock'
  | 'google_places'
  | 'foursquare'
  | 'yelp'
  | 'openstreetmap'
  | 'dynamic'
  | 'combined'

// 'combined' = Google Places → Foursquare → OSM → Dynamic (auto-selects based on available keys)
const ACTIVE_PROVIDER: ProviderName = 'combined'

export async function searchLeads(params: SearchParams): Promise<SearchResult> {
  switch (ACTIVE_PROVIDER) {
    case 'combined':
      return searchLeadsCombined(params)
    case 'google_places':
      return searchLeadsGooglePlaces(params)
    case 'foursquare':
      return searchLeadsFoursquare(params)
    case 'openstreetmap':
      return searchLeadsOSM(params)
    case 'dynamic':
      return searchLeadsDynamic(params)
    case 'mock':
      return searchLeadsMock(params)
    default:
      return searchLeadsCombined(params)
  }
}
