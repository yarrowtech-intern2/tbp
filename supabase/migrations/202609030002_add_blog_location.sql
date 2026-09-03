alter table public.blogs
add column if not exists location text not null default '';

create index if not exists blogs_location_idx on public.blogs (location);
