-- Adds the internal marketing role and the public app content table.
-- Apply this in Supabase SQL editor before using the Marketing dashboard.

alter table public.profiles
    drop constraint if exists profiles_role_check;

alter table public.profiles
    add constraint profiles_role_check
    check (role in ('tourist', 'tour_company', 'tour_instructor', 'tour_guide', 'admin', 'provider', 'marketing')) not valid;

alter table public.profiles
    validate constraint profiles_role_check;

create or replace function public.is_marketing_user(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = check_user_id
          and role = 'marketing'
    );
$$;

grant execute on function public.is_marketing_user(uuid) to anon, authenticated, service_role;

create table if not exists public.app_content (
    key text primary key,
    value jsonb not null default '{}'::jsonb,
    updated_by uuid references public.profiles(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.app_content enable row level security;

drop policy if exists "app_content_select_public" on public.app_content;
create policy "app_content_select_public"
on public.app_content
for select
to anon, authenticated
using (true);

drop policy if exists "app_content_insert_admin_or_marketing" on public.app_content;
create policy "app_content_insert_admin_or_marketing"
on public.app_content
for insert
to authenticated
with check (public.is_admin_user() or public.is_marketing_user());

drop policy if exists "app_content_update_admin_or_marketing" on public.app_content;
create policy "app_content_update_admin_or_marketing"
on public.app_content
for update
to authenticated
using (public.is_admin_user() or public.is_marketing_user())
with check (public.is_admin_user() or public.is_marketing_user());

drop policy if exists "app_content_delete_admin_or_marketing" on public.app_content;
create policy "app_content_delete_admin_or_marketing"
on public.app_content
for delete
to authenticated
using (public.is_admin_user() or public.is_marketing_user());

grant select on public.app_content to anon, authenticated;
grant insert, update, delete on public.app_content to authenticated;

-- Platform data read access for Sales Dashboard users.
-- These policies add marketing read access without weakening existing user/admin policies.
drop policy if exists "profiles_select_marketing_all" on public.profiles;
create policy "profiles_select_marketing_all"
on public.profiles
for select
to authenticated
using (public.is_marketing_user());

drop policy if exists "bookings_select_marketing_all" on public.bookings;
create policy "bookings_select_marketing_all"
on public.bookings
for select
to authenticated
using (public.is_marketing_user());

drop policy if exists "ads_select_marketing_all" on public.ads;
create policy "ads_select_marketing_all"
on public.ads
for select
to authenticated
using (public.is_marketing_user());

drop policy if exists "ad_payments_select_marketing_all" on public.ad_payments;
create policy "ad_payments_select_marketing_all"
on public.ad_payments
for select
to authenticated
using (public.is_marketing_user());

grant select on public.profiles to authenticated;
grant select on public.bookings to authenticated;
grant select on public.ads to authenticated;
grant select on public.ad_payments to authenticated;

insert into public.app_content (key, value)
values
(
    'landing_footer',
    '{
        "description": "Modern luxury travel with editorial clarity, refined stays, and calm itinerary design.",
        "columns": [
            {
                "title": "Explore",
                "links": [
                    { "label": "Home", "href": "#h4-hero" },
                    { "label": "Destinations", "href": "#h4-about" },
                    { "label": "Newsletter", "href": "#h4-contact" }
                ]
            },
            {
                "title": "Experiences",
                "links": [
                    { "label": "Beach Escapes" },
                    { "label": "Mountain Stays" },
                    { "label": "Cultural Routes" },
                    { "label": "Luxury Resorts" }
                ]
            },
            {
                "title": "Contact",
                "links": [
                    { "label": "hello@thebetterpass.com", "href": "mailto:hello@thebetterpass.com" },
                    { "label": "+91 1800 000 000", "href": "tel:+911800000000" },
                    { "label": "Member Login", "href": "/auth" }
                ]
            }
        ],
        "copyright": "(c) 2026 The Better Pass. All rights reserved.",
        "socials": [
            { "label": "Instagram", "href": "#" },
            { "label": "Twitter", "href": "#" },
            { "label": "LinkedIn", "href": "#" }
        ]
    }'::jsonb
),
(
    'tourist_hero_messages',
    '{
        "early": ["Start softly somewhere new", "Let the day find you", "Chase quiet morning roads"],
        "morning": ["Wake up to somewhere better", "Your next story starts today", "Find a view worth waking for"],
        "afternoon": ["Step into a brighter detour", "Make today feel far away", "Follow the sun somewhere"],
        "sunset": ["Save sunset for somewhere special", "Let golden hour guide you", "Find your evening escape"],
        "evening": ["Plan tomorrow over tonight", "Turn tonight into a route", "Pick a place for the mood"],
        "night": ["Dream up the next getaway", "Let midnight map it out", "Your next escape is waiting"]
    }'::jsonb
),
(
    'sales_settings',
    '{
        "platformFeeRate": 0.15
    }'::jsonb
)
on conflict (key) do nothing;

-- Assign the role manually:
-- update public.profiles set role = 'marketing' where email = 'marketing@example.com';
