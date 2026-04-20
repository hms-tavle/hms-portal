# HMS - Helse, Miljø og Sikkerhetskrav

## Project Overview
A React frontend with Supabase backend for managing HMS (Health, Safety and Environment) compliance checklists for Norwegian housing associations (Borettslag and Sameier).

## Core Features
1. **Auth** — Supabase auth with email/password sign-in
2. **Multi-member** — Housing association admin can invite/add members
3. **Recurring tasks** — Tasks that repeat on a schedule (weekly, monthly, annually, etc.)
4. **Task assignment** — Tasks can be assigned to specific members
5. **Legal compliance** — Tasks are grounded in Norwegian law requirements for housing associations
6. **Individual users** — Users can register as individuals (personal workspace) and also belong to one or more associations

## Domain Language
- **Borettslag** — Housing cooperative (members own shares)
- **Sameie** — Co-ownership association (members own units directly)
- **HMS** — Helse, Miljø og Sikkerhet (Health, Environment, Safety)
- **Housing association** — Collective term for both Borettslag and Sameier
- **Styreleder** — Board chair (required role, must have email on signup)
- **Styremedlem** — Board member
- **Varamedlem** — Deputy board member

## Tech Stack
- **Frontend**: React + TypeScript, bundled with Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Forms**: react-hook-form + zod
- **Backend/Auth/DB**: Supabase
- **Auth method**: Email + password
- **Notifications**: Resend (free tier) + Supabase Edge Functions + pg_cron — not yet implemented

## Build Order (Vertical Slice)
1. Project scaffolding — Vite + React + TypeScript + shadcn/ui + Supabase
2. Auth — sign-up / login
3. Onboarding — Brønnøysundregisteret lookup + association creation + member setup
4. Task list — pre-seeded legal HMS tasks for the association
5. Mark task as done

## Key Decisions

### Data model
- A user can belong to multiple housing associations (many-to-many: `user ↔ association_member ↔ association`)
- Roles per association are sourced from Brønnøysundregisteret (`styreleder`, `styremedlem`, `varamedlem`, etc.)
- Subscription status lives on the **association** level, not the user level

### Onboarding / Signup flow
1. Registrant looks up their housing association by org number or name via **Brønnøysundregisteret API** (`data.brreg.no`)
2. System checks: does this org already have an `active` (paying) subscription?
   - **Active subscription exists** → block signup, show *"This organization already has an active account. Contact us if you believe this is an error."*
   - **No active subscription** → proceed
3. System fetches board members (roller) from the registry and displays them
4. Registrant must provide an email for the `styreleder` (required)
5. Emails for other members are optional — members without email are created but cannot log in until email is added later
6. No name/identity verification on signup — adds friction for zero security gain; all registry data is already public
7. Registrant's account is created and the trial period starts

### Invite model (after initial setup)
- Only existing members of an association can invite new members
- No self-registration into an existing association

### Monetization & verification
- **Trial**: 1 month free, full access, no verification
- **Expired**: access locked — user contacts app owner to activate
- **Active**: manually approved and paid, access restored
- The manual payment review step serves as identity verification — the app owner confirms the person is legitimate before activating
- **Fraud heuristic**: bad actors won't pay → a paying subscription signals a legitimate owner. Blocking new signups for orgs with an active subscription prevents most abuse with no extra complexity.

### Subscription status values
- `trial` — within the free trial period
- `expired` — trial ended, awaiting manual activation
- `active` — paying, manually verified

### Key fields on association record
- `trial_started_at` — timestamp when trial began
- `status` — `trial | active | expired`

## Implementation Status

### Done
- Vite + React + TypeScript scaffolded
- shadcn/ui + Tailwind CSS (v4) configured
- Supabase client wired via `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`
- React Router with `HashRouter` (required for GitHub Pages static hosting)
- Login page (`/login`) — email + password, links to onboarding
- Onboarding flow (`/onboarding`):
  - Step 1: Search by name or 9-digit org number via Brønnøysundregisteret API
  - Step 2: Board members fetched from `/roller`, emails collected, password set
  - On submit: active subscription check → `signUp()` → insert association → insert members
  - Blocks signup only if org has `status = 'active'` — multiple trial registrations allowed
  - `crypto.randomUUID()` used client-side for association ID to avoid RLS SELECT issue after insert
