# Architecture Decision Records (ADR)

This document captures key architectural decisions and rationales for the HMS project.

## ADR-001: Database Migrations Strategy

**Date:** 2026-04-20  
**Status:** Accepted

### Context
Managing database schema and RLS policy changes in a Supabase project requires a clear strategy for migrations to avoid conflicts, enable rollbacks, and maintain a clean audit trail.

### Decision
1. **Migrations are immutable** — once a migration file is created and pushed to the remote database, it is never modified. This ensures consistent state across environments.
2. **One concern per migration** — each migration addresses a single logical change. Schema changes (add column, create table) are separate from RLS policy changes.
3. **New migrations for any changes** — if modifying an existing table, policy, or function, always create a new migration file rather than modifying the existing one.
4. **Descriptive filenames** — migration filenames should clearly indicate the change (e.g., `20260420010000_add_external_actor_rls.sql` not `20260420010000_update_policies.sql`).

### Consequences
- **Pro:** Clean migration history, easy rollbacks, no conflicts between environments.
- **Pro:** Clear audit trail of when and why each change was made.
- **Con:** More migration files over time, but this is a worthwhile tradeoff for maintainability.

### Examples
- ❌ Don't: Modify `20260415130000_add_task_assignments.sql` to add a new RLS policy.
- ✅ Do: Create `20260420010000_add_external_actor_rls.sql` with the new policy.

---

## ADR-002: External Actor Role Implementation

**Date:** 2026-04-20  
**Status:** Accepted

### Context
The application needs to support contractors and inspectors (external actors) who should have limited access: they can only see and complete tasks assigned to them, but cannot manage other members or create new tasks.

### Decision
1. **New role code `EKST`** ("Ekstern aktør") added to the role system alongside existing codes (LEDE, MEDL, etc.).
2. **Database-level RLS enforcement** — access restrictions are enforced at the RLS policy layer, not just the frontend.
3. **Two-tier filtering:**
   - Backend: RLS policies restrict task visibility and task_assignment reads to assigned-only for EKST users.
   - Frontend: UI elements (assignment dropdown, custom task button, members page nav) are conditionally hidden for EKST users.
4. **Company name field** — external actors can optionally provide a company/organization name, displayed in the members list for context.
5. **Same invite flow** — external actors use the same token-based invite mechanism as regular members; no special signup flow.

### Consequences
- **Pro:** Security enforced at database level; frontend hiding is UX improvement, not a security boundary.
- **Pro:** Simple role addition; no new tables or complex permission logic.
- **Pro:** Seamless integration with existing invite and workspace switching.
- **Con:** RLS policies are more complex (conditional logic based on role_code and assignment).

---

## ADR-003: Email Verification Timing

**Date:** 2026-04-20  
**Status:** Accepted

### Context
Email verification is a security measure, but requiring it at signup creates friction for users and limits the trial experience. The app's monetization model (free trial, then manual subscription approval) provides a natural verification point.

### Decision
1. **No email verification at signup** — Supabase email confirmation remains disabled. Users can sign up and immediately access their account.
2. **Email verification at subscription time** — when an organization transitions from trial to paid subscription, email verification is required as part of the subscription setup (to be implemented later).
3. **Rationale:** The manual subscription approval step serves as identity verification — bad actors won't pay. Email verification at that point adds a layer of proof.

### Consequences
- **Pro:** Frictionless onboarding; users can immediately start using the app during trial.
- **Pro:** Verification happens at a natural business boundary (payment).
- **Con:** Trial accounts may have invalid emails; we'll need to validate emails during subscription setup.

---
