-- One-time migration from legacy content tables into public.posts.
-- This version is schema-tolerant: it checks whether legacy columns exist
-- before referencing them, so it can run against older tables that do not
-- have fields like image_url, user_id, category, or starts_at.

begin;

alter table public.posts
    add column if not exists starts_at timestamptz;

do language plpgsql $$
declare
    has_tours_table boolean;
    has_activities_table boolean;
    has_events_table boolean;

    tours_has_description boolean;
    tours_has_location boolean;
    tours_has_image_url boolean;
    tours_has_category boolean;
    tours_has_price boolean;
    tours_has_created_at boolean;

    activities_has_description boolean;
    activities_has_location boolean;
    activities_has_image_url boolean;
    activities_has_category boolean;
    activities_has_price boolean;
    activities_has_created_at boolean;

    events_has_description boolean;
    events_has_location boolean;
    events_has_image_url boolean;
    events_has_category boolean;
    events_has_starts_at boolean;
    events_has_created_at boolean;

    sql_text text;
begin
    select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'tours'
    ) into has_tours_table;
    select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'activities'
    ) into has_activities_table;
    select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'events'
    ) into has_events_table;

    if has_tours_table then
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'tours' and column_name = 'description'
    ) into tours_has_description;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'tours' and column_name = 'location'
    ) into tours_has_location;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'tours' and column_name = 'image_url'
    ) into tours_has_image_url;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'tours' and column_name = 'category'
    ) into tours_has_category;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'tours' and column_name = 'price'
    ) into tours_has_price;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'tours' and column_name = 'created_at'
    ) into tours_has_created_at;

    sql_text := format(
        $fmt$
        insert into public.posts (
            title,
            description,
            location,
            image_url,
            type,
            sub_category,
            price,
            created_at,
            status
        )
        select
            t.title,
            %s,
            %s,
            %s,
            'tour',
            %s,
            %s,
            %s,
            'published'
        from public.tours t
        where not exists (
            select 1
            from public.posts p
            where p.type = 'tour'
              and coalesce(p.title, '') = coalesce(t.title, '')
              and coalesce(p.location, '') = coalesce(%s, '')
        )
        $fmt$,
        case when tours_has_description then 't.description' else 'null' end,
        case when tours_has_location then 't.location' else 'null' end,
        case when tours_has_image_url then 't.image_url' else 'null' end,
        case when tours_has_category then 't.category' else 'null' end,
        case when tours_has_price then 't.price' else 'null' end,
        case when tours_has_created_at then 'coalesce(t.created_at, now())' else 'now()' end,
        case when tours_has_location then 't.location' else 'null' end
    );
    execute sql_text;
    end if;

    if has_activities_table then
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'activities' and column_name = 'description'
    ) into activities_has_description;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'activities' and column_name = 'location'
    ) into activities_has_location;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'activities' and column_name = 'image_url'
    ) into activities_has_image_url;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'activities' and column_name = 'category'
    ) into activities_has_category;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'activities' and column_name = 'price'
    ) into activities_has_price;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'activities' and column_name = 'created_at'
    ) into activities_has_created_at;

    sql_text := format(
        $fmt$
        insert into public.posts (
            title,
            description,
            location,
            image_url,
            type,
            sub_category,
            price,
            created_at,
            status
        )
        select
            a.title,
            %s,
            %s,
            %s,
            'activity',
            %s,
            %s,
            %s,
            'published'
        from public.activities a
        where not exists (
            select 1
            from public.posts p
            where p.type = 'activity'
              and coalesce(p.title, '') = coalesce(a.title, '')
              and coalesce(p.location, '') = coalesce(%s, '')
        )
        $fmt$,
        case when activities_has_description then 'a.description' else 'null' end,
        case when activities_has_location then 'a.location' else 'null' end,
        case when activities_has_image_url then 'a.image_url' else 'null' end,
        case when activities_has_category then 'a.category' else 'null' end,
        case when activities_has_price then 'a.price' else 'null' end,
        case when activities_has_created_at then 'coalesce(a.created_at, now())' else 'now()' end,
        case when activities_has_location then 'a.location' else 'null' end
    );
    execute sql_text;
    end if;

    if has_events_table then
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'events' and column_name = 'description'
    ) into events_has_description;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'events' and column_name = 'location'
    ) into events_has_location;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'events' and column_name = 'image_url'
    ) into events_has_image_url;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'events' and column_name = 'category'
    ) into events_has_category;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'events' and column_name = 'starts_at'
    ) into events_has_starts_at;
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'events' and column_name = 'created_at'
    ) into events_has_created_at;

    sql_text := format(
        $fmt$
        insert into public.posts (
            title,
            description,
            location,
            image_url,
            type,
            sub_category,
            starts_at,
            created_at,
            status
        )
        select
            e.title,
            %s,
            %s,
            %s,
            'guide',
            %s,
            %s,
            %s,
            'published'
        from public.events e
        where not exists (
            select 1
            from public.posts p
            where p.type = 'guide'
              and coalesce(p.title, '') = coalesce(e.title, '')
              and coalesce(p.location, '') = coalesce(%s, '')
        )
        $fmt$,
        case when events_has_description then 'e.description' else 'null' end,
        case when events_has_location then 'e.location' else 'null' end,
        case when events_has_image_url then 'e.image_url' else 'null' end,
        case when events_has_category then 'e.category' else 'null' end,
        case when events_has_starts_at then 'e.starts_at' else 'null' end,
        case when events_has_created_at then 'coalesce(e.created_at, now())' else 'now()' end,
        case when events_has_location then 'e.location' else 'null' end
    );
    execute sql_text;
    end if;
end $$;

commit;

-- Validation queries:
-- select type, count(*) from public.posts group by type order by type;
-- select count(*) as legacy_tours from public.tours;
-- select count(*) as legacy_activities from public.activities;
-- select count(*) as legacy_events from public.events;
