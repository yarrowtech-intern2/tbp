create extension if not exists pgcrypto;

create table if not exists public.newsletter_subscribers (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    full_name text,
    user_id uuid references auth.users (id) on delete set null,
    source text not null default 'signup',
    status text not null default 'subscribed'
        check (status in ('subscribed', 'unsubscribed')),
    subscribed_at timestamptz not null default now(),
    unsubscribed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists newsletter_subscribers_status_idx
    on public.newsletter_subscribers (status, subscribed_at desc);

create index if not exists newsletter_subscribers_user_idx
    on public.newsletter_subscribers (user_id)
    where user_id is not null;

alter table public.newsletter_subscribers enable row level security;

drop policy if exists newsletter_subscribers_insert_public on public.newsletter_subscribers;
create policy newsletter_subscribers_insert_public
    on public.newsletter_subscribers
    for insert
    to anon, authenticated
    with check (true);

drop policy if exists newsletter_subscribers_select_admin on public.newsletter_subscribers;
create policy newsletter_subscribers_select_admin
    on public.newsletter_subscribers
    for select
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

create or replace function public.set_newsletter_subscriber_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists newsletter_subscribers_touch_updated_at on public.newsletter_subscribers;
create trigger newsletter_subscribers_touch_updated_at
before update on public.newsletter_subscribers
for each row
execute function public.set_newsletter_subscriber_updated_at();
