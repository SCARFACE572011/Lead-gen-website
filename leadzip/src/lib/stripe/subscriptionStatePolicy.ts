export interface StoredSubscriptionState {
  subscriptionId: string | null
  status: string | null
  orderingVersion: number
  subscriptionCreated: number
}

export interface IncomingSubscriptionState {
  subscriptionId: string
  status: string
  eventCreated: number
  subscriptionCreated: number
}

export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing'
}

/**
 * Stripe spells the terminal state 'canceled'. Everything in this app that
 * reads subscriptions.status back for reporting uses the British 'cancelled'
 * (the admin billing churn metric filters on it, and both admin status badge
 * maps list it first), so a raw Stripe write made churn report zero forever.
 * Normalizing on write is the only side available to the webhook, and it keeps
 * one spelling in the column instead of two. Access checks are unaffected:
 * neither spelling is an active status.
 */
export function persistedSubscriptionStatus(status: string): string {
  return status === 'canceled' ? 'cancelled' : status
}

/** Inactive wins when Stripe emits two opposite states in the same second. */
export function subscriptionOrderingVersion(eventCreated: number, status: string): number {
  return eventCreated * 2 + (isActiveSubscriptionStatus(status) ? 0 : 1)
}

/** Pure stale-state decision; the database update adds a compare-and-swap fence. */
export function shouldApplySubscriptionState(
  existing: StoredSubscriptionState,
  incoming: IncomingSubscriptionState
): boolean {
  const sameSubscription = existing.subscriptionId === incoming.subscriptionId
  const incomingVersion = subscriptionOrderingVersion(
    incoming.eventCreated,
    incoming.status
  )

  if (sameSubscription) {
    if (incomingVersion < existing.orderingVersion) return false
    if (
      incomingVersion === existing.orderingVersion &&
      isActiveSubscriptionStatus(incoming.status) &&
      !isActiveSubscriptionStatus(existing.status)
    ) {
      return false
    }
    return true
  }

  if (incoming.subscriptionCreated !== existing.subscriptionCreated) {
    return incoming.subscriptionCreated > existing.subscriptionCreated
  }
  return incomingVersion >= existing.orderingVersion
}
