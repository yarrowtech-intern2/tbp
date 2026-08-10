# Role Policy Audit

Date: 2026-08-10

Scope: static review of role-aware frontend routing and Supabase policy SQL for tourist, provider, admin, and marketing roles. This does not replace live staging tests with real accounts.

## Role Sources

- Frontend routing reads the role from `profiles.role`, with auth metadata as fallback.
- Database policies use `profiles.role` through helper functions:
  - `public.is_admin_user()`
  - `public.is_verified_provider()`
  - `public.is_marketing_user()`
  - `public.current_profile_role()`

## Policy Matrix

| Area | Tourist | Provider roles | Admin | Marketing |
| --- | --- | --- | --- | --- |
| Profiles | Authenticated read; self insert/update without role change | Authenticated read; self insert/update without role change | Full profile update through admin policy | Platform read policy |
| Verification | Own application select/insert/resubmit | Own application select/insert/resubmit | Review/update all applications | No moderation write policy |
| Listings/posts | Public read for live/published; no provider write | Own pending listing insert/update before admin publish | Owner/admin moderation update | No listing moderation write policy |
| Bookings | Own bookings select/insert/update | Participant booking select/update | Participant/admin read/update; refunds/revenue through admin surfaces | Read-only platform booking policy |
| Favorites/routes | Own records only | Not applicable | Admin route read where policy allows | No write policy |
| Messages/notifications | Participant or owner policies | Participant or owner policies | Admin read where policy allows | No elevated messaging policy |
| Marketing content | Public read | Public read | Insert/update/delete | Insert/update/delete |
| Ads/promotions | Public active ads through Edge Function | Own ads/payment records | Owner/admin read policies | Read-only ad/payment policy |

Provider roles are `tour_company`, `tour_instructor`, and `tour_guide`. The legacy `provider` role remains allowed by the profile constraint for compatibility but is not part of the current frontend provider role set in `src/lib/platform.ts`.

## Fixes Applied

- Self profile inserts now allow only non-internal account roles.
- Self profile updates must preserve the existing `profiles.role`.
- Admin and marketing role grants must be done by an existing admin or by direct trusted database operation, not by ordinary self profile updates.

## Remaining Live Checks

Run with real staging accounts before production:

- Tourist cannot update `profiles.role` to `admin`, `marketing`, or a provider role.
- Provider cannot update `profiles.role` to `admin` or `marketing`.
- Marketing can read platform sales data but cannot moderate listings/refunds.
- Admin can perform moderation/refund workflows.
- Guest/public access only reaches intended public content.
