-- Extend task_templates to support user-defined custom tasks.
-- Seeded tasks: created_by IS NULL, association_id IS NULL (global).
-- Custom tasks: created_by = owner, association_id = association or NULL for personal.

ALTER TABLE public.task_templates
  ALTER COLUMN category DROP NOT NULL,
  ADD COLUMN association_id uuid REFERENCES public.associations(id) ON DELETE CASCADE,
  ADD COLUMN created_by uuid REFERENCES auth.users(id),
  ADD COLUMN created_at timestamptz DEFAULT now();

-- Seeded tasks were publicly readable; scope that to seeded-only and add ownership rules.
DROP POLICY "anyone can read task templates" ON public.task_templates;

CREATE POLICY "view task templates"
  ON public.task_templates FOR SELECT
  USING (
    created_by IS NULL
    OR created_by = auth.uid()
    OR association_id IN (SELECT public.get_my_association_ids())
  );

CREATE POLICY "authenticated can create custom tasks"
  ON public.task_templates FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "creator can update custom tasks"
  ON public.task_templates FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "creator can delete custom tasks"
  ON public.task_templates FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Allow personal-workspace completions (no association).
ALTER TABLE public.task_completions
  ALTER COLUMN association_id DROP NOT NULL;

DROP POLICY "members can view their association completions" ON public.task_completions;
CREATE POLICY "view task completions"
  ON public.task_completions FOR SELECT
  TO authenticated
  USING (
    association_id IN (SELECT public.get_my_association_ids())
    OR (association_id IS NULL AND completed_by = auth.uid())
  );

DROP POLICY "members can insert completions for their association" ON public.task_completions;
CREATE POLICY "insert task completions"
  ON public.task_completions FOR INSERT
  TO authenticated
  WITH CHECK (
    association_id IN (SELECT public.get_my_association_ids())
    OR (association_id IS NULL AND completed_by = auth.uid())
  );

DROP POLICY "Members can delete their own task completions" ON public.task_completions;
CREATE POLICY "delete own task completions"
  ON public.task_completions FOR DELETE
  TO authenticated
  USING (
    completed_by = auth.uid()
    AND (
      association_id IN (SELECT public.get_my_association_ids())
      OR association_id IS NULL
    )
  );
