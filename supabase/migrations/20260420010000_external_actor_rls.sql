-- Helper function to check if a user is an external actor in an association
create or replace function is_external_actor(assoc_id uuid) returns boolean as $$
select role_code = 'EKST'
from association_members
where user_id = auth.uid()
  and association_id = assoc_id
limit 1;
$$ language sql security definer;

-- =====================
-- TASK_ASSIGNMENTS RLS
-- =====================

-- Drop existing policies
drop policy if exists "Members can read assignments" on task_assignments;
drop policy if exists "Members can insert assignments" on task_assignments;
drop policy if exists "Members can update assignments" on task_assignments;
drop policy if exists "Members can delete assignments" on task_assignments;

-- New policies: external actors see only their assigned tasks
create policy "Members can read assignments"
  on task_assignments for select
  using (
    association_id in (select * from get_my_association_ids())
    and (
      -- Regular members see all
      not is_external_actor(association_id)
      or
      -- External actors see only their own
      assigned_to in (
        select id from association_members
        where user_id = auth.uid()
      )
    )
  );

create policy "Members can insert assignments"
  on task_assignments for insert
  with check (association_id in (select * from get_my_association_ids()));

create policy "Members can update assignments"
  on task_assignments for update
  using (association_id in (select * from get_my_association_ids()));

create policy "Members can delete assignments"
  on task_assignments for delete
  using (association_id in (select * from get_my_association_ids()));

-- =====================
-- TASK_COMPLETIONS RLS
-- =====================

-- Drop existing select policy
drop policy if exists "members can view their association completions" on task_completions;
drop policy if exists "members can insert completions for their association" on task_completions;

-- New select policy: external actors see only completions for their assigned tasks
create policy "members can view their association completions"
  on task_completions for select to authenticated
  using (
    association_id in (select public.get_my_association_ids())
    and (
      -- Regular members see all
      not is_external_actor(association_id)
      or
      -- External actors see only completions for their assigned tasks
      exists (
        select 1 from task_assignments
        where task_assignments.association_id = task_completions.association_id
          and task_assignments.task_template_id = task_completions.task_template_id
          and task_assignments.assigned_to in (
            select id from association_members
            where user_id = auth.uid()
          )
      )
    )
  );

-- New insert policy: external actors can only insert for their assigned tasks
create policy "members can insert completions for their association"
  on task_completions for insert to authenticated
  with check (
    association_id in (select public.get_my_association_ids())
    and (
      -- Regular members can insert freely
      not is_external_actor(association_id)
      or
      -- External actors can only insert for their assigned tasks
      exists (
        select 1 from task_assignments
        where task_assignments.association_id = task_completions.association_id
          and task_assignments.task_template_id = task_completions.task_template_id
          and task_assignments.assigned_to in (
            select id from association_members
            where user_id = auth.uid()
          )
      )
    )
  );
