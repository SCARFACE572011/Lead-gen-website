-- 20260811_leads_enrichment_columns.sql
-- Add the enrichment columns the "save lead" feature writes.
--
-- WHY THIS EXISTS: /api/leads/save writes an "enriched" row (email finder result,
-- socials, firmographics). If ANY of these columns is missing, PostgREST rejects
-- the whole row (PGRST204 / 42703) and the route falls back to saving only the
-- core fields — so a found email / social profile is silently DROPPED on save.
-- Production was missing all 8 of these, so the Hunter.io email finder result
-- never persisted. This adds them so enriched saves succeed.
--
-- Idempotent — safe to run on a fresh or existing database (add column if not
-- exists). Run in Supabase: Dashboard → SQL Editor → New query → paste + run.

alter table if exists public.leads
  add column if not exists email                 text,
  add column if not exists email_confidence      text,     -- 'verified' | 'likely' | 'guessed'
  add column if not exists employee_count        integer,
  add column if not exists revenue_estimate      text,
  add column if not exists facebook_url          text,
  add column if not exists instagram_url         text,
  add column if not exists linkedin_url          text,
  add column if not exists digital_health_score  integer;  -- 0–100, like lead_score
