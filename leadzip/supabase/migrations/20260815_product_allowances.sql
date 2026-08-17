-- Transparent product allowances and atomic live-search metering.
--
-- A live search is a cache miss that is about to reach the provider path.
-- Cached reads/refinements remain free. Agency search usage is shared by the
-- workspace so adding seats cannot silently multiply upstream API spend.
--
-- Public allowances (also defined in src/lib/planPolicy.ts):
--   Free   25 live searches/month, 25/day, 25 saved leads
--   Pro   100 live searches/month, 50/day, 1,000 saved leads
--   Agency 300 live searches/month, 150/day, 10,000 saved leads
-- Platform admins are exempt. Idempotent and safe to re-run.

-- Workspace membership is server-managed. A browser may edit ordinary profile
-- fields, but cannot attach itself to an Agency workspace by writing a UUID.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.plan is distinct from old.plan
      or new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.workspace_id is distinct from old.workspace_id)
     and auth.role() is not null
     and auth.role() <> 'service_role'
  then
    raise exception 'changing plan, role, status, or workspace requires the service role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists users_profile_protect_privileged on public.users_profile;
create trigger users_profile_protect_privileged
  before update on public.users_profile
  for each row execute function public.protect_profile_privileged_columns();

-- Stripe webhooks are delivered at least once and may arrive out of order.
-- The version stores event.created plus an active/inactive precedence bit, so
-- application sync can reject stale state atomically even within one second.
alter table if exists public.subscriptions
  add column if not exists stripe_state_version bigint not null default 0,
  add column if not exists stripe_subscription_created bigint not null default 0;

create or replace function public.reserve_live_search(uid uuid)
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
  owner_subscription_active boolean := false;
  own_subscription_plan text;
  subscription_status_value text;
  subscription_period_start timestamptz;
  monthly_limit integer := 25;
  daily_limit integer := 25;
  current_month integer := 0;
  current_day integer := 0;
  utc_today date := (now() at time zone 'utc')::date;
  utc_month date := date_trunc('month', now() at time zone 'utc')::date;
