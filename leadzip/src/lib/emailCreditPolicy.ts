export const EMAIL_CREDIT_TRIAL_ALLOWANCES: Readonly<
  Record<'pro' | 'agency', number>
> = {
  pro: 20,
  agency: 50,
}

export interface EmailCreditPackDefinition {
  slug: '50' | '250' | '1000'
  credits: number
  amountCents: number
  envName:
    | 'STRIPE_PRICE_EMAIL_CREDITS_50'
    | 'STRIPE_PRICE_EMAIL_CREDITS_250'
    | 'STRIPE_PRICE_EMAIL_CREDITS_1000'
}

/** Public economics only. Stripe Price IDs remain private environment config. */
export const EMAIL_CREDIT_PACK_DEFINITIONS: readonly EmailCreditPackDefinition[] = [
  {
    slug: '50',
    credits: 50,
    amountCents: 900,
    envName: 'STRIPE_PRICE_EMAIL_CREDITS_50',
  },
  {
    slug: '250',
    credits: 250,
    amountCents: 2_900,
    envName: 'STRIPE_PRICE_EMAIL_CREDITS_250',
  },
  {
    slug: '1000',
    credits: 1_000,
    amountCents: 7_900,
    envName: 'STRIPE_PRICE_EMAIL_CREDITS_1000',
  },
] as const

/**
 * Resolve a pack from its slug alone, with no environment lookup.
 *
 * Fulfillment of an already-paid Checkout Session must use this, not the live
 * Price ID map: rotating or removing a Stripe Price would otherwise strand a
 * purchase the customer has already been charged for. The slug is recorded on
 * the Session at purchase time and the economics below live in code.
 */
export function emailCreditPackDefinitionBySlug(
  slug: unknown
): EmailCreditPackDefinition | null {
  if (typeof slug !== 'string') return null
  return EMAIL_CREDIT_PACK_DEFINITIONS.find((pack) => pack.slug === slug) ?? null
}
