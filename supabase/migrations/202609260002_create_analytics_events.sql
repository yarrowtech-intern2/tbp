create table if not exists public.analytics_events (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    event_type text not null
        check (event_type in ('page_view', 'click', 'login', 'signup', 'link_visit', 'listing_view', 'booking_started')),
    visitor_id text not null check (char_length(visitor_id) between 8 and 64),
    session_id text not null check (char_length(session_id) between 8 and 64),
    user_id uuid references auth.users (id) on delete set null,
    path text not null check (char_length(path) <= 300),
    referrer_host text check (referrer_host is null or char_length(referrer_host) <= 120),
    utm_source text check (utm_source is null or char_length(utm_source) <= 80),
    utm_medium text check (utm_medium is null or char_length(utm_medium) <= 80),
    utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 80),
    coupon_code text check (coupon_code is null or char_length(coupon_code) <= 40),
    target text check (target is null or char_length(target) <= 120),
    device text check (device is null or device in ('mobile', 'tablet', 'desktop')),
    metadata jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_created_idx
    on public.analytics_events (created_at desc);

create index if not exists analytics_events_type_created_idx
    on public.analytics_events (event_type, created_at desc);

create index if not exists analytics_events_visitor_idx
    on public.analytics_events (visitor_id, created_at desc);

alter table public.analytics_events enable row level security;

-- Anyone (including logged-out visitors) may record events, but nobody can read the raw table.
drop policy if exists analytics_events_insert on public.analytics_events;
create policy analytics_events_insert
    on public.analytics_events
    for insert
    to anon, authenticated
    with check (user_id is null or user_id = auth.uid());

revoke all on public.analytics_events from anon, authenticated;
grant insert on public.analytics_events to anon, authenticated;

create or replace function public.admin_analytics_summary(
    p_from timestamptz,
    p_to timestamptz,
    p_tz text default 'Asia/Kolkata'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_span interval;
    v_prev_from timestamptz;
    v_result jsonb;
begin
    if auth.uid() is null or not exists (
        select 1 from public.profiles where id = auth.uid() and role = 'admin'
    ) then
        raise exception 'Admins only' using errcode = '42501';
    end if;

    if p_to <= p_from or p_to - p_from > interval '400 days' then
        raise exception 'Invalid date range' using errcode = '22023';
    end if;

    v_span := p_to - p_from;
    v_prev_from := p_from - v_span;

    with cur as (
        select * from public.analytics_events where created_at >= p_from and created_at < p_to
    ),
    prev as (
        select * from public.analytics_events where created_at >= v_prev_from and created_at < p_from
    ),
    totals as (
        select
            count(distinct visitor_id) as visitors,
            count(distinct session_id) as sessions,
            count(*) filter (where event_type = 'page_view') as page_views,
            count(*) filter (where event_type = 'click') as clicks,
            count(*) filter (where event_type = 'login') as logins,
            count(*) filter (where event_type = 'signup') as signups,
            count(*) filter (where event_type = 'link_visit') as link_visits,
            count(*) filter (where event_type = 'listing_view') as listing_views,
            count(*) filter (where event_type = 'booking_started') as booking_starts,
            count(distinct visitor_id) filter (where user_id is not null) as signed_in_visitors,
            count(distinct visitor_id) filter (where visitor_id in (
                select visitor_id from public.analytics_events where created_at < p_from
            )) as returning_visitors
        from cur
    ),
    prev_totals as (
        select
            count(distinct visitor_id) as visitors,
            count(distinct session_id) as sessions,
            count(*) filter (where event_type = 'page_view') as page_views,
            count(*) filter (where event_type = 'click') as clicks,
            count(*) filter (where event_type = 'login') as logins,
            count(*) filter (where event_type = 'signup') as signups,
            count(*) filter (where event_type = 'link_visit') as link_visits,
            count(*) filter (where event_type = 'listing_view') as listing_views,
            count(*) filter (where event_type = 'booking_started') as booking_starts
        from prev
    ),
    days as (
        select
            to_char((created_at at time zone p_tz)::date, 'YYYY-MM-DD') as day,
            count(distinct visitor_id) as visitors,
            count(*) filter (where event_type = 'page_view') as page_views,
            count(*) filter (where event_type = 'click') as clicks,
            count(*) filter (where event_type = 'login') as logins,
            count(*) filter (where event_type = 'signup') as signups,
            count(*) filter (where event_type = 'link_visit') as link_visits,
            count(*) filter (where event_type = 'listing_view') as listing_views,
            count(*) filter (where event_type = 'booking_started') as booking_starts
        from cur
        group by 1
    ),
    top_pages as (
        select path, count(*) as views, count(distinct visitor_id) as visitors
        from cur where event_type = 'page_view'
        group by path order by views desc limit 8
    ),
    top_sources as (
        select coalesce(nullif(utm_source, ''), nullif(referrer_host, ''), 'Direct') as source,
               count(distinct visitor_id) as visitors
        from cur where event_type = 'page_view'
        group by 1 order by visitors desc limit 8
    ),
    top_clicks as (
        select target, count(*) as clicks
        from cur where event_type = 'click' and target is not null
        group by target order by clicks desc limit 8
    ),
    top_links as (
        select coalesce(nullif(coupon_code, ''), nullif(utm_campaign, ''), 'Untagged') as link,
               count(*) as visits, count(distinct visitor_id) as visitors
        from cur where event_type = 'link_visit'
        group by 1 order by visits desc limit 8
    ),
    devices as (
        select coalesce(device, 'desktop') as device, count(distinct visitor_id) as visitors
        from cur group by 1
    ),
    heat as (
        select extract(dow from created_at at time zone p_tz)::int as dow,
               extract(hour from created_at at time zone p_tz)::int as hour,
               count(*) as events
        from cur where event_type = 'page_view'
        group by 1, 2
    ),
    funnel as (
        select
            count(distinct visitor_id) as visited,
            count(distinct visitor_id) filter (where event_type = 'listing_view') as viewed_listing,
            count(distinct visitor_id) filter (where event_type in ('login', 'signup')) as authenticated,
            count(distinct visitor_id) filter (where event_type = 'booking_started') as started_booking
        from cur
    )
    select jsonb_build_object(
        'range', jsonb_build_object('from', p_from, 'to', p_to, 'tz', p_tz),
        'totals', (select to_jsonb(totals) from totals),
        'previous', (select to_jsonb(prev_totals) from prev_totals),
        'daily', coalesce((select jsonb_agg(to_jsonb(days) order by days.day) from days), '[]'::jsonb),
        'top_pages', coalesce((select jsonb_agg(to_jsonb(top_pages)) from top_pages), '[]'::jsonb),
        'top_sources', coalesce((select jsonb_agg(to_jsonb(top_sources)) from top_sources), '[]'::jsonb),
        'top_clicks', coalesce((select jsonb_agg(to_jsonb(top_clicks)) from top_clicks), '[]'::jsonb),
        'top_links', coalesce((select jsonb_agg(to_jsonb(top_links)) from top_links), '[]'::jsonb),
        'devices', coalesce((select jsonb_agg(to_jsonb(devices)) from devices), '[]'::jsonb),
        'heatmap', coalesce((select jsonb_agg(to_jsonb(heat)) from heat), '[]'::jsonb),
        'funnel', (select to_jsonb(funnel) from funnel),
        'active_now', (
            select count(distinct visitor_id)
            from public.analytics_events
            where created_at >= now() - interval '5 minutes'
        )
    ) into v_result;

    return v_result;
end;
$$;

revoke all on function public.admin_analytics_summary(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_analytics_summary(timestamptz, timestamptz, text) to authenticated;
