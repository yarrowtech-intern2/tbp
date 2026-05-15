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
using (auth.uid() = user_id);

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
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
