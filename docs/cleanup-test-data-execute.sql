-- Destructive cleanup. Run docs/cleanup-test-data-dry-run.sql first and review the counts.
--
-- Keeps only the explicitly listed admin/marketing auth/profile users.
-- Deletes all listings, bookings, contact submissions, messages, notifications, reviews,
-- and provider/test records.
--
-- Supabase Storage files are intentionally not deleted by SQL here. Use:
-- node scripts/cleanup-supabase-avatars.mjs --execute
--
-- Recommended use:
-- 1. Run docs/cleanup-test-data-dry-run.sql.
-- 2. Export a database backup if you want a rollback path.
-- 3. Run this script in the Supabase SQL editor.

begin;

create temp table tbp_cleanup_keep_emails (
    email text primary key
) on commit drop;



insert into tbp_cleanup_keep_emails (email)
select lower(users.email)
from auth.users users
left join public.profiles on profiles.id = users.id
where profiles.role in ('admin', 'marketing')
   or users.raw_user_meta_data->>'role' in ('admin', 'marketing');
-- Add only real production staff accounts here before running this script.
-- Example:
-- insert into tbp_cleanup_keep_emails (email) values
--     ('admin@example.com'),
--     ('marketing@example.com');

create temp table tbp_cleanup_keep_users (
    id uuid primary key,
    email text,
    role text,
    source text
) on commit drop;

insert into tbp_cleanup_keep_users (id, email, role, source)
select
    users.id,
    users.email,
    coalesce(profiles.role, users.raw_user_meta_data->>'role') as role,
    case
        when profiles.role in ('admin', 'marketing') then 'profiles.role'
        else 'auth.raw_user_meta_data.role'
    end as source
from auth.users
left join public.profiles on profiles.id = users.id
join tbp_cleanup_keep_emails keep_emails on lower(keep_emails.email) = lower(users.email)
where profiles.role in ('admin', 'marketing')
   or users.raw_user_meta_data->>'role' in ('admin', 'marketing');

do $$
begin
    if not exists (select 1 from tbp_cleanup_keep_users) then
        raise exception 'No admin/marketing keep users matched. Add real staff emails to tbp_cleanup_keep_emails before running cleanup.';
    end if;
end $$;

do $$
declare
    truncate_targets text;
begin
    select string_agg(format('%I.%I', schema_name, table_name), ', ')
    into truncate_targets
    from (
        values
            ('public', 'activities'),
            ('public', 'ad_payments'),
            ('public', 'ads'),
            ('public', 'bookings'),
            ('public', 'bookings_acts'),
            ('public', 'contact_submissions'),
            ('public', 'conversation_messages'),
            ('public', 'conversations'),
            ('public', 'events'),
            ('public', 'favorites'),
            ('public', 'moderation_audit_logs'),
            ('public', 'notifications'),
            ('public', 'post_boost_payments'),
            ('public', 'posts'),
            ('public', 'profile_follows'),
            ('public', 'provider_payout_onboarding'),
            ('public', 'reviews_posts'),
            ('public', 'tourist_routes'),
            ('public', 'tours'),
            ('public', 'verification')
    ) as rows(schema_name, table_name)
    where to_regclass(format('%I.%I', schema_name, table_name)) is not null;

    if truncate_targets is not null then
        execute 'truncate table ' || truncate_targets || ' restart identity cascade';
    end if;
end $$;

-- Old Supabase Storage images are no longer used by the browser app.
-- Clear kept admin/marketing profile image URLs only when they point at Supabase Storage.
update public.profiles
set
    profile_image_url = case
        when profile_image_url ilike '%/storage/v1/object/%'
          or profile_image_url ilike '%supabase.co%/storage/%'
        then null
        else profile_image_url
    end,
    cover_image_url = case
        when cover_image_url ilike '%/storage/v1/object/%'
          or cover_image_url ilike '%supabase.co%/storage/%'
        then null
        else cover_image_url
    end
where id in (select id from tbp_cleanup_keep_users);

delete from public.profiles
where id not in (select id from tbp_cleanup_keep_users);

delete from auth.users
where id not in (select id from tbp_cleanup_keep_users);

select 'kept_users' as result, count(*) as count
from tbp_cleanup_keep_users;

select id, email, role, source
from tbp_cleanup_keep_users
order by role, email;

commit;
