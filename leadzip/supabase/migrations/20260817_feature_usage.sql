-- Atomic monthly fair-use metering for signed-in, cost-bearing lead features.
--
-- Limits per calendar month (UTC):
--                         Free   Pro   Agency (shared by workspace)
--   AI proposals             3    50      250
--   Market gap analyses      1    10       50
--   Competitor analyses      3    25      100
--   Public audit reports     3    25      100
--   Website health checks   10   250    1,000
--
-- Allowlisted platform admins are exempt. Agency members reserve against the
-- owner only when that owner is an allowlisted admin or has both an Agency
-- profile and an active/trialing Agency subscription. A copied plan='agency'
-- is never trusted when the workspace/owner entitlement is stale.
-- The RPC is service-role-only: customers cannot call it directly to drain a
-- shared workspace ledger or bypass the API routes' burst controls.
--
-- The RPC reserves before the upstream operation. This keeps concurrent calls
-- within the limit without holding a database transaction open across a network
-- request. Consequently, an attempted provider call that later fails still uses
-- its reservation, just like most provider-side quotas.

create table if not exists public.feature_usage_monthly (
  subject_user_id uuid not null references public.users_profile(id) on delete cascade,
  feature text not null check (
    feature in ('ai_proposal', 'market_gaps', 'competitors', 'audit_reports', 'website_health')
  ),
  period_start date not null,
  used integer not null default 0 check (used >= 0),
  last_actor_user_id uuid references public.users_profile(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (subject_user_id, feature, period_start)
);

create index if not exists feature_usage_monthly_period_idx
  on public.feature_usage_monthly (period_start);

alter table public.feature_usage_monthly enable row level security;

-- Usage is exposed through the narrowly scoped RPC only. Owner analytics can
-- read it with the service role; browsers cannot alter or enumerate the ledger.
revoke all on table public.feature_usage_monthly from public, anon, authenticated;
grant all on table public.feature_usage_monthly to service_role;

create or replace function public.reserve_feature_usage(uid uuid, feature_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  requested_id uuid := coalesce(caller_id, uid);
  subject_id uuid := requested_id;
  account_plan text := 'free';
  account_role text := 'user';
  account_status text := 'active';
  account_email text;
  account_is_platform_admin boolean := false;
  workspace_id_value uuid;
  workspace_owner_id uuid;
  owner_plan text;
  owner_role text;
  owner_status text;
  owner_email text;
  owner_is_platform_admin boolean := false;
  owner_has_agency_subscription boolean := false;
  own_subscription_plan text;
  monthly_limit integer;
  current_used integer := 0;
  period_start_value date := date_trunc('month', now() at time zone 'utc')::date;
  reset_at_value timestamptz :=
    (date_trunc('month', now() at time zone 'utc') + interval '1 month') at time zone 'utc';
begin
  if feature_name is null or feature_name not in (
    'ai_proposal',
    'market_gaps',
    'competitors',
    'audit_reports',
    'website_health'
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_feature');
  end if;

  if requested_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthorized');
  end if;

  select
    coalesce(plan, 'free'),
    coalesce(role, 'user'),
    coalesce(status, 'active'),
    email,
    workspace_id
  into account_plan, account_role, account_status, account_email, workspace_id_value
  from public.users_profile
  where id = requested_id;

  if not found or account_status <> 'active' then
    return jsonb_build_object('allowed', false, 'reason', 'inactive');
  end if;

  account_is_platform_admin := account_role = 'admin' and exists (
    select 1
    from public.admin_allowlist
    where lower(admin_allowlist.email) = lower(account_email)
  );

  -- Never grant from a stale copied/profile plan. Paid access requires a live
  -- subscription; a valid Agency workspace may override this baseline below.
  if not account_is_platform_admin then
    own_subscription_plan := null;
    select plan into own_subscription_plan
    from public.subscriptions
    where user_id = requested_id
      and status in ('active', 'trialing')
      and plan in ('pro', 'agency')
    order by updated_at desc
    limit 1;
    account_plan := coalesce(own_subscription_plan, 'free');
    account_role := 'user';
  end if;

  -- Resolve Agency membership to its owner. Profile plan alone is not billing
  -- proof: the owner must either be a real allowlisted platform admin, or have
  -- both plan='agency' and an active/trialing Agency subscription. Otherwise
  -- fall back to the caller's own active subscription (or Free).
  if workspace_id_value is not null
     and not account_is_platform_admin
     and exists (
       select 1 from public.workspace_members
       where workspace_id = workspace_id_value and user_id = requested_id
     ) then
    select owner_id into workspace_owner_id
    from public.workspaces
    where id = workspace_id_value;

    if workspace_owner_id is not null then
      select
        coalesce(plan, 'free'),
        coalesce(role, 'user'),
        coalesce(status, 'active'),
        email
      into owner_plan, owner_role, owner_status, owner_email
      from public.users_profile
      where id = workspace_owner_id;

      owner_is_platform_admin := owner_status = 'active'
        and owner_role = 'admin'
        and exists (
          select 1
          from public.admin_allowlist
          where lower(admin_allowlist.email) = lower(owner_email)
        );

      owner_has_agency_subscription := owner_status = 'active'
        and owner_plan = 'agency'
        and exists (
          select 1
          from public.subscriptions
          where user_id = workspace_owner_id
            and plan = 'agency'
            and status in ('active', 'trialing')
        );

      if owner_is_platform_admin or owner_has_agency_subscription then
        subject_id := workspace_owner_id;
        account_plan := 'agency';
      else
        own_subscription_plan := null;
        select plan into own_subscription_plan
        from public.subscriptions
        where user_id = requested_id
          and status in ('active', 'trialing')
          and plan in ('pro', 'agency')
        order by updated_at desc
        limit 1;

        subject_id := requested_id;
        account_plan := coalesce(own_subscription_plan, 'free');
        account_role := 'user';
      end if;
    else
      own_subscription_plan := null;
      select plan into own_subscription_plan
      from public.subscriptions
      where user_id = requested_id
        and status in ('active', 'trialing')
        and plan in ('pro', 'agency')
      order by updated_at desc
      limit 1;

      subject_id := requested_id;
      account_plan := coalesce(own_subscription_plan, 'free');
      account_role := 'user';
    end if;
  elsif workspace_id_value is not null and not account_is_platform_admin then
    own_subscription_plan := null;
    select plan into own_subscription_plan
    from public.subscriptions
    where user_id = requested_id
      and status in ('active', 'trialing')
      and plan in ('pro', 'agency')
    order by updated_at desc
    limit 1;

    subject_id := requested_id;
    account_plan := coalesce(own_subscription_plan, 'free');
    account_role := 'user';
  end if;

  if account_is_platform_admin then
    return jsonb_build_object(
      'allowed', true,
      'feature', feature_name,
      'reason', null,
      'plan', 'agency',
      'subjectUserId', subject_id,
      'used', 0,
      'limit', null,
      'remaining', null,
      'resetAt', reset_at_value,
      'upgradeRequired', false
    );
  end if;

  account_plan := case
    when account_plan = 'agency' then 'agency'
    when account_plan = 'pro' then 'pro'
    else 'free'
  end;

  monthly_limit := case feature_name
    when 'ai_proposal' then case account_plan when 'agency' then 250 when 'pro' then 50 else 3 end
    when 'market_gaps' then case account_plan when 'agency' then 50 when 'pro' then 10 else 1 end
    when 'competitors' then case account_plan when 'agency' then 100 when 'pro' then 25 else 3 end
    when 'audit_reports' then case account_plan when 'agency' then 100 when 'pro' then 25 else 3 end
    when 'website_health' then case account_plan when 'agency' then 1000 when 'pro' then 250 else 10 end
  end;

  -- The lock key includes subject, feature, and month. Parallel calls from
  -- different Agency seats therefore serialize only when they share quota.
  perform pg_advisory_xact_lock(
    hashtextextended(
      subject_id::text || ':' || feature_name || ':' || period_start_value::text,
      17
    )
  );

  insert into public.feature_usage_monthly (
    subject_user_id,
    feature,
    period_start,
    used,
    last_actor_user_id
  ) values (
    subject_id,
    feature_name,
    period_start_value,
    0,
    requested_id
  )
  on conflict (subject_user_id, feature, period_start) do nothing;

  select used into current_used
  from public.feature_usage_monthly
  where subject_user_id = subject_id
    and feature = feature_name
    and period_start = period_start_value
  for update;

  if current_used >= monthly_limit then
    return jsonb_build_object(
      'allowed', false,
      'feature', feature_name,
      'reason', 'monthly_limit',
      'plan', account_plan,
      'subjectUserId', subject_id,
      'used', current_used,
      'limit', monthly_limit,
      'remaining', 0,
      'resetAt', reset_at_value,
      'upgradeRequired', account_plan <> 'agency'
    );
  end if;

  update public.feature_usage_monthly
  set
    used = used + 1,
    last_actor_user_id = requested_id,
    updated_at = now()
  where subject_user_id = subject_id
    and feature = feature_name
    and period_start = period_start_value
  returning used into current_used;

  return jsonb_build_object(
    'allowed', true,
    'feature', feature_name,
    'reason', null,
    'plan', account_plan,
    'subjectUserId', subject_id,
    'used', current_used,
    'limit', monthly_limit,
    'remaining', greatest(monthly_limit - current_used, 0),
    'resetAt', reset_at_value,
    'upgradeRequired', false
  );
end;
$$;

revoke all on function public.reserve_feature_usage(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_feature_usage(uuid, text) to service_role;

comment on table public.feature_usage_monthly is
  'Durable UTC calendar-month usage ledger for signed-in cost-bearing features.';

comment on function public.reserve_feature_usage(uuid, text) is
  'Atomically reserves one monthly feature unit, pooling active Agency workspaces by owner.';
