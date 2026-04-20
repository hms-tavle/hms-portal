-- Add created_by to associations so member insert policy can verify ownership
-- without querying association_members (which caused infinite recursion).

alter table public.associations
  add column created_by uuid references auth.users(id);

-- Creator can always see their own association (needed during onboarding before
-- membership row exists).
drop policy "members can view their associations" on public.associations;

create policy "members can view their associations"
  on public.associations
  for select
  to authenticated
  using (
    id in (select public.get_my_association_ids())
    or created_by = auth.uid()
  );

-- Enforce that the creator field matches the inserting user.
drop policy "authenticated users can create associations" on public.associations;

create policy "authenticated users can create associations"
  on public.associations
  for insert
  to authenticated
  with check (created_by = auth.uid());

-- Replace member insert policy: allow if already a member OR if the inserting
-- user created the association (covers onboarding bulk insert).
-- No recursion: subquery is on associations, not association_members.
drop policy "authenticated users can insert members" on public.association_members;

create policy "authenticated users can insert members"
  on public.association_members
  for insert
  to authenticated
  with check (
    association_id in (select public.get_my_association_ids())
    or association_id in (
      select id from public.associations where created_by = auth.uid()
    )
  );

-- Clean up the is_new_association function — no longer needed.
drop function if exists public.is_new_association(uuid);