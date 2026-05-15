-- Run in Supabase Dashboard > SQL Editor
create table if not exists leads (
  id           text primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  business_name text not null,
  category     text,
  address      text,
  city         text,
  state        text,
  zip_code     text,
  phone        text,
  website      text,
  rating       numeric,
  review_count integer,
  latitude     numeric,
  longitude    numeric,
  distance_miles numeric,
  lead_score   integer,
  status       text default 'new',
  notes        text default '',
  created_at   timestamptz default now(),
  saved_at     timestamptz default now()
);
create index if not exists leads_user_id_idx on leads(user_id);
alter table leads enable row level security;
create policy "Users can manage their own leads" on leads
  for all using (auth.uid() = user_id);
