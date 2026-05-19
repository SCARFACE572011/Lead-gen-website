-- ============================================================
-- Admin Setup: Grant SCARFACE572011@live.com full admin access
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Update the user's profile to admin + agency plan
UPDATE public.users_profile
SET
  role = 'admin',
  plan = 'agency',
  updated_at = now()
WHERE email ILIKE 'scarface572011@live.com';

-- 2. Add the leads_cache table (if not already created)
CREATE TABLE IF NOT EXISTS public.leads_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text NOT NULL UNIQUE,
  leads jsonb NOT NULL DEFAULT '[]',
  total integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'osm',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leads_cache' AND policyname = 'Service role can manage cache'
  ) THEN
    CREATE POLICY "Service role can manage cache"
      ON public.leads_cache FOR ALL
      USING (true);
  END IF;
END $$;

-- 3. Add increment_searches function (if not already created)
CREATE OR REPLACE FUNCTION public.increment_searches(uid uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.usage_limits
  SET
    searches_this_month = searches_this_month + 1,
    updated_at = now()
  WHERE user_id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update the new-user trigger to auto-grant admin to this email on future signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role text := 'user';
  v_plan text := 'free';
BEGIN
  IF lower(new.email) = 'scarface572011@live.com' THEN
    v_role := 'admin';
    v_plan := 'agency';
  END IF;

  INSERT INTO public.users_profile (id, email, full_name, role, plan)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    v_role,
    v_plan
  );

  INSERT INTO public.usage_limits (user_id)
  VALUES (new.id);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the change
SELECT id, email, role, plan FROM public.users_profile
WHERE email ILIKE 'scarface572011@live.com';
