-- Provider decision workflow for bookings.
-- Adds provider decision metadata and allows explicit `rejected` booking status.

alter table public.bookings
    add column if not exists provider_decision_at timestamptz,
    add column if not exists provider_decision_by uuid references auth.users(id) on delete set null,
    add column if not exists rejection_reason text;

-- Normalize legacy / inconsistent status values before enforcing the new check.
update public.bookings
set status = lower(trim(status))
where status is not null
  and status <> lower(trim(status));

update public.bookings
set status = 'cancelled'
where status in ('canceled', 'cancel');

update public.bookings
set status = 'rejected'
where status in ('declined', 'rejected_by_provider', 'provider_rejected');

update public.bookings
set status = 'pending'
where status is null
   or trim(status) = ''
   or status not in ('pending', 'confirmed', 'cancelled', 'completed', 'rejected');

-- Drop only status check constraints (do not touch payment_status checks).
do $$
declare
    constraint_name text;
begin
    for constraint_name in
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'bookings'
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) ilike '%status%'
          and pg_get_constraintdef(c.oid) not ilike '%payment_status%'
    loop
        execute format('alter table public.bookings drop constraint if exists %I', constraint_name);
    end loop;
end $$;

alter table public.bookings
    add constraint bookings_status_check
    check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'rejected'));

-- Optional: inspect final status distribution.
-- select status, count(*) from public.bookings group by status order by status;
