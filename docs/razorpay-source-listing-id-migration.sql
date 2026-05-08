-- Razorpay source listing id migration
-- Date: 2026-05-06
-- Scope: preserve legacy/text listing ids for bookings while keeping UUID-only schemas compatible.

begin;

alter table public.bookings
    add column if not exists source_listing_id text;

do $$
begin
    -- Older TBP schemas can still have legacy required ids that are no longer
    -- the canonical booking/listing link.
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
set source_listing_id = listing_id::text
where source_listing_id is null
  and listing_id is not null;

create index if not exists bookings_source_listing_lookup_idx
    on public.bookings(listing_type, source_listing_id)
    where source_listing_id is not null;

commit;
