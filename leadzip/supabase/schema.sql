-- ============================================================
-- LeadZip Supabase Schema
-- ============================================================

-- ── Users Profile (extends auth.users) ─────────────────────
create table public.users_profile (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  company_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  plan text not null default 'free' check (plan in ('free', 'pro', 'agency')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Leads table ─────────────────────────────────────────────
create table public.leads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  business_name text not null,
  category text,
  address text,
  city text,
  state text,
  zip_code text,
  phone text,
  website text,
  rating decimal(2,1),
  review_count integer,
  latitude decimal(9,6),
  longitude decimal(9,6),
  distance_miles decimal(6,2),
  lead_score integer not null default 0,
  status text not null default 'new' check (
    status in ('new','contacted','interested','not_interested','follow_up','converted')
  ),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Search History ──────────────────────────────────────────
create table public.search_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  zip_code text not null,
  radius integer not null default 25,
  category text,
  keyword text,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── Usage Limits ────────────────────────────────────────────
create table public.usage_limits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique not null,
  searches_this_month integer not null default 0,
  saved_leads_count integer not null default 0,
  exports_count integer not null default 0,
  last_reset_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Export History ──────────────────────────────────────────
create table public.export_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  filename text not null,
  lead_count integer not null default 0,
  format text not null default 'csv',
  fields jsonb,
  created_at timestamptz not null default now()
);

-- ── Subscriptions (Stripe-ready) ────────────────────────────
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free',
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.users_profile enable row level security;
alter table public.leads enable row level security;
alter table public.search_history enable row level security;
alter table public.usage_limits enable row level security;
alter table public.export_history enable row level security;
alter table public.subscriptions enable row level security;

-- ── RLS Policies ────────────────────────────────────────────

-- users_profile
create policy "Users can view own profile"
  on public.users_profile for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users_profile for update
  using (auth.uid() = id);

-- leads
create policy "Users can manage own leads"
  on public.leads for all
  using (auth.uid() = user_id);

-- search_history
create policy "Users can manage own search history"
  on public.search_history for all
  using (auth.uid() = user_id);

-- usage_limits
create policy "Users can view own usage limits"
  on public.usage_limits for all
  using (auth.uid() = user_id);

-- export_history
create policy "Users can view own export history"
  on public.export_history for all
  using (auth.uid() = user_id);

-- subscriptions
create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ============================================================
-- Functions & Triggers
-- ============================================================

-- Auto-create profile + usage record on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users_profile (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );

  insert into public.usage_limits (user_id)
  values (new.id);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at on leads
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on public.leads
  for each row execute procedure public.set_updated_at();

create trigger users_profile_updated_at
  before update on public.users_profile
  for each row execute procedure public.set_updated_at();

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

create trigger usage_limits_updated_at
  before update on public.usage_limits
  for each row execute procedure public.set_updated_at();

-- Reset monthly usage counts (call via pg_cron or Supabase scheduled function)
create or replace function public.reset_monthly_usage()
returns void as $$
begin
  update public.usage_limits
  set
    searches_this_month = 0,
    exports_count = 0,
    last_reset_at = now(),
    updated_at = now()
  where date_trunc('month', last_reset_at) < date_trunc('month', now());
end;
$$ language plpgsql security definer;

-- ============================================================
-- Indexes
-- ============================================================

create index leads_user_id_idx on public.leads(user_id);
create index leads_status_idx on public.leads(status);
create index leads_created_at_idx on public.leads(created_at desc);
create index search_history_user_id_idx on public.search_history(user_id);
create index search_history_created_at_idx on public.search_history(created_at desc);
create index export_history_user_id_idx on public.export_history(user_id);
create index subscriptions_stripe_customer_id_idx on public.subscriptions(stripe_customer_id);
