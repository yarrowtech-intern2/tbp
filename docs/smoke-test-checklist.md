# Smoke Test Checklist

Use this checklist for each staging or production deploy candidate.

Run metadata:

- Environment:
- URL:
- Commit:
- Tester:
- Date:
- Browser/device:
- Result: `PASS` / `FAIL`

Status legend:

- `[ ]` Not run
- `[x]` Pass
- `[!]` Fail
- `[-]` Not applicable

## 1. Public And Guest Flow

- [ ] Landing page loads without console errors.
- [ ] Guest navigation works for public pages: `/`, `/about`, `/terms`, `/whomadeit`.
- [ ] Public listing/explore entry points do not expose protected data to guests.
- [ ] Auth page loads and form fields are usable on desktop and mobile.
- [ ] Invalid login shows a recoverable error state.
- [ ] OAuth redirect base URL is correct for this environment.

Notes:

-

## 2. Tourist Flow

Required account: tourist test user.

- [ ] Tourist can log in and lands on the expected home/dashboard route.
- [ ] Tourist can open `/explore`.
- [ ] Tourist can filter/search listings.
- [ ] Tourist can open a listing detail page.
- [ ] Tourist can save and unsave a favorite.
- [ ] Tourist can start a booking checkout in the selected payment mode.
- [ ] Tourist booking confirmation updates dashboard booking state.
- [ ] Tourist can submit a refund request when eligible.
- [ ] Tourist can open route planner `/map`.
- [ ] Tourist can build/save a route and see it in route history.
- [ ] Tourist can open messages/notifications.
- [ ] Tourist can update profile fields and avatar.

Notes:

-

## 3. Provider Flow

Required account: approved provider test user.

- [ ] Provider can log in and lands on provider dashboard.
- [ ] Provider can open Studio.
- [ ] Provider can create a tour/activity/guide draft with required fields.
- [ ] Provider image upload validates type and size.
- [ ] Provider can submit a listing for review.
- [ ] Provider can see submitted listings and statuses.
- [ ] Provider can respond to booking requests.
- [ ] Provider can view revenue/payout section.
- [ ] Provider can start a listing boost or ad purchase in selected payment mode.
- [ ] Provider cannot access admin-only pages.

Notes:

-

## 4. Admin Flow

Required account: admin test user.

- [ ] Admin can log in and lands on admin dashboard.
- [ ] Admin can see moderation queue.
- [ ] Admin can approve a submitted listing.
- [ ] Admin can reject a submitted listing with reason.
- [ ] Admin can review provider verification requests.
- [ ] Admin can inspect booking/refund workflow.
- [ ] Admin can inspect revenue totals.
- [ ] Admin account map loads or shows a clear empty state.
- [ ] Admin audit log loads.
- [ ] Non-admin users cannot access `/admin` or admin dashboard sections.

Notes:

-

## 5. Marketing Flow

Required account: marketing test user.

- [ ] Marketing user can log in and lands on marketing dashboard.
- [ ] Marketing user can edit greeting content.
- [ ] Marketing user can edit about content.
- [ ] Marketing user can edit contact/sales settings.
- [ ] Marketing user can view contact leads.
- [ ] Marketing user cannot access admin-only controls.

Notes:

-

## 6. Payment And Edge Function Flow

Required setup: selected Razorpay mode and Supabase Edge Functions deployed.

- [ ] `create-razorpay-order` returns a valid order only for authenticated eligible users.
- [ ] `confirm-razorpay-booking` accepts valid signed payment data.
- [ ] `confirm-razorpay-booking` rejects invalid signature/payment data.
- [ ] `create-razorpay-promo-order` returns a valid order only for eligible provider/admin use.
- [ ] `confirm-razorpay-promo-purchase` accepts valid signed payment data.
- [ ] `confirm-razorpay-promo-purchase` rejects invalid signature/payment data.
- [ ] `process-provider-payout` is not callable without the payout processor secret.
- [ ] Payment failure or cancellation leaves a recoverable UI state.

Notes:

-

## 7. Security Boundary Checks

- [ ] Guest cannot access protected routes.
- [ ] Tourist cannot access provider/admin/marketing controls.
- [ ] Provider cannot access other providers' private listings/bookings.
- [ ] Provider cannot access admin moderation/refund/revenue controls.
- [ ] Marketing cannot access admin moderation/refund/revenue controls.
- [ ] User A cannot read User B private profile, bookings, favorites, messages, or route history.
- [ ] Storage URLs and policies do not allow unauthorized uploads or overwrites.

Notes:

-

## 8. UX And Device Checks

- [ ] Desktop smoke pass at approximately 1440px width.
- [ ] Tablet smoke pass at approximately 768px width.
- [ ] Mobile smoke pass at approximately 390px width.
- [ ] No critical text overlap or clipped controls.
- [ ] Loading states appear for slow operations.
- [ ] Error states are understandable and recoverable.
- [ ] Browser back/forward navigation works on core routes.
- [ ] App reload preserves expected authenticated state.

Notes:

-

## 9. Final Verification

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Known blockers from `docs/production-readiness-tasklist.md` are reviewed.
- [ ] Smoke-test failures are either fixed or explicitly accepted for this release.

Final notes:

-
