ALTER TABLE public.users_profile
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deactivated'));

CREATE INDEX IF NOT EXISTS users_profile_status_idx
  ON public.users_profile(status);

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
  INSERT INTO public.users_profile (id, email, full_name, role, plan, status)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', v_role, v_plan, 'active')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.usage_limits (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
