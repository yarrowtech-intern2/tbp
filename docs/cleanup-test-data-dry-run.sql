-- Dry run only. This script does not delete or update anything.
-- It counts the records that docs/cleanup-test-data-execute.sql would remove.
--
-- Keep rule:
-- - Put the real admin/marketing emails in tbp_cleanup_keep_emails below.
-- - Only those accounts will be kept, and only if their role is admin or marketing.
-- - Delete all operational/test data, all listings, all contact submissions, and all old Supabase Storage files.

create temp table if not exists tbp_cleanup_keep_emails (
    email text primary key
) on commit drop;

truncate table tbp_cleanup_keep_emails;

-- Add only real production staff accounts here before running the dry run.
-- Example:
-- insert into tbp_cleanup_keep_emails (email) values
--     ('admin@example.com'),
--     ('marketing@example.com');

create temp table if not exists tbp_cleanup_keep_users (
    id uuid primary key,
    email text,
    role text,
    source text
) on commit drop;

truncate table tbp_cleanup_keep_users;

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

create temp table if not exists tbp_cleanup_counts (
    area text,
    target text,
    rows_to_delete bigint,
    note text
) on commit drop;

truncate table tbp_cleanup_counts;

do $$
declare
    target record;
    row_count bigint;
begin
    for target in
        select *
        from (
            values
                ('public', 'activities', 'true', 'legacy listing data'),
                ('public', 'ad_payments', 'true', 'ad payment/test promotion data'),
                ('public', 'ads', 'true', 'paid ad records'),
                ('public', 'bookings', 'true', 'all booking/test payment data'),
                ('public', 'bookings_acts', 'true', 'legacy booking data'),
                ('public', 'contact_submissions', 'true', 'all contact form submissions'),
                ('public', 'conversation_messages', 'true', 'all chat messages'),
                ('public', 'conversations', 'true', 'all conversations'),
                ('public', 'events', 'true', 'legacy event listing data'),
                ('public', 'favorites', 'true', 'all favorites'),
                ('public', 'moderation_audit_logs', 'true', 'all moderation history'),
                ('public', 'notifications', 'true', 'all notifications'),
                ('public', 'post_boost_payments', 'true', 'listing boost payment/test data'),
                ('public', 'posts', 'true', 'all listings/posts'),
                ('public', 'profile_follows', 'true', 'all follows'),
                ('public', 'provider_payout_onboarding', 'true', 'all provider payout onboarding rows'),
                ('public', 'reviews_posts', 'true', 'all listing reviews'),
                ('public', 'tourist_routes', 'true', 'all route history'),
                ('public', 'tours', 'true', 'legacy tour listing data'),
                ('public', 'verification', 'true', 'all provider verification records')
        ) as rows(schema_name, table_name, condition_sql, note)
    loop
        if to_regclass(format('%I.%I', target.schema_name, target.table_name)) is not null then
            execute format(
                'select count(*) from %I.%I where %s',
                target.schema_name,
                target.table_name,
                target.condition_sql
            ) into row_count;
            insert into tbp_cleanup_counts values (
                target.schema_name,
                target.table_name,
                row_count,
                target.note
            );
        else
            insert into tbp_cleanup_counts values (
                target.schema_name,
                target.table_name,
                0,
                'table not present in this project'
            );
        end if;
    end loop;

    if to_regclass('public.profiles') is not null then
        select count(*)
        into row_count
        from public.profiles
        where id not in (select id from tbp_cleanup_keep_users);

        insert into tbp_cleanup_counts values (
            'public',
            'profiles',
            row_count,
            'profiles not belonging to admin/marketing users'
        );

        select count(*)
        into row_count
        from public.profiles
        where id in (select id from tbp_cleanup_keep_users)
          and (
              profile_image_url ilike '%/storage/v1/object/%'
              or cover_image_url ilike '%/storage/v1/object/%'
              or profile_image_url ilike '%supabase.co%/storage/%'
              or cover_image_url ilike '%supabase.co%/storage/%'
          );

        insert into tbp_cleanup_counts values (
            'public',
            'profiles',
            row_count,
            'kept admin/marketing profiles whose old Supabase image URLs will be cleared'
        );
    end if;

    select count(*)
    into row_count
    from auth.users
    where id not in (select id from tbp_cleanup_keep_users);

    insert into tbp_cleanup_counts values (
        'auth',
        'users',
        row_count,
        'auth users not marked admin/marketing'
    );

    if to_regclass('storage.objects') is not null then
        select count(*)
        into row_count
        from storage.objects
        where bucket_id = 'avatars';

        insert into tbp_cleanup_counts values (
            'storage',
            'objects',
            row_count,
            'all old Supabase Storage files in the avatars bucket'
        );
    end if;
end $$;

select *
from tbp_cleanup_counts
order by area, target, note;

select *
from tbp_cleanup_keep_users
order by role, email;
