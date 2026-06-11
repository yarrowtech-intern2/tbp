-- Razorpay Route payout fields for provider autopay.
-- Run after the platform fee payout migration has been applied.

alter table public.provider_payout_onboarding
    add column if not exists razorpay_account_id text,
    add column if not exists razorpay_account_status text,
    add column if not exists razorpay_account_created_at timestamptz;

create index if not exists provider_payout_onboarding_razorpay_account_idx
    on public.provider_payout_onboarding (razorpay_account_id)
    where razorpay_account_id is not null;

alter table public.bookings
    add column if not exists payout_error text;
