-- =====================
-- USER PROFILES
-- One row per auth user. Represents the personal workspace identity.
-- Created on individual signup, or auto-created when claiming an invite.
-- =====================

create table public.user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "users can view own profile"
  on public.user_profiles for select to authenticated
  using (id = auth.uid());

create policy "users can insert own profile"
  on public.user_profiles for insert to authenticated
  with check (id = auth.uid());

create policy "users can update own profile"
  on public.user_profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- =====================
-- PERSONAL TASK COMPLETIONS
-- Make association_id nullable so personal (non-association) tasks can be recorded.
-- Existing association completions are unaffected (association_id still set).
-- =====================

alter table public.task_completions
  alter column association_id drop not null;

-- Personal completions are visible only to the user who completed them
create policy "users can view own personal completions"
  on public.task_completions for select to authenticated
  using (association_id is null and completed_by = auth.uid());

create policy "users can insert own personal completions"
  on public.task_completions for insert to authenticated
  with check (association_id is null and completed_by = auth.uid());

create policy "users can delete own personal completions"
  on public.task_completions for delete to authenticated
  using (association_id is null and completed_by = auth.uid());

-- =====================
-- UPDATE claim_invite()
-- After claiming, ensure a user_profiles row exists for the new user.
-- Uses RETURNING to grab full_name from the member row (sourced from brreg).
-- ON CONFLICT DO NOTHING: safe to call even if the user already has a profile.
-- =====================

create or replace function public.claim_invite(token uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_full_name text;
begin
  update public.association_members
  set
    user_id           = auth.uid(),
    invite_token      = null,
    invite_expires_at = null
  where
    invite_token      = token
    and invite_expires_at > now()
    and user_id       is null
  returning full_name into v_full_name;

  if not found then
    raise exception 'Invalid or expired invite token';
  end if;

  insert into public.user_profiles (id, full_name)
  values (auth.uid(), v_full_name)
  on conflict (id) do nothing;
end;
$$;
