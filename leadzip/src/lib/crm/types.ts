export interface CrmLead {
  businessName: string
  phone?: string
  website?: string
  email?: string
  address?: string
  city?: string
  state?: string
  category?: string
}

export interface CrmResult {
  success: boolean
  id?: string
  error?: string
}

export interface CrmExportResult {
  total: number
  succeeded: number
  failed: number
  errors: string[]
}
