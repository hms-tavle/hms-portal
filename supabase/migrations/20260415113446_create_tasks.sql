-- =====================
-- TASK TEMPLATES
-- =====================

create table public.task_templates (
  id                    uuid primary key default gen_random_uuid(),
  category              text not null,
  category_label        text not null,
  title                 text not null,
  description           text,
  legal_basis           text,
  recurrence            text not null check (recurrence in (
                          'daily', 'monthly', 'quarterly', 'twice_yearly',
                          'annually', 'every_2_years', 'every_5_years',
                          'every_5_7_years', 'every_10_years', 'per_project'
                        )),
  requires_professional boolean not null default false,
  is_conditional        boolean not null default false,
  sort_order            integer not null default 0
);

-- Task templates are global and readable by everyone
alter table public.task_templates enable row level security;

create policy "anyone can read task templates"
  on public.task_templates for select using (true);

-- =====================
-- TASK COMPLETIONS
-- =====================

create table public.task_completions (
  id               uuid primary key default gen_random_uuid(),
  association_id   uuid not null references public.associations(id) on delete cascade,
  task_template_id uuid not null references public.task_templates(id) on delete cascade,
  completed_by     uuid references auth.users(id) on delete set null,
  completed_at     timestamptz not null default now(),
  notes            text
);

alter table public.task_completions enable row level security;

create policy "members can view their association completions"
  on public.task_completions for select to authenticated
  using (association_id in (select public.get_my_association_ids()));

create policy "members can insert completions for their association"
  on public.task_completions for insert to authenticated
  with check (association_id in (select public.get_my_association_ids()));
