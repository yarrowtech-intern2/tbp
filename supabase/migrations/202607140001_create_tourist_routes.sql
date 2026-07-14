create table if not exists public.tourist_routes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    client_route_id text,
    title text not null,
    city text not null default '',
    travel_mode text not null default 'driving',
    start_name text not null,
    destination_name text not null,
    stop_names jsonb not null default '[]'::jsonb,
    route_points jsonb not null default '[]'::jsonb,
    waypoints jsonb not null default '[]'::jsonb,
    recommended_places jsonb not null default '[]'::jsonb,
    distance_meters numeric not null default 0,
    duration_seconds numeric not null default 0,
    visited_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint tourist_routes_travel_mode_check check (travel_mode in ('driving', 'walking', 'cycling'))
);

create unique index if not exists tourist_routes_user_client_route_id_idx
    on public.tourist_routes (user_id, client_route_id)
    where client_route_id is not null;

create index if not exists tourist_routes_user_visited_at_idx
    on public.tourist_routes (user_id, visited_at desc);

alter table public.tourist_routes enable row level security;

drop policy if exists "tourist_routes_select_own_or_admin" on public.tourist_routes;
create policy "tourist_routes_select_own_or_admin"
on public.tourist_routes
for select
to authenticated
using (
    auth.uid() = user_id
    or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
    )
);

drop policy if exists "tourist_routes_insert_own_tourist" on public.tourist_routes;
create policy "tourist_routes_insert_own_tourist"
on public.tourist_routes
for insert
to authenticated
with check (
    auth.uid() = user_id
    and exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'tourist'
    )
);

drop policy if exists "tourist_routes_update_own_or_admin" on public.tourist_routes;
create policy "tourist_routes_update_own_or_admin"
on public.tourist_routes
for update
to authenticated
using (
    auth.uid() = user_id
    or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
    )
)
with check (
    auth.uid() = user_id
    or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
    )
);

drop policy if exists "tourist_routes_delete_own_or_admin" on public.tourist_routes;
create policy "tourist_routes_delete_own_or_admin"
on public.tourist_routes
for delete
to authenticated
using (
    auth.uid() = user_id
    or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
    )
);
