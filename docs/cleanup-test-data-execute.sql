-- Destructive cleanup. Run docs/cleanup-test-data-dry-run.sql first and review the counts.
--
-- Keeps all admin/marketing auth/profile users.
-- Deletes all listings, bookings, contact submissions, messages, notifications, reviews,
-- and provider/test records.
--
-- This version intentionally avoids temporary tables because the Supabase SQL editor can
-- run multi-statement queries in a way that loses temp-table scope.
--
-- Supabase Storage files are intentionally not deleted by SQL here. Use:
-- node scripts/cleanup-supabase-avatars.mjs --execute

begin;

do $$
declare
    keep_user_ids uuid[];
    truncate_targets text;
begin
    select coalesce(array_agg(users.id), '{}'::uuid[])
    into keep_user_ids
    from auth.users users
    left join public.profiles on profiles.id = users.id
    where profiles.role in ('admin', 'marketing')
       or users.raw_user_meta_data->>'role' in ('admin', 'marketing');

    if array_length(keep_user_ids, 1) is null then
        raise exception 'No admin/marketing users matched. Check profile/auth roles before running cleanup.';
    end if;

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
    where id = any(keep_user_ids);

    delete from public.profiles
    where not (id = any(keep_user_ids));

    delete from auth.users
    where not (id = any(keep_user_ids));
end $$;

select 'kept_users' as result, count(*) as count
from auth.users users
left join public.profiles on profiles.id = users.id
where profiles.role in ('admin', 'marketing')
   or users.raw_user_meta_data->>'role' in ('admin', 'marketing');

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

commit;
