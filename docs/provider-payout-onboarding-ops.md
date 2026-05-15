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

## Steps you need to do
1. Run [platform-fee-payout-migration.sql](/e/s15/Projects/TBP/docs/platform-fee-payout-migration.sql) in Supabase SQL Editor.
2. Keep legacy trigger patch applied (already discussed): [bookings-legacy-trigger-compat.sql](/e/s15/Projects/TBP/docs/bookings-legacy-trigger-compat.sql).
3. In Razorpay dashboard, enable Route/Linked Accounts for marketplace payouts.
4. Add provider onboarding flow in your business process:
   - collect beneficiary legal name
   - payout method (UPI or bank)
   - compliance/KYC documents as required
5. Build/enable payout executor job:
   - input rows: `bookings where payout_status='ready_for_payout' and payment_status='paid'`
   - call Razorpay transfer API for `provider_payout_amount`
   - on success: set `payout_status='paid_out'`, store `payout_reference`, `payout_processed_at=now()`
   - on failure: set `payout_status='failed'` and log error
6. Add admin retry control for failed payouts.
7. (Optional but recommended) Add webhook reconciliation for transfer updates.

## Recommended payout timing
- Trigger payout only after provider accepts booking.
- If provider rejects booking, mark `payout_status='cancelled'` and process full refund to tourist.
