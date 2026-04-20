-- Restrict anon SELECT on associations to active orgs only.
-- The onboarding duplicate-check (orgnr + status = 'active') still works.
-- Trial orgs are no longer enumerable by unauthenticated users.
drop policy "anon can check association status" on public.associations;

create policy "anon can check association status"
  on public.associations
  for select
  to anon
  using (status = 'active');