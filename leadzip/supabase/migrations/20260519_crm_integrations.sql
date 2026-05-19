create table if not exists public.crm_integrations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  crm_type text not null check (crm_type in ('hubspot', 'gohighlevel', 'pipedrive')),
  api_key text not null,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  unique(user_id, crm_type)
);

-- Accessed only via service role — no RLS needed
