create table if not exists public.profile_follows (
    id uuid primary key default gen_random_uuid(),
    follower_user_id uuid not null references auth.users(id) on delete cascade,
    followed_user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint profile_follows_not_self check (follower_user_id <> followed_user_id),
    constraint profile_follows_unique unique (follower_user_id, followed_user_id)
);

create index if not exists profile_follows_followed_idx
    on public.profile_follows (followed_user_id, created_at desc);

create index if not exists profile_follows_follower_idx
    on public.profile_follows (follower_user_id, created_at desc);

alter table public.profile_follows enable row level security;

drop policy if exists "profile_follows_select_authenticated" on public.profile_follows;
create policy "profile_follows_select_authenticated"
on public.profile_follows
for select
to authenticated
using (true);

drop policy if exists "profile_follows_insert_tourist_to_provider" on public.profile_follows;
create policy "profile_follows_insert_tourist_to_provider"
on public.profile_follows
for insert
to authenticated
with check (
    follower_user_id = auth.uid()
    and follower_user_id <> followed_user_id
    and exists (
        select 1
        from public.profiles follower
        where follower.id = auth.uid()
          and follower.role = 'tourist'
    )
    and exists (
        select 1
        from public.profiles provider
        where provider.id = followed_user_id
          and provider.role in ('tour_company', 'tour_instructor', 'tour_guide')
    )
);

drop policy if exists "profile_follows_delete_own" on public.profile_follows;
create policy "profile_follows_delete_own"
on public.profile_follows
for delete
to authenticated
using (follower_user_id = auth.uid());
