import { SearchParams, SearchResult } from '@/types/lead'
import { searchLeadsMock } from './mockProvider'
import { searchLeadsOSM } from './osmProvider'
import { searchLeadsDynamic } from './dynamicProvider'
import { searchLeadsGooglePlaces } from './googlePlacesProvider'
import { searchLeadsCombined } from './combinedProvider'

export type ProviderName = 'mock' | 'google_places' | 'yelp' | 'openstreetmap' | 'dynamic' | 'combined'

// 'combined' = Google Places (if key set) → OSM → Dynamic fallback chain
const ACTIVE_PROVIDER: ProviderName = 'combined'

export async function searchLeads(params: SearchParams): Promise<SearchResult> {
  switch (ACTIVE_PROVIDER) {
    case 'combined':
      return searchLeadsCombined(params)
    case 'google_places':
      return searchLeadsGooglePlaces(params)
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
