-- Admin revenue RPC
-- Purpose: single backend source for dashboard revenue cards.

create or replace function public.get_admin_revenue(
    p_from timestamptz default null,
    p_to timestamptz default null
)
returns table (
    gross_revenue numeric,
    refunded_amount numeric,
    net_revenue numeric,
    paid_bookings_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin_user(auth.uid()) then
        raise exception 'Forbidden' using errcode = '42501';
    end if;

    return query
    with normalized as (
        select
            lower(trim(coalesce(b.status, ''))) as status_norm,
            lower(trim(coalesce(b.payment_status, ''))) as payment_status_norm,
            case
                when coalesce(b.total_price, 0) > 0 then b.total_price::numeric
                when coalesce(b.unit_price, 0) > 0 and coalesce(b.number_of_people, 0) > 0
                    then (b.unit_price * b.number_of_people)::numeric
                else 0::numeric
            end as amount,
            b.paid_at,
            coalesce(b.paid_at, b.created_at) as effective_ts
        from public.bookings b
        where (p_from is null or coalesce(b.paid_at, b.created_at) >= p_from)
          and (p_to is null or coalesce(b.paid_at, b.created_at) < p_to)
    ),
    classified as (
        select
            *,
            (payment_status_norm = 'paid' or paid_at is not null) as is_paid,
            (payment_status_norm = 'refunded') as is_refunded,
            (status_norm in ('cancelled', 'canceled', 'rejected', 'declined')) as is_cancelled_or_rejected
        from normalized
    )
    select
        coalesce(sum(case
            when is_paid and not is_refunded and not is_cancelled_or_rejected then amount
            else 0::numeric
        end), 0::numeric) as gross_revenue,
        coalesce(sum(case
            when is_refunded then amount
            else 0::numeric
        end), 0::numeric) as refunded_amount,
        coalesce(sum(case
            when is_paid and not is_refunded and not is_cancelled_or_rejected then amount
            else 0::numeric
        end), 0::numeric)
        -
        coalesce(sum(case
            when is_refunded then amount
            else 0::numeric
        end), 0::numeric) as net_revenue,
        coalesce(sum(case
            when is_paid and not is_refunded and not is_cancelled_or_rejected then 1
            else 0
        end), 0)::bigint as paid_bookings_count
    from classified;
end;
$$;

grant execute on function public.get_admin_revenue(timestamptz, timestamptz) to authenticated;

-- Optional validation:
-- select * from public.get_admin_revenue();
