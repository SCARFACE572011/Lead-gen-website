-- Durable Email Finder credits, shared at the billing-owner level.
--
-- Product policy:
--   Free   5 lifetime credits
--   Pro    100 credits per calendar month (20 total during a trial)
--   Agency 500 shared credits per calendar month (50 total during a trial)
--   Purchased packs do not reset. They are spent after included credits.
--
-- All mutations happen through service-role-only RPCs. The API resolves an
-- Agency member to the workspace owner before calling these functions, which
-- prevents every invited seat from receiving a separate allowance.

create table if not exists public.email_credit_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  included_balance integer not null default 0 check (included_balance >= 0),
  -- This may be negative after a refund/chargeback if purchased credits were
  -- already used. The debt offsets future included or purchased credits.
  purchased_balance integer not null default 0,
  allowance_key text,
  allowance_plan text not null default 'free'
    check (allowance_plan in ('free', 'pro', 'agency')),
  allowance_size integer not null default 0 check (allowance_size >= 0),
  allowance_ends_at timestamptz,
  -- Stripe event.created (seconds) when the allowance came from a webhook.
  -- Lazy API syncs leave this unchanged, so delayed older webhook deliveries
  -- cannot roll a newer trial/plan/cancellation decision backward.
  allowance_version bigint,
  -- Bumped on every allowance key transition. It makes the expire/restore audit
  -- rows unique per transition, so an account that moves off a period key and
  -- back again (a recovering past_due, an out-of-order webhook) records every
  -- move instead of silently colliding on an idempotency key.
  allowance_epoch bigint not null default 0,
  free_lifetime_granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `create table if not exists` above is a no-op against a database that already
-- has an earlier revision of this migration, so later columns are added here.
-- Both statements are idempotent and safe to re-run inside one transaction.
alter table public.email_credit_accounts
  add column if not exists allowance_epoch bigint not null default 0;

create table if not exists public.email_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entry_type text not null check (entry_type in (
    'allowance_grant',
    'allowance_expire',
    'lookup_charge',
    'lookup_refund',
    'pack_grant',
    'pack_adjustment'
  )),
  included_delta integer not null default 0,
  purchased_delta integer not null default 0,
  idempotency_key text not null,
  lookup_domain text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create index if not exists email_credit_ledger_owner_created_idx
  on public.email_credit_ledger (owner_id, created_at desc);

-- Answers "has this owner already paid for this domain?" on the cached-read
-- path without scanning the owner's whole ledger.
create index if not exists email_credit_ledger_owner_domain_idx
  on public.email_credit_ledger (owner_id, lookup_domain)
  where lookup_domain is not null;

-- A global, server-only cache prevents the same domain from consuming another
-- LeadZipp credit or another Hunter lookup. Successful provider results are
-- refreshed after 90 days so stale contacts do not live forever. Guesses have
-- a shorter expiry so a transient no-result does not permanently downgrade a
-- domain to info@domain.
create table if not exists public.email_lookup_cache (
  domain text primary key,
  state text not null check (state in ('pending', 'found', 'guessed')),
  email text,
  confidence text check (confidence is null or confidence in ('verified', 'likely', 'guessed')),
  source text check (source is null or source in ('hunter', 'guess')),
  claim_token uuid,
  completion_token uuid,
  reservation_ledger_id uuid references public.email_credit_ledger(id) on delete set null,
  claimed_by uuid references auth.users(id) on delete set null,
  lease_expires_at timestamptz,
  result_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (state = 'pending' and claim_token is not null and lease_expires_at is not null)
    or
    (state in ('found', 'guessed') and email is not null and confidence is not null and source is not null)
  )
);

create table if not exists public.email_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text not null unique,
  stripe_price_id text not null,
  pack_slug text not null,
  credits integer not null check (credits > 0),
  amount_paid integer not null check (amount_paid > 0),
  currency text not null,
  revoked_credits integer not null default 0 check (revoked_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Logical refund/dispute sources. The adjustment RPC derives the effective
-- clawback from active sources, avoiding a double clawback when a charge is
-- both disputed and refunded.
create table if not exists public.email_credit_purchase_adjustments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.email_credit_purchases(id) on delete cascade,
  source_type text not null check (source_type in ('refund', 'dispute')),
  source_id text not null,
  amount_cents integer not null check (amount_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_id, source_type, source_id)
);

