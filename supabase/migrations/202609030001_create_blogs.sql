create table if not exists public.blogs (
    id uuid primary key default gen_random_uuid(),
    author_id uuid not null references public.profiles(id) on delete cascade,
    author_name text not null,
    author_avatar_url text,
    title text not null,
    slug text not null,
    excerpt text not null,
    content text not null,
    category text not null,
    location text not null default '',
    tags text[] not null default '{}'::text[],
    cover_image_url text not null,
    content_image_urls text[] not null default '{}'::text[],
    status text not null default 'published',
    published_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint blogs_status_check check (status = 'published'),
    constraint blogs_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists blogs_slug_idx on public.blogs (slug);
create index if not exists blogs_published_at_idx on public.blogs (published_at desc);
create index if not exists blogs_author_id_idx on public.blogs (author_id);
create index if not exists blogs_category_idx on public.blogs (category);
create index if not exists blogs_location_idx on public.blogs (location);
create index if not exists blogs_tags_idx on public.blogs using gin (tags);

alter table public.blogs enable row level security;

drop policy if exists "blogs_select_published_public" on public.blogs;
create policy "blogs_select_published_public"
on public.blogs
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "blogs_insert_registered_users" on public.blogs;
create policy "blogs_insert_registered_users"
on public.blogs
for insert
to authenticated
with check (
    auth.uid() = author_id
    and status = 'published'
);

drop policy if exists "blogs_delete_admin_only" on public.blogs;
create policy "blogs_delete_admin_only"
on public.blogs
for delete
to authenticated
using (
    exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
    )
);
