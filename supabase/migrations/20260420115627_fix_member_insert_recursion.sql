-- The previous member insert policy caused infinite recursion because the
-- NOT EXISTS subquery on association_members triggered the same policy.
-- Fix: wrap the check in a SECURITY DEFINER function (bypasses RLS),
-- same pattern as get_my_association_ids().

create or replace function public.is_new_association(assoc_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.association_members
    where association_id = assoc_id
  );
$$;

drop policy "authenticated users can insert members" on public.association_members;

create policy "authenticated users can insert members"
  on public.association_members
  for insert
  to authenticated
  with check (
    association_id in (select public.get_my_association_ids())
    or public.is_new_association(association_id)
  );