begin
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
    select 1 from public.admin_allowlist
    where lower(admin_allowlist.email) = lower(account_email)
  );

  -- Profile.plan is a denormalized display value, never billing authority.
  -- Every non-owner resolves from a currently active subscription or Free.
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

  -- Agency allowances belong to the workspace owner and are shared by every
  -- seat. A stale inherited `plan=agency` on a member is never trusted if the
  -- owner no longer has an active Agency entitlement.
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

      select exists (
        select 1 from public.subscriptions
        where user_id = workspace_owner_id
          and plan = 'agency'
          and status in ('active', 'trialing')
      ) into owner_subscription_active;

      owner_is_platform_admin := owner_status = 'active'
        and owner_role = 'admin'
        and exists (
          select 1 from public.admin_allowlist
          where lower(admin_allowlist.email) = lower(owner_email)
        );

      if owner_status = 'active'
         and (owner_is_platform_admin or (owner_plan = 'agency' and owner_subscription_active)) then
        subject_id := workspace_owner_id;
        account_plan := 'agency';
      else
        -- Restore the member's own paid entitlement, if one exists; otherwise
        -- use Free. This prevents an expired workspace from granting Agency.
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
    elsif workspace_id_value is not null then
      -- A dangling workspace link must not preserve a copied Agency plan.
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
    -- A forged/stale profile workspace UUID without a matching membership row
    -- never inherits the copied Agency plan.
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
      'reason', null,
      'plan', 'agency',
      'subjectUserId', subject_id,
      'monthlyUsed', 0,
      'monthlyLimit', null,
      'dailyUsed', 0,
      'dailyLimit', null
    );
  elsif account_plan = 'agency' then
    monthly_limit := 300;
    daily_limit := 150;
  elsif account_plan = 'pro' then
    monthly_limit := 100;
    daily_limit := 50;
  else
    account_plan := 'free';
    monthly_limit := 25;
    daily_limit := 25;
  end if;

  -- Trials remain genuinely useful, but do not expose a full month of paid
  -- provider spend before the first invoice: Pro gets 25 live searches and
  -- Agency gets 75 pooled live searches during its seven-day trial.
  select status, current_period_start
  into subscription_status_value, subscription_period_start
  from public.subscriptions
  where user_id = subject_id
    and status in ('active', 'trialing')
  order by updated_at desc
  limit 1;

  if subscription_status_value = 'trialing' then
    if account_plan = 'agency' then
      monthly_limit := 75;
      daily_limit := 75;
    elsif account_plan = 'pro' then
      monthly_limit := 25;
      daily_limit := 25;
    end if;
  end if;

  -- Serialize allowance checks by billing subject. The existing usage row can
  -- be missing for legacy users, so create it before taking the row lock.
  perform pg_advisory_xact_lock(hashtextextended(subject_id::text, 1));
  insert into public.usage_limits (user_id)
  values (subject_id)
  on conflict (user_id) do nothing;

  -- Calendar-month rollover happens inside the reservation itself; no cron is
  -- required for a customer to regain their allowance.
  update public.usage_limits
  set
    searches_this_month = case
      when subscription_status_value = 'trialing'
           and subscription_period_start is not null
           and last_reset_at < subscription_period_start then 0
      when subscription_status_value is distinct from 'trialing'
           and date_trunc('month', last_reset_at at time zone 'utc')::date < utc_month then 0
      else searches_this_month
    end,
    exports_count = case
      when subscription_status_value = 'trialing'
           and subscription_period_start is not null
           and last_reset_at < subscription_period_start then 0
      when subscription_status_value is distinct from 'trialing'
           and date_trunc('month', last_reset_at at time zone 'utc')::date < utc_month then 0
      else exports_count
    end,
    last_reset_at = case
      when subscription_status_value = 'trialing'
           and subscription_period_start is not null
           and last_reset_at < subscription_period_start then now()
      when subscription_status_value is distinct from 'trialing'
           and date_trunc('month', last_reset_at at time zone 'utc')::date < utc_month then now()
      else last_reset_at
    end,
    searches_today = case
      when searches_today_date is distinct from utc_today then 0
      else searches_today
    end,
    searches_today_date = utc_today,
    updated_at = now()
  where user_id = subject_id;

  select searches_this_month, searches_today
  into current_month, current_day
  from public.usage_limits
  where user_id = subject_id
  for update;

  if current_month >= monthly_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'monthly',
      'plan', account_plan,
      'subjectUserId', subject_id,
      'monthlyUsed', current_month,
      'monthlyLimit', monthly_limit,
      'dailyUsed', current_day,
      'dailyLimit', daily_limit
    );
  end if;

  if current_day >= daily_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'daily',
      'plan', account_plan,
      'subjectUserId', subject_id,
      'monthlyUsed', current_month,
      'monthlyLimit', monthly_limit,
      'dailyUsed', current_day,
      'dailyLimit', daily_limit
    );
  end if;

  update public.usage_limits
  set
    searches_this_month = searches_this_month + 1,
    searches_today = searches_today + 1,
    updated_at = now()
  where user_id = subject_id
  returning searches_this_month, searches_today
  into current_month, current_day;

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'plan', account_plan,
    'subjectUserId', subject_id,
    'monthlyUsed', current_month,
    'monthlyLimit', monthly_limit,
    'dailyUsed', current_day,
    'dailyLimit', daily_limit
  );
end;
$$;

-- Saved searches are inexpensive, but alerts can trigger paid live refreshes.
-- Apply transparent storage/alert ceilings transactionally so parallel tabs or
-- Agency seats cannot race past them. Agency counts are pooled by workspace.
create or replace function public.enforce_saved_search_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
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
  owner_subscription_active boolean := false;
  saved_limit integer := 3;
  alert_limit integer := 0;
  saved_count bigint := 0;
  alert_count bigint := 0;
  lock_subject uuid := new.user_id;
  shared_workspace_id uuid;
  enabling_alert boolean := false;