- Auth session management (`src/lib/auth.tsx`) — `AuthProvider` + `useAuth` hook via `onAuthStateChange`
- `ProtectedRoute` component — redirects to `/login` if no session
- Shared `Layout` component (`src/components/Layout.tsx`) — sticky header + workspace switcher + nav bar (Oppgaver / Medlemmer)
- Dashboard (`/dashboard`) — year-based tabs (Forfalt / current year / future years / Ved behov)
  - Tasks grouped by next due date year, not category
  - Category shown as secondary label within each tab
  - Mark task done with custom date picker (defaults to today, capped at today)
  - Expandable history per task showing compliance timeline
  - Missed/undocumented slots computed and shown in red (`⚠ N ikke dokumentert`)
  - Delete own completions (× button), read-only for others' entries
  - Completer name shown in history
  - Sub-annual count display (e.g. `1/2 utført i 2026` for twice_yearly)
  - Personal workspace shows empty state ("Ingen oppgaver ennå")
- Members page (`/members`) — lists all association members with role, email, active/inactive status
  - Invite flow: "Inviter" generates a 7-day UUID token, shows copyable link with X to dismiss
  - "Forny" regenerates an expired token
  - Personal workspace shows unavailable message
- Invite page (`/invite?token=...`) — unauthenticated, validates token, shows member name/role
  - If already logged in: one-click claim ("Bli med i [association]")
  - If not logged in: tab switcher between "Logg inn" and "Opprett konto", then claims invite
  - `claim_invite(token uuid)` security definer function links user_id, syncs auth email into `association_members.email` (coalesce — preserves onboarding email if set), clears token, creates user_profiles row
- Individual registration (`/register`) — simple signup (name, email, password), creates `user_profiles` row
- Workspace switcher — top-level tabs in Layout; shown only when user has >1 workspace; defaults to first association
  - `refreshWorkspaces()` reads from `supabase.auth.getSession()` (not React `session` state) so it works immediately after `signUp()` — React state is still null at that point due to deferred re-render
- Task list — all 28 pre-seeded legal HMS tasks
- Supabase migrations applied (see Migrations section)
- RLS: `get_my_association_ids()` security definer function breaks infinite recursion
- GitHub Pages deployed at `https://hms-tavle.github.io/hms-portal/` via GitHub Actions
- Task assignment — inline "Ansvarlig" dropdown per task row; stored in `task_assignments` table
- Codebase refactored: shared constants, types, and hooks extracted (see Codebase Structure below)
- Custom tasks — user-defined recurring tasks for both personal and association workspaces
  - Merged into `task_templates` table (`created_by` + `association_id` columns distinguish custom from seeded)
  - Seeded tasks: `created_by IS NULL` (global, public). Custom tasks: `created_by = owner`
  - Any member can create; only creator can edit/delete (pencil/trash icons on row)
  - `task_completions.association_id` made nullable to support personal workspace completions
  - Personal workspace now shows custom tasks instead of empty state
  - Assignments work for custom tasks in associations (same `task_assignments` table)
  - `CustomTaskModal` — title (required), recurrence (required), first deadline date, category label + description (optional)
  - `first_due_at` on `task_templates` — sets initial due date for custom tasks; defaults to today + interval; hidden for `per_project`
  - Tasks within each year-tab sorted by next due date ascending
  - Migrations: `20260419120000_add_custom_tasks.sql`, `20260419130000_add_first_due_at.sql`
- Edit member info — inline editing on `/members` page
  - Click pencil icon on member row → fields become editable (name, email, role)
  - Validation: name required, email format check, role from enum
  - Save/Cancel buttons; RLS already allows authenticated members to update in their association
