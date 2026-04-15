create policy "Members can delete their association's task completions"
  on public.task_completions for delete
  to authenticated
  using (association_id in (select * from get_my_association_ids()));