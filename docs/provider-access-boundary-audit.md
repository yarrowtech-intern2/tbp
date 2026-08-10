# Provider Access Boundary Audit

Date: 2026-08-10

Scope: static review of provider access boundaries for listings, bookings, ads, promotion payments, payout onboarding, and the provider payout edge function.

## Result

Provider boundaries are covered in the local SQL setup and edge function code, with two hardening changes added during this audit:

- Non-admin users can no longer change `posts.user_id`, `posts.provider_user_id`, `bookings.user_id`, or `bookings.provider_user_id` during updates. Service-role maintenance and admin users remain allowed.
- Admin users can now read and update `provider_payout_onboarding` records for operational payout review.

Live staging verification is still required after applying the SQL setup files.

## Boundary Matrix

| Area | Expected provider access | Current control |
| --- | --- | --- |
| Listings (`public.posts`) | Providers can create and update only their own listings and cannot self-publish after the approval migration. | RLS restricts insert/update to verified provider owners or admin. `posts_prevent_non_admin_owner_change` blocks non-admin owner reassignment. |
| Bookings (`public.bookings`) | Providers can read/update bookings where `provider_user_id = auth.uid()`; travelers can access their own bookings; admins can access all. | RLS restricts select/update to participant/admin. `bookings_prevent_non_admin_owner_change` blocks participant owner reassignment. |
| Legacy ads (`public.ads`) | Providers can read/write only their own ad records; admins can review all. | Conditional RLS in `docs/ads-boost-system-migration.sql` restricts owner/admin select and owner writes. |
| Ad payments (`public.ad_payments`) | Providers can read only their own ad payment records; admins can review all. | RLS in `docs/ads-boost-system-migration.sql` restricts select to owner/admin. |
| Post boost payments (`public.post_boost_payments`) | Providers can read only their own boost payment records; admins can review all. | RLS in `docs/ads-boost-system-migration.sql` restricts select to owner/admin. |
| Payout onboarding (`public.provider_payout_onboarding`) | Providers can manage only their own onboarding; admins can review and update operational status. | RLS in `docs/platform-fee-payout-migration.sql` restricts provider rows to owner/admin. |
| Payout processing edge function | Providers can process only their own single ready payout; admins/secret can process batches. | `supabase/functions/process-provider-payout/index.ts` checks the JWT user and rejects non-owner booking payout attempts. |

## Live Verification SQL

Run these checks in staging with real tourist, provider, other-provider, and admin sessions after applying the setup files:

```sql
-- As provider A: should return only provider A listings.
select id, provider_user_id, user_id
from public.posts
where provider_user_id <> auth.uid()
   or (provider_user_id is null and user_id <> auth.uid());

-- As provider A: should fail for a provider B listing.
update public.posts
set title = title
where provider_user_id <> auth.uid();

-- As provider A: should fail when attempting to reassign ownership.
update public.posts
set provider_user_id = auth.uid()
where provider_user_id <> auth.uid();

-- As provider A: should return only provider A bookings.
select id, provider_user_id, user_id
from public.bookings
where provider_user_id <> auth.uid()
  and user_id <> auth.uid();

-- As provider A: should fail when attempting to reassign a booking.
update public.bookings
set provider_user_id = auth.uid()
where provider_user_id <> auth.uid();

-- As provider A: should return only provider A payout onboarding row.
select user_id, status
from public.provider_payout_onboarding
where user_id <> auth.uid();

-- As provider A: should return no other-user promotion payment rows.
select user_id from public.ad_payments where user_id <> auth.uid();
select user_id from public.post_boost_payments where user_id <> auth.uid();
```

Expected result for the cross-owner select queries is zero rows. Expected result for cross-owner update attempts is zero updated rows or a policy/trigger rejection.
