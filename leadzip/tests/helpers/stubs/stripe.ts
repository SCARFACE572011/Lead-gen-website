/**
 * Unit-test stand-in for the Stripe SDK.
 *
 * subscriptionSync.ts imports Stripe for its types and only constructs a client
 * inside confirmCheckoutSession, which the sync tests never call. The stub
 * exists so the module can be loaded without the real SDK.
 */
export default class Stripe {}
