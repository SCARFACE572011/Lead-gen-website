export interface UserRow {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  role: 'user' | 'admin'
  plan: 'free' | 'pro' | 'agency'
  status: 'active' | 'deactivated'
  admin_notes: string
  created_at: string
  usage: {
    searches_this_month: number
    saved_leads_count: number
    exports_count: number
    last_reset_at: string | null
  } | null
  subscription: {
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    plan: string
    status: string
    current_period_start: string | null
    current_period_end: string | null
  } | null
}

export interface UsersResponse {
  users: UserRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface BillingSubscription {
  id: string
  userId: string
  email: string
  fullName: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  plan: string
  status: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  createdAt: string
}

export interface TrendPoint {
  date: string
  count: number
}

export interface MrrPoint {
  month: string
  mrr: number
}

export type AdminAction =
  | { type: 'set_status'; status: 'active' | 'deactivated' }
  | { type: 'set_plan'; plan: 'free' | 'pro' | 'agency' }
  | { type: 'reset_usage' }
  | { type: 'update_notes'; notes: string }

export interface AtRiskUser {
  id: string
  email: string
  full_name: string | null
  plan: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
  searches_this_month?: number
  last_search_at?: string | null
}
