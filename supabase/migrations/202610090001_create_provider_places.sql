-- Provider places on /map: providers pin their business locations (restaurant, hotel, workshop...) and the
-- location of each listing. Pins are public straight away; admins can hide or delete them.
-- A pin linked to a listing is only public while that listing is live.

create table if not exists public.provider_places (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (char_length(trim(name)) between 2 and 80),
    category text not null check (category in (
        'restaurant', 'hotel', 'crafting', 'pottery', 'museum', 'tour', 'activity', 'event', 'other'
    )),
    custom_label text not null default '' check (char_length(custom_label) <= 40),
    description text not null default '' check (char_length(description) <= 500),
    address text not null default '' check (char_length(address) <= 200),
    lat double precision not null check (lat between -90 and 90),
    lng double precision not null check (lng between -180 and 180),
    listing_id text,
    listing_type text check (listing_type is null or listing_type in ('tour', 'activity', 'guide', 'event')),
    is_hidden boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists provider_places_user_idx on public.provider_places (user_id, created_at desc);
create unique index if not exists provider_places_listing_idx on public.provider_places (listing_id) where listing_id is not null;

alter table public.provider_places enable row level security;

-- Visible to everyone unless hidden; a pin tied to a listing waits until the listing is live.
drop policy if exists "Provider places are public" on public.provider_places;
create policy "Provider places are public" on public.provider_places
    for select using (
        (
            not is_hidden
            and (
                listing_id is null
                or exists (
                    select 1 from public.posts p
                    where p.id::text = provider_places.listing_id
                      and p.status in ('live', 'published')
                )
            )
        )
        or user_id = auth.uid()
        or public.is_admin_user()
    );

drop policy if exists "Providers add their places" on public.provider_places;
create policy "Providers add their places" on public.provider_places
    for insert to authenticated with check (
        user_id = auth.uid()
        and not is_hidden
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('tour_company', 'tour_instructor', 'tour_guide', 'local_guide')
        )
        and (
            listing_id is null
            or exists (
                select 1 from public.posts l
                where l.id::text = listing_id
                  and (l.user_id::text = auth.uid()::text or l.provider_user_id::text = auth.uid()::text)
            )
        )
    );

drop policy if exists "Providers update their places" on public.provider_places;
create policy "Providers update their places" on public.provider_places
    for update to authenticated
    using (user_id = auth.uid() or public.is_admin_user())
    with check (user_id = auth.uid() or public.is_admin_user());

drop policy if exists "Providers delete their places" on public.provider_places;
create policy "Providers delete their places" on public.provider_places
    for delete to authenticated
    using (user_id = auth.uid() or public.is_admin_user());

-- Owners cannot unhide their own pin or move it to another account; each provider gets at most 30 pins.
create or replace function public.provider_places_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.updated_at := now();
    if not public.is_admin_user() then
        if tg_op = 'INSERT' then
            new.is_hidden := false;
            if (select count(*) from public.provider_places where user_id = new.user_id) >= 30 then
                raise exception 'You can pin up to 30 places' using errcode = '23514';
            end if;
        else
            new.is_hidden := old.is_hidden;
            new.user_id := old.user_id;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists provider_places_guard on public.provider_places;
create trigger provider_places_guard
    before insert or update on public.provider_places
    for each row execute function public.provider_places_guard();

grant select on public.provider_places to anon, authenticated;
grant insert, update, delete on public.provider_places to authenticated;
