alter table public.profiles
    add column if not exists latitude double precision,
    add column if not exists longitude double precision;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'profiles_latitude_range_check'
    ) then
        alter table public.profiles
            add constraint profiles_latitude_range_check
            check (latitude is null or (latitude >= -90 and latitude <= 90));
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'profiles_longitude_range_check'
    ) then
        alter table public.profiles
            add constraint profiles_longitude_range_check
            check (longitude is null or (longitude >= -180 and longitude <= 180));
    end if;
end $$;

create index if not exists profiles_role_city_country_idx
    on public.profiles (role, country, city);

create index if not exists profiles_coordinates_idx
    on public.profiles (latitude, longitude)
    where latitude is not null and longitude is not null;

comment on column public.profiles.latitude is 'Cached latitude resolved from profile city/country for internal map features.';
comment on column public.profiles.longitude is 'Cached longitude resolved from profile city/country for internal map features.';

create or replace function public.get_admin_account_locations()
returns table (
    id uuid,
    full_name text,
    email text,
    role text,
    phone text,
    city text,
    country text,
    latitude double precision,
    longitude double precision,
    profile_image_url text,
    bio text,
    website text,
    company_name text,
    provider_specialties text,
    is_verified boolean,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin_user(auth.uid()) then
        raise exception 'Forbidden' using errcode = '42501';
    end if;

    return query
    select
        p.id,
        p.full_name,
        p.email,
        p.role,
        p.phone,
        p.city,
        p.country,
        p.latitude,
        p.longitude,
        p.profile_image_url,
        p.bio,
        p.website,
        p.company_name,
        p.provider_specialties,
        p.is_verified,
        p.created_at
    from public.profiles p
    order by p.created_at desc;
end;
$$;

grant execute on function public.get_admin_account_locations() to authenticated;