begin
  select coalesce(plan, 'free'), coalesce(role, 'user'),
         coalesce(status, 'active'), email, workspace_id
  into account_plan, account_role, account_status, account_email, workspace_id_value
  from public.users_profile
  where id = new.user_id;

  if not found or account_status <> 'active' then
    raise exception 'An active account is required.' using errcode = '23514';
  end if;

  account_is_platform_admin := account_role = 'admin' and exists (
    select 1 from public.admin_allowlist
    where lower(admin_allowlist.email) = lower(account_email)
  );

  if not account_is_platform_admin then
    select coalesce((
      select plan from public.subscriptions
      where user_id = new.user_id
        and status in ('active', 'trialing')
        and plan in ('pro', 'agency')
      order by updated_at desc
      limit 1
    ), 'free') into account_plan;
    account_role := 'user';
  end if;

  if workspace_id_value is not null
     and not account_is_platform_admin
     and exists (
       select 1 from public.workspace_members
       where workspace_id = workspace_id_value and user_id = new.user_id
     ) then
    select owner_id into workspace_owner_id
    from public.workspaces
    where id = workspace_id_value;

    if workspace_owner_id is not null then
      select coalesce(plan, 'free'), coalesce(role, 'user'),
             coalesce(status, 'active'), email
      into owner_plan, owner_role, owner_status, owner_email
      from public.users_profile
      where id = workspace_owner_id;

      select exists (
        select 1 from public.subscriptions
        where user_id = workspace_owner_id
          and plan = 'agency'
          and status in ('active', 'trialing')
      ) into owner_subscription_active;

      owner_is_platform_admin := owner_status = 'active'
        and owner_role = 'admin'
        and exists (
          select 1 from public.admin_allowlist
          where lower(admin_allowlist.email) = lower(owner_email)
        );

      if owner_status = 'active'
         and (owner_is_platform_admin or (owner_plan = 'agency' and owner_subscription_active)) then
        account_plan := 'agency';
        lock_subject := workspace_owner_id;
        shared_workspace_id := workspace_id_value;
      else
        select coalesce((
          select plan
          from public.subscriptions
          where user_id = new.user_id
            and status in ('active', 'trialing')
            and plan in ('pro', 'agency')
          order by updated_at desc
          limit 1
        ), 'free') into account_plan;
      end if;
    else
      select coalesce((
        select plan
        from public.subscriptions
        where user_id = new.user_id
          and status in ('active', 'trialing')
          and plan in ('pro', 'agency')
        order by updated_at desc
        limit 1
      ), 'free') into account_plan;
    end if;
  elsif workspace_id_value is not null and not account_is_platform_admin then
    select coalesce((
      select plan
      from public.subscriptions
      where user_id = new.user_id
        and status in ('active', 'trialing')
        and plan in ('pro', 'agency')
      order by updated_at desc
      limit 1
    ), 'free') into account_plan;
  end if;

  if account_is_platform_admin then
    return new;
  elsif account_plan = 'agency' then
    saved_limit := 100;
    alert_limit := 50;
  elsif account_plan = 'pro' then
    saved_limit := 25;
    alert_limit := 10;
  else
    account_plan := 'free';
    saved_limit := 3;
    alert_limit := 0;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(lock_subject::text, 4));

  if tg_op = 'INSERT' then
    enabling_alert := new.alert_enabled;
  elsif tg_op = 'UPDATE' then
    enabling_alert := new.alert_enabled and not old.alert_enabled;
  end if;

  if tg_op = 'INSERT' then
    if shared_workspace_id is not null then
      select count(*) into saved_count
      from public.saved_searches as search
      where search.user_id = lock_subject
         or exists (
           select 1 from public.workspace_members as member
           where member.workspace_id = shared_workspace_id
             and member.user_id = search.user_id
         );
    else
      select count(*) into saved_count
      from public.saved_searches
      where user_id = new.user_id;
    end if;

    if saved_count >= saved_limit then
      raise exception 'Saved search limit reached for the % plan.', account_plan
        using
          errcode = '23514',
          detail = format('This plan includes %s saved searches.', saved_limit),
          hint = 'Delete a saved search or upgrade the account plan.';
    end if;
  end if;

  if enabling_alert then
    if shared_workspace_id is not null then
      select count(*) into alert_count
      from public.saved_searches as search
      where search.alert_enabled = true
        and (
          search.user_id = lock_subject
          or exists (
            select 1 from public.workspace_members as member
            where member.workspace_id = shared_workspace_id
              and member.user_id = search.user_id
          )
        );
    else
      select count(*) into alert_count
      from public.saved_searches
      where user_id = new.user_id
        and alert_enabled = true;
    end if;

    if alert_count >= alert_limit then
      raise exception 'Active alert limit reached for the % plan.', account_plan
        using
          errcode = '23514',
          detail = format('This plan includes %s active alerts.', alert_limit),
          hint = case when alert_limit = 0
            then 'Upgrade to Pro to turn on new-business alerts.'
            else 'Turn off an alert or upgrade the account plan.' end;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists saved_searches_enforce_entitlement_insert on public.saved_searches;
