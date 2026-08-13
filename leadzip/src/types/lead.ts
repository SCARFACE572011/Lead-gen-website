export interface Lead {
  id: string
  businessName: string
  category: string
  address: string
  city: string
  state: string
  zipCode: string
  /** ISO 3166-1 alpha-2 (uppercase) of the country this lead was found in, when
   *  the provider resolved one. Optional and additive: US ZIP searches and leads
   *  reloaded from the saved-leads table (no country column there) simply omit
   *  it, and every consumer treats a missing value as US intent — so the legacy
   *  path is unchanged. It exists so a lookup that only has a postal code, i.e.
   *  competitor analysis, does not read a 5-digit German postcode as a US ZIP
   *  and return competitors from the wrong continent. */
  countryCode?: string
  phone: string
  website: string
  rating: number | null
  reviewCount: number | null
  latitude: number | null
  longitude: number | null
  distanceMiles: number | null
  leadScore: number
  status: LeadStatus
  notes: string
  savedAt?: string
  createdAt?: string
  userId?: string
  employeeCount?: number | null
  revenueEstimate?: string | null
  facebookUrl?: string | null
  instagramUrl?: string | null
  linkedinUrl?: string | null
  sourceZip?: string
  email?: string
  emailConfidence?: 'verified' | 'likely' | 'guessed'
  digitalHealthScore?: number
  digitalHealthDetails?: DigitalHealthDetails
  openNow?: boolean
  businessHours?: string[]
  priceLevel?: number | null
  nearbyCompetitorCount?: number
  screenshotUrl?: string
  pipelineStage?: PipelineStage
  stageUpdatedAt?: string
}

export interface DigitalHealthDetails {
  hasWebsite: boolean
  hasHttps: boolean
  mobileResponsive: boolean
  hasAnalytics: boolean
  hasGoogleAds: boolean
  hasFacebookAds: boolean
  hasGBP: boolean
  hasContactForm: boolean
  fastLoad: boolean
}

export type LeadStatus = 'new' | 'contacted' | 'interested' | 'not_interested' | 'follow_up' | 'converted'

// CRM Pipeline (kanban board on /saved). Lean 7-stage funnel.
export type PipelineStage = 'new' | 'contacted' | 'replied' | 'meeting' | 'proposal' | 'won' | 'lost'

export const PIPELINE_STAGES: PipelineStage[] = ['new', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost']

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  meeting: 'Meeting',
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
}

export interface SearchParams {
  /** 5-digit US ZIP (fast path). Empty string for international searches. */
  zipCode: string
  city?: string
  state?: string
  /** Free-text location for worldwide search, e.g. "Berlin, Germany". */
  location?: string
  /** ISO 3166-1 alpha-2 country biasing geocoding and provider region hints. */
  countryCode?: string
  radiusMiles: number
  /** Radius in km (international mode). When set, providers prefer it over radiusMiles. */
  radiusKm?: number
  category: string
  keyword?: string
  minRating?: number
  minReviews?: number
  hasWebsite?: boolean
  noWebsite?: boolean
  hasPhone?: boolean
  excludeSaved?: boolean
  /** Server-internal: pre-resolved geocode attached by the search API route so
   *  providers don't geocode twice. NEVER trusted from the client — the route
   *  overwrites it before use (a spoofed value could poison the shared cache). */
  resolved?: import('@/lib/geocode').ResolvedLocation
}

export interface SearchResult {
  leads: Lead[]
  total: number
  searchId?: string
  center?: { lat: number; lon: number }
  source?: string
  /** Normalized human name of the searched location, e.g. "Berlin, Germany". */
  locationLabel?: string
}

export interface SearchHistory {
  id: string
  userId: string
  /** US ZIP, or the location text of a worldwide search ("Berlin, Germany") —
   *  search_history keeps both in the same text column. */
  zipCode: string
  /** Always integer MILES, as stored. Worldwide rows are shown in km instead. */
  radius: number
  category: string
  keyword: string
  resultCount: number
  createdAt: string
  /** ISO 3166-1 alpha-2, when known. search_history has no country column today,
   *  so this is only ever populated by inference from the location text. */
  countryCode?: string
  /** Radius in km for a worldwide row, when known. */
  radiusKm?: number
}

export interface DashboardStats {
  totalLeads: number
  savedLeads: number
  exportedLeads: number
  searchesThisMonth: number
  recentSearches: SearchHistory[]
  leadsByStatus: Record<LeadStatus, number>
  leadsByCategory: { category: string; count: number }[]
}

export const LEAD_CATEGORIES = [
  'Restaurants',
  'Dentists',
  'Law Firms',
  'Contractors',
  'Auto Shops',
  'Real Estate Agents',
  'Medical Clinics',
  'Gyms & Fitness',
  'Hair & Beauty Salons',
  'Manufacturers',
  'Distributors',
  'Plumbers',
  'Electricians',
  'Landscaping',
  'HVAC Services',
  'Cleaning Services',
  'Photographers',
  'Catering',
  'Pet Services',
  'Roofing',
  'Moving Companies',
  'Insurance Agents',
  'Accountants',
  'Chiropractors',
  'IT Services',
  'Financial Advisors',
  'Mortgage Brokers',
  'Property Management',
  'Tutoring Centers',
  'Childcare & Daycares',
  'Yoga Studios',
  'Therapy & Counseling',
  'Veterinarians',
  'Optometrists',
  'Pharmacies',
  'Event Planners',
  'Printing Services',
  'Security Companies',
  'Pest Control',
  'Pool Services',
  'Solar Installers',
  'Marketing Agencies',
  'Custom Keyword',
] as const

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  not_interested: 'Not Interested',
  follow_up: 'Follow Up',
  converted: 'Converted',
}

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  interested: 'bg-green-100 text-green-700',
  not_interested: 'bg-red-100 text-red-700',
  follow_up: 'bg-purple-100 text-purple-700',
  converted: 'bg-emerald-100 text-emerald-700',
}
