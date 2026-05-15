import { SearchParams, SearchResult } from '@/types/lead'
import { searchLeadsMock } from './mockProvider'
import { searchLeadsOSM } from './osmProvider'
import { searchLeadsDynamic } from './dynamicProvider'

// PROVIDER ABSTRACTION — swap out for real APIs later:
// Google Places API: https://maps.googleapis.com/maps/api/place/nearbysearch/json
// Yelp Fusion API: https://api.yelp.com/v3/businesses/search
// OpenStreetMap/Overpass: https://overpass-api.de/api/interpreter (optional)
// Dynamic (ZIP-seeded, no external deps): active

export type ProviderName = 'mock' | 'google_places' | 'yelp' | 'openstreetmap' | 'dynamic'

const ACTIVE_PROVIDER: ProviderName = 'dynamic'

export async function searchLeads(params: SearchParams): Promise<SearchResult> {
  switch (ACTIVE_PROVIDER) {
    case 'dynamic':
      return searchLeadsDynamic(params)
    case 'openstreetmap':
      return searchLeadsOSM(params)
    case 'mock':
      return searchLeadsMock(params)
    default:
      return searchLeadsDynamic(params)
  }
}
