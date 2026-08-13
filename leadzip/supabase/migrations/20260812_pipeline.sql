-- 20260812_pipeline.sql
-- CRM Pipeline: per-lead sales stage on the saved leads table.
--
-- Adds two columns used by the Pipeline board on /saved:
--   pipeline_stage   - one of: new | contacted | replied | meeting | proposal | won | lost
--                      (validated server-side in /api/leads/pipeline; no CHECK constraint so
--                      future stage additions never need a migration)
--   stage_updated_at - when the lead last moved between stages
--
-- Idempotent and non-destructive: safe to run on a fresh or existing database.
-- Run in Supabase: Dashboard -> SQL Editor -> New query -> paste + run.

alter table if exists public.leads
  add column if not exists pipeline_stage   text not null default 'new',
  add column if not exists stage_updated_at timestamptz;

-- Board loads are always "this user's leads grouped by stage"
create index if not exists leads_user_stage_idx
  on public.leads (user_id, pipeline_stage);
