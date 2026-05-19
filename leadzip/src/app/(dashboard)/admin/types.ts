export interface UserRow {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  role: 'user' | 'admin'
  plan: 'free' | 'pro' | 'agency'
  status: 'active' | 'deactivated'
  created_at: string
  updated_at: string
  usage: {
    searches_this_month: number
    saved_leads_count: number
    exports_count: number
    last_reset_at: string
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
  companyName: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  plan: string
  status: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  createdAt: string
}

export interface BillingResponse {
  subscriptions: BillingSubscription[]
  summary: {
    mrr: number
    totalSubscribers: number
    proCount: number
    agencyCount: number
    newThisMonth: number
    churnedThisMonth: number
    conversionRate: number
  }
}

export interface TrendPoint {
  date: string
  count: number
}

export type AdminAction =
  | { type: 'set_status'; status: 'active' | 'deactivated' }
  | { type: 'set_plan'; plan: 'free' | 'pro' | 'agency' }
  | { type: 'reset_usage' }
