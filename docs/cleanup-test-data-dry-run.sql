-- Dry run only. This script does not delete or update production data.
-- It counts the records that docs/cleanup-test-data-execute.sql would remove.
--
-- Keep rule:
-- - Keep all accounts whose profile role or auth metadata role is admin or marketing.
-- - Delete all operational/test data, all listings, all contact submissions, and all old Supabase Storage files.
--
-- This version avoids temporary tables because the Supabase SQL editor can run
-- multi-statement queries in a way that loses temp-table scope.

create table if not exists public.tbp_cleanup_dry_run_counts (
    area text,
    target text,
    rows_to_delete bigint,
    note text
);

truncate table public.tbp_cleanup_dry_run_counts;

do $$
declare
    target record;
    row_count bigint;
    output_note text;
begin
    for target in
        select *
        from (
            values
                ('public', 'activities', 'legacy listing data'),
                ('public', 'ad_payments', 'ad payment/test promotion data'),
                ('public', 'ads', 'paid ad records'),
                ('public', 'bookings', 'all booking/test payment data'),
                ('public', 'bookings_acts', 'legacy booking data'),
                ('public', 'contact_submissions', 'all contact form submissions'),
                ('public', 'conversation_messages', 'all chat messages'),
                ('public', 'conversations', 'all conversations'),
                ('public', 'events', 'legacy event listing data'),
                ('public', 'favorites', 'all favorites'),
                ('public', 'moderation_audit_logs', 'all moderation history'),
                ('public', 'notifications', 'all notifications'),
                ('public', 'post_boost_payments', 'listing boost payment/test data'),
                ('public', 'posts', 'all listings/posts'),
                ('public', 'profile_follows', 'all follows'),
                ('public', 'provider_payout_onboarding', 'all provider payout onboarding rows'),
                ('public', 'reviews_posts', 'all listing reviews'),
                ('public', 'tourist_routes', 'all route history'),
                ('public', 'tours', 'legacy tour listing data'),
                ('public', 'verification', 'all provider verification records')
        ) as rows(schema_name, table_name, note)
    loop
        output_note := target.note;
        if to_regclass(format('%I.%I', target.schema_name, target.table_name)) is not null then
            execute format('select count(*) from %I.%I', target.schema_name, target.table_name)
            into row_count;
        else
            row_count := 0;
            output_note := 'table not present in this project';
        end if;

        insert into public.tbp_cleanup_dry_run_counts
        values (target.schema_name, target.table_name, row_count, output_note);
    end loop;

    select count(*)
    into row_count
    from public.profiles
    where id not in (
        select users.id
        from auth.users users
        left join public.profiles profiles on profiles.id = users.id
        where profiles.role in ('admin', 'marketing')
           or users.raw_user_meta_data->>'role' in ('admin', 'marketing')
    );

    insert into public.tbp_cleanup_dry_run_counts
    values ('public', 'profiles', row_count, 'profiles not belonging to admin/marketing users');

    select count(*)
    into row_count
    from public.profiles
    where id in (
        select users.id
        from auth.users users
        left join public.profiles profiles on profiles.id = users.id
        where profiles.role in ('admin', 'marketing')
           or users.raw_user_meta_data->>'role' in ('admin', 'marketing')
    )
      and (
          profile_image_url ilike '%/storage/v1/object/%'
          or cover_image_url ilike '%/storage/v1/object/%'
          or profile_image_url ilike '%supabase.co%/storage/%'
          or cover_image_url ilike '%supabase.co%/storage/%'
      );

    insert into public.tbp_cleanup_dry_run_counts
    values ('public', 'profiles', row_count, 'kept admin/marketing profiles whose old Supabase image URLs will be cleared');

    select count(*)
    into row_count
    from auth.users
    where id not in (
        select users.id
        from auth.users users
        left join public.profiles profiles on profiles.id = users.id
        where profiles.role in ('admin', 'marketing')
           or users.raw_user_meta_data->>'role' in ('admin', 'marketing')
    );

    insert into public.tbp_cleanup_dry_run_counts
    values ('auth', 'users', row_count, 'auth users not marked admin/marketing');

    if to_regclass('storage.objects') is not null then
        select count(*)
        into row_count
        from storage.objects
        where bucket_id = 'avatars';
    else
        row_count := 0;
    end if;

    insert into public.tbp_cleanup_dry_run_counts
    values ('storage', 'objects', row_count, 'all old Supabase Storage files in the avatars bucket');
end $$;

select *
from public.tbp_cleanup_dry_run_counts
order by area, target, note;

select
    users.id,
    users.email,
    coalesce(profiles.role, users.raw_user_meta_data->>'role') as role,
    case
        when profiles.role in ('admin', 'marketing') then 'profiles.role'
        else 'auth.raw_user_meta_data.role'
    end as source
from auth.users users
left join public.profiles on profiles.id = users.id
where profiles.role in ('admin', 'marketing')
   or users.raw_user_meta_data->>'role' in ('admin', 'marketing')
order by role, email;
