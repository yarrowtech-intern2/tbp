# Notifications Database Change Log

Date: 2026-04-22  
Scope: Global in-app + browser push notification pipeline

## Previous Database State
- No `public.notifications` table existed.
- No notification-specific RLS policies existed.
- No realtime publication for a notifications table.
- Existing core data tables remained:
  - `public.conversation_messages`
  - `public.bookings`
  - `public.verification`
  - `public.posts`
  - `public.profiles`

## New Database State
- Added `public.notifications` with columns:
  - `id uuid`
  - `user_id uuid`
  - `actor_user_id uuid`
  - `type text`
  - `title text`
  - `body text`
  - `metadata jsonb`
  - `is_read boolean`
  - `read_at timestamptz`
  - `created_at timestamptz`
  - `updated_at timestamptz`
- Added indexes:
  - `notifications_user_created_idx`
  - `notifications_user_unread_idx`
- Added RLS policies for:
  - select own notifications (or admin)
  - insert by actor/owner/admin
  - update own notifications (or admin)
  - delete own notifications (or admin)
- Added realtime publication entry for `public.notifications` in `supabase_realtime`.

## Data Backup Plan (Before Applying SQL)
Run this first in Supabase SQL editor to snapshot existing data for rollback:

```sql
create schema if not exists backup;

create table if not exists backup.profiles_2026_04_22 as
select * from public.profiles;

create table if not exists backup.posts_2026_04_22 as
select * from public.posts;

create table if not exists backup.bookings_2026_04_22 as
select * from public.bookings;

create table if not exists backup.verification_2026_04_22 as
select * from public.verification;

create table if not exists backup.conversation_messages_2026_04_22 as
select * from public.conversation_messages;
```

## Rollback Plan
If the notification migration causes issues:

1. Disable app-level notification writes temporarily.
2. Roll back schema objects:

```sql
drop table if exists public.notifications cascade;
```

3. Restore table data (only if needed and if those tables were modified in your migration window):

```sql
truncate table public.conversation_messages restart identity cascade;
insert into public.conversation_messages
select * from backup.conversation_messages_2026_04_22;

truncate table public.bookings restart identity cascade;
insert into public.bookings
select * from backup.bookings_2026_04_22;

truncate table public.verification restart identity cascade;
insert into public.verification
select * from backup.verification_2026_04_22;

truncate table public.posts restart identity cascade;
insert into public.posts
select * from backup.posts_2026_04_22;

truncate table public.profiles restart identity cascade;
insert into public.profiles
select * from backup.profiles_2026_04_22;
```

## Comparison Summary
- Previous schema: no notifications module.
- New schema: notification table + policies + realtime publication.
- Existing business data model retained; notification stream is additive.