create trigger saved_searches_enforce_entitlement_insert
  before insert on public.saved_searches
  for each row execute function public.enforce_saved_search_entitlement();

drop trigger if exists saved_searches_enforce_entitlement_alert on public.saved_searches;
create trigger saved_searches_enforce_entitlement_alert
  before update of alert_enabled on public.saved_searches
  for each row execute function public.enforce_saved_search_entitlement();

create index if not exists saved_searches_user_alert_idx
  on public.saved_searches(user_id, alert_enabled);

create or replace function public.enforce_crm_connection_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
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
  connection_limit integer := 0;
  connection_count bigint := 0;
begin
  if exists (
    select 1 from public.crm_integrations
    where user_id = new.user_id and crm_type = new.crm_type
  ) then
    return new;
  end if;

  select coalesce(plan, 'free'), coalesce(role, 'user'),
         coalesce(status, 'active'), email, workspace_id
  into account_plan, account_role, account_status, account_email, workspace_id_value
  from public.users_profile
  where id = new.user_id;

  if not found or account_status <> 'active' then
    raise exception 'An active account is required.' using errcode = '23514';
  end if;

  account_is_platform_admin := account_role = 'admin' and exists (
    select 1 from public.admin_allowlist
    where lower(admin_allowlist.email) = lower(account_email)
  );
  if account_is_platform_admin then
    return new;
  end if;

  select plan into own_subscription_plan
  from public.subscriptions
  where user_id = new.user_id
    and status in ('active', 'trialing')
    and plan in ('pro', 'agency')
  order by updated_at desc
  limit 1;
  account_plan := coalesce(own_subscription_plan, 'free');

  if workspace_id_value is not null and exists (
    select 1 from public.workspace_members
    where workspace_id = workspace_id_value and user_id = new.user_id
  ) then
    select owner_id into workspace_owner_id
    from public.workspaces
    where id = workspace_id_value;

    if workspace_owner_id is not null then
      select coalesce(plan, 'free'), coalesce(role, 'user'),
             coalesce(status, 'active'), email
      into owner_plan, owner_role, owner_status, owner_email
      from public.users_profile
      where id = workspace_owner_id;

      owner_is_platform_admin := owner_status = 'active'
        and owner_role = 'admin'
        and exists (
          select 1 from public.admin_allowlist
          where lower(admin_allowlist.email) = lower(owner_email)
        );
      owner_has_agency_subscription := owner_status = 'active'
        and owner_plan = 'agency'
        and exists (
          select 1 from public.subscriptions
          where user_id = workspace_owner_id
            and plan = 'agency'
            and status in ('active', 'trialing')
        );

      if owner_is_platform_admin or owner_has_agency_subscription then
        account_plan := 'agency';
      end if;
    end if;
  end if;

  if account_plan = 'agency' then
    connection_limit := 3;
  elsif account_plan = 'pro' then
    connection_limit := 1;
  else
    connection_limit := 0;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 5));
  select count(*) into connection_count
  from public.crm_integrations
  where user_id = new.user_id;

  if connection_count >= connection_limit then
    raise exception 'CRM connection limit reached for the % plan.', account_plan
      using
        errcode = '23514',
        detail = format('This plan includes %s CRM connections.', connection_limit),
        hint = case when connection_limit = 0
          then 'Upgrade to Pro to connect a CRM.'
          else 'Disconnect a CRM or upgrade the account plan.' end;
  end if;

  return new;
