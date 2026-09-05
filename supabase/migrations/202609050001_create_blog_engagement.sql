create table if not exists public.blog_votes (
    id uuid primary key default gen_random_uuid(),
    blog_id uuid not null references public.blogs(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    vote_value smallint not null check (vote_value in (-1, 1)),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint blog_votes_blog_user_unique unique (blog_id, user_id)
);

create table if not exists public.blog_comments (
    id uuid primary key default gen_random_uuid(),
    blog_id uuid not null references public.blogs(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    author_name text not null,
    author_avatar_url text,
    content text not null check (char_length(trim(content)) between 1 and 2000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.blog_comment_votes (
    id uuid primary key default gen_random_uuid(),
    comment_id uuid not null references public.blog_comments(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    vote_value smallint not null check (vote_value in (-1, 1)),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint blog_comment_votes_comment_user_unique unique (comment_id, user_id)
);

create index if not exists blog_votes_blog_id_idx on public.blog_votes (blog_id);
create index if not exists blog_votes_user_id_idx on public.blog_votes (user_id);
create index if not exists blog_comments_blog_created_idx on public.blog_comments (blog_id, created_at desc);
create index if not exists blog_comments_user_id_idx on public.blog_comments (user_id);
create index if not exists blog_comment_votes_comment_id_idx on public.blog_comment_votes (comment_id);
create index if not exists blog_comment_votes_user_id_idx on public.blog_comment_votes (user_id);

create or replace function public.set_blog_engagement_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists blog_votes_set_updated_at on public.blog_votes;
create trigger blog_votes_set_updated_at
before update on public.blog_votes
for each row execute function public.set_blog_engagement_updated_at();

drop trigger if exists blog_comments_set_updated_at on public.blog_comments;
create trigger blog_comments_set_updated_at
before update on public.blog_comments
for each row execute function public.set_blog_engagement_updated_at();

drop trigger if exists blog_comment_votes_set_updated_at on public.blog_comment_votes;
create trigger blog_comment_votes_set_updated_at
before update on public.blog_comment_votes
for each row execute function public.set_blog_engagement_updated_at();

alter table public.blog_votes enable row level security;
alter table public.blog_comments enable row level security;
alter table public.blog_comment_votes enable row level security;

drop policy if exists "blog_votes_select_public" on public.blog_votes;
create policy "blog_votes_select_public"
on public.blog_votes
for select
to anon, authenticated
using (true);

drop policy if exists "blog_votes_insert_own" on public.blog_votes;
create policy "blog_votes_insert_own"
on public.blog_votes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "blog_votes_update_own" on public.blog_votes;
create policy "blog_votes_update_own"
on public.blog_votes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "blog_votes_delete_own" on public.blog_votes;
create policy "blog_votes_delete_own"
on public.blog_votes
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "blog_comments_select_public" on public.blog_comments;
create policy "blog_comments_select_public"
on public.blog_comments
for select
to anon, authenticated
using (true);

drop policy if exists "blog_comments_insert_own" on public.blog_comments;
create policy "blog_comments_insert_own"
on public.blog_comments
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "blog_comments_update_own_or_admin" on public.blog_comments;
create policy "blog_comments_update_own_or_admin"
on public.blog_comments
for update
to authenticated
using (
    user_id = auth.uid()
    or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
    )
)
with check (
    user_id = auth.uid()
    or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
    )
);

drop policy if exists "blog_comments_delete_own_or_admin" on public.blog_comments;
create policy "blog_comments_delete_own_or_admin"
on public.blog_comments
for delete
to authenticated
using (
    user_id = auth.uid()
    or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
    )
);

drop policy if exists "blog_comment_votes_select_public" on public.blog_comment_votes;
create policy "blog_comment_votes_select_public"
on public.blog_comment_votes
for select
to anon, authenticated
using (true);

drop policy if exists "blog_comment_votes_insert_own" on public.blog_comment_votes;
create policy "blog_comment_votes_insert_own"
on public.blog_comment_votes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "blog_comment_votes_update_own" on public.blog_comment_votes;
create policy "blog_comment_votes_update_own"
on public.blog_comment_votes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "blog_comment_votes_delete_own" on public.blog_comment_votes;
create policy "blog_comment_votes_delete_own"
on public.blog_comment_votes
for delete
to authenticated
using (user_id = auth.uid());
