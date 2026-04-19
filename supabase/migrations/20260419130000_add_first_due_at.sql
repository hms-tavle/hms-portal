-- Allows custom tasks to specify when the first deadline falls.
-- Seeded tasks leave this null (they are already "running").
ALTER TABLE public.task_templates
  ADD COLUMN first_due_at timestamptz;
