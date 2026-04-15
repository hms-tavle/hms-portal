# HMS - Helse, Miljø og Sikkerhetskrav

## Project Overview
A React frontend with Supabase backend for managing HMS (Health, Safety and Environment) compliance checklists for Norwegian housing associations (Borettslag and Sameier).

## Core Features
1. **Auth** — Supabase auth with email/password sign-in
2. **Multi-member** — Housing association admin can invite/add members
3. **Recurring tasks** — Tasks that repeat on a schedule (weekly, monthly, annually, etc.)
4. **Task assignment** — Tasks can be assigned to specific members
5. **Legal compliance** — Tasks are grounded in Norwegian law requirements for housing associations

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
- **Notifications**: SendGrid (deferred — implement later)

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
