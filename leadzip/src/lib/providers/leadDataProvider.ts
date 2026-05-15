import { SearchParams, SearchResult } from '@/types/lead'
import { searchLeadsMock } from './mockProvider'
import { searchLeadsOSM } from './osmProvider'

// PROVIDER ABSTRACTION — swap out for real APIs later:
// Google Places API: https://maps.googleapis.com/maps/api/place/nearbysearch/json
// Yelp Fusion API: https://api.yelp.com/v3/businesses/search
// OpenStreetMap/Overpass: https://overpass-api.de/api/interpreter (active)

export type ProviderName = 'mock' | 'google_places' | 'yelp' | 'openstreetmap'

const ACTIVE_PROVIDER: ProviderName = 'openstreetmap'

export async function searchLeads(params: SearchParams): Promise<SearchResult> {
  switch (ACTIVE_PROVIDER) {
    case 'openstreetmap':
      return searchLeadsOSM(params)
    case 'mock':
      return searchLeadsMock(params)
    default:
      return searchLeadsMock(params)
  }
}
