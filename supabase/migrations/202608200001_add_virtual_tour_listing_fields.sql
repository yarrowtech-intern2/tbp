alter table public.posts
    add column if not exists is_virtual_tour boolean not null default false;

alter table public.posts
    add column if not exists virtual_tour_details jsonb not null default '{}'::jsonb;

alter table public.posts
    add column if not exists delivery_mode text;

alter table public.posts
    add column if not exists experience_mode text;

alter table public.posts
    add constraint posts_virtual_tour_details_object_check
    check (jsonb_typeof(virtual_tour_details) = 'object') not valid;

alter table public.posts
    validate constraint posts_virtual_tour_details_object_check;

create index if not exists posts_is_virtual_tour_idx
    on public.posts (is_virtual_tour)
    where is_virtual_tour = true;

create index if not exists posts_virtual_tour_details_gin_idx
    on public.posts
    using gin (virtual_tour_details);

update public.posts
set
    is_virtual_tour = true,
    delivery_mode = coalesce(delivery_mode, 'virtual_live'),
    experience_mode = coalesce(experience_mode, 'virtual')
where
    coalesce(is_virtual_tour, false) = false
    and (
        lower(coalesce(sub_category, '')) like '%virtual%'
        or lower(coalesce(sub_category, '')) like '%360%'
        or lower(coalesce(category, '')) like '%virtual%'
        or lower(coalesce(title, '')) like '%virtual%'
        or lower(coalesce(description, '')) like '%virtual%'
        or lower(coalesce(description, '')) like '%live 360%'
        or lower(coalesce(description, '')) like '%vr tour%'
        or lower(coalesce(description, '')) like '%ar tour%'
    );

alter table public.bookings
    add column if not exists is_virtual_tour boolean not null default false;

create index if not exists bookings_is_virtual_tour_idx
    on public.bookings (is_virtual_tour)
    where is_virtual_tour = true;

update public.bookings
set is_virtual_tour = true
where
    coalesce(is_virtual_tour, false) = false
    and (
        lower(coalesce(listing_title, '')) like '%virtual%'
        or lower(coalesce(listing_title, '')) like '%360%'
        or lower(coalesce(listing_title, '')) like '%vr%'
        or lower(coalesce(listing_title, '')) like '%ar%'
    );
