# Supabase Setup Inventory

This inventory lists the database, storage, and Edge Function setup currently required by the app.

Current status: production setup is split between ordered files in `supabase/migrations/` and older loose SQL files in `docs/`. Before a clean staging or production project is created, either convert the required loose SQL files into ordered migrations or follow the manual order below.

## Ordered Migrations

These are already in `supabase/migrations/` and can be applied by Supabase migration tooling.

1. `supabase/migrations/202606060001_create_contact_submissions.sql`
   - Creates `public.contact_submissions`.
   - Enables RLS.
   - Adds public insert and admin/marketing select policies.
   - Adds `contact_submissions_created_at_idx`.

2. `supabase/migrations/202606080001_add_booking_refund_workflow.sql`
   - Adds refund workflow fields to `public.bookings`.
   - Adds refund indexes.

3. `supabase/migrations/202606110001_add_razorpay_route_payout_fields.sql`
   - Adds Razorpay account fields to `public.provider_payout_onboarding`.
   - Adds route transfer/payout fields to `public.bookings`.

4. `supabase/migrations/202607140001_create_tourist_routes.sql`
   - Creates `public.tourist_routes`.
   - Enables RLS.
   - Adds tourist/admin policies for select, insert, update, and delete.

## Loose SQL Files In `docs/`

These files are not currently part of the ordered Supabase migration chain.

### Foundation

- `docs/supabase-role-system.sql`
  - Main foundation script.
  - Adds role/profile fields and constraints.
  - Creates or updates provider verification workflow.
  - Creates `public.verification`.
  - Creates `public.bookings`.
  - Creates `public.conversation_messages`.
  - Creates `public.moderation_audit_logs`.
  - Creates `public.notifications`.
  - Defines helper functions including `public.is_admin_user` and `public.is_verified_provider`.
  - Enables RLS on profiles, verification, posts, bookings, favorites, conversations, conversation messages, moderation audit logs, and notifications.
  - Creates the `avatars` storage bucket and storage object policies.

### Listings And Moderation

- `docs/vendor-post-approval-migration.sql`
  - Updates provider/vendor role handling.
  - Adds moderation fields to `public.posts`.
  - Replaces `public.is_verified_provider`.
  - Adds published-read, provider-insert, and owner/admin-update policies for posts.
  - Adds moderation audit log fields.

- `docs/legacy-content-to-posts.sql`
  - Migrates legacy tours, activities, and events into `public.posts`.
  - Seed/data migration, not a baseline schema object definition.

- `docs/listing-gallery-images-migration.sql`
  - Adds `gallery_images` to `public.posts`.
  - Backfills from existing image fields.

### Payments, Bookings, Refunds, And Payouts

- `docs/razorpay-booking-migration.sql`
  - Adds Razorpay payment fields to `public.bookings`.
  - Loosens legacy `post_id` and `activity_id` constraints.
  - Adds source listing lookup indexes.

- `docs/razorpay-source-listing-id-migration.sql`
  - Similar source listing compatibility migration for bookings.
  - Must be reconciled with `docs/razorpay-booking-migration.sql` before converting to ordered migrations.

- `docs/booking-provider-decision-migration.sql`
  - Adds provider accept/reject decision workflow fields to bookings.
  - Backfills booking decision/status state.

- `docs/bookings-legacy-trigger-compat.sql`
  - Adds compatibility behavior for legacy booking records.

- `docs/platform-fee-payout-migration.sql`
  - Adds platform fee/payout accounting fields to bookings.
  - Creates `public.provider_payout_onboarding`.
  - Enables RLS and owner policies for payout onboarding.

- `docs/admin-revenue-rpc.sql`
  - Creates `public.get_admin_revenue`.

### Promotions And Ads

- `docs/ads-boost-system-migration.sql`
  - Adds boost fields to `public.posts`.
  - Creates `public.post_boost_payments`.
  - Creates `public.ad_payments`.
  - Adds promotion payment indexes.

### Marketing And Public Content

- `docs/marketing-content-role-migration.sql`
  - Adds marketing role support.
  - Creates `public.is_marketing_user`.
  - Creates `public.app_content`.
  - Enables RLS for app content.
  - Adds app content policies for public read and admin/marketing writes.
  - Adds marketing select policies for profiles/bookings.

- `docs/about-page-content-seed.sql`
  - Seeds `public.app_content`.

- `docs/contact-submissions-migration.sql`
  - Older loose version of the contact submissions migration.
  - Appears superseded by `supabase/migrations/202606060001_create_contact_submissions.sql`.

### Social/Profile/Map

- `docs/profile-follow-system.sql`
  - Creates `public.profile_follows`.
  - Enables RLS.
  - Adds authenticated select, tourist-to-provider insert, and owner delete policies.

- `docs/profile-location-coordinates-migration.sql`
  - Adds country/city/coordinate fields and indexes to `public.profiles`.

## Storage Buckets

- `avatars`
  - Created by `docs/supabase-role-system.sql`.
  - Currently used for profile avatars/covers, listing images, and promo/ad images.
  - App references:
    - `src/pages/Profile.tsx`
    - `src/pages/ProviderStudio.tsx`
    - `src/pages/RoleDashboard.tsx`

Risk: using one public bucket for multiple image classes is operationally simple, but policy scope must be reviewed carefully before production.

## Edge Functions

Functions under `supabase/functions/`:

- `create-razorpay-order`
- `confirm-razorpay-booking`
- `create-razorpay-promo-order`
- `confirm-razorpay-promo-purchase`
- `process-provider-payout`
- `get-account-bookings`
- `get-active-ads`

Shared helper folders:

- `supabase/functions/_shared`
- `supabase/functions/_types`

## Tables Referenced By App Or Functions

Observed Supabase table usage includes:

- `activities`
- `ad_payments`
- `ads`
- `app_content`
- `bookings`
- `bookings_acts`
- `contact_submissions`
- `conversation_messages`
- `conversations`
- `events`
- `favorites`
- `moderation_audit_logs`
- `notifications`
- `post_boost_payments`
- `posts`
- `profile_follows`
- `profiles`
- `provider_payout_onboarding`
- `reviews_posts`
- `tourist_routes`
- `tours`
- `users`
- `verification`

## Recommended Manual Setup Order

Use this order only until the loose SQL files are converted into real ordered migrations.

1. `docs/supabase-role-system.sql`
2. `docs/vendor-post-approval-migration.sql`
3. `docs/profile-location-coordinates-migration.sql`
4. `docs/profile-follow-system.sql`
5. `docs/razorpay-booking-migration.sql`
6. `docs/booking-provider-decision-migration.sql`
7. `docs/bookings-legacy-trigger-compat.sql`
8. `docs/platform-fee-payout-migration.sql`
9. `docs/ads-boost-system-migration.sql`
10. `docs/marketing-content-role-migration.sql`
11. `docs/about-page-content-seed.sql`
12. Apply ordered migrations from `supabase/migrations/` that are not already represented in the loose scripts.
13. Deploy Edge Functions.
14. Set Supabase function secrets from `docs/production-readiness-tasklist.md`.

## Reconciliation Needed Before Production

- Decide whether to convert all required loose SQL files to ordered migrations.
- Reconcile overlap between loose files and existing ordered migrations.
- Reconcile overlap between `docs/razorpay-booking-migration.sql` and `docs/razorpay-source-listing-id-migration.sql`.
- Decide whether `docs/contact-submissions-migration.sql` should be deleted, ignored, or kept as historical after the ordered migration.
- Review the single `avatars` bucket policy because it supports avatars, listing images, and promo images.
- Verify all RLS policies against the smoke-test security boundary checklist.
