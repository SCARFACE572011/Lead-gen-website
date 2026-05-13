import { SearchParams, SearchResult } from '@/types/lead'
import { searchLeadsMock } from './mockProvider'

// PROVIDER ABSTRACTION — swap out for real APIs later:
// Google Places API: https://maps.googleapis.com/maps/api/place/nearbysearch/json
// Yelp Fusion API: https://api.yelp.com/v3/businesses/search
// OpenStreetMap/Overpass: https://overpass-api.de/api/interpreter

export type ProviderName = 'mock' | 'google_places' | 'yelp' | 'openstreetmap'

const ACTIVE_PROVIDER: ProviderName = 'mock' // Change this to switch providers

export async function searchLeads(params: SearchParams): Promise<SearchResult> {
  switch (ACTIVE_PROVIDER) {
    case 'mock':
      return searchLeadsMock(params)
    // case 'google_places':
    //   return searchLeadsGooglePlaces(params) // TODO: implement
    // case 'yelp':
    //   return searchLeadsYelp(params) // TODO: implement
    default:
      return searchLeadsMock(params)
  }
}