- External actors (`EKST` role) — contractors/inspectors with limited access
  - Added via "Legg til ekstern aktør" on members page; org lookup via Brønnøysundregisteret
  - Dashboard shows only tasks assigned to them; members page hidden; no custom task creation
  - RLS enforces access at DB level (`is_external_actor()` security definer helper)
  - Visual separation in members list under "Eksterne aktører" divider
  - Same invite flow as regular members; set password during invite acceptance
  - Migrations: `20260420000000_add_company_to_members.sql`, `20260420010000_external_actor_rls.sql`
- Invite page anon lookup — uses `lookup_invite(p_token uuid)` security definer RPC instead of direct table query
  - Direct anon SELECT on `association_members` was blocked by RLS for unauthenticated users
  - `lookup_invite` bypasses RLS safely: returns only 4 fixed fields, filters by token + expiry + unclaimed, token is unguessable UUID
  - **Do not expand this function** — see security rules in `20260420085555_add_lookup_invite_fn.sql`
  - If logged in as wrong user, invite page shows a warning instead of the claim button (prevents accidental claiming)

### Next up
- **PWA** — manifest, service worker, installable on mobile/desktop
- **Deadline reminder emails** — Resend + Supabase Edge Functions + pg_cron (daily check, send reminders for tasks due within 14 days)
- **Feature flags** — hide conditional tasks (heis, lekeplass, radon) if building lacks those features
- **Trial expiry enforcement** — lock access when trial ends
- **Admin panel** — internal page to view all organizations, members, external members, subscription status; soft-delete orgs (mark inactive); details TBD at implementation
- **Test environment** — investigate staging/test setup without additional cost (e.g. Supabase branching, local shadow DB, or separate free-tier project)

### Deferred
- Email confirmation — Keep OFF in Supabase (no verification required at signup). Email verification will be required when transitioning from trial to paid subscription (verified during subscription setup, not during user signup). Will implement as part of subscription feature.
- Registration flow bugs — a few known issues noted during testing, deferred

## Database Schema

### `associations`
| column | type | notes |
|---|---|---|
| id | uuid PK | generated client-side via `crypto.randomUUID()` |
| orgnr | text | from brreg — **no unique constraint** (multiple trial registrations allowed) |
| navn | text | from brreg |
| org_form | text | BRL, SA, etc. |
| poststed | text nullable | from brreg address |
| status | text | trial \| active \| expired |
| trial_started_at | timestamptz | defaults to now() |
| created_at | timestamptz | |

### `association_members`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| association_id | uuid FK | → associations.id |
| user_id | uuid FK nullable | → auth.users.id — null until invite accepted |
| role_code | text | LEDE, MEDL, VARA, NEST, KONT |
| full_name | text | from brreg |
| email | text nullable | user-provided |
| invite_token | uuid nullable | one-time invite token, cleared on claim |
| invite_expires_at | timestamptz nullable | 7 days from generation |
| created_at | timestamptz | |

### `task_templates`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| category | text nullable | e.g. `brannvern`, `heis` — null for custom tasks |
| category_label | text | Norwegian display name; user-provided for custom tasks |
| title | text | |
| description | text nullable | |
| legal_basis | text nullable | specific law/paragraph — null for custom tasks |
| recurrence | text | daily \| monthly \| quarterly \| twice_yearly \| annually \| every_2_years \| every_5_years \| every_5_7_years \| every_10_years \| per_project |
| requires_professional | boolean | defaults false |
| is_conditional | boolean | only applies if building has certain feature |
| sort_order | integer | defaults 0 |
| association_id | uuid FK nullable | → associations.id — set for association custom tasks, null for seeded/personal |
| created_by | uuid FK nullable | → auth.users.id — null = seeded (global); set = custom task owner |
| created_at | timestamptz nullable | set on insert for custom tasks |
| first_due_at | timestamptz nullable | initial deadline for custom tasks; drives grouping/status when no completion exists |

28 seeded tasks across 10 categories (`created_by IS NULL`). See `supabase/migrations/20260415113448_seed_task_templates.sql`.

