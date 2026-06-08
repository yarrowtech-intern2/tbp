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
