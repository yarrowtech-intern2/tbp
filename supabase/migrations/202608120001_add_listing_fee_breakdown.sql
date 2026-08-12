alter table public.posts
    add column if not exists fee_breakdown jsonb;

alter table public.posts
    drop constraint if exists posts_fee_breakdown_object_check;

alter table public.posts
    add constraint posts_fee_breakdown_object_check
    check (
        fee_breakdown is null
        or jsonb_typeof(fee_breakdown) = 'object'
    );

create index if not exists posts_fee_breakdown_gin_idx
on public.posts
using gin (fee_breakdown)
where fee_breakdown is not null;
