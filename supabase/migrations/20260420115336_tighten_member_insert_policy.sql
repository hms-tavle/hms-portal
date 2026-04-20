-- Tighten member insert: allow only if the user is already a member of the
-- association (covers adding external actors) OR the association has no members
-- yet (covers onboarding, where the user is creating the association fresh).
-- Prevents IDOR where any authenticated user could inject themselves into an
-- existing association by guessing its UUID.
drop policy "authenticated users can insert members" on public.association_members;

create policy "authenticated users can insert members"
  on public.association_members
  for insert
  to authenticated
  with check (
    association_id in (select public.get_my_association_ids())
    or not exists (
      select 1 from public.association_members existing
      where existing.association_id = association_members.association_id
    )
  );