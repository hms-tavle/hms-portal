-- =====================
-- TABLES
-- =====================

create table public.associations (
  id               uuid primary key default gen_random_uuid(),
  orgnr            text unique not null,
  navn             text not null,
  org_form         text not null,
  poststed         text,
  status           text not null default 'trial'
                     check (status in ('trial', 'active', 'expired')),
  trial_started_at timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create table public.association_members (
  id               uuid primary key default gen_random_uuid(),
  association_id   uuid not null references public.associations(id) on delete cascade,
  user_id          uuid references auth.users(id) on delete set null,
  role_code        text not null,
  full_name        text not null,
  email            text,
  created_at       timestamptz not null default now()
);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

alter table public.associations enable row level security;
alter table public.association_members enable row level security;

-- Anyone (anon) can check if an org already has an active subscription
-- (needed for the signup duplicate-check before the user has an account)
create policy "anon can check association status"
  on public.associations
  for select
  to anon
  using (true);

-- Authenticated members can see their own associations
create policy "members can view their associations"
  on public.associations
  for select
  to authenticated
  using (
    id in (
      select association_id from public.association_members
      where user_id = auth.uid()
    )
  );

-- Authenticated users can create a new association (during onboarding)
create policy "authenticated users can create associations"
  on public.associations
  for insert
  to authenticated
  with check (true);

-- Members can view all members of their association
create policy "members can view association members"
  on public.association_members
  for select
  to authenticated
  using (
    association_id in (
      select association_id from public.association_members
      where user_id = auth.uid()
    )
  );

-- Authenticated users can insert members (during onboarding)
create policy "authenticated users can insert members"
  on public.association_members
  for insert
  to authenticated
  with check (true);