### `user_profiles`
| column | type | notes |
|---|---|---|
| id | uuid PK | = auth.users.id — one row per user |
| full_name | text | user-provided on individual signup, or from brreg via claim_invite |
| created_at | timestamptz | |

Created on: individual signup (`/register`), association onboarding (`/onboarding`), or invite acceptance (`claim_invite()`).

### `task_completions`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| association_id | uuid FK nullable | → associations.id — null for personal workspace completions |
| task_template_id | uuid FK | → task_templates.id (works for both seeded and custom tasks) |
| completed_by | uuid FK nullable | → auth.users.id |
| completed_at | timestamptz | defaults to now() |
| notes | text nullable | |

### `task_assignments`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| association_id | uuid FK | → associations.id |
| task_template_id | uuid FK | → task_templates.id |
| assigned_to | uuid FK | → association_members.id |
| created_at | timestamptz | |
| | | unique(association_id, task_template_id) — one assignee per task |

### RLS notes
- `get_my_association_ids()` — security definer function to avoid infinite recursion in `association_members` policies
- `task_templates` — readable by everyone (anon + authenticated)
- `task_completions` — read/insert for authenticated members; personal completions (`association_id IS NULL`) scoped to `completed_by = auth.uid()`; DELETE restricted to own entries
- `task_assignments` — full CRUD for association members
- `association_members` — anon can SELECT a row by valid invite token (UUID unguessable); authenticated members can UPDATE invite token fields
- `user_profiles` — users can read/insert/update only their own row (`id = auth.uid()`)

### Security definer functions
- `get_my_association_ids()` — returns association IDs for current user; used in all membership-checking RLS policies
- `claim_invite(token uuid)` — validates token, sets `user_id = auth.uid()`, clears token, creates `user_profiles` row (ON CONFLICT DO NOTHING)

## Codebase Structure

### Shared constants (`src/constants/`)
- `roles.ts` — `ROLE_CODES`, `ROLE_LABELS`, `ROLE_ORDER`, `getRoleLabel(code)`
- `recurrence.ts` — `RECURRENCE_CODES`, `RECURRENCE_LABELS`, `RECURRENCE_DAYS`, `RECURRENCE_PER_YEAR`, plus `getRecurrenceLabel/Days/PerYear()` helpers
- `config.ts` — `INVITE_EXPIRY_DAYS = 7`, `PASSWORD_MIN_LENGTH = 8`

### Shared lib (`src/lib/`)
- `validation.ts` — shared zod fields: `emailField`, `passwordField`, `passwordRequiredField`
- `taskUtils.ts` — pure task helpers + types: `getNextDueDate`, `getTaskStatus`, `getGroupKey`, `statusText`, `buildComplianceTimeline`, `defaultFirstDue`, `formatDate`, `todayStr`; types: `TaskStatus`, `GroupKey`, `TimelineEntry`
- `brreg.ts` — `ORG_FORM_CODES ['BRL', 'ESEK', 'SA']`, `getOrgFormLabel(kode)`; name searches filtered client-side
- `auth.tsx` — `AuthProvider`, `useAuth`
- `supabase.ts` — Supabase client

### Shared types (`src/types/`)
- `brreg.ts` — Brønnøysundregisteret API response types
- `app.ts` — `Association`, `AssociationMember`, `TaskTemplate`, `TaskCompletion`, `SubscriptionStatus`

### Workspace context (`src/contexts/WorkspaceContext.tsx`)
- `WorkspaceProvider` — fetches `user_profiles` (personal) + `association_members` (associations); deduplicates by association ID
- `useWorkspace()` — returns `{ workspaces, activeWorkspace, setActiveWorkspace, refreshWorkspaces, loading }`
- `Workspace` union: `PersonalWorkspace { kind:'personal', id, displayName }` | `AssociationWorkspace { kind:'association', id, displayName, association }`
- `refreshWorkspaces()` — called after `claim_invite()` to pick up new association without page reload