end;
$$;

drop trigger if exists crm_integrations_enforce_entitlement on public.crm_integrations;
create trigger crm_integrations_enforce_entitlement
  before insert on public.crm_integrations
  for each row execute function public.enforce_crm_connection_entitlement();

revoke all on function public.reserve_live_search(uuid) from public, anon;
grant execute on function public.reserve_live_search(uuid) to authenticated, service_role;

-- Replace the previous Free/Pro-only storage fence with a generous Agency
-- ceiling. The per-user lock and duplicate handling are retained.
create or replace function public.enforce_saved_lead_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
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
  saved_limit integer := 25;
  current_count bigint;
begin
  if new.user_id is null then
    raise exception 'A saved lead must belong to a user.' using errcode = '23502';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if exists (
    select 1 from public.leads
    where user_id = new.user_id and id = new.id
  ) then
    return new;
  end if;

  select coalesce(plan, 'free'), coalesce(role, 'user'),
         coalesce(status, 'active'), email, workspace_id
  into account_plan, account_role, account_status, account_email, workspace_id_value
  from public.users_profile
  where id = new.user_id;

  if not found or account_status <> 'active' then
    raise exception 'An active account is required.' using errcode = '23514';
  end if;

  account_is_platform_admin := account_role = 'admin' and exists (
    select 1 from public.admin_allowlist
    where lower(admin_allowlist.email) = lower(account_email)
  );
  if account_is_platform_admin then
    return new;
  end if;

  select plan into own_subscription_plan
  from public.subscriptions
  where user_id = new.user_id
    and status in ('active', 'trialing')
    and plan in ('pro', 'agency')
  order by updated_at desc
  limit 1;
  account_plan := coalesce(own_subscription_plan, 'free');

  if workspace_id_value is not null and exists (
    select 1 from public.workspace_members
    where workspace_id = workspace_id_value and user_id = new.user_id
  ) then
    select owner_id into workspace_owner_id
    from public.workspaces
    where id = workspace_id_value;

    if workspace_owner_id is not null then
      select coalesce(plan, 'free'), coalesce(role, 'user'),
             coalesce(status, 'active'), email
      into owner_plan, owner_role, owner_status, owner_email
      from public.users_profile
      where id = workspace_owner_id;

      owner_is_platform_admin := owner_status = 'active'
        and owner_role = 'admin'
        and exists (
          select 1 from public.admin_allowlist
          where lower(admin_allowlist.email) = lower(owner_email)
        );
      owner_has_agency_subscription := owner_status = 'active'
        and owner_plan = 'agency'
        and exists (
          select 1 from public.subscriptions
          where user_id = workspace_owner_id
            and plan = 'agency'
            and status in ('active', 'trialing')
        );

      if owner_is_platform_admin or owner_has_agency_subscription then
        account_plan := 'agency';
      end if;
    end if;
  end if;

  if account_plan = 'agency' then
    saved_limit := 10000;
  elsif account_plan = 'pro' then
    saved_limit := 1000;
  else
    saved_limit := 25;
  end if;

  select count(*) into current_count
  from public.leads
  where user_id = new.user_id;

  if current_count >= saved_limit then
    raise exception 'Saved lead limit reached for the % plan.', account_plan
      using
        errcode = '23514',
        detail = format('This plan allows %s saved leads.', saved_limit),
        hint = 'Remove a saved lead or upgrade the account plan.';
  end if;

  return new;
