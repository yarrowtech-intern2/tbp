# Admin-Only Boundary Audit

Date: 2026-08-10

Scope: static review of admin-only controls for listing/provider moderation, refund processing, and account map access.

## Result

The local setup now has database-level protection for the admin-only paths reviewed here:

- Listing moderation status and review fields are blocked for non-admin table updates.
- Provider verification approval/rejection and review fields are blocked for non-admin table updates.
- Refund processing fields are blocked for non-admin table updates; travelers can still submit a pending refund request.
- Payout accounting fields are blocked for non-admin table updates; providers can still make the expected booking accept/reject payout-status transition.
- Account map data is exposed through `public.get_admin_account_locations()`, which rejects non-admin callers.

Live staging verification is still required after the SQL setup files are applied.

## Boundary Matrix

| Area | Expected access | Current control |
| --- | --- | --- |
| Listing moderation queue | Admin can review pending/rejected listings; providers cannot self-approve. | RLS owner/admin policy plus `posts_prevent_non_admin_moderation_change` blocks non-admin `approved`, `live`, and `published` status changes and non-null review fields. |
| Provider verification review | Admin can approve/reject verification records; providers can only submit/resubmit. | RLS policy plus `verification_prevent_non_admin_review_change` blocks non-admin `approved`/`rejected` status changes and review fields. |
| Moderation audit logs | Admin can read audit logs; actors can write their own event rows for resubmission compatibility. | `moderation_audit_logs_select_admin_only` restricts reads to admins. Insert policy remains actor/target/admin for provider resubmission events. |
| Refund processing | Tourist can request a pending refund; admin can move refund to processing/completed and set reference/admin note. | `bookings_prevent_non_admin_refund_processing_change` blocks non-admin payment status changes, refund completion states, processed fields, admin note, and reference. |
| Account map | Admin can inspect account location/contact map data. | `public.get_admin_account_locations()` checks `public.is_admin_user(auth.uid())`; the frontend map loader calls this RPC first. |

## Live Verification SQL

Run these checks in staging with tourist, provider, marketing, and admin sessions:

```sql
-- Non-admin: should fail or update zero rows.
with target as (
    select id
    from public.posts
    where status in ('pending', 'rejected')
    limit 1
)
update public.posts
set status = 'live', reviewed_at = now(), reviewed_by = auth.uid()
where id in (select id from target);

-- Non-admin provider: should fail for direct verification approval.
update public.verification
set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
where user_id = auth.uid();

-- Tourist: pending refund request is allowed only on their own booking via app flow.
-- These direct processing changes should fail for non-admin users.
update public.bookings
set refund_status = 'completed',
    payment_status = 'refunded',
    refund_processed_at = now(),
    refund_processed_by = auth.uid(),
    refund_reference = 'manual-test'
where user_id = auth.uid();

-- Non-admin: should fail with Forbidden.
select * from public.get_admin_account_locations();

-- Admin: should return account map rows.
select id, role, city, country
from public.get_admin_account_locations()
limit 10;
```

Expected result: non-admin write attempts are rejected by RLS or trigger errors, the non-admin account-map RPC call returns `Forbidden`, and the admin account-map RPC returns rows or a clear empty result.
