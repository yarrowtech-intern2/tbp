-- Platform fee + provider payout tracking
-- Run once in Supabase SQL editor.

alter table public.bookings
    add column if not exists platform_fee_rate numeric(6,4) default 0.15,
    add column if not exists platform_fee_amount numeric(12,2) default 0,
    add column if not exists provider_payout_amount numeric(12,2) default 0,
    add column if not exists payout_status text default 'pending_provider_acceptance',
    add column if not exists payout_processed_at timestamptz,
    add column if not exists payout_reference text;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'bookings_payout_status_check'
          and conrelid = 'public.bookings'::regclass
    ) then
        alter table public.bookings
            add constraint bookings_payout_status_check
            check (payout_status in (
                'pending_provider_acceptance',
                'ready_for_payout',
                'processing',
                'paid_out',
                'failed',
                'cancelled'
            ));
    end if;
end
$$;

create or replace function public.prevent_non_admin_payout_accounting_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.role() = 'service_role' or public.is_admin_user(auth.uid()) then
        return new;
    end if;

    if old.platform_fee_rate is distinct from new.platform_fee_rate
        or old.platform_fee_amount is distinct from new.platform_fee_amount
        or old.provider_payout_amount is distinct from new.provider_payout_amount
        or old.payout_processed_at is distinct from new.payout_processed_at
        or old.payout_reference is distinct from new.payout_reference then
        raise exception 'Payout accounting fields are admin-only.'
            using errcode = '42501';
    end if;

    if old.payout_status is distinct from new.payout_status
        and not (
            new.provider_user_id = auth.uid()
            and coalesce(old.payout_status, 'pending_provider_acceptance') = 'pending_provider_acceptance'
            and new.payout_status in ('ready_for_payout', 'cancelled')
        ) then
        raise exception 'Payout status changes are admin-only outside provider booking decisions.'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

grant execute on function public.prevent_non_admin_payout_accounting_change() to authenticated, service_role;

drop trigger if exists bookings_prevent_non_admin_payout_accounting_change on public.bookings;
create trigger bookings_prevent_non_admin_payout_accounting_change
before update on public.bookings
for each row
execute function public.prevent_non_admin_payout_accounting_change();

create table if not exists public.provider_payout_onboarding (
    user_id uuid primary key references auth.users(id) on delete cascade,
    status text not null default 'not_started',
    acknowledged_pricing boolean not null default false,
    payout_method text,
    beneficiary_name text,
    upi_id text,
    bank_account_last4 text,
    ifsc_code text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'provider_payout_onboarding_status_check'
          and conrelid = 'public.provider_payout_onboarding'::regclass
    ) then
        alter table public.provider_payout_onboarding
            add constraint provider_payout_onboarding_status_check
            check (status in ('not_started', 'in_progress', 'completed', 'blocked'));
    end if;
end
$$;

alter table public.provider_payout_onboarding enable row level security;

drop policy if exists "provider_payout_onboarding_select_own" on public.provider_payout_onboarding;
create policy "provider_payout_onboarding_select_own"
on public.provider_payout_onboarding
for select
to authenticated
using (
    auth.uid() = user_id
    or public.is_admin_user()
);

drop policy if exists "provider_payout_onboarding_upsert_own" on public.provider_payout_onboarding;
create policy "provider_payout_onboarding_upsert_own"
on public.provider_payout_onboarding
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "provider_payout_onboarding_update_own" on public.provider_payout_onboarding;
create policy "provider_payout_onboarding_update_own"
on public.provider_payout_onboarding
for update
to authenticated
using (
    auth.uid() = user_id
    or public.is_admin_user()
)
with check (
    auth.uid() = user_id
    or public.is_admin_user()
);