end;
$$;

drop trigger if exists leads_enforce_saved_entitlement on public.leads;
create trigger leads_enforce_saved_entitlement
  before insert on public.leads
  for each row execute function public.enforce_saved_lead_entitlement();

comment on function public.reserve_live_search(uuid) is
  'Atomically reserves one provider-backed search against a user or shared Agency workspace allowance.';

-- Five total seats (owner included) per paid Agency workspace. The transaction
-- lock prevents two invitations accepted at the same moment from both taking
-- the final seat. Platform-owner workspaces remain exempt.
create or replace function public.enforce_workspace_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  workspace_owner uuid;
  owner_role text := 'user';
  owner_status text := 'active';
  owner_email text;
  owner_plan text := 'free';
  owner_is_platform_admin boolean := false;
  owner_has_agency_subscription boolean := false;
  current_seats bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text, 2));

  select owner_id into workspace_owner
  from public.workspaces
  where id = new.workspace_id;

  select coalesce(role, 'user'), coalesce(status, 'active'), email, coalesce(plan, 'free')
  into owner_role, owner_status, owner_email, owner_plan
  from public.users_profile
  where id = workspace_owner;

  owner_is_platform_admin := owner_status = 'active'
    and owner_role = 'admin'
    and exists (
      select 1 from public.admin_allowlist
      where lower(admin_allowlist.email) = lower(owner_email)
    );
  owner_has_agency_subscription := owner_status = 'active'
    and owner_plan = 'agency'
    and exists (
      select 1 from public.subscriptions
      where user_id = workspace_owner
        and plan = 'agency'
        and status in ('active', 'trialing')
    );

  if owner_is_platform_admin then
    return new;
  end if;

  if not owner_has_agency_subscription then
    raise exception 'An active Agency plan is required.'
      using errcode = '23514', hint = 'Renew Agency before adding a workspace member.';
  end if;

  if exists (
    select 1 from public.workspace_members
    where workspace_id = new.workspace_id and user_id = new.user_id
  ) then
    return new;
  end if;

  -- The owner is one logical seat even if a legacy workspace is missing its
  -- denormalized owner membership row. Restoring that row never adds a person.
  if new.user_id = workspace_owner then
    return new;
  end if;

  select 1 + count(*) into current_seats
  from public.workspace_members
  where workspace_id = new.workspace_id
    and user_id <> workspace_owner;

  if current_seats >= 5 then
    raise exception 'Agency workspace seat limit reached.'
      using
        errcode = '23514',
        detail = 'Agency includes five total seats.',
        hint = 'Remove a member before accepting another invitation.';
  end if;

  return new;
end;
$$;

drop trigger if exists workspace_members_enforce_seat_limit on public.workspace_members;
create trigger workspace_members_enforce_seat_limit
  before insert on public.workspace_members
  for each row execute function public.enforce_workspace_seat_limit();

create or replace function public.protect_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'authenticated'
     and pg_trigger_depth() <= 1
     and old.user_id = (
    select owner_id from public.workspaces where id = old.workspace_id
  ) then
    raise exception 'The workspace owner membership cannot be removed.'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

drop trigger if exists workspace_members_protect_owner_delete on public.workspace_members;
create trigger workspace_members_protect_owner_delete
  before delete on public.workspace_members
  for each row execute function public.protect_workspace_owner_membership();

