-- Workspaces (one per agency owner)
create table if not exists public.workspaces (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(owner_id)
);

-- Workspace members (owner is also a row here with role 'owner')
create table if not exists public.workspace_members (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  unique(workspace_id, user_id)
);

-- Workspace invitations (token-based, 7-day expiry)
create table if not exists public.workspace_invitations (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz default now()
);

-- Link users_profile to a workspace (set when accepting invite)
alter table public.users_profile add column if not exists workspace_id uuid references public.workspaces(id);