### Dashboard (`src/pages/dashboard/`)
- `DashboardPage.tsx` — data loading + tab layout (~160 lines)
- `TaskRow.tsx` — `TaskRow` + `StatusDot` + exported `MemberOption` interface
- `CustomTaskModal.tsx` — `CustomTaskModal` + exported `CustomTaskData` interface

## Migrations

### Workflow
Using Supabase CLI installed as dev dependency (`npx supabase`).
- `npm run db:migration <name>` — create new migration file in `supabase/migrations/`
- `npm run db:push` — apply pending migrations to remote Supabase project
- Must run `npx supabase login` and `npx supabase link --project-ref rooygqbwulreyrwfvsyf` first

### Best Practices
- **Never modify existing migrations** after they've been created. Migrations are immutable once pushed to the remote database.
- **Always create new migrations** for any schema or RLS policy changes, even if modifying existing tables/policies.
- **One concern per migration** — keep migrations focused on a single logical change (e.g., add column OR create RLS policy, not both).
- **Describe the change in the filename** — e.g., `20260420010000_add_external_actor_rls.sql` is clearer than `20260420010000_update_policies.sql`.

## Routing
- `HashRouter` used for GitHub Pages compatibility (no server-side routing)
- Routes:
  - `/login` — public
  - `/register` — public (individual signup)
  - `/onboarding` — public (association signup)
  - `/invite?token=...` — public (invite acceptance; handles logged-in and logged-out users)
  - `/dashboard` — protected
  - `/members` — protected
- Unauthenticated users redirect to `/login`
- Shared `Layout` component wraps all protected pages (header + nav bar)

## Brønnøysundregisteret API Notes
- Base URL: `https://data.brreg.no/enhetsregisteret/api`
- Search: `GET /enheter?navn=<query>&size=20` — `organisasjonsform.kode` filter not supported as query param, filter client-side instead
- Direct lookup: `GET /enheter/<orgnr>` — works for 9-digit org numbers
- Board members: `GET /enheter/<orgnr>/roller`
- Exact match logic: if any result's name matches query (normalised lowercase, no whitespace), return only that result; otherwise return all

## Norwegian Legal Requirements

Full task list with legal references: `docs/legal-requirements.md`

### Key regulations
- **Internkontrollforskriften** (FOR-1996-12-06-1127) — foundational HMS regulation, applies to all associations
- **Forskrift om brannforebygging** (FOR-2015-12-17-1710) — fire safety
- **Brann- og eksplosjonsvernloven** (LOV-2002-06-14-20) — fire/explosion prevention
- **Borettslagsloven** (LOV-2003-06-06-39) / **Eierseksjonsloven** (LOV-2017-06-16-65) — governance obligations
- **TEK17 kapittel 16** + **Plan- og bygningsloven § 29-9** — elevator safety
- **Byggherreforskriften** (FOR-2009-08-03-1028) — construction/rehabilitation projects
- **Strålevernforskriften** — radon (mandatory for rental units)

### Task data model implications
- Tasks need a **`requires_certified_professional`** flag (elevator inspection, fire alarm service, elektrokontroll, etc.)
- Tasks need **`conditional`** flag — some tasks only apply if the building has certain features (elevator, playground, rental units)
- Tasks must support **irregular recurrence intervals**: daily, weekly, monthly, quarterly, twice-yearly, annually, every 2 years, every 5 years, every 5–7 years, every 10 years, and per-project (one-off trigger)
- All legal tasks must reference the specific law/paragraph they originate from
- Legal tasks should not be deletable — only hideable (if the building lacks that feature, e.g. no elevator)

### Task categories (pre-seeded)
1. Internkontroll (HMS system)
2. Brannvern (fire safety)
3. Elektriske anlegg (electrical)
4. Heis (elevators) — conditional
5. Lekeplass (playgrounds) — conditional
6. Ventilasjon (ventilation)
7. Rørlegger / vann (plumbing)
8. Radon — conditional (rental units)
9. Byggeprosjekter (construction/rehabilitation) — triggered per project
10. Styrearbeid / governance
