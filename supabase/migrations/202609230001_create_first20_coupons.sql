create extension if not exists pgcrypto;

create table if not exists public.coupons (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    discount_type text not null default 'percent'
        check (discount_type in ('percent', 'flat')),
    discount_value numeric(10, 2) not null
        check (discount_value > 0),
    max_discount_amount numeric(10, 2)
        check (max_discount_amount is null or max_discount_amount > 0),
    active boolean not null default true,
    funded_by text not null default 'platform'
        check (funded_by in ('platform', 'provider', 'shared')),
    first_confirmed_booking_only boolean not null default false,
    starts_at timestamptz not null default now(),
    expires_at timestamptz,
    max_redemptions integer
        check (max_redemptions is null or max_redemptions > 0),
    max_redemptions_per_user integer not null default 1
        check (max_redemptions_per_user > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.coupon_redemptions (
    id uuid primary key default gen_random_uuid(),
    coupon_id uuid not null references public.coupons (id) on delete restrict,
    user_id uuid not null references auth.users (id) on delete cascade,
    booking_id uuid references public.bookings (id) on delete set null,
    code text not null,
    status text not null default 'reserved'
        check (status in ('reserved', 'paid_pending', 'used', 'released', 'expired')),
    source text not null default 'qr_leaflet',
    listing_id text,
    listing_type text,
    payment_order_id text,
    payment_id text,
    original_total_price numeric(12, 2) not null default 0,
    discount_amount numeric(12, 2) not null default 0,
    final_total_price numeric(12, 2) not null default 0,
    metadata jsonb not null default '{}'::jsonb,
    reserved_at timestamptz not null default now(),
    reserved_until timestamptz,
    used_at timestamptz,
    released_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.bookings
    add column if not exists coupon_id uuid references public.coupons (id) on delete set null,
    add column if not exists coupon_redemption_id uuid references public.coupon_redemptions (id) on delete set null,
    add column if not exists coupon_code text,
    add column if not exists coupon_discount_amount numeric(12, 2) not null default 0,
    add column if not exists coupon_original_total_price numeric(12, 2),
    add column if not exists coupon_final_total_price numeric(12, 2),
    add column if not exists coupon_funded_by text
        check (coupon_funded_by is null or coupon_funded_by in ('platform', 'provider', 'shared')),
    add column if not exists platform_subsidy_amount numeric(12, 2) not null default 0;

create index if not exists coupons_active_code_idx
    on public.coupons (code)
    where active = true;

create index if not exists coupon_redemptions_user_idx
    on public.coupon_redemptions (user_id, created_at desc);

create index if not exists coupon_redemptions_coupon_status_idx
    on public.coupon_redemptions (coupon_id, status);

create unique index if not exists coupon_redemptions_user_coupon_active_idx
    on public.coupon_redemptions (user_id, coupon_id)
    where status in ('reserved', 'paid_pending', 'used');

create unique index if not exists coupon_redemptions_payment_order_idx
    on public.coupon_redemptions (payment_order_id)
    where payment_order_id is not null;

create index if not exists bookings_coupon_redemption_idx
    on public.bookings (coupon_redemption_id)
    where coupon_redemption_id is not null;

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists coupons_read_active on public.coupons;
create policy coupons_read_active
    on public.coupons
    for select
    to authenticated
    using (active = true);

drop policy if exists coupon_redemptions_read_own on public.coupon_redemptions;
create policy coupon_redemptions_read_own
    on public.coupon_redemptions
    for select
    to authenticated
    using (user_id = auth.uid());

create or replace function public.touch_coupon_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists coupons_touch_updated_at on public.coupons;
create trigger coupons_touch_updated_at
before update on public.coupons
for each row
execute function public.touch_coupon_updated_at();

drop trigger if exists coupon_redemptions_touch_updated_at on public.coupon_redemptions;
create trigger coupon_redemptions_touch_updated_at
before update on public.coupon_redemptions
for each row
execute function public.touch_coupon_updated_at();

create or replace function public.sync_coupon_redemption_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_status text;
    normalized_payment_status text;
begin
    if new.coupon_redemption_id is null then
        return new;
    end if;

    normalized_status := lower(coalesce(new.status, ''));
    normalized_payment_status := lower(coalesce(new.payment_status, ''));

    update public.coupon_redemptions
    set
        booking_id = new.id,
        payment_order_id = coalesce(payment_order_id, new.payment_order_id),
        payment_id = coalesce(new.payment_id, payment_id),
        updated_at = now()
    where id = new.coupon_redemption_id
      and user_id = new.user_id;

    if normalized_payment_status = 'paid'
       and normalized_status in ('pending', '')
    then
        update public.coupon_redemptions
        set
            status = 'paid_pending',
            booking_id = new.id,
            payment_order_id = coalesce(payment_order_id, new.payment_order_id),
            payment_id = coalesce(new.payment_id, payment_id),
            updated_at = now()
        where id = new.coupon_redemption_id
          and user_id = new.user_id
          and status in ('reserved', 'expired');
    elsif normalized_payment_status = 'paid'
       and normalized_status in ('confirmed', 'accepted', 'completed')
    then
        update public.coupon_redemptions
        set
            status = 'used',
            booking_id = new.id,
            payment_order_id = coalesce(payment_order_id, new.payment_order_id),
            payment_id = coalesce(new.payment_id, payment_id),
            used_at = coalesce(used_at, now()),
            updated_at = now()
        where id = new.coupon_redemption_id
          and user_id = new.user_id
          and status in ('reserved', 'paid_pending', 'expired');
    elsif normalized_status in ('rejected', 'declined', 'cancelled', 'canceled')
    then
        update public.coupon_redemptions
        set
            status = 'released',
            booking_id = new.id,
            payment_order_id = coalesce(payment_order_id, new.payment_order_id),
            payment_id = coalesce(new.payment_id, payment_id),
            released_at = coalesce(released_at, now()),
            updated_at = now()
        where id = new.coupon_redemption_id
          and user_id = new.user_id
          and status in ('reserved', 'paid_pending', 'expired');
    end if;

    return new;
end;
$$;

drop trigger if exists bookings_sync_coupon_redemption on public.bookings;
create trigger bookings_sync_coupon_redemption
after insert or update of status, payment_status, payment_id, payment_order_id, coupon_redemption_id
on public.bookings
for each row
execute function public.sync_coupon_redemption_from_booking();

insert into public.coupons (
    code,
    name,
    discount_type,
    discount_value,
    max_discount_amount,
    active,
    funded_by,
    first_confirmed_booking_only,
    starts_at,
    max_redemptions_per_user
)
values (
    'FIRST20',
    'Leaflet first booking 20% off',
    'percent',
    20,
    null,
    true,
    'platform',
    true,
    now(),
    1
)
on conflict (code) do update
set
    name = excluded.name,
    discount_type = excluded.discount_type,
    discount_value = excluded.discount_value,
    max_discount_amount = excluded.max_discount_amount,
    active = excluded.active,
    funded_by = excluded.funded_by,
    first_confirmed_booking_only = excluded.first_confirmed_booking_only,
    max_redemptions_per_user = excluded.max_redemptions_per_user,
    updated_at = now();
