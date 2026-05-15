import { SearchParams, SearchResult } from '@/types/lead'
import { searchLeadsMock } from './mockProvider'
import { searchLeadsOSM } from './osmProvider'
import { searchLeadsDynamic } from './dynamicProvider'
import { searchLeadsGooglePlaces } from './googlePlacesProvider'

// PROVIDER ABSTRACTION — swap out for real APIs later:
// Google Places API: set ACTIVE_PROVIDER = 'google_places' and add GOOGLE_PLACES_API_KEY to .env.local
// Yelp Fusion API: https://api.yelp.com/v3/businesses/search
// OpenStreetMap/Overpass: https://overpass-api.de/api/interpreter (optional)
// Dynamic (ZIP-seeded, no external deps): active

export type ProviderName = 'mock' | 'google_places' | 'yelp' | 'openstreetmap' | 'dynamic'

const ACTIVE_PROVIDER: ProviderName = 'openstreetmap'

export async function searchLeads(params: SearchParams): Promise<SearchResult> {
  switch (ACTIVE_PROVIDER) {
    case 'google_places':
      return searchLeadsGooglePlaces(params)
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
