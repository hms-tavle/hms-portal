-- Enforce external actor task restriction at DB level.
-- Previously, task_templates were readable by all association members and
-- filtering to assigned-only was done client-side. This adds a second gate:
-- external actors (EKST) can only read tasks assigned to them.

DROP POLICY "view task templates" ON public.task_templates;

CREATE POLICY "view task templates"
  ON public.task_templates FOR SELECT
  USING (
    (
      created_by IS NULL
      OR created_by = auth.uid()
      OR association_id IN (SELECT public.get_my_association_ids())
    )
    AND (
      NOT public.is_external_actor()
      OR EXISTS (
        SELECT 1
        FROM public.task_assignments ta
        JOIN public.association_members am ON am.id = ta.assigned_to
        WHERE ta.task_template_id = task_templates.id
          AND am.user_id = auth.uid()
      )
    )
  );