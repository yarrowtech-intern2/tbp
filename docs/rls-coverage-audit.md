# RLS Coverage Audit

Date: 2026-08-10

Scope: static audit of app and Edge Function Supabase table references against local setup SQL files. This does not verify a live Supabase project; run the SQL verification query below against staging/production after migrations are applied.

## Covered By Setup Scripts

The local setup scripts enable RLS for these referenced application tables:

- `app_content`
- `bookings`
- `contact_submissions`
- `conversation_messages`
- `conversations`
- `favorites`
- `moderation_audit_logs`
- `notifications`
- `posts`
- `profile_follows`
- `profiles`
- `provider_payout_onboarding`
- `reviews_posts`
- `tourist_routes`
- `activities`
- `bookings_acts`
- `events`
- `tours`
- `verification`
- `ad_payments`
- `post_boost_payments`

The promotion migration also enables RLS on `public.ads` when that legacy table already exists.

## Legacy/Public Compatibility Tables

These referenced tables are handled conditionally because they may not exist in a clean production schema:

- `activities`, `events`, and `tours` are treated as legacy/public content fallbacks by the frontend.
- `bookings_acts` is a legacy booking compatibility table still used by booking functions and fallbacks; policies restrict access to the owning user or admin.
- `reviews_posts` is used for listing reviews; reviews are public-readable, while writes are limited to the reviewer identity columns present in the deployed schema or admin.
- `auth.users` is read through service-role Edge Function code in `get-account-bookings`; it is not a `public` schema RLS target.

The production readiness RLS item is complete for local setup scripts. The live verification query below still needs to be run against staging/production after the SQL files are applied.

## Live Verification Query

Run this in Supabase SQL editor after applying the setup scripts:

```sql
select
    schemaname,
    tablename,
    rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'activities',
    'ad_payments',
    'ads',
    'app_content',
    'bookings',
    'bookings_acts',
    'contact_submissions',
    'conversation_messages',
    'conversations',
    'events',
    'favorites',
    'moderation_audit_logs',
    'notifications',
    'post_boost_payments',
    'posts',
    'profile_follows',
    'profiles',
    'provider_payout_onboarding',
    'reviews_posts',
    'tourist_routes',
    'tours',
    'verification'
  )
order by tablename;
```

Expected result for production user/business data: every present non-public table should return `rowsecurity = true`.
