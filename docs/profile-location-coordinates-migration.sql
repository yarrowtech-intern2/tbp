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
