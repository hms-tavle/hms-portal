-- A security definer function queries association_members without triggering
-- its own RLS policy, breaking the infinite recursion.
create or replace function public.get_my_association_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select association_id from public.association_members where user_id = auth.uid()
$$;

-- Fix the self-referential policy on association_members
drop policy "members can view association members" on public.association_members;

create policy "members can view association members"
  on public.association_members
  for select
  to authenticated
  using (association_id in (select public.get_my_association_ids()));

-- Fix the associations policy to use the same function
drop policy "members can view their associations" on public.associations;

create policy "members can view their associations"
  on public.associations
  for select
  to authenticated
  using (id in (select public.get_my_association_ids()));
