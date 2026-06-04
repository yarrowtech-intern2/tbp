-- Stores landing-page contact modal submissions.
-- Apply this after docs/marketing-content-role-migration.sql so the marketing helper exists.

create table if not exists public.contact_submissions (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(btrim(name)) between 1 and 160),
    email text not null check (char_length(btrim(email)) between 3 and 320 and position('@' in email) > 1),
    phone text not null check (char_length(btrim(phone)) between 5 and 40),
    location text not null check (char_length(btrim(location)) between 1 and 160),
    message text not null check (char_length(btrim(message)) between 1 and 4000),
    source_page text not null default 'landing_page',
    created_at timestamptz not null default now()
);

create index if not exists contact_submissions_created_at_idx
    on public.contact_submissions(created_at desc);

alter table public.contact_submissions enable row level security;

drop policy if exists "contact_submissions_insert_public" on public.contact_submissions;
create policy "contact_submissions_insert_public"
on public.contact_submissions
for insert
to anon, authenticated
with check (true);

drop policy if exists "contact_submissions_select_admin_or_marketing" on public.contact_submissions;
create policy "contact_submissions_select_admin_or_marketing"
on public.contact_submissions
for select
to authenticated
using (public.is_admin_user() or public.is_marketing_user());

grant insert on public.contact_submissions to anon, authenticated;
grant select on public.contact_submissions to authenticated;
