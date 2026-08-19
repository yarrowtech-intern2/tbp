-- CRM Phase 1: lead status tracking and notes for public.contact_submissions.
-- Depends on public.is_admin_user() and public.is_marketing_user(), defined in
-- docs/supabase-role-system.sql and docs/marketing-content-role-migration.sql.
-- Apply after public.contact_submissions exists
-- (docs/contact-submissions-migration.sql or supabase/migrations/202606060001_create_contact_submissions.sql).

create table if not exists public.crm_lead_status (
    contact_submission_id uuid primary key references public.contact_submissions(id) on delete cascade,
    status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'converted', 'closed')),
    updated_by uuid references public.profiles(id) on delete set null,
    updated_at timestamptz not null default now()
);

create index if not exists crm_lead_status_status_idx
    on public.crm_lead_status(status);

alter table public.crm_lead_status enable row level security;

drop policy if exists "crm_lead_status_select_admin_or_marketing" on public.crm_lead_status;
create policy "crm_lead_status_select_admin_or_marketing"
on public.crm_lead_status
for select
to authenticated
using (public.is_admin_user() or public.is_marketing_user());

drop policy if exists "crm_lead_status_insert_admin_or_marketing" on public.crm_lead_status;
create policy "crm_lead_status_insert_admin_or_marketing"
on public.crm_lead_status
for insert
to authenticated
with check (public.is_admin_user() or public.is_marketing_user());

drop policy if exists "crm_lead_status_update_admin_or_marketing" on public.crm_lead_status;
create policy "crm_lead_status_update_admin_or_marketing"
on public.crm_lead_status
for update
to authenticated
using (public.is_admin_user() or public.is_marketing_user())
with check (public.is_admin_user() or public.is_marketing_user());

grant select, insert, update on public.crm_lead_status to authenticated;

create table if not exists public.crm_lead_notes (
    id uuid primary key default gen_random_uuid(),
    contact_submission_id uuid not null references public.contact_submissions(id) on delete cascade,
    author_id uuid not null references public.profiles(id) on delete cascade,
    body text not null check (char_length(btrim(body)) between 1 and 4000),
    created_at timestamptz not null default now()
);

create index if not exists crm_lead_notes_contact_submission_id_idx
    on public.crm_lead_notes(contact_submission_id, created_at desc);

alter table public.crm_lead_notes enable row level security;

drop policy if exists "crm_lead_notes_select_admin_or_marketing" on public.crm_lead_notes;
create policy "crm_lead_notes_select_admin_or_marketing"
on public.crm_lead_notes
for select
to authenticated
using (public.is_admin_user() or public.is_marketing_user());

drop policy if exists "crm_lead_notes_insert_admin_or_marketing" on public.crm_lead_notes;
create policy "crm_lead_notes_insert_admin_or_marketing"
on public.crm_lead_notes
for insert
to authenticated
with check (
    (public.is_admin_user() or public.is_marketing_user())
    and author_id = auth.uid()
);

grant select, insert on public.crm_lead_notes to authenticated;