alter table public.email_credit_accounts enable row level security;
alter table public.email_credit_ledger enable row level security;
alter table public.email_lookup_cache enable row level security;
alter table public.email_credit_purchases enable row level security;
alter table public.email_credit_purchase_adjustments enable row level security;

-- There are intentionally no client policies. Balance, ledger, cached contact
-- data and purchase rows are exposed only through authenticated app routes.
revoke all on public.email_credit_accounts from anon, authenticated;
revoke all on public.email_credit_ledger from anon, authenticated;
revoke all on public.email_lookup_cache from anon, authenticated;
revoke all on public.email_credit_purchases from anon, authenticated;
revoke all on public.email_credit_purchase_adjustments from anon, authenticated;

-- Synchronize the included allowance. The server supplies the already-resolved
-- billing owner, effective plan and an immutable period key. Short advisory
-- locking makes resets safe against simultaneous lookups and Stripe retries.
create or replace function public.sync_email_credit_allowance(
  p_owner_id uuid,
  p_plan text,
  p_allowance_key text,
  p_allowance_size integer,
  p_allowance_ends_at timestamptz default null,
  p_source_version bigint default null
)
returns table (
  included_remaining integer,
  purchased_remaining integer,
  total_remaining integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  account public.email_credit_accounts%rowtype;
  old_included integer;
  grant_amount integer := 0;
  restored_amount integer := 0;
  already_granted boolean := false;
  new_epoch bigint := 1;
  normalized_plan text;
begin
  if p_owner_id is null
     or p_allowance_key is null
     or length(p_allowance_key) = 0
     or p_allowance_size < 0
     or (p_source_version is not null and p_source_version < 0) then
    raise exception 'Invalid email-credit allowance input.' using errcode = '22023';
  end if;

  normalized_plan := case
    when p_plan in ('pro', 'agency') then p_plan
    else 'free'
  end;

  -- All ledger operations take this short global lock. Provider network calls
  -- happen outside SQL, so this only serializes millisecond-sized balance
  -- transactions while guaranteeing one lock order across cross-owner cache
  -- lease recovery, grants, refunds and disputes.
  perform pg_advisory_xact_lock(hashtextextended('email-credit-ledger', 0));

  insert into public.email_credit_accounts (owner_id)
  values (p_owner_id)
  on conflict (owner_id) do nothing;

  select * into account
  from public.email_credit_accounts
  where owner_id = p_owner_id
  for update;

  if p_source_version is not null
     and account.allowance_version is not null
     and p_source_version < account.allowance_version then
    return query
    select a.included_balance,
           greatest(a.purchased_balance, 0),
           greatest(a.included_balance + a.purchased_balance, 0)
    from public.email_credit_accounts a
    where a.owner_id = p_owner_id;
    return;
  end if;

  -- Once webhooks establish an entitlement, a lazy request may only advance
  -- the same paid plan into a later calendar month. This prevents a stale
  -- local subscription row from undoing a newer cancellation/plan event whose
  -- event watermark the ledger has already seen.
  if p_source_version is null
     and account.allowance_version is not null
     and account.allowance_key is distinct from p_allowance_key
     and not (
       (
         account.allowance_plan = normalized_plan
         and normalized_plan in ('pro', 'agency')
         and account.allowance_key ~ ('^' || normalized_plan || ':month:[0-9]{4}-[0-9]{2}$')
         and p_allowance_key ~ ('^' || normalized_plan || ':month:[0-9]{4}-[0-9]{2}$')
         and right(p_allowance_key, 7) > right(account.allowance_key, 7)
       )
       -- The app supplies this key only after verifying role + locked email
       -- allowlist with the service role. Admin grants must also roll monthly.
       or (
         normalized_plan = 'agency'
         and p_allowance_key ~ '^agency:admin:[0-9]{4}-[0-9]{2}$'
       )
       -- Removing the allowlist row must revoke the admin allowance without
       -- waiting for a Stripe event.
       or (
         normalized_plan = 'free'
         and account.allowance_key ~ '^agency:admin:[0-9]{4}-[0-9]{2}$'
         and p_allowance_key = 'free:lifetime'
       )
     ) then
    return query
    select a.included_balance,
           greatest(a.purchased_balance, 0),
           greatest(a.included_balance + a.purchased_balance, 0)
    from public.email_credit_accounts a
    where a.owner_id = p_owner_id;
    return;
  end if;

  if account.allowance_key is distinct from p_allowance_key then
    old_included := account.included_balance;
    new_epoch := coalesce(account.allowance_epoch, 0) + 1;

    if old_included <> 0 and account.allowance_key is not null then
      insert into public.email_credit_ledger (
        owner_id, entry_type, included_delta, idempotency_key, metadata
      ) values (
        p_owner_id,
        'allowance_expire',
        -old_included,
        'allowance-expire:' || new_epoch::text || ':' || account.allowance_key
          || ':to:' || p_allowance_key,
        jsonb_build_object(
          'from', account.allowance_key,
          'to', p_allowance_key,
          'epoch', new_epoch
        )
      ) on conflict (owner_id, idempotency_key) do nothing;
    end if;

    already_granted := exists (
      select 1
      from public.email_credit_ledger
      where owner_id = p_owner_id
        and idempotency_key = 'allowance-grant:' || p_allowance_key
    );

    if normalized_plan = 'free' then
      -- Free credits are granted only once over the life of an account. A user
      -- cannot downgrade and upgrade repeatedly to mint five more.
      if account.free_lifetime_granted_at is null and not already_granted then
        grant_amount := p_allowance_size;
      end if;
    elsif not already_granted then
      -- A period key is a one-time grant. If account state ever moves away
      -- from a period and back (for example, out-of-order Stripe events), do
      -- not mint the full allowance twice.
      grant_amount := p_allowance_size;
    end if;

    -- Coming back to a period that was already granted must RESTORE what was
    -- left of it, never zero it. A non-active Stripe status is frequently
    -- transient (past_due that later settles, a webhook blip, an incomplete
    -- payment that completes): it moves the account onto 'free:lifetime' and
    -- then straight back. Setting the balance to the new grant, which is 0 for
    -- an already-granted period, permanently destroyed allowance the customer
    -- had paid for.
    --
    -- The remaining amount is recomputed from the immutable ledger instead of a
    -- cached figure, so repeated flapping neither mints nor loses credits: it
    -- is exactly the grant for this key, minus the lookups charged against it,
    -- plus the refunds of those lookups. Restore rows are keyed separately and
    -- are therefore never counted twice.
    if grant_amount = 0 then
      select coalesce(sum(
        case
          when l.entry_type = 'allowance_grant'
            and l.idempotency_key = 'allowance-grant:' || p_allowance_key
            then l.included_delta
          when l.entry_type = 'lookup_charge'
            and l.metadata->>'allowance_key' = p_allowance_key
            then l.included_delta
          when l.entry_type = 'lookup_refund'
            and exists (
              select 1
              from public.email_credit_ledger c
              where c.owner_id = l.owner_id
                and c.id::text = l.metadata->>'reservation_id'
                and c.metadata->>'allowance_key' = p_allowance_key
            )
            then l.included_delta
          else 0
        end
      ), 0)
      into restored_amount
      from public.email_credit_ledger l
      where l.owner_id = p_owner_id;

      -- Never hand back more than the period was ever worth.
      restored_amount := least(greatest(coalesce(restored_amount, 0), 0), p_allowance_size);
    end if;

    update public.email_credit_accounts
    set included_balance = grant_amount + restored_amount,
        allowance_epoch = new_epoch,
        allowance_key = p_allowance_key,
        allowance_plan = normalized_plan,
        allowance_size = p_allowance_size,
        allowance_ends_at = p_allowance_ends_at,
        allowance_version = case
          when p_source_version is null then allowance_version
          else greatest(coalesce(allowance_version, p_source_version), p_source_version)
        end,
        free_lifetime_granted_at = case
          when normalized_plan = 'free' and free_lifetime_granted_at is null
            then now()
          else free_lifetime_granted_at
        end,
        updated_at = now()
    where owner_id = p_owner_id;

    if grant_amount <> 0 then
      insert into public.email_credit_ledger (
        owner_id, entry_type, included_delta, idempotency_key, metadata
      ) values (
        p_owner_id,
        'allowance_grant',
        grant_amount,
        'allowance-grant:' || p_allowance_key,
        jsonb_build_object('plan', normalized_plan, 'allowance', grant_amount)
      ) on conflict (owner_id, idempotency_key) do nothing;
    end if;

    -- Audit the restore separately from the one-time grant. The epoch keeps the
    -- key unique per transition, and the distinct key prefix keeps this row out
    -- of the recomputation above.
    if restored_amount <> 0 then
      insert into public.email_credit_ledger (
        owner_id, entry_type, included_delta, idempotency_key, metadata
      ) values (
        p_owner_id,
        'allowance_grant',
        restored_amount,
        'allowance-restore:' || new_epoch::text || ':' || p_allowance_key,
        jsonb_build_object(
          'plan', normalized_plan,
          'restored', restored_amount,
          'epoch', new_epoch,
          'reason', 'period_reentered'
        )
      ) on conflict (owner_id, idempotency_key) do nothing;
    end if;
  elsif p_source_version is not null then
    -- Even an idempotent repeat advances the event watermark. Otherwise a
    -- later-arriving older event with a different key could still roll back.
    update public.email_credit_accounts
    set allowance_version = greatest(coalesce(allowance_version, p_source_version), p_source_version),
        allowance_ends_at = p_allowance_ends_at,
        updated_at = now()
    where owner_id = p_owner_id;
  end if;

  return query
  select a.included_balance,
         greatest(a.purchased_balance, 0),
         greatest(a.included_balance + a.purchased_balance, 0)
  from public.email_credit_accounts a
  where a.owner_id = p_owner_id;
end;
$$;

-- Lock-free read used on every balance request. It also returns the stored
-- allowance key so the API can tell whether a period roll is actually due, and
-- skip the locking sync when it is not.
--
-- The column list changed after the first revision of this file, and Postgres
-- refuses to change an existing function's result type in place, so drop first.
-- Nothing depends on this function, and the grants below are re-applied.
drop function if exists public.get_email_credit_balance(uuid);

create or replace function public.get_email_credit_balance(p_owner_id uuid)
returns table (
  included_remaining integer,
  purchased_remaining integer,
  credit_debt integer,
  total_remaining integer,
  allowance_plan text,
  allowance_key text,
  allowance_size integer,
  allowance_ends_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select included_balance,
         greatest(purchased_balance, 0),
         greatest(-purchased_balance, 0),
         greatest(included_balance + purchased_balance, 0),
         allowance_plan,
         allowance_key,
         allowance_size,
         allowance_ends_at
  from public.email_credit_accounts
  where owner_id = p_owner_id;
$$;

-- Refund exactly the bucket used by a reservation. Idempotency makes this safe
-- from both an API catch/finally path and a later stale-lease recovery.
create or replace function public.refund_email_lookup_credit(
  p_reservation_id uuid,
  p_reason text default 'lookup_failed'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  charge public.email_credit_ledger%rowtype;
  refund_key text;
  new_total integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('email-credit-ledger', 0));

  select * into charge
  from public.email_credit_ledger
  where id = p_reservation_id
    and entry_type = 'lookup_charge'
  for update;

  if not found then
    return null;
  end if;

  refund_key := 'lookup-refund:' || charge.id::text;
  if exists (
    select 1 from public.email_credit_ledger
    where owner_id = charge.owner_id and idempotency_key = refund_key
  ) then
    select greatest(included_balance + purchased_balance, 0)
      into new_total
    from public.email_credit_accounts
    where owner_id = charge.owner_id;
    return new_total;
  end if;

  -- Included credits belong to one non-rollover period. If that period reset
  -- while the provider call was in flight, do not resurrect the expired unit.
  -- Purchased credits persist, so they are always restored.
  update public.email_credit_accounts a
  set included_balance = included_balance + case
        when charge.included_delta <> 0
          and charge.metadata->>'allowance_key' = a.allowance_key
          then -charge.included_delta
        else 0
      end,
      purchased_balance = purchased_balance - charge.purchased_delta,
      updated_at = now()
  where owner_id = charge.owner_id;

  insert into public.email_credit_ledger (
    owner_id, actor_user_id, entry_type, included_delta, purchased_delta,
    idempotency_key, lookup_domain, metadata
  ) values (
    charge.owner_id,
    charge.actor_user_id,
    'lookup_refund',
    case
      when charge.included_delta <> 0 and exists (
        select 1 from public.email_credit_accounts a
        where a.owner_id = charge.owner_id
          and charge.metadata->>'allowance_key' = a.allowance_key
      ) then -charge.included_delta
      else 0
    end,
    -charge.purchased_delta,
    refund_key,
    charge.lookup_domain,
    jsonb_build_object('reason', coalesce(p_reason, 'lookup_failed'), 'reservation_id', charge.id)
  );

  select greatest(included_balance + purchased_balance, 0)
    into new_total
  from public.email_credit_accounts
  where owner_id = charge.owner_id;
  return new_total;
end;
$$;

-- Atomically returns a cached result, declines a concurrent duplicate, or
-- reserves exactly one credit and grants a short provider-call lease.
create or replace function public.claim_email_lookup(
  p_owner_id uuid,
  p_actor_user_id uuid,
  p_domain text,
  p_claim_token uuid
)
returns table (
  claim_status text,
  cached_email text,
  cached_confidence text,
  cached_source text,
  credit_charged boolean,
  remaining integer,
  reservation_id uuid,
  retry_after integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cached public.email_lookup_cache%rowtype;
  account public.email_credit_accounts%rowtype;
  included_change integer := 0;
  purchased_change integer := 0;
  new_reservation uuid;
begin
  if p_owner_id is null or p_actor_user_id is null or p_claim_token is null
     or p_domain is null or length(p_domain) = 0 then
    raise exception 'Invalid email lookup claim.' using errcode = '22023';
  end if;

  -- A domain-level advisory lock closes the insert race when no cache row
  -- exists yet. Different domains still run concurrently.
  perform pg_advisory_xact_lock(hashtextextended('email-lookup-domain:' || p_domain, 0));

  select * into cached
  from public.email_lookup_cache
  where domain = p_domain
  for update;

  if found and cached.state in ('found', 'guessed')
     and (cached.result_expires_at is null or cached.result_expires_at > now()) then
    select greatest(a.included_balance + a.purchased_balance, 0)
      into remaining
    from public.email_credit_accounts a
    where a.owner_id = p_owner_id;

    -- The cache is global so that LeadZipp pays the provider once per domain,
    -- and re-reading a domain this owner already paid for stays free: that is
    -- the documented "cached reruns are free" promise, and withholding data a
    -- customer has already bought would be worse than the leak.
    --
    -- It is NOT a way to read other tenants' results with an empty balance.
    -- A first-time reader of this domain must still be in good standing, which
    -- also covers an owner whose purchased credits were clawed back after a
    -- refund or chargeback. No credit is charged either way: serving a cached
    -- row costs nothing upstream.
    if coalesce(remaining, 0) <= 0 and not exists (
      select 1
      from public.email_credit_ledger l
      where l.owner_id = p_owner_id
        and l.entry_type = 'lookup_charge'
        and l.lookup_domain = p_domain
    ) then
      return query select
        'exhausted'::text,
        null::text,
        null::text,
        null::text,
        false,
        0,
        null::uuid,
        0;
      return;
    end if;

    return query select
      'cached'::text,
      cached.email,
      cached.confidence,
      cached.source,
      false,
      coalesce(remaining, 0),
      null::uuid,
      0;
    return;
  end if;

  if found and cached.state = 'pending' and cached.lease_expires_at > now() then
    select greatest(a.included_balance + a.purchased_balance, 0)
      into remaining
    from public.email_credit_accounts a
    where a.owner_id = p_owner_id;

    return query select
      'pending'::text,
      null::text,
      null::text,
      null::text,
      false,
      coalesce(remaining, 0),
      null::uuid,
      greatest(1, ceil(extract(epoch from (cached.lease_expires_at - now())))::integer);
    return;
  end if;

  -- If a worker died after reserving a credit, release that old reservation
  -- before a new worker takes over the expired lease.
  if found and cached.state = 'pending' and cached.reservation_ledger_id is not null then
    perform public.refund_email_lookup_credit(cached.reservation_ledger_id, 'stale_lookup_lease');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('email-credit-ledger', 0));
  select * into account
  from public.email_credit_accounts
  where owner_id = p_owner_id
  for update;

  if not found or account.included_balance + account.purchased_balance <= 0 then
    return query select
      'exhausted'::text,
      null::text,
      null::text,
      null::text,
      false,
      0,
      null::uuid,
      0;
    return;
  end if;

  -- Included credits are spent first. A negative purchased balance represents
  -- refunded/charged-back credit debt and therefore reduces usable included
  -- credits until the combined balance reaches zero.
  if account.included_balance > 0 then
    included_change := -1;
  else
    purchased_change := -1;
  end if;

  insert into public.email_credit_ledger (
    owner_id, actor_user_id, entry_type, included_delta, purchased_delta,
    idempotency_key, lookup_domain, metadata
  ) values (
    p_owner_id,
    p_actor_user_id,
    'lookup_charge',
    included_change,
    purchased_change,
    'lookup-charge:' || p_claim_token::text,
    p_domain,
    jsonb_build_object('allowance_key', account.allowance_key)
  ) returning id into new_reservation;

  update public.email_credit_accounts
  set included_balance = included_balance + included_change,
      purchased_balance = purchased_balance + purchased_change,
      updated_at = now()
  where owner_id = p_owner_id;

  insert into public.email_lookup_cache (
    domain, state, claim_token, reservation_ledger_id, claimed_by,
    lease_expires_at, result_expires_at, email, confidence, source, updated_at
  ) values (
    p_domain, 'pending', p_claim_token, new_reservation, p_actor_user_id,
    now() + interval '20 seconds', null, null, null, null, now()
  ) on conflict (domain) do update
    set state = 'pending',
        claim_token = excluded.claim_token,
        completion_token = null,
        reservation_ledger_id = excluded.reservation_ledger_id,
        claimed_by = excluded.claimed_by,
        lease_expires_at = excluded.lease_expires_at,
        result_expires_at = null,
        email = null,
        confidence = null,
        source = null,
        updated_at = now();

  return query select
    'claimed'::text,
    null::text,
    null::text,
    null::text,
    true,
    greatest(account.included_balance + account.purchased_balance - 1, 0),
    new_reservation,
    0;
end;
$$;

-- Complete a claimed lookup. Guessed/no-result completions refund the reserved
-- credit in the same transaction; successful Hunter results keep the charge.
create or replace function public.complete_email_lookup(
  p_domain text,
  p_claim_token uuid,
  p_email text,
  p_confidence text,
  p_source text,
  p_keep_charge boolean,
  p_result_expires_at timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cached public.email_lookup_cache%rowtype;
  new_total integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('email-lookup-domain:' || p_domain, 0));

  select * into cached
  from public.email_lookup_cache
  where domain = p_domain
    and state = 'pending'
    and claim_token = p_claim_token
  for update;

  if not found then
    raise exception 'Email lookup claim is no longer active.' using errcode = '40001';
  end if;

  if p_email is null or length(p_email) = 0
     or p_confidence not in ('verified', 'likely', 'guessed')
     or p_source not in ('hunter', 'guess') then
    raise exception 'Invalid email lookup result.' using errcode = '22023';
  end if;

  if not p_keep_charge and cached.reservation_ledger_id is not null then
    new_total := public.refund_email_lookup_credit(
      cached.reservation_ledger_id,
      'provider_no_billable_result'
    );
  else
    select greatest(a.included_balance + a.purchased_balance, 0)
      into new_total
    from public.email_credit_ledger l
    join public.email_credit_accounts a on a.owner_id = l.owner_id
    where l.id = cached.reservation_ledger_id;
  end if;

  update public.email_lookup_cache
  set state = case when p_keep_charge then 'found' else 'guessed' end,
      email = p_email,
      confidence = p_confidence,
      source = p_source,
      claim_token = null,
      completion_token = p_claim_token,
      reservation_ledger_id = null,
      claimed_by = null,
      lease_expires_at = null,
      result_expires_at = p_result_expires_at,
      updated_at = now()
  where domain = p_domain;

  return coalesce(new_total, 0);
end;
$$;

create or replace function public.abort_email_lookup(
  p_domain text,
  p_claim_token uuid,
  p_reason text default 'lookup_aborted'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cached public.email_lookup_cache%rowtype;
  new_total integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('email-lookup-domain:' || p_domain, 0));
  select * into cached
  from public.email_lookup_cache
  where domain = p_domain and state = 'pending' and claim_token = p_claim_token
  for update;

  if not found then
    return 0;
  end if;

  if cached.reservation_ledger_id is not null then
    new_total := coalesce(
      public.refund_email_lookup_credit(cached.reservation_ledger_id, p_reason),
      0
    );
  end if;

  delete from public.email_lookup_cache
  where domain = p_domain and claim_token = p_claim_token;

  return new_total;
end;
$$;

-- Fulfill a verified Stripe Checkout Session exactly once. The route/webhook
-- validates the line-item Price ID, quantity and amount before calling this RPC.
create or replace function public.grant_email_credit_pack(
  p_owner_id uuid,
  p_actor_user_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_price_id text,
  p_pack_slug text,
  p_credits integer,
  p_amount_paid integer,
  p_currency text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase_id uuid;
begin
  if p_owner_id is null or p_actor_user_id is null
     or p_checkout_session_id is null or p_payment_intent_id is null
     or p_price_id is null or p_pack_slug is null
     or p_credits <= 0 or p_amount_paid <= 0 then
    raise exception 'Invalid email-credit pack.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('email-credit-ledger', 0));

  insert into public.email_credit_accounts (owner_id)
  values (p_owner_id)
  on conflict (owner_id) do nothing;

  insert into public.email_credit_purchases (
    owner_id, actor_user_id, stripe_checkout_session_id,
    stripe_payment_intent_id, stripe_price_id, pack_slug, credits,
    amount_paid, currency
  ) values (
    p_owner_id, p_actor_user_id, p_checkout_session_id,
    p_payment_intent_id, p_price_id, p_pack_slug, p_credits,
    p_amount_paid, lower(p_currency)
  ) on conflict do nothing
  returning id into purchase_id;

  if purchase_id is null then
    return false;
  end if;

  update public.email_credit_accounts
  set purchased_balance = purchased_balance + p_credits,
      updated_at = now()
  where owner_id = p_owner_id;

  insert into public.email_credit_ledger (
    owner_id, actor_user_id, entry_type, purchased_delta,
    idempotency_key, stripe_checkout_session_id,
    stripe_payment_intent_id, metadata
  ) values (
    p_owner_id, p_actor_user_id, 'pack_grant', p_credits,
    'pack-grant:' || p_checkout_session_id,
    p_checkout_session_id, p_payment_intent_id,
    jsonb_build_object(
      'pack', p_pack_slug,
      'credits', p_credits,
      'amount_paid', p_amount_paid,
      'currency', lower(p_currency),
      'price_id', p_price_id
    )
  );

  return true;
end;
$$;

-- Apply or reverse a refund/dispute source and recompute the effective
-- clawback. Refund totals and an active dispute overlap, so the larger of the
-- two is used rather than charging both against the customer's credits.
create or replace function public.adjust_email_credit_pack(
  p_payment_intent_id text,
  p_event_key text,
  p_source_type text,
  p_source_id text,
  p_amount_cents integer,
  p_active boolean
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase public.email_credit_purchases%rowtype;
  refund_amount bigint := 0;
  dispute_amount bigint := 0;
  adverse_amount bigint := 0;
  desired_revoked integer := 0;
  purchased_delta integer := 0;
begin
  if p_event_key is null or p_source_id is null
     or p_source_type not in ('refund', 'dispute')
     or p_amount_cents < 0 then
    raise exception 'Invalid email-credit pack adjustment.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('email-credit-ledger', 0));

  select * into purchase
  from public.email_credit_purchases
  where stripe_payment_intent_id = p_payment_intent_id
  for update;

  if not found then
    return 'not_pack';
  end if;

  if exists (
    select 1 from public.email_credit_ledger
    where owner_id = purchase.owner_id and idempotency_key = p_event_key
  ) then
    return 'duplicate';
  end if;

  insert into public.email_credit_purchase_adjustments (
    purchase_id, source_type, source_id, amount_cents, active, updated_at
  ) values (
    purchase.id, p_source_type, p_source_id, p_amount_cents, p_active, now()
  ) on conflict (purchase_id, source_type, source_id) do update
    set amount_cents = excluded.amount_cents,
        active = excluded.active,
        updated_at = now();

  select coalesce(sum(amount_cents), 0)
    into refund_amount
  from public.email_credit_purchase_adjustments
  where purchase_id = purchase.id and source_type = 'refund' and active;

  select coalesce(max(amount_cents), 0)
    into dispute_amount
  from public.email_credit_purchase_adjustments
  where purchase_id = purchase.id and source_type = 'dispute' and active;

  adverse_amount := least(purchase.amount_paid::bigint, greatest(refund_amount, dispute_amount));
  desired_revoked := case
    when adverse_amount <= 0 then 0
    else least(
      purchase.credits,
      ceil((purchase.credits::numeric * adverse_amount::numeric) / purchase.amount_paid::numeric)::integer
    )
  end;

  purchased_delta := purchase.revoked_credits - desired_revoked;

  update public.email_credit_purchases
  set revoked_credits = desired_revoked,
      updated_at = now()
  where id = purchase.id;

  update public.email_credit_accounts
  set purchased_balance = purchased_balance + purchased_delta,
      updated_at = now()
  where owner_id = purchase.owner_id;

  insert into public.email_credit_ledger (
    owner_id, actor_user_id, entry_type, purchased_delta,
    idempotency_key, stripe_checkout_session_id,
    stripe_payment_intent_id, metadata
  ) values (
    purchase.owner_id,
    purchase.actor_user_id,
    'pack_adjustment',
    purchased_delta,
    p_event_key,
    purchase.stripe_checkout_session_id,
    purchase.stripe_payment_intent_id,
    jsonb_build_object(
      'source_type', p_source_type,
      'source_id', p_source_id,
      'active', p_active,
      'amount_cents', p_amount_cents,
      'revoked_credits', desired_revoked
    )
  );

  return 'adjusted';
end;
$$;

revoke all on function public.sync_email_credit_allowance(uuid, text, text, integer, timestamptz, bigint)
  from public, anon, authenticated;
revoke all on function public.get_email_credit_balance(uuid)
  from public, anon, authenticated;
revoke all on function public.refund_email_lookup_credit(uuid, text)
  from public, anon, authenticated;
revoke all on function public.claim_email_lookup(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_email_lookup(text, uuid, text, text, text, boolean, timestamptz)
  from public, anon, authenticated;
revoke all on function public.abort_email_lookup(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.grant_email_credit_pack(uuid, uuid, text, text, text, text, integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.adjust_email_credit_pack(text, text, text, text, integer, boolean)
  from public, anon, authenticated;

grant execute on function public.sync_email_credit_allowance(uuid, text, text, integer, timestamptz, bigint)
  to service_role;
grant execute on function public.get_email_credit_balance(uuid)
  to service_role;
grant execute on function public.refund_email_lookup_credit(uuid, text)
  to service_role;
grant execute on function public.claim_email_lookup(uuid, uuid, text, uuid)
  to service_role;
grant execute on function public.complete_email_lookup(text, uuid, text, text, text, boolean, timestamptz)
  to service_role;
grant execute on function public.abort_email_lookup(text, uuid, text)
  to service_role;
grant execute on function public.grant_email_credit_pack(uuid, uuid, text, text, text, text, integer, integer, text)
  to service_role;
grant execute on function public.adjust_email_credit_pack(text, text, text, text, integer, boolean)
  to service_role;

comment on table public.email_credit_accounts is
  'Server-managed Email Finder balances. Agency members share the workspace owner row.';
comment on table public.email_credit_ledger is
  'Append-only, idempotent audit trail for included and purchased email credits.';
comment on table public.email_lookup_cache is
  'Server-only domain lookup cache and short-lived concurrency lease.';
