alter table public.posts
    add column if not exists guidelines jsonb not null default '{}'::jsonb;

alter table public.posts
    add column if not exists min_guests integer;

alter table public.posts
    add column if not exists max_guests integer;

alter table public.posts
    drop constraint if exists posts_guidelines_object_check;

alter table public.posts
    add constraint posts_guidelines_object_check
    check (jsonb_typeof(guidelines) = 'object') not valid;

alter table public.posts
    validate constraint posts_guidelines_object_check;

alter table public.posts
    drop constraint if exists posts_group_size_check;

alter table public.posts
    add constraint posts_group_size_check
    check (
        (min_guests is null or min_guests >= 1)
        and (max_guests is null or max_guests >= 1)
        and (min_guests is null or max_guests is null or max_guests >= min_guests)
    ) not valid;

alter table public.posts
    validate constraint posts_group_size_check;
