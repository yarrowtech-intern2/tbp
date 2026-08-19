# CRM Implementation Plan

Status legend:
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[?]` Needs decision

Completion: Phase 1 (lead pipeline) is built and manually verified working in the browser. Phase 2 (traveler view) code is written and passes `npm run lint` / `tsc -b` / `vite build`, but its migration has not been applied yet and it has not been manually tested. See "Where We Left Off" below before doing anything else in this doc.

## Where We Left Off (read this first)

**Next step: apply both migrations to your Supabase project, then manually test Phase 1 + Phase 2.**

1. Apply, in order:
   - `supabase/migrations/202608190001_create_crm_lead_tables.sql` (Phase 1 — you already verified this one works via the browser screenshot on 2026-08-19).
   - `supabase/migrations/202608190002_create_crm_account_notes_and_traveler_rpc.sql` (Phase 2 — **not yet applied**, needed for the new "Travelers" tab).
2. Sign in as admin or marketing and open `/dashboard/admin?section=crm` (or `/dashboard/marketing?section=crm`). The CRM section is now tabbed: **Leads** (Phase 1, already working) and **Travelers** (new).
3. On the Travelers tab, verify: the list loads (recent tourist accounts by default), typing 2+ characters into search narrows it, expanding a traveler shows contact info + booking count/recent bookings + a notes timeline, and adding a note works and shows your name.
4. Report back pass/fail. If the Travelers tab shows a permission/RLS error, see "Important finding" below before assuming something is broken.

Once Phase 2 is verified, Phase 3 (provider view) reuses the same `crm_account_notes` table and `CrmNotesTimeline` component — just needs a `get_crm_providers()` RPC and a `CrmProvidersPanel.tsx`, following this exact pattern.

### Important finding from Phase 2 (read before touching profiles RLS)

`docs/cross-user-boundary-audit.md` deliberately narrowed `public.profiles` reads down to `public.can_view_profile()` (self, admin, verified-provider-public-listing, or a booking relationship) and **removed** a prior broad "marketing can read all profiles" policy. `public.can_view_profile()` does **not** include `is_marketing_user()` — so a direct `select * from profiles where role = 'tourist'` would silently return nothing for a marketing-role user.

Rather than re-widening that (already deliberately hardened) general policy, Phase 2 ships a narrow, purpose-built `security definer` function, `public.get_crm_travelers(search_term)`, that internally checks `is_admin_user() or is_marketing_user()` before returning rows — the same pattern already used by `public.get_admin_account_locations()` and `public.get_admin_revenue()` elsewhere in this app. This does not touch or weaken the general `profiles_select_visible` policy. Phase 3 (providers) should follow the same RPC pattern rather than querying `profiles` directly.

### Session decisions locked in (2026-08-19, Phase 1 kickoff)

- CRM lives in a **new, separate "CRM" nav entry** (`?section=crm`) — the existing "Contact Leads" panel (`ContactSubmissionsPanel.tsx`, `?section=inquiries`) is untouched.
- Lead status stages: `new → contacted → qualified → converted → closed` (5 stages).
- No lead assignment in Phase 1 — status + notes only. `crm_lead_status.updated_by` is still captured automatically (audit trail), but there is no assignee picker in the UI.
- Mobile lead detail UX: inline expand/accordion in the list (not a separate full-screen view).
- Notes are an immutable append-only timeline (no edit/delete) — matches "activity log" intent and keeps RLS simple (insert + select only, no update/delete policy).

### Session decisions locked in (2026-08-19, Phase 2 kickoff)

- Travelers (and Phase 3 providers) live as **tabs inside the same "CRM" section** (`CrmPanel.tsx`), not separate sidebar entries. Sidebar stays at one "CRM" item.
- Traveler/provider notes use a **new, separate `crm_account_notes` table** (`subject_type`/`subject_id`), independent of Phase 1's `crm_lead_notes` — no migration of already-shipped Phase 1 data.
- Traveler list is **search-first**: shows the 50 most recently created tourist accounts by default, `get_crm_travelers(search_term)` re-queries (still capped at 50) once 2+ characters are typed. No pagination UI.
- Extracted `CrmNotesTimeline.tsx` as a shared, presentational notes component — used by both Leads and Travelers now, intended for Providers in Phase 3 too.
- Deferred from Phase 2 scope (not built): favorites and message history in the traveler detail view. `favorites` has an inconsistent/legacy column schema (see `src/lib/destinations.ts` `getOrderedFavoriteIdColumns`/`getOrderedFavoriteTypeColumns` fallback logic) and message history would require joining through `conversations` to find a traveler's threads — both are real scope, not forgotten, just not worth the added fragility for a first pass. Booking history + notes cover the core "who is this traveler" need. Revisit if the team actually wants these.

## 0. Decision: Build Inside TBP Or As A Separate System

**Decision: build it inside the existing TBP app and Supabase project, as a new admin/marketing module — not as a separate application.**

Reasoning:

- The CRM's entire scope (leads/contact inquiries, traveler accounts, provider relationships) is data that already lives in this Supabase project: `profiles`, `contact_submissions`, `bookings`, `verification`, `conversation_messages`, `provider_payout_onboarding`, `notifications`. A separate system would have to replicate or sync all of it, adding an integration layer to keep two sources of truth consistent.
- Role and access control already exist and already match the requested CRM access (`admin` + `marketing`): `public.is_admin_user()` and `public.is_marketing_user()` are already used to gate `contact_submissions` reads (`docs/contact-submissions-migration.sql:27-32`) and `app_content` writes. The CRM reuses these instead of building a second auth system.
- There's already an internal-tool surface to extend: `src/pages/AdminConsole.tsx`, `src/pages/AdminListingReview.tsx`, `src/components/admin/AdminAccountMap.tsx`, and the role-aware `src/pages/RoleDashboard.tsx` (`/dashboard/:role`, with `?section=` sub-routing already used by provider studio). A CRM section fits this pattern directly.
- The user chose "fully custom, no external CRM" — there is no HubSpot/Zoho to integrate with, which removes the main reason to keep a CRM external (avoiding lock-in to someone else's schema/API).
- Project stage matters: `docs/production-readiness-tasklist.md` shows the core app is only 30% through production hardening (RLS audits, payment verification, deployment still open). Standing up a second deployable (separate hosting, separate auth, separate CI) now would add operational surface before the primary product is even production-ready.

When a separate system would become the better call (revisit if any of these happen):
- CRM users who should **not** get any access to the main traveler/provider-facing app (e.g., an outsourced call center).
- CRM feature growth that needs its own release cadence independent of the customer-facing app.
- Adoption of a third-party CRM for its built-in pipeline/automation/email features instead of building them here.

If none of those apply, the CRM stays a route inside this app (`/dashboard/admin/crm` or a new section in `AdminConsole`), sharing the same Supabase project, auth, and RLS model.

## 1. Scope

Confirmed with the user:

- **Leads / contact inquiries** — turn `contact_submissions` from a raw form-dump table into a workable pipeline (status, assignment, follow-up notes).
- **Traveler/customer accounts** — surface a traveler's `profiles` row alongside their `bookings`, `favorites`, and `conversation_messages` history in one view.
- **Provider relationships** — surface a provider's `profiles` row alongside `verification` status, `posts` (listings), `provider_payout_onboarding`, and booking performance in one view.
- Out of scope for now: full deal-stage sales pipeline with tasks/automation (not selected), and any external CRM sync (not selected).

Access: **admin + marketing** roles only, using existing `public.is_admin_user()` / `public.is_marketing_user()` helpers. No new role is introduced.

## 2. Data Model Plan

Reuse existing tables as the CRM's data source (no duplication):

| CRM view | Backing table(s) |
|---|---|
| Lead detail | `contact_submissions` |
| Traveler detail | `profiles` (role = tourist), `bookings`, `favorites`, `conversation_messages` |
| Provider detail | `profiles` (role = provider subtype), `verification`, `posts`, `provider_payout_onboarding`, `bookings` |

New CRM-specific tables needed (none of this exists today):

- `public.crm_lead_status`
  - `contact_submission_id uuid references contact_submissions(id)`, `status text` (e.g. `new`, `contacted`, `qualified`, `converted`, `closed`), `assigned_to uuid references profiles(id)`, `updated_at`.
  - `contact_submissions` today has no status/assignment/follow-up fields at all (`docs/contact-submissions-migration.sql`) — this table adds that without altering the existing insert-only public form flow.
- `public.crm_lead_notes` (Phase 1, shipped) — `contact_submission_id uuid references contact_submissions(id)`, `author_id uuid references profiles(id)`, `body text`, `created_at`. Append-only: insert + select policies only, no update/delete.
- `public.crm_account_notes` (Phase 2, shipped) — the polymorphic shape originally sketched above, but scoped to accounts only (not leads, which already had their own table): `subject_type text check (in 'traveler','provider')`, `subject_id uuid references profiles(id)`, `author_id uuid references profiles(id)`, `body text`, `created_at`. Same append-only policy shape as `crm_lead_notes`. Shared by the Travelers tab now and the Providers tab in Phase 3.
- `public.get_crm_travelers(search_term)` (Phase 2, shipped) — not a table, a `security definer` function returning `profiles` columns for `role = 'tourist'`, gated by `is_admin_user() or is_marketing_user()` inside the function body. See "Important finding from Phase 2" above.
- `public.crm_tags` + `public.crm_entity_tags` (optional, later phase)
  - Free-form tagging for leads/travelers/providers (e.g. "VIP", "high-risk refund history").

RLS: every new table gets `enable row level security` plus a single policy pattern reused across all of them — `using (public.is_admin_user() or public.is_marketing_user())` for select/insert/update, matching the existing `contact_submissions` select policy. No new policy design needed.

## 3. Architecture Plan (as built)

- **Route**: not a new page/route — a new `?section=crm` value inside the existing `src/pages/RoleDashboard.tsx` sidebar, alongside the existing `inquiries` ("Contact Leads") section. Reuses `RoleDashboard`'s existing role-aware sidebar/topbar/mobile-bottom-nav chrome, so it inherits mobile behavior for free instead of building new nav plumbing.
- **Component**: `src/components/admin/CrmLeadsPanel.tsx` + colocated `crm-leads-panel.css` (plain CSS file import, matching the `AdminAccountMap.tsx`/`admin-account-map.css` colocation convention). Reuses shared `rdb-panel` / `rdb-list-row` / `rdb-pill` / `rdb-stat-list` / `rdb-loading` / `rdb-error` / `rdb-empty` classes from `role-dashboard.css` for visual consistency, and only defines new CSS for genuinely new UI (accordion detail, status select, notes timeline, note composer, 5 new `crm-pill-*` status colors following the same `color-mix()` pattern as `.rdb-pill-*`).
- **Data layer**: `src/lib/crmLeads.ts`, `src/lib/crmAccountNotes.ts`, `src/lib/crmTravelers.ts` — all following the exact `src/lib/contactSubmissions.ts` pattern (hand-written types, defensive `unknown`-based row normalization, PostgREST error sniffing for "table/function missing" / "RLS denied" instead of raw Postgres errors).
- **Access pattern for account data (travelers/providers)**: not a direct `profiles` table policy — a narrow `security definer` RPC (`public.get_crm_travelers`, and `get_crm_providers` in Phase 3) that checks `is_admin_user() or is_marketing_user()` internally. See "Important finding from Phase 2" above for why.
- **Shared UI**: `src/components/admin/CrmPanel.tsx` is the tab shell (Leads | Travelers, Providers to come); `CrmNotesTimeline.tsx` is a shared presentational notes component used by every tab's detail view.
- No new frontend app, no new backend service, no new auth provider — confirms the Section 0 decision.
- New tables/functions shipped as ordered migrations (`supabase/migrations/202608190001_...`, `202608190002_...`), not as loose `docs/` files — `docs/supabase-setup-inventory.md` already flags loose SQL files as technical debt, so new CRM tables don't add to that pile.

## 4. Phased Implementation

### Phase 1 — Lead pipeline MVP
- [x] Migration: create `public.crm_lead_status` with RLS. — `supabase/migrations/202608190001_create_crm_lead_tables.sql`, not yet applied to a live project (see "Where We Left Off").
- [x] Migration: create `public.crm_lead_notes` with RLS. — same file. (Named `crm_lead_notes`, not `crm_notes` — this stores notes for leads specifically; Phase 2/3 will decide whether traveler/provider notes reuse this table or get their own.)
- [x] Admin/marketing UI: leads list view (`CrmLeadsPanel.tsx`, reads `contact_submissions` joined with `crm_lead_status` via `getCrmLeads()`), with search (name/email/phone/location) and status filter.
- [x] Admin/marketing UI: lead detail (inline accordion) — status dropdown (optimistic update with rollback on error) and notes timeline with a note composer. No assign-to picker, per Phase 1 scope decision.
- [x] `npm run lint` passes.
- [x] `npx tsc -b` (project-wide type-check) passes.
- [x] Apply the migration to a real Supabase project.
- [x] Manual smoke test: admin/marketing can view, change status, and add notes (verified via browser screenshot, 2026-08-19). RLS boundary check (tourist/provider blocked) still not explicitly verified — low risk since the policies mirror the already-audited `contact_submissions`/`app_content` pattern, but worth a real check before production.
- [x] Record the smoke-test result in the Progress Log below.
- [x] Compact/mobile-first CSS pass (stat tiles to a grid, tighter padding throughout) after initial screenshot review, 2026-08-19.

### Phase 2 — Traveler CRM view
- [x] Migration: create `public.crm_account_notes` with RLS, and `public.get_crm_travelers(search_term)` RPC (admin/marketing-gated `security definer`, not a direct `profiles` policy — see "Important finding" above). — `supabase/migrations/202608190002_create_crm_account_notes_and_traveler_rpc.sql`, **not yet applied**.
- [x] UI: traveler search/list (`CrmTravelersPanel.tsx`, via `getCrmTravelers()` → `get_crm_travelers` RPC). Search-first: 50 most recent by default, re-queries (still capped at 50) on 2+ character search.
- [x] UI: traveler detail (inline accordion, same pattern as Leads) — profile contact info, booking count + up to 10 recent bookings (`getCrmTravelerBookingSummary()`), notes timeline (`crm_account_notes` with `subject_type = 'traveler'`, via the shared `CrmNotesTimeline.tsx`).
- [x] Nav: CRM section restructured into tabs (`CrmPanel.tsx` — Leads | Travelers) instead of a second sidebar entry.
- [x] Refactor: extracted `CrmNotesTimeline.tsx` out of `CrmLeadsPanel.tsx` so Leads and Travelers (and Phase 3 Providers) share one notes-timeline implementation instead of duplicating it a third time.
- [x] `npm run lint`, `npx tsc -b`, `npx vite build` all pass.
- [ ] Apply the Phase 2 migration to a real Supabase project.
- [ ] Manual smoke test of the Travelers tab. **Not done — needs a human to click through the actual app.**
- Deferred (see "Session decisions locked in" above): favorites, message history.

### Phase 3 — Provider CRM view
- [ ] Migration: `public.get_crm_providers(search_term)` RPC, same admin/marketing-gated `security definer` pattern as `get_crm_travelers`.
- [ ] UI: `CrmProvidersPanel.tsx` — provider search/list, following `CrmTravelersPanel.tsx` as the template.
- [ ] UI: provider detail — verification status, listings, payout onboarding status, booking performance, notes timeline (`crm_account_notes` with `subject_type = 'provider'`, reusing `CrmNotesTimeline.tsx`).
- [ ] Nav: add "Providers" as a third tab in `CrmPanel.tsx`.

### Phase 4 — Polish
- [ ] Tagging (`crm_tags`/`crm_entity_tags`) if still wanted after Phases 1–3 are in daily use.
- [ ] Basic filters/search across all three entity types.
- [ ] Decide whether lead status changes should trigger a notification (`public.notifications`) to the assigned admin/marketing user.

## 5. Open Decisions

Resolved during Phase 1 kickoff (2026-08-19): lead status values, CRM nav placement, mobile detail UX.
Resolved during Phase 2 kickoff (2026-08-19): tabs-inside-CRM nav structure, separate `crm_account_notes` table, search-first traveler list. See "Session decisions locked in" above for both.

Still open:
- [?] Should notes (`crm_lead_notes` / `crm_account_notes`) support file/image attachments, or stay text-only. Currently text-only (4000 char cap) for both.
- [?] Should lead assignment be added in a later phase, and if so, restricted to marketing users only or any admin/marketing user.
- [?] Should a lead status change, or a new note on a traveler/provider, notify the relevant team via `public.notifications` (Phase 4 idea, not decided).
- [?] Phase 3 provider detail: which fields matter most from `verification`, `posts`, and `provider_payout_onboarding`? Needs a decision before Phase 3 starts (same "ask before building" approach as Phases 1 and 2).
- [?] Whether to eventually build the deferred favorites/message-history views for travelers, and if so, whether `favorites`' inconsistent legacy schema should be cleaned up first (separate from CRM work).

## Progress Log

- 2026-08-19: Created this plan. Decision recorded: build inside the existing TBP app/Supabase project rather than as a separate system. No implementation started yet.
- 2026-08-19: Phase 1 built end to end: migration (`supabase/migrations/202608190001_create_crm_lead_tables.sql`), data layer (`src/lib/crmLeads.ts`), UI (`src/components/admin/CrmLeadsPanel.tsx` + `crm-leads-panel.css`), and dashboard wiring (new `crm` section in `src/pages/RoleDashboard.tsx` for admin and marketing roles). `npm run lint` and `npx tsc -b` both pass.
- 2026-08-19: User applied the Phase 1 migration and manually verified it in the browser (screenshot: lead loaded from `contact_submissions`, status showed "New", notes empty state rendered correctly) at `/dashboard/marketing?section=crm`.
- 2026-08-19: Compacted the CRM UI after screenshot review — stat tiles were tall stacked full-width rows (global `.rdb-stat-list` has no default multi-column layout), now a compact grid; tightened padding across panels, list rows, detail sections, and notes. Scoped to `.crm-panel` so other dashboard sections are unaffected.
- 2026-08-19: Phase 2 built end to end: discovered during implementation that marketing-role profile reads are more restricted than assumed (see "Important finding" above) and used a `security definer` RPC instead of guessing/widening RLS. Shipped migration (`supabase/migrations/202608190002_create_crm_account_notes_and_traveler_rpc.sql`), data layer (`src/lib/crmAccountNotes.ts`, `src/lib/crmTravelers.ts`), shared notes component (`CrmNotesTimeline.tsx`, refactored out of `CrmLeadsPanel.tsx`), new `CrmTravelersPanel.tsx`, and tab shell (`CrmPanel.tsx`) now wired into `RoleDashboard.tsx` in place of the bare leads panel. `npm run lint`, `npx tsc -b`, and `npx vite build` all pass. **Neither the Phase 2 migration nor the Travelers tab has been manually tested yet** — see "Where We Left Off" at the top of this document.
