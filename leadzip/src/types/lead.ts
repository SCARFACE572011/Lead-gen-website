export interface Lead {
  id: string
  businessName: string
  category: string
  address: string
  city: string
  state: string
  zipCode: string
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
}

export type LeadStatus = 'new' | 'contacted' | 'interested' | 'not_interested' | 'follow_up' | 'converted'

export interface SearchParams {
  zipCode: string
  city?: string
  state?: string
  radiusMiles: number
  category: string
  keyword?: string
  minRating?: number
  hasWebsite?: boolean
  hasPhone?: boolean
  excludeSaved?: boolean
}

export interface SearchResult {
  leads: Lead[]
  total: number
  searchId?: string
  center?: { lat: number; lon: number }
}

export interface SearchHistory {
  id: string
  userId: string
  zipCode: string
  radius: number
  category: string
  keyword: string
  resultCount: number
  createdAt: string
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
