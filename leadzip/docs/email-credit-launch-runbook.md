# Email credit launch runbook

The application code is safe to deploy with pack sales disabled. Do not enable
one-time packs until LeadZipp has written permission for its intended embedded
or resale use of the email-data provider.

## Product policy

| Account state | Included Email Finder credits |
| --- | ---: |
| Free | 5 lifetime |
| Pro trial | 20 for the trial |
| Agency trial | 50 shared for the trial |
| Pro active | 100 per calendar month |
| Agency active | 500 per calendar month, shared by the workspace |

Those numbers are not maintained here. They come from
`PLAN_POLICY[plan].includedEmailCredits` in `src/lib/planPolicy.ts` and
`EMAIL_CREDIT_TRIAL_ALLOWANCES` in `src/lib/emailCreditPolicy.ts`, which is what
`resolveEmailCreditContext` in `src/lib/emailCredits.ts` reads. Change them
there first, then mirror the change into this table and the marketing copy.

Unused included credits do not roll over. Purchased credits persist and are
spent after included credits. A successful provider result costs one credit.
Cached results, provider failures, no-results and `info@domain` guesses are free.
Successful results refresh after 90 days; guesses refresh after 30 days.
Only an active Agency workspace owner supplies a shared pool. The platform-owner
exception requires both an active `role = 'admin'` profile and a matching row in
the locked `admin_allowlist`; the role by itself grants nothing here.

## Required deployment order

1. Apply all pending migrations in filename order, including the product and
   subscription-state prerequisites (`20260815` through `20260817`), then
   `supabase/migrations/20260818_email_credits.sql`, to production Supabase.
   Apply them before deploying the routes; until the credit RPCs exist the
   Email Finder deliberately returns `503` rather than spend an unmetered
   provider credit.
2. Deploy the application with `EMAIL_CREDIT_PACKS_ENABLED` unset or `false`.
3. Confirm the existing subscription Stripe Price environment variables are
   present and unique:
   - `STRIPE_PRICE_PRO_MONTHLY`
   - `STRIPE_PRICE_PRO_ANNUAL`
   - `STRIPE_PRICE_AGENCY_MONTHLY`
   - `STRIPE_PRICE_AGENCY_ANNUAL`
4. Keep every existing Stripe webhook event and add every event the handler in
   `src/app/api/stripe/webhook/route.ts` now switches on. Subscribing to only
   part of the dispute lifecycle leaves clawbacks half-applied:
   - `checkout.session.async_payment_succeeded`
   - `refund.created`
   - `refund.updated`
   - `charge.dispute.created`
   - `charge.dispute.updated`
   - `charge.dispute.closed`
   - `charge.dispute.funds_withdrawn`
   - `charge.dispute.funds_reinstated`
5. After provider permission is confirmed, create three one-time, non-recurring
   Stripe Prices in USD. The amounts must match exactly:
   - 50 credits: `$9.00` -> `STRIPE_PRICE_EMAIL_CREDITS_50`
   - 250 credits: `$29.00` -> `STRIPE_PRICE_EMAIL_CREDITS_250`
   - 1,000 credits: `$79.00` -> `STRIPE_PRICE_EMAIL_CREDITS_1000`
6. Add those Price IDs to Vercel Production (and separate test-mode IDs to
   Preview/Development). The server retrieves each Price and rejects inactive,
   recurring, wrong-currency or wrong-amount configuration.
7. Set `EMAIL_CREDIT_PACKS_ENABLED=true` and redeploy only after the preceding
   checks pass. The client sends only a pack slug; quantity, credits, amount and
   Stripe Price are selected and re-verified server-side.

Turning the flag off immediately stops new pack checkout. A Checkout Session
that Stripe has already marked paid is still fulfilled so a configuration
change cannot take a customer's money without delivering their credits.

## Smoke-test matrix

Use Stripe test mode before enabling production packs.

1. `GET /api/credits/email` as a new Free user returns `totalRemaining: 5`.
2. A Hunter result from `POST /api/leads/enrich/email` returns
   `creditCharged: true`, `source: "hunter"`, confidence, and a balance reduced
   by one.
3. Repeat the same domain. It returns `cached: true`, `creditCharged: false`,
   and an unchanged balance. Two simultaneous first requests must result in only
   one provider call/charge; the follower returns the cached result or a brief
   `lookupPending` response.
4. A provider no-result or failure returns the free guessed address with
   `creditCharged: false` and restores the reservation.
5. Pro/Agency trials show 20/50. Active Pro/Agency show 100/500. An annual
   subscription still receives only the monthly allowance.
6. An Agency owner and member receive the same `ownerId` and consume one shared
   500-credit pool. A member whose owner is no longer Agency/admin falls back to
   their own active subscription or Free balance.
7. With packs disabled, the checkout route returns `503`. With test packs
   enabled, buy each pack and replay the same `checkout.session.completed`
   event; the balance increases exactly once.
8. Create a partial refund and then a dispute for the same PaymentIntent.
   Credits are clawed back proportionally without double-counting overlapping
   refund/dispute amounts. A failed refund or reinstated dispute reverses its
   adjustment. Used refunded credits become debt and offset future grants.

## Database verification

Run these read-only checks in the Supabase SQL editor after the smoke tests:

```sql
select owner_id, included_balance, purchased_balance, allowance_plan,
       allowance_key, allowance_ends_at
from public.email_credit_accounts
order by updated_at desc;

select owner_id, actor_user_id, entry_type, included_delta, purchased_delta,
       idempotency_key, lookup_domain, created_at
from public.email_credit_ledger
order by created_at desc
limit 100;

select stripe_checkout_session_id, stripe_payment_intent_id, pack_slug,
       credits, revoked_credits, amount_paid, currency
from public.email_credit_purchases
order by created_at desc;
```

The tables and RPCs have no authenticated-client policies or grants. All reads
and writes go through authenticated application routes using the service role.
