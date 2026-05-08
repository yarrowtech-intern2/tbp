# Razorpay Booking Change Log

Date: 2026-04-30  
Scope: Payment-first booking flow for tours, activities, and events

## What Changed
- Introduced a Razorpay payment-first checkout path.
- Booking creation now happens only after successful payment signature verification in Supabase Edge Functions.
- Added server-side Razorpay order creation and payment confirmation functions:
  - `supabase/functions/create-razorpay-order`
  - `supabase/functions/confirm-razorpay-booking`

## Database Changes
Applied in: `docs/razorpay-booking-migration.sql`

Added columns to `public.bookings`:
- `payment_order_id text`
- `payment_id text`
- `payment_signature text`
- `payment_currency text default 'INR'`
- `paid_at timestamptz`

Added indexes:
- `bookings_payment_id_uniq` (unique, partial index on `payment_id`)
- `bookings_payment_order_id_idx`

## Behavior Change
- Old behavior: booking row could be inserted directly from client without payment.
- New behavior: booking insert is completed by backend function after verified Razorpay success payload.

## Environment Variables Required (Supabase Edge Functions)
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY` (usually available in Supabase function runtime)

For local setup placeholders:
```bash
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
```
