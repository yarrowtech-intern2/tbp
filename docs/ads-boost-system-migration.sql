alter table if exists public.posts
    add column if not exists is_boosted boolean default false,
    add column if not exists boost_start timestamptz,
    add column if not exists boost_end timestamptz;

create table if not exists public.post_boost_payments (
    id uuid primary key default gen_random_uuid(),
    post_id text not null,
    user_id uuid not null,
    plan_key text not null check (plan_key in ('week', 'month', 'half_year')),
    duration_days integer not null,
    amount numeric(10, 2) not null,
    status text not null default 'paid',
    payment_order_id text,
    payment_id text unique,
    payment_signature text,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_post_boost_payments_post_id on public.post_boost_payments (post_id);
create index if not exists idx_post_boost_payments_user_id on public.post_boost_payments (user_id);
create index if not exists idx_post_boost_payments_active_window on public.post_boost_payments (starts_at, ends_at);

create table if not exists public.ad_payments (
    id uuid primary key default gen_random_uuid(),
    ad_id text not null,
    user_id uuid not null,
    plan_key text not null check (plan_key in ('week', 'month', 'half_year')),
    duration_days integer not null,
    amount numeric(10, 2) not null,
    status text not null default 'paid',
    payment_order_id text,
    payment_id text unique,
    payment_signature text,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_ad_payments_ad_id on public.ad_payments (ad_id);
create index if not exists idx_ad_payments_user_id on public.ad_payments (user_id);
create index if not exists idx_ad_payments_active_window on public.ad_payments (starts_at, ends_at);
