/**
 * Configurable unit-test stand-in for the Stripe SDK.
 *
 * The module graph is loaded from data: URLs, so a test cannot reach into this
 * file by path to swap an implementation. Behaviour is therefore read from a
 * registry the test installs on globalThis before invoking the route, and any
 * call the test did not explicitly script throws instead of returning
 * undefined. That is deliberate: silently answering a money-handling call with
 * undefined is exactly how a test starts lying about what the code does.
 */
type StripeHandler = (...args: unknown[]) => unknown
type StripeHandlers = Record<string, StripeHandler>

function registry(): StripeHandlers {
  const installed = (globalThis as { __leadzipStripeStub?: StripeHandlers })
    .__leadzipStripeStub
  if (!installed) throw new Error('No Stripe stub is installed for this test.')
  return installed
}

function call(name: string, ...args: unknown[]): unknown {
  const handler = registry()[name]
  if (!handler) throw new Error(`Stripe stub has no handler for ${name}.`)
  return handler(...args)
}

/**
 * No constructor: the routes call `new Stripe(secretKey, { apiVersion })` and
 * JavaScript discards arguments a constructor does not declare, so the stub
 * stays argument-compatible without carrying unused parameters.
 */
export default class Stripe {
  webhooks = {
    constructEvent: (...args: unknown[]) => call('webhooks.constructEvent', ...args),
  }

  checkout = {
    sessions: {
      retrieve: (...args: unknown[]) => call('checkout.sessions.retrieve', ...args),
      create: (...args: unknown[]) => call('checkout.sessions.create', ...args),
    },
  }

  subscriptions = {
    retrieve: (...args: unknown[]) => call('subscriptions.retrieve', ...args),
  }

  disputes = {
    retrieve: (...args: unknown[]) => call('disputes.retrieve', ...args),
  }

  paymentIntents = {
    retrieve: (...args: unknown[]) => call('paymentIntents.retrieve', ...args),
  }

  charges = {
    retrieve: (...args: unknown[]) => call('charges.retrieve', ...args),
  }

  prices = {
    retrieve: (...args: unknown[]) => call('prices.retrieve', ...args),
  }

  customers = {
    retrieve: (...args: unknown[]) => call('customers.retrieve', ...args),
  }
}
