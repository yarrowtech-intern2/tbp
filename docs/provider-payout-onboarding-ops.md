# Provider Payout Onboarding (Post-Accept)

## Platform behavior implemented
- Provider enters **actual package price**.
- Tourist sees **actual price + 15% platform fee** (tax-inclusive display).
- Booking stores:
  - `unit_price` = provider actual unit price
  - `total_price` = tourist paid final price
  - `platform_fee_amount`
  - `provider_payout_amount`
  - `payout_status`
- When provider accepts booking: `payout_status` moves to `ready_for_payout`.
- After provider acceptance, the app invokes `process-provider-payout`.
- `process-provider-payout` transfers `provider_payout_amount` to the provider Razorpay Route linked account and marks the booking `paid_out`.

## Steps you need to do
1. Run [platform-fee-payout-migration.sql](/e/s15/Projects/TBP/docs/platform-fee-payout-migration.sql) in Supabase SQL Editor.
2. Run [202606110001_add_razorpay_route_payout_fields.sql](/e/s15/Projects/TBP/supabase/migrations/202606110001_add_razorpay_route_payout_fields.sql).
3. Deploy `process-provider-payout`:
   - `supabase functions deploy process-provider-payout`
4. Set function secrets:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `PAYOUT_PROCESSOR_SECRET` for cron/admin jobs
5. Keep legacy trigger patch applied (already discussed): [bookings-legacy-trigger-compat.sql](/e/s15/Projects/TBP/docs/bookings-legacy-trigger-compat.sql).
6. In Razorpay dashboard, enable Route/Linked Accounts for marketplace payouts.
7. Add provider onboarding flow in your business process:
   - collect beneficiary legal name
   - payout method (UPI or bank)
   - compliance/KYC documents as required
   - create or approve a Razorpay Route linked account
   - store its account id in `provider_payout_onboarding.razorpay_account_id`
   - set `provider_payout_onboarding.status='completed'`
8. Optional: enable a scheduled payout retry job:
   - input rows: `bookings where payout_status='ready_for_payout' and payment_status='paid'`
   - call `process-provider-payout` with the `x-payout-secret` header
   - on success: set `payout_status='paid_out'`, store `payout_reference`, `payout_processed_at=now()`
   - on failure: set `payout_status='failed'` and log error
9. Add admin retry control for failed payouts.
10. (Optional but recommended) Add webhook reconciliation for transfer updates.

## Recommended payout timing
- Trigger payout only after provider accepts booking.
- If provider rejects booking, mark `payout_status='cancelled'` and process full refund to tourist.
