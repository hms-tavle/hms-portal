alter table public.associations
  add column disabled_features text[] not null default '{}';

create policy "members can update their association"
  on public.associations
  for update
  to authenticated
  using (id in (select public.get_my_association_ids()))
  with check (true);
