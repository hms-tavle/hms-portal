create table task_assignments (
  id                uuid primary key default gen_random_uuid(),
  association_id    uuid not null references associations(id) on delete cascade,
  task_template_id  uuid not null references task_templates(id) on delete cascade,
  assigned_to       uuid not null references association_members(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique(association_id, task_template_id)
);

alter table task_assignments enable row level security;

create policy "Members can read assignments"
  on task_assignments for select
  using (association_id in (select * from get_my_association_ids()));

create policy "Members can insert assignments"
  on task_assignments for insert
  with check (association_id in (select * from get_my_association_ids()));

create policy "Members can update assignments"
  on task_assignments for update
  using (association_id in (select * from get_my_association_ids()));

create policy "Members can delete assignments"
  on task_assignments for delete
  using (association_id in (select * from get_my_association_ids()));
