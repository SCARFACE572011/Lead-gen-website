-- 20260811_admin_emails.sql
-- Make the owner auto-admin list permanent. Adds jezdangomez@gmail.com alongside
-- scarface572011@live.com so these accounts get role=admin + plan=agency (unlimited)
-- automatically on signup. Also backfills any existing rows for those emails.
-- Idempotent — safe to re-run.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_role text := 'user';
  v_plan text := 'free';
begin
  -- Owner / admin accounts get full admin + agency access automatically on signup
  if lower(new.email) in ('scarface572011@live.com', 'jezdangomez@gmail.com') then
    v_role := 'admin';
    v_plan := 'agency';
  end if;

  insert into public.users_profile (id, email, full_name, role, plan)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', v_role, v_plan);

  insert into public.usage_limits (user_id) values (new.id);

  return new;
end;
$$ language plpgsql security definer;

-- Backfill: promote these owner emails if they already have a profile
update public.users_profile
set role = 'admin', plan = 'agency', updated_at = now()
where lower(email) in ('scarface572011@live.com', 'jezdangomez@gmail.com');
