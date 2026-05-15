-- Compatibility patch for legacy booking triggers.
-- Fixes errors like:
--   record "new" has no field "user_email"
--
-- Some older DB triggers still reference NEW.user_email/user_name/user_phone
-- from public.bookings. Newer schemas moved traveler details elsewhere.
-- This patch reintroduces nullable compatibility columns and backfills them.

alter table public.bookings
    add column if not exists user_email text,
    add column if not exists user_name text,
    add column if not exists user_phone text;

-- Backfill from profiles when possible.
update public.bookings b
set
    user_email = coalesce(nullif(trim(b.user_email), ''), p.email),
    user_name = coalesce(nullif(trim(b.user_name), ''), p.full_name),
    user_phone = coalesce(nullif(trim(b.user_phone), ''), p.phone)
from public.profiles p
where p.id = b.user_id
  and (
      b.user_email is null or trim(b.user_email) = ''
      or b.user_name is null or trim(b.user_name) = ''
      or b.user_phone is null or trim(b.user_phone) = ''
  );

-- Optional validation:
-- select id, user_id, user_name, user_email, user_phone
-- from public.bookings
-- order by created_at desc
-- limit 20;
