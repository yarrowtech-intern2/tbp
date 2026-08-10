# Production Readiness Task List

Status legend:
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[?]` Needs decision

Current release target: staging/beta first, production after the blockers below are closed.

Completion: 30% (26 of 86 checklist items complete).

## 0. Operating Rules

- [x] Keep this document updated after every completed task.
- [x] Ask for a decision before changing architecture, paid services, launch scope, or security-sensitive behavior.
- [ ] Keep unrelated worktree changes separate from production-readiness changes.
- [x] Before each production deploy candidate, run and record `npm run lint` and `npm run build`.

## 1. Baseline Health

- [x] Verify production build completes.
  - Result: `npm run build` passes after chunk and Lottie fixes.
- [x] Fix `npm run lint` errors.
  - Result: `npm run lint` passes with zero warnings.
- [x] Reduce lint warnings that can hide real hook bugs.
- [x] Decide whether lint should exclude generated/build artifacts such as `android/app/build/**`.
  - Decision: exclude generated artifacts from linting.
- [x] Add a documented smoke-test checklist for the core app flows.
  - Result: see `docs/smoke-test-checklist.md`.
- [ ] Run the smoke-test checklist manually and record results here.

## 2. Secrets And Environment

- [?] Decide production hosting target.
  - Options to choose later: Vercel, Netlify, Cloudflare Pages, Supabase hosting, other.
- [?] Decide backend project separation.
  - Recommended: separate Supabase projects for local/dev, staging, and production.
- [x] Remove real or sensitive-looking secrets from `.env.example`.
  - Result: concrete Upstash values were replaced with placeholders.
- [x] Confirm `.env` is not committed and production secrets are only set in hosting/Supabase dashboards.
  - Result: `git ls-files -- .env .env.example` returned no tracked files.
- [x] Replace browser-exposed `VITE_OPENAI_API_KEY` design with a server/edge-function proxy or disable AI mode in production.
  - Result: browser-side AI mode was disabled; chatbot now uses rule-based database replies only.
- [x] Document required production environment variables.
- [x] Document required Supabase function secrets.
- [ ] Rotate any secret that may have been exposed in repo files, logs, screenshots, or shared output.

## 3. Supabase Database And Security

- [x] Inventory all required migrations and SQL setup files.
  - Result: see `docs/supabase-setup-inventory.md`.
- [x] Convert any required loose SQL files into ordered Supabase migrations, or document exact manual application order.
  - Result: `docs/supabase-setup-inventory.md` now documents an exact manual setup order and identifies optional/superseded loose SQL files.
- [x] Verify Row Level Security is enabled on all user/business data tables.
  - Static audit started: see `docs/rls-coverage-audit.md`.
  - Result: local setup scripts now enable RLS for active user/business tables, add conditional coverage for legacy/review tables, and document the live verification query for staging/production.
- [x] Verify policies for tourist, provider, admin, and marketing roles.
  - Result: see `docs/role-policy-audit.md`; profile role escalation via self-update was blocked in policy SQL.
- [x] Test that one user cannot read or mutate another user's private data.
  - Result: see `docs/cross-user-boundary-audit.md`; profile reads were hardened from all-authenticated access to relationship-aware visibility.
- [x] Test provider access boundaries for listings, bookings, ads, and payouts.
  - Result: see `docs/provider-access-boundary-audit.md`; local SQL now blocks non-admin listing/booking owner reassignment and allows admin payout-onboarding review.
- [x] Test admin-only moderation, refunds, and account map access.
  - Result: see `docs/admin-only-boundary-audit.md`; local SQL now guards moderation/review/refund/accounting fields and exposes account map rows through an admin-only RPC.
- [ ] Confirm storage buckets and policies for listing/profile/ad uploads.
- [ ] Add a database backup and restore plan.

## 4. Payments, Refunds, And Payouts

- [?] Decide launch payment mode.
  - Choices: Razorpay test mode only, limited live payments, or no payments for beta.
- [ ] Verify Razorpay order creation cannot be tampered with from the browser.
- [ ] Verify booking confirmation uses server-side Razorpay signature validation.
- [ ] Verify promo/ad purchase confirmation uses server-side Razorpay signature validation.
- [ ] Verify refund workflow states and permissions end to end.
- [ ] Verify provider payout fields and Razorpay Route onboarding requirements.
- [ ] Add operational notes for failed payments, partial failures, duplicate confirmations, and payout retries.
- [ ] Run live-mode penny test or test-mode equivalent before production.

## 5. Auth, Roles, And Account Lifecycle

- [ ] Verify signup/login/logout flows for each role.
- [ ] Verify route guards for guest, tourist, provider, admin, and marketing users.
- [ ] Verify admin access cannot be granted only through editable client metadata.
- [ ] Verify provider verification workflow from signup through approval/rejection.
- [ ] Verify profile completion, avatar upload, location, and follow/messaging behavior.
- [ ] Define account deletion/deactivation handling.

## 6. Core User Flows

- [ ] Tourist can explore listings and open listing details.
- [ ] Tourist can save and unsave favorites.
- [ ] Tourist can book a listing through payment flow.
- [ ] Tourist can see bookings, route history, refunds, and messages.
- [ ] Provider can create listing drafts and submit for review.
- [ ] Provider can manage live listings and booking decisions.
- [ ] Provider can create promotional ads or boosts.
- [ ] Admin can moderate listings and verification requests.
- [ ] Admin can manage refunds and inspect platform revenue.
- [ ] Marketing can edit public content and review contact leads.

## 7. UX Production Polish

- [ ] Replace blocking `alert()` calls with app UI notifications/toasts/modals.
- [ ] Add loading and error states for high-latency Supabase/payment operations.
- [ ] Verify mobile layouts for landing, auth, explore, listing detail, dashboard, map, and profile.
- [ ] Verify empty states across dashboards.
- [ ] Verify image upload validation feedback is clear and recoverable.
- [ ] Verify accessibility basics: labels, focus states, keyboard navigation, contrast.
- [ ] Confirm production copy, support email, phone, terms, privacy, and refund policy links.

## 8. Performance And Bundle Health

- [x] Remove `lottie-web` eval warning from default build.
- [x] Reduce `RoleDashboard` chunk size by removing ECharts runtime dependency.
- [x] Split stable vendor chunks in Vite.
- [ ] Run Lighthouse or equivalent on production build preview.
- [ ] Check large assets in `public/` and `docs/` are not accidentally shipped where unused.
- [ ] Confirm image optimization strategy for listing, profile, map, and landing assets.
- [ ] Verify app startup time on a mid-range mobile device.

## 9. Observability And Operations

- [?] Decide error monitoring tool.
  - Options to choose later: Sentry, PostHog, LogRocket, custom Supabase logs, none for beta.
- [ ] Add frontend error boundary for app-level crashes.
- [ ] Add structured logging for Supabase Edge Functions without leaking secrets or PII.
- [ ] Add basic uptime/deployment checks.
- [ ] Document rollback procedure.
- [ ] Document support process for booking/payment incidents.

## 10. Deployment

- [?] Decide production domain.
- [?] Decide staging domain.
- [ ] Configure hosting project and environment variables.
- [ ] Configure Supabase production project and secrets.
- [ ] Deploy staging build.
- [ ] Run staging smoke tests.
- [ ] Fix staging findings.
- [ ] Deploy production build.
- [ ] Run production smoke tests.
- [ ] Record final deploy URL, commit, and verification result.

## Current Known Blockers

- [x] `npm run lint` fails.
- [x] Client-side `VITE_OPENAI_API_KEY` pattern is not production-safe.
- [x] `.env.example` contains sensitive-looking concrete Upstash values.
- [ ] Payment/security flows need explicit verification before live launch.
- [ ] No recorded end-to-end smoke-test pass yet.

## Progress Log

- 2026-08-07: Created this task list.
- 2026-08-07: Confirmed `npm run build` passes after build-warning fixes.
- 2026-08-07: Recorded current lint failures as production blockers.
- 2026-08-07: Fixed lint configuration and source hook/type issues. `npm run lint` passes with zero warnings.
- 2026-08-07: Re-ran `npm run build`; production build passes.
- 2026-08-07: Added completion percentage to this task list.
- 2026-08-07: Removed sensitive-looking values from `.env.example` and disabled browser-side OpenAI key usage.
- 2026-08-07: Re-ran `npm run lint` and `npm run build`; both pass after secrets/environment cleanup.
- 2026-08-07: Added `docs/smoke-test-checklist.md` for repeatable staging and production smoke tests.
- 2026-08-07: Added `docs/supabase-setup-inventory.md` for database, storage, and Edge Function setup inventory.
- 2026-08-07: Re-ran `npm run lint` and `npm run build`; both pass after Supabase inventory documentation.
- 2026-08-10: Tightened Supabase setup inventory with exact manual application order, optional legacy data migration, and superseded loose SQL files.
- 2026-08-10: Started static RLS coverage audit and added RLS policies for promotion payment tables.
- 2026-08-10: Re-ran `npm run lint` and `npm run build`; both pass after RLS audit and promotion policy changes.
- 2026-08-10: Completed local RLS setup coverage for user/business tables, including conditional policies for legacy reviews, legacy bookings, and public legacy content tables.
- 2026-08-10: Re-ran `npm run lint` and `npm run build`; both pass after completing local RLS setup coverage.
- 2026-08-10: Completed static role-policy audit and hardened profile insert/update policies against self-assigned internal roles.
- 2026-08-10: Re-ran `npm run lint` and `npm run build`; both pass after role-policy hardening.
- 2026-08-10: Completed static cross-user boundary audit and hardened profile read access to self/admin/public-provider/relationship visibility.
- 2026-08-10: Re-ran `npm run lint` and `npm run build`; both pass after cross-user boundary hardening.
- 2026-08-10: Completed static provider access boundary audit and hardened listing/booking ownership plus payout onboarding admin access.
- 2026-08-10: Re-ran `npm run lint` and `npm run build`; both pass after provider boundary hardening.
- 2026-08-10: Completed static admin-only boundary audit and hardened moderation, refund processing, payout accounting, and account map access controls.
- 2026-08-10: Re-ran `npm run lint` and `npm run build`; both pass after admin-only boundary hardening.

## Production Environment Variables

Frontend hosting variables:

- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase anon public key.
- `VITE_PUBLIC_APP_URL`: Public frontend origin used for redirects.
- `VITE_ADMIN_EMAILS`: Comma-separated admin allowlist if the app still depends on this check.
- `VITE_RAZORPAY_KEY_ID`: Razorpay publishable key id for browser checkout.

Do not define private keys with a `VITE_` prefix. Vite exposes them to the browser bundle.

Supabase Edge Function secrets:

- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_ANON_KEY`: Supabase anon public key.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key, available only to trusted server/function code.
- `RAZORPAY_KEY_ID`: Razorpay key id for server-side order/payout calls.
- `RAZORPAY_KEY_SECRET`: Razorpay secret for server-side order/payout/signature verification.
- `PAYOUT_PROCESSOR_SECRET`: Long random secret for payout operations.
- `UPSTASH_REDIS_REST_URL`: Optional Redis REST URL for function cache.
- `UPSTASH_REDIS_REST_TOKEN`: Optional Redis REST token for function cache.
