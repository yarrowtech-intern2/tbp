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

alter table public.post_boost_payments enable row level security;

drop policy if exists "post_boost_payments_select_owner_or_admin" on public.post_boost_payments;
create policy "post_boost_payments_select_owner_or_admin"
on public.post_boost_payments
for select
to authenticated
using (
    user_id = auth.uid()
    or public.is_admin_user()
);

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

alter table public.ad_payments enable row level security;

drop policy if exists "ad_payments_select_owner_or_admin" on public.ad_payments;
create policy "ad_payments_select_owner_or_admin"
on public.ad_payments
for select
to authenticated
using (
    user_id = auth.uid()
    or public.is_admin_user()
);

do $$
begin
    if to_regclass('public.ads') is not null then
        execute 'alter table public.ads enable row level security';

        execute 'drop policy if exists "ads_select_owner_or_admin" on public.ads';
        execute $policy$
            create policy "ads_select_owner_or_admin"
            on public.ads
            for select
            to authenticated
            using (
                user_id = auth.uid()
                or public.is_admin_user()
            )
        $policy$;

        execute 'drop policy if exists "ads_insert_owner" on public.ads';
        execute $policy$
            create policy "ads_insert_owner"
            on public.ads
            for insert
            to authenticated
            with check (user_id = auth.uid())
        $policy$;

        execute 'drop policy if exists "ads_update_owner_or_admin" on public.ads';
        execute $policy$
            create policy "ads_update_owner_or_admin"
            on public.ads
            for update
            to authenticated
            using (
                user_id = auth.uid()
                or public.is_admin_user()
            )
            with check (
                user_id = auth.uid()
                or public.is_admin_user()
            )
        $policy$;

        execute 'drop policy if exists "ads_delete_owner_or_admin" on public.ads';
        execute $policy$
            create policy "ads_delete_owner_or_admin"
            on public.ads
            for delete
            to authenticated
            using (
                user_id = auth.uid()
                or public.is_admin_user()
            )
        $policy$;
    end if;
end $$;
