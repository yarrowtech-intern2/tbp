-- Razorpay booking metadata migration
-- Date: 2026-04-30
-- Scope: keep booking creation strictly post-payment and store payment references.

begin;

alter table public.bookings
    add column if not exists payment_order_id text,
    add column if not exists payment_id text,
    add column if not exists payment_signature text,
    add column if not exists payment_currency text default 'INR',
    add column if not exists source_listing_id text,
    add column if not exists paid_at timestamptz;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'bookings'
          and column_name = 'post_id'
    ) then
        alter table public.bookings alter column post_id drop not null;
    end if;

    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'bookings'
          and column_name = 'activity_id'
    ) then
        alter table public.bookings alter column activity_id drop not null;
    end if;
end $$;

update public.bookings
set payment_currency = 'INR'
where payment_currency is null;

update public.bookings
set source_listing_id = listing_id::text
where source_listing_id is null
  and listing_id is not null;

alter table public.bookings
    alter column payment_currency set default 'INR';

create unique index if not exists bookings_payment_id_uniq
    on public.bookings(payment_id)
    where payment_id is not null;

create index if not exists bookings_payment_order_id_idx
    on public.bookings(payment_order_id);

create index if not exists bookings_source_listing_lookup_idx
    on public.bookings(listing_type, source_listing_id)
    where source_listing_id is not null;

commit;