-- Workspace access is inherited, but a copied users_profile.plan must never
-- outlive the owner's entitlement. Keep the legacy profile column synchronized
-- for routes/UI that have not yet moved to dynamic effective-access lookup.
-- When an owner loses Agency (or is deactivated), each member falls back to
-- their own active subscription, if any, otherwise Free.
create or replace function public.sync_workspace_member_plans()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owned_workspace_id uuid;
  inherited_plan text;
  owner_is_platform_admin boolean;
  owner_has_agency_subscription boolean;
begin
  if new.plan is not distinct from old.plan
     and new.role is not distinct from old.role
     and new.status is not distinct from old.status then
    return new;
  end if;

  for owned_workspace_id in
    select id from public.workspaces where owner_id = new.id
  loop
    perform pg_advisory_xact_lock(hashtextextended(owned_workspace_id::text, 3));

    owner_is_platform_admin := new.status = 'active'
      and new.role = 'admin'
      and exists (
        select 1 from public.admin_allowlist
        where lower(admin_allowlist.email) = lower(new.email)
      );
    owner_has_agency_subscription := new.status = 'active'
      and new.plan = 'agency'
      and exists (
        select 1 from public.subscriptions
        where user_id = new.id
          and plan = 'agency'
          and status in ('active', 'trialing')
      );
    inherited_plan := case
      when owner_is_platform_admin or owner_has_agency_subscription then 'agency'
      else null
    end;

    update public.users_profile as member
    set
      plan = coalesce(
        inherited_plan,
        (
          select subscription.plan
          from public.subscriptions as subscription
          where subscription.user_id = member.id
            and subscription.status in ('active', 'trialing')
            and subscription.plan in ('pro', 'agency')
          order by subscription.updated_at desc
          limit 1
        ),
        'free'
      ),
      updated_at = now()
    where member.id in (
      select workspace_member.user_id
      from public.workspace_members as workspace_member
      where workspace_member.workspace_id = owned_workspace_id
        and workspace_member.user_id <> new.id
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists users_profile_sync_workspace_member_plans on public.users_profile;
create trigger users_profile_sync_workspace_member_plans
  after update of plan, role, status on public.users_profile
  for each row execute function public.sync_workspace_member_plans();

-- Repair stale copied plans immediately when this migration is applied.
do $$
declare
  owner_profile public.users_profile%rowtype;
  inherited_owner_plan text;
begin
  for owner_profile in
    select profile.*
    from public.users_profile as profile
    where exists (select 1 from public.workspaces where owner_id = profile.id)
  loop
    -- The AFTER trigger only handles future entitlement changes, so repair
    -- existing member rows directly during the initial migration.
    inherited_owner_plan := case
      when owner_profile.status = 'active'
           and owner_profile.role = 'admin'
           and exists (
             select 1 from public.admin_allowlist
             where lower(admin_allowlist.email) = lower(owner_profile.email)
           )
        then 'agency'
      when owner_profile.status = 'active'
           and owner_profile.plan = 'agency'
           and exists (
             select 1 from public.subscriptions
             where user_id = owner_profile.id
               and plan = 'agency'
               and status in ('active', 'trialing')
           )
        then 'agency'
      else null
    end;

    update public.users_profile as member
    set
      plan = coalesce(
        inherited_owner_plan,
        (
          select subscription.plan
          from public.subscriptions as subscription
          where subscription.user_id = member.id
            and subscription.status in ('active', 'trialing')
            and subscription.plan in ('pro', 'agency')
          order by subscription.updated_at desc
          limit 1
        ),
        'free'
      ),
      updated_at = now()
    where member.id in (
      select workspace_member.user_id
      from public.workspace_members as workspace_member
      join public.workspaces as workspace
        on workspace.id = workspace_member.workspace_id
      where workspace.owner_id = owner_profile.id
        and workspace_member.user_id <> owner_profile.id
    );
  end loop;
end;
$$;
