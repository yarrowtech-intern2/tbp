# Cross-User Boundary Audit

Date: 2026-08-10

Scope: local static review and policy hardening for the production-readiness item "Test that one user cannot read or mutate another user's private data." This must still be verified against a live staging Supabase project with real tourist/provider/admin/marketing accounts.

## Local Finding

The previous profile select policy allowed every authenticated user to read every row in `public.profiles`. Because that table includes private fields such as `email`, `phone`, role, location coordinates, and provider verification metadata, this was too broad for production.

## Fix Applied

`docs/supabase-role-system.sql` now defines `public.can_view_profile(target_user_id, check_user_id)` and replaces the broad profile select policy with `profiles_select_visible`.

Profile rows are visible only when one of these conditions is true:

- The row belongs to the current user.
- The current user is an admin.
- The target row is a public provider profile.
- The users are booking participants.
- The users are conversation participants.
- Marketing users receive their existing read policy from `docs/marketing-content-role-migration.sql`.

Profile mutation remains limited to:

- Self update without role changes.
- Admin update.

## Existing Private-Data Boundaries

The local SQL setup already scopes these records:

- `bookings`: traveler, provider, admin, plus marketing read policy.
- `favorites`: owner only.
- `tourist_routes`: owner or admin.
- `conversations`: participants or admin.
- `conversation_messages`: conversation participants.
- `notifications`: owner or admin.
- `profile_follows`: public social graph for authenticated users.

## Live Staging Tests

Run these after applying SQL to staging:

- Tourist A cannot select Tourist B from `profiles`.
- Tourist A cannot update Tourist B in `profiles`.
- Tourist A cannot select Tourist B favorites, routes, conversations, messages, notifications, or bookings.
- Tourist A can select a public provider profile.
- Provider can select tourist profile only when there is a booking or conversation relationship.
- Marketing can read platform profile/booking data but cannot update profile roles or moderation state.
- Admin can read and update required operational records.
