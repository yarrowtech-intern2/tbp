-- Vendor post-level approval migration
-- Date: 2026-05-02
-- Goal:
-- 1) Provider accounts do not require account verification.
-- 2) Listings enter moderation as pending.
-- 3) Admin approves listings to go live.
-- 4) Keep backward compatibility for legacy "published" status rows.

begin;

-- Provider accounts are active by default.
update public.profiles
set
    verification_status = 'not_required',
    is_verified = true
where role in ('tour_company', 'tour_instructor', 'tour_guide');

-- Allow post moderation states required by the new flow.
alter table public.posts
    alter column status set default 'pending';

alter table public.posts
    drop constraint if exists posts_status_check;

alter table public.posts
    add constraint posts_status_check
    check (status in ('draft', 'pending', 'approved', 'live', 'rejected', 'published'));

-- Optional one-time normalization: map legacy published -> live.
update public.posts
set status = 'live'
where status = 'published';

-- Provider qualification now depends on role only, not account verification.
create or replace function public.is_verified_provider(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = check_user_id
          and role in ('tour_company', 'tour_instructor', 'tour_guide')
    );
$$;

grant execute on function public.is_verified_provider(uuid) to anon, authenticated, service_role;

-- Public can only read live listings (plus published for compatibility).
drop policy if exists "posts_public_read_published" on public.posts;
create policy "posts_public_read_published"
on public.posts
for select
to anon, authenticated
using (
    status in ('live', 'published')
    or provider_user_id = auth.uid()
    or user_id = auth.uid()
    or public.is_admin_user()
);

-- Providers can create only their own pending listings.
drop policy if exists "posts_provider_insert_verified" on public.posts;
drop policy if exists "posts_provider_insert_owner_pending" on public.posts;
create policy "posts_provider_insert_owner_pending"
on public.posts
for insert
to authenticated
with check (
    public.is_verified_provider()
    and (
        provider_user_id = auth.uid()
        or user_id = auth.uid()
    )
    and status = 'pending'
);

-- Providers can edit their own listings but cannot self-publish to live.
-- They should resubmit as pending for moderation.
drop policy if exists "posts_update_owner_or_admin" on public.posts;
create policy "posts_update_owner_or_admin"
on public.posts
for update
to authenticated
using (
    provider_user_id = auth.uid()
    or user_id = auth.uid()
    or public.is_admin_user()
)
with check (
    public.is_admin_user()
    or (
        public.is_verified_provider()
        and (
            provider_user_id = auth.uid()
            or user_id = auth.uid()
        )
        and status in ('draft', 'pending', 'rejected')
    )
);

-- Audit log compatibility for new listing action.
alter table public.moderation_audit_logs
    drop constraint if exists moderation_audit_logs_action_check;

alter table public.moderation_audit_logs
    add constraint moderation_audit_logs_action_check
    check (action in ('approved', 'rejected', 'published', 'live', 'resubmitted'));

commit;
