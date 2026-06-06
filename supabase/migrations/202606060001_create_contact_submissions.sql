create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null default '',
  location text not null default '',
  message text not null,
  source_page text not null default 'landing_page',
  created_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;

drop policy if exists "Public can submit contact forms" on public.contact_submissions;
create policy "Public can submit contact forms"
  on public.contact_submissions
  for insert
  to anon, authenticated
  with check (
    length(trim(name)) > 0
    and length(trim(email)) > 0
    and length(trim(message)) > 0
  );

drop policy if exists "Admin and marketing can read contact submissions" on public.contact_submissions;
create policy "Admin and marketing can read contact submissions"
  on public.contact_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'marketing')
    )
  );

create index if not exists contact_submissions_created_at_idx
  on public.contact_submissions (created_at desc);

