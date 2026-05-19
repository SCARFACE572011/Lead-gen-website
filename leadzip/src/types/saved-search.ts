export interface SavedSearch {
  id: string
  userId: string
  name: string
  zip: string
  radius: number
  category: string
  keyword?: string
  alertEnabled: boolean
  lastPlaceIds: string[]
  lastRunAt?: string
  createdAt: string
}
