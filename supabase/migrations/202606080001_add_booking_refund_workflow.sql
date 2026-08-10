alter table public.bookings
    add column if not exists refund_requested_at timestamptz,
    add column if not exists refund_requested_by uuid,
    add column if not exists refund_request_reason text,
    add column if not exists refund_status text,
    add column if not exists refund_processed_at timestamptz,
    add column if not exists refund_processed_by uuid,
    add column if not exists refund_admin_note text,
    add column if not exists refund_reference text;

create index if not exists bookings_refund_status_idx
    on public.bookings (refund_status);

create index if not exists bookings_refund_requested_at_idx
    on public.bookings (refund_requested_at desc);

create or replace function public.prevent_non_admin_refund_processing_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.role() = 'service_role' or public.is_admin_user(auth.uid()) then
        return new;
    end if;

    if old.refund_status is distinct from new.refund_status
        and coalesce(new.refund_status, '') <> 'pending' then
        raise exception 'Refund processing status is admin-only.'
            using errcode = '42501';
    end if;

    if old.payment_status is distinct from new.payment_status
        or old.refund_processed_at is distinct from new.refund_processed_at
        or old.refund_processed_by is distinct from new.refund_processed_by
        or (old.refund_admin_note is distinct from new.refund_admin_note and new.refund_admin_note is not null)
        or (old.refund_reference is distinct from new.refund_reference and new.refund_reference is not null) then
        raise exception 'Refund processing fields are admin-only.'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

grant execute on function public.prevent_non_admin_refund_processing_change() to authenticated, service_role;

drop trigger if exists bookings_prevent_non_admin_refund_processing_change on public.bookings;
create trigger bookings_prevent_non_admin_refund_processing_change
before update on public.bookings
for each row
execute function public.prevent_non_admin_refund_processing_change();
